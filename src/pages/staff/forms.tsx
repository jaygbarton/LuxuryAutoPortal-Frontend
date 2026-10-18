/**
 * Staff Forms — Income & Expense Receipt + Commission Form
 * Employees can submit expense receipts and commission claims, and view their own submissions.
 */

import { useLocation, useSearch } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminLayout } from "@/components/admin/admin-layout";
import { EmployeePageLinks } from "@/components/staff/EmployeePageLinks";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import ExpenseFormSubmission from "@/pages/admin/forms/ExpenseFormSubmission";
import ExpenseFormMySubmissions from "@/pages/admin/forms/ExpenseFormMySubmissions";
import CommissionFormSubmission from "@/pages/admin/forms/CommissionFormSubmission";
import CommissionFormMySubmissions from "@/pages/admin/forms/CommissionFormMySubmissions";
import CarIssueFormSubmission from "@/pages/admin/forms/CarIssueFormSubmission";
import CarRepairedSubmission from "@/pages/admin/forms/CarRepairedSubmission";
import CarRepairedMySubmissions from "@/pages/admin/forms/CarRepairedMySubmissions";

const TAB_IDS = ["expense", "expense-my", "commission", "commission-my", "car-issue", "car-repaired"] as const;
type TabId = typeof TAB_IDS[number];

export default function StaffForms() {
  // Driven by ?tab= so the sidebar sub-items (STAFF_FORM_TABS in admin-layout)
  // can select a form. This page previously used an uncontrolled
  // <Tabs defaultValue>, which no URL could address.
  const search = useSearch();
  const [, navigate] = useLocation();
  const formNames: Record<TabId, string> = {
    expense: "Income & expense", "expense-my": "My expense submissions",
    commission: "Commission", "commission-my": "My commission submissions",
    "car-issue": "Report a car issue", "car-repaired": "Car repaired",
  };
  const t = new URLSearchParams(search).get("tab");
  const activeTab: TabId = t && (TAB_IDS as readonly string[]).includes(t) ? (t as TabId) : "expense";

  return (
    <AdminLayout>
      <div className="staff-page min-w-0 space-y-4 sm:p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Forms</h1>
          <p className="text-muted-foreground text-sm">
            Submit income, expense receipts, and commission claims.
          </p>
        </div>

        <div className="sm:hidden">
          <label htmlFor="staff-form-section" className="mb-1.5 block text-xs font-medium text-muted-foreground">Choose a form</label>
          <Select value={activeTab} onValueChange={(value) => navigate(`/staff/forms?tab=${value}`)}>
            <SelectTrigger id="staff-form-section" className="h-11 w-full text-base"><SelectValue /></SelectTrigger>
            <SelectContent>{TAB_IDS.map((id) => <SelectItem key={id} value={id}>{formNames[id]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Tabs value={activeTab}>
          <TabsContent value="expense" className="mt-4">
            <ExpenseFormSubmission />
          </TabsContent>
          <TabsContent value="expense-my" className="mt-4">
            <ExpenseFormMySubmissions />
          </TabsContent>
          <TabsContent value="commission" className="mt-4">
            <CommissionFormSubmission />
          </TabsContent>
          <TabsContent value="commission-my" className="mt-4">
            <CommissionFormMySubmissions />
          </TabsContent>
          <TabsContent value="car-issue" className="mt-4">
            <CarIssueFormSubmission />
          </TabsContent>
          <TabsContent value="car-repaired" className="mt-4 space-y-6">
            <CarRepairedSubmission />
            <CarRepairedMySubmissions />
          </TabsContent>
        </Tabs>
      </div>
      <EmployeePageLinks />
    </AdminLayout>
  );
}
