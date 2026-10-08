import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createInvoicePortalToken } from "../_shared/invoice-portal.ts";
import { emailFrom } from "../_shared/email.ts";
import { senderBrand } from "../_shared/email-template.ts";
import { invoiceEmail } from "../_shared/emails.ts";
import { getInvoiceTotals, parseInvoiceLineItems, renderInvoicePdfBase64 } from "../_shared/invoice-pdf.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};


// -- Payment terms -> fixed day offset, mirrored from src/pages/Invoices.tsx --
const PAYMENT_TERM_DAYS: Record<string, number> = { net15: 15, net30: 30, net45: 45, net60: 60 };

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// -- Next-run-date advancement, clamping to the shorter month's last day --
function advanceRunDate(current: string, frequency: string, dayOfMonth: number): string {
  const d = new Date(current + "T00:00:00Z");
  const monthsToAdd = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1;
  const targetMonthIndex = d.getUTCFullYear() * 12 + d.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, day)).toISOString().split("T")[0];
}

// -- Invoice email, mirrored from send-notification-email's buildInvoiceEmail
// (kept in sync by hand -- each edge function in this repo is self-contained
// with no shared module between them). --

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    console.log("Starting recurring invoice generation...");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const appUrl = Deno.env.get("APP_URL") || "";

    const today = new Date().toISOString().split("T")[0];

    const { data: schedules, error: schedulesError } = await supabase
      .from("recurring_invoices")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (schedulesError) throw schedulesError;

    console.log(`Found ${schedules?.length || 0} recurring invoice schedule(s) due`);

    const generated: string[] = [];
    const emailed: string[] = [];
    const errors: string[] = [];

    for (const schedule of schedules || []) {
      try {
        const invoiceNumberResult = await supabase.rpc("generate_invoice_number_for_owner", {
          _owner_id: schedule.user_id,
        });
        if (invoiceNumberResult.error) throw invoiceNumberResult.error;
        const invoiceNumber = invoiceNumberResult.data as string;

        const dueDate = schedule.payment_terms && PAYMENT_TERM_DAYS[schedule.payment_terms]
          ? addDays(new Date(), PAYMENT_TERM_DAYS[schedule.payment_terms])
          : null;

        const { data: invoiceRow, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            user_id: schedule.user_id,
            client_id: schedule.client_id,
            project_id: schedule.project_id,
            invoice_number: invoiceNumber,
            issued_date: today,
            payment_terms: schedule.payment_terms,
            due_date: dueDate,
            notes: schedule.notes,
            cost_breakdown: schedule.cost_breakdown,
          })
          .select("id")
          .single();
        if (invoiceError) throw invoiceError;

        const totalAmount = getInvoiceTotals(parseInvoiceLineItems(schedule.cost_breakdown)).total;
        const { error: amountError } = await supabase
          .from("invoice_amounts")
          .insert({ invoice_id: invoiceRow.id, total_amount: totalAmount });
        if (amountError) throw amountError;

        generated.push(invoiceRow.id);

        const nextRunDate = advanceRunDate(schedule.next_run_date, schedule.frequency, schedule.day_of_month);
        const shouldDeactivate = !!schedule.end_date && nextRunDate > schedule.end_date;
        const { error: updateError } = await supabase
          .from("recurring_invoices")
          .update({
            next_run_date: nextRunDate,
            last_generated_invoice_id: invoiceRow.id,
            is_active: shouldDeactivate ? false : schedule.is_active,
          })
          .eq("id", schedule.id);
        if (updateError) throw updateError;

        if (schedule.auto_send) {
          const { data: clientRow, error: clientError } = await supabase
            .from("clients")
            .select("email, client_name, primary_contact_name, company_name, billing_address")
            .eq("id", schedule.client_id)
            .maybeSingle();
          if (clientError) throw clientError;

          if (!clientRow?.email) {
            errors.push(`Invoice ${invoiceNumber}: client has no email on file, skipped sending`);
            continue;
          }

          const { data: ownerUser } = await supabase.auth.admin.getUserById(schedule.user_id);
          const { data: brandingRow } = await supabase
            .from("branding_settings")
            .select("company_name, company_logo_url, company_address, support_email, primary_color")
            .eq("user_id", schedule.user_id)
            .maybeSingle();
          const { data: invoiceSettings } = await supabase
            .from("invoice_settings")
            .select("bank_account_name, account_number, swift_code, ifsc_code, pan, upi_id, payment_instructions, terms_and_conditions")
            .eq("user_id", schedule.user_id)
            .maybeSingle();

          const portal = await createInvoicePortalToken(supabase, invoiceRow.id, appUrl);
          if (!portal) {
            console.log(`APP_URL not configured -- sending invoice ${invoiceNumber} without a portal link`);
          }

          const fromName = brandingRow?.company_name || ownerUser?.user?.user_metadata?.full_name || "Your team";
          const emailContent = invoiceEmail({
            brand: senderBrand(brandingRow, fromName),
            fromName,
            recipientName: clientRow.primary_contact_name || clientRow.client_name,
            invoiceNumber,
            totalAmount: totalAmount
              ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalAmount)
              : null,
            issuedDate: today,
            dueDate,
            portalLink: portal?.link,
            portalPassword: portal?.password,
          });

          const emailPayload: Record<string, unknown> = {
            from: emailFrom(fromName),
            to: [clientRow.email],
            subject: emailContent.subject,
            html: emailContent.html,
          };
          if (ownerUser?.user?.email) {
            emailPayload.cc = [ownerUser.user.email];
          }

          // Attach the invoice PDF, like a manually sent invoice. Best-effort:
          // a rendering failure shouldn't stop the invoice (and its portal
          // link) from reaching the client.
          try {
            const pdfBase64 = await renderInvoicePdfBase64({
              invoiceNumber,
              issuedDate: today,
              dueDate,
              paymentTerms: schedule.payment_terms,
              notes: schedule.notes,
              costBreakdown: schedule.cost_breakdown,
              branding: brandingRow,
              client: clientRow,
              settings: invoiceSettings,
            });
            emailPayload.attachments = [{ filename: `${invoiceNumber}.pdf`, content: pdfBase64 }];
          } catch (pdfError) {
            console.error(`Failed to render PDF for invoice ${invoiceNumber}, sending without it:`, pdfError);
          }

          await resend.emails.send(emailPayload as any);

          await supabase.from("invoices").update({ status: "sent" }).eq("id", invoiceRow.id);
          emailed.push(invoiceNumber);
        }
      } catch (scheduleError: any) {
        console.error(`Error processing recurring invoice schedule ${schedule.id}:`, scheduleError);
        errors.push(`Schedule ${schedule.id}: ${scheduleError.message}`);
      }
    }

    console.log(`Recurring invoice generation complete. Generated: ${generated.length}, Emailed: ${emailed.length}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        generated: generated.length,
        emailed: emailed.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in recurring invoice generation:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
