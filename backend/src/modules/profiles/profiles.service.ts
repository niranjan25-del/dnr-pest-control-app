// src/modules/profiles/profiles.service.ts
//
// Customer + technician profile CRUD, keyed by the authenticated user's id (callers manage
// only their OWN profile). Technician updates can flip availability and (re)assign existing
// ServiceArea rows to the technician. Profile updates are logged.

import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateCustomerProfileDto, CreateTechnicianProfileDto, UpdateCustomerProfileDto,
  UpdateTechnicianProfileDto,
} from './dto';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------- Customer ----------
  async createCustomerProfile(userId: string, dto: CreateCustomerProfileDto) {
    const existing = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException({ code: 'PROFILE_EXISTS', message: 'Customer profile already exists' });
    }
    const profile = await this.prisma.customerProfile.create({
      data: { userId, customerType: dto.customerType, companyName: dto.companyName },
    });
    this.logger.log(`Customer profile created for user ${userId}`);
    return profile;
  }

  async updateCustomerProfile(userId: string, dto: UpdateCustomerProfileDto) {
    await this.ensureCustomer(userId);
    const profile = await this.prisma.customerProfile.update({
      where: { userId },
      data: { customerType: dto.customerType, companyName: dto.companyName },
    });
    this.logger.log(`Customer profile updated for user ${userId}`);
    return profile;
  }

  async getCustomerProfile(userId: string) {
    const profile = await this.prisma.customerProfile.findFirst({
      where: { userId, deletedAt: null },
      include: { addresses: { where: { deletedAt: null } } },
    });
    if (!profile) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Customer profile not found' });
    return profile;
  }

  // ---------- Technician ----------
  async createTechnicianProfile(userId: string, dto: CreateTechnicianProfileDto) {
    const existing = await this.prisma.technicianProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException({ code: 'PROFILE_EXISTS', message: 'Technician profile already exists' });
    }
    const profile = await this.prisma.technicianProfile.create({
      data: {
        userId,
        licenseNumber: dto.licenseNumber,
        licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
        skills: dto.skills ?? [],
      },
    });
    this.logger.log(`Technician profile created for user ${userId}`);
    return profile;
  }

  async updateTechnicianProfile(userId: string, dto: UpdateTechnicianProfileDto) {
    const profile = await this.ensureTechnician(userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.technicianProfile.update({
        where: { userId },
        data: {
          licenseNumber: dto.licenseNumber,
          licenseExpiry: dto.licenseExpiry ? new Date(dto.licenseExpiry) : undefined,
          skills: dto.skills,
          isAvailable: dto.isAvailable,
        },
      });
      // Re-assign service areas: clear previously-owned, then claim the requested set.
      if (dto.serviceAreaIds) {
        await tx.serviceArea.updateMany({
          where: { technicianId: profile.id, id: { notIn: dto.serviceAreaIds } },
          data: { technicianId: null },
        });
        if (dto.serviceAreaIds.length) {
          await tx.serviceArea.updateMany({
            where: { id: { in: dto.serviceAreaIds } },
            data: { technicianId: profile.id },
          });
        }
      }
      return p;
    });

    this.logger.log(`Technician profile updated for user ${userId}`);
    return this.getTechnicianProfile(userId);
  }

  async getTechnicianProfile(userId: string) {
    const profile = await this.prisma.technicianProfile.findFirst({
      where: { userId, deletedAt: null },
      include: { serviceAreas: true },
    });
    if (!profile) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Technician profile not found' });
    return profile;
  }

  // ---------- helpers ----------
  private async ensureCustomer(userId: string) {
    const p = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Customer profile not found' });
    return p;
  }

  private async ensureTechnician(userId: string) {
    const p = await this.prisma.technicianProfile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Technician profile not found' });
    return p;
  }
}
