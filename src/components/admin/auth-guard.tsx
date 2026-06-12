import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAuthenticated, setHasAuthenticated] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const { data, isLoading, isError, error, isFetching } = useQuery<{ user?: { id?: number; email?: string; isAdmin?: boolean; isClient?: boolean; isEmployee?: boolean } }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const { buildApiUrl } = await import("@/lib/queryClient");
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
        if (!response.ok) {
          // 401 is expected when not authenticated - don't log as error
          if (response.status === 401) {
            return { user: undefined };
          }
          // For other errors, still return undefined but don't throw
          return { user: undefined };
        }
        return response.json();
      } catch (error) {
        // Silently handle network errors
        return { user: undefined };
      }
    },
    retry: false,
    // Keep the "fresh" window short so a server-side session invalidation
    // (redeploy, expiry, manual logout in another tab) actually surfaces as
    // a redirect-to-login instead of the cached "you're logged in" answer
    // hanging around for 5 minutes. We've hit this in practice — the UI
    // showed "Cathy (Admin)" while every API call returned 401 because
    // /api/auth/me's cached result was still trusted.
    staleTime: 1000 * 30,
    // Always re-verify on mount and when the user tabs back in — cheap call
    // and lets a stale session redirect us out quickly.
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Background polling so a session that dies while the page is open also
    // gets caught within a minute, not when the user happens to navigate.
    refetchInterval: 1000 * 60,
  });

  useEffect(() => {
    // Handle initial authentication check
    // Add a delay to allow session cookie to be fully set after login redirect
    if (!isLoading && !initialLoadComplete) {
      // Wait for session to stabilize after login redirect
      // This prevents false negatives when the cookie hasn't been set yet
      const timer = setTimeout(() => {
        setInitialLoadComplete(true);
        
        // Check if we have a user in the data
        if (data?.user) {
          // User is authenticated on initial load
          setHasAuthenticated(true);
          setIsChecking(false);
        } else {
          // No user found - but this might be a race condition
          // Wait a bit more and check again before redirecting
          setTimeout(() => {
            // Re-check the query data - it might have updated by now
            // We'll check again in the next effect cycle
            if (!data?.user) {
              // Still no user after waiting - redirect to login
              setLocation("/admin/login");
            }
          }, 800);
        }
      }, 500); // Wait 500ms before initial check to allow session to stabilize
      
      return () => clearTimeout(timer);
    }
    
    // After initial load is complete, handle authentication state changes
    if (initialLoadComplete && !isLoading && !isFetching) {
      if (data?.user) {
        // We have a user - mark as authenticated
        if (!hasAuthenticated) {
          setHasAuthenticated(true);
          setIsChecking(false);
        }
      } else if (!data?.user && hasAuthenticated) {
        // User was authenticated but now session is gone
        // This handles actual session expiration
        // Add a delay to prevent false positives from race conditions
        const timer = setTimeout(() => {
          // Double-check that we still don't have a user
          // The query might have updated by now
          if (!data?.user) {
            setLocation("/admin/login");
          }
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, isFetching, isError, data, setLocation, hasAuthenticated, initialLoadComplete]);

  // Only block rendering on the very first load (no cached data yet).
  // Background refetches (window focus, 60s interval, remounts) set isFetching
  // but not isLoading — we must NOT show a spinner for those or the page flashes
  // white every time the user switches tabs or a route change triggers a remount.
  if (isLoading && !hasAuthenticated) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

