// src/modules/reviews/reviews.service.ts
// Review list + moderation. Admins see all; filtering by status. Status transitions:
// PENDING → PUBLISHED (visible to users) or HIDDEN (suppressed). FLAGGED marks for follow-up.

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination.util';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { AuthenticatedUser } from '../auth/interfaces/auth.interfaces';

export class ReviewFilterDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ReviewFilterDto) {
    const where: Prisma.ReviewWhereInput = {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search ? {
        OR: [
          { comment: { contains: filter.search, mode: 'insensitive' } },
          { customer: { user: { fullName: { contains: filter.search, mode: 'insensitive' } } } },
          { technician: { user: { fullName: { contains: filter.search, mode: 'insensitive' } } } },
        ],
      } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: {
          customer: { select: { user: { select: { fullName: true } } } },
          technician: { select: { user: { select: { fullName: true } } } },
        },
        orderBy: { createdAt: filter.order },
        skip: filter.skip,
        take: filter.limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return paginate(
      rows.map((r) => ({
        id: r.id,
        booking_id: r.bookingId,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        customer_name: r.customer?.user?.fullName ?? null,
        technician_name: r.technician?.user?.fullName ?? null,
        created_at: r.createdAt,
      })),
      total,
      filter.page,
      filter.limit,
    );
  }

  async submitReview(actor: AuthenticatedUser, dto: { booking_id: string; rating: number; comment?: string }) {
    const cp = await this.prisma.customerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!cp) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Customer profile not found' });

    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.booking_id, customerId: cp.id, deletedAt: null },
      select: { id: true },
    });
    if (!booking) throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });

    const existing = await this.prisma.review.findFirst({ where: { bookingId: dto.booking_id } });
    if (existing) throw new ConflictException({ code: 'REVIEW_EXISTS', message: 'A review already exists for this booking' });

    const assignment = await this.prisma.technicianAssignment.findFirst({
      where: { bookingId: dto.booking_id },
      orderBy: { createdAt: 'desc' },
      select: { technicianId: true },
    });

    const review = await this.prisma.review.create({
      data: {
        bookingId: dto.booking_id,
        customerId: cp.id,
        technicianId: assignment?.technicianId ?? null,
        rating: dto.rating,
        comment: dto.comment ?? null,
        status: ReviewStatus.PENDING,
      },
    });

    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'review.submitted', entityType: 'review', entityId: review.id },
    });

    return {
      id: review.id,
      booking_id: review.bookingId,
      rating: review.rating,
      comment: review.comment,
      is_published: review.status === ReviewStatus.PUBLISHED,
      status: review.status,
      created_at: review.createdAt,
    };
  }

  async moderate(id: string, actorId: string, status: ReviewStatus) {
    const review = await this.prisma.review.findUnique({ where: { id }, select: { id: true } });
    if (!review) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Review not found' });

    const updated = await this.prisma.review.update({ where: { id }, data: { status } });
    await this.prisma.auditLog.create({
      data: { actorId, action: `review.${status.toLowerCase()}`, entityType: 'review', entityId: id },
    });
    return { id: updated.id, status: updated.status };
  }
}
