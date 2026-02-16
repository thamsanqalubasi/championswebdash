import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import PropertiesPage from "@/pages/properties";
import TenantsPage from "@/pages/tenants";
import FinancePage from "@/pages/finance";
import InvoicesPage from "@/pages/invoices";
import ReportsPage from "@/pages/reports";
import MaintenancePage from "@/pages/maintenance";
import WorkOrdersPage from "@/pages/work-orders";
import ProvidersPage from "@/pages/providers";
import InspectionsPage from "@/pages/inspections";
import ScheduledTasksPage from "@/pages/scheduled-tasks";
import InventoryPage from "@/pages/inventory";
import ContractsPage from "@/pages/contracts";
import SettingsPage from "@/pages/settings";
import AuditTrailPage from "@/pages/audit-trail";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const guardEnabled = import.meta.env.VITE_ROUTE_GUARD_ENABLED === "true";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  if (guardEnabled && !user) {
    return <Navigate to="/login" replace />;
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
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/tenants" element={<TenantsPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/finance/invoices" element={<InvoicesPage />} />
        <Route path="/finance/reports" element={<ReportsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/maintenance/work-orders" element={<WorkOrdersPage />} />
        <Route path="/maintenance/providers" element={<ProvidersPage />} />
        <Route path="/maintenance/inspections" element={<InspectionsPage />} />
        <Route path="/maintenance/scheduled-tasks" element={<ScheduledTasksPage />} />
        <Route path="/maintenance/inventory" element={<InventoryPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit-trail" element={<AuditTrailPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
