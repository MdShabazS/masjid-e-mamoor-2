'use client';

import { useState } from 'react';

export default function ReceiptLookup({ enabled }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    setMessage('');
    try {
      const response = await fetch('/api/public/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
      if (response.status === 404) {
        setMessage('No active receipt was found for this code.');
      } else if (response.status === 429) {
        setMessage('Too many checks. Please try again later.');
      } else if (!response.ok) {
        setMessage('Receipt verification is unavailable. Please try again later.');
      } else {
        const data = await response.json();
        if (
          data.status !== 'verified' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
          !/^\d+\.\d{2}$/.test(data.amountINR)
        )
          throw new Error('invalid_receipt_response');
        setResult(data);
      }
    } catch {
      setMessage('Receipt verification is unavailable. Please try again later.');
    } finally {
      setBusy(false);
    }
  }

  if (!enabled)
    return (
      <p role="status" className="notice">
        Public receipt verification awaits masjid publication approval.
      </p>
    );

  return (
    <section className="panel">
      <form onSubmit={submit}>
        <label className="field">
          Receipt code
          <input
            required
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          Verify receipt
        </button>
      </form>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {result && (
        <div role="status" className="notice">
          <strong>Verified receipt</strong>
          <p>Date: {result.date}</p>
          <p>Amount: ₹{result.amountINR}</p>
        </div>
      )}
    </section>
  );
}
