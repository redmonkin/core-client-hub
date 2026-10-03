// Daily cron job: emails one payment reminder per invoice, 3 days before its
// due date, to clients with an unpaid (sent / partially paid) invoice.
//
// invoices.due_reminder_sent_for records the due date a reminder went out
// for, so each invoice gets exactly one reminder, and changing the due date
// re-arms it.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { emailFrom } from "../_shared/email.ts";
import { renderInvoicePdfBase64 } from "../_shared/invoice-pdf.ts";
import { getOrCreateInvoicePortalLink, isSafeHttpUrl } from "../_shared/invoice-portal.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REMINDER_DAYS_BEFORE_DUE = 3;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const isoDate = (d: Date) => d.toISOString().split("T")[0];

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

const formatInr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const formatLongDate = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function buildReminderEmail(data: {
  recipientName: string;
  fromName: string;
  invoiceNumber: string;
  balanceDue: string;
  dueDate: string;
  portalLink?: string | null;
  portalPassword?: string | null;
}): { subject: string; html: string } {
  const subject = `Payment Reminder: Invoice ${data.invoiceNumber} is due on ${data.dueDate}`;
  return {
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="background-color: #b45309; padding: 32px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 22px; font-weight: 700;">Payment Reminder</h1>
                      <p style="color: #fef3c7; margin: 0; font-size: 14px;">from ${escapeHtml(data.fromName)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">Hi ${escapeHtml(data.recipientName)},</p>
                      <p style="margin: 0 0 24px; font-size: 15px; color: #374151;">This is a friendly reminder that invoice <strong>${escapeHtml(data.invoiceNumber)}</strong> is due on <strong>${escapeHtml(data.dueDate)}</strong>. Please arrange payment by then.</p>

                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 20px 24px;">
                            <div style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Amount Due</div>
                            <div style="font-size: 26px; font-weight: 700; color: #111827; margin-bottom: 16px;">${escapeHtml(data.balanceDue)}</div>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="width: 50%; vertical-align: top;">
                                  <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Invoice No.</div>
                                  <div style="font-size: 14px; color: #111827; font-weight: 600;">${escapeHtml(data.invoiceNumber)}</div>
                                </td>
                                <td style="width: 50%; vertical-align: top;">
                                  <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Due Date</div>
                                  <div style="font-size: 14px; color: #111827;">${escapeHtml(data.dueDate)}</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      ${isSafeHttpUrl(data.portalLink) ? `
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                        <tr><td align="center">
                          <a href="${escapeHtml(data.portalLink)}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 40px; border-radius: 8px;">VIEW INVOICE</a>
                        </td></tr>
                      </table>
                      ${data.portalPassword ? `
                      <p style="margin: 0 0 24px; font-size: 13px; color: #6b7280; text-align: center;">
                        Access Password: <strong style="color: #111827; font-family: monospace; letter-spacing: 2px;">${escapeHtml(data.portalPassword)}</strong>
                      </p>` : `
                      <p style="margin: 0 0 24px; font-size: 13px; color: #6b7280; text-align: center;">Use the access password from your original invoice email.</p>`}
                      ` : ""}

                      <p style="margin: 0; font-size: 14px; color: #6b7280;">If you've already made this payment, please ignore this reminder.</p>
                      <p style="margin: 16px 0 0; font-size: 14px; color: #374151;">Regards,<br>${escapeHtml(data.fromName)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 32px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
                      <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">Sent by ${escapeHtml(data.fromName)}</p>
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

  // Only the cron job (service role) may run this.
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const appUrl = Deno.env.get("APP_URL") || "";

    const today = isoDate(new Date());
    // Due within the next 3 days rather than exactly in 3, so a missed cron
    // run is picked up the next day instead of skipping the reminder.
    const windowEnd = addDays(today, REMINDER_DAYS_BEFORE_DUE);

    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, user_id, client_id, invoice_number, issued_date, due_date, payment_terms, notes, cost_breakdown, due_reminder_sent_for")
      .in("status", ["sent", "partial"])
      .gt("due_date", today)
      .lte("due_date", windowEnd);
    if (error) throw error;

    const sent: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const invoice of invoices || []) {
      const label = invoice.invoice_number;
      // Already reminded for this due date.
      if (invoice.due_reminder_sent_for === invoice.due_date) continue;
      // Invoices issued less than 3 days before they're due get no reminder
      // (the client only just received them).
      if (invoice.issued_date > addDays(invoice.due_date, -REMINDER_DAYS_BEFORE_DUE)) continue;

      try {
        const { data: amounts } = await supabase
          .from("invoice_amounts")
          .select("total_amount, amount_paid")
          .eq("invoice_id", invoice.id)
          .maybeSingle();
        const balance = amounts ? Number(amounts.total_amount) - Number(amounts.amount_paid) : 0;
        if (balance <= 0) {
          skipped.push(`${label}: nothing outstanding`);
          continue;
        }

        const { data: client } = await supabase
          .from("clients")
          .select("email, client_name, primary_contact_name, company_name, billing_address")
          .eq("id", invoice.client_id)
          .maybeSingle();
        if (!client?.email) {
          skipped.push(`${label}: client has no email`);
          continue;
        }

        // Claim the invoice before emailing, so overlapping runs can't both
        // send a reminder for it.
        const { data: claimed, error: claimError } = await supabase
          .from("invoices")
          .update({ due_reminder_sent_for: invoice.due_date })
          .eq("id", invoice.id)
          .or(`due_reminder_sent_for.is.null,due_reminder_sent_for.neq.${invoice.due_date}`)
          .select("id");
        if (claimError) throw claimError;
        if (!claimed || claimed.length === 0) continue;

        try {
          const [{ data: ownerUser }, { data: branding }, { data: settings }] = await Promise.all([
            supabase.auth.admin.getUserById(invoice.user_id),
            supabase.from("branding_settings")
              .select("company_name, company_logo_url, company_address, support_email")
              .eq("user_id", invoice.user_id).maybeSingle(),
            supabase.from("invoice_settings")
              .select("bank_account_name, account_number, swift_code, ifsc_code, pan, upi_id, payment_instructions, terms_and_conditions")
              .eq("user_id", invoice.user_id).maybeSingle(),
          ]);

          const fromName = branding?.company_name || ownerUser?.user?.user_metadata?.full_name || "Clientra";
          const portal = await getOrCreateInvoicePortalLink(supabase, invoice.id, appUrl);
          const email = buildReminderEmail({
            recipientName: client.primary_contact_name || client.client_name || "",
            fromName,
            invoiceNumber: invoice.invoice_number,
            balanceDue: formatInr(balance),
            dueDate: formatLongDate(invoice.due_date),
            portalLink: portal?.link,
            portalPassword: portal?.password,
          });

          const payload: Record<string, unknown> = {
            from: emailFrom(fromName),
            to: [client.email],
            subject: email.subject,
            html: email.html,
          };
          if (ownerUser?.user?.email) payload.cc = [ownerUser.user.email];

          // Attach the invoice PDF (best-effort, like the other invoice emails).
          try {
            const pdf = await renderInvoicePdfBase64({
              invoiceNumber: invoice.invoice_number,
              issuedDate: invoice.issued_date,
              dueDate: invoice.due_date,
              paymentTerms: invoice.payment_terms,
              notes: invoice.notes,
              costBreakdown: invoice.cost_breakdown,
              amountPaid: amounts ? Number(amounts.amount_paid) : 0,
              branding,
              client,
              settings,
            });
            payload.attachments = [{ filename: `${invoice.invoice_number}.pdf`, content: pdf }];
          } catch (pdfError) {
            console.error(`Failed to render PDF for ${label}, sending without it:`, pdfError);
          }

          const { error: sendError } = await resend.emails.send(payload as any);
          if (sendError) throw new Error(sendError.message);
          sent.push(label);
        } catch (sendFailure) {
          // Release the claim so tomorrow's run retries this invoice.
          await supabase.from("invoices")
            .update({ due_reminder_sent_for: invoice.due_reminder_sent_for })
            .eq("id", invoice.id);
          throw sendFailure;
        }
      } catch (invoiceError: any) {
        console.error(`Reminder failed for invoice ${label}:`, invoiceError);
        errors.push(`${label}: ${invoiceError.message}`);
      }
    }

    console.log(`Invoice due reminders: sent ${sent.length}, skipped ${skipped.length}, errors ${errors.length}`);
    return new Response(
      JSON.stringify({ success: true, sent, skipped, errors: errors.length ? errors : undefined }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Invoice due reminders failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to send invoice reminders" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
