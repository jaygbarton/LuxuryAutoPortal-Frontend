/**
 * Staff Forms — Income & Expense Receipt + Commission Form
 * Employees can submit expense receipts and commission claims, and view their own submissions.
 */

import { useState } from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ExpenseFormSubmission from "@/pages/admin/forms/ExpenseFormSubmission";
import ExpenseFormMySubmissions from "@/pages/admin/forms/ExpenseFormMySubmissions";
import CommissionFormSubmission from "@/pages/admin/forms/CommissionFormSubmission";
import CommissionFormMySubmissions from "@/pages/admin/forms/CommissionFormMySubmissions";
import { ChevronDown, ChevronRight, DollarSign, FileText } from "lucide-react";

type SectionId = "expense" | "expense-my" | "commission" | "commission-my";

export default function StaffForms() {
  const [expanded, setExpanded] = useState<SectionId[]>(["expense"]);

  const toggle = (id: SectionId) =>
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const isOpen = (id: SectionId) => expanded.includes(id);

  const sections: { id: SectionId; label: string; icon: React.ElementType; content: React.ReactNode }[] = [
    {
      id: "expense",
      label: "Income & Expense Receipt Submission",
      icon: DollarSign,
      content: <ExpenseFormSubmission />,
    },
    {
      id: "expense-my",
      label: "My Income & Expense Submissions",
      icon: FileText,
      content: <ExpenseFormMySubmissions />,
    },
    {
      id: "commission",
      label: "Submit Commission Form",
      icon: DollarSign,
      content: <CommissionFormSubmission />,
    },
    {
      id: "commission-my",
      label: "My Commission Submissions",
      icon: FileText,
      content: <CommissionFormMySubmissions />,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Forms</h1>
          <p className="text-muted-foreground text-sm">
            Submit income, expense receipts, and commission claims.
          </p>
        </div>

        <Card className="bg-card border-primary/20 overflow-hidden">
          <CardContent className="p-0">
            {sections.map((section, idx) => {
              const Icon = section.icon;
              const open = isOpen(section.id);
              return (
                <div key={section.id}>
                  {idx > 0 && <div className="border-t border-border" />}
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="text-primary font-medium text-sm">{section.label}</span>
                    </div>
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {open && (
                    <div className="border-t border-border bg-card px-3 sm:px-5 py-4">
                      {section.content}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
