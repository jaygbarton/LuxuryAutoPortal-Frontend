import { Link, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";

/** Shared phone navigation for the employee's current work, past activity, and fleet calendar. */
export function WorkScheduleNavigation({ className }: { className?: string }) {
  const [pathname] = useLocation();
  const params = new URLSearchParams(useSearch());
  const current = pathname === "/admin/trip-calendar"
    ? params.get("view") === "history" ? "history" : "calendar"
    : pathname === "/admin/operations" && [null, "day-schedule"].includes(params.get("tab")) ? "day-schedule" : null;

  return <nav aria-label="Work schedule views" className={cn("grid grid-cols-3 border-b border-border bg-background md:hidden", className)}>
    {([
      ["day-schedule", "Day Schedule", "/admin/operations?tab=day-schedule"],
      ["history", "History", "/admin/trip-calendar?view=history"],
      ["calendar", "Calendar", "/admin/trip-calendar"],
    ] as const).map(([view, title, href]) => <Link key={view} href={href} aria-current={current === view ? "page" : undefined} className={cn("flex min-h-11 items-center justify-center border-b-2 px-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", current === view ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{title}</Link>)}
  </nav>;
}
