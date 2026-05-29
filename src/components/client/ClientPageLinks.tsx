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

  const carPath = firstCarId
    ? (p: string) => `/admin/cars/${firstCarId}/${p}`
    : (_: string) => "#";

  // Kept in sync with src/pages/client/dashboard.tsx — same order, same URLs.
  //
  //   Row 1: Earnings | History | Totals | Records and Files
  //   Row 2: Graphs and Charts Report | Maintenance | Car Rental Value Per Month | NADA Depreciation Schedule
  //   Row 3: Payment History
  const reportLinks = [
    { href: carPath("earnings"),       icon: DollarSign,   label: "Earnings" },
    { href: "/client/trip-history",    icon: History,      label: "History" },
    { href: carPath("totals"),         icon: BarChart3,    label: "Totals" },
    { href: carPath("records"),        icon: Folder,       label: "Records and Files" },

    { href: carPath("graphs"),         icon: TrendingUp,   label: "Graphs and Charts Report" },
    { href: carPath("maintenance"),    icon: Wrench,       label: "Maintenance" },
    { href: carPath("income-expense"), icon: Calendar,     label: "Car Rental Value Per Month" },
    { href: carPath("depreciation"),   icon: TrendingDown, label: "NADA Depreciation Schedule" },

    { href: carPath("payments"),       icon: CreditCard,   label: "Payment History" },
  ];

  //   Row 1: Off-boarding Form | Book Your Car | Training Manual | News & Media
  //   Row 2: Schedule a Zoom Call | License Registration or Insurance Updates | Turo Guide | (blank)
  //   Row 3: List Another Car  | Refer Somebody | Client Testimonials
  const supportLinks = [
    { href: "/client/offboarding-form", icon: ClipboardList, label: "Off-boarding Form" },
    { href: "https://rent.goldenluxuryauto.com/start-block", icon: Car, label: "Book Your Car", external: true },
    { href: "/tutorial",             icon: BookOpen,      label: "Training Manual" },
    { href: "/admin/news-media",     icon: Globe,         label: "News & Media" },

    { href: "https://rent.goldenluxuryauto.com/lyc-client-check-in", icon: Video, label: "Schedule a Zoom Call", external: true },
    { href: "/profile",              icon: FileText,      label: "License Registration or Insurance Updates" },
    { href: "/admin/turo-guide",     icon: Map,           label: "Turo Guide" },
    { href: "",                      icon: Map,           label: "",                placeholder: true },

    { href: "/onboarding",           icon: PlusCircle,    label: "List Another Car" },
    { href: "/admin/forms",          icon: UserPlus,      label: "Refer Somebody" },
    { href: "/admin/testimonials",   icon: Star,          label: "Client Testimonials" },
  ];

  return (
    <div className="space-y-6 mt-8 mb-12">
      <ReportCenter reportLinks={reportLinks} />
      <SupportCenter supportLinks={supportLinks} />
    </div>
  );
}
