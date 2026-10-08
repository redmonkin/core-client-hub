// Every email Clientra sends, built on the shared layout in email-template.ts.
// Edge functions resolve recipients and data, then call one of these.
import {
  accountFooter,
  button,
  clientraBrand,
  type EmailBrand,
  escapeHtml,
  greeting,
  itemList,
  note,
  paragraphHtml,
  paragraphs,
  portalPassword,
  renderEmail,
  senderFooter,
  signoff,
  strong,
  summary,
} from "./email-template.ts";

export interface Email {
  subject: string;
  html: string;
}

const formatDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

export const formatInr = (amount: number, fractionDigits = 2) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(amount);

const clean = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const appLink = (path: string): string | null => {
  const base = (Deno.env.get("APP_URL") || "").trim().replace(/\/+$/, "");
  return /^https:\/\//i.test(base) ? `${base}${path}` : null;
};

/** The sender's own intro text, or a greeting plus the default line. */
const intro = (customIntro: unknown, recipientName: string | null | undefined, defaultHtml: string) => {
  const custom = clean(customIntro);
  return custom ? paragraphs(custom) : greeting(recipientName) + paragraphHtml(defaultHtml);
};

const questions = (supportEmail: string | null | undefined) => {
  const email = clean(supportEmail);
  return paragraphHtml(
    email
      ? `Questions? Reply to this email or write to <a href="mailto:${escapeHtml(email)}" style="color:inherit;">${escapeHtml(email)}</a>.`
      : "Questions? Just reply to this email.",
    { small: true, muted: true },
  );
};

// ---------------------------------------------------------------------------
// Client-facing
// ---------------------------------------------------------------------------

export function proposalEmail(d: {
  brand: EmailBrand;
  fromName: string;
  recipientName: string | null;
  proposalTitle: string;
  totalAmount?: string | null;
  objectives?: string | null;
  validUntil?: string | null;
  portalLink?: string | null;
  portalPassword?: string | null;
  supportEmail?: string | null;
  isReminder?: boolean;
  customSubject?: string | null;
  customIntro?: string | null;
}): Email {
  const subject = clean(d.customSubject) || `${d.isReminder ? "Reminder: " : ""}Proposal: ${d.proposalTitle}`;
  const validUntil = formatDate(d.validUntil);
  const content =
    intro(
      d.customIntro,
      d.recipientName,
      d.isReminder
        ? `Just a reminder about the proposal ${strong(d.fromName)} shared with you.`
        : `${strong(d.fromName)} has prepared a proposal for you.`,
    ) +
    summary({
      highlight: d.totalAmount ? { label: "Total investment", value: d.totalAmount } : null,
      rows: [["Objectives", d.objectives], ["Valid until", validUntil]],
    }) +
    button(d.portalLink, "View proposal", d.brand) +
    portalPassword(d.portalLink ? d.portalPassword : null) +
    questions(d.supportEmail) +
    signoff(d.fromName);
  return {
    subject,
    html: renderEmail({
      brand: d.brand,
      eyebrow: d.isReminder ? "Proposal reminder" : "New proposal",
      title: d.proposalTitle,
      tone: d.isReminder ? "warning" : "brand",
      preheader: `${d.fromName} sent you a proposal${validUntil ? `, valid until ${validUntil}` : ""}.`,
      content,
      footer: senderFooter(d.fromName),
    }),
  };
}

export function contractEmail(d: {
  brand: EmailBrand;
  fromName: string;
  recipientName: string | null;
  contractTitle: string;
  totalAmount?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  renewal?: string | null;
  portalLink?: string | null;
  portalPassword?: string | null;
  supportEmail?: string | null;
  isReminder?: boolean;
  customSubject?: string | null;
  customIntro?: string | null;
}): Email {
  const subject = clean(d.customSubject) || `${d.isReminder ? "Reminder: " : ""}Contract: ${d.contractTitle}`;
  const start = formatDate(d.startDate);
  const end = formatDate(d.endDate);
  const content =
    intro(
      d.customIntro,
      d.recipientName,
      d.isReminder
        ? `Just a reminder about the contract ${strong(d.fromName)} shared with you.`
        : `${strong(d.fromName)} has prepared a contract for you to review and sign.`,
    ) +
    summary({
      highlight: d.totalAmount ? { label: "Total value", value: d.totalAmount } : null,
      rows: [["Duration", start && end ? `${start} – ${end}` : null], ["Renewal", d.renewal]],
    }) +
    button(d.portalLink, d.isReminder ? "Review and sign" : "View contract", d.brand) +
    portalPassword(d.portalLink ? d.portalPassword : null) +
    questions(d.supportEmail) +
    signoff(d.fromName);
  return {
    subject,
    html: renderEmail({
      brand: d.brand,
      eyebrow: d.isReminder ? "Contract reminder" : "New contract",
      title: d.contractTitle,
      tone: d.isReminder ? "warning" : "brand",
      preheader: `${d.fromName} sent you a contract to review.`,
      content,
      footer: senderFooter(d.fromName),
    }),
  };
}

