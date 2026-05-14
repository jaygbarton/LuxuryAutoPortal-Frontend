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
  Globe,
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
      const res = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!res.ok) return null as any;
      return res.json();
    },
    retry: false,
  });

  const isClient = Boolean(meData?.user?.isClient);

  const { data: profileData } = useQuery<{ success: boolean; data: { cars?: { id: number }[] } }>({
    queryKey: ["/api/client/profile"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/client/profile"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: isClient,
    retry: false,
  });

  const { data: quickLinksData } = useQuery<{ title?: string; url?: string }[]>({
    queryKey: ["/api/quick-links"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/quick-links"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quick links");
      const d = await res.json();
      return d.quickLinks ?? [];
    },
    enabled: isClient,
    retry: false,
  });

  if (!isClient) return null;

  const firstCarId = profileData?.data?.cars?.[0]?.id ?? null;
  const turoViewLink =
    (quickLinksData ?? []).find((l) => l.title?.toLowerCase().includes("turo") && l.url)?.url ?? null;

  const carPath = firstCarId
    ? (p: string) => `/admin/cars/${firstCarId}/${p}`
    : (_: string) => "#";

  const reportLinks = [
    { href: carPath("earnings"),       icon: DollarSign,    label: "Earnings" },
    { href: "/admin/turo-trips",       icon: ClipboardList, label: "History" },
    { href: carPath("totals"),         icon: BarChart3,     label: "Totals" },
    { href: carPath("records"),        icon: FileText,      label: "Records and Files" },
    { href: carPath("graphs"),         icon: TrendingUp,    label: "Graphs and Charts Report" },
    { href: carPath("maintenance"),    icon: Wrench,        label: "Maintenance" },
    { href: carPath("income-expense"), icon: Calendar,      label: "Car Rental Value Per Month" },
    { href: carPath("depreciation"),   icon: TrendingDown,  label: "NADA Depreciation Schedule" },
    { href: carPath("purchase"),       icon: ShoppingBag,   label: "Purchase Details" },
    { href: carPath("calculator"),     icon: Calculator,    label: "Payment Calculator" },
    { href: carPath("payments"),       icon: CreditCard,    label: "Payment History" },
  ];

  const supportLinks = [
    { href: "#",                   icon: ClipboardList, label: "Off-boarding Form" },
    { href: "#",                   icon: Video,         label: "Schedule a Zoom Call" },
    { href: "/onboarding",         icon: PlusCircle,    label: "List Another Car" },
    { href: turoViewLink ?? "#",   icon: Car,           label: "Book Your Car", external: !!turoViewLink },
    { href: "/profile",            icon: FileText,      label: "License Registration or Insurance Updates" },
    { href: "/admin/forms",        icon: UserPlus,      label: "Refer Somebody" },
    { href: "/tutorial",           icon: BookOpen,      label: "Training Manual" },
    { href: "/admin/turo-guide",   icon: Map,           label: "Turo Guide" },
    { href: "/admin/testimonials", icon: Star,          label: "Client Testimonials" },
    { href: "#",                   icon: Globe,         label: "News & Media" },
  ];

  return (
    <div className="space-y-6 mt-8">
      <ReportCenter reportLinks={reportLinks} />
      <SupportCenter supportLinks={supportLinks} />
    </div>
  );
}
