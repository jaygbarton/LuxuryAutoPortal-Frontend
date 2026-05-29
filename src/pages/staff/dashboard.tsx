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
  MyWorkScheduleSection,
  MyEmployeeStatsSection,
  MyMonthlyStatsSection,
  EmployeeNoticeBoardSection,
} from "@/components/staff/dashboard";
import { SectionHeader } from "@/components/admin/dashboard";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

          {/* Filter Sections button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPanelOpen((o) => !o)}
              className="gap-2 text-muted-foreground border-border hover:text-foreground"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filter Sections
            </Button>
          </div>

          {/* Section visibility panel */}
          {panelOpen && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">
                  Show / Hide Sections
                </span>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
                {ALL_SECTIONS.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`vis-${s.id}`}
                      checked={visible.has(s.id)}
                      onCheckedChange={() => toggle(s.id)}
                    />
                    <Label
                      htmlFor={`vis-${s.id}`}
                      className="text-sm cursor-pointer leading-tight"
                    >
                      {s.label}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    const all = new Set(ALL_SECTIONS.map((s) => s.id));
                    setVisible(all);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify([...all]));
                  }}
                >
                  Show all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setVisible(new Set());
                    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
                  }}
                >
                  Hide all
                </Button>
              </div>
            </div>
          )}

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
            {show("noticeboard") && <EmployeeNoticeBoardSection />}
            {show("stats-daily") && <MyEmployeeStatsSection />}
            {show("stats-monthly") && <MyMonthlyStatsSection />}
          </div>
        </div>
      </div>
      <EmployeePageLinks />
    </AdminLayout>
  );
}
