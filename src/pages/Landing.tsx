import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  FileSignature,
  FolderKanban,
  Bell,
  Share2,
  Github,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Shield,
  Zap,
  Code2,
  Heart,
} from "lucide-react";
import clientraLogoLight from "@/assets/clientra-light.svg";
import clientraLogoDark from "@/assets/clientra-dark.svg";
import { useAuth } from "@/hooks/useAuth";

const features = [
  {
    icon: Users,
    title: "Client Management",
    description: "Organize all your client information in one place with contact details, notes, and history.",
  },
  {
    icon: FolderKanban,
    title: "Project Tracking",
    description: "Track projects from start to finish with status updates, timelines, and milestones.",
  },
  {
    icon: FileText,
    title: "Proposal Builder",
    description: "Create professional proposals with scope of work and cost breakdowns. Share via secure links.",
  },
  {
    icon: FileSignature,
    title: "Contract Management",
    description: "Manage contracts with renewal tracking and automated reminders before expiration.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Get real-time alerts when clients view or respond to proposals. Customizable preferences.",
  },
  {
    icon: Share2,
    title: "Client Portal",
    description: "Share proposals via secure, expiring links. Clients can review and approve without an account.",
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

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for freelancers just getting started",
    features: [
      "Up to 5 clients",
      "10 proposals per month",
      "Basic notifications",
      "Community support",
      "Open source access",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For growing freelancers and small teams",
    features: [
      "Unlimited clients",
      "Unlimited proposals",
      "Priority notifications",
      "Contract renewals",
      "Custom branding",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For agencies and large teams",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "API access",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
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
        <link rel="canonical" href="https://clientra.redmonk.in/" />
        <meta property="og:title" content="Clientra — Open-source client management" />
        <meta property="og:description" content="Track clients, projects, proposals, and contracts in one place. Open source and self-hostable." />
        <meta property="og:url" content="https://clientra.redmonk.in/" />
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
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-6 gap-2">
            <Github className="h-4 w-4" />
            Open Source First
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
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required • Free tier available forever
          </p>
        </div>
      </section>

      {/* Open Source Banner */}
      <section className="border-y border-border bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center">
            <div className="flex items-center gap-3">
              <Code2 className="h-6 w-6 text-primary" />
              <span className="font-medium text-foreground">100% Open Source</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-medium text-foreground">Self-Hostable</span>
            </div>
            <div className="flex items-center gap-3">
              <Heart className="h-6 w-6 text-primary" />
              <span className="font-medium text-foreground">Community Driven</span>
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

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free, upgrade when you're ready. No hidden fees, no surprises.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.popular ? "border-primary shadow-lg scale-105" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="block">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
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
            Join thousands of freelancers and agencies using Clientra to streamline
            their client management. Open source, always.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                Star on GitHub
              </Button>
            </a>
          </div>
        </div>
      </section>

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
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                GitHub
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Clientra. Open source under MIT license.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
