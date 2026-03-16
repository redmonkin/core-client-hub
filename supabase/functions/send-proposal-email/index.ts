import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendProposalRequest {
  proposalId: string;
  clientEmail: string;
  clientName: string;
  proposalTitle: string;
  customerGoals: string | null;
  totalAmount: string | null;
  validityDate: string | null;
  portalLink: string | null;
  portalPassword: string | null;
  senderName: string | null;
  senderCompany: string | null;
  supportEmail: string | null;
  ccEmails?: string[];
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const calculateTotal = (costBreakdownJson: string | null): string => {
  if (!costBreakdownJson) return "";
  try {
    const data = JSON.parse(costBreakdownJson);
    if (!data.items || !Array.isArray(data.items)) return "";
    const subtotal = data.items.reduce((acc: number, item: any) => {
      const lineTotal = item.quantity * item.unitPrice;
      return acc + lineTotal - lineTotal * (item.discount / 100);
    }, 0);
    const additionalDiscountAmount =
      subtotal * ((data.additionalDiscount || 0) / 100);
    const afterDiscount = subtotal - additionalDiscountAmount;
    const taxAmount = afterDiscount * ((data.taxRate || 0) / 100);
    return formatCurrency(afterDiscount + taxAmount);
  } catch {
    return "";
  }
};

// Strip HTML tags to plain text for goals summary
const stripHtml = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// Truncate text to a max length
const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, "") + "…";
};

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const {
      clientEmail,
      clientName,
      proposalTitle,
      customerGoals,
      totalAmount,
      validityDate,
      portalLink,
      portalPassword,
      senderName,
      senderCompany,
      supportEmail,
      ccEmails,
    }: SendProposalRequest = await req.json();

    console.log(
      `Sending proposal email to ${clientEmail} for proposal: ${proposalTitle}`
    );

    if (!clientEmail) {
      throw new Error("Client email is required");
    }

    const formattedValidity = validityDate
      ? new Date(validityDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    // Prepare goals summary (plain text, truncated)
    const goalsSummary = customerGoals
      ? truncate(stripHtml(customerGoals), 300)
      : null;

    const fromName = senderCompany || senderName || "Redmonk Studios";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Proposal: ${proposalTitle}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #111827; padding: 28px 32px;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.3px;">📄 New Proposal</h1>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">Hi ${clientName},</p>
                      
                      <p style="margin: 0 0 24px; font-size: 15px; color: #374151;">A new proposal has been prepared for you:</p>
                      
                      <!-- Proposal Card -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 20px 24px;">
                            <h2 style="margin: 0 0 16px; font-size: 17px; font-weight: 700; color: #111827;">${proposalTitle}</h2>
                            
                            ${
                              totalAmount
                                ? `
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${goalsSummary || formattedValidity ? "14px" : "0"};">
                              <tr>
                                <td style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Total Investment</td>
                              </tr>
                              <tr>
                                <td style="font-size: 24px; font-weight: 700; color: #111827;">${totalAmount}</td>
                              </tr>
                            </table>
                            `
                                : ""
                            }

                            ${
                              goalsSummary
                                ? `
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${formattedValidity ? "14px" : "0"};">
                              <tr>
                                <td style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Objectives</td>
                              </tr>
                              <tr>
                                <td style="font-size: 14px; color: #374151; line-height: 1.5;">${goalsSummary.replace(/\n/g, "<br>")}</td>
                              </tr>
                            </table>
                            `
                                : ""
                            }

                            ${
                              formattedValidity
                                ? `
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Valid Until</td>
                              </tr>
                              <tr>
                                <td style="font-size: 14px; color: #374151;">${formattedValidity}</td>
                              </tr>
                            </table>
                            `
                                : ""
                            }
                          </td>
                        </tr>
                      </table>

                      ${
                        portalLink
                          ? `
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                        <tr>
                          <td align="center">
                            <a href="${portalLink}" style="display: inline-block; background-color: #111827; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; letter-spacing: -0.2px;">View Full Proposal →</a>
                          </td>
                        </tr>
                      </table>

                      ${
                        portalPassword
                          ? `
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr>
                          <td align="center" style="font-size: 13px; color: #6b7280;">
                            Access Password: <strong style="color: #111827; font-family: monospace; letter-spacing: 2px; font-size: 14px;">${portalPassword}</strong>
                          </td>
                        </tr>
                      </table>
                      `
                          : ""
                      }
                      `
                          : ""
                      }

                      <p style="margin: 0; font-size: 14px; color: #6b7280;">If you have any questions, simply reply to this email.</p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 32px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
                      <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">Sent by ${fromName}</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const emailPayload: any = {
      from: `${fromName} <noreply@notifications.redmonk.in>`,
      to: [clientEmail],
      subject: `Proposal: ${proposalTitle}`,
      html: emailHtml,
    };

    // Add CC recipients if provided
    if (ccEmails && ccEmails.length > 0) {
      emailPayload.cc = ccEmails;
    }

    const emailResponse = await resend.emails.send(emailPayload);

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending proposal email:", error);
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
