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
      const response = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      // Only a real 401 means "logged out". Any other failure (502 during a
      // deploy, Render cold start, network blip) must THROW so React Query
      // keeps the previous successful data — otherwise a transient backend
      // hiccup wipes data.user and AuthGuard bounces the user to /admin/login
      // (seen as a white flash + unexpected "refresh").
      if (response.status === 401) {
        return { user: undefined };
      }
      if (!response.ok) {
        throw new Error(`auth/me failed: ${response.status}`);
      }
      return response.json();
    },
    retry: false,
    // Re-verify when the user navigates to a new page (remount), which is a
    // safe moment to redirect — they're not mid-form. We deliberately do NOT
    // poll on an interval or refetch on window focus: the backend restarts /
    // cold-starts periodically (Render), and a background re-check landing on
    // that blip would bounce the user to /admin/login mid-form, wiping any
    // in-progress input. A dying session is caught on the next navigation.
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
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

