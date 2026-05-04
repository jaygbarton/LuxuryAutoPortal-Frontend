/**
 * Staff – Commission Form My Submissions
 * View-only list of the current employee's commission form submissions
 */

import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import CommissionFormMySubmissions from "@/pages/admin/forms/CommissionFormMySubmissions";
import { ArrowLeft } from "lucide-react";

export default function StaffCommissionFormMySubmissions() {
  return (
    <AdminLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Link href="/staff/commission-form">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back to Form
              </Button>
            </Link>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-primary">My Commission Submissions</h1>
          </div>
        </div>

        <CommissionFormMySubmissions />
      </div>
    </AdminLayout>
  );
}
