// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes
// public/sitemap.xml and public/robots.txt for this deployment's VITE_SITE_URL.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV === "development" ? "development" : "production", process.cwd(), "");
const BASE_URL = (env.VITE_SITE_URL || "https://clientra.redmonk.in").replace(/\/$/, "");

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

// Portal links carry access tokens and are never meant to be crawled.
const robots = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /portal",
  "",
  `Sitemap: ${BASE_URL}/sitemap.xml`,
  "",
].join("\n");

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
writeFileSync(resolve("public/robots.txt"), robots);
console.log(`sitemap.xml (${entries.length} entries) and robots.txt written for ${BASE_URL}`);
