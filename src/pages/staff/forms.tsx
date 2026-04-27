/**
 * Staff Forms — single Income & Expense Receipt submission form.
 * The previous category-list view (Income, Direct Delivery, COGS, Reimbursed Bills)
 * was replaced per product request: employees now go straight to the form and
 * pick the category/expense type from inside it.
 */

import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import ExpenseFormSubmission from "@/pages/admin/forms/ExpenseFormSubmission";
import { Send } from "lucide-react";

export default function StaffForms() {
  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Forms</h1>
            <p className="text-muted-foreground text-sm">
              Submit income and expense receipts.
            </p>
          </div>
          <Link href="/staff/forms/my-submissions">
            <Button variant="outline" className="gap-2">
              <Send className="h-4 w-4" />
              My submissions
            </Button>
          </Link>
        </div>

        <ExpenseFormSubmission />
      </div>
    </AdminLayout>
  );
}
