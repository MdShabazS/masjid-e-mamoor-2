import { EncodingType, StorageAccessFramework } from "expo-file-system/legacy";
import { financeDateRangeCsv } from "@masjid-e-mamoor/shared";
import { supabase } from "../lib/supabase";

export function validFinanceDateRange(start: string, end: string) {
  const date = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  return date(start) && date(end) && end >= start &&
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 <= 365;
}

export function pdfBytesToBase64(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const pieces: string[] = [];
  for (let start = 0; start < bytes.length; start += 12288) {
    const end = Math.min(start + 12288, bytes.length);
    let piece = "";
    for (let i = start; i < end; i += 3) {
      const a = bytes[i], b = i + 1 < end ? bytes[i + 1] : 0, c = i + 2 < end ? bytes[i + 2] : 0;
      piece += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (b >> 4)] +
        (i + 1 < end ? alphabet[((b & 15) << 2) | (c >> 6)] : "=") +
        (i + 2 < end ? alphabet[c & 63] : "=");
    }
    pieces.push(piece);
  }
  return pieces.join("");
}

export async function downloadFinanceDateRangePdf(start: string, end: string) {
  if (!validFinanceDateRange(start, end)) throw new Error("invalid_report_range");
  const { data, error } = await supabase.functions.invoke("render-finance-date-range", {
    body: { start_date: start, end_date: end },
  });
  if (error || !data || typeof data.arrayBuffer !== "function")
    throw new Error("report_unavailable");
  const bytes = new Uint8Array(await (data as Blob).arrayBuffer());
  if (bytes.length < 6 || bytes.length > 20 * 1024 * 1024 ||
    bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70 || bytes[4] !== 45) {
    throw new Error("invalid_report_pdf");
  }
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;
  const filename = `masjid-e-mamoor-2-finance-${start}-to-${end}`;
  const uri = await StorageAccessFramework.createFileAsync(permission.directoryUri, filename, "application/pdf");
  await StorageAccessFramework.writeAsStringAsync(uri, pdfBytesToBase64(bytes), {
    encoding: EncodingType.Base64,
  });
  return true;
}

export async function downloadFinanceDateRangeCsv(start: string, end: string) {
  if (!validFinanceDateRange(start, end)) throw new Error("invalid_report_range");
  const { data, error } = await supabase.rpc("get_finance_date_range_report", {
    p_start_date: start, p_end_date: end,
  });
  if (error || !data) throw new Error("report_unavailable");
  const csv = financeDateRangeCsv(data);
  if (csv.length > 2 * 1024 * 1024) throw new Error("report_too_large");
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;
  const filename = `masjid-e-mamoor-2-finance-${start}-to-${end}`;
  const uri = await StorageAccessFramework.createFileAsync(permission.directoryUri, filename, "text/csv");
  await StorageAccessFramework.writeAsStringAsync(uri, csv, { encoding: EncodingType.UTF8 });
  return true;
}

export function financeMonthRange(value: string) {
  if (!/^(?:20\d{2})-(?:0[1-9]|1[0-2])$/.test(value)) throw new Error("invalid_report_month");
  const [year, month] = value.split("-").map(Number);
  return { start: `${value}-01`, end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}
