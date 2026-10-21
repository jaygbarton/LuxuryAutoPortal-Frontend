export interface HubCar {
  id: number;
  name: string;
  plate: string | null;
  vin: string | null;
  photo?: string | null;
}
export interface MaintenanceBrief {
  scope: string;
  openIssueGroups: number;
  originalOpenReports: number;
  repeatedIssueGroups: number;
  scheduledReports: number;
  overdueServices: number;
  dueSoonServices: number;
  historyRecordsInPeriod: number;
  undatedHistoryRecords: number;
  historyWithFiles: number;
  lastServiced: string | null;
  mileage: {
    miles: number | null;
    state: string;
    warning: string | null;
    observedAt: string | null;
    source: string | null;
  } | null;
  attention: {
    id: string;
    label: string;
    status: string;
    dueDate: string | null;
    milesRemaining: number | null;
    source: string;
  }[];
  repeatedReports: {
    id: number;
    issues: string[];
    reports: number;
    trips: number;
    source: string;
  }[];
  limits: { attentionOmitted: number; repeatedGroupsOmitted: number };
  source: string;
  notes: string[];
}
export interface FinancialBrief {
  basis: string;
  currency: string;
  recordedIncome: number | null;
  recordedExpenses: number | null;
  recordedCarProfit: number | null;
  managementSplit: number | null;
  ownerSplit: number | null;
  formula: string;
  recordedIncomeMonths: number[];
  missingIncomeMonths: number[];
  notes: string[];
  source: string;
}
export interface LateReturnsBrief {
  overdueTripsLogged: number;
  resolutionAlertsLogged: number;
  notes: string[];
  source: string;
}
export interface HubSection<T> {
  status: "ready" | "unavailable";
  data: T | null;
  error?: string;
  reference?: string;
}
export interface HubReport {
  schemaVersion: number;
  generatedAt: string;
  refreshAfterSeconds: number;
  aiCreditsUsed: 0;
  status: "ready" | "partial";
  topic: string;
  vehicle: HubCar;
  period: {
    year: number;
    fromMonth: number;
    toMonth: number;
    from: string;
    to: string;
    timezone: string;
  };
  sections: {
    maintenance?: HubSection<MaintenanceBrief>;
    profitability?: HubSection<FinancialBrief>;
    lateReturns?: HubSection<LateReturnsBrief>;
  };
  interpretation: string[];
  evidence: { history: string; service: string };
}
export const hubMoney = (value: number | null | undefined) =>
  value == null
    ? "Not available"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);
export function hubNarrative(report: HubReport): string[] {
  const lines: string[] = [];
  const m = report.sections.maintenance?.data,
    f = report.sections.profitability?.data,
    late = report.sections.lateReturns?.data;
  if (m) {
    lines.push(
      `Currently ${m.openIssueGroups} open maintenance groups contain ${m.originalOpenReports} original reports. ${m.repeatedIssueGroups} groups have repeated reports.`,
    );
    lines.push(
      `${m.overdueServices} services are overdue and ${m.dueSoonServices} are due today or within the service warning threshold.`,
    );
    lines.push(
      `${m.historyRecordsInPeriod} service-history records fall in the selected period; ${m.undatedHistoryRecords} records have no confirmed date.`,
    );
  }
  if (f)
    lines.push(
      f.recordedCarProfit === null
        ? "Recorded car profit cannot be calculated because income entries are missing."
        : `Recorded car profit for the period is ${hubMoney(f.recordedCarProfit)}, using the existing Income & Expenses calculation.${f.missingIncomeMonths.length ? " Income coverage is incomplete." : " These figures still depend on the records entered."}`,
    );
  if (late)
    lines.push(
      `${late.overdueTripsLogged} distinct trips have logged overdue-return alerts in this period. This does not establish how many trips actually returned late or whether any are still late.`,
    );
  if (report.status === "partial")
    lines.push(
      "Some sources could not be verified. This report is incomplete; refresh to retry.",
    );
  return lines;
}
