import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LandingContent } from "@/components/landing/LandingContent";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  // Show the page while the session loads (rather than a spinner) so it
  // replaces the pre-rendered HTML without a flash; signed-in users are sent
  // on to the dashboard as soon as their session is known.
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingContent />;
}
