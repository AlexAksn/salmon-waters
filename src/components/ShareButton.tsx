import { useEffect, useState } from 'react';
import type { ShareResult } from '../lib/share';

const DONE: Record<ShareResult, string> = { shared: 'Shared', copied: 'Link copied', saved: 'Image saved', cancelled: '', failed: 'Could not share' };
/** One share action; shows what happened for a few seconds, then its idle label again. */
export default function ShareButton({ id, idle, busyLabel, share, primary }: { id: string; idle: string; busyLabel?: string; share: () => Promise<ShareResult>; primary?: boolean }) {
  const [label, setLabel] = useState(idle);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (label === idle) return; const t = setTimeout(() => setLabel(idle), 3000); return () => clearTimeout(t); }, [label, idle]);
  const go = async () => { setBusy(true); try { setLabel(DONE[await share()] || idle); } finally { setBusy(false); } };
  return <button className={`btn${primary ? ' primary' : ''}`} data-share={id} onClick={go} disabled={busy} aria-live="polite">{busy && busyLabel ? busyLabel : label}</button>;
}
