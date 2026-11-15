"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { billExtension } from "@/lib/finance/expense-bill";

type Props = { expenseId: string; upload?: boolean; billId?: string; label?: string };

export function ExpenseBillControl({ expenseId, upload, billId, label }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function viewBill() {
    setBusy(true); setMessage("");
    try {
      const client = createClient();
      const { data: bill, error } = await client.from("finance_expense_bills")
        .select("storage_object_path").eq("id", billId!).eq("finance_expense_id", expenseId).single();
      if (error || !bill) throw new Error("Bill unavailable");
      const signed = await client.storage.from("finance-expense-bills").createSignedUrl(bill.storage_object_path, 90);
      if (signed.error || !signed.data?.signedUrl) throw new Error("Bill unavailable");
      window.location.assign(signed.data.signedUrl);
    } catch { setMessage("Bill could not be opened."); }
    finally { setBusy(false); }
  }
  async function attach(file: File | undefined) {
    if (!file) return;
    setMessage("");
    setBusy(true);
    try {
      const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const extension = billExtension(file.type, file.size, header);
      if (!extension) {
        setMessage("Choose a valid JPG, PNG or PDF up to 5 MB."); return;
      }
      const client = createClient();
      const path = `${expenseId}/${crypto.randomUUID()}.${extension}`;
      const uploaded = await client.storage.from("finance-expense-bills")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploaded.error) throw uploaded.error;
      const registered = await client.rpc("register_finance_expense_bill", {
        p_finance_expense_id: expenseId, p_storage_object_path: path,
      });
      if (registered.error) throw registered.error;
      setMessage("Bill attached."); router.refresh();
    } catch { setMessage("Bill upload failed. Please retry."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 text-sm">{upload ? <label className="cursor-pointer text-emerald-800">{busy ? "Uploading…" : "Attach bill (JPG, PNG or PDF, max 5 MB)"}<input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={busy} onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = ""; }} /></label> : <button type="button" disabled={busy} onClick={() => { void viewBill(); }} className="text-emerald-800 underline">{label ?? "View bill"}</button>}{message && <p role="status" className="mt-1 text-zinc-700">{message}</p>}</div>;
}
