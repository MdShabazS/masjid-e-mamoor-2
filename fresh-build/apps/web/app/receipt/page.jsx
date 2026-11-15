import Link from 'next/link';
import ReceiptLookup from './receipt-lookup.jsx';

export const dynamic = 'force-dynamic';

export default function ReceiptPage() {
  const enabled = process.env.PUBLIC_RECEIPT_LOOKUP_APPROVED === 'true';
  return (
    <main className="management">
      <Link href="/">← Home</Link>
      <h1>Verify a receipt</h1>
      <p className="muted">Enter the complete receipt code exactly as issued.</p>
      <ReceiptLookup enabled={enabled} />
    </main>
  );
}
