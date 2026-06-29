/**
 * Quick-links footer for admin pages.
 *
 * Five sections as specified by the project manager:
 *   Database        — admins, clients, cars, income & expenses, payments, totals
 *   Operations      — turo trips, bouncie, operations, forms
 *   Human Resources — employees, work schedule, task mgmt, timesheet, day-off, stats report
 *   Accounting      — payroll, commissions
 *   Support         — turo guide, system tutorial, client testimonials, news & media, slack notifications
 *
 * Self-gates on isAdmin && !isClient && !isEmployee so it never renders
 * alongside the employee or client variants.
 *
 * On desktop the five sections sit in a responsive 2-column grid so the footer
 * stays compact. The "Accounting" section (2 links) spans a single column.
 */
import { useQuery } from "@tanstack/react-query";
import { authMeQueryFn } from "@/lib/queryClient";
import {
  Anchor,
  Bell,
  BookOpen,
  Briefcase,
  CalendarOff,
  Car,
  CheckSquare,
  Clock,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileText,
  Layers,
  Map,
  Newspaper,
  Radio,
  Shield,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { QuickLinksSection } from "@/pages/client/_components/QuickLinksSection";

export function AdminPageLinks() {
  const { data: meData } = useQuery<{
    user?: { isAdmin?: boolean; isClient?: boolean; isEmployee?: boolean; isCoHost?: boolean };
  }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    retry: false,
  });

  const isAdmin    = Boolean(meData?.user?.isAdmin);
  const isClient   = Boolean(meData?.user?.isClient);
  const isEmployee = Boolean(meData?.user?.isEmployee);
  const isCoHost   = Boolean((meData?.user as any)?.isCoHost);

  if (!isAdmin || isClient || isEmployee) return null;

  const databaseLinks = [
    { href: "/admin/admins",           icon: Shield,      label: "Administrator" },
    { href: "/admin/clients",          icon: Users,       label: "Client Database" },
    { href: "/cars",                   icon: Car,         label: "Car Database" },
    { href: "/admin/income-expenses",  icon: DollarSign,  label: "Income and Expenses" },
    { href: "/admin/payments",         icon: CreditCard,  label: "Client Payments" },
    { href: "/admin/totals",           icon: Layers,      label: "Totals" },
  ];

  const operationsLinks = [
    { href: "/admin/turo-trips",    icon: TrendingUp,    label: "Turo Trips" },
    { href: "/admin/bouncie",       icon: Radio,         label: "Bouncie" },
    { href: "/admin/operations",    icon: Anchor,        label: "Operations" },
    { href: "/admin/car-block-off", icon: CalendarOff,   label: "Car Block Off" },
    ...(!isCoHost ? [{ href: "/admin/rental-listings", icon: Car, label: "Rental Listings" }] : []),
    { href: "/admin/forms",         icon: ClipboardList, label: "Forms" },
  ];

  const hrLinks = [
    { href: "/admin/hr/employees",      icon: Users,       label: "Employees" },
    { href: "/admin/hr/work-schedule",  icon: Clock,       label: "Work Schedule" },
    { href: "/admin/hr/task-management",icon: CheckSquare, label: "Task Management" },
    { href: "/admin/hr/time",           icon: FileText,    label: "Employees Timesheet" },
    { href: "/admin/hr/time-off",       icon: CalendarOff, label: "Employees Day Off Request" },
    { href: "/admin/hr/report",         icon: Briefcase,   label: "Employees Stats Report" },
  ];

  const accountingLinks = [
    { href: "/admin/payroll",              icon: DollarSign, label: "Payroll" },
    { href: "/admin/payroll/commissions",  icon: TrendingUp, label: "Commissions" },
  ];

  const supportLinks = [
    { href: "/admin/turo-guide",    icon: Map,       label: "Turo Guide" },
    { href: "/admin/training-manual", icon: BookOpen, label: "System Tutorial" },
    { href: "/admin/testimonials",  icon: Star,      label: "Client Testimonials" },
    { href: "/admin/news-media",    icon: Newspaper, label: "News & Media" },
    { href: "/admin/settings",      icon: Bell,      label: "Slack Notifications" },
  ];

  return (
    <div className="mt-8 mb-12 space-y-4">
      {/* Row 1 — Database, full width (6 links) */}
      <QuickLinksSection title="Database" links={databaseLinks} />

      {/* Row 2 — Accounting (1/2) + Operations (1/2) */}
      <div className="grid grid-cols-2 gap-4">
        <QuickLinksSection title="Accounting" links={accountingLinks} cols={2} />
        <QuickLinksSection title="Operations" links={operationsLinks} cols={2} />
      </div>

      {/* Row 3+4 — Human Resources, full width (6 links fills 2 grid rows) */}
      <QuickLinksSection title="Human Resources" links={hrLinks} />

      {/* Row 5 — Support, full width (5 links) */}
      <QuickLinksSection title="Support" links={supportLinks} />
    </div>
  );
}
