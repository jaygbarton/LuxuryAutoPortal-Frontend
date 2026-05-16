import React, {
  useState,
  useMemo,
  useEffect,
  createContext,
  useContext,
} from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Car,
  DollarSign,
  Calculator,
  ClipboardList,
  Key,
  Briefcase,
  CreditCard,
  Settings,
  BookOpen,
  GraduationCap,
  Star,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  FileText,
  Clock,
  MessageCircle,
  Cog,
  RefreshCw,
  Mail,
  MapPin,
  Navigation,
  Cpu,
  BarChart3,
  Route,
  ShieldAlert,
  Eye,
  TreePalm,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { ViewAsClientBanner } from "./ViewAsClientBanner";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient, buildApiUrl } from "@/lib/queryClient";
import { AuthGuard } from "./auth-guard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface SidebarItem {
  href: string;
  label: string;
  icon: any;
  roles?: ("admin" | "client" | "employee")[];
  children?: SidebarItem[];
}

const allSidebarItems: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  // Client-only profile link for logged-in clients
  { href: "/profile", label: "Profile", icon: User, roles: ["client"] },
  {
    href: "/client/my-car-tracking",
    label: "Track My Car",
    icon: Navigation,
    roles: ["client"],
  },
  { href: "/admin/admins", label: "Admins", icon: Users, roles: ["admin"] },
  { href: "/admin/clients", label: "Clients", icon: Users, roles: ["admin"] },
  { href: "/cars", label: "Cars", icon: Car, roles: ["admin", "client"] },
  {
    href: "/admin/income-expenses",
    label: "Income and Expenses",
    icon: DollarSign,
    roles: ["admin"],
  },
  {
    href: "/admin/payments",
    label: "Client Payments",
    icon: CreditCard,
    roles: ["admin"],
    children: [
      {
        href: "/admin/payments",
        label: "Payments",
        icon: CreditCard,
        roles: ["admin"],
      },
      {
        href: "/admin/payment-status",
        label: "Status",
        icon: ClipboardList,
        roles: ["admin"],
      },
    ],
  },
  {
    href: "/admin/totals",
    label: "Totals",
    icon: Calculator,
    roles: ["admin"],
  },
  {
    href: "/admin/turo-trips",
    label: "Turo Trips",
    icon: Mail,
    roles: ["admin"],
  },
  {
    href: "/admin/bouncie",
    label: "BOUNCIE",
    icon: MapPin,
    roles: ["admin"],
    children: [
      {
        href: "/admin/bouncie",
        label: "Fleet Tracking",
        icon: Navigation,
        roles: ["admin"],
      },
      {
        href: "/admin/bouncie-devices",
        label: "Devices",
        icon: Cpu,
        roles: ["admin"],
      },
      {
        href: "/admin/bouncie-trips",
        label: "Trip History",
        icon: Route,
        roles: ["admin"],
      },
      {
        href: "/admin/bouncie-behavior",
        label: "Driving Behavior",
        icon: ShieldAlert,
        roles: ["admin"],
      },
      {
        href: "/admin/bouncie-geofence",
        label: "Geofence",
        icon: MapPin,
        roles: ["admin"],
      },
      {
        href: "/admin/bouncie-analytics",
        label: "Analytics",
        icon: BarChart3,
        roles: ["admin"],
      },
    ],
  },
  {
    href: "/admin/operations",
    label: "Operations",
    icon: Cog,
    roles: ["admin"],
  },
  {
    href: "/admin/forms",
    label: "Forms",
    icon: ClipboardList,
    roles: ["admin", "client"],
  },
  {
    href: "/admin/car-rental",
    label: "Car Rental",
    icon: Key,
    roles: ["admin"],
  },
  {
    href: "/admin/hr",
    label: "Human Resources",
    icon: Briefcase,
    roles: ["admin"],
    children: [
      {
        href: "/admin/hr/employees",
        label: "Employees",
        icon: Users,
        roles: ["admin"],
      },
      {
        href: "/admin/hr/work-schedule",
        label: "Work Schedule",
        icon: Clock,
        roles: ["admin"],
      },
      {
        href: "/admin/hr/task-management",
        label: "Task Management",
        icon: Briefcase,
        roles: ["admin"],
      },
      { href: "/admin/hr/time", label: "Time", icon: Clock, roles: ["admin"] },
      {
        href: "/admin/hr/time-off",
        label: "Time Off",
        icon: Clock,
        roles: ["admin"],
      },
      {
        href: "/admin/hr/report",
        label: "Report",
        icon: ClipboardList,
        roles: ["admin"],
      },
    ],
  },
  {
    href: "/admin/payroll",
    label: "Payroll",
    icon: DollarSign,
    roles: ["admin"],
    children: [
      {
        href: "/admin/payroll",
        label: "Pay Run",
        icon: DollarSign,
        roles: ["admin"],
      },
      {
        href: "/admin/payroll/commissions",
        label: "Commissions",
        icon: DollarSign,
        roles: ["admin"],
      },
    ],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    roles: ["admin", "client"],
  },
  {
    href: "/admin/turo-guide",
    label: "Turo Guide",
    icon: BookOpen,
    roles: ["admin", "client"],
  },
  {
    href: "/admin/training-manual",
    label: "System Tutorial",
    icon: GraduationCap,
    roles: ["admin"],
  },
  {
    href: "/tutorial",
    label: "System Tutorial",
    icon: GraduationCap,
    roles: ["client"],
  },
  {
    href: "/admin/testimonials",
    label: "Client Testimonials",
    icon: Star,
    roles: ["admin", "client"],
  },
  {
    href: "/admin/view-as-employee",
    label: "View as Employee",
    icon: Eye,
    roles: ["admin"],
  },
  {
    href: "/admin/view-as-client",
    label: "View as Client",
    icon: Eye,
    roles: ["admin"],
  },
];

