import Link from "next/link";
import { ModulePage } from "@/components/module-page";

export default function FinancePage() {
  return (
    <ModulePage
      title="Finance"
      description="Use the quick links below for invoice and report modules."
    >
      <div className="flex gap-3">
        <Link
          href="/finance/invoices"
          className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm"
        >
          Invoices
        </Link>
        <Link
          href="/finance/reports"
          className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm"
        >
          Reports
        </Link>
      </div>
    </ModulePage>
  );
}
