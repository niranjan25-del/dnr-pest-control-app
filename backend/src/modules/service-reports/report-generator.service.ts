// src/modules/service-reports/report-generator.service.ts
//
// Builds the service-report PDF with pdfkit and stores it privately in S3, tracked as a
// MediaFile (ownerType 'service_report_pdf') — ServiceReport has no pdf column. Before/after
// photos and the signature are embedded best-effort by fetching their bytes via presigned URLs
// (skipped silently if S3 isn't reachable). Returns the S3 key for presigned download.

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { S3Service } from '../media/s3.service';
import { SignatureService } from './signature.service';
import { renderReport } from './templates/report.template';
import { ReportPdfData } from './interfaces';
import { REPORT_PDF_OWNER_TYPE, ReportItemLabel, SIGNED_URL_TTL_SECONDS } from './enums';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly signatures: SignatureService,
  ) {}

  async generate(reportId: string): Promise<string> {
    const report = await this.prisma.serviceReport.findUnique({
      where: { id: reportId },
      include: {
        items: { include: { media: { select: { storageKey: true } } } },
        technician: { include: { user: { select: { fullName: true } }, } },
        booking: { include: { customer: { include: { user: { select: { fullName: true, email: true, phone: true } } } }, address: { select: { line1: true, city: true, state: true, postalCode: true } } } },
      },
    });
    if (!report) throw new InternalServerErrorException({ code: 'REPORT_NOT_FOUND', message: 'Report not found' });

    const itemsBy = (label: string) => report.items.filter((i) => i.label === label);
    const beforeKeys = itemsBy(ReportItemLabel.BEFORE_PHOTO).map((i) => i.media?.storageKey).filter(Boolean) as string[];
    const afterKeys = itemsBy(ReportItemLabel.AFTER_PHOTO).map((i) => i.media?.storageKey).filter(Boolean) as string[];

    const data: ReportPdfData = {
      reportNumber: `SR-${report.id.slice(0, 8).toUpperCase()}`,
      status: report.status,
      createdAt: report.createdAt,
      submittedAt: report.submittedAt,
      customer: {
        name: report.booking.customer.user.fullName,
        email: report.booking.customer.user.email,
        phone: report.booking.customer.user.phone,
        address: report.booking.address ? `${report.booking.address.line1}, ${report.booking.address.city}, ${report.booking.address.state} ${report.booking.address.postalCode}` : undefined,
      },
      technician: { name: report.technician.user.fullName, license: (report.technician as { licenseNumber?: string }).licenseNumber ?? null },
      summary: report.summary,
      recommendations: report.recommendations,
      findings: itemsBy(ReportItemLabel.FINDING).map((i) => i.value ?? '').filter(Boolean),
      services: itemsBy(ReportItemLabel.SERVICE).map((i) => i.value ?? '').filter(Boolean),
      chemicals: itemsBy(ReportItemLabel.CHEMICAL).map((i) => ({ chemicalName: i.chemicalName ?? '-', quantity: i.quantity, area_notes: i.value })),
      beforePhotos: await this.fetchBuffers(beforeKeys),
      afterPhotos: await this.fetchBuffers(afterKeys),
      safetyNotes: itemsBy(ReportItemLabel.SAFETY_NOTE).map((i) => i.value ?? '').filter(Boolean),
      regulatoryNotes: itemsBy(ReportItemLabel.REGULATORY_NOTE).map((i) => i.value ?? '').filter(Boolean),
      signature: await this.signatures.getBytes(reportId),
    };

    const buffer = await this.build(data);
    const key = `service_report/${reportId}/report-${randomUUID()}.pdf`;
    await this.s3.putObject(key, buffer, 'application/pdf');
    await this.prisma.mediaFile.upsert({
      where: { storageKey: key },
      update: { sizeBytes: buffer.byteLength },
      create: { type: MediaType.DOCUMENT, storageKey: key, url: key, contentType: 'application/pdf', sizeBytes: buffer.byteLength, ownerType: REPORT_PDF_OWNER_TYPE, ownerId: reportId },
    });
    this.logger.log(`Service report PDF generated for ${reportId}`);
    return key;
  }

  private build(data: ReportPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        renderReport(doc, data);
        doc.end();
      } catch (err) {
        reject(new InternalServerErrorException({ code: 'PDF_GENERATION_FAILED', message: 'Could not generate the report PDF' }));
      }
    });
  }

  private async fetchBuffers(keys: string[]): Promise<Buffer[]> {
    const out: Buffer[] = [];
    for (const key of keys.slice(0, 6)) {
      try {
        const url = await this.s3.presignGet(key, SIGNED_URL_TTL_SECONDS);
        const res = await fetch(url);
        out.push(Buffer.from(await res.arrayBuffer()));
      } catch {
        // Skip an unreadable image rather than failing the whole PDF.
      }
    }
    return out;
  }

  async latestPdfKey(reportId: string): Promise<string | null> {
    const media = await this.prisma.mediaFile.findFirst({ where: { ownerType: REPORT_PDF_OWNER_TYPE, ownerId: reportId }, orderBy: { createdAt: 'desc' } });
    return media?.storageKey ?? null;
  }
}
