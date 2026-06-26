import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
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
import CarBlockedOffSection from "@/components/admin/dashboard/CarBlockedOffSection";
import CarOnOffboardingReport from "@/pages/admin/forms/CarOnOffboardingReport";

const ALL_IDS = [
  "income-expenses",
  "airport-parking",
  "commissions",
  "car-onboarding-offboarding",
  "car-blocked-off",
  "operations",
  "turo-inspections",
  "car-issues",
  "maintenance",
  "task-management",
  "notice-board",
  "employee-stats",
  "monthly-employee-stats",
];


export default function AdminDashboardPage() {
  const [year] = useState(String(new Date().getFullYear()));

  const show = useMemo(
    () => Object.fromEntries(ALL_IDS.map((id) => [id, true])),
    [],
  );

  useEffect(() => {
    document.title = "Admin Dashboard | GLA";
  }, []);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background">
        {/* Brand Header */}
        <div className="mb-6 sm:mb-8 border-b border-gray-200 bg-white px-3 sm:px-6 py-4 sm:py-6">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 sm:gap-6 md:grid-cols-3">
            {/* Left — Logo */}
            <div className="flex justify-center md:justify-start">
              <img
                src="/logo.png"
                alt="Golden Luxury Auto"
                className="h-20 sm:h-28 md:h-32 w-auto object-contain"
              />
            </div>

            {/* Center — Fleet Car Image with Link */}
            <div className="flex justify-center">
              <a href="/cars" className="block overflow-hidden rounded-lg shadow-md transition hover:shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                  alt="Golden Luxury Auto Fleet"
                  className="h-44 w-full object-cover"
                />
              </a>
            </div>

            {/* Right — YouTube Video */}
            <div className="flex justify-center md:justify-end">
              <div className="relative aspect-video w-full max-w-[320px] overflow-hidden rounded-lg shadow-md">
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

          {/* Subtitle */}
          <p className="mt-4 text-center text-sm font-semibold uppercase tracking-widest text-gray-500">
            Admin Dashboard
          </p>
        </div>


        {/* ── Dashboard Sections (conditionally rendered) ── */}

        {show["income-expenses"] && (
          <IncomeExpensesSection year={year} />
        )}

        {show["airport-parking"] && <AirportParkingSection year={year} />}

        {show["commissions"] && <CommissionsSection />}

        {show["car-onboarding-offboarding"] && <CarOnOffboardingReport />}

        {show["car-blocked-off"] && <CarBlockedOffSection />}

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

      </div>
      <AdminPageLinks />
    </AdminLayout>
  );
}
