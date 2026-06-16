// src/modules/service-reports/service-reports.service.ts
//
// Service-report orchestration: create (per assigned booking), structured content edit (item
// groups replaced deterministically), submit, admin approve/reject/archive, signature capture,
// reads, and PDF download. Content lives in ServiceReportItem rows keyed by label; status moves
// through the report state machine; revision/status/approval history is recorded in AuditLog
// (no dedicated history table). Technician owns their assigned report; customer views own;
// admin full.

import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { Prisma, ReportStatus, UserRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';
import { SignatureService } from './signature.service';
import { ReportGeneratorService } from './report-generator.service';
import { S3Service } from '../media/s3.service';
import {
  CreateServiceReportDto, ReportFilterDto, SubmitReportDto, UpdateServiceReportDto,
} from './dto';
import {
  EDITABLE_STATUSES, ReportItemLabel, SIGNED_URL_TTL_SECONDS, isReportTransitionAllowed,
} from './enums';
import { ServiceReportView } from './interfaces';

const REPORT_INCLUDE = {
  items: true,
  technician: { select: { id: true, userId: true } },
  booking: { select: { id: true, customerId: true } },
} satisfies Prisma.ServiceReportInclude;

type ReportRow = Prisma.ServiceReportGetPayload<{ include: typeof REPORT_INCLUDE }>;

@Injectable()
export class ServiceReportsService {
  private readonly logger = new Logger(ServiceReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signatures: SignatureService,
    private readonly generator: ReportGeneratorService,
    private readonly s3: S3Service,
  ) {}

  // ---------------- Create ----------------
  async create(actor: AuthenticatedUser, dto: CreateServiceReportDto) {
    const technicianId = await this.requireTechnicianForBooking(actor, dto.bookingId);
    const existing = await this.prisma.serviceReport.findFirst({ where: { bookingId: dto.bookingId, deletedAt: null }, select: { id: true } });
    if (existing) throw new ConflictException({ code: 'REPORT_EXISTS', message: 'A report already exists for this booking' });

    const report = await this.prisma.serviceReport.create({
      data: { bookingId: dto.bookingId, technicianId, status: ReportStatus.DRAFT, summary: dto.summary, recommendations: dto.recommendations },
    });
    await this.audit(actor.id, 'report.created', report.id, { bookingId: dto.bookingId });
    this.logger.log(`Service report ${report.id} created for booking ${dto.bookingId}`);
    return this.findById(actor, report.id);
  }

  // ---------------- Update (structured content) ----------------
  async update(actor: AuthenticatedUser, id: string, dto: UpdateServiceReportDto) {
    const report = await this.requireOwnedEditable(actor, id);

    await this.prisma.$transaction(async (tx) => {
      if (dto.summary !== undefined || dto.recommendations !== undefined) {
        await tx.serviceReport.update({ where: { id }, data: { summary: dto.summary, recommendations: dto.recommendations } });
      }
      await this.replaceTextItems(tx, id, ReportItemLabel.FINDING, dto.findings);
      await this.replaceTextItems(tx, id, ReportItemLabel.SERVICE, dto.services);
      await this.replaceTextItems(tx, id, ReportItemLabel.SAFETY_NOTE, dto.safetyNotes);
      await this.replaceTextItems(tx, id, ReportItemLabel.REGULATORY_NOTE, dto.regulatoryNotes);

      if (dto.chemicals !== undefined) {
        await tx.serviceReportItem.deleteMany({ where: { reportId: id, label: ReportItemLabel.CHEMICAL } });
        if (dto.chemicals.length) {
          await tx.serviceReportItem.createMany({
            data: dto.chemicals.map((c) => ({
              reportId: id, label: ReportItemLabel.CHEMICAL, chemicalName: c.chemicalName, quantity: c.quantity ?? null,
              value: [c.area, c.notes].filter(Boolean).join(' — ') || null,
            })),
          });
        }
      }
      if (dto.beforePhotoMediaIds !== undefined) await this.replacePhotoItems(tx, id, ReportItemLabel.BEFORE_PHOTO, dto.beforePhotoMediaIds, actor);
      if (dto.afterPhotoMediaIds !== undefined) await this.replacePhotoItems(tx, id, ReportItemLabel.AFTER_PHOTO, dto.afterPhotoMediaIds, actor);
    });
    await this.audit(actor.id, 'report.updated', id);
    return this.findById(actor, id);
  }

  // ---------------- Submit ----------------
  async submit(actor: AuthenticatedUser, id: string, dto: SubmitReportDto) {
    const report = await this.requireOwnedEditable(actor, id);
    this.assertTransition(report.status, ReportStatus.SUBMITTED);
    if (!report.summary?.trim() && !report.items.some((i) => i.label === ReportItemLabel.SERVICE)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Add a summary or at least one service before submitting' });
    }
    await this.prisma.serviceReport.update({ where: { id }, data: { status: ReportStatus.SUBMITTED, submittedAt: new Date() } });
    await this.audit(actor.id, 'report.submitted', id, { note: dto.note });
    this.logger.log(`Service report ${id} submitted`);
    return this.findById(actor, id);
  }

  // ---------------- Admin approve / reject / archive (additive) ----------------
  async approve(actor: AuthenticatedUser, id: string) {
    const report = await this.requireReport(id);
    this.assertTransition(report.status, ReportStatus.APPROVED);
    await this.prisma.serviceReport.update({ where: { id }, data: { status: ReportStatus.APPROVED } });
    await this.audit(actor.id, 'report.approved', id);
    return this.findById(actor, id);
  }

  async reject(actor: AuthenticatedUser, id: string, reason: string) {
    const report = await this.requireReport(id);
    this.assertTransition(report.status, ReportStatus.REJECTED);
    await this.prisma.serviceReport.update({ where: { id }, data: { status: ReportStatus.REJECTED } });
    await this.audit(actor.id, 'report.rejected', id, { reason });
    return this.findById(actor, id);
  }

  async archive(actor: AuthenticatedUser, id: string) {
    await this.requireReport(id);
    await this.prisma.serviceReport.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(actor.id, 'report.archived', id);
    return { success: true };
  }

  // ---------------- Signature ----------------
  async captureSignature(actor: AuthenticatedUser, id: string, imageBase64: string) {
    await this.requireOwnedEditable(actor, id);
    const res = await this.signatures.store(id, actor.id, imageBase64);
    await this.audit(actor.id, 'report.signature_captured', id);
    return res;
  }

  // ---------------- Reads ----------------
  async findById(actor: AuthenticatedUser, id: string): Promise<ServiceReportView> {
    const report = await this.prisma.serviceReport.findFirst({ where: { id, deletedAt: null }, include: REPORT_INCLUDE });
    if (!report) throw new NotFoundException({ code: 'REPORT_NOT_FOUND', message: 'Report not found' });
    await this.assertCanView(actor, report);
    return this.toView(report, await this.signatures.hasSignature(id));
  }

  async list(actor: AuthenticatedUser, filter: ReportFilterDto) {
    const where: Prisma.ServiceReportWhereInput = {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.bookingId ? { bookingId: filter.bookingId } : {}),
      ...(filter.technicianId ? { technicianId: filter.technicianId } : {}),
      ...(await this.scope(actor)),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceReport.findMany({ where, include: REPORT_INCLUDE, orderBy: { createdAt: filter.order }, skip: filter.skip, take: filter.limit }),
      this.prisma.serviceReport.count({ where }),
    ]);
    const views = await Promise.all(rows.map(async (r) => this.toView(r, await this.signatures.hasSignature(r.id))));
    return paginate(views, total, filter.page, filter.limit);
  }

  customerHistory(actor: AuthenticatedUser, filter: ReportFilterDto) {
    return this.list(actor, filter); // scope() already limits a customer to their own reports
  }

  // ---------------- PDF ----------------
  async getPdfUrl(actor: AuthenticatedUser, id: string) {
    const report = await this.findById(actor, id); // authorizes
    let key = await this.generator.latestPdfKey(id);
    if (!key || report.status === ReportStatus.SUBMITTED || report.status === ReportStatus.APPROVED) {
      key = await this.generator.generate(id); // (re)generate to reflect latest content/status
    }
    const url = await this.s3.presignGet(key, SIGNED_URL_TTL_SECONDS);
    await this.audit(actor.id, 'report.pdf_generated', id);
    return { url, expires_in: SIGNED_URL_TTL_SECONDS };
  }

  // ================= helpers =================
  private async replaceTextItems(tx: Prisma.TransactionClient, reportId: string, label: ReportItemLabel, values?: string[]) {
    if (values === undefined) return;
    await tx.serviceReportItem.deleteMany({ where: { reportId, label } });
    const clean = values.map((v) => v.trim()).filter(Boolean);
    if (clean.length) await tx.serviceReportItem.createMany({ data: clean.map((value) => ({ reportId, label, value })) });
  }

  private async replacePhotoItems(tx: Prisma.TransactionClient, reportId: string, label: ReportItemLabel, mediaIds: string[], actor: AuthenticatedUser) {
    await tx.serviceReportItem.deleteMany({ where: { reportId, label } });
    if (!mediaIds.length) return;
    const media = await tx.mediaFile.findMany({ where: { id: { in: mediaIds }, deletedAt: null }, select: { id: true, uploaderId: true } });
    const found = new Set(media.map((m) => m.id));
    for (const mid of mediaIds) {
      if (!found.has(mid)) throw new BadRequestException({ code: 'MEDIA_NOT_FOUND', message: `Media ${mid} not found` });
    }
    if (actor.role !== UserRole.ADMIN && media.some((m) => m.uploaderId !== actor.id)) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'You can only attach media you uploaded' });
    }
    await tx.serviceReportItem.createMany({ data: mediaIds.map((mediaId) => ({ reportId, label, mediaId })) });
  }

  private assertTransition(from: ReportStatus, to: ReportStatus) {
    if (!isReportTransitionAllowed(from, to)) {
      throw new BadRequestException({ code: 'INVALID_STATUS_TRANSITION', message: `Cannot move report ${from} → ${to}` });
    }
  }

  private async requireReport(id: string): Promise<ReportRow> {
    const report = await this.prisma.serviceReport.findFirst({ where: { id, deletedAt: null }, include: REPORT_INCLUDE });
    if (!report) throw new NotFoundException({ code: 'REPORT_NOT_FOUND', message: 'Report not found' });
    return report;
  }

  private async requireOwnedEditable(actor: AuthenticatedUser, id: string): Promise<ReportRow> {
    const report = await this.requireReport(id);
    const techId = await this.resolveTechnicianId(actor);
    if (actor.role !== UserRole.ADMIN && report.technicianId !== techId) {
      throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'This report is not assigned to you' });
    }
    if (!EDITABLE_STATUSES.includes(report.status)) {
      throw new BadRequestException({ code: 'INVALID_STATUS_TRANSITION', message: `A ${report.status} report cannot be edited` });
    }
    return report;
  }

  private async requireTechnicianForBooking(actor: AuthenticatedUser, bookingId: string): Promise<string> {
    const techId = await this.resolveTechnicianId(actor);
    if (!techId) throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Only the assigned technician can create a report' });
    const assigned = await this.prisma.technicianAssignment.findFirst({ where: { bookingId, technicianId: techId }, select: { id: true } });
    if (!assigned && actor.role !== UserRole.ADMIN) throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Booking is not assigned to you' });
    return techId;
  }

  private async assertCanView(actor: AuthenticatedUser, report: ReportRow) {
    if (actor.role === UserRole.ADMIN) return;
    if (actor.role === UserRole.TECHNICIAN && report.technicianId === (await this.resolveTechnicianId(actor))) return;
    if (actor.role === UserRole.CUSTOMER) {
      const cp = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (cp && report.booking.customerId === cp.id) return;
    }
    throw new ForbiddenException({ code: 'ACCESS_DENIED', message: 'Not authorized to view this report' });
  }

  private async scope(actor: AuthenticatedUser): Promise<Prisma.ServiceReportWhereInput> {
    if (actor.role === UserRole.ADMIN) return {};
    if (actor.role === UserRole.TECHNICIAN) {
      const techId = await this.resolveTechnicianId(actor);
      return { technicianId: techId ?? '00000000-0000-0000-0000-000000000000' };
    }
    if (actor.role === UserRole.CUSTOMER) {
      const cp = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      return { booking: { customerId: cp?.id ?? '00000000-0000-0000-0000-000000000000' } };
    }
    return { id: '00000000-0000-0000-0000-000000000000' };
  }

  private async resolveTechnicianId(actor: AuthenticatedUser): Promise<string | null> {
    const p = await this.prisma.technicianProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    return p?.id ?? null;
  }

  private audit(actorId: string, action: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType: 'service_report', entityId, metadata } });
  }

  private toView(r: ReportRow, hasSignature: boolean): ServiceReportView {
    const by = (label: string) => r.items.filter((i) => i.label === label);
    return {
      id: r.id, booking_id: r.bookingId, technician_id: r.technicianId, status: r.status,
      summary: r.summary, recommendations: r.recommendations,
      findings: by(ReportItemLabel.FINDING).map((i) => i.value ?? '').filter(Boolean),
      services: by(ReportItemLabel.SERVICE).map((i) => i.value ?? '').filter(Boolean),
      chemicals: by(ReportItemLabel.CHEMICAL).map((i) => ({ chemicalName: i.chemicalName ?? '', quantity: i.quantity, area_notes: i.value })),
      before_photo_media_ids: by(ReportItemLabel.BEFORE_PHOTO).map((i) => i.mediaId!).filter(Boolean),
      after_photo_media_ids: by(ReportItemLabel.AFTER_PHOTO).map((i) => i.mediaId!).filter(Boolean),
      safety_notes: by(ReportItemLabel.SAFETY_NOTE).map((i) => i.value ?? '').filter(Boolean),
      regulatory_notes: by(ReportItemLabel.REGULATORY_NOTE).map((i) => i.value ?? '').filter(Boolean),
      has_signature: hasSignature,
      submitted_at: r.submittedAt, created_at: r.createdAt, updated_at: r.updatedAt,
    };
  }
}
