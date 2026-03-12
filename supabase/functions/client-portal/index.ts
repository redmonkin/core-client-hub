import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateProposalRequest {
  token: string;
  action: "approve" | "reject" | "request_changes";
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    // GET - Retrieve proposal by token
    if (req.method === "GET") {
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Fetching proposal for token: ${token.substring(0, 8)}...`);

      // Find the access token
      const { data: accessToken, error: tokenError } = await supabase
        .from("proposal_access_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError) {
        console.error("Token lookup error:", tokenError);
        throw tokenError;
      }

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired link" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if token is expired
      if (new Date(accessToken.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This link has expired" }),
          { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if password verification is needed
      const passwordHash = (accessToken as any).password_hash;
      const providedPasswordHash = url.searchParams.get("ph");

      if (passwordHash && !providedPasswordHash) {
        // Return that password is required (don't send proposal data)
        return new Response(
          JSON.stringify({ password_required: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (passwordHash && providedPasswordHash !== passwordHash) {
        return new Response(
          JSON.stringify({ error: "Incorrect password" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get the proposal with client info and user_id
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .select(`
          id,
          title,
          scope_of_work,
          cost_breakdown,
          validity_date,
          status,
          client_id,
          project_id,
          user_id,
          created_at,
          customer_goals,
          duration
        `)
        .eq("id", accessToken.proposal_id)
        .single();

      if (proposalError) {
        console.error("Proposal lookup error:", proposalError);
        throw proposalError;
      }

      // Get client details
      const { data: client } = await supabase
        .from("clients")
        .select("client_name, company_name, email, phone, designation, billing_address")
        .eq("id", proposal.client_id)
        .single();

      // Get project name if exists
      let projectName = null;
      if (proposal.project_id) {
        const { data: project } = await supabase
          .from("projects")
          .select("project_name")
          .eq("id", proposal.project_id)
          .single();
        projectName = project?.project_name;
      }

      // Get branding settings for the proposal owner
      const { data: branding } = await supabase
        .from("branding_settings")
        .select("company_name, company_logo_url, primary_color, accent_color, tagline, website_url, support_email")
        .eq("user_id", proposal.user_id)
        .maybeSingle();

      // Get the user's proposal template
      const { data: template } = await supabase
        .from("templates")
        .select("content, name")
        .eq("user_id", proposal.user_id)
        .eq("type", "proposal")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Update viewed_at and create notification if not already viewed
      if (!accessToken.viewed_at) {
        await supabase
          .from("proposal_access_tokens")
          .update({ viewed_at: new Date().toISOString() })
          .eq("id", accessToken.id);

        // Check user's notification preferences
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("proposal_viewed")
          .eq("user_id", proposal.user_id)
          .maybeSingle();

        // Create notification for proposal owner if preference allows
        const shouldNotify = prefs?.proposal_viewed !== false;
        if (shouldNotify) {
          const clientName = client?.client_name || client?.company_name || "A client";
          await supabase.from("notifications").insert({
            user_id: proposal.user_id,
            type: "proposal_viewed",
            title: "Proposal Viewed",
            message: `${clientName} viewed your proposal "${proposal.title}"`,
            reference_id: proposal.id,
            reference_type: "proposal",
          });
          console.log(`Created view notification for user ${proposal.user_id}`);
        }
      }

      console.log(`Proposal ${proposal.id} retrieved successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          proposal: {
            ...proposal,
            client_name: client?.client_name,
            company_name: client?.company_name,
            client_email: client?.email,
            client_phone: client?.phone,
            client_designation: client?.designation,
            client_address: client?.billing_address,
            project_name: projectName,
          },
          branding: branding || null,
          template: template || null,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // POST - Update proposal status (approve/reject)
    if (req.method === "POST") {
      const { token: bodyToken, action, notes }: UpdateProposalRequest = await req.json();
      const accessToken = bodyToken || token;

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Token is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!action || !["approve", "reject", "request_changes"].includes(action)) {
        return new Response(
          JSON.stringify({ error: "Valid action (approve/reject/request_changes) is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Processing ${action} for token: ${accessToken.substring(0, 8)}...`);

      // Find and validate the access token
      const { data: tokenData, error: tokenError } = await supabase
        .from("proposal_access_tokens")
        .select("*")
        .eq("token", accessToken)
        .maybeSingle();

      if (tokenError) throw tokenError;

      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired link" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This link has expired" }),
          { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get current proposal status before update
      const { data: currentProposal } = await supabase
        .from("proposals")
        .select("status, user_id")
        .eq("id", tokenData.proposal_id)
        .single();

      const previousStatus = currentProposal?.status || 'sent';

      // Update proposal status
      const newStatus = action === "approve" ? "approved" : action === "request_changes" ? "change_requested" : "rejected";
      const { error: updateError } = await supabase
        .from("proposals")
        .update({ status: newStatus })
        .eq("id", tokenData.proposal_id);

      if (updateError) throw updateError;

      // Log status change in history
      await supabase.from("proposal_status_history").insert({
        proposal_id: tokenData.proposal_id,
        user_id: currentProposal?.user_id || '00000000-0000-0000-0000-000000000000',
        from_status: previousStatus,
        to_status: newStatus,
        note: action === "request_changes" && notes ? notes : action === "approve" ? "Approved via client portal" : "Rejected via client portal",
      });

      // Get proposal details for notification
      const { data: proposal } = await supabase
        .from("proposals")
        .select("title, user_id, client_id")
        .eq("id", tokenData.proposal_id)
        .single();

      // Get client name
      const { data: client } = await supabase
        .from("clients")
        .select("client_name, company_name")
        .eq("id", proposal?.client_id)
        .single();

      // Create notification for proposal owner if preference allows
      if (proposal) {
        const clientName = client?.client_name || client?.company_name || "A client";
        const notificationTypeMap: Record<string, string> = {
          approve: "proposal_approved",
          reject: "proposal_rejected",
          request_changes: "proposal_revision_requested",
        };
        const emojiMap: Record<string, string> = { approve: "✅", reject: "❌", request_changes: "📝" };
        const titleMap: Record<string, string> = {
          approve: "Proposal Approved!",
          reject: "Proposal Rejected",
          request_changes: "Changes Requested",
        };

        // Check user's notification preferences
        const { data: prefs } = await supabase
          .from("notification_preferences")
          .select("proposal_approved, proposal_rejected")
          .eq("user_id", proposal.user_id)
          .maybeSingle();

        const shouldNotify = action === "approve" 
          ? prefs?.proposal_approved !== false 
          : prefs?.proposal_rejected !== false;
        if (shouldNotify) {
          const changeNotesText = action === "request_changes" && notes ? `\n\nNotes: ${notes}` : "";
          await supabase.from("notifications").insert({
            user_id: proposal.user_id,
            type: notificationTypeMap[action],
            title: titleMap[action],
            message: `${emojiMap[action]} ${clientName} has ${action === "request_changes" ? "requested changes to" : action + "d"} your proposal "${proposal.title}"${changeNotesText}`,
            reference_id: tokenData.proposal_id,
            reference_type: "proposal",
          });
          console.log(`Created ${action} notification for user ${proposal.user_id}`);

          // Send email notification to proposal owner
          try {
            const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
            const { data: ownerData } = await supabase.auth.admin.getUserById(proposal.user_id);
            const ownerEmail = ownerData?.user?.email;
            if (ownerEmail) {
              const typeMap: Record<string, string> = {
                approve: "proposal_approved",
                reject: "proposal_rejected",
                request_changes: "proposal_change_requested",
              };
              const emojiMap: Record<string, string> = { approve: "✅", reject: "❌", request_changes: "📝" };
              const subjectMap: Record<string, string> = {
                approve: "Proposal Approved!",
                reject: "Proposal Declined",
                request_changes: "Changes Requested",
              };
              const colorMap: Record<string, string> = {
                approve: "#22c55e",
                reject: "#ef4444",
                request_changes: "#f59e0b",
              };
              const messageMap: Record<string, string> = {
                approve: `<strong>${clientName}</strong> has approved your proposal <strong>"${proposal.title}"</strong>. You can proceed with the next steps.`,
                reject: `<strong>${clientName}</strong> has declined your proposal <strong>"${proposal.title}"</strong>.`,
                request_changes: `<strong>${clientName}</strong> has requested changes to your proposal <strong>"${proposal.title}"</strong>.`,
              };
              const notesHtml = action === "request_changes" && notes
                ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;margin:20px 0;border-radius:0 8px 8px 0;"><h4 style="margin:0 0 8px;color:#92400e;font-size:13px;text-transform:uppercase;">Client's Notes</h4><p style="margin:0;color:#78350f;">${notes.replace(/\n/g, "<br>")}</p></div>`
                : "";
              const ownerName = ownerData?.user?.user_metadata?.full_name || ownerEmail.split("@")[0];

              await resend.emails.send({
                from: "Notifications <noreply@notifications.redmonk.in>",
                to: [ownerEmail],
                subject: `${emojiMap[action]} ${subjectMap[action]} — ${proposal.title}`,
                html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;"><div style="background:${colorMap[action]};padding:30px;border-radius:10px 10px 0 0;text-align:center;"><div style="font-size:48px;margin-bottom:8px;">${emojiMap[action]}</div><h1 style="color:white;margin:0;font-size:24px;">${subjectMap[action]}</h1></div><div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;"><p style="margin-top:0;">Hi ${ownerName},</p><p>${messageMap[action]}</p>${notesHtml}<p style="color:#6b7280;font-size:14px;margin-bottom:0;">Log in to your dashboard to take the next steps.</p></div></body></html>`,
              });
              console.log(`Email notification sent to ${ownerEmail} for ${action}`);
            }
          } catch (emailErr: any) {
            console.error("Failed to send email notification:", emailErr.message);
            // Don't fail the whole request if email fails
          }
        }

      console.log(`Proposal ${tokenData.proposal_id} status updated to ${newStatus}`);

      return new Response(
        JSON.stringify({ success: true, status: newStatus }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in client-portal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
