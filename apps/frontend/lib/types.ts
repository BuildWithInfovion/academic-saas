// ── Shared types used across multiple pages ───────────────────────────────────
// Import from here instead of re-declaring the same interfaces per page.

// ── Core domain ───────────────────────────────────────────────────────────────

export interface AcademicYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

export interface AcademicUnit {
  id: string;
  name: string;
  displayName?: string | null;
  level?: number;
  parentId?: string | null;
}

export interface Role {
  id: string;
  code: string;
  label: string;
}

export interface Institution {
  name: string;
  board?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  principalName?: string;
  tagline?: string;
  affiliationNo?: string;
  udiseCode?: string;
  gstin?: string;
  stampUrl?: string;
  signatureUrl?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  bankAccountHolder?: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
}

// ── Student ───────────────────────────────────────────────────────────────────

export interface Student {
  id: string;
  admissionNo: string;
  rollNo?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  motherTongue?: string;
  fatherName?: string;
  fatherOccupation?: string;
  fatherQualification?: string;
  fatherEmail?: string;
  fatherAadhar?: string;
  motherName?: string;
  motherOccupation?: string;
  motherQualification?: string;
  motherEmail?: string;
  motherAadhar?: string;
  parentPhone?: string;
  secondaryPhone?: string;
  annualIncome?: string;
  isEwsCategory?: boolean;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  address?: string;
  locality?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  casteCategory?: string;
  aadharNumber?: string;
  tcFromPrevious?: string;
  tcPreviousInstitution?: string;
  previousClass?: string;
  previousBoard?: string;
  previousMarks?: string;
  hasDisability?: boolean;
  disabilityDetails?: string;
  medicalConditions?: string;
  admissionDate?: string;
  academicUnitId?: string;
  status?: string;
  createdAt: string;
  academicUnit?: { id: string; name: string; displayName?: string };
  userAccount?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
  parentUser?: { id: string; email?: string; phone?: string; isActive: boolean } | null;
  photoUrl?: string | null;
}

export interface StudentSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  academicUnit?: { name: string; displayName?: string };
}

// ── Staff / User ───────────────────────────────────────────────────────────────

export interface StaffUser {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  roles: { role: Role }[];
}

export interface AllowanceItem {
  name: string;
  amount: number;
}

export interface SalaryProfile {
  id: string;
  basicSalary: number;
  allowances: AllowanceItem[];
  deductions: AllowanceItem[];
  effectiveFrom: string;
}

export interface SalaryRecord {
  id: string;
  month: number;
  year: number;
  basicPaid: number;
  allowancesPaid: AllowanceItem[];
  deductionsPaid: AllowanceItem[];
  netSalary: number;
  paidOn?: string;
  remarks?: string;
}

// ── Fee — legacy system ────────────────────────────────────────────────────────

export interface FeeHead {
  id: string;
  name: string;
}

export interface FeeStructure {
  id: string;
  feeHeadId: string;
  amount: number;
  installmentName?: string;
  dueDate?: string;
  feeHead: FeeHead;
}

// ── Fee — plan system (V2) ────────────────────────────────────────────────────

export interface FeeCategory {
  id: string;
  name: string;
  type: string;
}

export interface FeePlanInstallment {
  id: string;
  label: string;
  amount: number;
  dueDate?: string | null;
  sortOrder?: number;
}

export interface FeePlanItem {
  id: string;
  feeCategoryId: string;
  feeCategory: FeeCategory | { id: string; name: string };
  totalAmount: number;
  installments: FeePlanInstallment[];
}

export interface FeePlanClassMap {
  id: string;
  academicUnitId: string;
  academicUnit: AcademicUnit;
}

export interface FeePlan {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  academicYearId?: string;
  academicYear?: { id: string; name: string };
  items: FeePlanItem[];
  classMaps?: FeePlanClassMap[];
}

// ── Fee — ledger ──────────────────────────────────────────────────────────────

export interface LedgerInstallment {
  id: string;
  label: string;
  amount: number;
  dueDate?: string | null;
  concession: number;
  netAmount: number;
  paid: number;
  balance: number;
  status: 'paid' | 'partial' | 'due' | 'overdue' | 'upcoming';
  isOverdue: boolean;
}

export interface LedgerItem {
  feePlanItemId: string;
  feeCategoryId: string;
  categoryName: string;
  totalAmount: number;
  concession: number;
  netAmount: number;
  installments: LedgerInstallment[];
  totalPaid: number;
  totalBalance: number;
}

export interface Ledger {
  student: { id: string; name: string; admissionNo: string; className: string };
  plan: { id: string; name: string } | null;
  items: LedgerItem[];
  totalAnnual: number;
  totalConcession: number;
  totalNet: number;
  totalPaid: number;
  totalBalance: number;
}

// ── Fee — collection ──────────────────────────────────────────────────────────

export interface FeeCollectionEntry {
  id: string;
  receiptNo: string;
  amount: number;
  paymentMode: string;
  paidOn: string;
  categoryName: string;
  student: { firstName: string; lastName: string; admissionNo: string };
  source: string;
}

export interface Concession {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  feePlanItem: {
    id: string;
    feeCategory: { name: string };
    feePlan: { name: string };
  };
}

export interface Defaulter {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  className?: string;
  due: number;
  paid: number;
  balance: number;
}
