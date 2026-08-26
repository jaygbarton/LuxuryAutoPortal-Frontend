import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { TimezonePreferenceCard } from "@/components/shared/TimezonePreferenceCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";
import { checkPasswordStrength, getPasswordStrengthColor, getPasswordStrengthLabel } from "@/lib/password-strength";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Save, ShieldCheck, User } from "lucide-react";

/**
 * The admin's own account page — distinct from /admin/settings, which is
 * org-wide config (Slack channels, sales reps) that every role's "Settings"
 * nav item still points to. Cathy: "Go to Profile" landed on that config
 * page instead of anything about her own account.
 */
export default function AdminProfilePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: userData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    retry: false,
  });
  const user = userData?.user;

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordUpdateMutation = useMutation({
    mutationFn: async (data: { oldPassword: string; newPassword: string }) => {
      const response = await fetch(buildApiUrl("/api/auth/update-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update password");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password updated successfully. Please log in again.",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setLocation("/admin/login"), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    },
  });

  const passwordStrength = checkPasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmitPassword =
    oldPassword.length > 0 &&
    passwordStrength.isValid &&
    passwordsMatch &&
    !passwordUpdateMutation.isPending;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    passwordUpdateMutation.mutate({ oldPassword, newPassword });
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground mb-2 leading-tight">My Profile</h1>
          <p className="text-muted-foreground">Your account details and security</p>
        </div>

        <Card className="bg-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <User className="w-5 h-5" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Name</span>
                <span className="text-foreground font-medium">{fullName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Email</span>
                <span className="text-foreground">{user?.email || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Role</span>
                <span className="text-foreground">{user?.roleName || (user?.isAdmin ? "Admin" : "—")}</span>
              </div>
              {user?.isSuperAdmin && (
                <div>
                  <span className="text-muted-foreground block mb-1">Access</span>
                  <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Super Admin
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <TimezonePreferenceCard />

        <Card className="bg-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Account Security
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="old-password" className="text-muted-foreground">
                  Current Password *
                </Label>
                <div className="relative">
                  <Input
                    id="old-password"
                    type={showOldPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="bg-background border-border text-foreground focus:border-primary pr-10"
                    placeholder="Enter your current password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

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
                            className={`flex items-center gap-1 ${
                              passwordStrength.isValid ? "text-green-700" : "text-yellow-700"
                            }`}
                          >
                            <AlertCircle className="w-3 h-3" />
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
                  <div className="text-xs flex items-center gap-1">
                    {passwordsMatch ? (
                      <span className="text-green-700">✓ Passwords match</span>
                    ) : (
                      <span className="text-red-700">✗ Passwords do not match</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                <Button
                  type="submit"
                  disabled={!canSubmitPassword}
                  className="bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {passwordUpdateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Update Password
                    </>
                  )}
                </Button>
                <a href="/reset-password" className="text-sm text-blue-700 hover:underline">
                  Forgot your password?
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <AdminPageLinks />
    </AdminLayout>
  );
}
