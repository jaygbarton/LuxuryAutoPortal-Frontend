import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { NewsMediaSlot } from "@/pages/client/_components/NewsMediaSlot";
import { buildApiUrl } from "@/lib/queryClient";
import IncomeExpensesSection from "@/components/admin/dashboard/IncomeExpensesSection";
import AirportParkingSection from "@/components/admin/dashboard/AirportParkingSection";
import CommissionsSection from "@/components/admin/dashboard/CommissionsSection";
import OperationsSection from "@/components/admin/dashboard/OperationsSection";
import TuroInspectionsSection from "@/components/admin/dashboard/TuroInspectionsSection";
import CarIssuesSection from "@/components/admin/dashboard/CarIssuesSection";
import MaintenanceSection from "@/components/admin/dashboard/MaintenanceSection";
import TaskManagementSection from "@/components/admin/dashboard/TaskManagementSection";
import NoticeBoardSection from "@/components/admin/dashboard/NoticeBoardSection";
import EmployeeStatsSection from "@/components/admin/dashboard/EmployeeStatsSection";
import MonthlyEmployeeStatsSection from "@/components/admin/dashboard/MonthlyEmployeeStatsSection";

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

export default function AdminDashboardPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [visible, setVisible] = useState<Set<string>>(loadVisibleSections);
  const [filterOpen, setFilterOpen] = useState(false);

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

  const slot1Items = newsDashboardData?.slot1 ?? [];
  const slot2Items = newsDashboardData?.slot2 ?? [];

  // Persist to localStorage whenever visible changes
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

  useEffect(() => {
    document.title = "Admin Dashboard | GLA";
  }, []);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background">
        {/* Brand Header */}
        <div className="mb-8 border-b border-gray-200 bg-white px-6 py-6">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 md:grid-cols-3">
            {/* Left — Logo */}
            <div className="flex justify-center md:justify-start">
              <img
                src="/logo.png"
                alt="Golden Luxury Auto"
                className="h-32 w-auto object-contain"
              />
            </div>

            {/* Center — News & Media Section 1 (managed in /admin/news-media) */}
            <div className="flex justify-center">
              <div className="w-full max-w-[360px]">
                {slot1Items.length > 0 ? (
                  <NewsMediaSlot slot={1} items={slot1Items} />
                ) : (
                  <a
                    href="/admin/news-media"
                    className="block overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 shadow-sm transition hover:bg-gray-100"
                  >
                    <div className="flex aspect-video w-full items-center justify-center text-center text-xs text-gray-500">
                      Section 1 — add media in News &amp; Media
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* Right — News & Media Section 2 (managed in /admin/news-media) */}
            <div className="flex justify-center md:justify-end">
              <div className="w-full max-w-[360px]">
                {slot2Items.length > 0 ? (
                  <NewsMediaSlot slot={2} items={slot2Items} />
                ) : (
                  <a
                    href="/admin/news-media"
                    className="block overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 shadow-sm transition hover:bg-gray-100"
                  >
                    <div className="flex aspect-video w-full items-center justify-center text-center text-xs text-gray-500">
                      Section 2 — add media in News &amp; Media
                    </div>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Subtitle */}
          <p className="mt-4 text-center text-sm font-semibold uppercase tracking-widest text-gray-500">
            Admin Dashboard
          </p>
        </div>

        {/* ── Section Filter Panel ── */}
        <div className="mx-auto mb-6 max-w-7xl px-6">
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

        {show["income-expenses"] && (
          <IncomeExpensesSection year={year} onYearChange={setYear} />
        )}

        {show["airport-parking"] && <AirportParkingSection year={year} />}

        {show["commissions"] && <CommissionsSection />}

        {show["operations"] && <OperationsSection />}

        {show["turo-inspections"] && <TuroInspectionsSection />}

        {show["car-issues"] && <CarIssuesSection />}

        {show["maintenance"] && <MaintenanceSection year={year} />}

        {show["task-management"] && <TaskManagementSection />}

        {show["notice-board"] && <NoticeBoardSection />}

        {show["employee-stats"] && <EmployeeStatsSection />}

        {show["monthly-employee-stats"] && (
          <MonthlyEmployeeStatsSection year={year} />
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
      <AdminPageLinks />
    </AdminLayout>
  );
}