export function invoiceEmail(d: {
  brand: EmailBrand;
  fromName: string;
  recipientName: string | null;
  invoiceNumber: string;
  totalAmount?: string | null;
  projectName?: string | null;
  issuedDate?: string | null;
  dueDate?: string | null;
  portalLink?: string | null;
  portalPassword?: string | null;
  isOverdue?: boolean;
  customSubject?: string | null;
  customIntro?: string | null;
}): Email {
  const subject =
    clean(d.customSubject) ||
    (d.isOverdue ? `Payment reminder: Invoice ${d.invoiceNumber} from ${d.fromName}` : `Invoice ${d.invoiceNumber} from ${d.fromName}`);
  const due = formatDate(d.dueDate);
  const content =
    intro(
      d.customIntro,
      d.recipientName,
      d.isOverdue
        ? `Invoice ${strong(d.invoiceNumber)}${d.totalAmount ? ` for ${strong(d.totalAmount)}` : ""} is now overdue. Please arrange payment at your earliest convenience.`
        : `Please find invoice ${strong(d.invoiceNumber)} from ${strong(d.fromName)} below. The PDF is attached.`,
    ) +
    summary({
      highlight: d.totalAmount ? { label: "Amount due", value: d.totalAmount } : null,
      rows: [
        ["Invoice number", d.invoiceNumber],
        ["Project", d.projectName],
        ["Invoice date", formatDate(d.issuedDate)],
        ["Due date", due],
      ],
    }) +
    button(d.portalLink, "View invoice", d.brand) +
    portalPassword(d.portalLink ? d.portalPassword : null) +
    paragraphHtml("Thank you for your business.") +
    signoff(d.fromName);
  return {
    subject,
    html: renderEmail({
      brand: d.brand,
      eyebrow: d.isOverdue ? "Payment overdue" : "Invoice",
      title: d.isOverdue ? `Invoice ${d.invoiceNumber} is overdue` : `Invoice ${d.invoiceNumber}`,
      tone: d.isOverdue ? "danger" : "brand",
      preheader: `${d.totalAmount ? `${d.totalAmount} ` : ""}${due ? `due ${due}` : ""}`.trim() || undefined,
      content,
      footer: senderFooter(d.fromName),
    }),
  };
}

export function invoiceDueReminderEmail(d: {
  brand: EmailBrand;
  fromName: string;
  recipientName: string | null;
  invoiceNumber: string;
  balanceDue: string;
  dueDate: string;
  portalLink?: string | null;
  portalPassword?: string | null;
}): Email {
  const due = formatDate(d.dueDate) || d.dueDate;
  const content =
    greeting(d.recipientName) +
    paragraphHtml(`A friendly reminder that invoice ${strong(d.invoiceNumber)} is due on ${strong(due)}. The PDF is attached.`) +
    summary({
      highlight: { label: "Amount due", value: d.balanceDue },
      rows: [["Invoice number", d.invoiceNumber], ["Due date", due]],
    }) +
    button(d.portalLink, "View invoice", d.brand) +
    portalPassword(d.portalLink ? d.portalPassword : null, d.portalLink ? "Use the access password from your original invoice email." : undefined) +
    paragraphHtml("If you've already paid, please ignore this reminder.", { small: true, muted: true }) +
    signoff(d.fromName);
  return {
    subject: `Payment reminder: Invoice ${d.invoiceNumber} is due on ${due}`,
    html: renderEmail({
      brand: d.brand,
      eyebrow: "Payment reminder",
      title: `Invoice ${d.invoiceNumber} is due soon`,
      tone: "warning",
      preheader: `${d.balanceDue} due on ${due}.`,
      content,
      footer: senderFooter(d.fromName),
    }),
  };
}

export function invoicePaidEmail(d: {
  brand: EmailBrand;
  fromName: string;
  recipientName: string | null;
  invoiceNumber: string;
  totalAmount?: string | null;
  thankYouMessage?: string | null;
}): Email {
  const message = clean(d.thankYouMessage);
  const content =
    greeting(d.recipientName) +
    (message ? paragraphs(message) : paragraphHtml(`Thank you! We've received your payment for invoice ${strong(d.invoiceNumber)} in full.`)) +
    summary({
      highlight: d.totalAmount ? { label: "Amount paid", value: d.totalAmount } : null,
      rows: [["Invoice number", d.invoiceNumber]],
    }) +
    paragraphHtml("We appreciate your business.") +
    signoff(d.fromName);
  return {
    subject: `Payment received: Invoice ${d.invoiceNumber}`,
    html: renderEmail({
      brand: d.brand,
      eyebrow: "Payment received",
      title: "Thank you for your payment",
      tone: "success",
      preheader: `Payment received for invoice ${d.invoiceNumber}.`,
      content,
      footer: senderFooter(d.fromName),
    }),
  };
}

// ---------------------------------------------------------------------------
// To Clientra users
// ---------------------------------------------------------------------------

type DocumentAction = "approved" | "declined" | "changes_requested";

