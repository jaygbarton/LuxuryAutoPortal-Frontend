import { Switch, Route, Redirect } from "wouter";
import { queryClient, getApiBaseUrl } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TutorialProvider } from "@/components/onboarding/OnboardingTutorial";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Home from "@/pages/home";
import Fleet from "@/pages/fleet";
import Onboarding from "@/pages/onboarding";
import Contact from "@/pages/contact";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminsPage from "@/pages/admin/admins";
import ClientsPage from "@/pages/admin/clients";
import ClientDetailPage from "@/pages/admin/client-detail";
import ViewAsClientPage from "@/pages/admin/view-as-client";
import ViewAsEmployeePage from "@/pages/admin/view-as-employee";
import FormsPage from "@/pages/admin/forms";
import CarsPage from "@/pages/admin/cars";
import CarDetailPage from "@/pages/admin/car-detail";
import ViewCarPage from "@/pages/admin/view-car";
import EarningsPage from "@/pages/admin/earnings";
import TotalExpensesPage from "@/pages/admin/total-expenses";
import NADADepreciationPage from "@/pages/admin/nada-depreciation";
import PurchaseDetailsPage from "@/pages/admin/purchase-details";
import GraphsChartsPage from "@/pages/admin/graphs-charts";
import PaymentCalculatorPage from "@/pages/admin/payment-calculator";
import MaintenancePage from "@/pages/admin/maintenance";
import RecordsPage from "@/pages/admin/records";
import ViewRecordFilesPage from "@/pages/admin/view-record-files";
import PaymentsPage from "@/pages/admin/payments";
import PaymentsMainPage from "@/pages/admin/payments-main";
import PaymentStatusPage from "@/pages/admin/payment-status";
import TotalsPage from "@/pages/admin/totals";
import IncomeExpensesPage from "@/pages/admin/income-expenses/index";
import CarIncomeExpensePage from "@/pages/admin/car-income-expense";
import IncomeExpenseLogPage from "@/pages/admin/income-expense-log";
import SettingsPage from "@/pages/admin/settings";
import OperationsPage from "@/pages/admin/operations";
import HumanResourcesPage from "@/pages/admin/hr";
import EmployeesPage from "@/pages/admin/hr/employees";
import EmployeeViewPage from "@/pages/admin/hr/employee-view";
import WorkSchedulePage from "@/pages/admin/hr/work-schedule";
import AdminHrTaskManagement from "@/pages/admin/hr/task-management";
import AdminHrTime from "@/pages/admin/hr/time";
import AdminHrTimeOff from "@/pages/admin/hr/time-off";
import AdminHrOvertime from "@/pages/admin/hr/overtime";
import AdminHrReport from "@/pages/admin/hr/report";
import PayrollPage from "@/pages/admin/payroll";
import PayrollByRunPage from "@/pages/admin/payroll/payroll-by-run";
import PayslipPage from "@/pages/admin/payroll/payslip";
import PayrollCommissionsPage from "@/pages/admin/payroll/commissions";
import PayrollReportIndexPage from "@/pages/admin/payroll/report";
import PayrollReportLoggedHoursPage from "@/pages/admin/payroll/report/logged-hours";
import EmployeeFormPage from "@/pages/employee-form";
import BouncieDevicesPage from "@/pages/admin/bouncie-devices";
import BouncieFleetPage from "@/pages/admin/bouncie";
import BouncieTripsPage from "@/pages/admin/bouncie-trips";
import BouncieBehaviorPage from "@/pages/admin/bouncie-behavior";
import BouncieGeofencePage from "@/pages/admin/bouncie-geofence";
import BouncieAnalyticsPage from "@/pages/admin/bouncie-analytics";
import ClientCarTrackingPage from "@/pages/client/my-car-tracking";

