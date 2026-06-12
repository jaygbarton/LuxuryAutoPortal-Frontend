/**
 * Quick-links footer for employee (/staff/*) pages.
 *
 * Two sections as specified by the project manager:
 *   Report Center  — time sheet, time-off, my info, forms, task mgmt, operations, bouncie
 *   Support Center — turo guide, system tutorial, client testimonials
 *
 * Self-gates on isEmployee && !isAdmin so admins previewing staff pages
 * never see a duplicate block alongside AdminPageLinks.
 */
import { useQuery } from "@tanstack/react-query";
import { authMeQueryFn } from "@/lib/queryClient";
import {
  Anchor,
  BookOpen,
  CalendarOff,
  CheckSquare,
  Clock,
  ClipboardList,
  Map,
  Radio,
  Star,
  User,
} from "lucide-react";
import { QuickLinksSection } from "@/pages/client/_components/QuickLinksSection";

export function EmployeePageLinks() {
  const { data: meData } = useQuery<{
    user?: { isEmployee?: boolean; isAdmin?: boolean };
  }>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
    retry: false,
  });

  const isEmployee = Boolean(meData?.user?.isEmployee);
  const isAdmin = Boolean(meData?.user?.isAdmin);

  if (!isEmployee || isAdmin) return null;

  const reportLinks = [
    { href: "/staff/time",             icon: Clock,         label: "Time Sheet" },
    { href: "/staff/time-off",         icon: CalendarOff,   label: "Request Time Off" },
    { href: "/staff/my-info/personal-information", icon: User, label: "My Info" },
    { href: "/staff/forms",            icon: ClipboardList, label: "Forms" },
    { href: "/staff/task-management",  icon: CheckSquare,   label: "Task Management" },
    { href: "/admin/operations",       icon: Anchor,        label: "Operations" },
    { href: "/admin/bouncie",          icon: Radio,         label: "Bouncie" },
  ];

  const supportLinks = [
    { href: "/staff/turo-guide",          icon: Map,      label: "Turo Guide" },
    { href: "/staff/training-manual",     icon: BookOpen, label: "System Tutorial" },
    { href: "/staff/client-testimonials", icon: Star,     label: "Client Testimonials" },
  ];

  return (
    <div className="space-y-4 mt-8 mb-12">
      <QuickLinksSection title="Report Center"  links={reportLinks} />
      <QuickLinksSection title="Support Center" links={supportLinks} />
    </div>
  );
}
