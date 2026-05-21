import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { NewsMediaSlot } from "@/pages/client/_components/NewsMediaSlot";
import { OnboardingTutorial, useTutorial } from "@/components/onboarding/OnboardingTutorial";
import { buildApiUrl } from "@/lib/queryClient";

// Dashboard section components
import IncomeExpensesSection from "@/components/admin/dashboard/IncomeExpensesSection";
import OperationsSection from "@/components/admin/dashboard/OperationsSection";
import MaintenanceSection from "@/components/admin/dashboard/MaintenanceSection";
import AirportParkingSection from "@/components/admin/dashboard/AirportParkingSection";
import CommissionsSection from "@/components/admin/dashboard/CommissionsSection";
import TaskManagementSection from "@/components/admin/dashboard/TaskManagementSection";
import NoticeBoardSection from "@/components/admin/dashboard/NoticeBoardSection";
import EmployeeStatsSection from "@/components/admin/dashboard/EmployeeStatsSection";
import MonthlyEmployeeStatsSection from "@/components/admin/dashboard/MonthlyEmployeeStatsSection";
import TuroInspectionsSection from "@/components/admin/dashboard/TuroInspectionsSection";
import CarIssuesSection from "@/components/admin/dashboard/CarIssuesSection";

const ALL_IDS = [
  "income-expenses",
  "airport-parking",
  "commissions",
  "operations",
  "turo-inspections",
  "car-issues",
  "maintenance",
  "task-management",
  "notice-board",
  "employee-stats",
  "monthly-employee-stats",
];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { openTutorial, isOpen: tutorialIsOpen } = useTutorial();
  const queryClient = useQueryClient();
  const hasAttemptedOpen = useRef(false);

  const currentYear = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const show = useMemo(
    () => Object.fromEntries(ALL_IDS.map((id) => [id, true])),
    [],
  );

  // Fetch user role information
  const { data: userData } = useQuery<{
    user?: {
      id?: number;
      isAdmin?: boolean;
      isClient?: boolean;
      isEmployee?: boolean;
      firstName?: string;
      lastName?: string;
      roleName?: string;
      tourCompleted?: boolean;
    };
  }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await fetch(buildApiUrl("/api/auth/me"), {
          credentials: "include",
        });
        if (!response.ok) {
          if (response.status === 401) return { user: undefined };
          return { user: undefined };
        }
        return response.json();
      } catch {
        return { user: undefined };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // News & Media items grouped by dashboard slot
  const { data: newsDashboardData } = useQuery<{
    success: boolean;
    slot1: any[];
    slot2: any[];
  }>({
    queryKey: ["/api/news-media/dashboard"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/news-media/dashboard"), {
        credentials: "include",
      });
      if (!res.ok) return { success: false, slot1: [], slot2: [] };
      return res.json();
    },
    retry: false,
  });
  const newsSlot1Items = newsDashboardData?.slot1 ?? [];
  const newsSlot2Items = newsDashboardData?.slot2 ?? [];

  const markTourShownMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(buildApiUrl("/api/auth/mark-tour-shown"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        console.error("Failed to mark tour as shown:", response.status);
        return { success: false };
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data?.success) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        }, 500);
      }
    },
    onError: (error) => {
      console.error("Error marking tour as shown:", error);
    },
  });

  const user = userData?.user;
  const isAdmin = user?.isAdmin || false;
  const isClient = user?.isClient || false;
  const isEmployee = user?.isEmployee || false;
  const tourCompleted = user?.tourCompleted === true;

  // Redirect employees to staff dashboard
  useEffect(() => {
    if (userData && user?.isEmployee && !user?.isAdmin) {
      setLocation("/staff/dashboard");
    }
  }, [userData, user?.isEmployee, user?.isAdmin, setLocation]);

  // Auto-open tutorial for new users
  useEffect(() => {
    if (tourCompleted || tutorialIsOpen) return;
    if ((isAdmin || isClient || isEmployee) && !tourCompleted && user?.id && !hasAttemptedOpen.current) {
      hasAttemptedOpen.current = true;
      const timer = setTimeout(() => openTutorial(), 500);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, isClient, isEmployee, tourCompleted, user?.id, tutorialIsOpen, openTutorial]);

  useEffect(() => {
    if (!tutorialIsOpen && hasAttemptedOpen.current && !tourCompleted && user?.id) {
      const timer = setTimeout(() => markTourShownMutation.mutate(), 1000);
      return () => clearTimeout(timer);
    }
  }, [tutorialIsOpen, tourCompleted, user?.id, markTourShownMutation]);

  // ── Non-admin views ───────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground text-sm">Loading dashboard…</p>
        </div>
        {(isAdmin || isClient || isEmployee) && <OnboardingTutorial />}
      </AdminLayout>
    );
  }

  // ── Admin dashboard ───────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="min-h-screen bg-background">
        {/* Brand Header */}
        <div className="mb-8 border-b border-gray-200 bg-white px-6 py-6">
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
            {/* Left — Logo */}
            <div className="flex items-center justify-center rounded-lg bg-white p-4">
              <img
                src="/logo.png"
                alt="Golden Luxury Auto"
                className="h-auto w-full object-contain"
              />
            </div>

            {/* Center — News & Media Section 1 (managed in /admin/news-media) */}
            <div>
              {newsSlot1Items.length > 0 ? (
                <NewsMediaSlot slot={1} items={newsSlot1Items} />
              ) : (
                <a
                  href="/admin/news-media"
                  className="block h-full overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 shadow-sm transition hover:bg-gray-100"
                >
                  <div className="flex h-full min-h-[200px] w-full items-center justify-center px-4 text-center text-xs text-gray-500">
                    Section 1 — add media in News &amp; Media
                  </div>
                </a>
              )}
            </div>

            {/* Right — News & Media Section 2 (managed in /admin/news-media) */}
            <div>
              {newsSlot2Items.length > 0 ? (
                <NewsMediaSlot slot={2} items={newsSlot2Items} />
              ) : (
                <a
                  href="/admin/news-media"
                  className="block h-full overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 shadow-sm transition hover:bg-gray-100"
                >
                  <div className="flex h-full min-h-[200px] w-full items-center justify-center px-4 text-center text-xs text-gray-500">
                    Section 2 — add media in News &amp; Media
                  </div>
                </a>
              )}
            </div>
          </div>

        </div>


        {/* ── Dashboard Sections (conditionally rendered) ── */}
        <div className="flex flex-col gap-6">

          {show["income-expenses"] && (
            <IncomeExpensesSection year={selectedYear} />
          )}

          {show["airport-parking"] && <AirportParkingSection year={selectedYear} />}

          {show["commissions"] && <CommissionsSection />}

          {show["operations"] && <OperationsSection />}

          {show["turo-inspections"] && <TuroInspectionsSection />}

          {show["car-issues"] && <CarIssuesSection />}

          {show["maintenance"] && <MaintenanceSection year={selectedYear} />}

          {show["task-management"] && <TaskManagementSection />}

          {show["notice-board"] && <NoticeBoardSection />}

          {show["employee-stats"] && <EmployeeStatsSection />}

          {show["monthly-employee-stats"] && (
            <MonthlyEmployeeStatsSection year={selectedYear} />
          )}

        </div>
      </div>

      {/* Tutorial */}
      {(isAdmin || isClient || isEmployee) && <OnboardingTutorial />}
      <AdminPageLinks />
    </AdminLayout>
  );
}