// Wrapper component for IncomeExpensesPage to handle Wouter route props
function IncomeExpensesPageWrapper() {
  return <IncomeExpensesPage />;
}
import ClientProfilePage from "@/pages/admin/profile";
import TrainingManualPage from "@/pages/admin/training-manual";
import ClientTrainingManualPage from "@/pages/client/training-manual";
import ClientDashboardPage from "@/pages/client/dashboard";
import DashboardRouter from "@/pages/dashboard-router";
import SignContract from "@/pages/sign-contract";
import Signup from "@/pages/signup";
import ResetPasswordPage from "@/pages/reset-password";
import StaffDashboard from "@/pages/staff/dashboard";
import StaffMyInfoSection from "@/pages/staff/my-info-section";
import StaffForms from "@/pages/staff/forms";
import StaffFormsSubmit from "@/pages/staff/forms-submit";
import StaffFormsMySubmissions from "@/pages/staff/forms-my-submissions";
import StaffTaskManagement from "@/pages/staff/task-management";
import StaffTime from "@/pages/staff/time";
import StaffTimeOff from "@/pages/staff/time-off";
import StaffTuroGuide from "@/pages/staff/turo-guide";
import StaffTrainingManual from "@/pages/staff/training-manual";
import StaffClientTestimonials from "@/pages/staff/client-testimonials";
import StaffCarRentalTrips from "@/pages/staff/car-rental-trips";
import StaffCarRentalForms from "@/pages/staff/car-rental-forms";
import StaffCarRentalFormSubmit from "@/pages/staff/car-rental-form-submit";
import TuroTripsPage from "@/pages/admin/turo-trips";
import AdminTestimonialsPage from "@/pages/admin/testimonials";
import { AdminLayout } from "@/components/admin/admin-layout";

