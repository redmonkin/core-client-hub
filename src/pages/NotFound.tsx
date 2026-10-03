import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import clientraLogoDark from "@/assets/clientra-dark.svg";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Helmet>
        <title>Page not found — Clientra</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-md text-center">
        <Link to="/" className="mb-10 inline-flex items-center gap-2">
          <img src={clientraLogoDark} alt="" className="h-9 w-9" />
          <span className="text-xl font-semibold text-foreground">Clientra</span>
        </Link>
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">404</p>
        <h1 className="mb-3 text-3xl font-bold text-foreground">Page not found</h1>
        <p className="mb-8 text-muted-foreground">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Button asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
