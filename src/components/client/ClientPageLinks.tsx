/**
 * Shared "Report Center + Support Center" block for client pages.
 *
 * Renders the two grid cards (same visual as the dashboard) with the link
 * arrays built from /api/client/profile (first car id, used to scope the
 * Report Center cards) and /api/quick-links (Turo "Book Your Car" URL).
 *
 * Self-gates on the viewer's isClient flag, so dropping this into a page that
 * admins/employees may also visit is safe — they see nothing.
 *
 * Mount as a normal block; it has no position/fixed styling and never
 * overlaps surrounding content.
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

export function ClientPageLinks() {
  const { data: meData } = useQuery<{ user?: { isClient?: boolean } }>({
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

  const isClient = Boolean(meData?.user?.isClient);

  const { data: profileData } = useQuery<{
    success: boolean;
    data: { cars?: { id: number }[] };
  }>({
    queryKey: ["/api/client/profile"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/client/profile"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: isClient,
    retry: false,
  });

  if (!isClient) return null;

  const firstCarId = profileData?.data?.cars?.[0]?.id ?? null;
  // GLA's Turo host page — shows all cars available to book.
  const turoViewLink = "https://turo.com/us/en/host/4325673";

  const carPath = firstCarId
    ? (p: string) => `/admin/cars/${firstCarId}/${p}`
    : (_: string) => "#";

  // Order is row-major across the 4-column grid: each row is a left-to-right
  // sweep, and we wrap to the next row after every 4 items.
  //
  //   Row 1: Earnings | Records and Files | Car Rental Value Per Month | Payment Calculator
  //   Row 2: History  | Graphs and Charts Report | NADA Depreciation Schedule | Payment History
  //   Row 3: Totals   | Maintenance              | Purchase Details
  const reportLinks = [
    { href: carPath("earnings"),      icon: DollarSign,   label: "Earnings" },
    { href: carPath("records"),       icon: Folder,       label: "Records and Files" },
    { href: carPath("income-expense"),icon: Calendar,     label: "Car Rental Value Per Month" },
    { href: carPath("calculator"),    icon: Calculator,   label: "Payment Calculator" },

    { href: carPath("earnings"),      icon: History,      label: "History" },
    { href: carPath("graphs"),        icon: TrendingUp,   label: "Graphs and Charts Report" },
    { href: carPath("depreciation"),  icon: TrendingDown, label: "NADA Depreciation Schedule" },
    { href: carPath("payments"),      icon: CreditCard,   label: "Payment History" },

    { href: carPath("totals"),        icon: BarChart3,    label: "Totals" },
    { href: carPath("maintenance"),   icon: Wrench,       label: "Maintenance" },
    { href: carPath("purchase"),      icon: ShoppingBag,  label: "Purchase Details" },
  ];

  //   Row 1: Off-boarding Form | Book Your Car | Training Manual | News & Media
  //   Row 2: Schedule a Zoom Call | License Registration or Insurance Updates | Turo Guide | (blank)
  //   Row 3: List Another Car  | Refer Somebody | Client Testimonials
  const supportLinks = [
    { href: "/admin/forms",        icon: ClipboardList, label: "Off-boarding Form" },
    { href: turoViewLink ?? "#",   icon: Car,           label: "Book Your Car", external: !!turoViewLink },
    { href: "/tutorial",           icon: BookOpen,      label: "Training Manual" },
    { href: "/admin/news-media",   icon: Globe,         label: "News & Media" },

    { href: "#",                   icon: Video,         label: "Schedule a Zoom Call" },
    { href: "/profile",            icon: FileText,      label: "License Registration or Insurance Updates" },
    { href: "/admin/turo-guide",   icon: Map,           label: "Turo Guide" },
    { href: "",                    icon: Map,           label: "",            placeholder: true },

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
