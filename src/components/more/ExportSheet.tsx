import { buildPrototypeExport, transactionsToCSV } from "~/lib/accounts/export";
import type { Household } from "~/lib/client/types";
import { Button } from "~/components/Button";
import { Sheet } from "~/components/Dialog";
import { DownloadIcon } from "~/components/icons";

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function ExportSheet({
  open,
  household,
  onClose,
}: {
  open: boolean;
  household: Household;
  onClose: () => void;
}) {
  const accountName = (id: string) =>
    household.accounts.find((a) => a.id === id)?.name ?? "Unknown";

  function exportJson() {
    download(
      "sumwell-prototype-data.json",
      JSON.stringify(buildPrototypeExport(household, new Date().toISOString()), null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    download(
      "sumwell-transactions.csv",
      transactionsToCSV(household.transactions, accountName),
      "text/csv",
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Export data">
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-ink-muted">
          Everything leaves this device as a plain file you download. Nothing is sent to a server,
          and no real financial institution is involved.
        </p>

        <div className="rounded-card border border-line bg-surface-raised p-4">
          <p className="text-body font-semibold text-ink">Full prototype data (JSON)</p>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            Accounts, transactions, plan, debts, goals, giving, and automation rules. The file is
            labeled <span className="font-semibold text-ink">“prototype data — not a bank
            statement”</span>.
          </p>
          <Button variant="secondary" className="mt-3" onClick={exportJson}>
            <DownloadIcon className="h-4 w-4" />
            Download JSON
          </Button>
        </div>

        <div className="rounded-card border border-line bg-surface-raised p-4">
          <p className="text-body font-semibold text-ink">Transactions (CSV)</p>
          <p className="mt-0.5 text-body-sm text-ink-muted">
            One row per transaction with date, status, account, description, category, kind,
            signed amount, principal/interest split, and source label.
          </p>
          <Button variant="secondary" className="mt-3" onClick={exportCsv}>
            <DownloadIcon className="h-4 w-4" />
            Download CSV
          </Button>
        </div>

        <p className="text-caption text-ink-faint">
          These exports are for moving your prototype data around — they are not bank statements,
          receipts, or tax documents.
        </p>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Sheet>
  );
}