import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubjectDto, AssignSubjectDto } from './dto/subject.dto';

@Injectable()
export class SubjectService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string) {
    return this.prisma.subject.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async create(institutionId: string, dto: CreateSubjectDto) {
    try {
      return await this.prisma.subject.create({
        data: { institutionId, name: dto.name, code: dto.code },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Subject with this name already exists');
      throw e;
    }
  }

  async remove(institutionId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, institutionId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.prisma.subject.update({
      where: { id: subjectId },
      data: { deletedAt: new Date() },
    });
  }

  // ── Unit-Subject assignments ──────────────────────────────────────────────

  async getUnitSubjects(institutionId: string, academicUnitId: string) {
    return this.prisma.academicUnitSubject.findMany({
      where: { institutionId, academicUnitId },
      include: {
        subject: true,
        teacher: { select: { id: true, email: true, phone: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    });
  }

  async assignSubjectToUnit(
    institutionId: string,
    academicUnitId: string,
    dto: AssignSubjectDto,
  ) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, institutionId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    return this.prisma.academicUnitSubject.upsert({
      where: { academicUnitId_subjectId: { academicUnitId, subjectId: dto.subjectId } },
      create: {
        institutionId,
        academicUnitId,
        subjectId: dto.subjectId,
        teacherUserId: dto.teacherUserId,
        isClassTeacher: dto.isClassTeacher ?? false,
      },
      update: {
        teacherUserId: dto.teacherUserId,
        isClassTeacher: dto.isClassTeacher ?? false,
      },
    });
  }

  async removeSubjectFromUnit(institutionId: string, academicUnitId: string, subjectId: string) {
    const existing = await this.prisma.academicUnitSubject.findFirst({
      where: { institutionId, academicUnitId, subjectId },
    });
    if (!existing) throw new NotFoundException('Assignment not found');
    return this.prisma.academicUnitSubject.delete({ where: { id: existing.id } });
  }
}
