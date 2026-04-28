/**
 * Exports an array of objects to a CSV file download.
 * Pass `columns` to control which keys appear and in what order.
 */
export function exportCSV<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[],
) {
  if (rows.length === 0) return;

  const cols = columns ?? (Object.keys(rows[0]) as (keyof T)[]).map((k) => ({ key: k, header: String(k) }));
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = cols.map((c) => c.header).join(',');
  const body   = rows.map((r) => cols.map((c) => escape(r[c.key])).join(',')).join('\n');
  const csv    = `${header}\n${body}`;

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
