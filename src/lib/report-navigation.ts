export const reportSections: Record<string, { label: string; title: string }> =
  {
    managementOwner: {
      label: "Owner / management split",
      title: "CAR MANAGEMENT - OWNER SPLIT",
    },
    incomeExpenses: { label: "Income", title: "INCOME & EXPENSES" },
    directDelivery: {
      label: "Direct delivery",
      title: "OPERATING EXPENSE (Direct Delivery)",
    },
    cogs: {
      label: "Vehicle costs (COGS)",
      title: "OPERATING EXPENSE (COGS - Per Vehicle)",
    },
    officeSupport: {
      label: "Office support",
      title: "OPERATING EXPENSES (OFFICE SUPPORT)",
    },
    incomeExpenseSummary: {
      label: "Income & expense summary",
      title: "INCOME & EXPENSES SUMMARY",
    },
    history: { label: "Financial history", title: "HISTORY" },
    rentalValue: { label: "Rental value", title: "CAR RENTAL VALUE PER MONTH" },
  };
export function reportSectionId(title: string) {
  return Object.keys(reportSections).find(
    (key) => reportSections[key].title === title,
  );
}
export function legacyCarDestination(section: string, query: URLSearchParams) {
  const id = query.get("carId") || query.get("car_id") || query.get("id");
  if (!id || !/^\d+$/.test(id) || Number(id) < 1) return "/cars";
  const base = `/admin/cars/${encodeURIComponent(id)}`;
  const suffix: Record<string, string> = {
    detail: "",
    income: "/income-expense",
    expenses: "/expenses",
    depreciation: "/depreciation",
    totals: "/totals",
    calculator: "/calculator",
    earnings: "/earnings",
  };
  const target =
    section === "officeSupport"
      ? "/admin/income-expenses"
      : section in reportSections
        ? `${base}/income-expense`
        : `${base}${suffix[section] ?? "/income-expense"}`;
  const next = new URLSearchParams();
  if (section in reportSections) next.set("section", section);
  if (/^\d{4}$/.test(query.get("year") || ""))
    next.set("year", query.get("year")!);
  if (/^(?:[1-9]|1[0-2])$/.test(query.get("month") || ""))
    next.set("month", query.get("month")!);
  return `${target}${next.size ? "?" + next : ""}`;
}
