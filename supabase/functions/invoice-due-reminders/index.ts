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
import { senderBrand } from "../_shared/email-template.ts";
import { invoiceDueReminderEmail } from "../_shared/emails.ts";
import { renderInvoicePdfBase64 } from "../_shared/invoice-pdf.ts";
import { getOrCreateInvoicePortalLink } from "../_shared/invoice-portal.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REMINDER_DAYS_BEFORE_DUE = 3;

const isoDate = (d: Date) => d.toISOString().split("T")[0];

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

const formatInr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

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
              .select("company_name, company_logo_url, company_address, support_email, primary_color")
              .eq("user_id", invoice.user_id).maybeSingle(),
            supabase.from("invoice_settings")
              .select("bank_account_name, account_number, swift_code, ifsc_code, pan, upi_id, payment_instructions, terms_and_conditions")
              .eq("user_id", invoice.user_id).maybeSingle(),
          ]);

          const fromName = branding?.company_name || ownerUser?.user?.user_metadata?.full_name || "Clientra";
          const portal = await getOrCreateInvoicePortalLink(supabase, invoice.id, appUrl);
          const email = invoiceDueReminderEmail({
            brand: senderBrand(branding, fromName),
            recipientName: client.primary_contact_name || client.client_name || "",
            fromName,
            invoiceNumber: invoice.invoice_number,
            balanceDue: formatInr(balance),
            dueDate: invoice.due_date,
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
