import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailFrom } from "../_shared/email.ts";
import { appLinkOrNull, claimEmailQuota, sanitizeCcEmails } from "../_shared/email-guard.ts";
import { senderBrand } from "../_shared/email-template.ts";
import { proposalEmail } from "../_shared/emails.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendProposalRequest {
  proposalId: string;
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
  customSubject?: string | null;
  customIntro?: string | null;
  isReminder?: boolean;
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const {
      proposalId,
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
      customSubject,
      customIntro,
      isReminder,
    }: SendProposalRequest = await req.json();

    if (!proposalId) {
      return new Response(
        JSON.stringify({ success: false, error: "proposalId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Resolve the proposal (and its client) through the RLS-scoped client, using the
    // caller's own JWT. This fails closed if the proposal isn't in the caller's workspace,
    // and it pins the recipient to the client actually attached to the proposal instead of
    // trusting a client-supplied email address.
    const { data: proposalRow, error: proposalError } = await supabase
      .from("proposals")
      .select("client_id, user_id")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError || !proposalRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Proposal not found or access denied" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sending is treated as an 'update' action on the proposal. This can't be enforced
    // by RLS alone since the caller only needs SELECT access above, so check explicitly
    // here against the per-module permission matrix (not just a coarse role label).
    const { data: canSend } = await supabase.rpc("has_permission", {
      _user_id: user.id,
      _owner_id: (proposalRow as any).user_id,
      _module: "proposals",
      _action: "update",
    });
    if (!canSend) {
      return new Response(
        JSON.stringify({ success: false, error: "You don't have permission to send this proposal" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("email, client_name")
      .eq("id", proposalRow.client_id)
      .maybeSingle();

    if (clientError || !clientRow?.email) {
      return new Response(
        JSON.stringify({ success: false, error: "Client email not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const clientEmail = clientRow.email;
    const clientName = clientRow.client_name;

    console.log(`Sending proposal email for proposal ${proposalId}`);

    const goalsSummary = customerGoals ? truncate(stripHtml(customerGoals), 300) : null;

    const { data: brandingRow } = await supabase
      .from("branding_settings")
      .select("company_name, company_logo_url, primary_color, support_email")
      .eq("user_id", (proposalRow as any).user_id)
      .maybeSingle();
    const fromName = brandingRow?.company_name || senderCompany || senderName || "Clientra";

    // The button may only link back into this app, never to a caller-chosen site.
    const safePortalLink = appLinkOrNull(portalLink);

    const email = proposalEmail({
      brand: senderBrand(brandingRow, fromName),
      fromName,
      recipientName: clientName,
      proposalTitle: proposalTitle || "Proposal",
      totalAmount,
      objectives: goalsSummary,
      validUntil: validityDate,
      portalLink: safePortalLink,
      portalPassword,
      supportEmail: supportEmail || brandingRow?.support_email,
      isReminder: !!isReminder,
      customSubject,
      customIntro,
    });

    const emailPayload: any = {
      from: emailFrom(fromName),
      to: [clientEmail],
      subject: email.subject,
      html: email.html,
    };

    const cc = sanitizeCcEmails(ccEmails, clientEmail);
    if (cc.length > 0) {
      emailPayload.cc = cc;
    }

    if (!(await claimEmailQuota(user.id))) {
      return new Response(
        JSON.stringify({ success: false, error: "Daily email limit reached. Try again tomorrow." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailResponse = await resend.emails.send(emailPayload);

    console.log("Email sent successfully:", emailResponse?.data?.id ?? emailResponse?.error);

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
      JSON.stringify({ success: false, error: "An internal error occurred while sending the email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
