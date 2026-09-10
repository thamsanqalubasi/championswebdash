import { Routes, Route, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import SetPasswordPage from "@/pages/set-password";
import DashboardPage from "@/pages/dashboard";
import CommercialBookingsPage from "@/pages/commercial-bookings";
import RoomManagementPage from "@/pages/room-management";
import PropertiesPage from "@/pages/properties";
import PropertyDetailsPage from "@/pages/property-details";
import TenantsPage from "@/pages/tenants";
import FinancePage from "@/pages/finance";
import FinanceAccountsPage from "@/pages/finance-accounts";
import BillsPage from "@/pages/bills";
import InvoicesPage from "@/pages/invoices";
import RentCollectionPage from "@/pages/rent-collection";
import ReportsPage from "@/pages/reports";
import MaintenancePage from "@/pages/maintenance";
import WorkOrdersPage from "@/pages/work-orders";
import ProvidersPage from "@/pages/providers";
import InspectionsPage from "@/pages/inspections";
import ScheduledTasksPage from "@/pages/scheduled-tasks";
import InventoryPage from "@/pages/inventory";
import HRPage from "@/pages/hr";
import UsersManagementPage from "@/pages/users-management";
import CompaniesPage from "@/pages/companies";
import ContractsPage from "@/pages/contracts";
import SettingsPage from "@/pages/settings";
import AuditTrailPage from "@/pages/audit-trail";
import EnquiriesPage from "@/pages/enquiries";
import PortalLayout from "@/pages/portal/portal-layout";
import PortalHomePage from "@/pages/portal/portal-home";
import PortalListingPage from "@/pages/portal/portal-listing";
import PortalLoginPage from "@/pages/portal/portal-login";
import CustomerDashboardPage from "@/pages/portal/customer-dashboard";
import AgentPortalPage from "@/pages/portal/agent-portal";
import RoomShowcasesPage from "@/pages/room-showcases";

function CompanySlugRedirect() {
  const { companySlug } = useParams<{ companySlug: string }>();
  return <Navigate to={`/c/${companySlug}/login`} replace />;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  if (!user) {
    const nextPath = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${nextPath}`} replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public Organization & Authentication Routes */}
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />

      {/* Unique Dedicated Multi-Tenant Organization URLs */}
      <Route path="/c/:companySlug" element={<CompanySlugRedirect />} />
      <Route path="/c/:companySlug/login" element={<LoginPage />} />
      <Route path="/c/:companySlug/set-password" element={<SetPasswordPage />} />

      {/* Public Customer Portal Routes */}
      <Route path="/portal" element={<PortalLayout />}>
        <Route index element={<PortalHomePage />} />
        <Route path="listing/:propertyId" element={<PortalListingPage />} />
        <Route path="login" element={<PortalLoginPage />} />
        <Route path="dashboard" element={<CustomerDashboardPage />} />
        <Route path="agent" element={<AgentPortalPage />} />
      </Route>

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/commercial-bookings" element={<CommercialBookingsPage />} />
        <Route path="/room-management" element={<RoomManagementPage />} />
        <Route path="/rent-collection" element={<RentCollectionPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:propertyId" element={<PropertyDetailsPage />} />
        <Route path="/tenants" element={<TenantsPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/finance/accounts" element={<FinanceAccountsPage />} />
        <Route path="/finance/bills" element={<BillsPage />} />
        <Route path="/finance/invoices" element={<InvoicesPage />} />
        <Route path="/finance/reports" element={<ReportsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/maintenance/work-orders" element={<WorkOrdersPage />} />
        <Route path="/maintenance/providers" element={<ProvidersPage />} />
        <Route path="/maintenance/inspections" element={<InspectionsPage />} />
        <Route path="/maintenance/scheduled-tasks" element={<ScheduledTasksPage />} />
        <Route path="/maintenance/inventory" element={<InventoryPage />} />
        <Route path="/hr" element={<HRPage />} />
        <Route path="/users-management" element={<UsersManagementPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit-trail" element={<AuditTrailPage />} />
        <Route path="/enquiries" element={<EnquiriesPage />} />
        <Route path="/room-showcases" element={<RoomShowcasesPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/portal" replace />} />
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}
