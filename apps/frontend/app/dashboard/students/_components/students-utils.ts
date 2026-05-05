export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

export const QUALIFICATIONS = [
  'Below 10th','10th / SSC','12th / HSC','ITI / Diploma','Graduate (B.A./B.Sc./B.Com)',
  'Graduate (B.E./B.Tech)','Post Graduate','Doctorate (PhD)','Other',
];

export const INCOME_BRACKETS = [
  'Below ₹1 Lakh','₹1–2 Lakh','₹2–5 Lakh','₹5–10 Lakh','Above ₹10 Lakh',
];

export const emptyForm = {
  academicUnitId: '', admissionDate: new Date().toISOString().split('T')[0],
  firstName: '', middleName: '', lastName: '',
  dateOfBirth: '', placeOfBirth: '', gender: '', motherTongue: '',
  phone: '', email: '',
  aadharNumber: '', bloodGroup: '', nationality: 'Indian',
  fatherName: '', fatherOccupation: '', fatherQualification: '', fatherEmail: '', fatherAadhar: '',
  motherName: '', motherOccupation: '', motherQualification: '', motherEmail: '', motherAadhar: '',
  parentPhone: '', secondaryPhone: '',
  annualIncome: '', isEwsCategory: false,
  emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '',
  address: '', locality: '', city: '', state: '', pinCode: '',
  tcFromPrevious: '', tcPreviousInstitution: '', previousClass: '', previousBoard: '', previousMarks: '',
  tcReceivedDate: '',
  religion: '', casteCategory: '',
  hasDisability: false, disabilityDetails: '', medicalConditions: '',
};

export type FeeLineItem = {
  feeHeadId?: string;
  feePlanItemId?: string;
  feePlanInstallmentId?: string;
  feeCategoryId?: string;
  name: string;
  structureAmount: number;
  amount: string;
  checked: boolean;
};

export interface AdmissionDraft {
  id: string;
  savedAt: string;
  label: string;
  form: typeof emptyForm;
  yearId: string;
}

export function draftKey(institutionId: string) {
  return `admission-drafts-${institutionId}`;
}

export function loadDraftsFromStorage(institutionId: string): AdmissionDraft[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(draftKey(institutionId)) ?? '[]'); }
  catch { return []; }
}

export function saveDraftsToStorage(institutionId: string, drafts: AdmissionDraft[]) {
  localStorage.setItem(draftKey(institutionId), JSON.stringify(drafts));
}
