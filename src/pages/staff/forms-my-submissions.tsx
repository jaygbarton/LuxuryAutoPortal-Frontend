/**
 * Staff Forms – View my expense form submissions (v1 view-submitted-form parity).
 */

import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import ExpenseFormMySubmissions from "@/pages/admin/forms/ExpenseFormMySubmissions";
import { ArrowLeft } from "lucide-react";

export default function StaffFormsMySubmissions() {
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
        <ExpenseFormMySubmissions />
      </div>
    </AdminLayout>
  );
}
