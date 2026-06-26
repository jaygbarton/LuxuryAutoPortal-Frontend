/**
 * Lists every Income & Expense sub-category (per main category) as a quick
 * link that pre-fills the receipt form for that sub-category. This is the
 * "form per sub-category" view on the Forms page: when an admin adds a new
 * sub-category in Income & Expenses, it shows up here automatically (the list
 * comes from the same category/field options the form dropdown uses), each
 * with its own copyable link.
 *
 * Layout (per QA request): the three operating-expense categories are arranged
 * as TABS, each listing its sub-categories, and every sub-category gets its own
 * icon. Submitting any of these links still files back into Income & Expenses
 * on approval — the link only pre-selects (category, field); the existing
 * submission pipeline is untouched.
 *
 * Visible to Admin, Employees, and Co-Hosts: the backend `/options` endpoint
 * already scopes `categoryFields` per role (employees see the approved
 * whitelist, co-hosts see their fleet), so this component just renders whatever
 * it receives.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Link2,
  // sub-category icons
  Sparkles,
  Car,
  PlaneTakeoff,
  ParkingSquare,
  CarTaxiFront,
  Wrench,
  AlignVerticalJustifyCenter,
  BatteryCharging,
  Disc,
  CreditCard,
  ShieldCheck,
  Baby,
  SprayCan,
  Gauge,
  MapPin,
  KeyRound,
  FileText,
  Hammer,
  Droplet,
  Cog,
  Snowflake,
  Receipt,
  Wind,
  CircleDot,
  Truck,
  Square,
  Fan,
  Zap,
  Fuel,
  Route,
  type LucideIcon,
} from "lucide-react";
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
  reimbursedBills: "Reimburse & Non-Reimburse Bills",
};

/** Short labels for the tab strip (full labels are long). */
const TAB_LABELS: Record<ExpenseFormCategory, string> = {
  income: "Income & Expenses",
  directDelivery: "Direct Delivery",
  cogs: "COGS - Per Vehicle",
  reimbursedBills: "Reimburse / Non-Reimburse",
};

const ORDER: ExpenseFormCategory[] = ["directDelivery", "cogs", "reimbursedBills", "income"];

type FieldOption = { value: string; label: string };

/** Normalize a sub-category label the same way the backend does, so icon
 * lookup survives spacing/punctuation/case differences ("Labor - Delivery"
 * vs "labor delivery"). */
function normalize(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Icon per sub-category, keyed by normalized label. Covers every sub-category
 * from the QA list (including alternate spellings). Anything unmatched — a
 * newly-added or renamed sub-category — falls back to the generic link icon.
 */
const ICON_BY_LABEL: Record<string, LucideIcon> = {
  // Direct Delivery
  laborcleaning: Sparkles,
  laborcarcleaning: Sparkles,
  labordelivery: Car,
  parkingairport: PlaneTakeoff,
  parkinglot: ParkingSquare,
  uberlyftlime: CarTaxiFront,

  // COGS - Per Vehicle
  autobodyshopwreck: Wrench,
  alignment: AlignVerticalJustifyCenter,
  battery: BatteryCharging,
  brakes: Disc,
  carpayment: CreditCard,
  carinsurance: ShieldCheck,
  carseats: Baby,
  cleaningsuppliestools: SprayCan,
  emissions: Gauge,
  gpssystem: MapPin,
  keysfob: KeyRound,
  keyfob: KeyRound,
  windshield: Square,
  wipers: Fan,
  towingimpoundfees: Truck,
  tiredairstation: Wind,
  tireairstation: Wind,
  tires: CircleDot,
  oillube: Droplet,
  parts: Cog,
  skiracks: Snowflake,
  ticketstolls: Receipt,
  tickets: Receipt,
  mechanic: Hammer,
  licenseregistration: FileText,

  // Reimburse & Non-Reimburse Bills
  electricreimbursed: Zap,
  electricnotreimbursed: Zap,
  gasreimbursed: Fuel,
  gasnotreimbursed: Fuel,
  gasservicerun: Route,
  uberlyftlimenotreimbursed: CarTaxiFront,
  uberlyftlimereimbursed: CarTaxiFront,
};

function iconFor(label: string): LucideIcon {
  return ICON_BY_LABEL[normalize(label)] ?? Link2;
}

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

  const sections = useMemo(
    () => ORDER.filter((cat) => (categoryFields[cat]?.length ?? 0) > 0),
    [categoryFields],
  );

  const [activeTab, setActiveTab] = useState<ExpenseFormCategory | null>(null);
  const currentTab: ExpenseFormCategory | undefined =
    (activeTab && sections.includes(activeTab) ? activeTab : undefined) ?? sections[0];

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

  if (sections.length === 0 || !currentTab) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Subcategory form links</h3>
        <p className="text-xs text-muted-foreground">
          Pick a category tab, then open any subcategory to fill out the receipt form pre-set to
          it. Approved submissions still file back into Income &amp; Expenses. New subcategories
          added in Income &amp; Expenses appear here automatically.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border">
        {sections.map((cat) => {
          const active = cat === currentTab;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
              className={
                "px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 -mb-px transition-colors " +
                (active
                  ? "border-[#B8860B] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
              title={CATEGORY_LABELS[cat]}
            >
              {TAB_LABELS[cat]}
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {categoryFields[cat]?.length ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-categories for the active tab */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {categoryFields[currentTab].map((f) => {
          const Icon = iconFor(f.label);
          return (
            <div
              key={f.value}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
            >
              <a
                href={buildExpenseFormPath(currentTab, f.value)}
                className="flex items-center gap-2 text-xs text-foreground hover:text-[#B8860B] truncate"
                title={`Open receipt form for ${f.label}`}
              >
                <Icon className="w-4 h-4 shrink-0 text-[#B8860B]" />
                <span className="truncate">{f.label}</span>
              </a>
              <button
                onClick={() => copy(currentTab, f.value, f.label)}
                className="text-muted-foreground hover:text-foreground shrink-0"
                title="Copy link"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
