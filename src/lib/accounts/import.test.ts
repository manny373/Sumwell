import { describe, expect, test } from "bun:test";
import type { Transaction } from "~/lib/finance/types";
import {
  findExistingDuplicates,
  parseCsvAmount,
  parseCsvDate,
  parseImportCsv,
  sanitizeText,
  splitCsvRows,
} from "./import";

describe("splitCsvRows (CSV text → cells)", () => {
  test("splits plain rows and drops a trailing-newline artifact", () => {
    expect(splitCsvRows("a,b\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(splitCsvRows("a,b")).toEqual([["a", "b"]]);
  });

  test("honors quoted fields containing commas and escaped quotes", () => {
    expect(splitCsvRows('"x,y",z\n')).toEqual([["x,y", "z"]]);
    expect(splitCsvRows('"say ""hi""",z')).toEqual([['say "hi"', "z"]]);
  });

  test("keeps empty cells and strips a leading BOM; CRLF normalizes to LF", () => {
    expect(splitCsvRows("a,b,,d")).toEqual([["a", "b", "", "d"]]);
    expect(splitCsvRows("\uFEFFa,b")).toEqual([["a", "b"]]);
    expect(splitCsvRows("a,b\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  test("throws on an unclosed quote (untrusted file is rejected, not guessed)", () => {
    expect(() => splitCsvRows('2026-09-10,"oops,-1.00')).toThrow(/Unclosed quote/);
  });
});

describe("sanitizeText", () => {
  test("strips control characters and trims", () => {
    expect(sanitizeText("Evil\u0000Merchant")).toBe("EvilMerchant");
    expect(sanitizeText("  padded  ")).toBe("padded");
    expect(sanitizeText("plain text, 100%")).toBe("plain text, 100%");
  });
});

describe("parseCsvAmount (integer cents, signed)", () => {
  test("parses valid dollar shapes exactly", () => {
    expect(parseCsvAmount("43.20")).toBe(4320);
    expect(parseCsvAmount("-12.34")).toBe(-1234);
    expect(parseCsvAmount("$1,234.56")).toBe(123456);
    expect(parseCsvAmount("+12.3")).toBe(1230);
    expect(parseCsvAmount("12")).toBe(1200);
    expect(parseCsvAmount(" 5 ")).toBe(500);
    expect(parseCsvAmount("0.01")).toBe(1);
  });

  test("rejects anything that is not a plain dollar amount", () => {
    expect(parseCsvAmount("")).toBeNull();
    expect(parseCsvAmount("abc")).toBeNull();
    expect(parseCsvAmount("12.345")).toBeNull();
    expect(parseCsvAmount("1e3")).toBeNull();
    expect(parseCsvAmount("--2")).toBeNull();
  });
});

describe("parseCsvDate", () => {
  test("accepts ISO and US formats and normalizes to ISO", () => {
    expect(parseCsvDate("2026-09-10")).toEqual({ iso: "2026-09-10", format: "ISO" });
    expect(parseCsvDate("9/10/2026")).toEqual({ iso: "2026-09-10", format: "US" });
    expect(parseCsvDate("09/5/2026")).toEqual({ iso: "2026-09-05", format: "US" });
    expect(parseCsvDate("2024-02-29")).toEqual({ iso: "2024-02-29", format: "ISO" }); // leap day
  });

  test("rejects impossible calendar days instead of rolling over", () => {
    expect(parseCsvDate("2026-02-30")).toBeNull(); // Feb has 28 days in 2026
    expect(parseCsvDate("2/30/2026")).toBeNull();
    expect(parseCsvDate("9/31/2026")).toBeNull(); // September has 30 days
    expect(parseCsvDate("13/1/2026")).toBeNull();
    expect(parseCsvDate("2026-13-01")).toBeNull();
    expect(parseCsvDate("10/09/26")).toBeNull();
    expect(parseCsvDate("")).toBeNull();
  });
});

describe("parseImportCsv — happy path", () => {
  const csv = [
    "date,description,amount",
    "2026-09-10,Coffee Shop,-4.50",
    "2026-09-11,Paycheck,2000.00",
  ].join("\n");

  test("parses both rows with signed cents and sensible defaults", () => {
    const parsed = parseImportCsv(csv, "demo.csv");
    expect(parsed.fileError).toBeNull();
    expect(parsed.fileName).toBe("demo.csv");
    expect(parsed.columns).toEqual(["date", "description", "amount"]);
    expect(parsed.ignoredColumns).toEqual([]);
    expect(parsed.dateFormat).toBe("ISO");
    expect(parsed.totalCount).toBe(2);
    expect(parsed.validCount).toBe(2);
    expect(parsed.errors).toEqual([]);

    expect(parsed.rows[0]).toMatchObject({
      ok: true,
      rowNumber: 1,
      draft: {
        dateISO: "2026-09-10",
        merchant: "Coffee Shop",
        amountCents: -450,
        kind: "expense",
        status: "posted",
        category: "uncategorized",
      },
    });
    expect(parsed.rows[1]).toMatchObject({
      ok: true,
      rowNumber: 2,
      draft: { amountCents: 200000, kind: "income" },
    });
  });

  test("maps optional columns: US dates, type/status aliases, category, memo", () => {
    const csv2 = [
      "Date,Description,Amount,Type,Status,Category,Memo",
      "9/10/2026,Rent,-1200.00,expense,pending,housing,September rent",
      "9/11/2026,Refund,25,income,cleared,refund,overpaid fee",
    ].join("\n");
    const parsed = parseImportCsv(csv2, "full.csv");
    expect(parsed.dateFormat).toBe("US");
    expect(parsed.validCount).toBe(2);
    expect(parsed.rows[0].draft).toMatchObject({
      dateISO: "2026-09-10",
      kind: "expense",
      status: "pending",
      category: "housing",
      description: "September rent",
    });
    expect(parsed.rows[1].draft).toMatchObject({
      dateISO: "2026-09-11",
      amountCents: 2500,
      kind: "income",
      status: "posted", // "cleared" alias → posted
      category: "refund",
    });
  });

  test("flags unknown columns as ignored, not silently dropped", () => {
    const csv3 = [
      "date,description,amount,balance,reference",
      "2026-09-10,Thing,-1.00,99.00,ref-1",
    ].join("\n");
    const parsed = parseImportCsv(csv3, "extra.csv");
    expect(parsed.validCount).toBe(1);
    expect(parsed.ignoredColumns).toEqual(["balance", "reference"]);
  });
});

describe("parseImportCsv — bad rows are reported, never dropped silently", () => {
  const csv = [
    "date,description,amount",
    "2026-09-10,Ok,-1.00",
    "not-a-date,Bad,-2.00",
    "2026-09-12,,-3.00", // missing description
    "2026-09-12,Three,-x", // bad amount
    "2026-09-12,Zero,0", // zero amount
    "2026-02-30,Impossible,-4.00", // impossible date
  ].join("\n");

  test("keeps the one valid row and reports each bad row with its number", () => {
    const parsed = parseImportCsv(csv, "bad.csv");
    expect(parsed.validCount).toBe(1);
    expect(parsed.totalCount).toBe(6);
    expect(parsed.fileError).toBeNull();
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].rowNumber).toBe(1);
    expect(parsed.errors).toEqual([
      { rowNumber: 2, message: expect.stringContaining("not-a-date") },
      { rowNumber: 3, message: "description is required." },
      { rowNumber: 4, message: expect.stringContaining("-x") },
      { rowNumber: 5, message: "amount must be non-zero." },
      { rowNumber: 6, message: expect.stringContaining("2026-02-30") },
    ]);
  });

  test("rejects an unrecognized type value with the row number", () => {
    const csv4 = [
      "date,description,amount,type",
      "2026-09-10,Thing,-1.00,badtype",
    ].join("\n");
    const parsed = parseImportCsv(csv4, "type.csv");
    expect(parsed.validCount).toBe(0);
    expect(parsed.errors).toEqual([
      { rowNumber: 1, message: expect.stringContaining("badtype") },
    ]);
  });

  test("rejects an unrecognized status value with the row number", () => {
    const csv5 = [
      "date,description,amount,status",
      "2026-09-10,Thing,-1.00,soon",
    ].join("\n");
    const parsed = parseImportCsv(csv5, "status.csv");
    expect(parsed.validCount).toBe(0);
    expect(parsed.errors).toEqual([
      { rowNumber: 1, message: expect.stringContaining("soon") },
    ]);
  });

  test("loan payment type maps to loanPayment kind", () => {
    const csv6 = [
      "date,description,amount,type",
      "2026-09-10,Auto Loan,-350.00,loan payment",
    ].join("\n");
    const parsed = parseImportCsv(csv6, "loan.csv");
    expect(parsed.rows[0].draft?.kind).toBe("loanPayment");
  });
});

describe("parseImportCsv — file-level failures", () => {
  test("missing required column → fileError naming the column", () => {
    const parsed = parseImportCsv("date,description\n2026-09-10,Thing", "nocol.csv");
    expect(parsed.validCount).toBe(0);
    expect(parsed.fileError).toContain("Missing required column(s): amount");
  });

  test("header-only file → fileError", () => {
    const parsed = parseImportCsv("date,description,amount", "empty.csv");
    expect(parsed.fileError).toContain("header row plus at least one data row");
  });

  test("unclosed quote → fileError, zero rows", () => {
    const parsed = parseImportCsv('date,description,amount\n2026-09-10,"oops,-1.00', "quote.csv");
    expect(parsed.fileError).toContain("Unclosed quote");
    expect(parsed.validCount).toBe(0);
  });
});

describe("parseImportCsv — duplicate flags within one batch", () => {
  const csv = [
    "date,description,amount",
    "2026-09-10,Corner Store,-12.00",
    "2026-09-12,Corner Store,-12.00", // same merchant+magnitude, 2 days later
    "2026-09-20,Corner Store,-12.00", // 10 days later — no flag
  ].join("\n");

  test("flags the within-3-days pair, not the far-apart row", () => {
    const parsed = parseImportCsv(csv, "dupes.csv");
    expect(parsed.validCount).toBe(3);
    expect(parsed.rows[0].batchDuplicateOf).toBeUndefined();
    expect(parsed.rows[1].batchDuplicateOf).toBe(1);
    expect(parsed.rows[2].batchDuplicateOf).toBeUndefined();
  });
});

describe("findExistingDuplicates — drafts vs the target account", () => {
  const existing: Transaction = {
    id: "tx-1",
    accountId: "acc-checking",
    merchant: "Corner Store",
    amountCents: -1200,
    kind: "expense",
    status: "posted",
    category: "groceries",
    transactedAt: "2026-09-11",
    postedAt: "2026-09-11",
    splits: [],
    isExcluded: false,
    principalCents: null,
    interestCents: null,
    source: "manual",
  };

  const csv = [
    "date,description,amount",
    "2026-09-12,Corner Store,-12.00", // within 3 days of tx-1
    "2026-09-20,Corner Store,-12.00", // far apart
  ].join("\n");

  test("flags only the row matching an existing transaction in the same account", () => {
    const parsed = parseImportCsv(csv, "existing.csv");
    const flags = findExistingDuplicates(parsed.rows, "acc-checking", [existing]);
    expect(flags).toHaveLength(1);
    expect(flags[0].rowNumber).toBe(1);
    expect(flags[0].existingTxnIds).toEqual(["tx-1"]);
    expect(flags[0].reason).toContain("3 days");

    const otherAcc = findExistingDuplicates(parsed.rows, "acc-savings", [existing]);
    expect(otherAcc).toEqual([]);
  });
});