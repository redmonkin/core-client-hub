import { build, defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { pathToFileURL } from "url";
import { VitePWA } from "vite-plugin-pwa";

const PRERENDER_OUT = "node_modules/.clientra-prerender";

/**
 * Production builds only: renders the landing page (src/prerender.tsx) into
 * dist/index.html so crawlers that don't run JavaScript see real content, and
 * writes the untouched shell to dist/app.html, which every other route is
 * served from (vercel.json rewrites, PWA navigation fallback).
 */
function prerenderLanding(mode: string): Plugin {
  return {
    name: "clientra-prerender",
    apply: (_config, { command, isSsrBuild }) => command === "build" && !isSsrBuild,
    enforce: "post",
    async generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (!index || index.type !== "asset") return;
      const shell = String(index.source);

      await build({
        configFile: path.resolve(__dirname, "vite.config.ts"),
        mode,
        logLevel: "warn",
        build: {
          ssr: "src/prerender.tsx",
          outDir: PRERENDER_OUT,
          emptyOutDir: true,
          rollupOptions: { output: { entryFileNames: "prerender.mjs" } },
        },
      });
      const entry = pathToFileURL(path.resolve(__dirname, PRERENDER_OUT, "prerender.mjs")).href;
      const { renderLanding } = await import(`${entry}?t=${Date.now()}`);
      const { html, head } = renderLanding() as { html: string; head: string };

      if (!shell.includes('<div id="root"></div>')) throw new Error("clientra-prerender: #root not found in index.html");
      index.source = shell
        .replace("</head>", `${head}</head>`)
        .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
      this.emitFile({ type: "asset", fileName: "app.html", source: shell });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Public origin used in index.html meta tags (og:url, og:image, JSON-LD).
  const siteUrl = (env.VITE_SITE_URL || "https://clientra.redmonk.in").replace(/\/$/, "");

  return {
    server: {
      host: "::",
      port: Number(env.PORT) || 8080,
    },
    plugins: [
      react(),
      {
        name: "clientra-site-url",
        transformIndexHtml: (html: string) => html.replaceAll("__SITE_URL__", siteUrl),
      },
      prerenderLanding(mode),
      !isSsrBuild &&
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        workbox: {
          // The pre-rendered index.html is for "/" only; the app shell serves
          // every navigation, as it does on Vercel.
          navigateFallback: "/app.html",
          navigateFallbackDenylist: [/^\/~oauth/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          // Some shared chunks (PDF export, editors) are large; raise the 2 MiB
          // default rather than fail the build.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        manifest: {
          name: "Clientra - Client Management",
          short_name: "Clientra",
          description: "The open-source client management platform for freelancers and agencies.",
          theme_color: "#0284C5",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ].filter(Boolean),
    // The pre-render runs in Node, where there is no window.location to fall
    // back on for canonical URLs and structured data.
    define: isSsrBuild ? { "import.meta.env.VITE_SITE_URL": JSON.stringify(siteUrl) } : undefined,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
