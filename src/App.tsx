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
import ViewAsCoHostPage from "@/pages/admin/view-as-co-host";
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
import CommissionPayrunsPage from "@/pages/admin/payroll/commission-payruns";
import CommissionPayrunByRunPage from "@/pages/admin/payroll/commission-payrun-by-run";
import EmployeeFormPage from "@/pages/employee-form";
import CoHostFormPage from "@/pages/co-host-form";
import CoHostsPage from "@/pages/admin/co-hosts";
import MyCoHostCarsPage from "@/pages/admin/my-co-host-cars";
import CoHostPaymentsPage from "@/pages/admin/co-host-payments";
import BouncieDevicesPage from "@/pages/admin/bouncie-devices";
import BouncieFleetPage from "@/pages/admin/bouncie";
import BouncieTripsPage from "@/pages/admin/bouncie-trips";
import BouncieBehaviorPage from "@/pages/admin/bouncie-behavior";
import BouncieGeofencePage from "@/pages/admin/bouncie-geofence";
import BouncieAnalyticsPage from "@/pages/admin/bouncie-analytics";
import ClientCarTrackingPage from "@/pages/client/my-car-tracking";
import ClientGeofenceZonesPage from "@/pages/client/geofence-zones";

// Wrapper component for IncomeExpensesPage to handle Wouter route props
function IncomeExpensesPageWrapper() {
  return <IncomeExpensesPage />;
}
import ClientProfilePage from "@/pages/admin/profile";
import TrainingManualPage from "@/pages/admin/training-manual";
import ClientTrainingManualPage from "@/pages/client/training-manual";
import ClientDashboardPage from "@/pages/client/dashboard";
import ClientTripHistoryPage from "@/pages/client/trip-history";
import ClientMaintenanceHistoryPage from "@/pages/client/maintenance-history";
import ClientOffboardingFormPage from "@/pages/client/offboarding-form";
import DashboardRouter from "@/pages/dashboard-router";
import SignContract from "@/pages/sign-contract";
import MaintenanceApproval from "@/pages/maintenance-approval";
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
import CoHostTrainingManual from "@/pages/cohost/training-manual";
import StaffClientTestimonials from "@/pages/staff/client-testimonials";
import StaffCarRentalTrips from "@/pages/staff/car-rental-trips";
import StaffCarRentalForms from "@/pages/staff/car-rental-forms";
import StaffCarRentalFormSubmit from "@/pages/staff/car-rental-form-submit";
import StaffCommissionForm from "@/pages/staff/commission-form";
import StaffCommissionFormMySubmissions from "@/pages/staff/commission-form-my-submissions";
import TuroTripsPage from "@/pages/admin/turo-trips";
import CarBlockOffPage from "@/pages/admin/CarBlockOff";
import AdminTestimonialsPage from "@/pages/admin/testimonials";
import AdminTuroGuidePage from "@/pages/admin/turo-guide";
import RentalListingsPage from "@/pages/admin/rental-listings";
import NewsMediaPage from "@/pages/admin/news-media";
import NoticeBoardManagementPage from "@/pages/admin/notice-board";
import NotificationsPage from "@/pages/admin/notifications";
import { AdminLayout } from "@/components/admin/admin-layout";
import { RequireRole } from "@/components/admin/require-role";

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
      <Route path="/maintenance-approval/:token" component={MaintenanceApproval} />
      <Route path="/signup" component={Signup} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/employee-form" component={EmployeeFormPage} />
      <Route path="/co-host-form" component={CoHostFormPage} />

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
            {/* Staff-only routes */}
            <Route path="/staff/dashboard">
              <RequireRole roles={["isEmployee"]}><StaffDashboard /></RequireRole>
            </Route>
            <Route path="/staff/my-info/:section">
              <RequireRole roles={["isEmployee"]}><StaffMyInfoSection /></RequireRole>
            </Route>
            <Route path="/staff/my-info">
              <Redirect to="/staff/my-info/personal-information" />
            </Route>
            <Route path="/staff/forms/submit">
              <RequireRole roles={["isEmployee"]}><StaffFormsSubmit /></RequireRole>
            </Route>
            <Route path="/staff/forms/my-submissions">
              <RequireRole roles={["isEmployee"]}><StaffFormsMySubmissions /></RequireRole>
            </Route>
            <Route path="/staff/forms">
              <RequireRole roles={["isEmployee"]}><StaffForms /></RequireRole>
            </Route>
            <Route path="/staff/commission-form/my-submissions">
              <RequireRole roles={["isEmployee"]}><StaffCommissionFormMySubmissions /></RequireRole>
            </Route>
            <Route path="/staff/commission-form">
              <RequireRole roles={["isEmployee"]}><StaffCommissionForm /></RequireRole>
            </Route>
            <Route path="/staff/task-management">
              <RequireRole roles={["isEmployee"]}><StaffTaskManagement /></RequireRole>
            </Route>
            <Route path="/staff/time">
              <RequireRole roles={["isEmployee"]}><StaffTime /></RequireRole>
            </Route>
            <Route path="/staff/time-off">
              <RequireRole roles={["isEmployee"]}><StaffTimeOff /></RequireRole>
            </Route>
            <Route path="/staff/turo-guide">
              <RequireRole roles={["isEmployee"]}><StaffTuroGuide /></RequireRole>
            </Route>
            <Route path="/staff/training-manual">
              <RequireRole roles={["isEmployee"]}><StaffTrainingManual /></RequireRole>
            </Route>
            <Route path="/staff/client-testimonials">
              <RequireRole roles={["isEmployee"]}><StaffClientTestimonials /></RequireRole>
            </Route>
            <Route path="/staff/car-rental/trips">
              <RequireRole roles={["isEmployee"]}><StaffCarRentalTrips /></RequireRole>
            </Route>
            <Route path="/staff/car-rental/forms/submit">
              <RequireRole roles={["isEmployee"]}><StaffCarRentalFormSubmit /></RequireRole>
            </Route>
            <Route path="/staff/car-rental/forms">
              <RequireRole roles={["isEmployee"]}><StaffCarRentalForms /></RequireRole>
            </Route>

            {/* Shared: any authenticated user */}
            <Route path="/dashboard" component={DashboardRouter} />
            <Route path="/profile" component={ClientProfilePage} />
            <Route path="/tutorial" component={ClientTrainingManualPage} />

            {/* Client-only routes */}
            <Route path="/client/dashboard">
              <RequireRole roles={["isClient"]}><ClientDashboardPage /></RequireRole>
            </Route>
            <Route path="/client/my-car-tracking">
              <RequireRole roles={["isClient"]}><ClientCarTrackingPage /></RequireRole>
            </Route>
            <Route path="/client/trip-history">
              <RequireRole roles={["isClient"]}><ClientTripHistoryPage /></RequireRole>
            </Route>
            <Route path="/client/maintenance-history">
              <RequireRole roles={["isClient"]}><ClientMaintenanceHistoryPage /></RequireRole>
            </Route>
            <Route path="/client/offboarding-form">
              <RequireRole roles={["isClient"]}><ClientOffboardingFormPage /></RequireRole>
            </Route>
            <Route path="/client/geofence-zones">
              <RequireRole roles={["isClient"]}><ClientGeofenceZonesPage /></RequireRole>
            </Route>

            {/* Admin-only routes */}
            <Route path="/admin/admins">
              <RequireRole roles={["isAdmin"]}><AdminsPage /></RequireRole>
            </Route>
            <Route path="/admin/co-hosts">
              <RequireRole roles={["isAdmin"]}><CoHostsPage /></RequireRole>
            </Route>
            <Route path="/admin/my-co-host-cars">
              <RequireRole roles={["isAdmin"]}><MyCoHostCarsPage /></RequireRole>
            </Route>
            <Route path="/admin/clients/:id">
              <RequireRole roles={["isAdmin"]}><ClientDetailPage /></RequireRole>
            </Route>
            <Route path="/admin/clients">
              <RequireRole roles={["isAdmin"]}><ClientsPage /></RequireRole>
            </Route>
            <Route path="/admin/view-as-client">
              <RequireRole roles={["isAdmin"]}><ViewAsClientPage /></RequireRole>
            </Route>
            <Route path="/admin/view-as-employee">
              <RequireRole roles={["isAdmin"]}><ViewAsEmployeePage /></RequireRole>
            </Route>
            <Route path="/admin/view-as-co-host">
              <RequireRole roles={["isAdmin"]}><ViewAsCoHostPage /></RequireRole>
            </Route>
            <Route path="/admin/forms">
              {/* Employees and co-hosts also use this page (the page + the
                  /options endpoint scope the visible tabs/subcategories per
                  role). Without isEmployee/isCoHost here, a subcategory form
                  link (?section=employee-forms&category=…&field=…) shared with
                  an employee hit RequireRole and showed nothing. */}
              <RequireRole roles={["isAdmin", "isClient", "isEmployee", "isCoHost"]}><FormsPage /></RequireRole>
            </Route>
            <Route path="/cars">
              <RequireRole roles={["isAdmin", "isClient"]}><CarsPage /></RequireRole>
            </Route>
            <Route path="/admin/view-car/:id">
              <RequireRole roles={["isAdmin", "isClient"]}><ViewCarPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/earnings">
              <RequireRole roles={["isAdmin", "isClient"]}><EarningsPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/expenses">
              <RequireRole roles={["isAdmin"]}><TotalExpensesPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/depreciation">
              <RequireRole roles={["isAdmin", "isClient"]}><NADADepreciationPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/purchase">
              <RequireRole roles={["isAdmin", "isClient"]}><PurchaseDetailsPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/graphs">
              <RequireRole roles={["isAdmin", "isClient"]}><GraphsChartsPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/calculator">
              <RequireRole roles={["isAdmin", "isClient"]}><PaymentCalculatorPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/maintenance">
              <RequireRole roles={["isAdmin", "isClient"]}><MaintenancePage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/totals">
              <RequireRole roles={["isAdmin", "isClient"]}><TotalsPage /></RequireRole>
            </Route>
            <Route path="/admin/totals/all">
              <RequireRole roles={["isAdmin"]}><TotalsPage /></RequireRole>
            </Route>
            <Route path="/admin/totals">
              <RequireRole roles={["isAdmin"]}><TotalsPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/records">
              <RequireRole roles={["isAdmin", "isClient"]}><RecordsPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:carId/records/:recordId/files">
              <RequireRole roles={["isAdmin", "isClient"]}><ViewRecordFilesPage /></RequireRole>
            </Route>
            <Route path="/admin/payments">
              <RequireRole roles={["isAdmin"]}><PaymentsMainPage /></RequireRole>
            </Route>
            <Route path="/admin/payment-status">
              <RequireRole roles={["isAdmin"]}><PaymentStatusPage /></RequireRole>
            </Route>
            <Route path="/admin/co-host-payments">
              <RequireRole roles={["isAdmin", "isCoHost"]}><CoHostPaymentsPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/payments">
              <RequireRole roles={["isAdmin", "isClient"]}><PaymentsPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/income-expense/log">
              <RequireRole roles={["isAdmin"]}><IncomeExpenseLogPage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id/income-expense">
              <RequireRole roles={["isAdmin", "isClient", "isEmployee"]}><CarIncomeExpensePage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id">
              <RequireRole roles={["isAdmin", "isClient"]}><CarDetailPage /></RequireRole>
            </Route>
            <Route path="/admin/income-expenses">
              <RequireRole roles={["isAdmin", "isEmployee"]}><IncomeExpensesPageWrapper /></RequireRole>
            </Route>
            <Route path="/admin/settings">
              <RequireRole roles={["isAdmin", "isClient"]}><SettingsPage /></RequireRole>
            </Route>
            <Route path="/admin/operations">
              <RequireRole roles={["isAdmin", "isEmployee"]}><OperationsPage /></RequireRole>
            </Route>
            <Route path="/admin/car-block-off">
              <RequireRole roles={["isAdmin", "isClient", "isCoHost"]}><CarBlockOffPage /></RequireRole>
            </Route>
            <Route path="/admin/bouncie">
              <RequireRole roles={["isAdmin", "isEmployee", "isCoHost"]}><BouncieFleetPage /></RequireRole>
            </Route>
            <Route path="/admin/bouncie-devices">
              <RequireRole roles={["isAdmin"]}><BouncieDevicesPage /></RequireRole>
            </Route>
            <Route path="/admin/bouncie-trips">
              <RequireRole roles={["isAdmin", "isEmployee", "isCoHost"]}><BouncieTripsPage /></RequireRole>
            </Route>
            <Route path="/admin/bouncie-behavior">
              <RequireRole roles={["isAdmin"]}><BouncieBehaviorPage /></RequireRole>
            </Route>
            <Route path="/admin/bouncie-geofence">
              <RequireRole roles={["isAdmin"]}><BouncieGeofencePage /></RequireRole>
            </Route>
            <Route path="/admin/bouncie-analytics">
              <RequireRole roles={["isAdmin"]}><BouncieAnalyticsPage /></RequireRole>
            </Route>
            <Route path="/admin/hr">
              <RequireRole roles={["isAdmin"]}><HumanResourcesPage /></RequireRole>
            </Route>
            <Route path="/admin/work-schedule">
              <RequireRole roles={["isAdmin"]}><WorkSchedulePage /></RequireRole>
            </Route>
            <Route path="/admin/hr/work-schedule">
              <RequireRole roles={["isAdmin"]}><WorkSchedulePage /></RequireRole>
            </Route>
            <Route path="/admin/hr/employees/view">
              <RequireRole roles={["isAdmin"]}><EmployeeViewPage /></RequireRole>
            </Route>
            <Route path="/admin/hr/employees">
              <RequireRole roles={["isAdmin"]}><EmployeesPage /></RequireRole>
            </Route>
            <Route path="/admin/hr/task-management">
              <RequireRole roles={["isAdmin"]}><AdminHrTaskManagement /></RequireRole>
            </Route>
            <Route path="/admin/hr/time">
              <RequireRole roles={["isAdmin"]}><AdminHrTime /></RequireRole>
            </Route>
            <Route path="/admin/hr/time-off">
              <RequireRole roles={["isAdmin"]}><AdminHrTimeOff /></RequireRole>
            </Route>
            <Route path="/admin/hr/overtime">
              <RequireRole roles={["isAdmin"]}><AdminHrOvertime /></RequireRole>
            </Route>
            <Route path="/admin/hr/report">
              <RequireRole roles={["isAdmin"]}><AdminHrReport /></RequireRole>
            </Route>
            <Route path="/admin/payroll/commissions">
              <RequireRole roles={["isAdmin"]}><PayrollCommissionsPage /></RequireRole>
            </Route>
            <Route path="/admin/payroll/commission-payruns/:id">
              <RequireRole roles={["isAdmin"]}><CommissionPayrunByRunPage /></RequireRole>
            </Route>
            <Route path="/admin/payroll/commission-payruns">
              <RequireRole roles={["isAdmin"]}><CommissionPayrunsPage /></RequireRole>
            </Route>
            <Route path="/admin/payroll/:payrunId/payslip/:employeeId">
              <RequireRole roles={["isAdmin"]}><PayslipPage /></RequireRole>
            </Route>
            <Route path="/admin/payroll/:payrunId">
              <RequireRole roles={["isAdmin"]}><PayrollByRunPage /></RequireRole>
            </Route>
            <Route path="/admin/payroll">
              <RequireRole roles={["isAdmin"]}><PayrollPage /></RequireRole>
            </Route>
            <Route path="/admin/training-manual">
              <RequireRole roles={["isAdmin"]}><TrainingManualPage /></RequireRole>
            </Route>
            <Route path="/cohost/training-manual">
              <RequireRole roles={["isCoHost", "isAdmin"]}><CoHostTrainingManual /></RequireRole>
            </Route>
            <Route path="/admin/turo-trips">
              <RequireRole roles={["isAdmin"]}><TuroTripsPage /></RequireRole>
            </Route>
            <Route path="/admin/testimonials">
              <RequireRole roles={["isAdmin", "isClient"]}><AdminTestimonialsPage /></RequireRole>
            </Route>
            <Route path="/admin/turo-guide">
              <RequireRole roles={["isAdmin", "isClient"]}><AdminTuroGuidePage /></RequireRole>
            </Route>
            <Route path="/admin/rental-listings">
              <RequireRole roles={["isAdmin"]}><RentalListingsPage /></RequireRole>
            </Route>
            <Route path="/admin/news-media">
              <RequireRole roles={["isAdmin", "isClient"]}><NewsMediaPage /></RequireRole>
            </Route>
            <Route path="/admin/notice-board">
              <RequireRole roles={["isAdmin"]}><NoticeBoardManagementPage /></RequireRole>
            </Route>
            <Route path="/admin/notifications">
              <RequireRole roles={["isAdmin", "isEmployee", "isClient"]}><NotificationsPage /></RequireRole>
            </Route>
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
  if (
    import.meta.env.PROD &&
    typeof window !== "undefined" &&
    !import.meta.env.VITE_API_URL
  ) {
    console.warn(
      "⚠️ [APP] VITE_API_URL is not set in production; API calls may fail.",
    );
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
