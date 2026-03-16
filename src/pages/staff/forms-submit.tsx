/**
 * Staff Forms – Submit expense form with optional category/field from URL.
 * URL: /staff/forms/submit?category=...&field=...
 */

import { Link, useSearch } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import ExpenseFormSubmission from "@/pages/admin/forms/ExpenseFormSubmission";
import { ArrowLeft } from "lucide-react";

const VALID_CATEGORIES = ["income", "directDelivery", "cogs", "reimbursedBills"];

export default function StaffFormsSubmit() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const category = params.get("category") ?? undefined;
  const field = params.get("field") ?? undefined;
  const initialCategory = category && VALID_CATEGORIES.includes(category) ? category : undefined;
  const initialField = field?.trim() || undefined;

  return (
    <AdminLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Link href="/staff/forms">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Forms
            </Button>
          </Link>
        </div>
        <ExpenseFormSubmission initialCategory={initialCategory} initialField={initialField} />
      </div>
    </AdminLayout>
  );
}
