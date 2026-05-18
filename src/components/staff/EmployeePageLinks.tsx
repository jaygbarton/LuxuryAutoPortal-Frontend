/**
 * "Report Center + Support Center" block for employee pages.
 *
 * Same contents/order as the client-side block (see ClientPageLinks.tsx) —
 * the team agreed everyone sees the same footer regardless of role; only the
 * sidebar nav differs by role. Self-gates on isEmployee && !isAdmin so that
 * an admin previewing an employee page doesn't get duplicate blocks.
 *
 * Mount as a normal block at the bottom of any /staff/* page; it has no
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

export function EmployeePageLinks() {
  const { data: meData } = useQuery<{
    user?: { isEmployee?: boolean; isAdmin?: boolean };
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

  const isEmployee = Boolean(meData?.user?.isEmployee);
  const isAdmin = Boolean(meData?.user?.isAdmin);

  // Only render for true employees. Admins see their own block via
  // AdminPageLinks so we don't render twice.
  if (!isEmployee || isAdmin) return null;

  const turoViewLink: string | null = null; // Employees don't get the per-client Turo link.

  // Same row-major order as ClientPageLinks.
  //   Row 1: Earnings | Records and Files | Car Rental Value Per Month | Payment Calculator
  //   Row 2: History  | Graphs and Charts Report | NADA Depreciation Schedule | Payment History
  //   Row 3: Totals   | Maintenance              | Purchase Details
  const reportLinks = [
    { href: "#",                  icon: DollarSign,   label: "Earnings" },
    { href: "#",                  icon: Folder,       label: "Records and Files" },
    { href: "#",                  icon: Calendar,     label: "Car Rental Value Per Month" },
    { href: "#",                  icon: Calculator,   label: "Payment Calculator" },

    { href: "/admin/turo-trips",  icon: History,      label: "History" },
    { href: "#",                  icon: TrendingUp,   label: "Graphs and Charts Report" },
    { href: "#",                  icon: TrendingDown, label: "NADA Depreciation Schedule" },
    { href: "#",                  icon: CreditCard,   label: "Payment History" },

    { href: "#",                  icon: BarChart3,    label: "Totals" },
    { href: "#",                  icon: Wrench,       label: "Maintenance" },
    { href: "#",                  icon: ShoppingBag,  label: "Purchase Details" },
  ];

  //   Row 1: Off-boarding Form | Book Your Car | Training Manual | News & Media
  //   Row 2: Schedule a Zoom Call | License Registration or Insurance Updates | Turo Guide | (blank)
  //   Row 3: List Another Car  | Refer Somebody | Client Testimonials
  const supportLinks = [
    { href: "#",                          icon: ClipboardList, label: "Off-boarding Form" },
    { href: turoViewLink ?? "#",          icon: Car,           label: "Book Your Car", external: !!turoViewLink },
    { href: "/staff/training-manual",     icon: BookOpen,      label: "Training Manual" },
    { href: "#",                          icon: Globe,         label: "News & Media" },

    { href: "#",                          icon: Video,         label: "Schedule a Zoom Call" },
    { href: "/staff/my-info/personal-information", icon: FileText, label: "License Registration or Insurance Updates" },
    { href: "/staff/turo-guide",          icon: Map,           label: "Turo Guide" },
    { href: "",                           icon: Map,           label: "",                                            placeholder: true },

    { href: "#",                          icon: PlusCircle,    label: "List Another Car" },
    { href: "/admin/forms",               icon: UserPlus,      label: "Refer Somebody" },
    { href: "/staff/client-testimonials", icon: Star,          label: "Client Testimonials" },
  ];

  return (
    <div className="space-y-6 mt-8 mb-12">
      <ReportCenter reportLinks={reportLinks} />
      <SupportCenter supportLinks={supportLinks} />
    </div>
  );
}
