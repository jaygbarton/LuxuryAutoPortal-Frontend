/**
 * "Report Center + Support Center" block for admin pages.
 *
 * Same contents/order as the client-side block (see ClientPageLinks.tsx).
 * Self-gates on isAdmin && !isClient && !isEmployee so it never renders
 * twice alongside the client or employee variants.
 *
 * Mount as a normal block at the bottom of any /admin/* page; it has no
 * fixed positioning and never overlaps surrounding content.
 */
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import {
  BarChart3,
  BookOpen,
  Calculator,
  Calendar,
  Car,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Folder,
  Globe,
  History,
  Map,
  PlusCircle,
  ShoppingBag,
  Star,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Video,
  Wrench,
} from "lucide-react";
import { ReportCenter } from "@/pages/client/_components/ReportCenter";
import { SupportCenter } from "@/pages/client/_components/SupportCenter";

export function AdminPageLinks() {
  const { data: meData } = useQuery<{
    user?: { isAdmin?: boolean; isClient?: boolean; isEmployee?: boolean };
  }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), {
        credentials: "include",
      });
      if (!res.ok) return null as any;
      return res.json();
    },
    retry: false,
  });

  const isAdmin = Boolean(meData?.user?.isAdmin);
  const isClient = Boolean(meData?.user?.isClient);
  const isEmployee = Boolean(meData?.user?.isEmployee);

  // Render only for pure admins. Clients and employees see their own block.
  if (!isAdmin || isClient || isEmployee) return null;

  // For admins we don't have a "current car" the way clients do, so the
  // per-car routes deep-link to the Cars list and let the admin pick.
  const carsHref = "/cars";
  const turoViewLink: string | null = null;

  //   Row 1: Earnings | Records and Files | Car Rental Value Per Month | Payment Calculator
  //   Row 2: History  | Graphs and Charts Report | NADA Depreciation Schedule | Payment History
  //   Row 3: Totals   | Maintenance              | Purchase Details
  const reportLinks = [
    { href: carsHref,             icon: DollarSign,   label: "Earnings" },
    { href: carsHref,             icon: Folder,       label: "Records and Files" },
    { href: carsHref,             icon: Calendar,     label: "Car Rental Value Per Month" },
    { href: carsHref,             icon: Calculator,   label: "Payment Calculator" },

    { href: "/admin/turo-trips",  icon: History,      label: "History" },
    { href: carsHref,             icon: TrendingUp,   label: "Graphs and Charts Report" },
    { href: carsHref,             icon: TrendingDown, label: "NADA Depreciation Schedule" },
    { href: carsHref,             icon: CreditCard,   label: "Payment History" },

    { href: carsHref,             icon: BarChart3,    label: "Totals" },
    { href: carsHref,             icon: Wrench,       label: "Maintenance" },
    { href: carsHref,             icon: ShoppingBag,  label: "Purchase Details" },
  ];

  //   Row 1: Off-boarding Form | Book Your Car | Training Manual | News & Media
  //   Row 2: Schedule a Zoom Call | License Registration or Insurance Updates | Turo Guide | (blank)
  //   Row 3: List Another Car  | Refer Somebody | Client Testimonials
  const supportLinks = [
    { href: "/admin/forms",        icon: ClipboardList, label: "Off-boarding Form" },
    { href: turoViewLink ?? "#",   icon: Car,           label: "Book Your Car", external: !!turoViewLink },
    { href: "/tutorial",           icon: BookOpen,      label: "Training Manual" },
    { href: "#",                   icon: Globe,         label: "News & Media" },

    { href: "#",                   icon: Video,         label: "Schedule a Zoom Call" },
    { href: "/admin/profile",      icon: FileText,      label: "License Registration or Insurance Updates" },
    { href: "/admin/turo-guide",   icon: Map,           label: "Turo Guide" },
    { href: "",                    icon: Map,           label: "",                placeholder: true },

    { href: "/onboarding",         icon: PlusCircle,    label: "List Another Car" },
    { href: "/admin/forms",        icon: UserPlus,      label: "Refer Somebody" },
    { href: "/admin/testimonials", icon: Star,          label: "Client Testimonials" },
  ];

  return (
    <div className="space-y-6 mt-8 mb-12">
      <ReportCenter reportLinks={reportLinks} />
      <SupportCenter supportLinks={supportLinks} />
    </div>
  );
}
