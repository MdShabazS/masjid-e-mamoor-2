import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
} from "npm:pdf-lib@1.17.1";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 42;
const FOOTER_HEIGHT = 30;
const CONTENT_BOTTOM = PAGE_MARGIN + FOOTER_HEIGHT;
const FIXED_PDF_DATE = new Date("2000-01-01T00:00:00.000Z");

const COLORS = {
  emerald: rgb(0.055, 0.275, 0.22),
  emeraldLight: rgb(0.9, 0.95, 0.93),
  gold: rgb(0.64, 0.48, 0.18),
  ink: rgb(0.13, 0.16, 0.15),
  muted: rgb(0.37, 0.4, 0.39),
  border: rgb(0.82, 0.84, 0.82),
  rowAlt: rgb(0.965, 0.966, 0.952),
  white: rgb(1, 1, 1),
};

export type JsonObject = Record<string, unknown>;

export interface FinanceReportMetadata {
  reportMonth: string;
  revision: number;
  snapshotSha256: string;
  generationSource: string;
  storageObjectPath: string;
}

interface Column {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right";
  amount?: boolean;
}

interface TableRow {
  [key: string]: unknown;
}

export function validateReportMonth(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-01$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12;
}

export function formatInrPaise(value: unknown): string {
  let paise: bigint;

  try {
    if (typeof value === "bigint") {
      paise = value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      paise = BigInt(Math.trunc(value));
    } else if (typeof value === "string" && /^-?\d+$/.test(value)) {
      paise = BigInt(value);
    } else {
      paise = 0n;
    }
  } catch {
    paise = 0n;
  }

  const negative = paise < 0n;
  const absolute = negative ? -paise : paise;
  const rupees = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  const digits = rupees.toString();
  const lastThree = digits.slice(-3);
  let leading = digits.slice(0, -3);
  const groups: string[] = [];

  while (leading.length > 2) {
    groups.unshift(leading.slice(-2));
    leading = leading.slice(0, -2);
  }

  if (leading) groups.unshift(leading);
  groups.push(lastThree);

  return `${negative ? "-" : ""}₹${groups.join(",")}.${fraction}`;
}

export function wrapTextByWidth(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const result: string[] = [];

  for (const paragraph of normalized.split("\n")) {
    if (!paragraph) {
      result.push("");
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const pieces = splitLongToken(word, maxWidth, measure);

      for (const piece of pieces) {
        const candidate = line ? `${line} ${piece}` : piece;
        if (measure(candidate) <= maxWidth) {
          line = candidate;
        } else {
          if (line) result.push(line);
          line = piece;
        }
      }
    }

    if (line) result.push(line);
  }

  return result.length > 0 ? result : [""];
}

function splitLongToken(
  token: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  if (measure(token) <= maxWidth) return [token];

  const pieces: string[] = [];
  let piece = "";

  for (const character of token) {
    const candidate = piece + character;
    if (piece && measure(candidate) > maxWidth) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = candidate;
    }
  }

  if (piece) pieces.push(piece);
  return pieces;
}

export function needsPageBreak(
  currentY: number,
  requiredHeight: number,
  bottomBoundary = CONTENT_BOTTOM,
): boolean {
  return currentY - requiredHeight < bottomBoundary;
}

export function isValidPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length > 5 &&
    bytes.length <= MAX_PDF_BYTES &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asRows(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(asObject) : [];
}

