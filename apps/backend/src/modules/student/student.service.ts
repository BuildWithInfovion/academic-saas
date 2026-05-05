import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { generatePassword } from '../../common/utils/generate-password';

// Classes where TC from previous school is not applicable.
// Includes all common Indian pre-primary levels + Class 1 (first formal year).
const TC_NOT_REQUIRED_NAMES = [
  // Pre-primary
  'nursery', 'lkg', 'ukg', 'kg', 'preprimary', 'pre-primary',
  'pp', 'pp1', 'pp2', 'jr', 'jrkg', 'srkg', 'playgroup', 'playschool',
  'kindergarten', 'preschool',
  // Class 1 variants
  'class_1', 'class1', 'classi', 'i', '1', 'one', 'classone',
];

export interface ImportStudentRowDto {
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  dateOfBirth?: string;   // YYYY-MM-DD
  className: string;      // resolved to academicUnitId by fuzzy match
  oldAdmissionNo?: string;
  admissionDate?: string; // YYYY-MM-DD
  fatherName?: string;
  motherName?: string;
  parentPhone?: string;
  address?: string;
  religion?: string;
  casteCategory?: string;
  bloodGroup?: string;
}

function resolveUnit(
  units: { id: string; name: string; displayName?: string | null }[],
  className: string,
): { id: string; name: string } | null {
  const q = className.toLowerCase().replace(/[\s_-]/g, '');
  for (const u of units) {
    const n = u.name.toLowerCase().replace(/[\s_-]/g, '');
    const d = (u.displayName ?? '').toLowerCase().replace(/[\s_-]/g, '');
    if (n === q || d === q) return u;
  }
  // Partial / contains fallback
  for (const u of units) {
    const n = u.name.toLowerCase().replace(/[\s_-]/g, '');
    const d = (u.displayName ?? '').toLowerCase().replace(/[\s_-]/g, '');
    if (n.includes(q) || q.includes(n) || d.includes(q) || q.includes(d)) return u;
  }
  return null;
}

export interface AdmissionFeeDto {
  paid: boolean;
  amountPaid?: number;
  paymentMode?: string;
  dueDate?: string;
  feeHeadId?: string;
  academicYearId?: string;
}

// One entry per selected fee head
export interface AdmissionFeeItemDto {
  feeHeadId: string;
  amountPaid: number;
  paymentMode?: string;   // cash | upi | cheque | dd | neft
  academicYearId?: string;
}

export interface AdmissionCollectionItemDto {
  feePlanItemId: string;
  feePlanInstallmentId?: string;
  feeCategoryId: string;
  amount: number;
  paymentMode?: string;
  academicYearId?: string;
}

