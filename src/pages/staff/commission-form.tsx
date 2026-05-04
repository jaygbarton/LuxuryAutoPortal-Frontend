/**
 * Staff – Commission Form page (view-only)
 * Employees can only view their commission submissions. Admins manage entries.
 */

import { AdminLayout } from "@/components/admin/admin-layout";
import CommissionFormMySubmissions from "@/pages/admin/forms/CommissionFormMySubmissions";
import { DollarSign } from "lucide-react";

export default function StaffCommissionForm() {
  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            My Commission Submissions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View your commission records submitted by the admin.
          </p>
        </div>

        <CommissionFormMySubmissions />
      </div>
    </AdminLayout>
  );
}