function asText(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

function asInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function sanitizePdfText(value: unknown): string {
  return asText(value)
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "|")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function titleCase(value: unknown): string {
  return sanitizePdfText(value)
    .toLowerCase()
    .replace(
      /(^|[_\s-])([a-z])/g,
      (_match, separator, letter) =>
        `${separator === "_" ? " " : separator}${letter.toUpperCase()}`,
    );
}

function shortId(value: unknown): string {
  const text = asText(value, "");
  return text.length > 12 ? text.slice(0, 12) : text || "—";
}

class ReportWriter {
  private page!: PDFPage;
  private y = 0;

  constructor(
    private readonly document: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.addPage();
  }

  private addPage(): void {
    this.page = this.document.addPage([A4_WIDTH, A4_HEIGHT]);
    this.y = A4_HEIGHT - PAGE_MARGIN;
  }

  private ensureSpace(height: number): boolean {
    if (!needsPageBreak(this.y, height)) return false;
    this.addPage();
    return true;
  }

  drawCover(metadata: FinanceReportMetadata): void {
    this.page.drawRectangle({
      x: 0,
      y: A4_HEIGHT - 182,
      width: A4_WIDTH,
      height: 182,
      color: COLORS.emerald,
    });
    this.page.drawRectangle({
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 187,
      width: 74,
      height: 5,
      color: COLORS.gold,
    });
    this.page.drawText("MASJID-E-MAMOOR", {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 82,
      size: 13,
      font: this.bold,
      color: COLORS.white,
    });
    this.page.drawText("Monthly Finance Report", {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 121,
      size: 26,
      font: this.bold,
      color: COLORS.white,
    });
    this.page.drawText(formatMonth(metadata.reportMonth), {
      x: PAGE_MARGIN,
      y: A4_HEIGHT - 151,
      size: 14,
      font: this.regular,
      color: COLORS.white,
    });
    this.y = A4_HEIGHT - 225;
    this.keyValues([
      ["Report month", metadata.reportMonth],
      ["Revision", String(metadata.revision)],
      ["Snapshot", `${metadata.snapshotSha256.slice(0, 16)}...`],
    ]);
  }

  section(title: string, note?: string): void {
    this.ensureSpace(note ? 54 : 38);
    this.y -= 12;
    this.page.drawRectangle({
      x: PAGE_MARGIN,
      y: this.y - 3,
      width: 5,
      height: 18,
      color: COLORS.gold,
    });
    this.page.drawText(title.toUpperCase(), {
      x: PAGE_MARGIN + 13,
      y: this.y,
      size: 12,
      font: this.bold,
      color: COLORS.emerald,
    });
    this.y -= 22;

    if (note) {
      this.paragraph(note, 8.5, COLORS.muted);
      this.y -= 3;
    }
  }

  paragraph(
    text: string,
    size = 9,
    color = COLORS.ink,
    bold = false,
  ): void {
    const font = bold ? this.bold : this.regular;
    const safe = sanitizePdfText(text);
    const lines = wrapTextByWidth(
      safe,
      A4_WIDTH - PAGE_MARGIN * 2,
      (line) => font.widthOfTextAtSize(line, size),
    );
    const lineHeight = size + 3;

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line || " ", {
        x: PAGE_MARGIN,
        y: this.y,
        size,
        font,
        color,
      });
      this.y -= lineHeight;
    }
  }

  keyValues(rows: Array<[string, unknown, boolean?]>): void {
    const rowHeight = 22;
    for (let index = 0; index < rows.length; index += 1) {
      this.ensureSpace(rowHeight);
      const [label, value, amount] = rows[index];
      if (index % 2 === 0) {
        this.page.drawRectangle({
          x: PAGE_MARGIN,
          y: this.y - rowHeight + 6,
          width: A4_WIDTH - PAGE_MARGIN * 2,
          height: rowHeight,
          color: COLORS.rowAlt,
        });
      }
      this.page.drawText(sanitizePdfText(label), {
        x: PAGE_MARGIN + 8,
        y: this.y,
        size: 9,
        font: this.regular,
        color: COLORS.muted,
      });
      const valueX = PAGE_MARGIN + 232;
      if (amount) {
        this.drawAmount(formatInrPaise(value), valueX, this.y, 9, false);
      } else {
        this.page.drawText(sanitizePdfText(value), {
          x: valueX,
          y: this.y,
          size: 9,
          font: this.bold,
          color: COLORS.ink,
        });
      }
      this.y -= rowHeight;
    }
    this.y -= 5;
  }

  table(columns: Column[], rows: TableRow[]): void {
    if (rows.length === 0) {
      this.paragraph("No activity", 9, COLORS.muted);
      this.y -= 5;
      return;
    }

    const drawHeader = () => {
      const headerHeight = 23;
      this.page.drawRectangle({
        x: PAGE_MARGIN,
        y: this.y - 7,
        width: columns.reduce((sum, column) => sum + column.width, 0),
        height: headerHeight,
        color: COLORS.emerald,
      });
      let x = PAGE_MARGIN;
      for (const column of columns) {
        this.page.drawText(sanitizePdfText(column.label), {
          x: x + 5,
          y: this.y,
          size: 7.5,
          font: this.bold,
          color: COLORS.white,
        });
        x += column.width;
      }
      this.y -= headerHeight;
    };

    this.ensureSpace(46);
    drawHeader();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const linesByColumn = columns.map((column) => {
        if (column.amount) return [formatInrPaise(row[column.key])];
        return wrapTextByWidth(
          sanitizePdfText(row[column.key]),
          column.width - 10,
          (line) => this.regular.widthOfTextAtSize(line, 7.5),
        );
      });
      const rowHeight = Math.max(
        21,
        Math.max(...linesByColumn.map((lines) => lines.length)) * 10 + 8,
      );

      if (this.ensureSpace(rowHeight + 3)) drawHeader();

      if (rowIndex % 2 === 1) {
        this.page.drawRectangle({
          x: PAGE_MARGIN,
          y: this.y - rowHeight + 6,
          width: columns.reduce((sum, column) => sum + column.width, 0),
          height: rowHeight,
          color: COLORS.rowAlt,
        });
      }

      let x = PAGE_MARGIN;
      for (
        let columnIndex = 0;
        columnIndex < columns.length;
        columnIndex += 1
      ) {
        const column = columns[columnIndex];
        const lines = linesByColumn[columnIndex];
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const lineY = this.y - lineIndex * 10;
          if (column.amount) {
            this.drawAmount(
              lines[lineIndex],
              x + column.width - 5,
              lineY,
              7.5,
              true,
            );
          } else {
            const width = this.regular.widthOfTextAtSize(
              lines[lineIndex],
              7.5,
            );
            const textX = column.align === "right"
              ? x + column.width - width - 5
              : x + 5;
            this.page.drawText(lines[lineIndex] || " ", {
              x: textX,
              y: lineY,
              size: 7.5,
              font: this.regular,
              color: COLORS.ink,
            });
          }
        }
        x += column.width;
      }

      this.page.drawLine({
        start: { x: PAGE_MARGIN, y: this.y - rowHeight + 6 },
        end: {
          x: PAGE_MARGIN + columns.reduce(
            (sum, column) => sum + column.width,
            0,
          ),
          y: this.y - rowHeight + 6,
        },
        thickness: 0.35,
        color: COLORS.border,
      });
      this.y -= rowHeight;
    }
    this.y -= 6;
  }

  addFooters(): void {
    const pages = this.document.getPages();
    pages.forEach((page, index) => {
      page.drawLine({
        start: { x: PAGE_MARGIN, y: PAGE_MARGIN },
        end: { x: A4_WIDTH - PAGE_MARGIN, y: PAGE_MARGIN },
        thickness: 0.5,
        color: COLORS.border,
      });
      const footer = `Masjid-e-Mamoor • Monthly Finance Report • Page ${
        index + 1
      }`;
      const width = this.regular.widthOfTextAtSize(footer, 7.5);
      page.drawText(footer, {
        x: (A4_WIDTH - width) / 2,
        y: PAGE_MARGIN - 14,
        size: 7.5,
        font: this.regular,
        color: COLORS.muted,
      });
    });
  }

  private drawAmount(
    formatted: string,
    x: number,
    y: number,
    size: number,
    rightAligned: boolean,
  ): void {
    const negative = formatted.startsWith("-");
    const number = formatted.replace("-₹", "").replace("₹", "");
    const minusWidth = negative ? this.regular.widthOfTextAtSize("-", size) : 0;
    const symbolWidth = size * 0.72;
    const numberWidth = this.regular.widthOfTextAtSize(number, size);
    const totalWidth = minusWidth + symbolWidth + numberWidth;
    let currentX = rightAligned ? x - totalWidth : x;

    if (negative) {
      this.page.drawText("-", {
        x: currentX,
        y,
        size,
        font: this.regular,
        color: COLORS.ink,
      });
      currentX += minusWidth;
    }

    drawRupeeGlyph(this.page, currentX, y, size, COLORS.ink);
    currentX += symbolWidth;
    this.page.drawText(number, {
      x: currentX,
      y,
      size,
      font: this.regular,
      color: COLORS.ink,
    });
  }
}

