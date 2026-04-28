import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { DocumentService } from './document.service';
import { GetUploadSignatureDto, SaveDocumentDto } from './dto/document.dto';

interface TenantContext {
  institutionId: string;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  // Step 1 of upload flow: get Cloudinary signature so frontend can upload directly.
  // Frontend calls Cloudinary with this signature, then calls POST /documents to save.
  @Get('upload-signature')
  @Permissions('students.write')
  getUploadSignature(
    @Tenant() tenant: TenantContext,
    @Query() query: GetUploadSignatureDto,
  ) {
    return this.documentService.getUploadSignature(tenant.institutionId, query.studentId);
  }

  // Step 2 of upload flow: save Cloudinary URL + metadata to DB after direct upload.
  @Post()
  @Permissions('students.write')
  save(
    @Tenant() tenant: TenantContext,
    @Req() req: any,
    @Body() dto: SaveDocumentDto,
  ) {
    return this.documentService.save(tenant.institutionId, req.user.sub, dto);
  }

  @Get('student/:studentId')
  @Permissions('students.read')
  findByStudent(
    @Tenant() tenant: TenantContext,
    @Param('studentId') studentId: string,
  ) {
    return this.documentService.findByStudent(tenant.institutionId, studentId);
  }

  @Get('student/:studentId/checklist')
  @Permissions('students.read')
  getChecklist(
    @Tenant() tenant: TenantContext,
    @Param('studentId') studentId: string,
  ) {
    return this.documentService.getChecklist(tenant.institutionId, studentId);
  }

  @Delete(':id')
  @Permissions('students.write')
  remove(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.documentService.remove(tenant.institutionId, id);
  }
}
