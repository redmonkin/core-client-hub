// Server-side entry used at build time (see the clientra-prerender plugin in
// vite.config.ts) to render the landing page to static HTML, so search
// engines and AI crawlers that don't run JavaScript still see its content.
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { LandingContent } from "@/components/landing/LandingContent";

export function renderLanding(): { html: string; head: string } {
  const helmetContext: { helmet?: HelmetServerState } = {};
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location="/">
        <LandingContent />
      </StaticRouter>
    </HelmetProvider>,
  );
  const helmet = helmetContext.helmet;
  const head = helmet ? [helmet.link.toString()].join("") : "";
  return { html, head };
}
