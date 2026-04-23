import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

interface UpdateProposalRequest {
  token: string;
  action: "approve" | "reject" | "request_changes";
  notes?: string;
  signature_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    // GET - Retrieve proposal/contract by token
    if (req.method === "GET") {
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Fetching document for token: ${token.substring(0, 8)}...`);

      // Try proposal_access_tokens first
      let accessToken: any = null;
      let documentType: "proposal" | "contract" = "proposal";

      const { data: proposalToken, error: proposalTokenError } = await supabase
        .from("proposal_access_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (proposalTokenError) {
        console.error("Proposal token lookup error:", proposalTokenError);
        throw proposalTokenError;
      }

      if (proposalToken) {
        accessToken = proposalToken;
        documentType = "proposal";
      } else {
        // Try contract_access_tokens
        const { data: contractToken, error: contractTokenError } = await supabase
          .from("contract_access_tokens")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (contractTokenError) {
          console.error("Contract token lookup error:", contractTokenError);
          throw contractTokenError;
        }

        if (contractToken) {
          accessToken = contractToken;
          documentType = "contract";
        }
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

      // Check if password verification is needed — always require PUT-based verification
      if (accessToken.password_hash) {
        return new Response(
          JSON.stringify({ password_required: true }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (documentType === "proposal") {
        // --- PROPOSAL FLOW (unchanged) ---
        const { data: proposal, error: proposalError } = await supabase
          .from("proposals")
          .select(`id, title, scope_of_work, cost_breakdown, validity_date, status, client_id, project_id, user_id, created_at, customer_goals, duration`)
          .eq("id", accessToken.proposal_id)
          .single();

        if (proposalError) { console.error("Proposal lookup error:", proposalError); throw proposalError; }

        const { data: client } = await supabase
          .from("clients")
          .select("client_name, company_name, email, phone, designation, billing_address")
          .eq("id", proposal.client_id)
          .single();

        let projectName = null;
        if (proposal.project_id) {
          const { data: project } = await supabase.from("projects").select("project_name").eq("id", proposal.project_id).single();
          projectName = project?.project_name;
        }

        const { data: branding } = await supabase
          .from("branding_settings")
          .select("company_name, company_logo_url, primary_color, accent_color, tagline, website_url, support_email")
          .eq("user_id", proposal.user_id)
          .maybeSingle();

        const { data: template } = await supabase
          .from("templates")
          .select("content, name")
          .eq("user_id", proposal.user_id)
          .eq("type", "proposal")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!accessToken.viewed_at) {
          await supabase.from("proposal_access_tokens").update({ viewed_at: new Date().toISOString() }).eq("id", accessToken.id);
          const { data: prefs } = await supabase.from("notification_preferences").select("proposal_viewed").eq("user_id", proposal.user_id).maybeSingle();
          if (prefs?.proposal_viewed !== false) {
            const clientName = client?.client_name || client?.company_name || "A client";
            await supabase.from("notifications").insert({
              user_id: proposal.user_id, type: "proposal_viewed", title: "Proposal Viewed",
              message: `${clientName} viewed your proposal "${proposal.title}"`, reference_id: proposal.id, reference_type: "proposal",
            });
          }
        }

        return new Response(
          JSON.stringify({
            success: true, document_type: "proposal",
            proposal: { ...proposal, client_name: client?.client_name, company_name: client?.company_name, client_email: client?.email, client_phone: client?.phone, client_designation: client?.designation, client_address: client?.billing_address, project_name: projectName },
            branding: branding || null, template: template || null,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        // --- CONTRACT FLOW ---
        const { data: contract, error: contractError } = await supabase
          .from("contracts")
          .select(`id, contract_type, start_date, end_date, value, renewal_frequency, status, scope_of_work, cost_breakdown, client_id, project_id, user_id, created_at, client_signature`)
          .eq("id", accessToken.contract_id)
          .single();

        if (contractError) { console.error("Contract lookup error:", contractError); throw contractError; }

        const contractTypeLabels: Record<string, string> = { amc: "Annual Maintenance Contract", fixed: "Fixed", retainer: "Retainer" };

        const { data: client } = await supabase
          .from("clients")
          .select("client_name, company_name, email, phone, designation, billing_address")
          .eq("id", contract.client_id)
          .single();

        let projectName = null;
        if (contract.project_id) {
          const { data: project } = await supabase.from("projects").select("project_name").eq("id", contract.project_id).single();
          projectName = project?.project_name;
        }

        const { data: branding } = await supabase
          .from("branding_settings")
          .select("company_name, company_logo_url, primary_color, accent_color, tagline, website_url, support_email")
          .eq("user_id", contract.user_id)
          .maybeSingle();

        const { data: template } = await supabase
          .from("templates")
          .select("content, name")
          .eq("user_id", contract.user_id)
          .eq("type", "contract")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!accessToken.viewed_at) {
          await supabase.from("contract_access_tokens").update({ viewed_at: new Date().toISOString() }).eq("id", accessToken.id);
        }

        // Get owner's name for mySignature
        const { data: ownerData } = await supabase.auth.admin.getUserById(contract.user_id);
        const ownerName = ownerData?.user?.user_metadata?.full_name || '';

        // Return contract data in a proposal-compatible shape for the portal to render
        return new Response(
          JSON.stringify({
            success: true, document_type: "contract",
            proposal: {
              id: contract.id,
              title: contractTypeLabels[contract.contract_type] || contract.contract_type,
              scope_of_work: contract.scope_of_work,
              cost_breakdown: contract.cost_breakdown,
              validity_date: contract.end_date,
              status: contract.status,
              client_name: client?.client_name,
              company_name: client?.company_name,
              client_email: client?.email,
              client_phone: client?.phone,
              client_designation: client?.designation,
              client_address: client?.billing_address,
              project_name: projectName,
              customer_goals: null,
              duration: null,
              created_at: contract.created_at,
              contract_type: contract.contract_type,
              renewal_frequency: contract.renewal_frequency,
              start_date: contract.start_date,
              end_date: contract.end_date,
              client_signature: contract.client_signature,
              my_signature: ownerName,
            },
            branding: branding || null, template: template || null,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // PUT - Server-side password verification
    if (req.method === "PUT") {
      const { password } = await req.json();
      if (!token) {
        return new Response(JSON.stringify({ error: "Token is required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      if (!password) {
        return new Response(JSON.stringify({ error: "Password is required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      // Look up access token
      let accessToken: any = null;
      let documentType: "proposal" | "contract" = "proposal";
      const { data: pToken } = await supabase.from("proposal_access_tokens").select("*").eq("token", token).maybeSingle();
      if (pToken) { accessToken = pToken; documentType = "proposal"; }
      else {
        const { data: cToken } = await supabase.from("contract_access_tokens").select("*").eq("token", token).maybeSingle();
        if (cToken) { accessToken = cToken; documentType = "contract"; }
      }

      if (!accessToken) {
        return new Response(JSON.stringify({ error: "Invalid or expired link" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
      if (new Date(accessToken.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "This link has expired" }), { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      // Hash the password server-side and compare
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      if (computedHash !== accessToken.password_hash) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      // Password verified — return the full document data (same as GET with valid password)
      // Re-use GET logic by constructing internal URL with verified hash
      const internalUrl = new URL(req.url);
      internalUrl.searchParams.set("ph", computedHash);
      // Fetch document data directly
      if (documentType === "proposal") {
        const { data: proposal, error: proposalError } = await supabase
          .from("proposals")
          .select("id, title, scope_of_work, cost_breakdown, validity_date, status, client_id, project_id, user_id, created_at, customer_goals, duration")
          .eq("id", accessToken.proposal_id)
          .single();
        if (proposalError || !proposal) {
          return new Response(JSON.stringify({ error: "Proposal not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        const { data: client } = await supabase.from("clients").select("client_name, company_name, email, phone, designation, billing_address").eq("id", proposal.client_id).single();
        let projectName = null;
        if (proposal.project_id) {
          const { data: project } = await supabase.from("projects").select("project_name").eq("id", proposal.project_id).single();
          projectName = project?.project_name || null;
        }
        const { data: branding } = await supabase.from("branding_settings").select("*").eq("user_id", proposal.user_id).maybeSingle();
        const { data: template } = await supabase.from("templates").select("content").eq("user_id", proposal.user_id).eq("type", documentType === "proposal" ? "proposal" : "contract").maybeSingle();
        if (!accessToken.viewed_at) {
          await supabase.from("proposal_access_tokens").update({ viewed_at: new Date().toISOString() }).eq("id", accessToken.id);
        }
        return new Response(JSON.stringify({
          proposal: { ...proposal, client_name: client?.client_name, company_name: client?.company_name, client_email: client?.email, client_phone: client?.phone, client_designation: client?.designation, client_address: client?.billing_address, project_name: projectName },
          branding: branding || null, template: template || null, document_type: documentType,
        }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      } else {
        const contractTypeLabelsLocal: Record<string, string> = { amc: "Annual Maintenance Contract", fixed: "Fixed", retainer: "Retainer" };
        const { data: contract, error: contractError } = await supabase
          .from("contracts")
          .select("id, contract_type, scope_of_work, cost_breakdown, start_date, end_date, value, renewal_frequency, status, client_id, project_id, user_id, created_at, template_id, client_signature")
          .eq("id", accessToken.contract_id)
          .single();
        if (contractError || !contract) {
          return new Response(JSON.stringify({ error: "Contract not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        const { data: client } = await supabase.from("clients").select("client_name, company_name, email, phone, designation, billing_address").eq("id", contract.client_id).single();
        let projectName = null;
        if (contract.project_id) {
          const { data: project } = await supabase.from("projects").select("project_name").eq("id", contract.project_id).single();
          projectName = project?.project_name || null;
        }
        const { data: branding } = await supabase.from("branding_settings").select("*").eq("user_id", contract.user_id).maybeSingle();
        const templateType = "contract";
        let template = null;
        if (contract.template_id) {
          const { data: t } = await supabase.from("templates").select("content").eq("id", contract.template_id).maybeSingle();
          template = t;
        }
        if (!template) {
          const { data: t } = await supabase.from("templates").select("content").eq("user_id", contract.user_id).eq("type", templateType).maybeSingle();
          template = t;
        }
        if (!accessToken.viewed_at) {
          await supabase.from("contract_access_tokens").update({ viewed_at: new Date().toISOString() }).eq("id", accessToken.id);
        }
        // Get owner's name for mySignature
        const { data: ownerData2 } = await supabase.auth.admin.getUserById(contract.user_id);
        const ownerName2 = ownerData2?.user?.user_metadata?.full_name || '';
        return new Response(JSON.stringify({
          proposal: { ...contract, client_name: client?.client_name, company_name: client?.company_name, client_email: client?.email, client_phone: client?.phone, client_designation: client?.designation, client_address: client?.billing_address, project_name: projectName, title: contractTypeLabelsLocal[contract.contract_type] || contract.contract_type, my_signature: ownerName2 },
          branding: branding || null, template: template || null, document_type: documentType,
        }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // POST - Update proposal status (approve/reject)
    if (req.method === "POST") {
      const { token: bodyToken, action, notes, signature_name }: UpdateProposalRequest = await req.json();
      const accessTokenValue = bodyToken || token;

      if (!accessTokenValue) {
        return new Response(JSON.stringify({ error: "Token is required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      if (!action || !["approve", "reject", "request_changes"].includes(action)) {
        return new Response(JSON.stringify({ error: "Valid action (approve/reject/request_changes) is required" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      console.log(`Processing ${action} for token: ${accessTokenValue.substring(0, 8)}...`);

      // Try proposal tokens first, then contract tokens
      let tokenData: any = null;
      let documentType: "proposal" | "contract" = "proposal";

      const { data: pToken } = await supabase.from("proposal_access_tokens").select("*").eq("token", accessTokenValue).maybeSingle();
      if (pToken) {
        tokenData = pToken;
        documentType = "proposal";
      } else {
        const { data: cToken } = await supabase.from("contract_access_tokens").select("*").eq("token", accessTokenValue).maybeSingle();
        if (cToken) {
          tokenData = cToken;
          documentType = "contract";
        }
      }

      if (!tokenData) {
        return new Response(JSON.stringify({ error: "Invalid or expired link" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "This link has expired" }), { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      const newStatus = action === "approve" ? "approved" : action === "request_changes" ? "change_requested" : "rejected";
      const documentId = documentType === "proposal" ? tokenData.proposal_id : tokenData.contract_id;
      const tableName = documentType === "proposal" ? "proposals" : "contracts";

      // Get current status
      const { data: currentDoc } = await supabase.from(tableName).select("status, user_id, client_id, title").eq("id", documentId).single();
      const previousStatus = currentDoc?.status || "sent";

      // Update status (and signature for contracts)
      const updatePayload: any = { status: newStatus };
      if (documentType === "contract" && action === "approve" && signature_name) {
        updatePayload.client_signature = signature_name;
      }
      const { error: updateError } = await supabase.from(tableName).update(updatePayload).eq("id", documentId);
      if (updateError) throw updateError;

      // Log status change in history
      if (documentType === "proposal") {
        await supabase.from("proposal_status_history").insert({
          proposal_id: documentId,
          user_id: currentDoc?.user_id || "00000000-0000-0000-0000-000000000000",
          from_status: previousStatus, to_status: newStatus,
          note: action === "request_changes" && notes ? notes : action === "approve" ? "Approved via client portal" : "Rejected via client portal",
        });
      } else {
        await supabase.from("contract_status_history").insert({
          contract_id: documentId,
          user_id: currentDoc?.user_id || "00000000-0000-0000-0000-000000000000",
          from_status: previousStatus, to_status: newStatus,
          note: action === "request_changes" && notes ? notes : action === "approve" ? `Approved via client portal${signature_name ? ` — signed by ${signature_name}` : ''}` : "Rejected via client portal",
        });
      }

      // Get client name for notifications
      const { data: client } = await supabase.from("clients").select("client_name, company_name").eq("id", currentDoc?.client_id).single();

      if (currentDoc) {
        const clientName = client?.client_name || client?.company_name || "A client";
        const docTitle = (currentDoc as any).title || "Contract";
        const notificationTypeMap: Record<string, string> = { approve: "proposal_approved", reject: "proposal_rejected", request_changes: "proposal_revision_requested" };
        const emojiMap: Record<string, string> = { approve: "✅", reject: "❌", request_changes: "📝" };
        const titleMap: Record<string, string> = { approve: `${documentType === "contract" ? "Contract" : "Proposal"} Approved!`, reject: `${documentType === "contract" ? "Contract" : "Proposal"} Rejected`, request_changes: "Changes Requested" };

        const { data: prefs } = await supabase.from("notification_preferences").select("proposal_approved, proposal_rejected").eq("user_id", currentDoc.user_id).maybeSingle();
        const shouldNotify = action === "approve" ? prefs?.proposal_approved !== false : prefs?.proposal_rejected !== false;

        if (shouldNotify) {
          const changeNotesText = action === "request_changes" && notes ? `\n\nNotes: ${notes}` : "";
          await supabase.from("notifications").insert({
            user_id: currentDoc.user_id, type: notificationTypeMap[action], title: titleMap[action],
            message: `${emojiMap[action]} ${clientName} has ${action === "request_changes" ? "requested changes to" : action + "d"} your ${documentType} "${docTitle}"${changeNotesText}`,
            reference_id: documentId, reference_type: documentType,
          });

          // Send email notification
          try {
            const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
            const { data: ownerData } = await supabase.auth.admin.getUserById(currentDoc.user_id);
            const ownerEmail = ownerData?.user?.email;
            if (ownerEmail) {
              const subjectMap: Record<string, string> = { approve: `${documentType === "contract" ? "Contract" : "Proposal"} Approved!`, reject: `${documentType === "contract" ? "Contract" : "Proposal"} Declined`, request_changes: "Changes Requested" };
              const colorMap: Record<string, string> = { approve: "#22c55e", reject: "#ef4444", request_changes: "#f59e0b" };
              const safeClientName = escapeHtml(clientName);
              const safeDocTitle = escapeHtml(docTitle);
              const messageMap: Record<string, string> = {
                approve: `<strong>${safeClientName}</strong> has approved your ${documentType} <strong>"${safeDocTitle}"</strong>.`,
                reject: `<strong>${safeClientName}</strong> has declined your ${documentType} <strong>"${safeDocTitle}"</strong>.`,
                request_changes: `<strong>${safeClientName}</strong> has requested changes to your ${documentType} <strong>"${safeDocTitle}"</strong>.`,
              };
              const notesHtml = action === "request_changes" && notes ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;margin:20px 0;border-radius:0 8px 8px 0;"><h4 style="margin:0 0 8px;color:#92400e;font-size:13px;text-transform:uppercase;">Client's Notes</h4><p style="margin:0;color:#78350f;">${escapeHtml(notes).replace(/\n/g, "<br>")}</p></div>` : "";
              const ownerName = ownerData?.user?.user_metadata?.full_name || ownerEmail.split("@")[0];

              await resend.emails.send({
                from: "Notifications <noreply@notifications.redmonk.in>",
                to: [ownerEmail],
                subject: `${emojiMap[action]} ${subjectMap[action]} — ${docTitle}`,
                html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;"><div style="background:${colorMap[action]};padding:30px;border-radius:10px 10px 0 0;text-align:center;"><div style="font-size:48px;margin-bottom:8px;">${emojiMap[action]}</div><h1 style="color:white;margin:0;font-size:24px;">${subjectMap[action]}</h1></div><div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;"><p style="margin-top:0;">Hi ${ownerName},</p><p>${messageMap[action]}</p>${notesHtml}<p style="color:#6b7280;font-size:14px;margin-bottom:0;">Log in to your dashboard to take the next steps.</p></div></body></html>`,
              });
            }
          } catch (emailErr: any) {
            console.error("Failed to send email notification:", emailErr.message);
          }
        }
      }

      console.log(`${documentType} ${documentId} status updated to ${newStatus}`);

      return new Response(JSON.stringify({ success: true, status: newStatus }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in client-portal:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
