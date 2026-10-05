import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Users,
  FileText,
  FileSignature,
  Bell,
  Share2,
  Github,
  ArrowRight,
  CheckCircle,
  ShieldCheck,
  Code2,
  Database,
  ReceiptIndianRupee,
  Clock,
  UsersRound,
  Globe,
  Server,
  Cloud,
  Unlock,
  KeyRound,
  Link2,
  EyeOff,
  Scale,
  Heart,
} from "lucide-react";
import clientraLogoLight from "@/assets/clientra-light.svg";
import clientraLogoDark from "@/assets/clientra-dark.svg";
import { useAuth } from "@/hooks/useAuth";
import { LICENSE_URL, REPO_URL, SELF_HOST_GUIDE_URL, SITE_URL } from "@/lib/site";
import { HeroScene } from "@/components/landing/HeroScene";
import { Backdrop } from "@/components/landing/Backdrop";
import { Reveal } from "@/components/landing/Reveal";

const SECURITY_POLICY_URL = `${REPO_URL}/blob/main/SECURITY.md`;
const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
const ISSUES_URL = `${REPO_URL}/issues`;

const pillars = [
  { icon: Code2, title: "Open source", text: "Every line is public under AGPL-3.0" },
  { icon: ShieldCheck, title: "Secure by default", text: "Isolation enforced in the database" },
  { icon: Database, title: "Your data", text: "Run it on your own Supabase project" },
  { icon: Unlock, title: "No lock-in", text: "Fork it, host it, change it" },
];

const features = [
  {
    icon: Users,
    title: "Clients & Projects",
    description: "Keep every client's contacts, projects, notes, files and history in one place.",
  },
  {
    icon: FileText,
    title: "Proposals & Templates",
    description: "Build proposals from reusable templates with scope and pricing, then export to PDF or Word.",
  },
  {
    icon: FileSignature,
    title: "Contracts & E-Signatures",
    description: "Clients sign contracts online. Renewal reminders go out before anything expires.",
  },
  {
    icon: ReceiptIndianRupee,
    title: "Invoices & Accounts",
    description: "Recurring invoices, expenses, payments, TDS tracking and a per-client ledger, in ₹.",
  },
  {
    icon: Clock,
    title: "Tasks & Timesheets",
    description: "Track tasks and hours per project. Import timesheets from CSV or Excel and export them back.",
  },
  {
    icon: Share2,
    title: "Client Portal",
    description: "Share proposals, contracts and invoices through password-protected, expiring links. No client account needed.",
  },
  {
    icon: UsersRound,
    title: "Team Workspace",
    description: "Invite teammates into your workspace with roles, including who can see financial figures.",
  },
  {
    icon: Globe,
    title: "Public Portfolio",
    description: "Showcase featured work on a public page with a built-in “start a project” form that creates leads.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Get alerted when clients view, approve or comment on what you've sent.",
  },
];

const howItWorks = [
  {
    step: 1,
    title: "Add your clients",
    description: "Import or add clients with their details and contacts.",
  },
  {
    step: 2,
    title: "Send a proposal",
    description: "Start from a template, set the scope and pricing, and share a secure link.",
  },
  {
    step: 3,
    title: "Get it signed",
    description: "Clients approve proposals and sign contracts online, without an account.",
  },
  {
    step: 4,
    title: "Invoice & get paid",
    description: "Send invoices, record payments and let reminders do the chasing.",
  },
];

const securityPoints = [
  {
    icon: ShieldCheck,
    title: "Workspace isolation in the database",
    text: "Postgres row-level security keeps each workspace's records separate, not just the screens.",
  },
  {
    icon: Link2,
    title: "Signed, expiring client links",
    text: "Portal links expire and can be password-protected, so a forwarded email isn't an open door.",
  },
  {
    icon: KeyRound,
    title: "Breached-password checks",
    text: "New passwords are checked against known breaches. Only a 5-character hash prefix leaves your browser.",
  },
  {
    icon: EyeOff,
    title: "No ads, no trackers",
    text: "A strict Content Security Policy, and no analytics or advertising scripts in the app.",
  },
];

const selfHostSteps = [
  { prompt: true, text: `git clone ${REPO_URL}.git clientra` },
  { prompt: true, text: "cd clientra && npm install" },
  { prompt: true, text: "supabase link --project-ref <your-project>" },
  { prompt: true, text: "supabase db push && supabase functions deploy" },
  { prompt: true, text: "npm run build" },
  { prompt: false, text: "✓ Your own Clientra, on infrastructure you control" },
];

