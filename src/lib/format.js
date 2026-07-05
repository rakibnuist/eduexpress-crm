/* format.js — shared formatters so currency and dates look the same everywhere. */

// Currency
export function fmtCurrency(n, { compact = false, decimals = 0 } = {}) {
  const v = Number(n || 0);
  if (compact) {
    if (v >= 10_000_000) return `৳${(v / 10_000_000).toFixed(decimals || 1)}Cr`;
    if (v >= 100_000)    return `৳${(v / 100_000).toFixed(decimals || 1)}L`;
    if (v >= 1_000)      return `৳${(v / 1_000).toFixed(decimals || 1)}K`;
    return `৳${v.toLocaleString()}`;
  }
  return `৳${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

// Parse incoming ISO/server timestamps that may or may not carry Z/offset.
export function toDate(iso) {
  if (!iso) return null;
  if (iso instanceof Date) return iso;
  const s = String(iso);
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const withZone = /[Zz+]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : normalized + 'Z';
  const d = new Date(withZone);
  return isNaN(d.getTime()) ? null : d;
}

// Common date formats
export function fmtDate(iso, fmt = 'long') {
  const d = toDate(iso);
  if (!d) return '';
  const opts = {
    long:  { day: 'numeric', month: 'long',  year: 'numeric' },
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    day:   { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    iso:   null, // returns YYYY-MM-DD
    time:  { hour: '2-digit', minute: '2-digit' },
    datetime: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  }[fmt];
  if (fmt === 'iso') return d.toISOString().slice(0, 10);
  return d.toLocaleString('en-GB', opts);
}

// "3m ago" / "2h ago" / "5d ago" — falls back to a short date if older.
export function timeAgo(iso) {
  const d = toDate(iso);
  if (!d) return '';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60)     return `${Math.floor(s)}s ago`;
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso, 'short');
}

// Formats for chat list items: "02:10 PM", "Yesterday", "Friday", "26 Jun"
export function formatLastMessageTime(iso) {
  const d = toDate(iso);
  if (!d) return '';
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
  if (msgDate.getTime() === today.getTime()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (msgDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }
  
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
}

// Pluralise: pluralise(1, 'lead') → '1 lead', pluralise(3, 'lead') → '3 leads'
export function pluralise(n, word, plural) {
  return `${n} ${n === 1 ? word : (plural || word + 's')}`;
}

// Get user initials from a name (max 2 chars)
export function initials(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// Clamp number to a min/max for nicer UI
export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
