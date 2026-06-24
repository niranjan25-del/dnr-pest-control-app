// src/modules/invoices/invoice-number.service.ts
//
// Sequential invoice numbers: DNR-YYYY-NNNNNN (e.g. DNR-2026-000001).
//
// Implementation: count existing invoices for the year and take count+1. The unique
// constraint on invoiceNumber prevents duplicates; the caller retries on collision. This is
// correct but can leave gaps and is best-effort under high concurrency.
//
// ⚠ ROBUST UPGRADE (recommended for production): a Postgres SEQUENCE per year (or an atomic
// counter row) guarantees gap-free, race-free numbering. That needs a tiny schema/migration
// addition; flagged rather than silently relying on count+retry at scale.

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";

@Injectable()
export class InvoiceNumberService {
  constructor(private readonly prisma: PrismaService) {}

  private format(year: number, seq: number): string {
    return `DNR-${year}-${String(seq).padStart(6, "0")}`;
  }

  /** Next candidate number for the given year (count-based). */
  async next(
    year = new Date().getUTCFullYear(),
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const count = await client.invoice.count({
      where: { invoiceNumber: { startsWith: `DNR-${year}-` } },
    });
    return this.format(year, count + 1);
  }

  /**
   * Create an invoice with a unique number, retrying on collision. `create` receives the
   * candidate number and must perform the actual prisma.invoice.create.
   */
  async createWithNumber<T>(
    create: (invoiceNumber: string) => Promise<T>,
  ): Promise<T> {
    const year = new Date().getUTCFullYear();
    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await this.prisma.invoice.count({
        where: { invoiceNumber: { startsWith: `DNR-${year}-` } },
      });
      const candidate = this.format(year, count + 1 + attempt);
      try {
        return await create(candidate);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        )
          continue; // collision → retry
        throw err;
      }
    }
    // Final fallback: timestamp-suffixed to guarantee uniqueness.
    return create(`DNR-${year}-${Date.now().toString().slice(-6)}`);
  }
}
