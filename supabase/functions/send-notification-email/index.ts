import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  type:
    | "proposal_approved"
    | "proposal_rejected"
    | "proposal_change_requested"
    | "contract_created";
  recipientEmail: string;
  recipientName: string;
  data: Record<string, any>;
  ccEmails?: string[];
}
  recipientEmail: string;
  recipientName: string;
  data: Record<string, any>;
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
  const messageMap: Record<string, string> = {
    proposal_approved: `<strong>${data.clientName}</strong> has approved your proposal <strong>"${data.proposalTitle}"</strong>. You can proceed with the next steps.`,
    proposal_rejected: `<strong>${data.clientName}</strong> has declined your proposal <strong>"${data.proposalTitle}"</strong>.`,
    proposal_change_requested: `<strong>${data.clientName}</strong> has requested changes to your proposal <strong>"${data.proposalTitle}"</strong>.`,
  };

  const notesSection =
    type === "proposal_change_requested" && data.notes
      ? `
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h4 style="margin: 0 0 8px; color: #92400e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Client's Notes</h4>
        <p style="margin: 0; color: #78350f;">${data.notes.replace(/\n/g, "<br>")}</p>
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

function buildContractCreatedEmail(
  recipientName: string,
  data: Record<string, any>
): { subject: string; html: string } {
  const typeLabels: Record<string, string> = {
    amc: "Annual Maintenance Contract",
    fixed: "Fixed",
    retainer: "Retainer",
  };
  const contractTypeLabel = typeLabels[data.contractType] || data.contractType;

  const formattedStartDate = new Date(data.startDate).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );
  const formattedEndDate = new Date(data.endDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    subject: `📄 New Contract Created — ${contractTypeLabel}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📄 New Contract</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin-top: 0;">Dear ${recipientName},</p>
            <p>A new contract has been created for you. Here are the details:</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Contract Type</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${contractTypeLabel}</td>
                </tr>
                <tr style="border-top: 1px solid #f3f4f6;">
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Start Date</td>
                  <td style="padding: 8px 0; text-align: right;">${formattedStartDate}</td>
                </tr>
                <tr style="border-top: 1px solid #f3f4f6;">
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">End Date</td>
                  <td style="padding: 8px 0; text-align: right;">${formattedEndDate}</td>
                </tr>
                ${
                  data.value
                    ? `<tr style="border-top: 1px solid #f3f4f6;">
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Value</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #667eea;">$${Number(data.value).toLocaleString()}</td>
                  </tr>`
                    : ""
                }
                <tr style="border-top: 1px solid #f3f4f6;">
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Renewal</td>
                  <td style="padding: 8px 0; text-align: right;">${data.renewalFrequency}</td>
                </tr>
              </table>
            </div>
            ${
              data.scopeOfWork
                ? `<div style="margin: 20px 0;">
                <h3 style="color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Scope of Work</h3>
                <p style="color: #6b7280; font-size: 14px;">${data.scopeOfWork.replace(/\n/g, "<br>")}</p>
              </div>`
                : ""
            }
            <p>If you have any questions, please don't hesitate to reach out.</p>
            <p style="margin-bottom: 0;">Best regards,<br>${data.senderName || "Your Team"}</p>
          </div>
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">This email was sent via our contract management system.</p>
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
    const { type, recipientEmail, recipientName, data, ccEmails }: NotificationEmailRequest = await req.json();

    console.log(`Sending ${type} notification email to ${recipientEmail}`);

    if (!recipientEmail) {
      throw new Error("Recipient email is required");
    }

    let emailContent: { subject: string; html: string };

    if (type === "contract_created") {
      emailContent = buildContractCreatedEmail(recipientName, data);
    } else {
      emailContent = buildProposalStatusEmail(type, recipientName, data);
    }

    const emailResponse = await resend.emails.send({
      from: "Notifications <noreply@notifications.redmonk.in>",
      to: [recipientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    });

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
