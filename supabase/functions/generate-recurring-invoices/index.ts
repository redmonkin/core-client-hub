import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generatePortalPassword, hashPortalPassword } from "../_shared/portal-password.ts";
import { emailFrom } from "../_shared/email.ts";

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

// -- Line-item total calculation, mirrored from src/lib/invoice-utils.ts --
// (pure arithmetic, no DOM/React deps, so duplicating rather than sharing a
// module across the Vite client bundle and this Deno function is simplest).
type DiscountType = 'percent' | 'flat';
interface InvoiceLineItem {
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType?: DiscountType;
}
interface InvoiceLineItemsData {
  items: InvoiceLineItem[];
  additionalDiscount: number;
  additionalDiscountType?: DiscountType;
  taxRate: number;
}
function parseLineItems(value: string | null | undefined): InvoiceLineItemsData {
  if (!value) return { items: [], additionalDiscount: 0, taxRate: 0 };
  try {
    const parsed = JSON.parse(value);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      additionalDiscount: parsed.additionalDiscount ?? 0,
      additionalDiscountType: parsed.additionalDiscountType === 'flat' ? 'flat' : 'percent',
      taxRate: parsed.taxRate ?? 0,
    };
  } catch {
    return { items: [], additionalDiscount: 0, taxRate: 0 };
  }
}
function getTotalFromCostBreakdown(costBreakdown: string | null): number {
  const data = parseLineItems(costBreakdown);
  const subtotal = data.items.reduce((acc, item) => {
    const lineSubtotal = item.quantity * item.unitPrice;
    const discountAmount = item.discountType === 'flat' ? Math.min(item.discount, lineSubtotal) : lineSubtotal * (item.discount / 100);
    return acc + (lineSubtotal - discountAmount);
  }, 0);
  const additionalDiscountAmount = data.additionalDiscountType === 'flat' ? Math.min(data.additionalDiscount, subtotal) : subtotal * (data.additionalDiscount / 100);
  const afterDiscount = subtotal - additionalDiscountAmount;
  return afterDiscount + afterDiscount * (data.taxRate / 100);
}

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

// -- Portal token creation, ported from src/lib/invoice-portal-access.ts --
// (Deno has the same Web Crypto globals the browser does, so this is a
// direct port, not a reimplementation.)
async function createInvoicePortalToken(
  supabase: ReturnType<typeof createClient>,
  invoiceId: string,
  appUrl: string,
): Promise<{ link: string; password: string } | null> {
  if (!isSafeHttpUrl(appUrl)) return null;

  const tokenArray = new Uint8Array(32);
  crypto.getRandomValues(tokenArray);
  const token = Array.from(tokenArray, (b) => b.toString(16).padStart(2, "0")).join("");

  const password = generatePortalPassword();
  const passwordHash = await hashPortalPassword(password);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error } = await supabase.from("invoice_access_tokens").insert({
    invoice_id: invoiceId,
    token,
    expires_at: expiresAt.toISOString(),
    password_hash: passwordHash,
  });
  if (error) throw error;

  return { link: `${appUrl}/portal?token=${token}`, password };
}

// -- Invoice email, mirrored from send-notification-email's buildInvoiceEmail
// (kept in sync by hand -- each edge function in this repo is self-contained
// with no shared module between them). --
function buildInvoiceEmail(recipientName: string, data: Record<string, any>): { subject: string; html: string } {
  const fromName = data.senderCompany || data.senderName || "Your Team";
  const subject = `Invoice ${data.invoiceNumber} from ${fromName}`;
  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null;
  const formattedIssuedDate = formatDate(data.issuedDate);
  const formattedDueDate = formatDate(data.dueDate);

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
                    <td style="background-color: #0284C5; padding: 32px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 22px; font-weight: 700;">New Invoice</h1>
                      <p style="color: #e0f2fe; margin: 0; font-size: 14px;">from ${escapeHtml(fromName)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px;">
                      <p style="margin: 0 0 16px; font-size: 15px; color: #374151;">Hi ${escapeHtml(recipientName || "")},</p>
                      <p style="margin: 0 0 24px; font-size: 15px; color: #374151;">The following invoice has been raised for the services rendered. This is a recurring invoice generated automatically for your ongoing engagement.</p>

                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                        <tr>
                          <td style="padding: 20px 24px;">
                            ${data.totalAmount ? `
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                              <tr><td style="font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Amount Due</td></tr>
                              <tr><td style="font-size: 26px; font-weight: 700; color: #111827;">${escapeHtml(String(data.totalAmount))}</td></tr>
                            </table>` : ""}
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="width: 33%; vertical-align: top;">
                                  <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Invoice No.</div>
                                  <div style="font-size: 14px; color: #111827; font-weight: 600;">${escapeHtml(data.invoiceNumber || "")}</div>
                                </td>
                                ${formattedIssuedDate ? `
                                <td style="width: 33%; vertical-align: top;">
                                  <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Invoice Date</div>
                                  <div style="font-size: 14px; color: #111827;">${escapeHtml(formattedIssuedDate)}</div>
                                </td>` : ""}
                                ${formattedDueDate ? `
                                <td style="width: 33%; vertical-align: top;">
                                  <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; padding-bottom: 4px;">Due Date</div>
                                  <div style="font-size: 14px; color: #111827;">${escapeHtml(formattedDueDate)}</div>
                                </td>` : ""}
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
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                        <tr><td align="center" style="font-size: 13px; color: #6b7280;">
                          Access Password: <strong style="color: #111827; font-family: monospace; letter-spacing: 2px;">${escapeHtml(data.portalPassword)}</strong>
                        </td></tr>
                      </table>` : ""}
                      ` : ""}

                      <p style="margin: 24px 0 0; font-size: 14px; color: #374151;">Thank you for your business.</p>
                      <p style="margin: 4px 0 0; font-size: 14px; color: #374151;">Regards,<br>${escapeHtml(fromName)}</p>
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

        const totalAmount = getTotalFromCostBreakdown(schedule.cost_breakdown);
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
            .select("email, client_name, primary_contact_name")
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
            .select("company_name")
            .eq("user_id", schedule.user_id)
            .maybeSingle();

          const portal = await createInvoicePortalToken(supabase, invoiceRow.id, appUrl);
          if (!portal) {
            console.log(`APP_URL not configured -- sending invoice ${invoiceNumber} without a portal link`);
          }

          const emailContent = buildInvoiceEmail(clientRow.primary_contact_name || clientRow.client_name, {
            invoiceId: invoiceRow.id,
            invoiceNumber,
            totalAmount: totalAmount ? `₹${totalAmount.toLocaleString("en-IN")}` : null,
            issuedDate: today,
            dueDate,
            portalLink: portal?.link,
            portalPassword: portal?.password,
            senderName: ownerUser?.user?.user_metadata?.full_name || null,
            senderCompany: brandingRow?.company_name || null,
          });

          const emailPayload: Record<string, unknown> = {
            from: emailFrom(brandingRow?.company_name || "Notifications"),
            to: [clientRow.email],
            subject: emailContent.subject,
            html: emailContent.html,
          };
          if (ownerUser?.user?.email) {
            emailPayload.cc = [ownerUser.user.email];
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
