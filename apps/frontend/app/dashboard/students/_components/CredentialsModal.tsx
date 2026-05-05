'use client';

interface FeePayment {
  receiptNo?: string;
  amount: number;
  feeHead?: { name: string };
}

interface Credentials {
  admissionNo: string;
  rollNo?: string;
  parentCredentials: { userId: string; phone?: string; isNew: boolean; generatedPassword?: string };
  feePayments?: FeePayment[];
}

export function CredentialsModal({ credentials, onClose }: {
  credentials: Credentials | null;
  onClose: () => void;
}) {
  if (!credentials) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-ds-surface rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-ds-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <h2 className="font-semibold text-ds-text1">Admission Confirmed!</h2>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-ds-bg2 rounded-lg p-3">
              <p className="text-xs text-ds-text2 mb-0.5">Admission No</p>
              <p className="font-mono font-semibold text-ds-text1">{credentials.admissionNo}</p>
            </div>
            {credentials.rollNo && (
              <div className="bg-ds-bg2 rounded-lg p-3">
                <p className="text-xs text-ds-text2 mb-0.5">Roll No</p>
                <p className="font-mono font-semibold text-ds-text1">{credentials.rollNo}</p>
              </div>
            )}
          </div>
          {credentials.parentCredentials.isNew ? (
            <div className="bg-ds-success-bg border border-ds-success-border rounded-lg p-4">
              <p className="text-xs font-semibold text-ds-success-text mb-2 uppercase tracking-wider">Parent Portal Credentials (share with parent)</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ds-text2">Login (Phone)</span>
                  <span className="font-mono font-medium text-ds-text1">{credentials.parentCredentials.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ds-text2">Password (one-time)</span>
                  <span className="font-mono font-bold text-indigo-700 text-base tracking-widest">{credentials.parentCredentials.generatedPassword}</span>
                </div>
              </div>
              <p className="text-xs text-ds-success-text mt-2">Parent can change their password after first login.</p>
            </div>
          ) : (
            <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-3">
              <p className="text-xs text-ds-info-text">
                Existing parent account (<strong>{credentials.parentCredentials.phone}</strong>) has been linked to this student.
              </p>
            </div>
          )}
          {credentials.feePayments && credentials.feePayments.length > 0 && (
            <div className="bg-ds-bg2 rounded-lg p-3">
              <p className="text-xs font-semibold text-ds-text2 mb-2">Fee Payments Recorded</p>
              <div className="space-y-1.5">
                {credentials.feePayments.map((fp, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-ds-text2">{fp.feeHead?.name ?? 'Fee'}</span>
                    <span className="font-semibold text-ds-text1">₹{fp.amount?.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-ds-border mt-1">
                  <span>Total collected</span>
                  <span>₹{credentials.feePayments.reduce((s, fp) => s + (fp.amount || 0), 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}
          <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3">
            <p className="text-xs font-semibold text-ds-warning-text mb-1">Next Steps</p>
            <ul className="text-xs text-ds-warning-text space-y-1 list-disc list-inside">
              <li>Go to <strong>Fees → Fee Plans</strong> to set up the full fee plan for this class</li>
              {(!credentials.feePayments || credentials.feePayments.length === 0) && <li>No fee was recorded — add it from the Fees page</li>}
            </ul>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-ds-border">
          <button onClick={onClose} className="btn-brand w-full py-2.5 rounded-lg">Done</button>
        </div>
      </div>
    </div>
  );
}
