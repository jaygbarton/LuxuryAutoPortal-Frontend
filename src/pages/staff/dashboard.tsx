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

export default function StaffDashboard() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-background">
        <div className="space-y-4 px-4 pt-6 sm:px-6">
          {/* Profile banner — always visible */}
          <EmployeeProfileSection />

          {/* Sections */}
          <div className="flex flex-col gap-2 pt-2">
            <EarningsHistorySection />
            <CommissionsSection />
            <MyWorkScheduleSection />
            <LoggedHoursSection />
            <div>
              <SectionHeader title="OPERATIONS" />
              <MyPickupDropoffSection />
            </div>
            <MyTuroInspectionsSection />
            <MyCarIssuesSection />
            <MyMaintenanceSection />
            <MyTasksSection />
            <EmployeeNoticeBoardSection />
            <MyEmployeeStatsSection />
            <MyMonthlyStatsSection />
          </div>
        </div>
      </div>
      <EmployeePageLinks />
    </AdminLayout>
  );
}