const deploymentOptions = [
  {
    icon: Cloud,
    name: "Use it here",
    description: "Create an account on this instance and start right away.",
    features: [
      "Nothing to install or maintain",
      "Clients, proposals, contracts and invoices",
      "Client portal and public portfolio",
      "Invite your team",
    ],
    cta: "Create an account",
    href: "/auth",
    external: false,
  },
  {
    icon: Server,
    name: "Host it yourself",
    description: "Run your own copy on your own Supabase project.",
    features: [
      "Free and open source (AGPL-3.0)",
      "Your database, your data",
      "Deploy the frontend anywhere static sites run",
      "Customize it to fit your workflow",
    ],
    cta: "Read the self-hosting guide",
    href: SELF_HOST_GUIDE_URL,
    external: true,
  },
];

const faqs = [
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

function Logo({ size = "h-9 w-9" }: { size?: string }) {
  return (
    <>
      <img src={clientraLogoDark} alt="" className={`${size} dark:hidden`} />
      <img src={clientraLogoLight} alt="" className={`${size} hidden dark:block`} />
    </>
  );
}

function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <Reveal className="mx-auto mb-14 max-w-3xl text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      <p className="text-lg text-muted-foreground">{text}</p>
    </Reveal>
  );
}

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <Helmet>
        <title>Clientra — Open-source client management for freelancers</title>
        <meta name="description" content="Open-source client management for freelancers and agencies. Track clients, projects, proposals, and contracts in one place." />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:title" content="Clientra — Open-source client management" />
        <meta property="og:description" content="Track clients, projects, proposals, and contracts in one place. Open source and self-hostable." />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Clientra home">
            <Logo />
            <span className="text-xl font-semibold text-foreground">Clientra</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm md:flex">
            <a href="#features" className="text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How it works</a>
            <a href="#security" className="text-muted-foreground transition-colors hover:text-foreground">Security</a>
            <a href="#get-started" className="text-muted-foreground transition-colors hover:text-foreground">Self-host</a>
            <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">FAQ</a>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ExternalLink
              href={REPO_URL}
              className="hidden items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              <Github className="h-4 w-4" />
              <span className="sr-only lg:not-sr-only">GitHub</span>
            </ExternalLink>
            <Button variant="ghost" asChild className="px-3 sm:px-4">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild className="shadow-md shadow-primary/20">
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="relative">
          <Backdrop />
          <div className="container relative mx-auto grid items-center gap-16 px-4 pb-24 pt-14 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-32 lg:pt-24">
            <div className="text-center lg:text-left">
              <ExternalLink
                href={REPO_URL}
                className="mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/40"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Free &amp; open source · AGPL-3.0
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </ExternalLink>
              <h1
                className="mb-6 animate-fade-up text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl"
                style={{ animationDelay: "80ms" }}
              >
                Manage clients,
                <br />
                <span className="text-shimmer animate-shimmer motion-reduce:animate-none">not chaos.</span>
              </h1>
              <p
                className="mx-auto mb-8 max-w-xl animate-fade-up text-lg text-muted-foreground md:text-xl lg:mx-0"
                style={{ animationDelay: "160ms" }}
              >
                The open-source home for freelancers and agencies: clients, proposals,
                contracts and invoices in one calm, secure place.
              </p>
              <div
                className="flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
                style={{ animationDelay: "240ms" }}
              >
                <Button size="lg" className="group w-full gap-2 shadow-lg shadow-primary/25 sm:w-auto" asChild>
                  <Link to="/auth">
                    Get started free
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="w-full gap-2 bg-background/70 backdrop-blur sm:w-auto" asChild>
                  <ExternalLink href={REPO_URL}>
                    <Github className="h-4 w-4" />
                    View the code
                  </ExternalLink>
                </Button>
              </div>
              <ul
                className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start"
                style={{ animationDelay: "320ms" }}
              >
                {["No credit card", "Self-host anytime", "No ads or trackers"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="animate-fade-up px-2 pt-4 sm:px-8 lg:px-0 lg:pt-0" style={{ animationDelay: "200ms" }}>
              <HeroScene />
            </div>
          </div>
        </section>

        {/* Trust pillars */}
        <section className="border-y border-border bg-card/70">
          <div className="container mx-auto grid grid-cols-2 gap-px px-4 md:grid-cols-4">
            {pillars.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 80} className="flex flex-col items-start gap-3 px-2 py-6 sm:flex-row sm:px-4 md:py-8">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{pillar.title}</p>
                  <p className="text-sm text-muted-foreground">{pillar.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="container mx-auto scroll-mt-20 px-4 py-24 md:py-32">
          <SectionHeading
            eyebrow="Features"
            title="Everything your client work needs"
            text="Built for freelancers and agencies who want to spend less time on admin and more time doing great work."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 3) * 90}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 motion-reduce:hover:translate-y-0">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15 transition-colors duration-300 group-hover:from-primary group-hover:to-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="relative mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="relative text-muted-foreground">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-card py-24 md:py-32">
          <div className="container mx-auto px-4">
            <SectionHeading
              eyebrow="How it works"
              title="From first hello to paid invoice"
              text="One flow for the whole client relationship, so nothing falls between apps."
            />
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 lg:block"
              />
              <ol className="relative grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {howItWorks.map((step, i) => (
                  <Reveal as="li" key={step.step} delay={i * 120} className="relative text-center">
                    <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
                      <span className="absolute inset-0 rounded-2xl bg-primary/20 blur-md" />
                      <span className="relative flex h-16 w-16 rotate-3 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-sky-600 text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-300 hover:rotate-0">
                        {step.step}
                      </span>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="mx-auto max-w-xs text-muted-foreground">{step.description}</p>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Security & open source */}
        <section id="security" className="relative scroll-mt-20 overflow-hidden bg-[hsl(222_47%_11%)] py-24 text-slate-100 md:py-32">
          <Backdrop tone="light" className="opacity-60" />
          <div className="container relative mx-auto grid items-center gap-14 px-4 lg:grid-cols-2">
            <div>
              <Reveal>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-sky-400">Trust</p>
                <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Built in the open.
                  <br />
                  Secure by default.
                </h2>
                <p className="mb-10 text-lg text-slate-300">
                  Your clients trust you with their work. Clientra is designed so you can trust it
                  with theirs — and because the code is public, you don't have to take our word for it.
                </p>
              </Reveal>
              <div className="grid gap-6 sm:grid-cols-2">
                {securityPoints.map((point, i) => (
                  <Reveal key={point.title} delay={i * 90} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-400 ring-1 ring-sky-400/20">
                      <point.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="mb-1 font-semibold text-white">{point.title}</p>
                      <p className="text-sm text-slate-400">{point.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <ExternalLink href={SECURITY_POLICY_URL} className="inline-flex items-center gap-1.5 text-sky-400 underline-offset-4 hover:underline">
                  <ShieldCheck className="h-4 w-4" /> Security policy
                </ExternalLink>
                <ExternalLink href={LICENSE_URL} className="inline-flex items-center gap-1.5 text-sky-400 underline-offset-4 hover:underline">
                  <Scale className="h-4 w-4" /> AGPL-3.0 license
                </ExternalLink>
              </Reveal>
            </div>

            {/* Self-host terminal */}
            <Reveal delay={150} className="[perspective:1400px]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl shadow-sky-900/40 backdrop-blur transition-transform duration-500 lg:[transform:rotateY(-8deg)_rotateX(4deg)] lg:hover:[transform:rotateY(0deg)_rotateX(0deg)] motion-reduce:transform-none">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 font-mono text-xs text-slate-500">self-host.sh</span>
                </div>
                <div className="overflow-x-auto p-5 font-mono text-[13px] leading-7">
                  {selfHostSteps.map((line, i) => (
                    <Reveal key={line.text} delay={300 + i * 180} className="whitespace-pre">
                      {line.prompt ? (
                        <>
                          <span className="select-none text-sky-400">$ </span>
                          <span className="text-slate-200">{line.text}</span>
                        </>
                      ) : (
                        <span className="text-emerald-400">{line.text}</span>
                      )}
                    </Reveal>
                  ))}
                  <span className="motion-decor mt-1 inline-block h-4 w-2 animate-pulse bg-sky-400/80 align-middle" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-4 text-center text-sm text-slate-400 lg:text-left">
                The full walkthrough, including secrets and auth settings, is in the{" "}
                <ExternalLink href={SELF_HOST_GUIDE_URL} className="text-sky-400 underline-offset-4 hover:underline">
                  self-hosting guide
                </ExternalLink>
                .
              </p>
            </Reveal>
          </div>
        </section>

        {/* Deployment options */}
        <section id="get-started" className="container mx-auto scroll-mt-20 px-4 py-24 md:py-32">
          <SectionHeading
            eyebrow="Get started"
            title="Two ways to use Clientra"
            text="Same app either way. Sign up here, or run it on infrastructure you control."
          />
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {deploymentOptions.map((option, i) => (
              <Reveal key={option.name} delay={i * 120} className="h-full">
                <div
                  className={`relative flex h-full flex-col rounded-2xl border bg-card p-7 transition-shadow duration-300 hover:shadow-xl ${
                    option.external ? "border-border" : "border-primary/40 shadow-lg shadow-primary/10"
                  }`}
                >
                  {!option.external && (
                    <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow">
                      Quickest start
                    </span>
                  )}
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <option.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-1 text-xl font-semibold text-foreground">{option.name}</h3>
                  <p className="mb-6 text-muted-foreground">{option.description}</p>
                  <ul className="mb-8 space-y-3">
                    {option.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-auto w-full" variant={option.external ? "outline" : "default"} asChild>
                    {option.external ? (
                      <ExternalLink href={option.href}>{option.cta}</ExternalLink>
                    ) : (
                      <Link to={option.href}>{option.cta}</Link>
                    )}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-border bg-card py-24 md:py-32">
          <div className="container mx-auto max-w-3xl px-4">
            <SectionHeading eyebrow="FAQ" title="Questions, answered" text="The things people usually ask before trusting a tool with their client work." />
            <Reveal>
              <Accordion type="single" collapsible className="rounded-2xl border border-border bg-background px-5">
                {faqs.map((faq, i) => (
                  <AccordionItem key={faq.q} value={`faq-${i}`} className={i === faqs.length - 1 ? "border-b-0" : undefined}>
                    <AccordionTrigger className="text-left text-base font-semibold">{faq.q}</AccordionTrigger>
                    <AccordionContent className="text-base text-muted-foreground">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-24 md:py-32">
          <Reveal className="container relative mx-auto overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-sky-600 to-sky-800 px-6 py-16 text-center text-primary-foreground shadow-2xl shadow-primary/30 md:py-20">
            <Backdrop tone="light" className="opacity-50" />
            <div className="relative">
              <div className="motion-decor mx-auto mb-6 flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                <img src={clientraLogoLight} alt="" className="h-10 w-10" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Ready for a calmer client workflow?</h2>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-white/85">
                Start in a minute here, or make it your own. Clientra is open source, so you can
                read the code, suggest features and contribute.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" variant="secondary" className="group w-full gap-2 sm:w-auto" asChild>
                  <Link to="/auth">
                    Get started free
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
                  asChild
                >
                  <ExternalLink href={REPO_URL}>
                    <Github className="h-4 w-4" />
                    Star on GitHub
                  </ExternalLink>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/60">
        <div className="container mx-auto grid gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-2.5" aria-label="Clientra home">
              <Logo size="h-8 w-8" />
              <span className="text-lg font-semibold text-foreground">Clientra</span>
            </Link>
            <p className="max-w-sm text-sm text-muted-foreground">
              Open-source client management for freelancers and agencies. Use it here or host it yourself.
            </p>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Product</p>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              <li><a href="#features" className="inline-block py-1.5 transition-colors hover:text-foreground">Features</a></li>
              <li><a href="#security" className="inline-block py-1.5 transition-colors hover:text-foreground">Security</a></li>
              <li><a href="#faq" className="inline-block py-1.5 transition-colors hover:text-foreground">FAQ</a></li>
              <li><Link to="/auth" className="inline-block py-1.5 transition-colors hover:text-foreground">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Open source</p>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              <li><ExternalLink href={REPO_URL} className="inline-block py-1.5 transition-colors hover:text-foreground">GitHub</ExternalLink></li>
              <li><ExternalLink href={SELF_HOST_GUIDE_URL} className="inline-block py-1.5 transition-colors hover:text-foreground">Self-hosting guide</ExternalLink></li>
              <li><ExternalLink href={CONTRIBUTING_URL} className="inline-block py-1.5 transition-colors hover:text-foreground">Contributing</ExternalLink></li>
              <li><ExternalLink href={ISSUES_URL} className="inline-block py-1.5 transition-colors hover:text-foreground">Report an issue</ExternalLink></li>
              <li><ExternalLink href={SECURITY_POLICY_URL} className="inline-block py-1.5 transition-colors hover:text-foreground">Security policy</ExternalLink></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
            <p>
              © {new Date().getFullYear()} Clientra. Open source under the{" "}
              <ExternalLink href={LICENSE_URL} className="underline underline-offset-4 hover:text-foreground">
                AGPL-3.0
              </ExternalLink>{" "}
              license.
            </p>
            <p className="flex items-center gap-1.5">
              Made with <Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" /><span className="sr-only">love</span> in the open
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
