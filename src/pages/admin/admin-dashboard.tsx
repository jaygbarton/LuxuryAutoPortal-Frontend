import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { SectionHeader } from "@/components/admin/dashboard";
import IncomeExpensesSection from "@/components/admin/dashboard/IncomeExpensesSection";
import AirportParkingSection from "@/components/admin/dashboard/AirportParkingSection";
import CommissionsSection from "@/components/admin/dashboard/CommissionsSection";
import OperationsSection from "@/components/admin/dashboard/OperationsSection";
import TuroInspectionsSection from "@/components/admin/dashboard/TuroInspectionsSection";
import CarIssuesSection from "@/components/admin/dashboard/CarIssuesSection";
import MaintenanceSection from "@/components/admin/dashboard/MaintenanceSection";
import TaskManagementSection from "@/components/admin/dashboard/TaskManagementSection";

const SECTIONS = [
  "NOTICE BOARD",
] as const;

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="mb-8">
      <SectionHeader title={title} />
      <div className="mt-2 rounded-md border border-gray-200 bg-white px-6 py-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Coming Soon
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));

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

        {/* Section 1: Income and Expenses — Phase 2 */}
        <IncomeExpensesSection year={year} onYearChange={setYear} />

        {/* Section 2: Airport Parking & Trips — Phase 3 */}
        <AirportParkingSection year={year} />

        {/* Section 3: Commissions — Phase 4 */}
        <CommissionsSection />

        {/* Section 4: Operations — Phase 5 */}
        <OperationsSection />

        {/* Section 5: Turo Messages Inspections — Phase 6 */}
        <TuroInspectionsSection />

        {/* Section 6: Car Issues / Inspections — Phase 7A */}
        <CarIssuesSection />

        {/* Section 7: Maintenance — Phase 7B */}
        <MaintenanceSection year={year} />

        {/* Section 8: Task Management — Phase 8 */}
        <TaskManagementSection />

        {/* Remaining sections — placeholders */}
        {SECTIONS.map((section) => (
          <PlaceholderSection key={section} title={section} />
        ))}
      </div>
    </AdminLayout>
  );
}
