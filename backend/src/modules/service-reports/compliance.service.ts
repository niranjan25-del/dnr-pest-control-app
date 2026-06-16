// src/modules/service-reports/compliance.service.ts
//
// Compliance reporting over chemical-usage items. Aggregates chemical entries across submitted/
// approved reports for regulatory review and audits.
//
// ⚠ NOTE: quantity is a free-form string ("50 ml") in the schema, so totals can't be summed
// numerically reliably — this reports per-chemical entry counts + the raw quantities. For true
// regulatory totals, store quantity as a number + unit (schema change, flagged).

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { ReportItemLabel } from './enums';

export interface ChemicalUsageRow {
  chemical_name: string;
  entries: number;
  reports: number;
  quantities: string[];
}

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async chemicalUsage(params: { from?: string; to?: string; technicianId?: string }): Promise<ChemicalUsageRow[]> {
    const where: Prisma.ServiceReportItemWhereInput = {
      label: ReportItemLabel.CHEMICAL,
      report: {
        deletedAt: null,
        ...(params.technicianId ? { technicianId: params.technicianId } : {}),
        ...(params.from || params.to
          ? { createdAt: { ...(params.from ? { gte: new Date(params.from) } : {}), ...(params.to ? { lte: new Date(params.to) } : {}) } }
          : {}),
      },
    };
    const items = await this.prisma.serviceReportItem.findMany({ where, select: { chemicalName: true, quantity: true, reportId: true } });

    const map = new Map<string, { entries: number; reports: Set<string>; quantities: string[] }>();
    for (const it of items) {
      const name = it.chemicalName ?? 'Unspecified';
      const agg = map.get(name) ?? { entries: 0, reports: new Set<string>(), quantities: [] };
      agg.entries++;
      agg.reports.add(it.reportId);
      if (it.quantity) agg.quantities.push(it.quantity);
      map.set(name, agg);
    }
    return [...map.entries()].map(([chemical_name, a]) => ({
      chemical_name, entries: a.entries, reports: a.reports.size, quantities: a.quantities,
    }));
  }
}
