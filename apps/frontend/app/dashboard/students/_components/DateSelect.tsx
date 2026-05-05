'use client';

import { useState, useEffect } from 'react';
import { MONTHS } from './students-utils';

export function DateSelect({ value, onChange, minYear, maxYear }: {
  value: string; onChange: (v: string) => void; minYear: number; maxYear: number;
}) {
  const [d, setD] = useState('');
  const [m, setM] = useState('');
  const [y, setY] = useState('');

  useEffect(() => {
    if (!value) { setD(''); setM(''); setY(''); return; }
    const p = value.split('-');
    setD(p[2] || ''); setM(p[1] || ''); setY(p[0] || '');
  }, [value]);

  const update = (day: string, mon: string, year: string) => {
    setD(day); setM(mon); setY(year);
    if (day && mon && year) onChange(`${year}-${mon.padStart(2, '0')}-${day.padStart(2, '0')}`);
  };

  const sel = 'form-select';
  const daysInMonth = m && y ? new Date(Number(y), Number(m), 0).getDate() : 31;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  return (
    <div className="flex gap-2">
      <select className={`${sel} w-20`} value={d} onChange={(e) => update(e.target.value, m, y)}>
        <option value="">DD</option>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <option key={day} value={String(day).padStart(2, '0')}>{String(day).padStart(2, '0')}</option>
        ))}
      </select>
      <select className={`${sel} flex-1`} value={m} onChange={(e) => update(d, e.target.value, y)}>
        <option value="">Month</option>
        {MONTHS.map((name, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
      </select>
      <select className={`${sel} w-24`} value={y} onChange={(e) => update(d, m, e.target.value)}>
        <option value="">YYYY</option>
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
    </div>
  );
}