function drawRupeeGlyph(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
): void {
  const width = size * 0.58;
  const top = y + size * 0.72;
  const middle = y + size * 0.48;
  const left = x + size * 0.08;
  const right = x + width;
  const stroke = Math.max(0.65, size * 0.075);

  page.drawLine({
    start: { x: left, y: top },
    end: { x: right, y: top },
    thickness: stroke,
    color,
  });
  page.drawLine({
    start: { x: left, y: middle },
    end: { x: right, y: middle },
    thickness: stroke,
    color,
  });
  page.drawLine({
    start: { x: left + size * 0.05, y: top },
    end: { x: left + size * 0.29, y: middle },
    thickness: stroke,
    color,
  });
  page.drawLine({
    start: { x: left + size * 0.29, y: middle },
    end: { x: right - size * 0.03, y: y - size * 0.03 },
    thickness: stroke,
    color,
  });
}

function formatMonth(reportMonth: string): string {
  const [year, month] = reportMonth.split("-").map(Number);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[month - 1] ?? "Month"} ${year}`;
}

export async function renderFinanceMonthlyReportPdf(
  snapshotValue: unknown,
  metadata: FinanceReportMetadata,
): Promise<Uint8Array> {
  const snapshot = asObject(snapshotValue);
  const summary = asObject(snapshot.summary);
  const breakdown = asObject(snapshot.donation_breakdown);
  const closing = asObject(snapshot.closing_by_account_type);
  const outstanding = asObject(snapshot.outstanding_obligations);
  const workflow = asObject(snapshot.workflow);

  const document = await PDFDocument.create({ updateMetadata: false });
  document.setTitle("Masjid-e-Mamoor Monthly Finance Report");
  document.setAuthor("Masjid-e-Mamoor");
  document.setSubject(`Monthly Finance Report ${metadata.reportMonth}`);
  document.setCreator("Masjid-e-Mamoor Finance Reporting");
  document.setProducer("Masjid-e-Mamoor Finance Reporting");
  document.setCreationDate(FIXED_PDF_DATE);
  document.setModificationDate(FIXED_PDF_DATE);

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const writer = new ReportWriter(document, regular, bold);

  writer.drawCover(metadata);

  writer.section("Executive Summary");
  writer.keyValues([
    ["Opening balance", summary.opening_balance_paise, true],
    ["Donation inflow", summary.donation_inflow_paise, true],
    ["Expenditure", summary.expense_outflow_paise, true],
    ["Adjustments net", summary.adjustments_net_paise, true],
    ["Transfer in", summary.transfer_in_paise, true],
    ["Transfer out", summary.transfer_out_paise, true],
    ["Closing balance", summary.closing_balance_paise, true],
    ["Transaction count", asInteger(summary.transaction_count)],
  ]);

  writer.section("Closing Balance by Account Type");
  const closingTotal = [
    closing.cash_paise,
    closing.bank_paise,
    closing.upi_paise,
    closing.other_paise,
  ].reduce<bigint>((total, value) => total + BigInt(asInteger(value)), 0n);
  writer.keyValues([
    ["Cash — Ledger Balance", closing.cash_paise, true],
    ["Bank — Ledger Balance", closing.bank_paise, true],
    ["UPI — Ledger Balance", closing.upi_paise, true],
    ["Other — Ledger Balance", closing.other_paise, true],
    ["Total — Ledger Balance", closingTotal, true],
  ]);

  writer.section("Account-wise Summary");
  writer.table(
    [
      { key: "name", label: "Account", width: 126 },
      { key: "account_type", label: "Type", width: 55 },
      {
        key: "opening_balance_paise",
        label: "Opening",
        width: 82,
        amount: true,
      },
      { key: "month_inflow_paise", label: "Inflow", width: 80, amount: true },
      { key: "month_outflow_paise", label: "Outflow", width: 80, amount: true },
      {
        key: "closing_balance_paise",
        label: "Closing ledger",
        width: 88,
        amount: true,
      },
    ],
    asRows(snapshot.accounts).map((row) => ({
      ...row,
      account_type: titleCase(row.account_type),
    })),
  );

  writer.section("Donations");
  writer.keyValues([
    ["Recurring", breakdown.recurring_paise, true],
    ["Additional", breakdown.additional_paise, true],
    ["Anonymous", breakdown.anonymous_paise, true],
    ["Jummah cash", breakdown.jummah_paise, true],
    ["Total donations", summary.donation_inflow_paise, true],
  ]);
  writer.table(
    [
      { key: "business_date", label: "Date", width: 66 },
      { key: "category", label: "Category", width: 94 },
      { key: "member", label: "Member / source", width: 128 },
      { key: "account_name", label: "Account", width: 105 },
      { key: "amount_paise", label: "Amount", width: 118, amount: true },
    ],
    asRows(snapshot.donations).map((row) => ({
      ...row,
      category: titleCase(row.category),
      member: asText(row.member_name, "Not recorded"),
    })),
  );

  writer.section("Expenditure");
  writer.table(
    [
      { key: "business_date", label: "Date", width: 66 },
      { key: "description", label: "Description", width: 150 },
      { key: "payee", label: "Payee", width: 103 },
      { key: "account_name", label: "Account", width: 92 },
      { key: "amount_paise", label: "Amount", width: 100, amount: true },
    ],
    asRows(snapshot.expenses),
  );

  writer.section(
    "Transfers",
    "Transfers are movements between Masjid accounts and are not organizational income or expenditure.",
  );
  writer.table(
    [
      { key: "business_date", label: "Date", width: 62 },
      { key: "source_account_name", label: "From", width: 105 },
      { key: "destination_account_name", label: "To", width: 105 },
      { key: "reason", label: "Reason", width: 137 },
      { key: "amount_paise", label: "Amount", width: 102, amount: true },
    ],
    asRows(snapshot.transfers),
  );

  writer.section("Corrections / Reversals");
  writer.table(
    [
      { key: "business_date", label: "Date", width: 62 },
      { key: "adjustment_type", label: "Type", width: 72 },
      { key: "reason", label: "Reason", width: 150 },
      { key: "target", label: "Target", width: 92 },
      { key: "direction", label: "Direction", width: 60 },
      {
        key: "correction_amount_paise",
        label: "Amount",
        width: 75,
        amount: true,
      },
    ],
    asRows(snapshot.adjustments).map((row) => ({
      ...row,
      adjustment_type: titleCase(row.adjustment_type),
      target: shortId(row.target_transaction_id),
      direction: titleCase(row.correction_direction),
    })),
  );

  writer.section(
    "Donation Outstanding",
    "Informational — Outstanding as of Month End",
  );
  writer.keyValues([
    ["As of date", outstanding.as_of_date],
    [
      "Outstanding obligations",
      asInteger(outstanding.outstanding_obligation_count),
    ],
    ["Total outstanding", outstanding.total_outstanding_paise, true],
  ]);
  writer.table(
    [
      { key: "member", label: "Member", width: 126 },
      { key: "effective_month", label: "Month", width: 66 },
      {
        key: "authoritative_amount_paise",
        label: "Expected",
        width: 82,
        amount: true,
      },
      {
        key: "allocated_amount_paise",
        label: "Allocated",
        width: 80,
        amount: true,
      },
      { key: "waived_amount_paise", label: "Waived", width: 72, amount: true },
      {
        key: "outstanding_amount_paise",
        label: "Remaining",
        width: 85,
        amount: true,
      },
    ],
    asRows(outstanding.obligations).map((row) => ({
      ...row,
      member: asText(row.member_name, "Name unavailable"),
    })),
  );

  writer.section(
    "Workflow Status",
    "Informational only — pending and rejected items are not included in posted ledger balances.",
  );
  writer.table(
    [
      { key: "workflow", label: "Workflow", width: 245 },
      { key: "submitted", label: "Submitted", width: 133 },
      { key: "rejected", label: "Rejected", width: 133 },
    ],
    ["expenses", "transfers", "adjustments"].map((key) => {
      const value = asObject(workflow[key]);
      return {
        workflow: titleCase(key),
        submitted: asInteger(value.submitted),
        rejected: asInteger(value.rejected),
      };
    }),
  );

  writer.section("Detailed Ledger");
  writer.table(
    [
      { key: "business_date", label: "Date", width: 58 },
      { key: "category", label: "Category", width: 92 },
      { key: "account_name", label: "Account", width: 92 },
      { key: "direction", label: "Direction", width: 56 },
      { key: "amount_paise", label: "Amount", width: 84, amount: true },
      { key: "reference", label: "Reference", width: 77 },
      { key: "transaction", label: "Transaction", width: 52 },
    ],
    asRows(snapshot.ledger).map((row) => ({
      ...row,
      category: titleCase(row.transaction_category),
      direction: titleCase(row.direction),
      reference: `${titleCase(row.reference_type)} ${
        shortId(row.reference_id)
      }`,
      transaction: shortId(row.id),
    })),
  );

  writer.section("Audit / Report Metadata");
  writer.keyValues([
    ["Report month", metadata.reportMonth],
    ["Revision", metadata.revision],
    ["Transaction count", asInteger(summary.transaction_count)],
    ["Generation source", titleCase(metadata.generationSource)],
    ["Storage object path", metadata.storageObjectPath],
  ]);
  writer.paragraph("Snapshot SHA-256", 8.5, COLORS.muted, true);
  writer.paragraph(metadata.snapshotSha256, 8, COLORS.ink);
  writer.paragraph(
    "This PDF is rendered from an immutable authoritative monthly Finance snapshot.",
    8.5,
    COLORS.muted,
  );

  writer.addFooters();

  return document.save({
    addDefaultPage: false,
    useObjectStreams: false,
    objectsPerTick: Number.POSITIVE_INFINITY,
  });
}
