import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

// Cloudflare Turnstile, verified by Supabase Auth (Authentication → Attack
// Protection → Enable CAPTCHA protection). Only rendered when VITE_TURNSTILE_SITE_KEY is set.
// Tokens are single-use: call reset() after every request that used one.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")));
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Could not load the security check"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export const CAPTCHA_ENABLED = TURNSTILE_SITE_KEY !== "";

export interface CaptchaHandle {
  reset: () => void;
}

interface CaptchaProps {
  /** Called with a fresh token, or null when it expires or fails. */
  onToken: (token: string | null) => void;
}

export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha({ onToken }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current(null);
      if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    },
  }));

  useEffect(() => {
    if (!CAPTCHA_ENABLED) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          size: "flexible",
          theme: "light",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, []);

  if (!CAPTCHA_ENABLED) return null;
  return <div ref={containerRef} className="min-h-[65px] w-full" />;
});

/** Message shown when a form is submitted before the check has finished. */
export const CAPTCHA_PENDING_MESSAGE = "Please wait for the security check to finish, then try again.";

/** Supabase Auth rejects requests whose token is missing or invalid with "captcha ..." errors. */
export const CAPTCHA_ERROR = /captcha/i;

export const CAPTCHA_FAILED_MESSAGE = "The security check didn't pass. Please try again.";
