/**
 * Employee profile banner — top of the staff dashboard.
 * Shows name, contact info, address, SSN/EIN and pay rate.
 */
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { EmployeeDocumentImage } from "@/components/admin/EmployeeDocumentImage";
import { Image, Mail, MapPin, Phone, ShieldCheck, DollarSign } from "lucide-react";

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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
        {/* Personal info */}
        <div className="min-w-0 lg:col-span-4">
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

          {(e.employee_ssn_ein || address) && (
            <div className="mt-3 space-y-0.5 text-sm text-gray-800">
              {e.employee_ssn_ein && (
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-semibold">SSN or EIN:</span>
                  <span className="font-mono text-xs">{e.employee_ssn_ein}</span>
                </div>
              )}
              {e.employee_street && (
                <div>
                  <span className="font-semibold">Street:</span> {e.employee_street}
                </div>
              )}
              {e.employee_city && (
                <div>
                  <span className="font-semibold">City:</span> {e.employee_city}
                </div>
              )}
              {e.employee_state && (
                <div>
                  <span className="font-semibold">State:</span> {e.employee_state}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-1.5 text-sm">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-emerald-700">
              Rate: {formatRate(e.employee_job_pay_salary_rate)}
            </span>
          </div>
        </div>

        {/* Logo + avatar + role */}
        <div className="flex flex-col items-center gap-2 lg:col-span-2">
          <img
            src="/logo.png"
            alt="Golden Luxury Auto"
            className="h-20 w-auto object-contain sm:h-24"
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

        {/* Company photo */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
            <img
              src="/company-photo.png"
              alt="Golden Luxury Auto dealership"
              className="aspect-video w-full object-cover"
            />
          </div>
        </div>

        {/* Monthly update YouTube video */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-black shadow-sm">
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube.com/embed/jsdo0yDeFCs?si=Le_SJZ8P7cqyx2Bn"
                title="Golden Luxury Auto Monthly Update"
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
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
