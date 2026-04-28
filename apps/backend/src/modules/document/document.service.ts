import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { SaveDocumentDto, DOCUMENT_LABELS, DocumentType } from './dto/document.dto';

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Returns a Cloudinary signed upload signature.
  // Frontend uses this to upload directly to Cloudinary, then calls saveDocument.
  getUploadSignature(institutionId: string, studentId: string) {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'Document storage is not configured. Set CLOUDINARY_* environment variables.',
      );
    }
    return this.storage.generateUploadSignature(institutionId, studentId);
  }

  async findByStudent(institutionId: string, studentId: string) {
    await this.assertStudentBelongsToInstitution(institutionId, studentId);
    return this.prisma.studentDocument.findMany({
      where: { institutionId, studentId, deletedAt: null },
      orderBy: { uploadedAt: 'asc' },
      select: {
        id: true,
        type: true,
        label: true,
        url: true,
        format: true,
        sizeBytes: true,
        uploadedAt: true,
        publicId: false, // never expose publicId to clients
      },
    });
  }

  async save(institutionId: string, uploaderUserId: string, dto: SaveDocumentDto) {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'Document storage is not configured. Set CLOUDINARY_* environment variables.',
      );
    }

    await this.assertStudentBelongsToInstitution(institutionId, dto.studentId);

    // Enforce one document per type per student (replace existing)
    const existing = await this.prisma.studentDocument.findFirst({
      where: { institutionId, studentId: dto.studentId, type: dto.type, deletedAt: null },
    });

    if (existing) {
      // Delete old file from Cloudinary then update record
      void this.storage.deleteFile(existing.publicId);
      return this.prisma.studentDocument.update({
        where: { id: existing.id },
        data: {
          url: dto.url,
          publicId: dto.publicId,
          label: dto.label ?? DOCUMENT_LABELS[dto.type as DocumentType] ?? dto.type,
          format: dto.format ?? null,
          sizeBytes: dto.sizeBytes ?? null,
          uploadedByUserId: uploaderUserId,
          uploadedAt: new Date(),
          deletedAt: null,
        },
        select: { id: true, type: true, label: true, url: true, format: true, sizeBytes: true, uploadedAt: true },
      });
    }

    return this.prisma.studentDocument.create({
      data: {
        institutionId,
        studentId: dto.studentId,
        type: dto.type,
        label: dto.label ?? DOCUMENT_LABELS[dto.type as DocumentType] ?? dto.type,
        url: dto.url,
        publicId: dto.publicId,
        format: dto.format ?? null,
        sizeBytes: dto.sizeBytes ?? null,
        uploadedByUserId: uploaderUserId,
      },
      select: { id: true, type: true, label: true, url: true, format: true, sizeBytes: true, uploadedAt: true },
    });
  }

  async remove(institutionId: string, documentId: string) {
    const doc = await this.prisma.studentDocument.findFirst({
      where: { id: documentId, institutionId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');

    void this.storage.deleteFile(doc.publicId);

    await this.prisma.studentDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
  }

  // Returns the checklist of required document types with upload status per student.
  async getChecklist(institutionId: string, studentId: string) {
    await this.assertStudentBelongsToInstitution(institutionId, studentId);

    const uploaded = await this.prisma.studentDocument.findMany({
      where: { institutionId, studentId, deletedAt: null },
      select: { type: true, label: true, uploadedAt: true },
    });

    const uploadedSet = new Set(uploaded.map((d) => d.type));

    // Mandatory documents for Indian schools
    const mandatoryTypes = ['aadhaar', 'birth_certificate', 'passport_photo'];

    return {
      uploaded,
      missing: mandatoryTypes.filter((t) => !uploadedSet.has(t)),
      completionPct: Math.round((uploaded.length / mandatoryTypes.length) * 100),
    };
  }

  private async assertStudentBelongsToInstitution(institutionId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
    });
    if (!student) throw new BadRequestException('Student not found in this institution');
    return student;
  }
}
