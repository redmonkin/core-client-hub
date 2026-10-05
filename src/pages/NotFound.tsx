import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Backdrop } from "@/components/landing/Backdrop";
import clientraLogoDark from "@/assets/clientra-dark.svg";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <Backdrop />
      <Helmet>
        <title>Page not found — Clientra</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="relative max-w-md text-center">
        <Link to="/" className="mb-10 inline-flex items-center gap-2">
          <img src={clientraLogoDark} alt="" className="h-9 w-9" />
          <span className="text-xl font-semibold text-foreground">Clientra</span>
        </Link>
        <div aria-hidden="true" className="motion-decor mb-4 [perspective:800px]">
          <p className="animate-float select-none bg-gradient-to-b from-primary to-sky-800 bg-clip-text text-8xl font-black tracking-tighter text-transparent drop-shadow-[0_18px_24px_hsl(200_98%_39%/0.25)] [transform:rotateX(18deg)]">
            404
          </p>
        </div>
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
