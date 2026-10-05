// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes
// public/sitemap.xml, public/robots.txt and public/llms.txt for this
// deployment's VITE_SITE_URL.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV === "development" ? "development" : "production", process.cwd(), "");
const BASE_URL = (env.VITE_SITE_URL || "https://clientra.redmonk.in").replace(/\/$/, "");
const REPO_URL = (env.VITE_REPO_URL || "https://github.com/redmonkin/core-client-hub").replace(/\/$/, "");

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Public, indexable routes only. Auth-gated app routes (/dashboard, /clients, etc.)
// and dynamic per-user portfolio/portal links are intentionally excluded.
const entries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/auth", changefreq: "monthly", priority: "0.5" },
];

function generateSitemap(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

// Every crawler, including AI assistants' (GPTBot, ClaudeBot, PerplexityBot,
// Google-Extended...), may read the public pages. Signed-in app routes are
// empty shells to a crawler, and portal links carry access tokens.
const PRIVATE_PATHS = [
  "/portal",
  "/reset-password",
  "/dashboard",
  "/clients",
  "/projects",
  "/tasks",
  "/proposals",
  "/contracts",
  "/invoices",
  "/templates",
  "/briefs",
  "/settings",
  "/profile",
];

const robots = [
  "User-agent: *",
  "Allow: /",
  ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`),
  "",
  `Sitemap: ${BASE_URL}/sitemap.xml`,
  "",
].join("\n");

// https://llmstxt.org: a plain-language summary for AI assistants and answer
// engines. Keep it factual; it is what they will quote.
const llms = `# Clientra

> Clientra is free, open-source client management software for freelancers and agencies. It covers clients, projects, proposals, e-signed contracts, invoices, timesheets and a client portal in one web app. It is licensed under AGPL-3.0 and can be used on the hosted instance at ${BASE_URL} or self-hosted on Supabase.

## What Clientra does

- Clients and projects: contacts, notes, files and history per client.
- Proposals: built from reusable templates with scope and pricing; export to PDF or Word.
- Contracts: clients sign online; renewal reminders go out before contracts expire.
- Invoices and accounts: recurring invoices, expenses, payments, TDS tracking and a per-client ledger in Indian rupees (₹), with payment reminders before the due date.
- Tasks and timesheets: hours per project, CSV and Excel import and export.
- Client portal: proposals, contracts and invoices shared through password-protected, expiring links; clients don't need an account.
- Team workspace: invite teammates with roles, including control over who sees financial figures.
- Public portfolio: a public page of featured work with a "start a project" enquiry form.

## Security and privacy

- Each workspace's data is isolated in the database with Postgres row-level security.
- New passwords are checked against known data breaches using k-anonymity (only a 5-character hash prefix leaves the browser).
- No advertising or analytics scripts; a strict Content Security Policy.
- Security issues are reported privately: ${REPO_URL}/blob/main/SECURITY.md

## Who it is for

Freelancers, consultants, studios and small agencies who want proposals, contracts and invoicing in one place, and who prefer open-source software they can audit or run on their own infrastructure. It is an open-source alternative to tools such as HoneyBook, Bonsai and Dubsado.

## Tech stack

React, TypeScript, Vite, Tailwind CSS and shadcn/ui on the frontend; Supabase (Postgres, Auth, Storage, Edge Functions) on the backend.

## Links

- [Home](${BASE_URL}/): Product overview, features, security and FAQ.
- [Sign up or sign in](${BASE_URL}/auth): Create an account on the hosted instance.
- [Source code](${REPO_URL}): GitHub repository.
- [Self-hosting guide](${REPO_URL}#self-hosting): Run your own copy on Supabase plus any static host.
- [License](${REPO_URL}/blob/main/LICENSE): AGPL-3.0.
- [Contributing](${REPO_URL}/blob/main/CONTRIBUTING.md): How to report issues and send pull requests.
`;

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
writeFileSync(resolve("public/robots.txt"), robots);
writeFileSync(resolve("public/llms.txt"), llms);
console.log(`sitemap.xml (${entries.length} entries), robots.txt and llms.txt written for ${BASE_URL}`);
