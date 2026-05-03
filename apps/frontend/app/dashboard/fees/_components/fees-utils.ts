import type { Institution } from '@/lib/types';

export const MODES = ['cash', 'upi', 'cheque', 'neft', 'dd', 'online'] as const;

export const MODE_LABEL: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', cheque: 'Cheque',
  neft: 'NEFT', dd: 'Demand Draft', online: 'Online',
};

export const CATEGORY_TYPES = [
  'TUITION', 'TRANSPORT', 'EXAM', 'LAB', 'LIBRARY',
  'ACTIVITY', 'SPORTS', 'DEVELOPMENT', 'HOSTEL', 'CUSTOM',
];

export const STANDARD_CATEGORIES = [
  { name: 'Tuition Fee',     type: 'TUITION'     },
  { name: 'Transport Fee',   type: 'TRANSPORT'   },
  { name: 'Exam Fee',        type: 'EXAM'        },
  { name: 'Lab Fee',         type: 'LAB'         },
  { name: 'Library Fee',     type: 'LIBRARY'     },
  { name: 'Activity Fee',    type: 'ACTIVITY'    },
  { name: 'Sports Fee',      type: 'SPORTS'      },
  { name: 'Development Fee', type: 'DEVELOPMENT' },
];

export const STATUS_CHIP: Record<string, string> = {
  paid:     'bg-green-100 text-green-800',
  partial:  'bg-yellow-100 text-yellow-800',
  due:      'bg-blue-100 text-blue-800',
  overdue:  'bg-red-100 text-red-700',
  upcoming: 'bg-slate-100 text-slate-500',
};

