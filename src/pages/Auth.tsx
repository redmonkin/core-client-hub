import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
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

  // Forgot password state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingReset(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('If an account exists for that email, a reset link has been sent.');
      setForgotPasswordOpen(false);
      setForgotPasswordEmail('');
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password');
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
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupPassword !== signupConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: signupName,
          },
        },
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered');
        } else {
          toast.error(error.message);
        }
        return;
      }
      
      toast.success('Account created! Please check your email to verify.');
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Helmet>
        <title>Sign in or sign up — Clientra</title>
        <meta name="description" content="Sign in to Clientra or create a free account to manage clients, projects, proposals, and contracts." />
        <link rel="canonical" href="https://clientra.redmonk.in/auth" />
        <meta property="og:title" content="Sign in or sign up — Clientra" />
        <meta property="og:url" content="https://clientra.redmonk.in/auth" />
      </Helmet>
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12">
        <div className="flex items-center gap-3">
          <img src={clientraLogoLight} alt="Clientra Logo" className="h-10 w-10" />
          <span className="text-2xl font-bold text-primary-foreground">Clientra</span>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-primary-foreground">
            Manage your clients,<br />
            projects & contracts<br />
            in one place.
          </h1>
          <p className="text-lg text-primary-foreground/80">
            Streamline your workflow with intelligent document management,
            automated renewals, and professional templates.
          </p>
          
          <div className="grid gap-4 pt-4">
            <div className="flex items-center gap-3 text-primary-foreground/90">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                <ArrowRight className="h-4 w-4" />
              </div>
              <span>Track client relationships effortlessly</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/90">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                <ArrowRight className="h-4 w-4" />
              </div>
              <span>Generate proposals & contracts from templates</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/90">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                <ArrowRight className="h-4 w-4" />
              </div>
              <span>Never miss a contract renewal</span>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-primary-foreground/60">
          © 2024 Clientra. All rights reserved.
        </p>
      </div>
      
      {/* Right side - Auth form */}
      <div className="flex w-full flex-col items-center justify-center bg-background p-6 lg:w-1/2 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-3 lg:hidden">
            <img src={clientraLogoDark} alt="Clientra Logo" className="h-10 w-10 dark:hidden" />
            <img src={clientraLogoLight} alt="Clientra Logo" className="h-10 w-10 hidden dark:block" />
            <span className="text-2xl font-bold text-foreground">Clientra</span>
          </div>
          
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
          
          <p className="text-center text-sm text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
