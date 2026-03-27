import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
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
import QuickLinks from "@/components/admin/QuickLinks";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { openTutorial, isOpen: tutorialIsOpen } = useTutorial();
  const queryClient = useQueryClient();
  const hasAttemptedOpen = useRef(false);

  const currentYear = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);

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
      {/* ── Two-column operational layout ───────────────────────────── */}
      <div className="flex flex-col gap-6">

        {/* ── Row 1: Income & Expenses (primary) + Tasks (secondary) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Primary: Income & Expenses — takes 2/3 */}
          <div className="xl:col-span-2">
            <IncomeExpensesSection year={selectedYear} onYearChange={setSelectedYear} />
          </div>

          {/* Secondary: Tasks */}
          <div className="xl:col-span-1">
            <TaskManagementSection />
          </div>
        </div>

        {/* ── Row 2: Operations (primary) + Notice Board (secondary) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <OperationsSection />
          </div>
          <div className="xl:col-span-1">
            <NoticeBoardSection />
          </div>
        </div>

        {/* ── Row 3: Turo Inspections (primary) + Car Issues (secondary) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <TuroInspectionsSection />
          </div>
          <div className="xl:col-span-1">
            <CarIssuesSection />
          </div>
        </div>

        {/* ── Row 4: Maintenance (full width) ── */}
        <MaintenanceSection year={selectedYear} />

        {/* ── Row 5: Airport Parking + Commissions ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AirportParkingSection year={selectedYear} />
          <CommissionsSection />
        </div>

        {/* ── Row 6: Employee Stats ── */}
        <EmployeeStatsSection />

        {/* ── Row 7: Monthly Employee Stats ── */}
        <MonthlyEmployeeStatsSection year={selectedYear} />

        {/* ── Row 8: Quick Links ── */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Quick Links</h2>
          <QuickLinks />
        </div>
      </div>

      {/* Tutorial */}
      {(isAdmin || isClient || isEmployee) && <OnboardingTutorial />}
    </AdminLayout>
  );
}