export function documentStatusEmail(d: {
  ownerName: string | null;
  documentType: "proposal" | "contract";
  documentId?: string | null;
  documentTitle: string;
  clientName: string;
  action: DocumentAction;
  notes?: string | null;
}): Email {
  const brand = clientraBrand();
  const doc = d.documentType === "contract" ? "Contract" : "Proposal";
  const verb = { approved: "approved", declined: "declined", changes_requested: "requested changes to" }[d.action];
  const title = { approved: `${doc} approved`, declined: `${doc} declined`, changes_requested: "Changes requested" }[d.action];
  const tone = ({ approved: "success", declined: "danger", changes_requested: "warning" } as const)[d.action];
  const link = d.documentId ? appLink(`/${d.documentType}s/${d.documentId}`) : appLink(`/${d.documentType}s`);
  const content =
    greeting(d.ownerName) +
    paragraphHtml(`${strong(d.clientName)} has ${verb} your ${d.documentType} ${strong(d.documentTitle)}.`) +
    (d.action === "changes_requested" && clean(d.notes) ? note("Client's notes", d.notes!, "warning") : "") +
    button(link, `Open ${d.documentType}`, brand) +
    (d.action === "approved" ? paragraphHtml("You can go ahead with the next steps.", { small: true, muted: true }) : "");
  return {
    subject: `${title}: ${d.documentTitle}`,
    html: renderEmail({
      brand,
      eyebrow: title,
      title: d.documentTitle,
      tone,
      preheader: `${d.clientName} has ${verb} your ${d.documentType}.`,
      content,
      footer: accountFooter("You're receiving this because you have client activity emails turned on."),
    }),
  };
}

export function teamInviteEmail(d: { recipientName: string | null; inviterName: string; signUpLink: string | null }): Email {
  const brand = clientraBrand();
  const content =
    greeting(d.recipientName) +
    paragraphHtml(`${strong(d.inviterName)} has invited you to join their workspace on Clientra.`) +
    paragraphHtml("Sign up or sign in with this email address and you'll get access to their clients, projects, proposals and contracts.") +
    button(d.signUpLink, "Accept invitation", brand) +
    paragraphHtml("If you weren't expecting this invitation, you can ignore this email.", { small: true, muted: true });
  return {
    subject: `${d.inviterName} invited you to their Clientra workspace`,
    html: renderEmail({
      brand,
      eyebrow: "Team invitation",
      title: `Join ${d.inviterName} on Clientra`,
      preheader: `${d.inviterName} invited you to collaborate on Clientra.`,
      content,
      footer: accountFooter("You received this because someone invited this address to a Clientra workspace.", { manageLink: false }),
    }),
  };
}

export function proposalExpiryDigest(items: Array<{ title: string; client: string; value: string; expires: string; daysLeft: number }>): Email {
  const brand = clientraBrand();
  const n = items.length;
  const content =
    paragraphHtml(`${n === 1 ? "One proposal is" : `${n} proposals are`} about to expire:`) +
    itemList(
      items.map((p) => ({
        title: p.title,
        meta: [p.client, p.value, `Expires ${formatDate(p.expires) || p.expires}`],
        badge: { text: p.daysLeft <= 1 ? "Expires tomorrow" : `${p.daysLeft} days left`, tone: p.daysLeft <= 1 ? "danger" : "warning" },
      })),
      brand,
    ) +
    paragraphHtml("Follow up with your clients, or extend the validity date to keep these proposals open.", { small: true, muted: true }) +
    button(appLink("/proposals"), "View proposals", brand);
  return {
    subject: `${n} proposal${n === 1 ? "" : "s"} expiring soon`,
    html: renderEmail({
      brand,
      eyebrow: "Reminder",
      title: `${n} proposal${n === 1 ? "" : "s"} expiring soon`,
      tone: "warning",
      preheader: items.map((p) => p.title).join(", "),
      content,
      footer: accountFooter("This is an automated reminder about your proposals."),
    }),
  };
}

export function contractRenewalDigest(items: Array<{ client: string; type: string; value: string; expires: string; daysLeft: number }>): Email {
  const brand = clientraBrand();
  const n = items.length;
  const content =
    paragraphHtml(`${n === 1 ? "One contract ends" : `${n} contracts end`} in the next 30 days:`) +
    itemList(
      items.map((c) => ({
        title: c.client,
        meta: [c.type, c.value, `Ends ${formatDate(c.expires) || c.expires}`],
        badge: { text: `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left`, tone: c.daysLeft <= 7 ? "danger" : c.daysLeft <= 14 ? "warning" : "brand" },
      })),
      brand,
    ) +
    paragraphHtml("Review them and renew or close them as needed.", { small: true, muted: true }) +
    button(appLink("/contracts"), "View contracts", brand);
  return {
    subject: `${n} contract${n === 1 ? "" : "s"} ending soon`,
    html: renderEmail({
      brand,
      eyebrow: "Reminder",
      title: `${n} contract${n === 1 ? "" : "s"} up for renewal`,
      tone: "warning",
      preheader: items.map((c) => c.client).join(", "),
      content,
      footer: accountFooter("This is an automated reminder about your contracts."),
    }),
  };
}