// Staff/employee sidebar: Dashboard, My Info, Forms, Task Management, Turo Guide, System Tutorial, Client Testimonials, Car Rental
const employeeSidebarItems: SidebarItem[] = [
  {
    href: "/staff/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["employee"],
  },
  {
    href: "/staff/time",
    label: "Time Sheet",
    icon: Clock,
    roles: ["employee"],
  },
  {
    href: "/staff/time-off",
    label: "Time Off",
    icon: TreePalm,
    roles: ["employee"],
  },
  { href: "/staff/my-info", label: "My Info", icon: User, roles: ["employee"] },
  { href: "/staff/forms", label: "Forms", icon: FileText, roles: ["employee"] },
  {
    href: "/staff/task-management",
    label: "Task Management",
    icon: Briefcase,
    roles: ["employee"],
  },
  {
    href: "/admin/operations",
    label: "Operations",
    icon: Briefcase,
    roles: ["employee"],
  },
  {
    href: "/admin/bouncie",
    label: "BOUNCIE",
    icon: Navigation,
    roles: ["employee"],
    children: [
      {
        href: "/admin/bouncie",
        label: "Fleet Tracking",
        icon: Navigation,
        roles: ["employee"],
      },
      {
        href: "/admin/bouncie-trips",
        label: "Trip History",
        icon: Route,
        roles: ["employee"],
      },
    ],
  },
  {
    href: "/staff/turo-guide",
    label: "Turo Guide",
    icon: BookOpen,
    roles: ["employee"],
  },
  {
    href: "/staff/training-manual",
    label: "System Tutorial",
    icon: GraduationCap,
    roles: ["employee"],
  },
  {
    href: "/staff/client-testimonials",
    label: "Client Testimonials",
    icon: MessageCircle,
    roles: ["employee"],
  },
  {
    href: "/staff/car-rental",
    label: "Car Rental",
    icon: Car,
    roles: ["employee"],
    children: [
      {
        href: "/staff/car-rental/trips",
        label: "Trips",
        icon: Car,
        roles: ["employee"],
      },
      {
        href: "/staff/car-rental/forms",
        label: "Forms",
        icon: FileText,
        roles: ["employee"],
      },
    ],
  },
];

interface RoleOption {
  id: number;
  name: string;
  isAdmin: boolean;
  isEmployee: boolean;
  isClient: boolean;
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [switching, setSwitching] = useState(false);

  const [expandedParents, setExpandedParents] = useState<
    Record<string, boolean>
  >(() => {
    const obj: Record<string, boolean> = {};
    const matches = (pathname: string, href: string) => {
      if (pathname === href) return true;
      if (href === "/dashboard") return false;
      return pathname.startsWith(href + "/");
    };
    [...allSidebarItems, ...employeeSidebarItems].forEach((it) => {
      if (it.children && it.children.length > 0) {
        obj[it.href] = it.children.some((c) => matches(location, c.href));
      }
    });
    return obj;
  });

  const toggleExpand = (href: string) =>
    setExpandedParents((prev) => ({ ...prev, [href]: !prev[href] }));

