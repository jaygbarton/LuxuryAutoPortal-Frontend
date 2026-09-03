import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient, getApiBaseUrl } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TutorialProvider } from "@/components/onboarding/OnboardingTutorial";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminLayout } from "@/components/admin/admin-layout";
import { RequireRole } from "@/components/admin/require-role";
import { PUBLIC_LOCATIONS, rememberPublicLocationFromPath } from "@/lib/location-config";

const Home = lazy(() => import("@/pages/home"));
const Fleet = lazy(() => import("@/pages/fleet"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const Contact = lazy(() => import("@/pages/contact"));
const ChauffeurPage = lazy(() => import("@/pages/chauffeur"));
const LocationInterest = lazy(() => import("@/pages/location-interest"));
const legacyPage = <K extends keyof typeof import("@/pages/marketing/legacy-pages")>(key: K) =>
  lazy(() => import("@/pages/marketing/legacy-pages").then((module) => ({ default: module[key] as any })));
const DealsPage = legacyPage("DealsPage");
const DetailShopAppointmentPage = legacyPage("DetailShopAppointmentPage");
const DetailShopPage = legacyPage("DetailShopPage");
const ExtrasPage = legacyPage("ExtrasPage");
const JobApplicationPage = legacyPage("JobApplicationPage");
const JobsPage = legacyPage("JobsPage");
const PickupDropoffPage = legacyPage("PickupDropoffPage");
const PrivacyPolicyPage = legacyPage("PrivacyPolicyPage");
const ReviewsOptionsPage = legacyPage("ReviewsOptionsPage");
const ReviewsPage = legacyPage("ReviewsPage");
const SuggestedCarsPage = legacyPage("SuggestedCarsPage");
const TestimonialsPage = legacyPage("TestimonialsPage");
const TermsPage = legacyPage("TermsPage");
const NotFound = lazy(() => import("@/pages/not-found"));
const AdminLogin = lazy(() => import("@/pages/admin/login"));
const AdminsPage = lazy(() => import("@/pages/admin/admins"));
const ClientsPage = lazy(() => import("@/pages/admin/clients"));
const ClientDetailPage = lazy(() => import("@/pages/admin/client-detail"));
const ViewAsClientPage = lazy(() => import("@/pages/admin/view-as-client"));
const ViewAsEmployeePage = lazy(() => import("@/pages/admin/view-as-employee"));
const ViewAsCoHostPage = lazy(() => import("@/pages/admin/view-as-co-host"));
const FormsPage = lazy(() => import("@/pages/admin/forms"));
const CarsPage = lazy(() => import("@/pages/admin/cars"));
const CarDetailPage = lazy(() => import("@/pages/admin/car-detail"));
const ViewCarPage = lazy(() => import("@/pages/admin/view-car"));
const EarningsPage = lazy(() => import("@/pages/admin/earnings"));
const TotalExpensesPage = lazy(() => import("@/pages/admin/total-expenses"));
const NADADepreciationPage = lazy(() => import("@/pages/admin/nada-depreciation"));
const PurchaseDetailsPage = lazy(() => import("@/pages/admin/purchase-details"));
const GraphsChartsPage = lazy(() => import("@/pages/admin/graphs-charts"));
const PaymentCalculatorPage = lazy(() => import("@/pages/admin/payment-calculator"));
const MaintenancePage = lazy(() => import("@/pages/admin/maintenance"));
const RecordsPage = lazy(() => import("@/pages/admin/records"));
const ViewRecordFilesPage = lazy(() => import("@/pages/admin/view-record-files"));
const PaymentsPage = lazy(() => import("@/pages/admin/payments"));
const PaymentsMainPage = lazy(() => import("@/pages/admin/payments-main"));
const PaymentStatusPage = lazy(() => import("@/pages/admin/payment-status"));
const TotalsPage = lazy(() => import("@/pages/admin/totals"));
const IncomeExpensesPage = lazy(() => import("@/pages/admin/income-expenses/index"));
const CarIncomeExpensePage = lazy(() => import("@/pages/admin/car-income-expense"));
const IncomeExpenseLogPage = lazy(() => import("@/pages/admin/income-expense-log"));
const SettingsPage = lazy(() => import("@/pages/admin/settings"));
const AdminProfilePage = lazy(() => import("@/pages/admin/admin-profile"));
const OperationsPage = lazy(() => import("@/pages/admin/operations"));
const HumanResourcesPage = lazy(() => import("@/pages/admin/hr"));
const HrApplicationsPage = lazy(() => import("@/pages/admin/hr/applications"));
const EmployeesPage = lazy(() => import("@/pages/admin/hr/employees"));
const EmployeeViewPage = lazy(() => import("@/pages/admin/hr/employee-view"));
const WorkSchedulePage = lazy(() => import("@/pages/admin/hr/work-schedule"));
const ScheduleTimelinePage = lazy(() => import("@/pages/admin/hr/schedule-timeline"));
const AdminHrTaskManagement = lazy(() => import("@/pages/admin/hr/task-management"));
const AdminHrTime = lazy(() => import("@/pages/admin/hr/time"));
const AdminHrTimeOff = lazy(() => import("@/pages/admin/hr/time-off"));
const AdminHrOvertime = lazy(() => import("@/pages/admin/hr/overtime"));
const AdminHrReport = lazy(() => import("@/pages/admin/hr/report"));
const PayrollPage = lazy(() => import("@/pages/admin/payroll"));
const PayrollByRunPage = lazy(() => import("@/pages/admin/payroll/payroll-by-run"));
const PayslipPage = lazy(() => import("@/pages/admin/payroll/payslip"));
const PayrollCommissionsPage = lazy(() => import("@/pages/admin/payroll/commissions"));
const CommissionPayrunsPage = lazy(() => import("@/pages/admin/payroll/commission-payruns"));
const CommissionPayrunByRunPage = lazy(() => import("@/pages/admin/payroll/commission-payrun-by-run"));
const EmployeeFormPage = lazy(() => import("@/pages/employee-form"));
const CoHostFormPage = lazy(() => import("@/pages/co-host-form"));
const CoHostsPage = lazy(() => import("@/pages/admin/co-hosts"));
const MyCoHostCarsPage = lazy(() => import("@/pages/admin/my-co-host-cars"));
const CoHostPaymentsPage = lazy(() => import("@/pages/admin/co-host-payments"));
const BouncieDevicesPage = lazy(() => import("@/pages/admin/bouncie-devices"));
const BouncieFleetPage = lazy(() => import("@/pages/admin/bouncie"));
const BouncieTripsPage = lazy(() => import("@/pages/admin/bouncie-trips"));
const BouncieBehaviorPage = lazy(() => import("@/pages/admin/bouncie-behavior"));
const BouncieGeofencePage = lazy(() => import("@/pages/admin/bouncie-geofence"));
const BouncieAnalyticsPage = lazy(() => import("@/pages/admin/bouncie-analytics"));
const ClientCarTrackingPage = lazy(() => import("@/pages/client/my-car-tracking"));
const ClientGeofenceZonesPage = lazy(() => import("@/pages/client/geofence-zones"));
const ClientVehicleTripsPage = lazy(() => import("@/pages/client/vehicle-trips"));
const ClientVehicleBehaviorPage = lazy(() => import("@/pages/client/vehicle-behavior"));
const ClientProfilePage = lazy(() => import("@/pages/admin/profile"));
const TrainingManualPage = lazy(() => import("@/pages/admin/training-manual"));
const ClientTrainingManualPage = lazy(() => import("@/pages/client/training-manual"));
const ClientDashboardPage = lazy(() => import("@/pages/client/dashboard"));
const ClientTripHistoryPage = lazy(() => import("@/pages/client/trip-history"));
const ClientTripCalendarPage = lazy(() => import("@/pages/client/trip-calendar"));
const ClientMaintenanceHistoryPage = lazy(() => import("@/pages/client/maintenance-history"));
const ClientOffboardingFormPage = lazy(() => import("@/pages/client/offboarding-form"));
const DashboardRouter = lazy(() => import("@/pages/dashboard-router"));
const SignContract = lazy(() => import("@/pages/sign-contract"));
const MaintenanceApproval = lazy(() => import("@/pages/maintenance-approval"));
const Signup = lazy(() => import("@/pages/signup"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const StaffDashboard = lazy(() => import("@/pages/staff/dashboard"));
const StaffMyInfoSection = lazy(() => import("@/pages/staff/my-info-section"));
const StaffForms = lazy(() => import("@/pages/staff/forms"));
const StaffFormsSubmit = lazy(() => import("@/pages/staff/forms-submit"));
const StaffFormsMySubmissions = lazy(() => import("@/pages/staff/forms-my-submissions"));
const StaffTaskManagement = lazy(() => import("@/pages/staff/task-management"));
const StaffTime = lazy(() => import("@/pages/staff/time"));
const StaffTimeOff = lazy(() => import("@/pages/staff/time-off"));
const StaffTuroGuide = lazy(() => import("@/pages/staff/turo-guide"));
const StaffTrainingManual = lazy(() => import("@/pages/staff/training-manual"));
const CoHostTrainingManual = lazy(() => import("@/pages/cohost/training-manual"));
const CoHostProfilePage = lazy(() => import("@/pages/cohost/profile"));
const StaffClientTestimonials = lazy(() => import("@/pages/staff/client-testimonials"));
const StaffCarRentalTrips = lazy(() => import("@/pages/staff/car-rental-trips"));
const StaffCarRentalForms = lazy(() => import("@/pages/staff/car-rental-forms"));
const StaffCarRentalFormSubmit = lazy(() => import("@/pages/staff/car-rental-form-submit"));
const StaffCommissionForm = lazy(() => import("@/pages/staff/commission-form"));
const StaffCommissionFormMySubmissions = lazy(() => import("@/pages/staff/commission-form-my-submissions"));
const TuroTripsPage = lazy(() => import("@/pages/admin/turo-trips"));
const TripCalendarPage = lazy(() => import("@/pages/admin/trip-calendar"));
const CarBlockOffPage = lazy(() => import("@/pages/admin/CarBlockOff"));
const AdminTestimonialsPage = lazy(() => import("@/pages/admin/testimonials"));
const AdminTuroGuidePage = lazy(() => import("@/pages/admin/turo-guide"));
const RentalListingsPage = lazy(() => import("@/pages/admin/rental-listings"));
const GuestDatabasePage = lazy(() => import("@/pages/admin/marketing/guest-database"));
const NewsMediaPage = lazy(() => import("@/pages/admin/news-media"));
const NoticeBoardManagementPage = lazy(() => import("@/pages/admin/notice-board"));
const NotificationsPage = lazy(() => import("@/pages/admin/notifications"));

function PageFallback() {
  return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
}

// Wrapper component for IncomeExpensesPage to handle Wouter route props
function IncomeExpensesPageWrapper() {
  return <IncomeExpensesPage />;
}

function Router() {
  const [currentPath] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isNativeShell =
      Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
      /GLA-Portal-App|Capacitor/i.test(window.navigator.userAgent);

    document.documentElement.classList.toggle("native-app-shell", isNativeShell);

    return () => {
      document.documentElement.classList.remove("native-app-shell");
    };
  }, []);

  useEffect(() => {
    rememberPublicLocationFromPath(currentPath);
  }, [currentPath]);

  return (
    <Suspense fallback={<PageFallback />}>
    <Switch>
      {/*
        Public routes — rendered without the admin shell.
        Declared first so they match before the catch-all protected group below.
      */}
      <Route path="/">
        <Redirect to="/salt-lake-city" />
      </Route>
      <Route path="/choose-location" component={Home} />
      <Route path="/salt-lake-city">
        <Home location={PUBLIC_LOCATIONS.slc} />
      </Route>
      <Route path="/wilmington-nc">
        <Home location={PUBLIC_LOCATIONS.wilmington} />
      </Route>
      <Route path="/myrtle-beach-sc/list-your-vehicle">
        <LocationInterest location={PUBLIC_LOCATIONS.myrtle} />
      </Route>
      <Route path="/charleston-sc/list-your-vehicle">
        <LocationInterest location={PUBLIC_LOCATIONS.charleston} />
      </Route>
      <Route path="/myrtle-beach-sc">
        <Home location={PUBLIC_LOCATIONS.myrtle} />
      </Route>
      <Route path="/charleston-sc">
        <Home location={PUBLIC_LOCATIONS.charleston} />
      </Route>
      <Route path="/fleet">
        <Fleet location={PUBLIC_LOCATIONS.slc} />
      </Route>
      <Route path="/salt-lake-city/fleet">
        <Fleet location={PUBLIC_LOCATIONS.slc} />
      </Route>
      <Route path="/wilmington-nc/fleet">
        <Fleet location={PUBLIC_LOCATIONS.wilmington} />
      </Route>
      <Route path="/myrtle-beach-sc/fleet">
        <Home location={PUBLIC_LOCATIONS.myrtle} />
      </Route>
      <Route path="/charleston-sc/fleet">
        <Home location={PUBLIC_LOCATIONS.charleston} />
      </Route>
      <Route path="/salt-lake-city/pick-up-and-drop-off" component={PickupDropoffPage} />
      <Route path="/salt-lake-city/detail-shop/book" component={DetailShopAppointmentPage} />
      <Route path="/salt-lake-city/detail-shop" component={DetailShopPage} />
      <Route path="/salt-lake-city/chauffeur-services" component={ChauffeurPage} />
      <Route path="/salt-lake-city/deals" component={DealsPage} />
      <Route path="/salt-lake-city/jobs/apply" component={JobApplicationPage} />
      <Route path="/salt-lake-city/jobs" component={JobsPage} />
      <Route path="/salt-lake-city/suggested-cars" component={SuggestedCarsPage} />
      <Route path="/salt-lake-city/testimonials" component={TestimonialsPage} />
      <Route path="/salt-lake-city/reviews-options" component={ReviewsOptionsPage} />
      <Route path="/salt-lake-city/reviews" component={ReviewsPage} />
      <Route path="/salt-lake-city/extras" component={ExtrasPage} />
      <Route path="/salt-lake-city/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/salt-lake-city/terms-and-conditions" component={TermsPage} />
      <Route path="/salt-lake-city/terms" component={TermsPage} />
      <Route path="/salt-lake-city/onboarding" component={Onboarding} />
      <Route path="/salt-lake-city/contact" component={Contact} />
      <Route path="/wilmington-nc/testimonials" component={TestimonialsPage} />
      <Route path="/wilmington-nc/reviews-options" component={ReviewsOptionsPage} />
      <Route path="/wilmington-nc/reviews" component={ReviewsPage} />
      <Route path="/wilmington-nc/extras" component={ExtrasPage} />
      <Route path="/wilmington-nc/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/wilmington-nc/terms-and-conditions" component={TermsPage} />
      <Route path="/wilmington-nc/terms" component={TermsPage} />
      <Route path="/wilmington-nc/onboarding" component={Onboarding} />
      <Route path="/wilmington-nc/contact" component={Contact} />
      <Route path="/detail-shop/book" component={DetailShopAppointmentPage} />
      <Route path="/detail-shop" component={DetailShopPage} />
      <Route path="/chauffeur-services" component={ChauffeurPage} />
      <Route path="/pick-up-and-drop-off" component={PickupDropoffPage} />
      <Route path="/deals" component={DealsPage} />
      <Route path="/jobs/apply" component={JobApplicationPage} />
      <Route path="/jobs" component={JobsPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      <Route path="/terms-and-conditions" component={TermsPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/testimonials" component={TestimonialsPage} />
      <Route path="/reviews-options" component={ReviewsOptionsPage} />
      <Route path="/reviews" component={ReviewsPage} />
      <Route path="/extras" component={ExtrasPage} />
      <Route path="/suggested-cars" component={SuggestedCarsPage} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/contact" component={Contact} />
      <Route path="/sign-contract/:token" component={SignContract} />
      <Route path="/maintenance-approval/:token" component={MaintenanceApproval} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={AdminLogin} />
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
            <Route path="/client/trip-calendar">
              <RequireRole roles={["isClient"]}><ClientTripCalendarPage /></RequireRole>
            </Route>
            <Route path="/client/maintenance-history">
              {/* Hidden from clients for now — keep the page for admins who have a bookmark. */}
              <RequireRole roles={["isAdmin"]}><ClientMaintenanceHistoryPage /></RequireRole>
            </Route>
            <Route path="/client/offboarding-form">
              <RequireRole roles={["isClient"]}><ClientOffboardingFormPage /></RequireRole>
            </Route>
            <Route path="/client/geofence-zones">
              <RequireRole roles={["isClient"]}><ClientGeofenceZonesPage /></RequireRole>
            </Route>
            <Route path="/client/vehicle-trips">
              <RequireRole roles={["isClient"]}><ClientVehicleTripsPage /></RequireRole>
            </Route>
            <Route path="/client/vehicle-behavior">
              <RequireRole roles={["isClient"]}><ClientVehicleBehaviorPage /></RequireRole>
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
              <RequireRole roles={["isAdmin"]}><MaintenancePage /></RequireRole>
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
              <RequireRole roles={["isAdmin", "isClient", "isEmployee", "isCoHost"]}><CarIncomeExpensePage /></RequireRole>
            </Route>
            <Route path="/admin/cars/:id">
              <RequireRole roles={["isAdmin", "isClient"]}><CarDetailPage /></RequireRole>
            </Route>
            <Route path="/admin/income-expenses">
              <RequireRole roles={["isAdmin", "isEmployee"]}><IncomeExpensesPageWrapper /></RequireRole>
            </Route>
            <Route path="/admin/settings">
              <RequireRole roles={["isAdmin", "isClient", "isEmployee", "isCoHost"]}><SettingsPage /></RequireRole>
            </Route>
            <Route path="/admin/profile">
              <RequireRole roles={["isAdmin"]}><AdminProfilePage /></RequireRole>
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
            <Route path="/admin/hr/applications">
              <RequireRole roles={["isAdmin"]}><HrApplicationsPage /></RequireRole>
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
            <Route path="/admin/hr/schedule-timeline">
              <RequireRole roles={["isAdmin"]}><ScheduleTimelinePage /></RequireRole>
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
            <Route path="/admin/co-host-profile">
              <RequireRole roles={["isCoHost", "isAdmin"]}><CoHostProfilePage /></RequireRole>
            </Route>
            <Route path="/admin/turo-trips">
              <RequireRole roles={["isAdmin"]}><TuroTripsPage /></RequireRole>
            </Route>
            <Route path="/admin/trip-calendar">
              <RequireRole roles={["isAdmin", "isCoHost", "isEmployee"]}><TripCalendarPage /></RequireRole>
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
            <Route path="/admin/marketing/guest-database">
              <RequireRole roles={["isAdmin"]}><GuestDatabasePage /></RequireRole>
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
    </Suspense>
  );
}

function ScrollToTopOnRouteChange() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasHash = window.location.hash.length > 1;
    if (hasHash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }, [location]);

  return null;
}

function App() {
  // Dev-only: log initialization (never log secrets like API keys or reCAPTCHA key)
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const apiBaseUrl = getApiBaseUrl();
    console.log("[APP] Environment: development");
    console.log("[APP] API base:", apiBaseUrl || "relative (Vite proxy)");
  }
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <TutorialProvider>
            <Toaster />
            <ScrollToTopOnRouteChange />
            <Router />
          </TutorialProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
