'use client';

import React from 'react';
import type { FeePlan, FeeStructure } from '@/lib/types';
import type { FeeLineItem } from './students-utils';

const inp = 'border border-ds-border-strong p-2 rounded w-full text-sm focus:outline-none focus:ring-2 focus:ring-ds-brand bg-ds-surface';
const lbl = 'text-xs font-medium text-ds-text2 block mb-1';

interface Props {
  open: boolean;
  onClose: () => void;
  studentName: string;
  className: string;
  parentPhone: string;
  loadingFees: boolean;
  activePlan: FeePlan | null;
  feeStructures: FeeStructure[];
  totalFeeStructure: number;
  existingParentInfo: { phone: string } | null;
  collectNow: boolean;
  onCollectNowChange: (v: boolean) => void;
  feeItems: FeeLineItem[];
  onFeeItemsChange: React.Dispatch<React.SetStateAction<FeeLineItem[]>>;
  paymentMode: string;
  onPaymentModeChange: (v: string) => void;
  feeDueDate: string;
  onFeeDueDateChange: (v: string) => void;
  confirming: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function FeeConfirmModal({
  open, onClose, studentName, className, parentPhone,
  loadingFees, activePlan, feeStructures, totalFeeStructure,
  existingParentInfo, collectNow, onCollectNowChange,
  feeItems, onFeeItemsChange, paymentMode, onPaymentModeChange,
  feeDueDate, onFeeDueDateChange, confirming, error, onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-ds-surface rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-ds-border">
          <h2 className="font-semibold text-ds-text1">Step 2 — Fee &amp; Admission Confirmation</h2>
          <p className="text-xs text-ds-text3 mt-0.5">
            Admitting: <span className="font-medium text-ds-text1">{studentName}</span>
            {className && ` → ${className}`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loadingFees ? (
            <p className="text-sm text-ds-text3">Loading fee structure...</p>
          ) : activePlan ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider">Annual Fee Structure</p>
                <span className="text-xs text-ds-brand font-medium">{activePlan.name}</span>
              </div>
              <div className="bg-ds-bg2 rounded-lg divide-y divide-ds-border text-sm">
                {activePlan.items.map((item) =>
                  item.installments.length > 0 ? (
                    item.installments.map((inst) => (
                      <div key={inst.id} className="flex justify-between px-4 py-2.5">
                        <span className="text-ds-text2">{item.feeCategory.name} <span className="text-ds-text3">— {inst.label}</span></span>
                        <span className="font-medium text-ds-text1">₹{inst.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))
                  ) : (
                    <div key={item.id} className="flex justify-between px-4 py-2.5">
                      <span className="text-ds-text2">{item.feeCategory.name}</span>
                      <span className="font-medium text-ds-text1">₹{item.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )
                )}
                <div className="flex justify-between px-4 py-2.5 font-semibold text-ds-text1">
                  <span>Total Annual Fees</span>
                  <span>₹{totalFeeStructure.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : feeStructures.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-2">Annual Fee Structure</p>
              <div className="bg-ds-bg2 rounded-lg divide-y divide-ds-border text-sm">
                {feeStructures.map((s) => (
                  <div key={s.id} className="flex justify-between px-4 py-2.5">
                    <span className="text-ds-text2">{s.feeHead.name}{s.installmentName ? ` (${s.installmentName})` : ''}</span>
                    <span className="font-medium text-ds-text1">₹{s.amount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2.5 font-semibold text-ds-text1">
                  <span>Total Annual Fees</span>
                  <span>₹{totalFeeStructure.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : !loadingFees ? (
            <div className="bg-ds-warning-bg border border-ds-warning-border rounded-lg p-3 text-xs text-ds-warning-text">
              No fee structure configured for this class. You can set it up in Fees → Fee Plans after admission.
            </div>
          ) : null}

          {existingParentInfo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5">
              <span className="text-amber-500 shrink-0 text-base leading-none mt-0.5">⚠</span>
              <div>
                <p className="text-xs font-semibold text-amber-800">Sibling Detected</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A parent account for <strong>{existingParentInfo.phone}</strong> already exists (from a previously admitted sibling).
                  Their portal account will be reused — no new account or password will be created.
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-ds-text2 uppercase tracking-wider mb-3">Payment at Admission</p>
            <div className="flex rounded-lg border border-ds-border overflow-hidden mb-4">
              <button onClick={() => onCollectNowChange(true)} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${collectNow ? 'bg-ds-brand text-white' : 'bg-ds-surface text-ds-text2 hover:bg-ds-bg2'}`}>
                Collect Fees Now
              </button>
              <button onClick={() => onCollectNowChange(false)} className={`flex-1 py-2.5 text-sm font-medium border-l border-ds-border transition-colors ${!collectNow ? 'bg-ds-brand text-white' : 'bg-ds-surface text-ds-text2 hover:bg-ds-bg2'}`}>
                No Payment Today
              </button>
            </div>

            {collectNow && (
              <div className="space-y-3">
                {feeItems.length > 0 && (
                  <div className="flex justify-between items-center">
                    <label className={lbl}>Select fees being collected</label>
                    <button type="button" onClick={() => onFeeItemsChange((prev) => prev.map((it) => ({ ...it, checked: true, amount: it.structureAmount > 0 ? String(it.structureAmount) : it.amount })))} className="text-xs text-ds-brand hover:underline font-medium">
                      Mark All as Paid
                    </button>
                  </div>
                )}
                {feeItems.length === 0 && <p className="text-xs text-ds-text3">No fee heads available. Add them in the Fees section first.</p>}
                <div className="space-y-2">
                  {feeItems.map((item, idx) => (
                    <div key={item.feePlanInstallmentId ?? item.feePlanItemId ?? item.feeHeadId ?? idx} className={`rounded-lg border transition-colors ${item.checked ? 'border-ds-brand bg-ds-bg2' : 'border-ds-border bg-ds-surface'}`}>
                      <div className="flex items-center justify-between px-4 py-3 cursor-pointer"
                        onClick={() => onFeeItemsChange((prev) => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked, amount: !it.checked && it.structureAmount ? String(it.structureAmount) : it.amount } : it))}>
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${item.checked ? 'bg-ds-brand border-ds-brand' : 'border-ds-border-strong'}`}>
                            {item.checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><polyline points="1.5,6 4.5,9 10.5,3" /></svg>}
                          </div>
                          <span className="text-sm font-medium text-ds-text1">{item.name}</span>
                        </div>
                        {item.structureAmount > 0 && <span className="text-sm text-ds-text2">₹{item.structureAmount.toLocaleString('en-IN')}</span>}
                      </div>
                      {item.checked && (
                        <div className="px-4 pb-3">
                          <input type="number" className={inp} placeholder="Amount collected (₹)" value={item.amount}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onFeeItemsChange((prev) => prev.map((it, i) => i === idx ? { ...it, amount: e.target.value } : it))} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {feeItems.some((i) => i.checked) && (
                  <div className="flex justify-between text-sm font-semibold text-ds-text1 bg-ds-bg2 px-4 py-2.5 rounded-lg">
                    <span>Collecting at admission</span>
                    <span className="text-ds-brand">₹{feeItems.filter((i) => i.checked).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {feeItems.some((i) => i.checked) && (
                  <div>
                    <label className={lbl}>Payment Mode</label>
                    <select className={inp} value={paymentMode} onChange={(e) => onPaymentModeChange(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="dd">DD (Demand Draft)</option>
                      <option value="neft">NEFT / RTGS</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {!collectNow && (
              <div className="bg-ds-bg2 rounded-lg p-4 space-y-3">
                <p className="text-sm text-ds-text2">
                  Admission will be confirmed without any payment today. Fees can be recorded later from the <strong>Fees</strong> section.
                </p>
                <div>
                  <label className={lbl}>Fee Due Date (optional)</label>
                  <input className={inp} type="date" value={feeDueDate} onChange={(e) => onFeeDueDateChange(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="bg-ds-info-bg border border-ds-info-border rounded-lg p-3">
            <p className="text-xs font-semibold text-ds-info-text mb-0.5">Parent Portal Account</p>
            {existingParentInfo ? (
              <p className="text-xs text-ds-brand">Existing account for <strong>{parentPhone}</strong> will be linked to this student (sibling reuse — no new password generated).</p>
            ) : (
              <p className="text-xs text-ds-brand">A new parent portal account will be created with <strong>{parentPhone}</strong> as the login ID. A one-time password will be shown after confirmation — share it with the parent.</p>
            )}
          </div>

          {error && <p className="text-ds-error-text text-sm">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-ds-border flex gap-3">
          <button onClick={onConfirm} disabled={confirming} className="btn-brand flex-1 py-2.5 rounded-lg">
            {confirming ? 'Confirming...' : 'Confirm Admission'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 border border-ds-border-strong rounded-lg text-sm hover:bg-ds-bg2">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
