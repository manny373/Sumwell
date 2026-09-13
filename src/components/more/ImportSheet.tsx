import { useMemo, useState } from "react";
import type { ImportDraft } from "~/lib/accounts/import";
import { parseImportCsv, findExistingDuplicates, type ParsedImportFile } from "~/lib/accounts/import";
import { useClientData } from "~/lib/client/store";
import type { Household } from "~/lib/client/types";
import { Button } from "~/components/Button";
import { Sheet } from "~/components/Dialog";
import { Select } from "~/components/Select";
import { formatDollars } from "~/lib/money";
import { formatDate } from "~/lib/accounts/accounts";
import { CheckCircleIcon, UploadIcon, WarningIcon } from "~/components/icons";
import { Banner } from "~/components/Banner";
import { cn } from "~/lib/cn";

type Step = "choose" | "preview" | "done";

export function ImportSheet({
  open,
  household,
  onClose,
}: {
  open: boolean;
  household: Household;
  onClose: () => void;
}) {
  const store = useClientData();
  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [accountId, setAccountId] = useState(household.accounts[0]?.id ?? "");
  const [importAnyway, setImportAnyway] = useState<Record<number, boolean>>({});
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [readError, setReadError] = useState<string | null>(null);

  const existingFlags = useMemo(() => {
    if (!parsed) return [];
    return findExistingDuplicates(parsed.rows, accountId, household.transactions);
  }, [parsed, accountId, household.transactions]);

  const duplicateRowNumbers = useMemo(() => {
    const set = new Set<number>();
    if (parsed) {
      for (const row of parsed.rows) {
        if (row.batchDuplicateOf !== undefined) set.add(row.rowNumber);
      }
    }
    for (const f of existingFlags) set.add(f.rowNumber);
    return set;
  }, [parsed, existingFlags]);

  function chooseFile(file: File) {
    setReadError(null);
    setFileName(file.name);
    file
      .text()
      .then((text) => {
        const result = parseImportCsv(text, file.name);
        setParsed(result);
        setImportAnyway({});
        setStep("preview");
      })
      .catch(() => {
        setReadError("Couldn't read that file. Try a plain .csv text file.");
      });
  }

  function accept() {
    if (!parsed) return;
    const drafts: ImportDraft[] = [];
    for (const row of parsed.rows) {
      if (!row.ok || !row.draft) continue;
      if (duplicateRowNumbers.has(row.rowNumber) && !importAnyway[row.rowNumber]) {
        continue; // default: skip flagged duplicates; user can opt back in above
      }
      drafts.push(row.draft);
    }
    const skipped = parsed.validCount - drafts.length;
    store.importTransactions(drafts, accountId);
    setImportedCount(drafts.length);
    setSkippedCount(skipped);
    setStep("done");
  }

  function reset() {
    setStep("choose");
    setParsed(null);
    setFileName(null);
    setReadError(null);
    setImportAnyway({});
    setImportedCount(0);
    setSkippedCount(0);
  }

  const close = () => {
    reset();
    onClose();
  };

  const accountName = (id: string) =>
    household.accounts.find((a) => a.id === id)?.name ?? "Unknown";

  return (
    <Sheet open={open} onClose={close} title="Import transactions (CSV)">
      {step === "choose" ? (
        <div className="flex flex-col gap-4">
          <p className="text-body-sm text-ink-muted">
            Import a CSV with <span className="font-semibold text-ink">date</span>,{" "}
            <span className="font-semibold text-ink">description</span>, and{" "}
            <span className="font-semibold text-ink">amount</span> columns. The description
            becomes the merchant name. Optional columns: category, status (pending/posted), type
            (expense/income/transfer/loan payment), memo.
          </p>
          <p className="text-body-sm text-ink-muted">
            Every imported row is labeled <span className="font-semibold text-ink">Imported</span>{" "}
            — never “Connected”. The file is read as untrusted text: nothing in it is executed or
            rendered as code, and nothing is altered or dropped silently. Bad rows are listed with
            their row numbers before anything is accepted.
          </p>
          <Select
            label="Import into which account?"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {household.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>

          {readError ? <Banner variant="error" title={readError} /> : null}

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-surface-sunken/50 px-6 py-10 text-center transition-colors hover:border-brand-600/60 hover:bg-surface-sunken">
            <UploadIcon className="h-7 w-7 text-ink-faint" />
            <span className="text-body-sm font-semibold text-ink">Choose a CSV file</span>
            <span className="text-caption text-ink-muted">.csv or .txt — parsed on this device</span>
            <input
              type="file"
              accept=".csv,text/csv,.txt,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) chooseFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {step === "preview" && parsed ? (
        <div className="flex flex-col gap-4">
          <Banner
            variant={parsed.fileError || parsed.errors.length > 0 ? "warning" : "info"}
            title={
              parsed.fileError
                ? "This file can't be imported"
                : `${parsed.validCount} of ${parsed.totalCount} rows are valid`
            }
            description={
              parsed.fileError ??
              (parsed.errors.length > 0
                ? `${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} have problems and are listed below — nothing is imported until you accept.`
                : "Everything below is exactly what will be imported. Dates were read as " +
                  (parsed.dateFormat === "ISO" ? "YYYY-MM-DD" : "MM/DD/YYYY") +
                  ".")
            }
          />

          {parsed.fileError ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>
                Choose a different file
              </Button>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              {parsed.ignoredColumns.length > 0 ? (
                <p className="text-caption text-ink-faint">
                  Ignored columns (not used by the importer): {parsed.ignoredColumns.join(", ")}
                </p>
              ) : null}
              <p className="text-caption text-ink-faint">
                File: {fileName ?? "unknown.csv"} · rows are 1-based data rows (the header is row 0).
              </p>

              <Select
                label="Import into which account?"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {household.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>

              {/* row-level errors — nothing silent */}
              {parsed.errors.length > 0 ? (
                <div className="rounded-card border border-danger/30 bg-danger-soft/40 p-3">
                  <p className="flex items-center gap-2 text-body-sm font-semibold text-danger">
                    <WarningIcon className="h-4 w-4" /> Rows with problems
                  </p>
                  <ul className="mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto pr-1 text-body-sm text-ink-muted">
                    {parsed.errors.map((e) => (
                      <li key={e.rowNumber}>
                        Row {e.rowNumber}: {e.message}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-caption text-ink-faint">
                    These rows will not be imported. They are reported, never silently dropped or
                    altered.
                  </p>
                </div>
              ) : null}

              {/* valid rows preview */}
              <div>
                <p className="text-body-sm font-semibold text-ink">
                  Preview — {parsed.validCount} valid row{parsed.validCount === 1 ? "" : "s"}
                  {duplicateRowNumbers.size > 0
                    ? ` · ${duplicateRowNumbers.size} flagged as possible duplicates`
                    : ""}
                </p>
                <ul className="mt-2 max-h-64 divide-y divide-line-faint overflow-y-auto rounded-card border border-line bg-surface-raised px-3 py-1">
                  {parsed.rows.map((row) => {
                    const isDup = duplicateRowNumbers.has(row.rowNumber);
                    const skipDefault = isDup && !importAnyway[row.rowNumber];
                    return (
                      <li
                        key={row.rowNumber}
                        className={cn(
                          "flex items-center gap-3 py-2",
                          row.ok && skipDefault && "opacity-60",
                        )}
                      >
                        <span className="w-8 shrink-0 text-right text-caption tabular-nums text-ink-faint">
                          {row.rowNumber}
                        </span>
                        {row.ok && row.draft ? (
                          <>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body-sm font-medium text-ink">
                                {row.draft.merchant}
                              </span>
                              <span className="block text-caption text-ink-faint">
                                {formatDate(row.draft.dateISO)} · {row.draft.category} ·{" "}
                                {row.draft.kind} · {row.draft.status}
                                {row.batchDuplicateOf !== undefined
                                  ? ` · looks like row ${row.batchDuplicateOf}`
                                  : ""}
                              </span>
                            </span>
                            <span className="shrink-0 text-body-sm tabular-nums text-ink">
                              {formatDollars(row.draft.amountCents)}
                            </span>
                            {isDup ? (
                              <label className="flex shrink-0 items-center gap-1.5 text-caption font-medium text-ink-muted">
                                <input
                                  type="checkbox"
                                  checked={!!importAnyway[row.rowNumber]}
                                  onChange={(e) =>
                                    setImportAnyway((prev) => ({
                                      ...prev,
                                      [row.rowNumber]: e.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 accent-brand-600"
                                />
                                Import anyway
                              </label>
                            ) : null}
                          </>
                        ) : (
                          <span className="min-w-0 flex-1 text-body-sm text-danger">
                            {row.error ?? "Invalid row"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {duplicateRowNumbers.size > 0 ? (
                  <p className="mt-2 text-caption text-ink-muted">
                    {duplicateRowNumbers.size} row
                    {duplicateRowNumbers.size === 1 ? " was" : "s were"} flagged as likely
                    duplicates (same merchant, amount, and date within 3 days of an existing entry
                    or an earlier row). They are skipped by default — tick “Import anyway” to
                    include them.
                  </p>
                ) : null}
                <p className="mt-2 text-caption text-ink-faint">
                  Imported rows are labeled “Imported” — this prototype never claims a bank
                  connection.
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={reset}>
                  Choose a different file
                </Button>
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
                <Button onClick={accept}>Accept import</Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {step === "done" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success-soft p-4">
            <CheckCircleIcon className="h-6 w-6 shrink-0 text-success" />
            <div>
              <p className="text-body font-semibold text-ink">
                Imported • {importedCount} {importedCount === 1 ? "row" : "rows"}
              </p>
              <p className="text-body-sm text-ink-muted">
                into {accountName(accountId)}
                {skippedCount > 0
                  ? ` · ${skippedCount} possible duplicate${skippedCount === 1 ? "" : "s"} skipped`
                  : ""}
              </p>
            </div>
          </div>
          <p className="text-body-sm text-ink-muted">
            Every row is labeled <span className="font-semibold text-ink">Imported</span> — manual
            data on this device, never a connected bank. You can review, re-categorize, exclude, or
            delete any of them from the account view.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}