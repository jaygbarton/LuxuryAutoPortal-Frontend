import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Home, LayoutDashboard, LogIn, LogOut, User } from "lucide-react";
import { authMeQueryFn, buildApiUrl, queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type UserAccountMenuProps = {
  context?: "public" | "app";
  className?: string;
};

export function UserAccountMenu({ context = "public", className }: UserAccountMenuProps) {
  const [, setLocation] = useLocation();
  const { data } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const user = data?.user;
  const isSignedIn = !!user;
  const primaryHref = context === "app" ? "/" : "/dashboard";
  const primaryLabel = context === "app" ? "Go to Home" : "Go to Dashboard";
  const PrimaryIcon = context === "app" ? Home : LayoutDashboard;
  const profileHref = user?.isEmployee
    ? "/staff/my-info"
    : user?.isClient
      ? "/profile"
      : "/admin/profile";

  const handleSignOut = async () => {
    try {
      await fetch(buildApiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } finally {
      queryClient.clear();
      setLocation(context === "app" ? "/" : "/admin/login");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border transition-all",
            "border-[#D4A017]/45 bg-white text-[#1C1C1C] shadow-[0_6px_20px_rgba(0,0,0,0.08)]",
            "hover:border-[#D4A017] hover:bg-[#FDF8EE] hover:text-[#C49000] focus:outline-none focus:ring-2 focus:ring-[#D4A017]/45",
            className,
          )}
          aria-label="Account menu"
          data-testid="button-account-menu"
        >
          <User className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {!isSignedIn ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/login" className="flex cursor-pointer items-center gap-2">
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Link>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuLabel className="truncate">
              {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={primaryHref} className="flex cursor-pointer items-center gap-2">
                <PrimaryIcon className="h-4 w-4" />
                <span>{primaryLabel}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={profileHref} className="flex cursor-pointer items-center gap-2">
                <User className="h-4 w-4" />
                <span>Go to Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="flex cursor-pointer items-center gap-2 text-red-700 focus:text-red-800"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
