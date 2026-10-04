import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBLIC_PREFIX_RE = /\/storage\/v1\/object\/public\/project-files\//;

function extractPath(value: string): string | null {
  if (!value) return null;
  if (PUBLIC_PREFIX_RE.test(value)) {
    return value.split(PUBLIC_PREFIX_RE)[1].split("?")[0];
  }
  if (/^https?:\/\//i.test(value)) return null;
  return value.split("?")[0];
}

// Feature images are uploaded to `<uploader id>/<project id>/feature.<ext>`.
// Only sign paths inside this project's own folder, so a featured project
// can't point feature_image_url at another workspace's private file.
function isOwnFeatureImage(path: string, projectId: string): boolean {
  const parts = path.split("/");
  return parts.length === 3 && parts[1] === projectId && /^feature\.[A-Za-z0-9]+$/.test(parts[2]);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const projectIds: unknown = body.project_ids;
    if (!Array.isArray(projectIds) || projectIds.length === 0 || projectIds.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: "project_ids must be a non-empty array (max 50)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const ids = projectIds.filter((v): v is string => typeof v === "string");

    // Service-role client (bypasses RLS); we manually filter to is_featured = true.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: featured, error } = await admin
      .from("projects")
      .select("id, user_id, feature_image_url, is_featured")
      .in("id", ids)
      .eq("is_featured", true);

    if (error) throw error;

    // Only owners who have published a portfolio (have a slug), matching the
    // public_portfolio_projects view, so unpublished work stays private.
    const ownerIds = [...new Set((featured || []).map((p) => p.user_id))];
    const { data: published, error: brandingError } = ownerIds.length
      ? await admin.from("branding_settings").select("user_id").in("user_id", ownerIds).not("slug", "is", null)
      : { data: [], error: null };
    if (brandingError) throw brandingError;
    const publishedOwners = new Set((published || []).map((b) => b.user_id));
    const projects = (featured || []).filter((p) => publishedOwners.has(p.user_id));

    const urls: Record<string, string | null> = {};
    for (const id of ids) urls[id] = null;

    await Promise.all(
      (projects ?? []).map(async (p) => {
        if (!p.feature_image_url) return;
        const path = extractPath(p.feature_image_url);
        if (!path) {
          // External URL — return as-is
          urls[p.id] = p.feature_image_url;
          return;
        }
        if (!isOwnFeatureImage(path, p.id)) return;
        const { data: signed } = await admin.storage
          .from("project-files")
          .createSignedUrl(path, 60 * 60); // 1 hour
        if (signed?.signedUrl) urls[p.id] = signed.signedUrl;
      })
    );

    return new Response(JSON.stringify({ success: true, urls }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("portfolio-image-url error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to sign images" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
