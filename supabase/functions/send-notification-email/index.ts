import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { emailFrom } from "../_shared/email.ts";
import { appLinkOrNull, claimEmailQuota, isPdfBase64, sanitizeCcEmails } from "../_shared/email-guard.ts";
import { senderBrand } from "../_shared/email-template.ts";
import {
  contractEmail,
  documentStatusEmail,
  type Email,
  formatInr,
  invoiceEmail,
  invoicePaidEmail,
  teamInviteEmail,
} from "../_shared/emails.ts";

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
    | "contract_created"
    | "contract_sent"
    | "team_invite"
    | "invoice_sent"
    | "invoice_overdue"
    | "invoice_paid";
  recipientEmail: string;
  recipientName: string;
  data: Record<string, any>;
  ccEmails?: string[];
  attachments?: { filename: string; content: string }[];
}

const KNOWN_TYPES = new Set<string>([
  "proposal_approved",
  "proposal_rejected",
  "proposal_change_requested",
  "contract_created",
  "contract_sent",
  "team_invite",
  "invoice_sent",
  "invoice_overdue",
  "invoice_paid",
]);

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

    const { type, recipientEmail: bodyRecipientEmail, recipientName: bodyRecipientName, data: rawData, ccEmails, attachments }: NotificationEmailRequest = await req.json();

    // Only known types are sendable: every one of them resolves its recipient
    // server-side below. An unknown type would otherwise fall through to the
    // generic template with the caller's own recipient address.
    if (!KNOWN_TYPES.has(type)) {
      return new Response(
        JSON.stringify({ success: false, error: "Unknown notification type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Buttons may only link back into this app, never to a caller-chosen site.
    const data: Record<string, any> = { ...(rawData && typeof rawData === "object" ? rawData : {}) };
    data.portalLink = appLinkOrNull(data.portalLink);
    data.appUrl = appLinkOrNull(data.appUrl);

    // Resolve the true recipient server-side rather than trusting the request body, so a
    // caller can't use their own valid session to relay arbitrary branded email to an
    // address unrelated to the contract/proposal/invite they claim to be about.
    let recipientEmail = bodyRecipientEmail;
    let recipientName = bodyRecipientName;
    // Workspace owner whose branding a client-facing email carries.
    let ownerId: string | null = null;

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
      // Sending is treated as an 'update' action on the contract, checked against the
      // per-module permission matrix (not just a coarse role label).
      const { data: canSendContract } = await supabase.rpc("has_permission", {
        _user_id: user.id,
        _owner_id: (contractRow as any).user_id,
        _module: "contracts",
        _action: "update",
      });
      if (!canSendContract) {
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
      ownerId = (contractRow as any).user_id;
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
      const { data: canSendProposal } = await supabase.rpc("has_permission", {
        _user_id: user.id,
        _owner_id: (proposalRow as any).user_id,
        _module: "proposals",
        _action: "update",
      });
      if (!canSendProposal) {
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
    } else if (type === "invoice_sent" || type === "invoice_overdue" || type === "invoice_paid") {
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
      const { data: canSendInvoice } = await supabase.rpc("has_permission", {
        _user_id: user.id,
        _owner_id: (invoiceRow as any).user_id,
        _module: "invoices",
        _action: "update",
      });
      if (!canSendInvoice) {
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
      ownerId = (invoiceRow as any).user_id;
    }

    if (!recipientEmail) {
      throw new Error("Recipient email is required");
    }

    if (!(await claimEmailQuota(user.id))) {
      return new Response(
        JSON.stringify({ success: false, error: "Daily email limit reached. Try again tomorrow." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending ${type} notification email`);

    const { data: brandingRow } = ownerId
      ? await supabase
          .from("branding_settings")
          .select("company_name, company_logo_url, primary_color, support_email")
          .eq("user_id", ownerId)
          .maybeSingle()
      : { data: null };
    const fromName: string = brandingRow?.company_name || data.senderCompany || data.senderName || "Your team";
    const brand = senderBrand(brandingRow, fromName);
    const text = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

    let emailContent: Email;
    if (type === "contract_created" || type === "contract_sent") {
      const typeLabels: Record<string, string> = { amc: "Annual maintenance", fixed: "Fixed", retainer: "Retainer" };
      emailContent = contractEmail({
        brand,
        fromName,
        recipientName,
        contractTitle: text(data.contractTitle) || `${typeLabels[data.contractType] || text(data.contractType) || ""} contract`.trim(),
        totalAmount: text(data.totalAmount) || (data.value ? formatInr(Number(data.value)) : null),
        startDate: text(data.startDate),
        endDate: text(data.endDate),
        renewal: text(data.renewalFrequency),
        portalLink: data.portalLink,
        portalPassword: text(data.portalPassword),
        supportEmail: text(data.supportEmail) || brandingRow?.support_email,
        isReminder: !!data.isReminder,
        customSubject: text(data.customSubject),
        customIntro: text(data.customIntro),
      });
    } else if (type === "team_invite") {
      emailContent = teamInviteEmail({
        recipientName,
        inviterName: text(data.inviterName) || text(data.senderCompany) || "Your team",
        signUpLink: data.appUrl,
      });
    } else if (type === "invoice_sent" || type === "invoice_overdue") {
      emailContent = invoiceEmail({
        brand,
        fromName,
        recipientName,
        invoiceNumber: text(data.invoiceNumber) || "",
        totalAmount: text(data.totalAmount),
        projectName: text(data.projectName),
        issuedDate: text(data.issuedDate),
        dueDate: text(data.dueDate),
        portalLink: data.portalLink,
        portalPassword: text(data.portalPassword),
        isOverdue: type === "invoice_overdue" || data.isOverdue === true,
        customSubject: text(data.customSubject),
        customIntro: text(data.customIntro),
      });
    } else if (type === "invoice_paid") {
      emailContent = invoicePaidEmail({
        brand,
        fromName,
        recipientName,
        invoiceNumber: text(data.invoiceNumber) || "",
        totalAmount: text(data.totalAmount),
        thankYouMessage: text(data.thankYouMessage),
      });
    } else {
      const actions = { proposal_approved: "approved", proposal_rejected: "declined", proposal_change_requested: "changes_requested" } as const;
      emailContent = documentStatusEmail({
        ownerName: recipientName,
        documentType: "proposal",
        documentId: text(data.proposalId),
        documentTitle: text(data.proposalTitle) || "Proposal",
        clientName: text(data.clientName) || "Your client",
        action: actions[type as keyof typeof actions],
        notes: text(data.notes),
      });
    }

    const emailPayload: any = {
      from: emailFrom(ownerId ? fromName : "Clientra"),
      to: [recipientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    };

    const cc = sanitizeCcEmails(ccEmails, recipientEmail);
    if (cc.length > 0) {
      emailPayload.cc = cc;
    }

    // Only meaningful for invoice_sent/invoice_overdue (attaching the invoice
    // PDF); ignored for other types so a caller can't smuggle arbitrary
    // attachments through an unrelated notification. Base64 content is
    // capped at ~15MB (well under Resend's 40MB request limit) as a
    // defensive bound, not an expected real-world size for an invoice PDF.
    if (
      (type === "invoice_sent" || type === "invoice_overdue") &&
      Array.isArray(attachments) &&
      attachments.length > 0
    ) {
      const MAX_BASE64_LENGTH = 15 * 1024 * 1024;
      // Only real PDFs, always named .pdf, so the invoice slot can't carry an
      // executable or HTML file dressed up as an invoice.
      const validAttachments = attachments
        .filter((a) => a && typeof a.filename === "string" && isPdfBase64(a.content) && a.content.length <= MAX_BASE64_LENGTH)
        .slice(0, 1)
        .map((a) => ({
          filename: `${(a.filename.split(/[\\/]/).pop() || "").replace(/\.pdf$/i, "").replace(/[^\w .-]/g, "").replace(/^[.\s]+/, "").trim().slice(0, 80) || "invoice"}.pdf`,
          content: a.content,
        }));
      if (validAttachments.length > 0) {
        emailPayload.attachments = validAttachments;
      }
    }

    const emailResponse = await resend.emails.send(emailPayload);

    console.log("Notification email sent:", emailResponse?.data?.id ?? emailResponse?.error);

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
