import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { SectionHeader } from "@/components/admin/dashboard";
import IncomeExpensesSection from "@/components/admin/dashboard/IncomeExpensesSection";

const SECTIONS = [
  "AIRPORT PARKING & TRIPS",
  "COMMISSIONS",
  "OPERATIONS — PICK UP AND DROP OFF",
  "TURO MESSAGES INSPECTIONS",
  "CAR ISSUES / INSPECTIONS",
  "MAINTENANCE",
  "TASK MANAGEMENT",
  "NOTICE BOARD",
] as const;

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="mb-8">
      <SectionHeader title={title} />
      <div className="mt-2 rounded-md bg-[#111111] px-6 py-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#FFD700]">
          Phase 2 — Coming Soon
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
      <div className="min-h-screen bg-black">
        {/* Brand Header */}
        <div className="mb-8 px-4 py-6 text-center">
          <div className="mx-auto mb-2 h-[1px] w-48 bg-[#FFD700]" />
          <h1 className="text-2xl font-bold uppercase tracking-widest text-[#FFD700]">
            Golden Luxury Auto
          </h1>
          <div className="mx-auto mt-2 h-[1px] w-48 bg-[#FFD700]" />
          <p className="mt-3 text-sm uppercase tracking-wide text-white/70">
            Admin Dashboard
          </p>
        </div>

        {/* Section 1: Income and Expenses — Phase 2 */}
        <IncomeExpensesSection year={year} onYearChange={setYear} />

        {/* Remaining sections — placeholders */}
        {SECTIONS.map((section) => (
          <PlaceholderSection key={section} title={section} />
        ))}
      </div>
    </AdminLayout>
  );
}
