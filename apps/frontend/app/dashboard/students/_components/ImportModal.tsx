'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { AcademicUnit } from '@/lib/types';

type ImportRow = {
  firstName: string; lastName: string; middleName?: string; gender?: string;
  dateOfBirth?: string; className: string; oldAdmissionNo?: string;
  admissionDate?: string; fatherName?: string; motherName?: string;
  parentPhone?: string; address?: string; religion?: string;
  casteCategory?: string; bloodGroup?: string; feePaid?: string;
  _rowNum: number; _errors: string[];
};

type ImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; error: string }[];
  studentIds: string[];
  newParentCredentials: { phone: string; password: string }[];
};

export const IMPORT_BATCH_KEY = 'last_import_batch';

export type ImportBatch = {
  timestamp: number;
  count: number;
  studentIds: string[];
};

const CHUNK_SIZE = 100;

export function ImportModal({ open, academicUnits, onClose, onImportComplete }: {
  open: boolean;
  academicUnits: AcademicUnit[];
  onClose: () => void;
  onImportComplete: (batch: ImportBatch) => Promise<void>;
}) {
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0); // 0–100
  const [importProgressLabel, setImportProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setImportRows([]); setImportStep('upload'); setImportResult(null);
    setError(null); setImportProgress(0); setImportProgressLabel('');
    onClose();
  };

  const parseCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setError('CSV file is empty or has only headers'); return; }
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const COL: Record<string, string> = {
        'first name': 'firstName', 'first name*': 'firstName',
        'last name': 'lastName', 'last name*': 'lastName',
        'middle name': 'middleName',
        'gender (male/female/other)': 'gender', 'gender': 'gender',
        'date of birth (dd-mm-yyyy)': 'dateOfBirth', 'date of birth': 'dateOfBirth', 'dob': 'dateOfBirth',
        'class': 'className', 'class*': 'className',
        'old admission no': 'oldAdmissionNo',
        'admission date (dd-mm-yyyy)': 'admissionDate', 'admission date': 'admissionDate',
        'father name': 'fatherName', "father's name": 'fatherName',
        'mother name': 'motherName', "mother's name": 'motherName',
        'parent mobile': 'parentPhone', 'parent mobile*': 'parentPhone', 'phone': 'parentPhone',
        'address': 'address', 'religion': 'religion',
        'caste category': 'casteCategory', 'blood group': 'bloodGroup',
        'fee paid (₹)': 'feePaid', 'fee paid (rs)': 'feePaid', 'fee paid (rs.)': 'feePaid',
        'fees paid (rs)': 'feePaid', 'fee paid': 'feePaid', 'fees paid': 'feePaid',
      };
      const parseDMY = (s: string): string | undefined => {
        if (!s) return undefined;
        const p = s.split(/[-\/]/);
        if (p.length !== 3) return undefined;
        const [d, m, y] = p;
        if (y.length !== 4) return undefined;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      };
      const parseCell = (cells: string[], raw: string): string[] => {
        const result: string[] = [];
        let cur = ''; let inQ = false;
        for (const ch of raw) {
          if (ch === '"') inQ = !inQ;
          else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
          else cur += ch;
        }
        result.push(cur.trim());
        return result;
      };
      const parsed: ImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCell([], lines[i]);
        const raw: Record<string, string> = {};
        headers.forEach((h, idx) => { if (COL[h]) raw[COL[h]] = (cells[idx] || '').trim(); });
        const errs: string[] = [];
        if (!raw.firstName) errs.push('First name required');
        if (!raw.lastName) errs.push('Last name required');
        if (!raw.className) errs.push('Class required');
        if (raw.parentPhone && !/^[6-9]\d{9}$/.test(raw.parentPhone.replace(/\s/g, '')))
          errs.push('Invalid phone (10 digits, starts 6–9)');
        if (raw.gender && !['male', 'female', 'other'].includes(raw.gender.toLowerCase()))
          errs.push('Gender must be Male/Female/Other');
        const dob = parseDMY(raw.dateOfBirth ?? '');
        const adm = parseDMY(raw.admissionDate ?? '');
        if (raw.dateOfBirth && !dob) errs.push('DOB must be DD-MM-YYYY');
        parsed.push({
          firstName: raw.firstName ?? '', lastName: raw.lastName ?? '',
          middleName: raw.middleName, gender: raw.gender?.toLowerCase(),
          dateOfBirth: dob, className: raw.className ?? '',
          oldAdmissionNo: raw.oldAdmissionNo, admissionDate: adm,
          fatherName: raw.fatherName, motherName: raw.motherName,
          parentPhone: raw.parentPhone?.replace(/\s/g, ''),
          address: raw.address, religion: raw.religion,
          casteCategory: raw.casteCategory, bloodGroup: raw.bloodGroup,
          feePaid: raw.feePaid,
          _rowNum: i + 1, _errors: errs,
        });
      }
      setImportRows(parsed);
      setImportStep('preview');
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter((r) => r._errors.length === 0);
    if (!validRows.length) { setError('No valid rows to import'); return; }
    setImporting(true);
    setError(null);
    setImportProgress(0);
    const merged: ImportResult = { created: 0, skipped: 0, errors: [], studentIds: [], newParentCredentials: [] };
    try {
      const chunks: typeof validRows[] = [];
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) chunks.push(validRows.slice(i, i + CHUNK_SIZE));
      for (let c = 0; c < chunks.length; c++) {
        setImportProgressLabel(`Importing batch ${c + 1} of ${chunks.length}…`);
        setImportProgress(Math.round((c / chunks.length) * 100));
        const payload = chunks[c].map(({ _rowNum: _r, _errors: _e, ...rest }) => rest);
        const result = await apiFetch('/students/import', {
          method: 'POST', body: JSON.stringify({ rows: payload }),
        }) as ImportResult;
        merged.created += result.created;
        merged.skipped += result.skipped;
        merged.errors.push(...result.errors);
        merged.studentIds.push(...(result.studentIds ?? []));
        // Deduplicate credentials across chunks (same phone could appear in multiple chunks)
        for (const cred of result.newParentCredentials ?? []) {
          if (!merged.newParentCredentials.find((c) => c.phone === cred.phone)) {
            merged.newParentCredentials.push(cred);
          }
        }
      }
      setImportProgress(100);
      setImportResult(merged);
      setImportStep('result');
      const batch: ImportBatch = { timestamp: Date.now(), count: merged.created, studentIds: merged.studentIds };
      localStorage.setItem(IMPORT_BATCH_KEY, JSON.stringify(batch));
      await onImportComplete(batch);
    } catch (e: any) { setError(e.message || 'Import failed'); }
    finally { setImporting(false); setImportProgressLabel(''); }
  };

  const downloadTemplate = () => {
    const csv = [
      'First Name*,Last Name*,Middle Name,Gender (Male/Female/Other),Date of Birth (DD-MM-YYYY),Class*,Old Admission No,Admission Date (DD-MM-YYYY),Father Name,Mother Name,Parent Mobile,Address,Religion,Caste Category,Blood Group,Fee Paid (Rs)',
      'Ramesh,Sharma,Kumar,Male,15-06-2015,Class 5,OLD-001,01-06-2023,Rajesh Sharma,Sunita Sharma,9876543210,123 MG Road Mumbai,Hindu,General,A+,5000',
      'Priya,Verma,,Female,20-08-2014,Class 6,,01-06-2022,Suresh Verma,Kavita Verma,9123456789,,,,, ',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'student-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCredentials = () => {
    if (!importResult?.newParentCredentials.length) return;
    const rows = ['Phone,Temporary Password', ...importResult.newParentCredentials.map((c) => `${c.phone},${c.password}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'parent-credentials.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  const validCount = importRows.filter((r) => r._errors.length === 0).length;
  const errorCount = importRows.filter((r) => r._errors.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-ds-surface rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-ds-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-ds-text1">Import Students from Ledger</h2>
            <p className="text-xs text-ds-text3 mt-0.5">Migrate existing students from your register / Excel / ledger book</p>
          </div>
          <button onClick={handleClose} className="text-ds-text3 hover:text-ds-text1 text-2xl font-light leading-none">×</button>
        </div>

        {/* Steps */}
        <div className="px-6 pt-5 shrink-0">
          <div className="flex items-center gap-2 mb-5 text-xs font-medium">
            {(['upload', 'preview', 'result'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${importStep === s ? 'bg-ds-brand text-white'
                  : (importStep === 'result' || (importStep === 'preview' && s === 'upload'))
                    ? 'bg-green-500 text-white' : 'bg-ds-bg2 text-ds-text3'}`}>{i + 1}</div>
                <span className={importStep === s ? 'text-ds-brand' : 'text-ds-text3'}>
                  {s === 'upload' ? 'Upload CSV' : s === 'preview' ? 'Review & Confirm' : 'Done'}
                </span>
                {i < 2 && <div className="w-8 h-px bg-ds-border" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">

          {/* ── Step 1: Upload ── */}
          {importStep === 'upload' && (
            <div className="space-y-5">
              <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-4">
                <p className="text-sm font-medium text-ds-info-text mb-2">How it works</p>
                <ol className="text-xs text-ds-info-text space-y-1 list-decimal list-inside">
                  <li>Download the CSV template and fill in your students&apos; data</li>
                  <li>Class names must match your configured classes (see list below) — numbers like <strong>7</strong> or names like <strong>Class 7</strong> both work</li>
                  <li>A parent portal account is auto-created for each unique mobile number</li>
                  <li>Upload the CSV — you can review before anything is saved</li>
                </ol>
              </div>
              {academicUnits.length > 0 && (
                <div className="bg-ds-bg2 border border-ds-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-ds-text2 mb-2">Available classes (use these names in the CSV)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {academicUnits.map((u) => (
                      <span key={u.id} className="px-2 py-0.5 bg-ds-surface border border-ds-border rounded text-xs font-mono text-ds-text1">
                        {u.displayName || u.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {academicUnits.length === 0 && (
                <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 text-sm text-ds-warning-text">
                  No classes configured yet. <a href="/dashboard/classes" className="underline font-medium">Set up classes first.</a>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2.5 border border-ds-border rounded-lg text-sm font-medium text-ds-text1 hover:bg-ds-bg2 transition-colors">
                  <svg className="w-4 h-4 text-ds-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Download CSV Template
                </button>
              </div>
              <div>
                <p className="text-xs font-medium text-ds-text2 mb-2">Upload filled CSV</p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-ds-border rounded-xl p-10 cursor-pointer hover:border-ds-brand hover:bg-ds-bg2 transition-colors">
                  <svg className="w-10 h-10 text-ds-text3 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <p className="text-sm font-medium text-ds-text1 mb-1">Click to upload or drag &amp; drop</p>
                  <p className="text-xs text-ds-text3">CSV files only</p>
                  <input type="file" accept=".csv,text/csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCSVFile(f); e.target.value = ''; }} />
                </label>
              </div>
              {error && <p className="text-ds-error-text text-sm">{error}</p>}
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {importStep === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ds-text1">{importRows.length} students parsed from file</p>
                  <p className="text-xs text-ds-text3 mt-0.5">
                    <span className="text-green-600 font-medium">{validCount} ready to import</span>
                    {errorCount > 0 && (
                      <span className="text-ds-error-text font-medium ml-3">{errorCount} have errors — will be skipped</span>
                    )}
                  </p>
                </div>
                <button onClick={() => { setImportStep('upload'); setImportRows([]); setError(null); }}
                  className="text-xs text-ds-text2 hover:text-ds-text1 underline">← Change file</button>
              </div>

              {/* Progress bar (shown while importing) */}
              {importing && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-ds-text2">
                    <span>{importProgressLabel}</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-ds-bg2 rounded-full overflow-hidden">
                    <div className="h-full bg-ds-brand rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-ds-border">
                <table className="w-full text-xs">
                  <thead className="bg-ds-bg2 border-b border-ds-border">
                    <tr>{['#', 'Name', 'Class', 'Gender', 'DOB', 'Phone', 'Fee Paid', 'Status'].map(h =>
                      <th key={h} className="px-3 py-2.5 text-left font-medium text-ds-text2 whitespace-nowrap">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border">
                    {importRows.map((row) => (
                      <tr key={row._rowNum} className={row._errors.length > 0 ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-ds-text3">{row._rowNum}</td>
                        <td className="px-3 py-2 font-medium text-ds-text1 whitespace-nowrap">{row.firstName} {row.lastName}</td>
                        <td className="px-3 py-2 text-ds-text2 whitespace-nowrap">{row.className}</td>
                        <td className="px-3 py-2 text-ds-text2 capitalize">{row.gender || '—'}</td>
                        <td className="px-3 py-2 text-ds-text2 whitespace-nowrap">{row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="px-3 py-2 text-ds-text2 whitespace-nowrap">{row.parentPhone || '—'}</td>
                        <td className="px-3 py-2 text-ds-text2 whitespace-nowrap">{row.feePaid ? `₹${row.feePaid}` : '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row._errors.length === 0 ? (
                            <span className="text-green-600 font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              Ready
                            </span>
                          ) : (
                            <span className="text-ds-error-text" title={row._errors.join(' · ')}>
                              ⚠ {row._errors[0]}{row._errors.length > 1 ? ` +${row._errors.length - 1}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <p className="text-ds-error-text text-sm">{error}</p>}
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {importStep === 'result' && importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <p className="text-3xl font-bold text-green-700">{importResult.created}</p>
                  <p className="text-xs text-green-600 mt-1 font-medium">Students Created</p>
                </div>
                <div className="bg-ds-warning-bg border border-ds-warning-border rounded-xl p-5">
                  <p className="text-3xl font-bold text-ds-warning-text">{importResult.skipped}</p>
                  <p className="text-xs text-ds-warning-text mt-1 font-medium">Skipped / Errors</p>
                </div>
                <div className="bg-ds-bg2 border border-ds-border rounded-xl p-5">
                  <p className="text-3xl font-bold text-ds-text1">{importResult.created + importResult.skipped}</p>
                  <p className="text-xs text-ds-text3 mt-1 font-medium">Total Rows</p>
                </div>
              </div>

              {/* Parent credentials */}
              {importResult.newParentCredentials.length > 0 && (
                <div className="bg-ds-success-bg border border-ds-success-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-ds-success-text">
                        {importResult.newParentCredentials.length} Parent Portal Accounts Created
                      </p>
                      <p className="text-xs text-ds-success-text mt-0.5">
                        Share these temporary passwords with parents — they can change them after first login.
                      </p>
                    </div>
                    <button onClick={downloadCredentials}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-medium hover:bg-green-800 shrink-0 ml-4">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      Download CSV
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-ds-success-border bg-white/50">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-ds-success-border">
                        <th className="px-3 py-2 text-left font-medium text-ds-success-text">Phone</th>
                        <th className="px-3 py-2 text-left font-medium text-ds-success-text">Temporary Password</th>
                      </tr></thead>
                      <tbody className="divide-y divide-ds-success-border">
                        {importResult.newParentCredentials.map((c) => (
                          <tr key={c.phone}>
                            <td className="px-3 py-2 font-mono text-ds-text1">{c.phone}</td>
                            <td className="px-3 py-2 font-mono font-bold text-indigo-700 tracking-wider">{c.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Students without parent accounts */}
              {(() => {
                const noPhone = importRows.filter(r => r._errors.length === 0 && !r.parentPhone).length;
                return noPhone > 0 ? (
                  <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3">
                    <p className="text-xs font-semibold text-ds-warning-text mb-1">{noPhone} students have no parent mobile</p>
                    <p className="text-xs text-ds-warning-text">
                      Open each student&apos;s profile → <strong>Parent Portal → Link manually</strong> to set up their parent account later.
                    </p>
                  </div>
                ) : null;
              })()}

              {/* Row errors */}
              {importResult.errors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-2">Rows not imported</p>
                  <div className="bg-ds-error-bg border border-ds-error-border rounded-lg divide-y divide-ds-error-border max-h-40 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <div key={i} className="px-3 py-2 text-xs text-ds-error-text flex gap-3">
                        <span className="font-semibold shrink-0">Row {e.row}</span>
                        <span>{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-3 text-xs text-ds-info-text">
                Student list refreshed. Go to <strong>Fees → Fee Plans</strong> to assign fee structures to these classes.
                You can <strong>undo this import</strong> using the button on the Students page if needed.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-ds-border flex gap-3 shrink-0">
          {importStep === 'preview' && (
            <>
              <button onClick={() => void handleConfirmImport()}
                disabled={importing || validCount === 0}
                className="btn-brand flex-1 py-2.5 rounded-lg disabled:opacity-50 relative overflow-hidden">
                {importing ? (importProgressLabel || 'Importing…') : `Import ${validCount} Students`}
                {importing && importProgress > 0 && importProgress < 100 && (
                  <span className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-300" style={{ width: `${importProgress}%` }} />
                )}
              </button>
              <button onClick={handleClose} className="px-5 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
            </>
          )}
          {importStep === 'result' && (
            <button onClick={handleClose} className="btn-brand flex-1 py-2.5 rounded-lg">Done</button>
          )}
          {importStep === 'upload' && (
            <button onClick={handleClose} className="px-5 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
