import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateInstitutionDto {
  name: string;
  code: string;
  planCode: string;
  institutionType: string;
}

const DEFAULT_FEE_HEADS = [
  'Tuition Fee',
  'Exam Fee',
  'Library Fee',
  'Lab Fee',
  'Sports Fee',
  'Activity Fee',
  'Development Fee',
  'Admission Fee',
  'Transport Fee',
  'Hostel Fee',
];

const SCHOOL_SUBJECTS = [
  'English',
  'Hindi',
  'Mathematics',
  'Environmental Studies',
  'General Knowledge',
  'Science',
  'Social Studies',
  'Sanskrit',
  'Marathi',
  'Drawing & Craft',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography',
  'Political Science',
  'Economics',
  'Computer Science',
  'Accountancy',
  'Business Studies',
  'Information Technology',
  'Physical Education',
];

const COLLEGE_SUBJECTS = [
  'English Communication',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Applications',
  'Statistics',
  'Economics',
  'Commerce',
  'Management',
  'Environmental Studies',
  'Soft Skills',
];

@Injectable()
export class InstitutionService {
  constructor(private prisma: PrismaService) {}

  async create(createInstitutionDto: CreateInstitutionDto) {
    return this.prisma.institution.create({
      data: createInstitutionDto,
    });
  }

  async findAll() {
    return this.prisma.institution.findMany();
  }

  async findById(institutionId: string) {
    return this.prisma.institution.findUnique({ where: { id: institutionId } });
  }

  async updateProfile(institutionId: string, dto: {
    name?: string;
    institutionType?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    board?: string;
  }) {
    return this.prisma.institution.update({
      where: { id: institutionId },
      data: dto,
    });
  }

  async setCode(institutionId: string, code: string) {
    return this.prisma.institution.update({
      where: { id: institutionId },
      data: { code: code.toLowerCase().trim() },
    });
  }

  async seedDefaults(
    institutionId: string,
    institutionType: string = 'school',
  ) {
    const subjectList =
      institutionType === 'college' ? COLLEGE_SUBJECTS : SCHOOL_SUBJECTS;

    const feeHeadOps = DEFAULT_FEE_HEADS.map((name) =>
      this.prisma.feeHead.upsert({
        where: { institutionId_name: { institutionId, name } },
        create: { institutionId, name, isCustom: false },
        update: {},
      }),
    );

    const subjectOps = subjectList.map((name) =>
      this.prisma.subject.upsert({
        where: { institutionId_name: { institutionId, name } },
        create: { institutionId, name },
        update: {},
      }),
    );

    const [feeHeads, subjects] = await Promise.all([
      this.prisma.$transaction(feeHeadOps),
      this.prisma.$transaction(subjectOps),
    ]);

    return {
      feeHeads: feeHeads.length,
      subjects: subjects.length,
      message: 'Default fee heads and subjects seeded successfully',
    };
  }
}
