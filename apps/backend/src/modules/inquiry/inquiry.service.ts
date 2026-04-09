import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInquiryDto, UpdateInquiryDto } from './dto/inquiry.dto';

@Injectable()
export class InquiryService {
  constructor(private prisma: PrismaService) {}

  async create(institutionId: string, dto: CreateInquiryDto) {
    return this.prisma.inquiry.create({
      data: {
        institutionId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        classInterest: dto.classInterest,
        academicYearId: dto.academicYearId,
        notes: dto.notes,
        status: 'new',
      },
    });
  }

  async findAll(
    institutionId: string,
    status?: string,
    search?: string,
  ) {
    return this.prisma.inquiry.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(institutionId: string, id: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    return inquiry;
  }

  async update(institutionId: string, id: string, dto: UpdateInquiryDto) {
    await this.findOne(institutionId, id);
    return this.prisma.inquiry.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.classInterest !== undefined && { classInterest: dto.classInterest }),
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async delete(institutionId: string, id: string) {
    await this.findOne(institutionId, id);
    return this.prisma.inquiry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
