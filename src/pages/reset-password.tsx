import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2, Lock, Eye, EyeOff, Mail, CheckCircle } from "lucide-react";
import { checkPasswordStrength, getPasswordStrengthColor, getPasswordStrengthLabel } from "@/lib/password-strength";

function buildPasswordResetApiUrl(path: string): string {
  const url = buildApiUrl(path);
  if (/^https?:\/\//i.test(url) || typeof window === "undefined") {
    return url;
  }

  // Some mobile in-app browsers are picky about relative fetch URLs after
  // opening a link from email. Use an explicit same-origin URL for this public
  // password page so reset links work reliably from Gmail/Safari on iPhone.
  return new URL(url, window.location.origin).toString();
}

async function parsePasswordResetResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Get token from URL query string
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token")?.trim() || null;
    setToken(tokenParam);
  }, []);
  
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetRequestSent, setResetRequestSent] = useState(false);

  // Request password reset mutation
  const resetRequestMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(buildPasswordResetApiUrl("/api/auth/reset-password-request"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify({ email }),
      });
      const data = await parsePasswordResetResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }
      return data;
    },
    onSuccess: () => {
      setResetRequestSent(true);
      toast({
        title: "Email Sent",
        description: "If an account exists with this email, a password reset link has been sent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    },
  });

  // Reset password with token mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      const response = await fetch(buildPasswordResetApiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "omit",
        body: JSON.stringify({ ...data, token: data.token.trim() }),
      });
      const result = await parsePasswordResetResponse(response);
      if (!response.ok) {
        throw new Error(result.error || "Failed to reset password");
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset successfully. Please log in with your new password.",
      });
      setTimeout(() => {
        setLocation("/admin/login");
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const passwordStrength = checkPasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canResetPassword = 
    token &&
    passwordStrength.isValid &&
    passwordsMatch &&
    !resetPasswordMutation.isPending;

  const handleResetRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    resetRequestMutation.mutate(email.trim());
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canResetPassword || !token) return;

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      token,
      newPassword,
    });
  };

  // If we have a token, show reset form; otherwise show request form
  if (token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Reset Your Password
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-muted-foreground">
                  New Password *
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-background border-border text-foreground focus:border-primary pr-10"
                    placeholder="Enter your new password (min 8 characters)"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getPasswordStrengthColor(
                            passwordStrength.score
                          )}`}
                          style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {getPasswordStrengthLabel(passwordStrength.score)}
                      </span>
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <div className="text-xs space-y-1">
                        {passwordStrength.feedback.map((feedback, idx) => (
                          <div
                            key={idx}
                            className={`${
                              passwordStrength.isValid ? "text-green-700" : "text-yellow-700"
                            }`}
                          >
                            {feedback}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-muted-foreground">
                  Confirm New Password *
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-background border-border text-foreground focus:border-primary pr-10"
                    placeholder="Confirm your new password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="text-xs">
                    {passwordsMatch ? (
                      <span className="text-green-700">✓ Passwords match</span>
                    ) : (
                      <span className="text-red-700">✗ Passwords do not match</span>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={!canResetPassword}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>

              <div className="text-center">
                <a
                  href="/admin/login"
                  className="text-sm text-blue-700 hover:underline"
                >
                  Back to Login
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Request password reset form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-primary/20">
        <CardHeader>
          <CardTitle className="text-primary flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Reset Password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetRequestSent ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="w-16 h-16 text-green-700 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Check Your Email</h3>
                <p className="text-muted-foreground">
                  If an account exists with <strong>{email}</strong>, we've sent a password reset link.
                </p>
                <p className="text-sm text-muted-foreground">
                  The link will expire in 1 hour.
                </p>
              </div>
              <Button
                onClick={() => {
                  setResetRequestSent(false);
                  setEmail("");
                }}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/80"
              >
                Send Another Email
              </Button>
              <div className="text-center">
                <a
                  href="/admin/login"
                  className="text-sm text-blue-700 hover:underline"
                >
                  Back to Login
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-muted-foreground">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background border-border text-foreground focus:border-primary"
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={!email.trim() || resetRequestMutation.isPending}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetRequestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Reset Link
                  </>
                )}
              </Button>

              <div className="text-center">
                <a
                  href="/admin/login"
                  className="text-sm text-blue-700 hover:underline"
                >
                  Back to Login
                </a>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
