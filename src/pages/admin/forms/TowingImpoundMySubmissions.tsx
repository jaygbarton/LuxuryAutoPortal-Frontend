/**
 * Towing & Impound My Submissions
 * Read-only view of the current user's towing & impound submissions + status.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { IncidentMySubmissionsTable, type IncidentRow } from "./IncidentMySubmissionsTable";

interface TowingImpoundRow {
  ti_aid: number;
  ti_client_email: string;
  ti_client_name: string;
  ti_car_label: string;
  ti_incident_type: string | null;
  ti_incident_date: string | null;
  ti_due_date: string | null;
  ti_amount_due: number | string | null;
  ti_total_payment: number | string | null;
  ti_photos: string[];
  ti_status: string;
  ti_date_submitted: string;
}

export default function TowingImpoundMySubmissions() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/towing-impound/my"],
    queryFn: async () => {
      return api.get<{ data?: TowingImpoundRow[] }>("/api/towing-impound/my", {
        fallbackMessage: "Failed to fetch submissions",
      });
    },
  });

  const rows: IncidentRow[] = (data?.data ?? []).map((r) => ({
    id: r.ti_aid,
    carLabel: r.ti_car_label,
    typeLabel: r.ti_incident_type,
    dueDate: r.ti_due_date,
    amountDue: r.ti_amount_due,
    totalPayment: r.ti_total_payment,
    attachments: r.ti_photos,
    status: r.ti_status,
    dateSubmitted: r.ti_date_submitted,
  }));

  return (
    <IncidentMySubmissionsTable
      rows={rows}
      isLoading={isLoading}
      isError={isError}
      detailTitle="Towing & Impound Details"
      typeColumnLabel="Incident Type"
      emptyMessage="No towing & impound incidents submitted yet."
      attachmentsLabel="Document / Photos"
    />
  );
}
