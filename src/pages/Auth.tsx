import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Eye, EyeOff, Mail, Lock, User, Loader2, Check, CheckCircle2, FileText, Github, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import clientraLogoLight from '@/assets/clientra-light.svg';
import clientraLogoDark from '@/assets/clientra-dark.svg';
import { CONTACT_EMAIL, REPO_URL, SITE_URL } from '@/lib/site';
import { Backdrop } from '@/components/landing/Backdrop';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PASSWORD_HINT, checkNewPassword } from '@/lib/password-policy';
import {
  CAPTCHA_ENABLED,
  CAPTCHA_ERROR,
  CAPTCHA_FAILED_MESSAGE,
  CAPTCHA_PENDING_MESSAGE,
  Captcha,
  type CaptchaHandle,
} from '@/components/auth/Captcha';

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Free sign-ups are capped (app_settings.max_workspaces). People invited to
  // an existing workspace can still sign up, so the form stays usable.
  const [signupsOpen, setSignupsOpen] = useState(true);
  useEffect(() => {
    supabase.rpc('free_signups_open').then(({ data, error }) => {
      if (!error && data === false) setSignupsOpen(false);
    });
  }, []);

  // CAPTCHA tokens (single-use), one widget per form.
  const [loginCaptcha, setLoginCaptcha] = useState<string | null>(null);
  const [signupCaptcha, setSignupCaptcha] = useState<string | null>(null);
  const [resetCaptcha, setResetCaptcha] = useState<string | null>(null);
  const loginCaptchaRef = useRef<CaptchaHandle>(null);
  const signupCaptchaRef = useRef<CaptchaHandle>(null);
  const resetCaptchaRef = useRef<CaptchaHandle>(null);

  // Forgot password state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    // The dialog is rendered inside the sign-in form, and React bubbles the
    // submit through the portal to it; don't also attempt a sign-in.
    e.stopPropagation();
    if (CAPTCHA_ENABLED && !resetCaptcha) {
      toast.error(CAPTCHA_PENDING_MESSAGE);
      return;
    }
    setIsSendingReset(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: redirectUrl,
        captchaToken: resetCaptcha ?? undefined,
      });

      if (error) {
        toast.error(CAPTCHA_ERROR.test(error.message) ? CAPTCHA_FAILED_MESSAGE : error.message);
        return;
      }

      toast.success('If an account exists for that email, a reset link has been sent.');
      setForgotPasswordOpen(false);
      setForgotPasswordEmail('');
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      resetCaptchaRef.current?.reset();
      setIsSendingReset(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (CAPTCHA_ENABLED && !loginCaptcha) {
      toast.error(CAPTCHA_PENDING_MESSAGE);
      return;
    }
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
        options: { captchaToken: loginCaptcha ?? undefined },
      });
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password');
        } else if (CAPTCHA_ERROR.test(error.message)) {
          toast.error(CAPTCHA_FAILED_MESSAGE);
        } else {
          toast.error(error.message);
        }
        return;
      }
      
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      loginCaptchaRef.current?.reset();
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupPassword !== signupConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (CAPTCHA_ENABLED && !signupCaptcha) {
      toast.error(CAPTCHA_PENDING_MESSAGE);
      return;
    }
    
    setIsLoading(true);

    try {
      const passwordError = await checkNewPassword(signupPassword);
      if (passwordError) {
        toast.error(passwordError);
        return;
      }

      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          captchaToken: signupCaptcha ?? undefined,
          emailRedirectTo: redirectUrl,
          data: {
            full_name: signupName,
          },
        },
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered');
          return;
        }
        if (CAPTCHA_ERROR.test(error.message)) {
          toast.error(CAPTCHA_FAILED_MESSAGE);
          return;
        }
        // The seat limit is enforced by a database trigger, which Supabase
        // reports as a generic "Database error saving new user".
        const { data: open } = await supabase.rpc('free_signups_open');
        if (open === false) {
          setSignupsOpen(false);
          toast.error('Free access is full right now. Please contact us to get access.');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('Account created! Please check your email to verify.');
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      signupCaptchaRef.current?.reset();
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Helmet>
        <title>Sign in or sign up — Clientra</title>
        <meta name="description" content="Sign in to Clientra or create a free account to manage clients, projects, proposals, and contracts." />
        <link rel="canonical" href={`${SITE_URL}/auth`} />
        <meta property="og:title" content="Sign in or sign up — Clientra" />
        <meta property="og:url" content={`${SITE_URL}/auth`} />
      </Helmet>
      {/* Left side - Branding */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-sky-600 to-sky-800 p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <Backdrop tone="light" className="opacity-60" />
        <Link to="/" className="relative flex w-fit items-center gap-3">
          <img src={clientraLogoLight} alt="" className="h-10 w-10" />
          <span className="text-2xl font-bold text-white">Clientra</span>
        </Link>

        <div className="relative space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
              Welcome to a calmer
              <br />
              client workflow.
            </h1>
            <p className="max-w-md text-lg text-white/80">
              Clients, proposals, contracts and invoices in one place. Open source,
              and secure by default.
            </p>
          </div>

          {/* Floating preview cards */}
          <div aria-hidden="true" className="motion-decor relative h-48 max-w-lg [perspective:1200px]">
            <div className="preserve-3d absolute inset-0 [transform:rotateX(14deg)_rotateY(-14deg)]">
              <div className="absolute left-0 top-0 w-60 animate-float rounded-xl bg-white/95 p-4 text-slate-900 shadow-2xl" style={{ '--z': '30px' } as CSSProperties}>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                  <FileText className="h-3.5 w-3.5 text-primary" /> Proposal · Website redesign
                </div>
                <div className="mb-3 space-y-1.5">
                  <div className="h-1.5 w-full rounded bg-slate-200" />
                  <div className="h-1.5 w-4/5 rounded bg-slate-200" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">₹1,20,000</span>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Approved
                  </span>
                </div>
              </div>
              <div className="absolute right-0 top-[5.5rem] w-52 animate-float-slow rounded-xl border border-white/30 bg-white/15 p-3 text-white shadow-2xl backdrop-blur-md" style={{ '--z': '80px', animationDelay: '-2s' } as CSSProperties}>
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-white/80">
                  <ShieldCheck className="h-3.5 w-3.5" /> Secure client link
                </div>
                <p className="text-sm font-semibold">Password-protected · expires in 14 days</p>
              </div>
            </div>
          </div>

          <ul className="grid gap-3">
            {[
              'Your workspace is isolated at the database level',
              'Clients approve and sign without creating an account',
              'Free and open source — host it yourself any time',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-white/90">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <Check className="h-4 w-4" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 text-sm text-white/70">
          <p>© {new Date().getFullYear()} Clientra · AGPL-3.0</p>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-white">
            <Github className="h-4 w-4" /> View the code
          </a>
        </div>
      </div>
      
      {/* Right side - Auth form */}
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-background p-6 lg:w-1/2 lg:p-12">
        <Backdrop className="opacity-70 lg:opacity-40" />
        <div className="relative w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <Link to="/" className="flex items-center justify-center gap-3 lg:hidden">
            <img src={clientraLogoDark} alt="" className="h-10 w-10 dark:hidden" />
            <img src={clientraLogoLight} alt="" className="h-10 w-10 hidden dark:block" />
            <span className="text-2xl font-bold text-foreground">Clientra</span>
          </Link>
          
          <Card className="border-0 shadow-lg lg:border lg:shadow-sm">
            <CardHeader className="space-y-1 pb-4 text-center">
              <CardTitle className="text-2xl font-bold">Welcome</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="name@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          aria-label="Toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                            >
                              Forgot password?
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reset your password</DialogTitle>
                              <DialogDescription>
                                Enter the email address associated with your account and we'll send you a link to reset your password.
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="forgot-password-email">Email</Label>
                                <div className="relative">
                                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    id="forgot-password-email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={forgotPasswordEmail}
                                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                                    className="pl-10"
                                    required
                                  />
                                </div>
                              </div>
                              <Captcha ref={resetCaptchaRef} onToken={setResetCaptcha} />
                              <DialogFooter>
                                <Button type="submit" className="w-full" disabled={isSendingReset}>
                                  {isSendingReset ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    'Send reset link'
                                  )}
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <Captcha ref={loginCaptchaRef} onToken={setLoginCaptcha} />
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  {!signupsOpen && (
                    <Alert className="mb-4">
                      <AlertTitle>Free access is full</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>
                          We have limited seats for free access. Please{' '}
                          {CONTACT_EMAIL ? (
                            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Clientra access')}`} className="font-medium text-primary underline underline-offset-4">
                              contact us
                            </a>
                          ) : (
                            'contact us'
                          )}{' '}
                          to get access.
                        </p>
                        <p className="text-xs">Invited to a team? You can still sign up with the email address the invite was sent to.</p>
                      </AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="John Doe"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="name@example.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          aria-label="Toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="signup-confirm"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <Captcha ref={signupCaptchaRef} onToken={setSignupCaptcha} />
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Secured with database-level access rules ·{' '}
            <Link to="/" className="underline-offset-4 hover:text-foreground hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
