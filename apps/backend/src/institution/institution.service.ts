import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { DEFAULT_FEE_HEADS, SCHOOL_SUBJECTS, COLLEGE_SUBJECTS } from '../common/constants/seed-defaults';

export interface CreateInstitutionDto {
  name: string;
  code: string;
  planCode: string;
  institutionType: string;
}

@Injectable()
export class InstitutionService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  getLogoSignature(institutionId: string) {
    return this.getBrandingSignature(institutionId, 'logo');
  }

  getBrandingSignature(institutionId: string, asset: string) {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Set CLOUDINARY_* environment variables.',
      );
    }
    return this.storage.generateBrandingSignature(institutionId, asset);
  }

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
    name?: string; institutionType?: string;
    address?: string; phone?: string; email?: string; website?: string;
    board?: string; logoUrl?: string; principalName?: string; tagline?: string; affiliationNo?: string;
    udiseCode?: string; gstin?: string; pan?: string; recognitionNo?: string;
    foundedYear?: number; mediumOfInstruction?: string; schoolType?: string; managementType?: string;
    stampUrl?: string; signatureUrl?: string;
    bankName?: string; bankAccountNo?: string; bankIfsc?: string; bankBranch?: string; bankAccountHolder?: string;
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
