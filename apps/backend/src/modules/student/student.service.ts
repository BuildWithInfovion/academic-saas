import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

const CLASS_1_UNIT_NAMES = ['class_1', 'class1', 'i', '1'];

export interface AdmissionFeeDto {
  paid: boolean;
  amountPaid?: number;
  paymentMode?: string;   // cash | upi | cheque | dd | neft
  dueDate?: string;       // ISO date — when not paying now
  feeHeadId?: string;
  academicYearId?: string;
}

export interface ConfirmAdmissionDto extends CreateStudentDto {
  admissionFee?: AdmissionFeeDto;
}

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async generateAdmissionNo(institutionId: string): Promise<string> {
    const count = await this.prisma.student.count({ where: { institutionId } });
    const year = new Date().getFullYear();
    return `ADM-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateRollNo(academicUnitId: string): Promise<string> {
    const count = await this.prisma.student.count({
      where: { academicUnitId, deletedAt: null },
    });
    return String(count + 1).padStart(2, '0');
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }

  private async generateReceiptNo(institutionId: string): Promise<string> {
    const count = await this.prisma.feePayment.count({ where: { institutionId } });
    const year = new Date().getFullYear();
    return `RCP-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async validateTc(institutionId: string, dto: CreateStudentDto): Promise<string> {
    const unit = await this.prisma.academicUnit.findFirst({
      where: { id: dto.academicUnitId, institutionId, deletedAt: null },
    });

    const isClass1 = unit
      ? CLASS_1_UNIT_NAMES.includes(unit.name.toLowerCase().trim())
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
    const admissionNo = await this.generateAdmissionNo(institutionId);
    const tcFromPrevious = await this.validateTc(institutionId, dto);
    const rollNo = dto.academicUnitId
      ? await this.generateRollNo(dto.academicUnitId)
      : undefined;

    // Find parent role for auto-assignment
    const parentRole = await this.prisma.role.findFirst({
      where: { institutionId, code: 'parent' },
    });

    // Check if a user with this phone already exists (reuse if so)
    const existingParentUser = dto.parentPhone
      ? await this.prisma.user.findFirst({
          where: { institutionId, phone: dto.parentPhone, deletedAt: null },
        })
      : null;

    // Generate parent credentials
    const generatedPassword = this.generatePassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 12);

    // Receipt number (outside tx for simplicity, low contention)
    const receiptNo = dto.admissionFee?.paid && dto.admissionFee.amountPaid
      ? await this.generateReceiptNo(institutionId)
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create student record
      const student = await tx.student.create({
        data: {
          institutionId,
          admissionNo,
          rollNo,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          fatherName: dto.fatherName,
          motherName: dto.motherName,
          parentPhone: dto.parentPhone,
          secondaryPhone: dto.secondaryPhone,
          admissionDate: dto.admissionDate
            ? new Date(dto.admissionDate)
            : new Date(),
          academicUnitId: dto.academicUnitId,
          bloodGroup: dto.bloodGroup,
          nationality: dto.nationality ?? 'Indian',
          religion: dto.religion,
          casteCategory: dto.casteCategory,
          aadharNumber: dto.aadharNumber,
          tcFromPrevious,
          tcReceivedDate: dto.tcReceivedDate
            ? new Date(dto.tcReceivedDate)
            : undefined,
          tcPreviousInstitution: dto.tcPreviousInstitution,
          status: 'active',
        },
      });

      // 2. Create or reuse parent user account
      let parentUser = existingParentUser;
      let isNewParentUser = false;

      if (!parentUser) {
        parentUser = await tx.user.create({
          data: {
            institutionId,
            phone: dto.parentPhone,
            passwordHash,
            isActive: true,
          },
        });
        isNewParentUser = true;

        // Assign parent role to new user
        if (parentRole) {
          await tx.userRole.create({
            data: {
              userId: parentUser.id,
              roleId: parentRole.id,
              institutionId,
            },
          });
        }
      }

      // 3. Link parent to student
      await tx.student.update({
        where: { id: student.id },
        data: { parentUserId: parentUser.id },
      });

      // 4. Record admission fee payment if paid now
      let feePayment: Record<string, unknown> | null = null;
      if (
        dto.admissionFee?.paid &&
        dto.admissionFee.amountPaid &&
        dto.admissionFee.amountPaid > 0 &&
        dto.admissionFee.feeHeadId &&
        receiptNo
      ) {
        feePayment = await tx.feePayment.create({
          data: {
            institutionId,
            studentId: student.id,
            feeHeadId: dto.admissionFee.feeHeadId,
            academicYearId: dto.admissionFee.academicYearId,
            amount: dto.admissionFee.amountPaid,
            paymentMode: dto.admissionFee.paymentMode ?? 'cash',
            receiptNo,
            paidOn: new Date(),
            remarks: 'Admission fee payment',
          },
          include: { feeHead: true },
        });
      }

      return { student, parentUser, isNewParentUser, feePayment };
    });

    return {
      student: result.student,
      admissionNo: result.student.admissionNo,
      rollNo: result.student.rollNo,
      parentCredentials: {
        userId: result.parentUser.id,
        phone: result.parentUser.phone,
        isNew: result.isNewParentUser,
        // Only show generated password for newly-created users
        generatedPassword: result.isNewParentUser ? generatedPassword : null,
      },
      feePayment: result.feePayment,
    };
  }

  // ── BASIC CREATE (kept for backwards compat) ──────────────────────────────

  async create(institutionId: string, dto: CreateStudentDto) {
    try {
      const admissionNo = await this.generateAdmissionNo(institutionId);
      const tcFromPrevious = await this.validateTc(institutionId, dto);
      const rollNo = dto.academicUnitId
        ? await this.generateRollNo(dto.academicUnitId)
        : undefined;

      return await this.prisma.student.create({
        data: {
          institutionId,
          admissionNo,
          rollNo,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          fatherName: dto.fatherName,
          motherName: dto.motherName,
          parentPhone: dto.parentPhone,
          secondaryPhone: dto.secondaryPhone,
          admissionDate: dto.admissionDate
            ? new Date(dto.admissionDate)
            : new Date(),
          academicUnitId: dto.academicUnitId,
          bloodGroup: dto.bloodGroup,
          nationality: dto.nationality ?? 'Indian',
          religion: dto.religion,
          casteCategory: dto.casteCategory,
          aadharNumber: dto.aadharNumber,
          tcFromPrevious,
          tcReceivedDate: dto.tcReceivedDate
            ? new Date(dto.tcReceivedDate)
            : undefined,
          tcPreviousInstitution: dto.tcPreviousInstitution,
          status: 'active',
        },
      });
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
    };

    if (unitId) {
      whereCondition.academicUnitId = unitId;
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

    const data: Prisma.StudentUpdateInput = {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.rollNo !== undefined && { rollNo: dto.rollNo }),
      ...(dto.dateOfBirth !== undefined && {
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.fatherName !== undefined && { fatherName: dto.fatherName }),
      ...(dto.motherName !== undefined && { motherName: dto.motherName }),
      ...(dto.parentPhone !== undefined && { parentPhone: dto.parentPhone }),
      ...(dto.secondaryPhone !== undefined && {
        secondaryPhone: dto.secondaryPhone || null,
      }),
      ...(dto.admissionDate !== undefined && {
        admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : null,
      }),
      ...(dto.academicUnitId !== undefined && { academicUnitId: dto.academicUnitId }),
      ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup || null }),
      ...(dto.nationality !== undefined && { nationality: dto.nationality }),
      ...(dto.religion !== undefined && { religion: dto.religion || null }),
      ...(dto.casteCategory !== undefined && { casteCategory: dto.casteCategory || null }),
      ...(dto.aadharNumber !== undefined && { aadharNumber: dto.aadharNumber || null }),
      ...(dto.tcFromPrevious !== undefined && { tcFromPrevious: dto.tcFromPrevious }),
      ...(dto.tcReceivedDate !== undefined && {
        tcReceivedDate: dto.tcReceivedDate ? new Date(dto.tcReceivedDate) : null,
      }),
      ...(dto.tcPreviousInstitution !== undefined && {
        tcPreviousInstitution: dto.tcPreviousInstitution || null,
      }),
    };

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

  async count(institutionId: string) {
    const [totalStudents, unlinkedParents] = await Promise.all([
      this.prisma.student.count({ where: { institutionId, deletedAt: null } }),
      this.prisma.student.count({ where: { institutionId, deletedAt: null, status: 'active', parentUserId: null } }),
    ]);
    return { totalStudents, unlinkedParents };
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

  async findByUserId(institutionId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { institutionId, userId, deletedAt: null },
      include: { academicUnit: true },
    });
    if (!student)
      throw new NotFoundException('No student record linked to this account');
    return student;
  }

  async findByParentUserId(institutionId: string, parentUserId: string) {
    return this.prisma.student.findMany({
      where: { institutionId, parentUserId, deletedAt: null },
      include: { academicUnit: true },
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

    // Activate user if inactive
    await this.prisma.user.updateMany({
      where: { id: userId, institutionId },
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
