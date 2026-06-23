/**
 * Lists every Income & Expense sub-category (per main category) as a quick
 * link that pre-fills the receipt form for that sub-category. This is the
 * "form per sub-category" view on the Forms page: when an admin adds a new
 * sub-category in Income & Expenses, it shows up here automatically (the list
 * comes from the same category/field options the form dropdown uses), each
 * with its own copyable link.
 */

import { useQuery } from "@tanstack/react-query";
import { Link2, Copy } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  buildExpenseFormPath,
  buildExpenseFormUrl,
  type ExpenseFormCategory,
} from "../income-expenses/utils/expenseFormLink";

const CATEGORY_LABELS: Record<ExpenseFormCategory, string> = {
  income: "Income & Expenses",
  directDelivery: "Operating Expenses (Direct Delivery)",
  cogs: "Operating Expenses (COGS - Per Vehicle)",
  reimbursedBills: "Reimbursed & Non-Reimbursed Bills",
};

const ORDER: ExpenseFormCategory[] = ["directDelivery", "cogs", "reimbursedBills", "income"];

type FieldOption = { value: string; label: string };

export default function ExpenseSubcategoryLinks() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/expense-form-submissions/options", "subcategory-links"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/expense-form-submissions/options"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch options");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const categoryFields: Record<string, FieldOption[]> = data?.data?.categoryFields || {};

  const copy = async (category: ExpenseFormCategory, field: string, label: string) => {
    const url = buildExpenseFormUrl(category, field);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Form link copied", description: `Opens the receipt form for "${label}".` });
    } catch {
      toast({ title: "Copy this form link", description: url });
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading subcategory forms…</p>;
  }

  const sections = ORDER.filter((cat) => (categoryFields[cat]?.length ?? 0) > 0);
  if (sections.length === 0) return null;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Subcategory form links</h3>
        <p className="text-xs text-muted-foreground">
          Each subcategory below has its own link that opens this form pre-set to it. New
          subcategories added in Income &amp; Expenses appear here automatically.
        </p>
      </div>
      {sections.map((cat) => (
        <div key={cat}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70 mb-2">
            {CATEGORY_LABELS[cat]}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {categoryFields[cat].map((f) => (
              <div
                key={f.value}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                <a
                  href={buildExpenseFormPath(cat, f.value)}
                  className="flex items-center gap-1.5 text-xs text-foreground hover:text-[#B8860B] truncate"
                  title={`Open receipt form for ${f.label}`}
                >
                  <Link2 className="w-3.5 h-3.5 shrink-0 text-[#B8860B]" />
                  <span className="truncate">{f.label}</span>
                </a>
                <button
                  onClick={() => copy(cat, f.value, f.label)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  title="Copy link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
