import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { SectionHeader } from "@/components/admin/dashboard";
import IncomeExpensesSection from "@/components/admin/dashboard/IncomeExpensesSection";
import AirportParkingSection from "@/components/admin/dashboard/AirportParkingSection";
import CommissionsSection from "@/components/admin/dashboard/CommissionsSection";
import OperationsSection from "@/components/admin/dashboard/OperationsSection";
import TuroInspectionsSection from "@/components/admin/dashboard/TuroInspectionsSection";

const SECTIONS = [
  "CAR ISSUES / INSPECTIONS",
  "MAINTENANCE",
  "TASK MANAGEMENT",
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
        <div className="mb-8 bg-black px-6 py-6">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 md:grid-cols-3">
            {/* Left — Logo */}
            <div className="flex justify-center md:justify-start">
              <img
                src="/logo.png"
                alt="Golden Luxury Auto"
                className="h-24 object-contain"
              />
            </div>

            {/* Center — Fleet Photo */}
            <div className="flex justify-center">
              <div className="overflow-hidden rounded-lg">
                <img
                  src="/logo.png"
                  alt="Golden Luxury Auto Fleet"
                  className="h-36 w-80 object-cover"
                />
              </div>
            </div>

            {/* Right — YouTube Video */}
            <div className="flex justify-center md:justify-end">
              <div className="relative h-36 w-64 overflow-hidden rounded-lg shadow-lg">
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
          <p className="mt-4 text-center text-sm uppercase tracking-widest text-white/70">
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

        {/* Remaining sections — placeholders */}
        {SECTIONS.map((section) => (
          <PlaceholderSection key={section} title={section} />
        ))}
      </div>
    </AdminLayout>
  );
}