function Router() {
  return (
    <Switch>
      {/*
        Public routes — rendered without the admin shell.
        Declared first so they match before the catch-all protected group below.
      */}
      <Route path="/" component={Home} />
      <Route path="/fleet" component={Fleet} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/contact" component={Contact} />
      <Route path="/sign-contract/:token" component={SignContract} />
      <Route path="/signup" component={Signup} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/employee-form" component={EmployeeFormPage} />

      {/*
        Protected / in-app routes share a single persistent <AdminLayout> shell.
        When the user navigates between these, only the inner <Switch>
        swaps the matched <Route>'s content — the sidebar, header, auth guard,
        and any layout state stay mounted. Individual pages that still wrap
        themselves in <AdminLayout> become a no-op via AdminLayoutMountedContext.
      */}
      <Route>
        <AdminLayout>
          <Switch>
            <Route path="/staff/dashboard" component={StaffDashboard} />
            <Route path="/staff/my-info/:section" component={StaffMyInfoSection} />
            <Route path="/staff/my-info">
              <Redirect to="/staff/my-info/personal-information" />
            </Route>
            <Route path="/staff/forms/submit" component={StaffFormsSubmit} />
            <Route path="/staff/forms/my-submissions" component={StaffFormsMySubmissions} />
            <Route path="/staff/forms" component={StaffForms} />
            <Route path="/staff/task-management" component={StaffTaskManagement} />
            <Route path="/staff/time" component={StaffTime} />
            <Route path="/staff/time-off" component={StaffTimeOff} />
            <Route path="/staff/turo-guide" component={StaffTuroGuide} />
            <Route path="/staff/training-manual" component={StaffTrainingManual} />
            <Route path="/staff/client-testimonials" component={StaffClientTestimonials} />
            <Route path="/staff/car-rental/trips" component={StaffCarRentalTrips} />
            <Route path="/staff/car-rental/forms/submit" component={StaffCarRentalFormSubmit} />
            <Route path="/staff/car-rental/forms" component={StaffCarRentalForms} />
            <Route path="/dashboard" component={DashboardRouter} />
            <Route path="/admin/admins" component={AdminsPage} />
            <Route path="/admin/clients" component={ClientsPage} />
            <Route path="/admin/clients/:id" component={ClientDetailPage} />
            <Route path="/admin/view-as-client" component={ViewAsClientPage} />
            <Route path="/admin/view-as-employee" component={ViewAsEmployeePage} />
            <Route path="/admin/forms" component={FormsPage} />
            <Route path="/cars" component={CarsPage} />
            <Route path="/admin/view-car/:id" component={ViewCarPage} />
            <Route path="/admin/cars/:id/earnings" component={EarningsPage} />
            <Route path="/admin/cars/:id/expenses" component={TotalExpensesPage} />
            <Route path="/admin/cars/:id/depreciation" component={NADADepreciationPage} />
            <Route path="/admin/cars/:id/purchase" component={PurchaseDetailsPage} />
            <Route path="/admin/cars/:id/graphs" component={GraphsChartsPage} />
            <Route path="/admin/cars/:id/calculator" component={PaymentCalculatorPage} />
            <Route path="/admin/cars/:id/maintenance" component={MaintenancePage} />
            <Route path="/admin/cars/:id/totals" component={TotalsPage} />
            <Route path="/admin/totals/all" component={TotalsPage} />
            <Route path="/admin/totals" component={TotalsPage} />
            <Route path="/admin/cars/:id/records" component={RecordsPage} />
            <Route path="/admin/cars/:carId/records/:recordId/files" component={ViewRecordFilesPage} />
            <Route path="/admin/payments" component={PaymentsMainPage} />
            <Route path="/admin/payment-status" component={PaymentStatusPage} />
            <Route path="/admin/cars/:id/payments" component={PaymentsPage} />
            <Route path="/admin/cars/:id/income-expense/log" component={IncomeExpenseLogPage} />
            <Route path="/admin/cars/:id/income-expense" component={CarIncomeExpensePage} />
            <Route path="/admin/cars/:id" component={CarDetailPage} />
            <Route path="/admin/income-expenses" component={IncomeExpensesPageWrapper} />
            <Route path="/admin/settings" component={SettingsPage} />
            <Route path="/admin/operations" component={OperationsPage} />
            <Route path="/admin/bouncie" component={BouncieFleetPage} />
            <Route path="/admin/bouncie-devices" component={BouncieDevicesPage} />
            <Route path="/admin/bouncie-trips" component={BouncieTripsPage} />
            <Route path="/admin/bouncie-behavior" component={BouncieBehaviorPage} />
            <Route path="/admin/bouncie-geofence" component={BouncieGeofencePage} />
            <Route path="/admin/bouncie-analytics" component={BouncieAnalyticsPage} />
            <Route path="/admin/hr" component={HumanResourcesPage} />
            <Route path="/admin/work-schedule" component={WorkSchedulePage} />
            <Route path="/admin/hr/work-schedule" component={WorkSchedulePage} />
            <Route path="/admin/hr/employees/view" component={EmployeeViewPage} />
            <Route path="/admin/hr/employees" component={EmployeesPage} />
            <Route path="/admin/hr/task-management" component={AdminHrTaskManagement} />
            <Route path="/admin/hr/time" component={AdminHrTime} />
            <Route path="/admin/hr/time-off" component={AdminHrTimeOff} />
            <Route path="/admin/hr/overtime" component={AdminHrOvertime} />
            <Route path="/admin/hr/report" component={AdminHrReport} />
            <Route path="/admin/payroll" component={PayrollPage} />
            <Route path="/admin/payroll/commissions" component={PayrollCommissionsPage} />
            <Route path="/admin/payroll/report/logged-hours" component={PayrollReportLoggedHoursPage} />
            <Route path="/admin/payroll/report" component={PayrollReportIndexPage} />
            <Route path="/admin/payroll/:payrunId/payslip/:employeeId" component={PayslipPage} />
            <Route path="/admin/payroll/:payrunId" component={PayrollByRunPage} />
            <Route path="/client/dashboard" component={ClientDashboardPage} />
            <Route path="/client/my-car-tracking" component={ClientCarTrackingPage} />
            <Route path="/profile" component={ClientProfilePage} />
            <Route path="/tutorial" component={ClientTrainingManualPage} />
            <Route path="/admin/training-manual" component={TrainingManualPage} />
            <Route path="/admin/turo-trips" component={TuroTripsPage} />
            <Route path="/admin/testimonials" component={AdminTestimonialsPage} />
            <Route component={NotFound} />
          </Switch>
        </AdminLayout>
      </Route>
    </Switch>
  );
}

function App() {
  // Dev-only: log initialization (never log secrets like API keys or reCAPTCHA key)
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const apiBaseUrl = getApiBaseUrl();
    console.log("[APP] Environment: development");
    console.log("[APP] API base:", apiBaseUrl || "relative (Vite proxy)");
  }
  if (import.meta.env.PROD && typeof window !== "undefined" && !import.meta.env.VITE_API_URL) {
    console.warn("⚠️ [APP] VITE_API_URL is not set in production; API calls may fail.");
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <TutorialProvider>
            <Toaster />
            <Router />
          </TutorialProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
