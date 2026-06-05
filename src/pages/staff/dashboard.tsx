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
import { useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { EmployeePageLinks } from "@/components/staff/EmployeePageLinks";
import {
  EmployeeProfileSection,
  CommissionsSection,
  EarningsHistorySection,
  LoggedHoursSection,
  MyPickupDropoffSection,
  MyTuroInspectionsSection,
  MyCarIssuesSection,
  MyMaintenanceSection,
  MyTasksSection,
  MyCarBlockOffSection,
  MyWorkScheduleSection,
  MyEmployeeStatsSection,
  MyMonthlyStatsSection,
  EmployeeNoticeBoardSection,
} from "@/components/staff/dashboard";
import { SectionHeader } from "@/components/admin/dashboard";
import { SlidersHorizontal, ChevronDown } from "lucide-react";

const STORAGE_KEY = "staff-dashboard-visible-sections";

const ALL_SECTIONS = [
  { id: "earnings",      label: "Total Earnings & Pay Period" },
  { id: "commissions",   label: "Commissions" },
  { id: "schedule",      label: "Work Schedule" },
  { id: "hours",         label: "Logged Hours" },
  { id: "operations",    label: "Operations (Pick Up / Drop Off)" },
  { id: "turo",          label: "Turo Messages / Inspections" },
  { id: "carissues",     label: "Car Issues / Inspections" },
  { id: "maintenance",   label: "Maintenance" },
  { id: "tasks",         label: "Task Management" },
  { id: "carblockoff",   label: "Car Block Off" },
  { id: "noticeboard",   label: "Notice Board" },
  { id: "stats-daily",   label: "Employee Stats — Daily" },
  { id: "stats-monthly", label: "Employee Stats — Monthly" },
] as const;

type SectionId = typeof ALL_SECTIONS[number]["id"];

function loadVisible(): Set<SectionId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SectionId[];
      if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
    }
  } catch {}
  // Default: all visible
  return new Set(ALL_SECTIONS.map((s) => s.id));
}

export default function StaffDashboard() {
  const [visible, setVisible] = useState<Set<SectionId>>(loadVisible);
  const [panelOpen, setPanelOpen] = useState(false);

  const toggle = (id: SectionId) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const show = (id: SectionId) => visible.has(id);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background">
        <div className="space-y-4 px-4 pt-6 sm:px-6">
          {/* Profile banner — always visible */}
          <EmployeeProfileSection />

          {/* Filter Sections button + panel — mirrors the admin dashboard:
              count badge, chevron, Select All / Deselect All, checkbox grid. */}
          <div className="flex flex-col items-start">
            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter Sections
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {visible.size}/{ALL_SECTIONS.length}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${panelOpen ? "rotate-180" : ""}`}
              />
            </button>

            {panelOpen && (
              <div className="mt-2 w-full rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const all = new Set(ALL_SECTIONS.map((s) => s.id));
                      setVisible(all);
                      localStorage.setItem(STORAGE_KEY, JSON.stringify([...all]));
                    }}
                    disabled={visible.size === ALL_SECTIONS.length}
                    className="text-xs font-medium text-amber-600 hover:text-amber-800 disabled:text-muted-foreground"
                  >
                    Select All
                  </button>
                  <span className="text-border">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setVisible(new Set());
                      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
                    }}
                    disabled={visible.size === 0}
                    className="text-xs font-medium text-amber-600 hover:text-amber-800 disabled:text-muted-foreground"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {ALL_SECTIONS.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={visible.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="h-4 w-4 rounded border-border text-amber-600 focus:ring-amber-500"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-2 pt-2">
            {show("earnings")    && <EarningsHistorySection />}
            {show("commissions") && <CommissionsSection />}
            {show("schedule")    && <MyWorkScheduleSection />}
            {show("hours")       && <LoggedHoursSection />}
            {show("operations")  && (
              <div>
                <SectionHeader title="OPERATIONS" />
                <MyPickupDropoffSection />
              </div>
            )}
            {show("turo")        && <MyTuroInspectionsSection />}
            {show("carissues")   && <MyCarIssuesSection />}
            {show("maintenance") && <MyMaintenanceSection />}
            {show("tasks")       && <MyTasksSection />}
            {show("carblockoff") && <MyCarBlockOffSection />}
            {show("noticeboard") && <EmployeeNoticeBoardSection />}
            {show("stats-daily") && <MyEmployeeStatsSection />}
            {show("stats-monthly") && <MyMonthlyStatsSection />}

            {visible.size === 0 && (
              <div className="py-20 text-center text-muted-foreground">
                <p className="text-lg font-medium">No sections selected</p>
                <p className="mt-1 text-sm">
                  Use the <strong>Filter Sections</strong> button above to choose
                  which sections to display.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <EmployeePageLinks />
    </AdminLayout>
  );
}
