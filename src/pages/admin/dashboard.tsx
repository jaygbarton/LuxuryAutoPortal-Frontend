import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/* ── Section filter configuration ── */
const STORAGE_KEY = "gla-admin-dashboard-sections";

interface SectionDef {
  id: string;
  label: string;
}

const ALL_SECTIONS: SectionDef[] = [
  { id: "income-expenses", label: "Income & Expenses" },
  { id: "airport-parking", label: "Airport Parking & Trips" },
  { id: "commissions", label: "Commissions" },
  { id: "operations", label: "Operations" },
  { id: "turo-inspections", label: "Turo Inspections" },
  { id: "car-issues", label: "Car Issues" },
  { id: "maintenance", label: "Maintenance" },
  { id: "task-management", label: "Task Management" },
  { id: "notice-board", label: "Notice Board" },
  { id: "employee-stats", label: "Employee Stats" },
  { id: "monthly-employee-stats", label: "Monthly Employee Stats" },
  { id: "quick-links", label: "Quick Links" },
];

const ALL_IDS = ALL_SECTIONS.map((s) => s.id);

function loadVisibleSections(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    /* ignore */
  }
  return new Set(ALL_IDS); // default: show all
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { openTutorial, isOpen: tutorialIsOpen } = useTutorial();
  const queryClient = useQueryClient();
  const hasAttemptedOpen = useRef(false);

  const currentYear = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // ── Section filter state ──
  const [visible, setVisible] = useState<Set<string>>(loadVisibleSections);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visible]));
  }, [visible]);

  const toggle = useCallback((id: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setVisible(new Set(ALL_IDS)), []);
  const deselectAll = useCallback(() => setVisible(new Set()), []);

  const allSelected = visible.size === ALL_IDS.length;
  const noneSelected = visible.size === 0;

  const show = useMemo(
    () => Object.fromEntries(ALL_IDS.map((id) => [id, visible.has(id)])),
    [visible],
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
                className="h-auto w-full max-h-48 object-contain"
              />
            </div>

            {/* Center — Fleet Car Image with Link */}
            <a href="/cars" className="block overflow-hidden rounded-lg shadow-md transition hover:shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Golden Luxury Auto Fleet"
                className="h-full w-full object-cover"
              />
            </a>

            {/* Right — YouTube Video */}
            <div className="relative overflow-hidden rounded-lg shadow-md" style={{ minHeight: "200px" }}>
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube.com/embed/jsdo0yDeFCs?si=Le_SJZ8P7cqyx2Bn"
                title="Golden Luxury Auto Monthly Update"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>

        </div>

        {/* ── Section Filter Panel ── */}
        <div className="mb-6 px-6">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filter Sections
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {visible.size}/{ALL_SECTIONS.length}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${filterOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {filterOpen && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <button
                  onClick={selectAll}
                  disabled={allSelected}
                  className="text-xs font-medium text-amber-600 hover:text-amber-800 disabled:text-gray-400"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAll}
                  disabled={noneSelected}
                  className="text-xs font-medium text-amber-600 hover:text-amber-800 disabled:text-gray-400"
                >
                  Deselect All
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {ALL_SECTIONS.map((section) => (
                  <label
                    key={section.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={visible.has(section.id)}
                      onChange={() => toggle(section.id)}
                      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    {section.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Dashboard Sections (conditionally rendered) ── */}
        <div className="flex flex-col gap-6">

          {show["income-expenses"] && (
            <IncomeExpensesSection year={selectedYear} onYearChange={setSelectedYear} />
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

          {show["quick-links"] && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Quick Links</h2>
              <QuickLinks />
            </div>
          )}

          {noneSelected && (
            <div className="py-20 text-center text-gray-400">
              <p className="text-lg font-medium">No sections selected</p>
              <p className="mt-1 text-sm">
                Use the <strong>Filter Sections</strong> button above to choose
                which reports to display.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tutorial */}
      {(isAdmin || isClient || isEmployee) && <OnboardingTutorial />}
    </AdminLayout>
  );
}
