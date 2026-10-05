// Title, description and schema.org data for the landing page. index.html
// carries the same title and description for the pre-rendered page; keep the
// two in step.
import { LICENSE_URL, REPO_URL } from "@/lib/site";

export const PAGE_TITLE = "Clientra — Open-source client management for freelancers & agencies";

export const PAGE_DESCRIPTION =
  "Free, open-source client management for freelancers and agencies: proposals, e-signed contracts, invoices, timesheets and a client portal. Self-hostable.";

/** Shown on the page and as FAQPage structured data. */
export const faqs = [
  {
    q: "What is Clientra?",
    a: "Clientra is free, open-source client management software for freelancers and agencies. It brings clients, projects, proposals, e-signed contracts, invoices, timesheets and a client portal into one web app that you can use on this hosted instance or host yourself on Supabase.",
  },
  {
    q: "How is Clientra different from HoneyBook, Bonsai or Dubsado?",
    a: "It covers similar ground (proposals, contracts, invoicing and a client portal) but it is open source under the AGPL-3.0 license. You can read the code, host it on your own Supabase project and keep your data in a database you control. It also handles Indian invoicing needs such as rupee amounts and TDS tracking.",
  },
  {
    q: "Is Clientra really free?",
    a: "Yes. The code is free and open source under the AGPL-3.0 license, and you can host it yourself at no cost beyond your own infrastructure. Free accounts on this hosted instance are limited in number; if they're full, get in touch.",
  },
  {
    q: "Who can see my data?",
    a: "Only you and the teammates you invite into your workspace. Access rules are enforced by the database itself with row-level security, and clients only see what you share with them through a portal link.",
  },
  {
    q: "Do my clients need an account?",
    a: "No. They open a secure link to view and approve proposals, sign contracts or see invoices. You can protect links with a password and they expire automatically.",
  },
  {
    q: "Can I move to my own server later?",
    a: "Yes. Clientra runs on a standard Supabase project and a static frontend, so you can set up your own copy at any time by following the self-hosting guide.",
  },
  {
    q: "How can I contribute or report a problem?",
    a: "Open an issue or a pull request on GitHub. For security issues, please follow the security policy and report privately rather than in a public issue.",
  },
];

const FEATURE_LIST = [
  "Client and project management",
  "Proposals from reusable templates with PDF and Word export",
  "Contracts with online e-signatures and renewal reminders",
  "Recurring invoices, expenses, payments and TDS tracking in Indian rupees",
  "Tasks and timesheets with CSV and Excel import/export",
  "Password-protected, expiring client portal links",
  "Team workspaces with roles and financial visibility controls",
  "Public portfolio with a project enquiry form",
];

/** JSON-LD for the landing page, safe to embed in a <script> element. */
export function structuredData(siteUrl: string): string {
  const home = `${siteUrl}/`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${home}#organization`,
        name: "Clientra",
        url: home,
        logo: `${siteUrl}/pwa-512x512.png`,
        sameAs: [REPO_URL],
      },
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        name: "Clientra",
        url: home,
        description: PAGE_DESCRIPTION,
        publisher: { "@id": `${home}#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${home}#software`,
        name: "Clientra",
        url: home,
        description: PAGE_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Client management (CRM)",
        operatingSystem: "Web",
        image: `${siteUrl}/og-image.png`,
        featureList: FEATURE_LIST,
        license: LICENSE_URL,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        publisher: { "@id": `${home}#organization` },
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${home}#source`,
        name: "Clientra",
        codeRepository: REPO_URL,
        programmingLanguage: ["TypeScript", "SQL"],
        runtimePlatform: ["Supabase", "Web browser"],
        license: LICENSE_URL,
        targetProduct: { "@id": `${home}#software` },
      },
      {
        "@type": "FAQPage",
        "@id": `${home}#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
  };
  // Escape "<" so the JSON can't close the surrounding script element.
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
