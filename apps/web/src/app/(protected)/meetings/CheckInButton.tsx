"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CheckInButton({ meetingId }: { meetingId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function checkIn() {
    if (!navigator.geolocation) { setMessage("Location is not available in this browser."); return; }
    setBusy(true); setMessage("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        if (!Number.isFinite(coords.accuracy)) throw new Error("Location accuracy is unavailable.");
        const supabase = createClient();
        const { error } = await supabase.rpc("record_self_committee_meeting_attendance", {
          p_meeting_id: meetingId, p_latitude: coords.latitude,
          p_longitude: coords.longitude, p_accuracy_meters: coords.accuracy,
          p_operation_id: crypto.randomUUID(),
        });
        if (error) throw new Error(error.message);
        setMessage("Attendance recorded.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Check-in failed."); }
      finally { setBusy(false); }
    }, () => { setMessage("Location could not be obtained. Allow precise location and try again."); setBusy(false); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  return <div className="mt-4 border-t pt-4"><button type="button" className="button-secondary" disabled={busy} onClick={checkIn}>{busy ? "Checking location…" : "Check in with GPS"}</button>
    <p className="mt-2 text-sm text-zinc-600">Available all day on the scheduled India date, within 100 m of the masjid. Exact location is not saved.</p>
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}</div>;
}
