/**
 * Employee profile banner — top of the staff dashboard.
 * Shows name, contact info, address, SSN/EIN and pay rate.
 */
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { EmployeeDocumentImage } from "@/components/admin/EmployeeDocumentImage";
import { Image, Mail, Phone, ShieldCheck, DollarSign } from "lucide-react";
import { NewsMediaSlot } from "@/pages/client/_components/NewsMediaSlot";

interface MeEmployeeResponse {
  success: boolean;
  data: {
    employee_aid: number;
    employee_first_name?: string | null;
    employee_middle_name?: string | null;
    employee_last_name?: string | null;
    employee_email?: string | null;
    employee_mobile_number?: string | null;
    employee_ssn_ein?: string | null;
    employee_street?: string | null;
    employee_city?: string | null;
    employee_state?: string | null;
    employee_zip_code?: string | null;
    employee_photo?: string | null;
    employee_job_pay_job_title_name?: string | null;
    employee_job_pay_department_name?: string | null;
    employee_job_pay_work_email?: string | null;
    employee_job_pay_salary_rate?: string | null;
  };
}

function unspecified(v: string | null | undefined): string {
  return (v ?? "").trim() || "Unspecified";
}

function formatRate(v: string | null | undefined): string {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "$0.00" : `$${n.toFixed(2)}`;
}

export default function EmployeeProfileSection() {
  const { data, isLoading } = useQuery<MeEmployeeResponse>({
    queryKey: ["/api/me/employee"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/me/employee"), { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load employee");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Admin-uploaded media (same source as /admin/dashboard)
  const { data: newsDashboardData } = useQuery<{ success: boolean; slot1: any[]; slot2: any[] }>({
    queryKey: ["/api/news-media/dashboard"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/news-media/dashboard"), { credentials: "include" });
      if (!res.ok) return { success: false, slot1: [], slot2: [] };
      return res.json();
    },
    retry: false,
  });
  const newsSlot1Items = newsDashboardData?.slot1 ?? [];
  const newsSlot2Items = newsDashboardData?.slot2 ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex animate-pulse items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-200" />
            <div className="h-4 w-1/4 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  const e = data?.data;
  if (!e) return null;

  const fullName = [e.employee_first_name, e.employee_middle_name, e.employee_last_name]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const address = [e.employee_street, e.employee_city, e.employee_state, e.employee_zip_code]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  const email = e.employee_job_pay_work_email?.trim() || e.employee_email || "";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
        {/* Column 1 — Info + Photo */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="space-y-0.5 text-sm text-gray-800">
            <div>
              <span className="font-semibold">First Name:</span>{" "}
              {unspecified(e.employee_first_name)}
            </div>
            <div>
              <span className="font-semibold">Middle Name:</span>{" "}
              {unspecified(e.employee_middle_name)}
            </div>
            <div>
              <span className="font-semibold">Last Name:</span>{" "}
              {unspecified(e.employee_last_name)}
            </div>
            {e.employee_mobile_number && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-semibold">Mobile Number:</span>
                <span>{e.employee_mobile_number}</span>
              </div>
            )}
            {email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-semibold">Email:</span>
                <span className="truncate">{email}</span>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-0.5 text-sm text-gray-800">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-semibold">SSN or EIN:</span>
              <span className="font-mono text-xs">{unspecified(e.employee_ssn_ein)}</span>
            </div>
            <div>
              <span className="font-semibold">Street:</span> {unspecified(e.employee_street)}
            </div>
            <div>
              <span className="font-semibold">City:</span> {unspecified(e.employee_city)}
            </div>
            <div>
              <span className="font-semibold">State:</span> {unspecified(e.employee_state)}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-sm">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-emerald-700">
              Rate: {formatRate(e.employee_job_pay_salary_rate)}
            </span>
          </div>
        </div>

        {/* Logo + avatar + role */}
        <div className="flex flex-shrink-0 flex-col items-center gap-1">
          <img
            src="/logo.png"
            alt="Golden Luxury Auto"
            className="h-16 w-auto object-contain sm:h-20"
          />
          {e.employee_photo ? (
            <EmployeeDocumentImage
              value={e.employee_photo}
              alt="Profile"
              className="h-24 w-24 rounded-full border-2 border-[#d3bc8d] object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#d3bc8d] bg-gray-50">
              <Image className="h-10 w-10 text-gray-400" />
            </div>
          )}
          <h1 className="text-center font-serif text-base italic text-[#B8860B]">
            {fullName || "Employee"}
          </h1>
          {e.employee_job_pay_job_title_name && (
            <span className="text-xs font-bold uppercase tracking-wide text-gray-800">
              {e.employee_job_pay_job_title_name}
            </span>
          )}
        </div>
        </div>

        {/* News & Media Slot 1 — admin-uploaded media (synced with /admin/dashboard) */}
        <div>
          {newsSlot1Items.length > 0 ? (
            <NewsMediaSlot slot={1} items={newsSlot1Items} />
          ) : (
            <div className="flex h-full min-h-[200px] w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-xs text-gray-500">
              No media uploaded for Slot 1.
            </div>
          )}
        </div>

        {/* News & Media Slot 2 — admin-uploaded media (synced with /admin/dashboard) */}
        <div>
          {newsSlot2Items.length > 0 ? (
            <NewsMediaSlot slot={2} items={newsSlot2Items} />
          ) : (
            <div className="flex h-full min-h-[200px] w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-xs text-gray-500">
              No media uploaded for Slot 2.
            </div>
          )}
        </div>
      </div>

      {(e.employee_job_pay_department_name || e.employee_job_pay_job_title_name) && (
        <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span className="font-semibold text-gray-700">
            {unspecified(e.employee_job_pay_job_title_name)}
          </span>
          <span className="mx-2 text-gray-300">•</span>
          <span>{unspecified(e.employee_job_pay_department_name)}</span>
        </div>
      )}
    </div>
  );
}