  // Proper path-boundary match so e.g. "/admin/bouncie" does NOT match "/admin/bouncie-devices".
  const isPathActive = (pathname: string, href: string) => {
    if (pathname === href) return true;
    if (href === "/dashboard") return false;
    return pathname.startsWith(href + "/");
  };

  useEffect(() => {
    // Auto-expand parent when a child matches the current location
    let changed = false;
    const newState = { ...expandedParents };
    [...allSidebarItems, ...employeeSidebarItems].forEach((it) => {
      if (it.children && it.children.length > 0) {
        const childActive = it.children.some((c) =>
          isPathActive(location, c.href),
        );
        if (childActive && !newState[it.href]) {
          newState[it.href] = true;
          changed = true;
        }
      }
    });
    if (changed) setExpandedParents(newState);
  }, [location]);

  const { data } = useQuery<{ user?: any }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const { buildApiUrl } = await import("@/lib/queryClient");
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), {
          credentials: "include",
        });
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
        // Silently handle network errors - AuthGuard will handle redirect
        return { user: undefined };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes to prevent unnecessary refetches
  });

  const user = data?.user;

  // When on /staff path, show staff sidebar for both employees and admins (managers) so staff functions are available.
  // While impersonating an employee, the backend has already flipped
  // user.isEmployee to true on /api/auth/me, so the staff sidebar appears
  // automatically without the route-prefix fallback.
  const showStaffSidebar =
    !!(user as any)?.viewAsEmployee?.employeeId ||
    (location.startsWith("/staff") &&
      (user?.isEmployee === true || user?.isAdmin === true));

  // Filter sidebar items based on user role and path (employees see staff nav; on /staff path admins also see staff nav)
  const sidebarItems = useMemo(() => {
    if (!user) return [];

    // Resolve the user's effective role for sidebar filtering.
    // We trust the boolean flags first, but fall back to the role name when
    // none of the flags are true (defensive against legacy `role` rows where
    // isClient/isEmployee may be missing). Without this fallback, a Client
    // user with `isClient=false` would yield userRole=null, which lets every
    // sidebar item that lacks an explicit `roles` restriction render — the
    // exact symptom of "admin menus still showing after switching to client."
    // If the admin is currently impersonating a client/employee via the
    // "View as ..." features, force the effective role accordingly so the
    // sidebar mirrors what that user would actually see (no admin-only
    // items). This is what makes the impersonation faithful — without it,
    // the banner says "viewing as ..." but the menu still exposes every
    // admin route, defeating the purpose of the feature.
    const isViewingAsClient = !!(user as any).viewAsClient?.clientId;
    const isViewingAsEmployee = !!(user as any).viewAsEmployee?.employeeId;
    const roleName = String((user as any).roleName || "").toLowerCase();
    const userRole: "admin" | "client" | "employee" | null = isViewingAsClient
      ? "client"
      : isViewingAsEmployee
        ? "employee"
        : user.isAdmin
          ? "admin"
          : user.isEmployee
            ? "employee"
            : user.isClient
              ? "client"
              : /admin|owner|developer|manager/.test(roleName)
                ? "admin"
                : /employee|staff/.test(roleName)
                  ? "employee"
                  : /client|customer/.test(roleName)
                    ? "client"
                    : null;
    const roleForStaffNav = showStaffSidebar ? "employee" : userRole;

    // Staff sidebar: when user is employee, or when on /staff path as admin (manager using staff view)
    if (user.isEmployee || showStaffSidebar) {
      return employeeSidebarItems
        .filter((item) => {
          const visible =
            !item.roles ||
            item.roles.length === 0 ||
            (roleForStaffNav && item.roles.includes(roleForStaffNav));
          if (!visible) return false;
          if (item.children && item.children.length > 0) {
            const filteredChildren = item.children.filter(
              (c) =>
                !c.roles ||
                c.roles.length === 0 ||
                (roleForStaffNav && c.roles.includes(roleForStaffNav)),
            );
            return filteredChildren.length > 0;
          }
          return true;
        })
        .map((item) => {
          if (item.children && item.children.length > 0) {
            const filteredChildren = item.children.filter(
              (c) =>
                !c.roles ||
                c.roles.length === 0 ||
                (roleForStaffNav && c.roles.includes(roleForStaffNav)),
            );
            return { ...item, children: filteredChildren };
          }
          return item;
        }) as SidebarItem[];
    }

    return allSidebarItems
      .map((item) => {
        const visible =
          !item.roles ||
          item.roles.length === 0 ||
          (userRole && item.roles.includes(userRole));
        if (!visible) return null;

        if (item.children && item.children.length > 0) {
          const filteredChildren = item.children.filter(
            (c) =>
              !c.roles ||
              c.roles.length === 0 ||
              (userRole && c.roles.includes(userRole)),
          );
          return { ...item, children: filteredChildren };
        }

        return item;
      })
      .filter(Boolean) as SidebarItem[];
  }, [user, location, showStaffSidebar]);

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");

      // Clear ALL query caches to prevent showing previous user's data
      // This ensures when a new user logs in, they see fresh data, not cached data from previous user
      queryClient.clear();

      // Also invalidate auth query explicitly
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });

      setLocation("/admin/login");
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if logout fails on server, clear cache to prevent data leakage
      queryClient.clear();
    }
  };

  const handleSwitchRole = async (roleId: number, role: RoleOption) => {
    if (roleId === user?.roleId) return;
    setSwitching(true);
    try {
      const res = await fetch(buildApiUrl("/api/auth/switch-role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to switch account");
      }

      // Wipe React Query cache so prior role's data doesn't render briefly.
      queryClient.clear();

      // Force a full page reload (window.location.assign) instead of an SPA
      // route change. Without a hard reload, mounted components keep their
      // local state — including AuthGuard's `hasAuthenticated`, the layout's
      // memoized `user` reference, and any in-flight queries — which causes
      // admin menus / data to keep rendering for a moment after the session
      // has actually flipped to client/employee. A reload guarantees that
      // every component re-mounts, /api/auth/me is re-fetched fresh, and the
      // sidebar + page contents reflect the new role from the very first
      // paint.
      const target = role.isEmployee ? "/staff/dashboard" : "/dashboard";
      window.location.assign(target);
    } catch (e) {
      console.error("Switch role failed:", e);
    } finally {
      setSwitching(false);
    }
  };

  return (
    // Root shell:
    //   - `flex h-screen`  — horizontal row, exactly viewport height.
    //   - `overflow-hidden` — nothing is allowed to scroll the page itself.
    //     Vertical scrolling lives on <main>; horizontal scrolling lives on
    //     whatever inner widget needs it (e.g. the income/expense table).
    //     This stops the whole document from scrolling when a child is wider
    //     than the viewport, which used to visually "cut" the main content
    //     during browser resizes.
    <div className="flex h-screen bg-background overflow-hidden">
      <aside
        className={cn(
          // Base: flex column chrome for the sidebar.
          "z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          // Mobile (< lg): fixed overlay that slides in from the left.
          "fixed inset-y-0 left-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop (lg+): promote the sidebar to a normal flex child so it
          // naturally contributes its width to the row and <main> doesn't need
          // a hand-tuned margin. `lg:translate-x-0` cancels the mobile slide
          // transform; `lg:h-screen` guarantees full height even when the flex
          // parent's stretch ever gets overridden.
          "lg:static lg:translate-x-0 lg:h-screen lg:flex-shrink-0",
          sidebarOpen ? "w-64" : "w-20",
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Golden Luxury Auto"
              className={cn(
                "object-contain transition-all duration-300 drop-shadow-[0_0_8px_rgba(234,235,128,0.3)]",
                sidebarOpen ? "w-[180px] md:w-[200px]" : "w-[40px]",
              )}
            />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            // Top-level / parent active: elegant gold text + left bar, no fill.
            // Restrained luxury — the parent is a category label, not the destination.
            const activeClasses =
              "border-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary))] font-semibold bg-[hsl(var(--sidebar-primary)/0.08)]";
            // Sub-menu active: THE hero item — full premium gold gradient with glow.
            // The selected page always gets the spotlight.
            const childActiveClasses =
              "bg-gradient-to-r from-[hsl(40_55%_78%)] via-[hsl(var(--sidebar-primary))] to-[hsl(36_45%_60%)] text-[hsl(var(--sidebar-primary-foreground))] font-semibold border-[hsl(36_60%_50%)] shadow-[0_4px_14px_-4px_hsl(var(--sidebar-primary)/0.5)] ring-1 ring-[hsl(var(--sidebar-primary)/0.3)]";
            const inactiveClasses =
              "border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground";

            if (item.children && item.children.length > 0) {
              // Parent is considered active only when a child path is active.
              const isParentActive = item.children.some((c) =>
                isPathActive(location, c.href),
              );
              const expanded = expandedParents[item.href] ?? isParentActive;

              return (
                <div key={item.href} className="mx-2">
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors relative cursor-pointer border-l-2",
                      isParentActive ? activeClasses : inactiveClasses,
                    )}
                    onClick={() => toggleExpand(item.href)}
                    data-testid={`link-admin-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {sidebarOpen && (
                      <>
                        <span className="text-sm flex-1">{item.label}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                        />
                      </>
                    )}
                  </div>

                  {expanded && sidebarOpen && (
                    <div className="mt-1 ml-4 border-l-2 border-[hsl(var(--sidebar-primary)/0.35)] pl-2">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = location === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors border-l-2",
                              childActive
                                ? childActiveClasses
                                : inactiveClasses,
                            )}
                            onClick={() => setMobileMenuOpen(false)}
                            data-testid={`link-admin-${child.label.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <ChildIcon
                              className={cn(
                                "w-3 h-3 shrink-0",
                                childActive
                                  ? "text-[hsl(var(--sidebar-primary-foreground))]"
                                  : "text-muted-foreground",
                              )}
                            />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = isPathActive(location, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 mx-2 px-3 py-2 rounded-md transition-colors relative border-l-2",
                  isActive ? childActiveClasses : inactiveClasses,
                )}
                onClick={() => setMobileMenuOpen(false)}
                data-testid={`link-admin-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="text-sm">{item.label}</span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/*
        Main column:
          - `flex-1` — consume the viewport width that the sidebar didn't take.
          - `min-w-0` — critical in a flex row; lets this column actually shrink
            below the intrinsic min-width of its content (tables, long headers,
            etc.) instead of being pushed wider and overflowing the shell.
          - `overflow-hidden` — clips any stray overflow at the column boundary
            so the page never develops a horizontal scrollbar; internal scroll
            containers (<main>'s overflow-y-auto and per-widget overflow-auto)
            own their own scrolling.
        We intentionally dropped the previous `lg:ml-64 / lg:ml-20` hack and
        the redundant `w-full` — the sidebar is now a real flex sibling on lg+,
        so it contributes its own width to the row and no manual margin or
        width declaration is needed. `flex-1 min-w-0` is the whole formula.
      */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden transition-all duration-300">
        <header className="h-14 bg-background border-b border-border flex items-center justify-between px-3 sm:px-4 lg:px-6">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-6 h-6" />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationBell />
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-none">
                  {user.firstName} {user.lastName}{" "}
                  <span className="hidden sm:inline">({user.roleName})</span>
                </span>
                {(user as any).roles?.length > 1 &&
                  !(user as any).impersonatorIsAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          disabled={switching}
                          title="Switch account (same login)"
                        >
                          {switching ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">
                                Switch account
                              </span>
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Switch to</DropdownMenuLabel>
                        {((user as any).roles as RoleOption[]).map((r) => (
                          <DropdownMenuItem
                            key={r.id}
                            onClick={() => handleSwitchRole(r.id, r)}
                            disabled={r.id === user.roleId || switching}
                          >
                            {r.name} {r.id === user.roleId ? "(current)" : ""}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
            )}
          </div>
        </header>

        {/*
          Keying the page wrapper by the current `location` forces the
          routed content to remount on every navigation — even when the
          user clicks a link to the page they are already on. That way each
          menu selection guarantees a fresh mount: component state is reset,
          useQuery hooks re-run and their loading state is shown, and the
          scroll position resets to the top. The sidebar and header are
          outside this subtree, so they stay mounted and do NOT reload.
        */}
        <main className="flex-1 min-w-0 flex flex-col overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 bg-background">
          <ViewAsClientBanner />
          <div key={location} className="flex-1 min-h-0">
            {children}
          </div>
        </main>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}

// Tracks whether an ancestor AdminLayout has already rendered the shell
// (sidebar + header + auth guard). When true, nested <AdminLayout> usages
// inside individual pages become a pass-through. This lets the shell stay
// mounted across route changes so navigation only swaps the <main> content
// instead of unmounting/remounting the entire sidebar and header.
const AdminLayoutMountedContext = createContext<boolean>(false);

export function AdminLayout({ children }: AdminLayoutProps) {
  const alreadyMounted = useContext(AdminLayoutMountedContext);

  if (alreadyMounted) {
    return <>{children}</>;
  }

  return (
    <AdminLayoutMountedContext.Provider value={true}>
      <AuthGuard>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </AuthGuard>
    </AdminLayoutMountedContext.Provider>
  );
}
