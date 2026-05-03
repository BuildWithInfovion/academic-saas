'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AcademicYear, AcademicUnit, Institution } from '@/lib/types';
import { CollectTab } from './_components/CollectTab';
import { PlansTab } from './_components/PlansTab';
import { ConcessionsTab } from './_components/ConcessionsTab';
import { ReportsTab } from './_components/ReportsTab';
import { CategoriesTab } from './_components/CategoriesTab';

const TABS = [
  { key: 'collect', label: 'Collect Fee' },
  { key: 'plans', label: 'Fee Plans' },
  { key: 'concessions', label: 'Concessions' },
  { key: 'reports', label: 'Reports' },
  { key: 'categories', label: 'Categories' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function FeesPage() {
  const [tab, setTab] = useState<TabKey>('collect');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [institution, setInstitution] = useState<Institution | null>(null);

  useEffect(() => {
    void Promise.all([
      apiFetch<AcademicYear[]>('/academic/years').then(setYears),
      apiFetch<AcademicUnit[]>('/academic/units/classes').then((r) => setUnits(Array.isArray(r) ? r : [])),
      apiFetch<Institution>('/institution/me').then(setInstitution),
    ]);
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
        <p className="text-slate-500 text-sm mt-1">Manage fee plans, collect payments, and track outstanding dues</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'collect' && <CollectTab years={years} institution={institution} />}
      {tab === 'plans' && <PlansTab years={years} units={units} />}
      {tab === 'concessions' && <ConcessionsTab years={years} />}
      {tab === 'reports' && <ReportsTab years={years} units={units} institution={institution} />}
      {tab === 'categories' && <CategoriesTab />}
    </div>
  );
}
