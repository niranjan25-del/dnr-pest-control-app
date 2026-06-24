// src/modules/addresses/addresses.service.ts
//
// Customer address management. Each caller manages only their own addresses (resolved from
// their CustomerProfile). On create/update, coordinates are geocoded when missing (and
// geocoding is enabled). Exactly one default address per customer is enforced in a
// transaction. Eligibility delegates to ServiceAreasService (postal coverage). Also exposes
// assertBookableAddress() for the booking flow to reuse.

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import { AuthenticatedUser } from "../auth/interfaces/auth.interfaces";
import { ServiceAreasService } from "../service-areas/service-areas.service";
import { CreateAddressDto, UpdateAddressDto } from "./dto";
import { GeocodingService } from "./geocoding.service";
import { EligibilityResult } from "./interfaces";

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
    private readonly serviceAreas: ServiceAreasService,
  ) {}

  // ---------- Create ----------
  async create(actor: AuthenticatedUser, dto: CreateAddressDto) {
    const customerId = await this.resolveCustomerId(actor);
    const coords = await this.ensureCoordinates(dto);

    const address = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.address.count({
        where: { customerId, deletedAt: null },
      });
      const makeDefault = dto.isDefault || existingCount === 0; // first address is default
      if (makeDefault) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          customerId,
          label: dto.label,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          country: dto.country ?? "IN",
          accessNotes: dto.accessNotes,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          isDefault: makeDefault,
        },
      });
    });
    this.logger.log(`Address ${address.id} created for customer ${customerId}`);
    return address;
  }

  // ---------- Update ----------
  async update(id: string, actor: AuthenticatedUser, dto: UpdateAddressDto) {
    const customerId = await this.resolveCustomerId(actor);
    const current = await this.requireOwned(id, customerId);

    // Re-geocode if any location-affecting field changed and coords weren't explicitly given.
    let coords: { latitude: number; longitude: number } | undefined;
    const locationChanged =
      dto.line1 || dto.city || dto.state || dto.postalCode || dto.country;
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      coords = { latitude: dto.latitude, longitude: dto.longitude };
    } else if (locationChanged) {
      const geo = await this.ensureCoordinates({
        line1: dto.line1 ?? current.line1,
        city: dto.city ?? current.city,
        state: dto.state ?? current.state,
        postalCode: dto.postalCode ?? current.postalCode,
        country: dto.country ?? current.country,
      });
      if (geo) coords = geo;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.address.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id },
        data: {
          label: dto.label,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          country: dto.country,
          accessNotes: dto.accessNotes,
          ...(coords
            ? { latitude: coords.latitude, longitude: coords.longitude }
            : {}),
          ...(dto.isDefault === true ? { isDefault: true } : {}),
        },
      });
    });
    this.logger.log(`Address ${id} updated`);
    return updated;
  }

  // ---------- Delete (soft) ----------
  async remove(id: string, actor: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(actor);
    const current = await this.requireOwned(id, customerId);

    await this.prisma.$transaction(async (tx) => {
      await tx.address.update({
        where: { id },
        data: { deletedAt: new Date(), isDefault: false },
      });
      // Promote another address to default if we just removed the default one.
      if (current.isDefault) {
        const next = await tx.address.findFirst({
          where: { customerId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (next)
          await tx.address.update({
            where: { id: next.id },
            data: { isDefault: true },
          });
      }
    });
    this.logger.warn(`Address ${id} deleted`);
    return { success: true };
  }

  // ---------- Set default ----------
  async setDefault(id: string, actor: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(actor);
    await this.requireOwned(id, customerId);
    await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.findOne(id, actor);
  }

  // ---------- Reads ----------
  async findOne(id: string, actor: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(actor);
    return this.requireOwned(id, customerId);
  }

  async list(actor: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(actor);
    return this.prisma.address.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  // ---------- Eligibility / booking support ----------
  async checkEligibility(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<EligibilityResult> {
    const customerId = await this.resolveCustomerId(actor);
    const address = await this.requireOwned(id, customerId);
    const coverage = await this.serviceAreas.checkCoverage(address.postalCode);
    return {
      address_id: address.id,
      postal_code: address.postalCode,
      covered: coverage.covered,
      areas: coverage.areas,
      coordinates:
        address.latitude && address.longitude
          ? {
              latitude: Number(address.latitude),
              longitude: Number(address.longitude),
            }
          : null,
    };
  }

  /** Reusable guard for the booking flow: address exists, belongs to the customer, and is in
   *  a covered service area. Returns the address. */
  async assertBookableAddress(addressId: string, customerId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, customerId, deletedAt: null },
    });
    if (!address)
      throw new BadRequestException({
        code: "ADDRESS_NOT_FOUND",
        message: "Address not found for this customer",
      });
    const coverage = await this.serviceAreas.checkCoverage(address.postalCode);
    if (!coverage.covered) {
      throw new BadRequestException({
        code: "OUT_OF_SERVICE_AREA",
        message: "We do not currently service this address",
      });
    }
    return address;
  }

  // ---------- helpers ----------
  private async ensureCoordinates(parts: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{ latitude: number; longitude: number } | undefined> {
    if (parts.latitude !== undefined && parts.longitude !== undefined) {
      return { latitude: parts.latitude, longitude: parts.longitude };
    }
    const line = [
      parts.line1,
      parts.city,
      parts.state,
      parts.postalCode,
      parts.country ?? "IN",
    ]
      .filter(Boolean)
      .join(", ");
    const geo = await this.geocoding.geocode(line); // null if geocoding disabled
    return geo
      ? { latitude: geo.latitude, longitude: geo.longitude }
      : undefined;
  }

  private async resolveCustomerId(actor: AuthenticatedUser): Promise<string> {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!profile)
      throw new BadRequestException({
        code: "PROFILE_NOT_FOUND",
        message: "Customer profile required",
      });
    return profile.id;
  }

  private async requireOwned(id: string, customerId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, customerId, deletedAt: null },
    });
    if (!address)
      throw new NotFoundException({
        code: "ADDRESS_NOT_FOUND",
        message: "Address not found",
      });
    return address;
  }
}
