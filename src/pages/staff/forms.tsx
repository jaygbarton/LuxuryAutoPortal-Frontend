/**
 * Staff Forms – List of form types by category (v1 employee Forms parity).
 * Categories: Income & Expenses, Direct Delivery, COGS, Reimbursed and Non-Reimbursed Bills.
 * Each item links to submit form with category and field pre-selected.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/queryClient";
import { ChevronDown, ChevronRight, FileText, Loader2, Send } from "lucide-react";

const CATEGORY_META: Record<string, { title: string }> = {
  income: { title: "Income & Expenses" },
  directDelivery: { title: "Operating Expenses (Direct Delivery)" },
  cogs: { title: "Operating Expenses (COGS - Per Vehicle)" },
  reimbursedBills: { title: "Reimbursed and Non-Reimbursed Bills" },
};

const CATEGORY_ORDER: (keyof typeof CATEGORY_META)[] = [
  "income",
  "directDelivery",
  "cogs",
  "reimbursedBills",
];

export default function StaffForms() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    income: true,
    directDelivery: false,
    cogs: false,
    reimbursedBills: false,
  });

  const { data: optionsData, isLoading } = useQuery<{
    data?: { categoryFields?: Record<string, { value: string; label: string }[]> };
  }>({
    queryKey: ["/api/expense-form-submissions/options"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/expense-form-submissions/options"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load forms");
      return res.json();
    },
  });

  const categoryFields = optionsData?.data?.categoryFields ?? {};
  const toggle = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Forms</h1>
            <p className="text-muted-foreground text-sm">
              Submit income and expense receipts. Select a form type below to open the submission form.
            </p>
          </div>
          <Link href="/staff/forms/my-submissions">
            <Button variant="outline" className="gap-2">
              <Send className="h-4 w-4" />
              My submissions
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Form types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-0 rounded-md border">
                {CATEGORY_ORDER.map((categoryKey) => {
                  const meta = CATEGORY_META[categoryKey];
                  const fields = categoryFields[categoryKey] ?? [];
                  const isOpen = openSections[categoryKey] ?? false;
                  if (fields.length === 0) return null;
                  return (
                    <div key={categoryKey} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggle(categoryKey)}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium hover:bg-muted/50 transition-colors"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        {meta?.title ?? categoryKey}
                      </button>
                      {isOpen && (
                        <ul className="bg-muted/20">
                          {fields.map((item: { value: string; label: string }) => (
                            <li key={item.value}>
                              <Link
                                href={`/staff/forms/submit?category=${encodeURIComponent(categoryKey)}&field=${encodeURIComponent(item.value)}`}
                                className="block px-4 py-2.5 pl-10 hover:bg-muted/50 transition-colors capitalize text-sm"
                              >
                                {item.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
