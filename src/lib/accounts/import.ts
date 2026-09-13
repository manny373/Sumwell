/**
 * CSV import — Phase 3c.
 *
 * Treats the file as UNTRUSTED data: every cell is plain text, control
 * characters are stripped, nothing is ever interpreted as markup or
 * instructions, and nothing is silently dropped or altered.
 *
 * Contract:
 *  - Required columns (case-insensitive, trimmed): date, description, amount.
 *  - Optional columns: category, status (pending|posted), type/kind
 *    (expense|income|transfer|loan payment), memo.
 *  - Amounts parse into SIGNED integer cents ("43.20", "-12.34", "$1,234.56").
 *    Unparseable amounts are a row error with the row number shown.
 *  - Dates accept YYYY-MM-DD (ISO) or MM/DD/YYYY (US convention; the preview
 *    says which one was accepted).
 *  - Bad rows are reported with their 1-based data row number — never dropped
 *    silently and never auto-altered to make them pass.
 *  - Duplicate candidates are flagged against both the same batch and the
 *    target account's existing transactions; the user decides skip/accept.
 */
import type {
  Transaction,
  TransactionKind,
  TransactionStatus,
} from "~/lib/finance/types";
import { daysBetween, daysInMonth, parseISODate } from "~/lib/client/dates";
import { normalizeCategory } from "./categories";

export interface ImportDraft {
  dateISO: string;
  merchant: string;
  description?: string;
  /** Signed from the account's perspective; money out is negative. */
  amountCents: number;
  category: string;
  kind: TransactionKind;
  status: TransactionStatus;
}

export interface ImportError {
  /** 1-based data row number (header is row 0). */
  rowNumber: number;
  message: string;
}

export interface ImportRow {
  rowNumber: number;
  ok: boolean;
  error?: string;
  /** Present iff ok. */
  draft?: ImportDraft;
  /** Flagged against earlier rows in the SAME file. */
  batchDuplicateOf?: number;
}

export interface ParsedImportFile {
  fileName: string;
  /** Header columns exactly as found (already normalized lower-case). */
  columns: string[];
  /** Columns present in the file but not used by the importer. */
  ignoredColumns: string[];
  /** Which date conventions were accepted, for the preview note. */
  dateFormat: "ISO" | "US";
  rows: ImportRow[];
  errors: ImportError[];
  /** File-level failure (missing columns, unparseable CSV). */
  fileError: string | null;
  validCount: number;
  totalCount: number;
}

/* ------------------------------------------------------------- CSV text -- */

/** Split a CSV body into cells honoring quotes/escapes. Throws on malformed quotes. */
export function splitCsvRows(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < normalized.length) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      // Drop a final empty row produced by a trailing newline.
      if (!(row.length === 1 && row[0] === "" && i === normalized.length - 1)) {
        rows.push(row);
      }
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (inQuotes) {
    throw new Error("Unclosed quote in CSV — check that every field that starts with \" also ends with one.");
  }
  row.push(field);
  if (!(row.length === 1 && row[0] === "")) rows.push(row);
  return rows;
}

/* ------------------------------------------------------- text hygiene ---- */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** Control characters are stripped; everything else is kept as plain text. */
export function sanitizeText(raw: string): string {
  return raw.replace(CONTROL_CHARS, "").trim();
}

const normalizeMerchant = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "")
    .trim();

/* ----------------------------------------------------------- parsing ------ */

/** "-43.20", "43.20", "$1,234.56", "+12.3" → signed integer cents; else null. */
export function parseCsvAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = /^([+-]?)\$?([\d,]+|\d{1,3}(?:,\d{3})*)(?:\.(\d{1,2}))?$/.exec(
    trimmed,
  );
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const whole = match[2].replace(/,/g, "");
  if (!/^\d+$/.test(whole)) return null;
  const frac = (match[3] ?? "").padEnd(2, "0");
  const cents = sign * (Number(whole) * 100 + Number(frac));
  return Number.isSafeInteger(cents) ? cents : null;
}

