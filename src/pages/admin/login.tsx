import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, buildApiUrl } from "@/lib/queryClient";
import { ArrowLeft, Home } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Check if user is already logged in — redirect to dashboard
  const { data: authData } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!res.ok) return { user: undefined };
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (authData?.user) {
      setLocation("/dashboard");
    }
  }, [authData, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await fetch(buildApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Login failed" }));
        throw new Error(errorData.error || `Login failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: async (data) => {
      // Set the user data directly in the cache FIRST
      // This ensures all components see the user immediately without querying
      queryClient.setQueryData(["/api/auth/me"], {
        user: { ...data.user, ...(data.roles && data.roles.length ? { roles: data.roles } : {}) },
      });
      
      // Wait for session cookie to be fully set and propagated
      // This prevents race conditions where queries fire before cookie is ready
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.firstName}`,
      });
      
      // Wait a bit more before redirecting to ensure everything is stable
      // This gives time for the cookie to be fully set and all components to see cached data
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Back to Home Button */}
        <div className="mb-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-primary hover:bg-card flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        <div className="text-center mb-6">
          <img 
            src="/logo.png" 
            alt="Golden Luxury Auto" 
            className="h-28 sm:h-40 md:h-[200px] w-auto mx-auto object-contain mb-4 drop-shadow-[0_0_15px_rgba(234,235,128,0.5)]"
          />
          <p className="text-muted-foreground text-sm">Admin Portal Login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-card border-border text-foreground focus:border-primary focus:ring-[#D3BC8D] h-11"
              placeholder="admin@goldenluxuryauto.com"
              required
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-muted-foreground text-sm">Password</Label>
              <a
                href="/reset-password"
                className="text-xs text-blue-700 hover:underline"
              >
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-card border-border text-foreground focus:border-primary focus:ring-[#D3BC8D] h-11"
              placeholder="••••••••"
              required
              data-testid="input-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/80 font-medium h-11"
            disabled={loginMutation.isPending}
            data-testid="button-login"
          >
            {loginMutation.isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-muted-foreground text-xs mt-6">
          Premium vehicle management portal
        </p>
      </div>
    </div>
  );
}
