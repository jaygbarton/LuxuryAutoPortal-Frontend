import { useLocation } from "wouter";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import SignContract from "@/pages/sign-contract";
import { useEffect, useRef } from "react";

export default function NotFound() {
  const [location, setLocation] = useLocation();
  const previousLocationRef = useRef<string | null>(null);

  useEffect(() => {
    // Store the referrer (previous page) when component mounts
    const referrer = document.referrer;
    if (referrer) {
      try {
        const referrerUrl = new URL(referrer);
        const currentUrl = new URL(window.location.href);
        
        // Only store if referrer is from the same origin
        if (referrerUrl.origin === currentUrl.origin) {
          previousLocationRef.current = referrerUrl.pathname + referrerUrl.search;
        }
      } catch (e) {
        // Invalid URL, ignore
      }
    }
    
    // Also try to get from sessionStorage (set by router or other components)
    const storedPrevious = sessionStorage.getItem("previousLocation");
    if (storedPrevious && !previousLocationRef.current) {
      previousLocationRef.current = storedPrevious;
    }
  }, []);

  // Check if this is actually a sign-contract route
  // Sometimes routes don't match correctly, so we check the URL directly
  if (location.startsWith("/sign-contract/")) {
    return <SignContract />;
  }

  const handleBack = () => {
    // Priority 1: Use stored previous location from referrer (most reliable)
    if (previousLocationRef.current && previousLocationRef.current !== location) {
      setLocation(previousLocationRef.current);
      return;
    }
    
    // Priority 2: Try browser history back
    // This will navigate to the previous page in browser history
    try {
      window.history.back();
    } catch (e) {
      // If history.back() fails, fall back to home
      setLocation("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-[#D3BC8D]/10 flex items-center justify-center mx-auto mb-8">
          <Construction className="w-10 h-10 text-primary" />
        </div>
        <h1 className="font-serif text-4xl lg:text-6xl font-light text-foreground mb-4">
          Under Development
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          This page is currently under development
        </p>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          We're working hard to bring you this feature. Please check back soon!
        </p>
        <Button 
          onClick={handleBack}
          size="lg" 
          className="bg-primary text-primary-foreground hover:bg-primary/80"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
      </div>
    </div>
  );
}