export function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function printReceipt(params: {
  receiptNo: string; amount: number; paymentMode: string; paidOn: string;
  categoryName: string; installmentLabel?: string; remarks?: string;
  studentName: string; admissionNo: string; className: string;
  institution: Institution;
}) {
  const { receiptNo, amount, paymentMode, paidOn, categoryName, installmentLabel, remarks, studentName, admissionNo, className, institution: i } = params;
  const date = new Date(paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const subLine = [i.board, i.affiliationNo ? `Affil: ${i.affiliationNo}` : '', i.udiseCode ? `UDISE: ${i.udiseCode}` : ''].filter(Boolean).join(' · ');
  const contactLine = [i.address, i.phone ? `Ph: ${i.phone}` : '', i.email ? `Email: ${i.email}` : '', i.website ?? ''].filter(Boolean).join('  ·  ');
  const hasBankInfo = i.bankName || i.bankAccountNo;
  const html = `<!DOCTYPE html><html><head><title>Fee Receipt — ${esc(receiptNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#f1f5f9;padding:30px}
  .receipt{max-width:560px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .letterhead{background:#0f172a;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:14px}
  .letterhead img.logo{width:52px;height:52px;object-fit:contain;border-radius:4px;background:#fff;padding:3px;flex-shrink:0}
  .letterhead .logo-ph{width:52px;height:52px;border-radius:4px;background:rgba(255,255,255,.1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:rgba(255,255,255,.5);text-align:center;line-height:1.2}
  .lh-text{flex:1;min-width:0} .lh-text h1{font-size:16px;font-weight:700;margin-bottom:2px}
  .lh-text .tagline{font-size:10px;opacity:.6;font-style:italic;margin-bottom:3px}
  .lh-text .sub{font-size:10px;opacity:.55;line-height:1.6}
  .stamp{width:56px;height:56px;object-fit:contain;opacity:.75;flex-shrink:0}
  .rhead{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
  .rno{font-size:13px;font-weight:700;color:#0f172a} .rdate{font-size:12px;color:#64748b}
  .section{padding:16px 24px}
  .stitle{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9} .row:last-child{border:none}
  .label{color:#64748b;font-size:12px} .value{font-weight:600;font-size:12px;text-align:right;max-width:60%}
  .amt-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin:0 24px 20px;display:flex;justify-content:space-between;align-items:center}
  .amt-box .lbl{font-size:12px;color:#166534;font-weight:600} .amt-box .amt{font-size:26px;font-weight:800;color:#15803d}
  .bank-box{margin:0 24px 18px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:10.5px;color:#475569;line-height:1.8} .bank-box strong{color:#1e293b}
  .sig-row{display:flex;justify-content:flex-end;padding:0 24px 16px;gap:16px;align-items:flex-end}
  .sig-row img{max-height:40px;max-width:120px;object-fit:contain}
  .sig-label{font-size:10px;color:#94a3b8;text-align:center;margin-top:3px;border-top:1px solid #e2e8f0;padding-top:3px}
  .footer{text-align:center;color:#94a3b8;font-size:10px;padding:12px 20px;border-top:1px solid #f1f5f9;line-height:1.6}
  @media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border-radius:0;border:none};-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body><div class="receipt">
  <div class="letterhead">
    ${i.logoUrl ? `<img class="logo" src="${esc(i.logoUrl)}" alt="Logo" />` : `<div class="logo-ph">School<br/>Logo</div>`}
    <div class="lh-text"><h1>${esc(i.name)}</h1>${i.tagline ? `<div class="tagline">${esc(i.tagline)}</div>` : ''}<div class="sub">${subLine ? `${subLine}<br>` : ''}${contactLine}</div></div>
    ${i.stampUrl ? `<img class="stamp" src="${esc(i.stampUrl)}" alt="Stamp" />` : ''}
  </div>
  <div class="rhead"><span class="rno">Receipt No: ${esc(receiptNo)}</span><span class="rdate">${date}</span></div>
  <div class="section"><div class="stitle">Student Details</div>
    <div class="row"><span class="label">Name</span><span class="value">${esc(studentName)}</span></div>
    <div class="row"><span class="label">Admission No.</span><span class="value">${esc(admissionNo)}</span></div>
    <div class="row"><span class="label">Class</span><span class="value">${esc(className)}</span></div>
  </div>
  <div class="section"><div class="stitle">Payment Details</div>
    <div class="row"><span class="label">Fee Category</span><span class="value">${esc(categoryName)}</span></div>
    ${installmentLabel ? `<div class="row"><span class="label">Installment</span><span class="value">${esc(installmentLabel)}</span></div>` : ''}
    <div class="row"><span class="label">Payment Mode</span><span class="value">${esc(MODE_LABEL[paymentMode] ?? paymentMode)}</span></div>
    ${remarks ? `<div class="row"><span class="label">Remarks</span><span class="value">${esc(remarks)}</span></div>` : ''}
  </div>
  <div class="amt-box"><span class="lbl">Amount Paid</span><span class="amt">${fmt(amount)}</span></div>
  ${hasBankInfo ? `<div class="bank-box"><strong>Bank Transfer Details</strong> (for NEFT / Online payments)<br>${[i.bankAccountHolder ? `A/C Holder: ${esc(i.bankAccountHolder)}` : '', i.bankName ? `Bank: ${esc(i.bankName)}` : '', i.bankAccountNo ? `A/C No: ${esc(i.bankAccountNo)}` : '', i.bankIfsc ? `IFSC: ${esc(i.bankIfsc)}` : '', i.bankBranch ? `Branch: ${esc(i.bankBranch)}` : ''].filter(Boolean).join('  &nbsp;·&nbsp;  ')}</div>` : ''}
  ${i.signatureUrl ? `<div class="sig-row"><div><img src="${esc(i.signatureUrl)}" alt="Signature" /><div class="sig-label">Authorised Signatory</div></div></div>` : ''}
  <div class="footer">${i.principalName ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px">Principal: ${esc(i.principalName)}</div>` : ''}Computer-generated receipt — no manual signature required<br>${esc(i.name)}${i.gstin ? `  ·  GSTIN: ${esc(i.gstin)}` : ''}</div>
</div><script>window.onload=function(){window.print();}</script></body></html>`;
  const w = window.open('', '_blank', 'width=620,height=780');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}
