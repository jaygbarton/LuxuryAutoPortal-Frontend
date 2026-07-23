/**
 * Staff Forms — Income & Expense Receipt + Commission Form
 * Employees can submit expense receipts and commission claims, and view their own submissions.
 */

import { useState } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { EmployeePageLinks } from "@/components/staff/EmployeePageLinks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExpenseFormSubmission from "@/pages/admin/forms/ExpenseFormSubmission";
import ExpenseFormMySubmissions from "@/pages/admin/forms/ExpenseFormMySubmissions";
import CommissionFormSubmission from "@/pages/admin/forms/CommissionFormSubmission";
import CommissionFormMySubmissions from "@/pages/admin/forms/CommissionFormMySubmissions";
import CarIssueFormSubmission from "@/pages/admin/forms/CarIssueFormSubmission";
import CarRepairedSubmission from "@/pages/admin/forms/CarRepairedSubmission";
import CarRepairedMySubmissions from "@/pages/admin/forms/CarRepairedMySubmissions";

export default function StaffForms() {
  return (
    <AdminLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Forms</h1>
          <p className="text-muted-foreground text-sm">
            Submit income, expense receipts, and commission claims.
          </p>
        </div>

        <Tabs defaultValue="expense">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="expense">I&amp;E Submission</TabsTrigger>
            <TabsTrigger value="expense-my">My I&amp;E Submissions</TabsTrigger>
            <TabsTrigger value="commission">Commission Form</TabsTrigger>
            <TabsTrigger value="commission-my">My Commissions</TabsTrigger>
            <TabsTrigger value="car-issue">Car Issue Report</TabsTrigger>
            <TabsTrigger value="car-repaired">Car Repaired</TabsTrigger>
          </TabsList>

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