const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;
const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Accepts YYYY-MM-DD or MM/DD/YYYY. Returns normalized ISO or null. */
export function parseCsvDate(raw: string): { iso: string; format: "ISO" | "US" } | null {
  const trimmed = raw.trim();
  let m = isoDate.exec(trimmed);
  if (m) {
    let parsed;
    try {
      parsed = parseISODate(trimmed);
    } catch {
      return null;
    }
    // Reject impossible calendar days (e.g. Feb 30) instead of letting date
    // math silently roll over into the next month.
    if (parsed.d > daysInMonth(parsed.y, parsed.m)) return null;
    return { iso: trimmed, format: "ISO" };
  }
  m = usDate.exec(trimmed);
  if (m) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const parsed = parseISODate(iso);
    if (parsed.d > daysInMonth(parsed.y, parsed.m)) return null;
    return { iso, format: "US" };
  }
  return null;
}

/** Case-insensitive column lookup; returns the header's own casing, else null. */
function findColumn(headers: string[], wanted: string): string | null {
  return (
    headers.find((h) => h.trim().toLowerCase() === wanted.toLowerCase()) ?? null
  );
}

const KIND_ALIASES: Record<string, TransactionKind> = {
  expense: "expense",
  income: "income",
  transfer: "transfer",
  "loan payment": "loanPayment",
  loanpayment: "loanPayment",
  loan: "loanPayment",
};

const STATUS_ALIASES: Record<string, TransactionStatus> = {
  pending: "pending",
  posted: "posted",
  cleared: "posted",
  complete: "posted",
};

/* --------------------------------------------------------- main entry ---- */

export function parseImportCsv(text: string, fileName: string): ParsedImportFile {
  let table: string[][];
  try {
    table = splitCsvRows(text);
  } catch (err) {
    return {
      fileName,
      columns: [],
      ignoredColumns: [],
      dateFormat: "ISO",
      rows: [],
      errors: [],
      fileError: err instanceof Error ? err.message : "Couldn't parse this CSV.",
      validCount: 0,
      totalCount: 0,
    };
  }
  if (table.length < 2) {
    return {
      fileName,
      columns: [],
      ignoredColumns: [],
      dateFormat: "ISO",
      rows: [],
      errors: [],
      fileError: "The file needs a header row plus at least one data row.",
      validCount: 0,
      totalCount: 0,
    };
  }

  const headers = table[0].map((h, idx) => sanitizeText(h) || `column ${idx + 1}`);
  const dateCol = findColumn(headers, "date");
  const descriptionCol = findColumn(headers, "description");
  const amountCol = findColumn(headers, "amount");
  if (!dateCol || !descriptionCol || !amountCol) {
    const missing = ["date", "description", "amount"]
      .filter((c) => !findColumn(headers, c))
      .join(", ");
    return {
      fileName,
      columns: headers,
      ignoredColumns: [],
      dateFormat: "ISO",
      rows: [],
      errors: [],
      fileError: `Missing required column(s): ${missing}. Required columns are date, description, amount.`,
      validCount: 0,
      totalCount: 0,
    };
  }

  const categoryCol = findColumn(headers, "category");
  const statusCol = findColumn(headers, "status");
  const typeCol = findColumn(headers, "type") ?? findColumn(headers, "kind");
  const memoCol = findColumn(headers, "memo");
  const used = new Set(
    [dateCol, descriptionCol, amountCol, categoryCol, statusCol, typeCol, memoCol].filter(
      Boolean,
    ),
  );
  const ignoredColumns = headers.filter((h) => !used.has(h));

  const colIndex = (name: string) => headers.indexOf(name);

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  let dateFormat: "ISO" | "US" = "ISO";

  // First pass: header-driven parse of every data row (with errors, none dropped).
  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const rowNumber = r; // header is row 0 — data row 1 is the first
    const at = (name: string | null) => {
      if (name === null) return "";
      const idx = colIndex(name);
      return idx >= 0 && idx < cells.length ? cells[idx] : "";
    };

    const dateRaw = sanitizeText(at(dateCol));
    if (!dateRaw) {
      errors.push({ rowNumber, message: "date is required." });
      continue;
    }
    const parsedDate = parseCsvDate(dateRaw);
    if (!parsedDate) {
      errors.push({
        rowNumber,
        message: `date "${dateRaw}" isn't recognized — use YYYY-MM-DD or MM/DD/YYYY.`,
      });
      continue;
    }
    dateFormat = parsedDate.format;

    const description = sanitizeText(at(descriptionCol));
    if (!description) {
      errors.push({ rowNumber, message: "description is required." });
      continue;
    }

    const amountRaw = at(amountCol);
    const amountCents = parseCsvAmount(amountRaw);
    if (amountCents === null) {
      errors.push({
        rowNumber,
        message: `amount "${amountRaw.trim()}" isn't a valid dollar amount — the Money column expects e.g. 43.20 or -12.34.`,
      });
      continue;
    }
    if (amountCents === 0) {
      errors.push({ rowNumber, message: "amount must be non-zero." });
      continue;
    }

    let kind: TransactionKind = amountCents < 0 ? "expense" : "income";
    if (typeCol) {
      const typeRaw = sanitizeText(at(typeCol)).toLowerCase();
      if (typeRaw) {
        const mapped = KIND_ALIASES[typeRaw];
        if (!mapped) {
          errors.push({
            rowNumber,
            message: `type "${typeRaw}" isn't recognized — use expense, income, transfer, or loan payment.`,
          });
          continue;
        }
        kind = mapped;
      }
    }

    let status: TransactionStatus = "posted";
    if (statusCol) {
      const statusRaw = sanitizeText(at(statusCol)).toLowerCase();
      if (statusRaw) {
        const mapped = STATUS_ALIASES[statusRaw];
        if (!mapped) {
          errors.push({
            rowNumber,
            message: `status "${statusRaw}" isn't recognized — use pending or posted.`,
          });
          continue;
        }
        status = mapped;
      }
    }

    const memo = sanitizeText(at(memoCol));
    const category = normalizeCategory(at(categoryCol));

    rows.push({
      rowNumber,
      ok: true,
      draft: {
        dateISO: parsedDate.iso,
        merchant: description,
        description: memo || undefined,
        amountCents,
        category,
        kind,
        status,
      },
    });
  }

  // Second pass: flag batch duplicates (same merchant, same magnitude, ≤3 days).
  const normalizedSoFar = new Map<string, number[]>();
  for (const row of rows) {
    const d = row.draft!;
    const key = `${normalizeMerchant(d.merchant)}|${Math.abs(d.amountCents)}`;
    const earlier = normalizedSoFar.get(key) ?? [];
    const partner = earlier.find((otherRowNum) => {
      const other = rows[otherRowNum - 1].draft!;
      return Math.abs(daysBetween(other.dateISO, d.dateISO)) <= 3;
    });
    if (partner !== undefined) {
      row.batchDuplicateOf = partner;
    }
    normalizedSoFar.set(key, [...earlier, row.rowNumber]);
  }

  return {
    fileName,
    columns: headers,
    ignoredColumns,
    dateFormat,
    rows,
    errors,
    fileError: null,
    validCount: rows.length,
    totalCount: table.length - 1,
  };
}