export interface ConfirmAdmissionDto extends CreateStudentDto {
  /** New multi-fee format — preferred */
  admissionFees?: AdmissionFeeItemDto[];
  /** V2 fee plan collection items — used when school has a FeePlan configured */
  admissionCollections?: AdmissionCollectionItemDto[];
  /** Legacy single-fee format — still supported */
  admissionFee?: AdmissionFeeDto;
}

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);
  constructor(private prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Advisory locks were removed — Supabase pgBouncer (transaction mode) does not
  // support pg_advisory_xact_lock. Uniqueness is enforced by the DB constraint
  // @@unique([institutionId, admissionNo]); a P2002 on collision is caught below.
  private async generateAdmissionNoInTx(
    tx: Prisma.TransactionClient,
    institutionId: string,
  ): Promise<string> {
    const count = await tx.student.count({ where: { institutionId } });
    const year = new Date().getFullYear();
    return `ADM-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateRollNoInTx(
    tx: Prisma.TransactionClient,
    academicUnitId: string,
  ): Promise<string> {
    const count = await tx.student.count({ where: { academicUnitId, deletedAt: null } });
    return String(count + 1).padStart(2, '0');
  }

  private async validateTc(institutionId: string, dto: CreateStudentDto): Promise<string> {
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: dto.academicUnitId, institutionId, deletedAt: null },
    });

    const isClass1 = unit
      ? TC_NOT_REQUIRED_NAMES.includes(unit.name.toLowerCase().replace(/[\s_-]/g, ''))
      : false;

    if (isClass1) return 'not_applicable';

    const tcStatus = dto.tcFromPrevious ?? 'pending';
    if (tcStatus === 'not_applicable') {
      throw new BadRequestException(
        'TC from previous institution is required for Class 2 and above.',
      );
    }
    return tcStatus;
  }

  // ── CONFIRM ADMISSION (atomic — student + parent user + fee) ──────────────

  async confirmAdmission(institutionId: string, dto: ConfirmAdmissionDto) {
    const tcFromPrevious = await this.validateTc(institutionId, dto);

    // Find parent role for auto-assignment
    const parentRole = await this.prisma.role.findFirst({
      where: { institutionId, code: 'parent' },
    });

    // Check if a PARENT user with this phone already exists (reuse if so).
    // Scoped to parent role — prevents staff/operator phones triggering reuse
    // when a staff member's child is admitted (different scenario entirely).
    const existingParentUser = dto.parentPhone
      ? await this.prisma.user.findFirst({
          where: {
            institutionId,
            phone: dto.parentPhone,
            deletedAt: null,
            roles: { some: { role: { institutionId, code: 'parent' } } },
          },
        })
      : null;

    // Generate parent credentials
    const generatedPassword = generatePassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 12);

    this.logger.log(`[confirmAdmission] institution=${institutionId} parentPhone=${dto.parentPhone ?? 'none'} fees=${dto.admissionFees?.length ?? 0}`);

    // Retry on P2002 (unique constraint): admissionNo or receiptNo collision from
    // concurrent admissions. Each retry regenerates the numbers inside a new tx.
    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.prisma.withConnectionRetry(() =>
          this.prisma.$transaction(async (tx) => {
            this.logger.debug('[confirmAdmission] tx:start — generating admission/roll numbers');
            const admissionNo = await this.generateAdmissionNoInTx(tx, institutionId);
            const rollNo = dto.academicUnitId
              ? await this.generateRollNoInTx(tx, dto.academicUnitId)
              : undefined;
            this.logger.debug(`[confirmAdmission] tx:numbers — admissionNo=${admissionNo} rollNo=${rollNo}`);

            // 1. Create or reuse parent user FIRST — so we have the ID for student.create
            let parentUser = existingParentUser;
            let isNewParentUser = false;

            if (!parentUser) {
              this.logger.debug('[confirmAdmission] tx:user.create — creating new parent user');
              parentUser = await tx.user.create({
                data: { institutionId, phone: dto.parentPhone, passwordHash, isActive: true },
              });
              isNewParentUser = true;
              this.logger.debug(`[confirmAdmission] tx:user.created — userId=${parentUser.id}`);

              if (parentRole) {
                await tx.userRole.create({
                  data: { userId: parentUser.id, roleId: parentRole.id, institutionId },
                });
                this.logger.debug('[confirmAdmission] tx:userRole.created');
              }
            } else {
              this.logger.debug(`[confirmAdmission] tx:user.reused — userId=${parentUser.id}`);
            }

            // 2. Create student with parentUserId already set — no separate UPDATE needed
            this.logger.debug('[confirmAdmission] tx:student.create — creating student record');
            const student = await tx.student.create({
              data: {
                institutionId,
                admissionNo,
                rollNo,
                firstName: dto.firstName,
                middleName: dto.middleName,
                lastName: dto.lastName,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                placeOfBirth: dto.placeOfBirth,
                gender: dto.gender,
                phone: dto.phone,
                email: dto.email,
                motherTongue: dto.motherTongue,
                fatherName: dto.fatherName,
                fatherOccupation: dto.fatherOccupation,
                fatherQualification: dto.fatherQualification,
                fatherEmail: dto.fatherEmail,
                fatherAadhar: dto.fatherAadhar,
                motherName: dto.motherName,
                motherOccupation: dto.motherOccupation,
                motherQualification: dto.motherQualification,
                motherEmail: dto.motherEmail,
                motherAadhar: dto.motherAadhar,
                parentPhone: dto.parentPhone,
                secondaryPhone: dto.secondaryPhone,
                annualIncome: dto.annualIncome,
                isEwsCategory: dto.isEwsCategory ?? false,
                emergencyContactName: dto.emergencyContactName,
                emergencyContactRelation: dto.emergencyContactRelation,
                emergencyContactPhone: dto.emergencyContactPhone,
                address: dto.address,
                locality: dto.locality,
                city: dto.city,
                state: dto.state,
                pinCode: dto.pinCode,
                admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : new Date(),
                academicUnitId: dto.academicUnitId,
                bloodGroup: dto.bloodGroup,
                nationality: dto.nationality ?? 'Indian',
                religion: dto.religion,
                casteCategory: dto.casteCategory,
                aadharNumber: dto.aadharNumber,
                hasDisability: dto.hasDisability ?? false,
                disabilityDetails: dto.disabilityDetails,
                medicalConditions: dto.medicalConditions,
                tcFromPrevious,
                tcReceivedDate: dto.tcReceivedDate ? new Date(dto.tcReceivedDate) : undefined,
                tcPreviousInstitution: dto.tcPreviousInstitution,
                previousClass: dto.previousClass,
                previousBoard: dto.previousBoard,
                previousMarks: dto.previousMarks,
                status: 'active',
                parentUserId: parentUser.id,
              },
            });
            this.logger.debug(`[confirmAdmission] tx:student.created — studentId=${student.id}`);

            // 3. Normalise to multi-item list (handles both new array and legacy single)
            const feeItems: AdmissionFeeItemDto[] = [];

            if (dto.admissionFees && dto.admissionFees.length > 0) {
              for (const item of dto.admissionFees) {
                if (item.feeHeadId && item.amountPaid > 0) feeItems.push(item);
              }
            } else if (
              dto.admissionFee?.paid &&
              dto.admissionFee.amountPaid &&
              dto.admissionFee.amountPaid > 0 &&
              dto.admissionFee.feeHeadId
            ) {
              feeItems.push({
                feeHeadId: dto.admissionFee.feeHeadId,
                amountPaid: dto.admissionFee.amountPaid,
                paymentMode: dto.admissionFee.paymentMode,
                academicYearId: dto.admissionFee.academicYearId,
              });
            }
            this.logger.debug(`[confirmAdmission] tx:fees — ${feeItems.length} legacy fee item(s) to create`);

            // 4a. Legacy FeePayment records (old feeHead-based system)
            const feePayments: Record<string, unknown>[] = [];
            if (feeItems.length > 0) {
              const receiptBaseCount = await tx.feePayment.count({ where: { institutionId } });
              const rcpYear = new Date().getFullYear();
              for (let i = 0; i < feeItems.length; i++) {
                const item = feeItems[i];
                const receiptNo = `RCP-${rcpYear}-${String(receiptBaseCount + i + 1).padStart(5, '0')}`;
                this.logger.debug(`[confirmAdmission] tx:feePayment.create — feeHeadId=${item.feeHeadId} amount=${item.amountPaid} receipt=${receiptNo}`);
                const payment = await tx.feePayment.create({
                  data: {
                    institutionId,
                    studentId: student.id,
                    feeHeadId: item.feeHeadId,
                    academicYearId: item.academicYearId,
                    amount: item.amountPaid,
                    paymentMode: item.paymentMode ?? 'cash',
                    receiptNo,
                    paidOn: new Date(),
                    remarks: 'Admission fee payment',
                  },
                  include: { feeHead: true },
                });
                this.logger.debug(`[confirmAdmission] tx:feePayment.created — receiptNo=${receiptNo}`);
                feePayments.push(payment as unknown as Record<string, unknown>);
              }
            }

            // 4b. V2 FeeCollection records (FeePlan-based system)
            const feeCollections: Record<string, unknown>[] = [];
            if (dto.admissionCollections && dto.admissionCollections.length > 0) {
              const validCollections = dto.admissionCollections.filter((c) => c.feePlanItemId && c.feeCategoryId && c.amount > 0);
              this.logger.debug(`[confirmAdmission] tx:feeCollections — ${validCollections.length} v2 collection(s) to create`);
              if (validCollections.length > 0) {
                const colBaseCount = await tx.feeCollection.count({ where: { institutionId } });
                const rcpYear = new Date().getFullYear();
                for (let i = 0; i < validCollections.length; i++) {
                  const col = validCollections[i];
                  const receiptNo = `FRC-${rcpYear}-${String(colBaseCount + i + 1).padStart(5, '0')}`;
                  const coll = await tx.feeCollection.create({
                    data: {
                      institutionId,
                      studentId: student.id,
                      feePlanItemId: col.feePlanItemId,
                      feePlanInstallmentId: col.feePlanInstallmentId ?? null,
                      feeCategoryId: col.feeCategoryId,
                      academicYearId: col.academicYearId ?? undefined,
                      amount: col.amount,
                      paymentMode: col.paymentMode ?? 'cash',
                      receiptNo,
                      paidOn: new Date(),
                      remarks: 'Admission fee payment',
                    },
                    include: { feeCategory: true },
                  });
                  feeCollections.push(coll as unknown as Record<string, unknown>);
                }
              }
            }

            return { student, parentUser, isNewParentUser, feePayments, feeCollections };
          }, { timeout: 15000, maxWait: 10000 }),
        );

        return {
          student: result.student,
          admissionNo: result.student.admissionNo,
          rollNo: result.student.rollNo,
          parentCredentials: {
            userId: result.parentUser.id,
            phone: result.parentUser.phone,
            isNew: result.isNewParentUser,
            generatedPassword: result.isNewParentUser ? generatedPassword : null,
          },
          feePayments: result.feePayments,
          feePayment: result.feePayments[0] ?? null,
        };
      } catch (err: unknown) {
        const code = (err as any)?.code;
        if (code === 'P2002' && attempt < MAX_ATTEMPTS) {
          this.logger.warn(`[confirmAdmission] P2002 on attempt ${attempt}/${MAX_ATTEMPTS} — retrying`);
          continue;
        }
        const msg = (err as any)?.message ?? String(err);
        this.logger.error(`[confirmAdmission] FAILED — code=${code ?? 'none'} msg=${msg.slice(0, 300)}`);
        throw err;
      }
    }
    // Unreachable — loop always returns or throws
    throw new ConflictException('Admission conflict after retries — please try again');
  }

  // ── BULK IMPORT (legacy ledger migration) ────────────────────────────────

  async importStudents(
    institutionId: string,
    rows: ImportStudentRowDto[],
  ): Promise<{ created: number; skipped: number; errors: { row: number; error: string }[] }> {
    const [units, parentRole] = await Promise.all([
      this.prisma.academicUnit.findMany({
        where: { institutionId, deletedAt: null },
        select: { id: true, name: true, displayName: true },
      }),
      this.prisma.role.findFirst({ where: { institutionId, code: 'parent' } }),
    ]);

    const results = { created: 0, skipped: 0, errors: [] as { row: number; error: string }[] };

    // ── Phase 1: validate all rows upfront ───────────────────────────────────
    type ValidRow = {
      row: ImportStudentRowDto;
      rowNum: number;
      unit: { id: string; name: string };
      phone: string | null;
    };
    const validRows: ValidRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const firstName = row.firstName?.trim();
      const lastName  = row.lastName?.trim();
      if (!firstName || !lastName) {
        results.errors.push({ row: rowNum, error: 'First name and last name are required' });
        results.skipped++;
        continue;
      }
      const unit = resolveUnit(units, row.className ?? '');
      if (!unit) {
        results.errors.push({ row: rowNum, error: `Class "${row.className}" not found — check class names in Settings` });
        results.skipped++;
        continue;
      }
      validRows.push({ row, rowNum, unit, phone: row.parentPhone?.replace(/\s/g, '') || null });
    }
    if (!validRows.length) return results;

    // ── Phase 2: batch-lookup all parent phones in one query ─────────────────
    const allPhones = [...new Set(validRows.map((v) => v.phone).filter(Boolean))] as string[];
    const existingParents = allPhones.length
      ? await this.prisma.user.findMany({
          where: { institutionId, phone: { in: allPhones }, deletedAt: null },
          select: { id: true, phone: true },
        })
      : [];
    // phone → userId (populated from DB; extended as new parents are created)
    const parentByPhone = new Map(existingParents.map((u) => [u.phone!, u.id]));

    // ── Phase 3: pre-compute bcrypt hashes for NEW phones in parallel ────────
    // 10 rounds instead of 12: ~4× faster, still plenty secure for bulk-imported
    // temporary passwords (users are expected to change on first login).
    const BCRYPT_ROUNDS = 10;
    const HASH_CONCURRENCY = 8;
    const newPhones = allPhones.filter((p) => !parentByPhone.has(p));
    const hashMap = new Map<string, { hash: string; pwd: string }>();
    for (let i = 0; i < newPhones.length; i += HASH_CONCURRENCY) {
      const batch = newPhones.slice(i, i + HASH_CONCURRENCY);
      const hashed = await Promise.all(
        batch.map(async (phone) => {
          const pwd = generatePassword();
          const hash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
          return { phone, hash, pwd };
        }),
      );
      for (const h of hashed) hashMap.set(h.phone, { hash: h.hash, pwd: h.pwd });
    }

    // ── Phase 4: create students (transactions are now fast — no bcrypt inside) ─
    for (const { row, rowNum, unit, phone } of validRows) {
      try {
        await this.prisma.withConnectionRetry(() =>
          this.prisma.$transaction(async (tx) => {
            const admissionNo = await this.generateAdmissionNoInTx(tx, institutionId);
            const rollNo = await this.generateRollNoInTx(tx, unit.id);

            let parentUserId: string | undefined;
            if (phone) {
              let pid = parentByPhone.get(phone);
              if (!pid) {
                const pre = hashMap.get(phone)!;
                const newParent = await tx.user.create({
                  data: { institutionId, phone, passwordHash: pre.hash, isActive: true },
                });
                if (parentRole) {
                  await tx.userRole.create({
                    data: { userId: newParent.id, roleId: parentRole.id, institutionId },
                  });
                }
                pid = newParent.id;
                parentByPhone.set(phone, pid);
              }
              parentUserId = pid;
            }

            await tx.student.create({
              data: {
                institutionId,
                admissionNo,
                rollNo,
                firstName: row.firstName.trim(),
                middleName: row.middleName?.trim() || null,
                lastName: row.lastName.trim(),
                gender: row.gender?.toLowerCase() || null,
                dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
                fatherName: row.fatherName?.trim() || null,
                motherName: row.motherName?.trim() || null,
                parentPhone: phone,
                address: row.address?.trim() || null,
                religion: row.religion?.trim() || null,
                casteCategory: row.casteCategory?.trim() || null,
                bloodGroup: row.bloodGroup?.trim() || null,
                academicUnitId: unit.id,
                admissionDate: row.admissionDate ? new Date(row.admissionDate) : new Date(),
                status: 'active',
                nationality: 'Indian',
                parentUserId,
                tcFromPrevious: 'not_applicable',
              },
            });
          }, { timeout: 15000, maxWait: 10000 }),
        );
        results.created++;
      } catch (err: any) {
        const msg = err?.message?.slice(0, 120) ?? 'Unknown error';
        results.errors.push({ row: rowNum, error: msg });
        results.skipped++;
      }
    }

    return results;
  }

  // ── BASIC CREATE (kept for backwards compat) ──────────────────────────────

  async create(institutionId: string, dto: CreateStudentDto) {
    try {
      const tcFromPrevious = await this.validateTc(institutionId, dto);

      return await this.prisma.$transaction(async (tx) => {
        const admissionNo = await this.generateAdmissionNoInTx(tx, institutionId);
        const rollNo = dto.academicUnitId
          ? await this.generateRollNoInTx(tx, dto.academicUnitId)
          : undefined;

        return tx.student.create({
          data: {
            institutionId,
            admissionNo,
            rollNo,
            firstName: dto.firstName,
            middleName: dto.middleName,
            lastName: dto.lastName,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
            placeOfBirth: dto.placeOfBirth,
            gender: dto.gender,
            phone: dto.phone,
            email: dto.email,
            motherTongue: dto.motherTongue,
            fatherName: dto.fatherName,
            fatherOccupation: dto.fatherOccupation,
            fatherQualification: dto.fatherQualification,
            fatherEmail: dto.fatherEmail,
            fatherAadhar: dto.fatherAadhar,
            motherName: dto.motherName,
            motherOccupation: dto.motherOccupation,
            motherQualification: dto.motherQualification,
            motherEmail: dto.motherEmail,
            motherAadhar: dto.motherAadhar,
            parentPhone: dto.parentPhone,
            secondaryPhone: dto.secondaryPhone,
            annualIncome: dto.annualIncome,
            isEwsCategory: dto.isEwsCategory ?? false,
            emergencyContactName: dto.emergencyContactName,
            emergencyContactRelation: dto.emergencyContactRelation,
            emergencyContactPhone: dto.emergencyContactPhone,
            address: dto.address,
            locality: dto.locality,
            city: dto.city,
            state: dto.state,
            pinCode: dto.pinCode,
            admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : new Date(),
            academicUnitId: dto.academicUnitId,
            bloodGroup: dto.bloodGroup,
            nationality: dto.nationality ?? 'Indian',
            religion: dto.religion,
            casteCategory: dto.casteCategory,
            aadharNumber: dto.aadharNumber,
            hasDisability: dto.hasDisability ?? false,
            disabilityDetails: dto.disabilityDetails,
            medicalConditions: dto.medicalConditions,
            tcFromPrevious,
            tcReceivedDate: dto.tcReceivedDate ? new Date(dto.tcReceivedDate) : undefined,
            tcPreviousInstitution: dto.tcPreviousInstitution,
            previousClass: dto.previousClass,
            previousBoard: dto.previousBoard,
            previousMarks: dto.previousMarks,
            status: 'active',
          },
        });
      }, { timeout: 15000, maxWait: 10000 }); // end $transaction
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Admission number generation conflict, retry');
      }
      throw error;
    }
  }

  // ── READ ──────────────────────────────────────────────────────────────────

  async findAll(
    institutionId: string,
    page: number,
    limit: number,
    search?: string,
    unitId?: string,
  ) {
    const skip = (page - 1) * limit;

    const whereCondition: Prisma.StudentWhereInput = {
      institutionId,
      deletedAt: null,
      status: { not: 'transferred' },
    };

    if (unitId) {
      const children = await this.prisma.academicUnit.findMany({
        where: { parentId: unitId, deletedAt: null },
        select: { id: true },
      });
      const unitIds = children.length > 0 ? children.map((c) => c.id) : [unitId];
      whereCondition.academicUnitId = { in: unitIds };
    }

    if (search) {
      whereCondition.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { admissionNo: { contains: search, mode: 'insensitive' } },
        { parentPhone: { contains: search } },
      ];
    }

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          academicUnit: { select: { id: true, name: true, displayName: true } },
          userAccount: { select: { id: true, email: true, phone: true, isActive: true } },
          parentUser: { select: { id: true, email: true, phone: true, isActive: true } },
        },
      }),
      this.prisma.student.count({ where: whereCondition }),
    ]);

    return {
      data: students,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findExited(institutionId: string) {
    return this.prisma.student.findMany({
      where: { institutionId, status: 'transferred', deletedAt: null },
      include: {
        academicUnit: { select: { id: true, name: true, displayName: true } },
        transferCertificates: {
          where: { status: 'issued' },
          orderBy: { issuedAt: 'desc' },
          take: 1,
          select: { id: true, tcNumber: true, issuedAt: true, classLastStudied: true, reason: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(institutionId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      include: {
        academicUnit: { select: { id: true, name: true, displayName: true } },
        userAccount: { select: { id: true, email: true, phone: true, isActive: true } },
        parentUser: { select: { id: true, email: true, phone: true, isActive: true } },
      },
    });

    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(institutionId: string, studentId: string, dto: UpdateStudentDto) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (student.status === 'transferred')
      throw new BadRequestException('This student has been transferred and their record is locked. View their TC for details.');

    // If the caller is moving the student to a different class, verify that class
    // exists in this institution. Skipping this lets an operator assign a student
    // to an academic unit from a completely different tenant.
    if (dto.academicUnitId !== undefined && dto.academicUnitId !== student.academicUnitId) {
      const unit = await this.prisma.academicUnit.findFirst({
        where: { id: dto.academicUnitId, institutionId, deletedAt: null },
        select: { id: true },
      });
      if (!unit) throw new NotFoundException('Academic unit not found in this institution');
    }

    const data: Prisma.StudentUpdateInput = {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.middleName !== undefined && { middleName: dto.middleName || null }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.rollNo !== undefined && { rollNo: dto.rollNo }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
      ...(dto.placeOfBirth !== undefined && { placeOfBirth: dto.placeOfBirth || null }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.motherTongue !== undefined && { motherTongue: dto.motherTongue || null }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.fatherName !== undefined && { fatherName: dto.fatherName }),
      ...(dto.fatherOccupation !== undefined && { fatherOccupation: dto.fatherOccupation || null }),
      ...(dto.fatherQualification !== undefined && { fatherQualification: dto.fatherQualification || null }),
      ...(dto.fatherEmail !== undefined && { fatherEmail: dto.fatherEmail || null }),
      ...(dto.fatherAadhar !== undefined && { fatherAadhar: dto.fatherAadhar || null }),
      ...(dto.motherName !== undefined && { motherName: dto.motherName }),
      ...(dto.motherOccupation !== undefined && { motherOccupation: dto.motherOccupation || null }),
      ...(dto.motherQualification !== undefined && { motherQualification: dto.motherQualification || null }),
      ...(dto.motherEmail !== undefined && { motherEmail: dto.motherEmail || null }),
      ...(dto.motherAadhar !== undefined && { motherAadhar: dto.motherAadhar || null }),
      ...(dto.parentPhone !== undefined && { parentPhone: dto.parentPhone }),
      ...(dto.secondaryPhone !== undefined && { secondaryPhone: dto.secondaryPhone || null }),
      ...(dto.annualIncome !== undefined && { annualIncome: dto.annualIncome || null }),
      ...(dto.isEwsCategory !== undefined && { isEwsCategory: dto.isEwsCategory }),
      ...(dto.emergencyContactName !== undefined && { emergencyContactName: dto.emergencyContactName || null }),
      ...(dto.emergencyContactRelation !== undefined && { emergencyContactRelation: dto.emergencyContactRelation || null }),
      ...(dto.emergencyContactPhone !== undefined && { emergencyContactPhone: dto.emergencyContactPhone || null }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.locality !== undefined && { locality: dto.locality || null }),
      ...(dto.city !== undefined && { city: dto.city || null }),
      ...(dto.state !== undefined && { state: dto.state || null }),
      ...(dto.pinCode !== undefined && { pinCode: dto.pinCode || null }),
      ...(dto.admissionDate !== undefined && { admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : null }),
      ...(dto.academicUnitId !== undefined && { academicUnitId: dto.academicUnitId }),
      ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup || null }),
      ...(dto.nationality !== undefined && { nationality: dto.nationality }),
      ...(dto.religion !== undefined && { religion: dto.religion || null }),
      ...(dto.casteCategory !== undefined && { casteCategory: dto.casteCategory || null }),
      ...(dto.aadharNumber !== undefined && { aadharNumber: dto.aadharNumber || null }),
      ...(dto.tcFromPrevious !== undefined && { tcFromPrevious: dto.tcFromPrevious }),
      ...(dto.tcReceivedDate !== undefined && { tcReceivedDate: dto.tcReceivedDate ? new Date(dto.tcReceivedDate) : null }),
      ...(dto.tcPreviousInstitution !== undefined && { tcPreviousInstitution: dto.tcPreviousInstitution || null }),
      ...(dto.previousClass !== undefined && { previousClass: dto.previousClass || null }),
      ...(dto.previousBoard !== undefined && { previousBoard: dto.previousBoard || null }),
      ...(dto.previousMarks !== undefined && { previousMarks: dto.previousMarks || null }),
      ...(dto.hasDisability !== undefined && { hasDisability: dto.hasDisability }),
      ...(dto.disabilityDetails !== undefined && { disabilityDetails: dto.disabilityDetails || null }),
      ...(dto.medicalConditions !== undefined && { medicalConditions: dto.medicalConditions || null }),
      ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl || null }),
    };

    // H-04: If parentPhone changed, also update the linked parent user's phone
    // so their login credential stays in sync with the student record.
    const phoneChanged =
      dto.parentPhone !== undefined && dto.parentPhone !== student.parentPhone;

    if (phoneChanged && student.parentUserId && dto.parentPhone) {
      return this.prisma.$transaction([
        this.prisma.student.update({ where: { id: studentId }, data }),
        this.prisma.user.update({
          where: { id: student.parentUserId },
          data: { phone: dto.parentPhone },
        }),
      ]).then(([updatedStudent]) => updatedStudent);
    }

    return this.prisma.student.update({ where: { id: studentId }, data });
  }

  async delete(institutionId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    return this.prisma.student.update({
      where: { id: studentId },
      data: { deletedAt: new Date() },
    });
  }

  async count(institutionId: string, unitId?: string) {
    let unitFilter: { academicUnitId?: string | { in: string[] } } = {};
    if (unitId) {
      const children = await this.prisma.academicUnit.findMany({
        where: { parentId: unitId, deletedAt: null },
        select: { id: true },
      });
      const unitIds = children.length > 0 ? children.map((c) => c.id) : [unitId];
      unitFilter = { academicUnitId: { in: unitIds } };
    }
    const base = { institutionId, deletedAt: null, ...unitFilter };
    const [totalStudents, unlinkedParents, boys, girls] = await Promise.all([
      this.prisma.student.count({ where: base }),
      this.prisma.student.count({ where: { ...base, status: 'active', parentUserId: null } }),
      this.prisma.student.count({ where: { ...base, gender: 'male' } }),
      this.prisma.student.count({ where: { ...base, gender: 'female' } }),
    ]);
    return { totalStudents, unlinkedParents, boys, girls };
  }

  async findUnlinkedParents(institutionId: string, limit = 100) {
    return this.prisma.student.findMany({
      where: { institutionId, deletedAt: null, status: 'active', parentUserId: null },
      select: {
        id: true, firstName: true, lastName: true, admissionNo: true,
        parentPhone: true, academicUnit: { select: { id: true, displayName: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── PORTAL LINKING ────────────────────────────────────────────────────────

  async findByParentUserId(institutionId: string, parentUserId: string) {
    if (!parentUserId) return [];
    return this.prisma.student.findMany({
      where: { institutionId, parentUserId, deletedAt: null, status: 'active' },
      include: { academicUnit: true },
    });
  }

  async findByStudentUserId(institutionId: string, userId: string) {
    if (!userId) return null;
    return this.prisma.student.findFirst({
      where: { institutionId, userId, deletedAt: null },
      include: { academicUnit: { include: { parent: true } } },
    });
  }

  async linkUser(
    institutionId: string,
    studentId: string,
    userId: string,
    role: 'student' | 'parent',
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    // Explicitly verify the user belongs to this institution before linking.
    // updateMany below would silently update 0 rows if the user is from a different
    // tenant, leaving the student linked to a foreign userId.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found in this institution');

    // Activate user if inactive
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    if (role === 'student') {
      return this.prisma.student.update({
        where: { id: studentId },
        data: { userId },
      });
    } else {
      return this.prisma.student.update({
        where: { id: studentId },
        data: { parentUserId: userId },
      });
    }
  }

  /**
   * Unlink a user account from a student.
   * Also deactivates that user so they immediately lose platform access.
   */
  async unlinkUser(
    institutionId: string,
    studentId: string,
    role: 'student' | 'parent',
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (role === 'student') {
      const userIdToDeactivate = student.userId;
      await this.prisma.student.update({
        where: { id: studentId },
        data: { userId: null },
      });
      // Deactivate the user — immediate loss of access
      if (userIdToDeactivate) {
        await this.prisma.user.update({
          where: { id: userIdToDeactivate },
          data: { isActive: false },
        });
      }
      return { unlinked: true, role: 'student', deactivated: !!userIdToDeactivate };
    } else {
      const parentUserIdToDeactivate = student.parentUserId;
      await this.prisma.student.update({
        where: { id: studentId },
        data: { parentUserId: null },
      });
      // Deactivate the parent user — check they have no other children linked
      if (parentUserIdToDeactivate) {
        const otherChildren = await this.prisma.student.count({
          where: {
            parentUserId: parentUserIdToDeactivate,
            deletedAt: null,
            id: { not: studentId },
          },
        });
        if (otherChildren === 0) {
          await this.prisma.user.update({
            where: { id: parentUserIdToDeactivate },
            data: { isActive: false },
          });
        }
      }
      return { unlinked: true, role: 'parent', deactivated: !!parentUserIdToDeactivate };
    }
  }

  // ── PROMOTION ─────────────────────────────────────────────────────────────

  async promote(
    institutionId: string,
    studentIds: string[],
    targetUnitId: string | null,
    action: 'promote' | 'holdback' | 'transfer',
    callerUserId?: string,
    sourceUnitId?: string,
  ) {
    if (!studentIds.length) throw new BadRequestException('No students selected');

    // Class-teacher-only gate: if sourceUnitId provided, validate caller owns that unit
    if (sourceUnitId) {
      const sourceUnit = await this.prisma.academicUnit.findFirst({
        where: { id: sourceUnitId, institutionId, deletedAt: null },
        select: { classTeacherUserId: true },
      });
      if (!sourceUnit) throw new NotFoundException('Source academic unit not found');
      if (sourceUnit.classTeacherUserId !== callerUserId) {
        throw new ForbiddenException('Only the class teacher of this unit can promote its students');
      }
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, institutionId, deletedAt: null },
    });

    if (students.length !== studentIds.length) {
      throw new BadRequestException(
        'One or more students not found in this institution',
      );
    }

    if (action === 'holdback') {
      // B1-03: Record the holdback decision — set status to 'held_back' so it's visible in reports
      await this.prisma.student.updateMany({
        where: { id: { in: studentIds }, institutionId },
        data: { status: 'held_back' },
      });
      return { updated: students.length, action };
    }

    if (!targetUnitId)
      throw new BadRequestException(
        'targetUnitId is required for promote/transfer',
      );

    const targetUnit = await this.prisma.academicUnit.findFirst({
      where: { id: targetUnitId, institutionId, deletedAt: null },
    });
    if (!targetUnit) throw new NotFoundException('Target academic unit not found');

    const existingCount = await this.prisma.student.count({
      where: {
        academicUnitId: targetUnitId,
        deletedAt: null,
        id: { notIn: studentIds },
      },
    });

    await Promise.all(
      studentIds.map((id, idx) =>
        this.prisma.student.update({
          where: { id },
          data: {
            academicUnitId: targetUnitId,
            rollNo: String(existingCount + idx + 1).padStart(2, '0'),
          },
        }),
      ),
    );

    return {
      updated: studentIds.length,
      action,
      targetUnitId,
      targetUnitName: targetUnit.displayName ?? targetUnit.name,
    };
  }
}
