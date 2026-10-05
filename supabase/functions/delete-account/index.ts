import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STORAGE_BUCKETS = [
  "avatars",
  "project-files",
  "project-attachments",
  "contract-files",
  "signatures",
  "expense-receipts",
];

// Storage has no recursive delete: walk the folder tree and collect file paths.
async function listFilesRecursive(client: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // Folders come back without an id.
      if (entry.id) files.push(path);
      else files.push(...(await listFilesRecursive(client, bucket, path)));
    }
    if (data.length < 1000) break;
  }
  return files;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's token to get their ID
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client to delete user and their data
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // All database rows the user owns, in one transaction (see
    // delete_user_data in 20261004110000_account_deletion_and_settings_access.sql).
    const { error: dataError } = await adminClient.rpc("delete_user_data", { p_user_id: user.id });
    if (dataError) {
      console.error("Error deleting user data:", dataError.message);
      return new Response(
        JSON.stringify({ error: "Failed to delete account data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Every bucket keeps a user's files under "<user id>/...".
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const paths = await listFilesRecursive(adminClient, bucket, user.id);
        for (let i = 0; i < paths.length; i += 100) {
          const { error } = await adminClient.storage.from(bucket).remove(paths.slice(i, i + 100));
          if (error) console.error(`Error removing files from ${bucket}:`, error.message);
        }
      } catch (storageErr) {
        console.error(`Error listing files in ${bucket}:`, storageErr);
      }
    }

    // Delete the user account
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-account function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
