import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2, Save, Slack, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { checkPasswordStrength, getPasswordStrengthColor, getPasswordStrengthLabel } from "@/lib/password-strength";

interface SlackChannelConfig {
  id: number;
  formType: "lyc" | "car_onboarding" | "car_offboarding" | "employee_onboarding" | "employee_time_in_out" | "expense_income" | "expense_direct_delivery" | "expense_cogs" | "expense_reimbursed_bills";
  channelId: string;
  channelName: string | null;
  updatedAt: string;
}

const formTypeLabels: Record<string, string> = {
  lyc: "Client Onboarding Form (LYC)",
  car_onboarding: "Car On-boarding",
  car_offboarding: "Car Off-boarding",
  employee_onboarding: "Employee Onboarding",
  employee_time_in_out: "Employee Arrival/Departure",
  expense_income: "Income",
  expense_direct_delivery: "Expenses - Direct Delivery",
  expense_cogs: "Expenses - COGS",
  expense_reimbursed_bills: "Reimbursed & Non-Reimbursed Bills",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [editingChannels, setEditingChannels] = useState<Record<string, string>>({});
  
  // Password change form state
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Get current user to check if admin
  const { data: userData } = useQuery<{
    user?: {
      isAdmin?: boolean;
    };
  }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  const isAdmin = userData?.user?.isAdmin === true;

  // Fetch Slack channel configurations and bot token status (only for admins)
  const { data: channelsData, isLoading } = useQuery<{
    success: boolean;
    data: SlackChannelConfig[];
    slackBotTokenConfigured?: boolean;
    slackBotToken?: string | null;
    slackBotTokenUpdatedAt?: string | null;
  }>({
    queryKey: ["/api/settings/slack-channels"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/settings/slack-channels"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch Slack channel configurations");
      }
      return response.json();
    },
    enabled: isAdmin, // Only fetch if user is admin
  });

  const slackBotTokenConfigured = channelsData?.slackBotTokenConfigured === true;
  const slackBotTokenValue = channelsData?.slackBotToken ?? "";
  const [editingBotToken, setEditingBotToken] = useState(false);
  const [slackBotToken, setSlackBotToken] = useState("");

  const saveSlackBotTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch(buildApiUrl("/api/settings/slack-bot-token"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ botToken: token }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save Slack bot token");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/slack-channels"] });
      setSlackBotToken("");
      setEditingBotToken(false);
      toast({
        title: "Success",
        description: "Slack bot token saved. All Slack notifications will use this token.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCancelBotToken = () => {
    setEditingBotToken(false);
    setSlackBotToken("");
  };

  // Update channel mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { formType: string; channelId: string; channelName?: string }) => {
      const response = await fetch(buildApiUrl("/api/settings/slack-channels"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update Slack channel");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/slack-channels"] });
      toast({
        title: "Success",
        description: "Slack channel configuration updated successfully",
      });
      setEditingChannels({});
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update Slack channel configuration",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (formType: string, currentChannelId: string) => {
    setEditingChannels((prev) => ({
      ...prev,
      [formType]: currentChannelId,
    }));
  };

  const handleSave = (config: SlackChannelConfig) => {
    const newChannelId = editingChannels[config.formType] || config.channelId;
    if (newChannelId === config.channelId) {
      setEditingChannels((prev) => {
        const updated = { ...prev };
        delete updated[config.formType];
        return updated;
      });
      return;
    }
    updateMutation.mutate({
      formType: config.formType,
      channelId: newChannelId,
      channelName: config.channelName || undefined,
    });
  };

  const handleCancel = (formType: string) => {
    setEditingChannels((prev) => {
      const updated = { ...prev };
      delete updated[formType];
      return updated;
    });
  };

  // Password change mutation
  const passwordUpdateMutation = useMutation({
    mutationFn: async (data: { oldPassword: string; newPassword: string }) => {
      const response = await fetch(buildApiUrl("/api/auth/update-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      // Reset form
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Redirect to login after a delay
      setTimeout(() => {
        setLocation("/admin/login");
      }, 2000);
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
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    passwordUpdateMutation.mutate({
      oldPassword,
      newPassword,
    });
  };

  if (isLoading && isAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const channels = channelsData?.data || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        {/* Account Security - Password Change */}
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

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="submit"
                  disabled={!canSubmitPassword}
                  className="bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <a
                  href="/reset-password"
                  className="text-sm text-blue-700 hover:underline"
                >
                  Forgot your password?
                </a>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Slack Channel Configuration - Admin Only */}
        {isAdmin && (
          <>
            <Card className="bg-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Slack className="w-5 h-5" />
                Slack Channel Configuration
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure which Slack channels receive notifications for each form type. Each form type can have its own dedicated channel.
              </CardDescription>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span><strong>Income &amp; Expense Receipts:</strong> For Slack notifications to appear when an employee submits an Income &amp; Expense Receipt, set the <strong>Slack Bot Token</strong> below and a <strong>Slack Channel ID</strong> for each category (Income, Direct Delivery, COGS, Reimbursed Bills). Invite the bot to those channels in Slack.</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
            {(!slackBotTokenConfigured || channels.some((c) => ["expense_income", "expense_direct_delivery", "expense_cogs", "expense_reimbursed_bills"].includes(c.formType) && !(c.channelId && c.channelId.trim()))) && (
              <div className="p-3 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  {!slackBotTokenConfigured && <p className="font-medium">Slack Bot Token is not set.</p>}
                  {channels.some((c) => ["expense_income", "expense_direct_delivery", "expense_cogs", "expense_reimbursed_bills"].includes(c.formType) && !(c.channelId && c.channelId.trim())) && (
                    <p className={slackBotTokenConfigured ? "mt-1" : "mt-1"}>One or more Income &amp; Expense channel IDs are missing. Set a Channel ID for each category so receipts post to the correct channel.</p>
                  )}
                  <p className="mt-1">Retest after saving: submit an Income &amp; Expense Receipt from an employee account and confirm the notification appears in the configured Slack channel(s).</p>
                </div>
              </div>
            )}
            {/* Slack Bot Token - same edit pattern as Slack Channel ID */}
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Label className="text-foreground font-medium text-lg flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Slack Bot Token
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    All Slack notifications use this token. Get a Bot User OAuth Token from your Slack app (starts with <code className="bg-muted px-1 rounded">xoxb-</code>).
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="slack-bot-token" className="text-muted-foreground text-sm">
                    Bot Token
                  </Label>
                  {editingBotToken ? (
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="slack-bot-token"
                        type="password"
                        value={slackBotToken}
                        onChange={(e) => setSlackBotToken(e.target.value)}
                        placeholder="e.g. xoxb-..."
                        className="max-w-md bg-background border-border text-foreground focus:border-primary font-mono text-sm"
                        autoComplete="off"
                      />
                      <Button
                        onClick={() => {
                          const t = slackBotToken.trim();
                          if (!t) {
                            toast({
                              title: "Error",
                              description: "Enter a Slack bot token to save",
                              variant: "destructive",
                            });
                            return;
                          }
                          saveSlackBotTokenMutation.mutate(t);
                        }}
                        disabled={saveSlackBotTokenMutation.isPending || !slackBotToken.trim()}
                        className="bg-primary text-primary-foreground hover:bg-primary/80"
                        size="sm"
                      >
                        {saveSlackBotTokenMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        onClick={handleCancelBotToken}
                        variant="outline"
                        size="sm"
                        className="border-border text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        id="slack-bot-token"
                        type="text"
                        value={slackBotTokenValue}
                        readOnly
                        placeholder="Not set"
                        className="max-w-md bg-background border-border text-foreground font-mono text-sm"
                        title="Slack bot token (exact value)"
                      />
                      <Button
                        onClick={() => setEditingBotToken(true)}
                        variant="outline"
                        size="sm"
                        className="border-border text-muted-foreground hover:bg-muted"
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
                {slackBotTokenConfigured && channelsData?.slackBotTokenUpdatedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last updated: {new Date(channelsData.slackBotTokenUpdatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {channels.map((config) => {
              const isEditing = editingChannels.hasOwnProperty(config.formType);
              const editingValue = editingChannels[config.formType] || config.channelId;

              return (
                <div
                  key={config.formType}
                  className="p-4 border border-border rounded-lg bg-card"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Label className="text-foreground font-medium text-lg">
                        {formTypeLabels[config.formType] || config.formType}
                      </Label>
                      {config.channelName && (
                        <p className="text-sm text-muted-foreground mt-1">{config.channelName}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`channel-${config.formType}`} className="text-muted-foreground text-sm">
                        Slack Channel ID
                      </Label>
                      {isEditing ? (
                        <div className="flex gap-2 mt-2">
                          <Input
                            id={`channel-${config.formType}`}
                            value={editingValue}
                            onChange={(e) =>
                              setEditingChannels((prev) => ({
                                ...prev,
                                [config.formType]: e.target.value,
                              }))
                            }
                            className="bg-background border-border text-foreground focus:border-primary"
                            placeholder="C08N5U77HSS or paste full Slack channel URL"
                          />
                          <Button
                            onClick={() => handleSave(config)}
                            disabled={updateMutation.isPending}
                            className="bg-primary text-primary-foreground hover:bg-primary/80"
                            size="sm"
                          >
                            {updateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            onClick={() => handleCancel(config.formType)}
                            variant="outline"
                            size="sm"
                            className="border-border text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            value={config.channelId}
                            readOnly
                            className="bg-background border-border text-muted-foreground"
                          />
                          <Button
                            onClick={() => handleEdit(config.formType, config.channelId)}
                            variant="outline"
                            size="sm"
                            className="border-border text-muted-foreground hover:bg-muted"
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(config.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}

            {channels.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No Slack channel configurations found.</p>
                <p className="text-sm mt-2">Channels will be initialized on first use.</p>
              </div>
            )}
            </CardContent>
          </Card>

          <Card className="bg-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">How to Get Slack Channel ID</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <ol className="list-decimal list-inside space-y-2">
                <li>Open Slack and navigate to the channel you want to use</li>
                <li>Click on the channel name at the top</li>
                <li>Scroll down to find the &quot;Channel ID&quot; (starts with &quot;C&quot;) or copy the channel URL from the browser</li>
                <li>Paste the Channel ID (e.g. C08N5U77HSS) or the full URL in the field above—both work</li>
              </ol>
              <p className="text-sm text-muted-foreground mt-4">
                Note: Make sure your Slack bot has been invited to the channel before notifications can be sent.
              </p>
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

