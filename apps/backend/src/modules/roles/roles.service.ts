import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(institutionId: string, dto: CreateRoleDto) {
    try {
      return await this.prisma.role.create({
        data: {
          institutionId,
          code: dto.code,
          label: dto.label,
          permissions: dto.permissions,
        },
      });
    } catch {
      throw new ConflictException('Role already exists');
    }
  }

  async findAll(institutionId: string) {
    return this.prisma.role.findMany({
      where: {
        institutionId,
      },
      orderBy: {
        code: 'asc',
      },
    });
  }
}