/* ------------------------------------------------- duplicate detection ---- */

export interface ExistingDuplicateFlag {
  /** The row that looks like a duplicate. */
  rowNumber: number;
  /** Ids of existing transactions it matches. */
  existingTxnIds: string[];
  reason: string;
}

/**
 * Match parsed drafts against the target account's existing transactions.
 * A draft is flagged when it matches another row on normalized merchant,
 * |amount|, and dates within 3 days.
 */
export function findExistingDuplicates(
  rows: readonly ImportRow[],
  accountId: string,
  existing: readonly Transaction[],
): ExistingDuplicateFlag[] {
  const candidates = rows
    .filter((r) => r.ok && r.draft)
    .map((r) => ({ row: r, draft: r.draft! }));
  const flags: ExistingDuplicateFlag[] = [];
  for (const { row, draft } of candidates) {
    const key = `${normalizeMerchant(draft.merchant)}|${Math.abs(draft.amountCents)}`;
    const matches: string[] = [];
    for (const txn of existing) {
      if (txn.accountId !== accountId) continue;
      const tKey = `${normalizeMerchant(txn.merchant)}|${Math.abs(txn.amountCents)}`;
      if (tKey !== key) continue;
      const gap = Math.abs(daysBetween(txn.transactedAt, draft.dateISO));
      if (gap > 3) continue;
      matches.push(txn.id);
    }
    if (matches.length > 0) {
      const dated = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${draft.dateISO}T00:00:00Z`));
      flags.push({
        rowNumber: row.rowNumber,
        existingTxnIds: matches,
        reason: `Same merchant, amount, and date (within 3 days of ${dated}) as an existing entry.`,
      });
    }
  }
  return flags;
}