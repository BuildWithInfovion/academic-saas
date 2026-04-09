import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { InstitutionService } from './institution.service';

interface CreateInstitutionDto {
  name: string;
  code: string;
  planCode: string;
  institutionType: string;
}

@Controller('institution')
export class InstitutionController {
  constructor(private readonly institutionService: InstitutionService) {}

  @Post()
  async create(
    @Body() createInstitutionDto: CreateInstitutionDto,
  ): Promise<unknown> {
    return this.institutionService.create(createInstitutionDto);
  }

  @Get()
  async findAll() {
    return this.institutionService.findAll();
  }

  // POST /institution/:id/seed-defaults — seeds standard fee heads + subjects
  @Post(':id/seed-defaults')
  async seedDefaults(
    @Param('id') id: string,
    @Body() body: { institutionType?: string },
  ) {
    return this.institutionService.seedDefaults(id, body.institutionType);
  }

  // PATCH /institution/:id/code — set or update the institution login code
  @Post(':id/set-code')
  async setCode(
    @Param('id') id: string,
    @Body() body: { code: string },
  ) {
    return this.institutionService.setCode(id, body.code);
  }
}
