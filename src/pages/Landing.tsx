import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  FileSignature,
  Bell,
  Share2,
  Github,
  ArrowRight,
  CheckCircle,
  Shield,
  Zap,
  Code2,
  Database,
  ReceiptIndianRupee,
  Clock,
  UsersRound,
  Globe,
  Server,
  Cloud,
} from "lucide-react";
import clientraLogoLight from "@/assets/clientra-light.svg";
import clientraLogoDark from "@/assets/clientra-dark.svg";
import { useAuth } from "@/hooks/useAuth";
import { LICENSE_URL, REPO_URL, SELF_HOST_GUIDE_URL, SITE_URL } from "@/lib/site";

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
    description: "Showcase featured work on a public page with a built-in \u201cstart a project\u201d form that creates leads.",
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
    title: "Add Your Clients",
    description: "Import or manually add your clients with all their details and contact information.",
  },
  {
    step: 2,
    title: "Create Projects & Proposals",
    description: "Set up projects, create detailed proposals with pricing, and track everything in one place.",
  },
  {
    step: 3,
    title: "Share & Get Approved",
    description: "Send secure links to clients. They can view and approve proposals instantly.",
  },
  {
    step: 4,
    title: "Manage Contracts",
    description: "Track active contracts, get renewal reminders, and never miss a deadline.",
  },
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
    <div className="min-h-screen bg-background">
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
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={clientraLogoDark} alt="Clientra Logo" className="h-9 w-9 dark:hidden" />
            <img src={clientraLogoLight} alt="Clientra Logo" className="h-9 w-9 hidden dark:block" />
            <span className="text-xl font-semibold text-foreground">Clientra</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </a>
            <a href="#get-started" className="text-muted-foreground hover:text-foreground transition-colors">
              Self-Host
            </a>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Clientra on GitHub"
              className="hidden rounded-md p-2 text-muted-foreground hover:text-foreground transition-colors sm:inline-flex"
            >
              <Github className="h-5 w-5" />
            </a>
            <Button variant="ghost" asChild className="px-3 sm:px-4">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">

        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-6 gap-2">
            <Github className="h-4 w-4" />
            Free &amp; open source
          </Badge>
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Manage Clients,{" "}
            <span className="text-primary">Not Chaos</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            The open-source client management platform for freelancers and agencies.
            Track projects, send proposals, manage contracts — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/auth">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="gap-2" asChild>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            AGPL-3.0 licensed • Use it here or host it yourself
          </p>
        </div>
      </section>

      {/* Open Source Banner */}
      <section className="border-y border-border bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center">
            <div className="flex items-center gap-3">
              <Code2 className="h-6 w-6 text-primary" />
              <span className="font-medium text-foreground">Open Source</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-medium text-foreground">Self-Hostable</span>
            </div>
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <span className="font-medium text-foreground">Your Data, Your Database</span>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-primary" />
              <span className="font-medium text-foreground">No Vendor Lock-in</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <Badge variant="outline" className="mb-4">Features</Badge>
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Everything You Need to Manage Clients
          </h2>
          <p className="text-lg text-muted-foreground">
            Built for freelancers and agencies who want to spend less time on admin
            and more time doing great work.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="group hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-y border-border bg-card py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-lg text-muted-foreground">
              Simple setup, powerful results. Start managing clients like a pro today.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step) => (
              <div key={step.step} className="relative text-center">
                <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {step.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deployment Options Section */}
      <section id="get-started" className="container mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <Badge variant="outline" className="mb-4">Get Started</Badge>
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Two Ways to Use Clientra
          </h2>
          <p className="text-lg text-muted-foreground">
            Same app either way. Sign up here, or run it on infrastructure you control.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {deploymentOptions.map((option) => (
            <Card key={option.name} className="flex flex-col">
              <CardHeader className="pb-4">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <option.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl">{option.name}</CardTitle>
                <CardDescription className="text-base">{option.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-6">
                <ul className="space-y-3">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-auto w-full" variant={option.external ? "outline" : "default"} asChild>
                  {option.external ? (
                    <a href={option.href} target="_blank" rel="noopener noreferrer">{option.cta}</a>
                  ) : (
                    <Link to={option.href}>{option.cta}</Link>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-card py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Ready to Take Control of Your Client Workflow?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Spend less time on admin and more time on the work. Clientra is open
            source, so you can read the code, suggest features and contribute.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/auth">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="gap-2" asChild>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
                Star on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12">

        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={clientraLogoDark} alt="Clientra Logo" className="h-8 w-8 dark:hidden" />
              <img src={clientraLogoLight} alt="Clientra Logo" className="h-8 w-8 hidden dark:block" />
              <span className="font-semibold text-foreground">Clientra</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#get-started" className="hover:text-foreground transition-colors">Self-Host</a>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                GitHub
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Clientra. Open source under the{" "}
              <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                AGPL-3.0
              </a>{" "}
              license.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
