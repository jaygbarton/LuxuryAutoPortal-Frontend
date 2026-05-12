/**
 * Employee Dashboard — modeled after the design in DASHBOARD DESIGN - EMPLOYEES.pdf.
 *
 * Section order (matches PDF screenshots exactly):
 *   1.  Profile banner (always visible — logo, avatar, company photo, monthly update video)
 *   2.  Total Earnings (left) + Pay Period (right)
 *   3.  Commissions
 *   4.  Operations
 *   5.  Pick Up & Drop Off
 *   6.  Turo Messages / Inspections
 *   7.  Car Issues / Inspections
 *   8.  Maintenance
 *   9.  Task Management
 *   10. Notice Board
 *   11. Employee Stats — Daily (individual)
 *   12. Employee Stats — Monthly (individual)
 *   --- additional (toggleable) ---
 *   13. Work Schedule
 *
 * Each section can be toggled via the Filter Sections panel; preference is
 * persisted in localStorage.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { buildApiUrl } from "@/lib/queryClient";
import {
  EmployeeProfileSection,
  CommissionsSection,
  EarningsHistorySection,
  MyPickupDropoffSection,
  MyTuroInspectionsSection,
  MyCarIssuesSection,
  MyMaintenanceSection,
  MyOperationsSection,
  MyTasksSection,
  MyWorkScheduleSection,
  MyEmployeeStatsSection,
  MyMonthlyStatsSection,
  EmployeeNoticeBoardSection,
} from "@/components/staff/dashboard";
import { Filter, ChevronDown } from "lucide-react";

const STORAGE_KEY = "gla-staff-dashboard-sections-v5";

interface SectionDef {
  id: string;
  label: string;
}

const ALL_SECTIONS: SectionDef[] = [
  // Primary sections — matches PDF order exactly
  { id: "earnings", label: "Total Earnings / Pay Period" },
  { id: "commissions", label: "Commissions" },
  { id: "operations", label: "Operations" },
  { id: "pickup-dropoff", label: "Pick Up & Drop Off" },
  { id: "turo-inspections", label: "Turo Messages / Inspections" },
  { id: "car-issues", label: "Car Issues / Inspections" },
  { id: "maintenance", label: "Maintenance" },
  { id: "my-tasks", label: "Task Management" },
  { id: "notice-board", label: "Notice Board" },
  { id: "my-stats-daily", label: "Employee Stats (Daily)" },
  { id: "my-stats-monthly", label: "Employee Stats (Monthly)" },
  // Additional sections at end
  { id: "my-work-schedule", label: "Work Schedule" },
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
  return new Set(ALL_IDS);
}

export default function StaffDashboard() {
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
    [visible]
  );

  const { data: userData } = useQuery<{
    user?: { firstName?: string; lastName?: string };
  }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!r.ok) return { user: undefined };
      return r.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const greeting =
    `${userData?.user?.firstName ?? ""}`.trim() ||
    `${userData?.user?.lastName ?? ""}`.trim() ||
    "there";

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background">
        {/* Header banner */}
        <div className="mb-6 border-b border-gray-200 bg-white px-4 py-5 sm:px-6">
          <h1 className="text-2xl font-semibold text-[#B8860B]">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Welcome back, <span className="font-medium text-gray-900">{greeting}</span>. Here&apos;s
            your activity overview.
          </p>
        </div>

        <div className="space-y-4 px-4 sm:px-6">
          {/* Profile banner — always visible */}
          <EmployeeProfileSection />

          {/* Section filter */}
          <div>
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <Filter className="h-4 w-4" />
              Filter Sections
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {visible.size}/{ALL_SECTIONS.length}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${filterOpen ? "rotate-180" : ""}`}
              />
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

          {/* Sections — matches PDF order exactly */}
          <div className="flex flex-col gap-2 pt-2">
            {show["earnings"] && <EarningsHistorySection />}
            {show["commissions"] && <CommissionsSection />}
            {show["operations"] && <MyOperationsSection />}
            {show["pickup-dropoff"] && <MyPickupDropoffSection />}
            {show["turo-inspections"] && <MyTuroInspectionsSection />}
            {show["car-issues"] && <MyCarIssuesSection />}
            {show["maintenance"] && <MyMaintenanceSection />}
            {show["my-tasks"] && <MyTasksSection />}
            {show["notice-board"] && <EmployeeNoticeBoardSection />}
            {show["my-stats-daily"] && <MyEmployeeStatsSection />}
            {show["my-stats-monthly"] && <MyMonthlyStatsSection />}
            {show["my-work-schedule"] && <MyWorkScheduleSection />}

            {noneSelected && (
              <div className="py-20 text-center text-gray-400">
                <p className="text-lg font-medium">No sections selected</p>
                <p className="mt-1 text-sm">
                  Use the <strong>Filter Sections</strong> button above to choose which sections
                  to display.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
