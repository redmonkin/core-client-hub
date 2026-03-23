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

interface NotificationEmailRequest {
  type:
    | "proposal_approved"
    | "proposal_rejected"
    | "proposal_change_requested"
    | "contract_created"
    | "contract_sent";
  recipientEmail: string;
  recipientName: string;
  data: Record<string, any>;
  ccEmails?: string[];
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
            <p style="margin-top: 0;">Hi ${recipientName},</p>
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

  return {
    subject: `📄 Contract: ${escapeHtml(contractTitle)}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contract: ${escapeHtml(contractTitle)}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #111827; padding: 28px 32px;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.3px;">📄 New Contract</h1>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">Hi ${escapeHtml(recipientName)},</p>
                      
                      <p style="margin: 0 0 24px; font-size: 15px; color: #374151;">A new contract has been prepared for you:</p>
                      
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

                      ${data.portalLink ? `
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                        <tr>
                          <td align="center">
                            <a href="${data.portalLink}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; letter-spacing: -0.2px;">View Full Contract →</a>
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

    const { type, recipientEmail, recipientName, data, ccEmails }: NotificationEmailRequest = await req.json();

    console.log(`Sending ${type} notification email to ${recipientEmail}`);

    if (!recipientEmail) {
      throw new Error("Recipient email is required");
    }

    let emailContent: { subject: string; html: string };

    if (type === "contract_created" || type === "contract_sent") {
      emailContent = buildContractEmail(recipientName, data);
    } else {
      emailContent = buildProposalStatusEmail(type, recipientName, data);
    }

    const emailPayload: any = {
      from: "Notifications <noreply@notifications.redmonk.in>",
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
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
