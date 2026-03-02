import { Link } from "react-router-dom";
import { ModulePage } from "@/components/module-page";

export default function FinancePage() {
  const NavCard = ({ to, title, description }: { to: string; title: string; description: string }) => (
    <Link to={to} className="rounded-lg border border-border-color bg-surface p-6 hover:bg-surface-elevated transition-colors block">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted mt-1">{description}</p>
    </Link>
  );

  return (
    <ModulePage title="Finance" description="Financial operations and reporting.">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard to="/finance/invoices" title="Invoices" description="View, generate, and manage tenant invoices." />
        <NavCard to="/finance/reports" title="Reports" description="Revenue summaries, collection rates, and analytics." />
        <NavCard to="/finance/accounts" title="Accounts" description="Generate balance sheets for system-wide or property-level periods." />
        <NavCard to="/finance/bills" title="Bills" description="Create recurring property bills and track due/payment status." />
      </div>
    </ModulePage>
  );
}
