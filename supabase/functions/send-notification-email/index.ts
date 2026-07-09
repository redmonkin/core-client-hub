import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const isSafeHttpUrl = (url: unknown): url is string =>
  typeof url === "string" && /^https?:\/\//i.test(url);

interface NotificationEmailRequest {
  type:
    | "proposal_approved"
    | "proposal_rejected"
    | "proposal_change_requested"
    | "contract_created"
    | "contract_sent"
    | "team_invite"
    | "invoice_sent"
    | "invoice_overdue";
  recipientEmail: string;
  recipientName: string;
  data: Record<string, any>;
  ccEmails?: string[];
}

function buildInvoiceEmail(
  recipientName: string,
  data: Record<string, any>
): { subject: string; html: string } {
  const isOverdue = data.isOverdue === true;
  const headerLabel = isOverdue ? "⏰ Invoice Overdue" : "🧾 New Invoice";
  const subject = isOverdue
    ? `Overdue: Invoice ${data.invoiceNumber}`
    : `Invoice ${data.invoiceNumber}`;

  const formattedDueDate = data.dueDate
    ? new Date(data.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const fromName = data.senderCompany || data.senderName || "Your Team";

  return {
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background-color: ${isOverdue ? "#b45309" : "#111827"}; padding: 28px 32px;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">${headerLabel}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">Hi ${escapeHtml(recipientName || "")},</p>
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 20px 24px;">
                            <h2 style="margin: 0 0 16px; font-size: 17px; font-weight: 700; color: #111827;">Invoice ${escapeHtml(data.invoiceNumber || "")}</h2>
                            ${data.totalAmount ? `
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
                              <tr><td style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Amount Due</td></tr>
                              <tr><td style="font-size: 24px; font-weight: 700; color: #111827;">${escapeHtml(String(data.totalAmount))}</td></tr>
                            </table>` : ""}
                            ${formattedDueDate ? `
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr><td style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Due Date</td></tr>
                              <tr><td style="font-size: 14px; color: #374151;">${escapeHtml(formattedDueDate)}</td></tr>
                            </table>` : ""}
                          </td>
                        </tr>
                      </table>
                      ${isSafeHttpUrl(data.portalLink) ? `
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                        <tr><td align="center">
                          <a href="${escapeHtml(data.portalLink)}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">View Invoice →</a>
                        </td></tr>
                      </table>
                      ${data.portalPassword ? `
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr><td align="center" style="font-size: 13px; color: #6b7280;">
                          Access Password: <strong style="color: #111827; font-family: monospace; letter-spacing: 2px;">${escapeHtml(data.portalPassword)}</strong>
                        </td></tr>
                      </table>` : ""}
                      ` : ""}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 32px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
                      <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">Sent by ${escapeHtml(fromName)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildProposalStatusEmail(
  type: string,
  recipientName: string,
  data: Record<string, any>
): { subject: string; html: string } {
  const emojiMap: Record<string, string> = {
    proposal_approved: "✅",
    proposal_rejected: "❌",
    proposal_change_requested: "📝",
  };
  const titleMap: Record<string, string> = {
    proposal_approved: "Proposal Approved!",
    proposal_rejected: "Proposal Declined",
    proposal_change_requested: "Changes Requested",
  };
  const colorMap: Record<string, string> = {
    proposal_approved: "#22c55e",
    proposal_rejected: "#ef4444",
    proposal_change_requested: "#f59e0b",
  };
  const safeClientName = escapeHtml(data.clientName || "");
  const safeProposalTitle = escapeHtml(data.proposalTitle || "");
  const messageMap: Record<string, string> = {
    proposal_approved: `<strong>${safeClientName}</strong> has approved your proposal <strong>"${safeProposalTitle}"</strong>. You can proceed with the next steps.`,
    proposal_rejected: `<strong>${safeClientName}</strong> has declined your proposal <strong>"${safeProposalTitle}"</strong>.`,
    proposal_change_requested: `<strong>${safeClientName}</strong> has requested changes to your proposal <strong>"${safeProposalTitle}"</strong>.`,
  };

  const notesSection =
    type === "proposal_change_requested" && data.notes
      ? `
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h4 style="margin: 0 0 8px; color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Client's Notes</h4>
        <p style="margin: 0; color: #78350f;">${escapeHtml(data.notes).replace(/\n/g, "<br>")}</p>
      </div>`
      : "";

  return {
    subject: `${emojiMap[type]} ${titleMap[type]} — ${data.proposalTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${colorMap[type]}; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 8px;">${emojiMap[type]}</div>
            <h1 style="color: white; margin: 0; font-size: 24px;">${titleMap[type]}</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="margin-top: 0;">Hi ${escapeHtml(recipientName || "")},</p>
            <p>${messageMap[type]}</p>
            ${notesSection}
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">Log in to your dashboard to take the next steps.</p>
          </div>
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">Sent via your proposal management system.</p>
          </div>
        </body>
      </html>
    `,
  };
}

function buildContractEmail(
  recipientName: string,
  data: Record<string, any>
): { subject: string; html: string } {
  const typeLabels: Record<string, string> = {
    amc: "Annual Maintenance Contract",
    fixed: "Fixed",
    retainer: "Retainer",
  };
  const contractTypeLabel = typeLabels[data.contractType] || data.contractType;
  const contractTitle = data.contractTitle || `${contractTypeLabel} Contract`;
  const isReminder = !!data.isReminder;

  const formattedStartDate = data.startDate
    ? new Date(data.startDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const formattedEndDate = data.endDate
    ? new Date(data.endDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const totalAmount = data.totalAmount || (data.value ? formatCurrency(Number(data.value)) : null);

  const fromName = data.senderCompany || data.senderName || "Your Team";

  // Custom intro paragraphs (user-editable). Falls back to default greeting + line.
  const customIntro: string | null = typeof data.customIntro === "string" && data.customIntro.trim()
    ? data.customIntro.trim()
    : null;

  const introHtml = customIntro
    ? customIntro
        .split(/\n\s*\n/)
        .map((para) => `<p style="margin: 0 0 16px; font-size: 15px; color: #374151;">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
        .join("")
    : `
        <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin: 0 0 24px; font-size: 15px; color: #374151;">${isReminder ? "Just a friendly reminder about the contract we shared with you:" : "A new contract has been prepared for you:"}</p>
      `;

  const headerLabel = isReminder ? "📄 Contract Reminder" : "📄 New Contract";

  const customSubject: string | null = typeof data.customSubject === "string" && data.customSubject.trim()
    ? data.customSubject.trim()
    : null;
  const subject = customSubject
    || (isReminder
      ? `Reminder: ${contractTitle}`
      : `📄 Contract: ${contractTitle}`);

  return {
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(subject)}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background-color: ${isReminder ? "#b45309" : "#111827"}; padding: 28px 32px;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.3px;">${headerLabel}</h1>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding: 32px;">
                      ${introHtml}
                      
                      <!-- Contract Card -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 20px 24px;">
                            <h2 style="margin: 0 0 16px; font-size: 17px; font-weight: 700; color: #111827;">${escapeHtml(contractTitle)}</h2>
                            
                            ${totalAmount ? `
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
                              <tr>
                                <td style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Total Value</td>
                              </tr>
                              <tr>
                                <td style="font-size: 24px; font-weight: 700; color: #111827;">${escapeHtml(String(totalAmount))}</td>
                              </tr>
                            </table>
                            ` : ""}

                            ${formattedStartDate && formattedEndDate ? `
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
                              <tr>
                                <td style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Duration</td>
                              </tr>
                              <tr>
                                <td style="font-size: 14px; color: #374151;">${formattedStartDate} — ${formattedEndDate}</td>
                              </tr>
                            </table>
                            ` : ""}

                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Renewal</td>
                              </tr>
                              <tr>
                                <td style="font-size: 14px; color: #374151;">${escapeHtml(data.renewalFrequency || "")}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      ${isSafeHttpUrl(data.portalLink) ? `
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                        <tr>
                          <td align="center">
                            <a href="${escapeHtml(data.portalLink)}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; letter-spacing: -0.2px;">${isReminder ? "Review Contract →" : "View Full Contract →"}</a>
                          </td>
                        </tr>
                      </table>

                      ${data.portalPassword ? `
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                          <td align="center" style="font-size: 13px; color: #6b7280;">
                            Access Password: <strong style="color: #111827; font-family: monospace; letter-spacing: 2px; font-size: 14px;">${escapeHtml(data.portalPassword)}</strong>
                          </td>
                        </tr>
                      </table>
                      ` : ""}
                      ` : ""}

                      <p style="margin: 0; font-size: 14px; color: #6b7280;">${data.supportEmail ? `If you have any questions, reach out to us at <a href="mailto:${escapeHtml(data.supportEmail)}" style="color: #111827; text-decoration: underline;">${escapeHtml(data.supportEmail)}</a>.` : `If you have any questions, feel free to reach out.`}</p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 32px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
                      <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">Sent by ${escapeHtml(fromName)}</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildTeamInviteEmail(
  recipientName: string,
  data: Record<string, any>
): { subject: string; html: string } {
  const inviterName = escapeHtml(data.inviterName || data.senderCompany || "Your team");
  const appUrl = isSafeHttpUrl(data.appUrl) ? escapeHtml(data.appUrl) : "";

  return {
    subject: `🤝 You've been invited to join ${inviterName}'s workspace`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
          <div style="background: #0284C5; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 8px;">🤝</div>
            <h1 style="color: white; margin: 0; font-size: 24px;">Team Invitation</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="margin-top: 0;">Hi${recipientName ? ` ${escapeHtml(recipientName)}` : ""},</p>
            <p><strong>${inviterName}</strong> has invited you to join their workspace on Clientra.</p>
            <p>Once you sign up or log in with this email address, you'll automatically get access to their workspace data including clients, projects, proposals, and contracts.</p>
            ${appUrl ? `
            <div style="text-align: center; margin: 28px 0;">
              <a href="${appUrl}" style="display: inline-block; background-color: #0284C5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">Get Started →</a>
            </div>
            ` : ""}
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">If you weren't expecting this invitation, you can safely ignore this email.</p>
          </div>
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">Sent via Clientra</p>
          </div>
        </body>
      </html>
    `,
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { type, recipientEmail: bodyRecipientEmail, recipientName: bodyRecipientName, data, ccEmails }: NotificationEmailRequest = await req.json();

    // Resolve the true recipient server-side rather than trusting the request body, so a
    // caller can't use their own valid session to relay arbitrary branded email to an
    // address unrelated to the contract/proposal/invite they claim to be about.
    let recipientEmail = bodyRecipientEmail;
    let recipientName = bodyRecipientName;

    if (type === "contract_created" || type === "contract_sent") {
      const contractId = data?.contractId;
      if (!contractId) {
        return new Response(
          JSON.stringify({ success: false, error: "contractId is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data: contractRow, error: contractError } = await supabase
        .from("contracts")
        .select("client_id, user_id")
        .eq("id", contractId)
        .maybeSingle();
      if (contractError || !contractRow) {
        return new Response(
          JSON.stringify({ success: false, error: "Contract not found or access denied" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      // Viewers can read everything but must not be able to trigger sends.
      const { data: contractRole } = await supabase.rpc("get_workspace_role", {
        _user_id: user.id,
        _owner_id: (contractRow as any).user_id,
      });
      if (contractRole === "viewer") {
        return new Response(
          JSON.stringify({ success: false, error: "You don't have permission to send this contract" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data: clientRow, error: clientError } = await supabase
        .from("clients")
        .select("email, client_name, primary_contact_name")
        .eq("id", contractRow.client_id)
        .maybeSingle();
      if (clientError || !clientRow?.email) {
        return new Response(
          JSON.stringify({ success: false, error: "Client email not found" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      recipientEmail = clientRow.email;
      recipientName = clientRow.primary_contact_name || clientRow.client_name;
    } else if (type === "proposal_approved" || type === "proposal_rejected" || type === "proposal_change_requested") {
      const proposalId = data?.proposalId;
      if (!proposalId) {
        return new Response(
          JSON.stringify({ success: false, error: "proposalId is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data: proposalRow, error: proposalError } = await supabase
        .from("proposals")
        .select("id, user_id")
        .eq("id", proposalId)
        .maybeSingle();
      if (proposalError || !proposalRow) {
        return new Response(
          JSON.stringify({ success: false, error: "Proposal not found or access denied" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data: proposalRole } = await supabase.rpc("get_workspace_role", {
        _user_id: user.id,
        _owner_id: (proposalRow as any).user_id,
      });
      if (proposalRole === "viewer") {
        return new Response(
          JSON.stringify({ success: false, error: "You don't have permission to send this notification" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      // These types notify the proposal owner about a client's action — send to the
      // caller's own verified email rather than an attacker-supplied address.
      recipientEmail = user.email!;
    } else if (type === "team_invite") {
      const normalizedEmail = (bodyRecipientEmail || "").trim().toLowerCase();
      // Resolve the actual workspace owner_id (not just auth.uid()) so an admin —
      // not only the owner — can trigger this invite email; team_members rows are
      // always keyed by the workspace owner's id, never the inviting admin's own id.
      const { data: ownerId } = await supabase.rpc("get_owner_id", { _user_id: user.id });
      const { data: inviteRow, error: inviteError } = await supabase
        .from("team_members")
        .select("id")
        .eq("owner_id", (ownerId as string) || user.id)
        .eq("invited_email", normalizedEmail)
        .eq("status", "pending")
        .maybeSingle();
      if (inviteError || !inviteRow) {
        return new Response(
          JSON.stringify({ success: false, error: "No pending invitation found for this recipient" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      recipientEmail = normalizedEmail;
    } else if (type === "invoice_sent" || type === "invoice_overdue") {
      const invoiceId = data?.invoiceId;
      if (!invoiceId) {
        return new Response(
          JSON.stringify({ success: false, error: "invoiceId is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data: invoiceRow, error: invoiceError } = await supabase
        .from("invoices")
        .select("client_id, user_id")
        .eq("id", invoiceId)
        .maybeSingle();
      if (invoiceError || !invoiceRow) {
        return new Response(
          JSON.stringify({ success: false, error: "Invoice not found or access denied" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data: invoiceRole } = await supabase.rpc("get_workspace_role", {
        _user_id: user.id,
        _owner_id: (invoiceRow as any).user_id,
      });
      if (invoiceRole === "viewer") {
        return new Response(
          JSON.stringify({ success: false, error: "You don't have permission to send this invoice" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data: clientRow, error: clientError } = await supabase
        .from("clients")
        .select("email, client_name, primary_contact_name")
        .eq("id", invoiceRow.client_id)
        .maybeSingle();
      if (clientError || !clientRow?.email) {
        return new Response(
          JSON.stringify({ success: false, error: "Client email not found" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      recipientEmail = clientRow.email;
      recipientName = clientRow.primary_contact_name || clientRow.client_name;
    }

    console.log(`Sending ${type} notification email to ${recipientEmail}`);

    if (!recipientEmail) {
      throw new Error("Recipient email is required");
    }

    let emailContent: { subject: string; html: string };

    if (type === "contract_created" || type === "contract_sent") {
      emailContent = buildContractEmail(recipientName, data);
    } else if (type === "team_invite") {
      emailContent = buildTeamInviteEmail(recipientName, data);
    } else if (type === "invoice_sent" || type === "invoice_overdue") {
      emailContent = buildInvoiceEmail(recipientName, { ...data, isOverdue: type === "invoice_overdue" });
    } else {
      emailContent = buildProposalStatusEmail(type, recipientName, data);
    }

    const emailPayload: any = {
      from: `${data.senderCompany || "Notifications"} <noreply@notifications.redmonk.in>`,
      to: [recipientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    };

    if (ccEmails && ccEmails.length > 0) {
      emailPayload.cc = ccEmails;
    }

    const emailResponse = await resend.emails.send(emailPayload);

    console.log("Notification email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending notification email:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred while sending the notification" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
