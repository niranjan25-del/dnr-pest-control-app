// src/modules/invoices/tax.service.ts
//
// Tax calculation framework (additive to the listed structure, per the "Tax Calculation
// Framework" requirement). Region-keyed configurable rates → future multi-region support.
// Currently sources rates from enums/TAX_RATES; swap to ConfigService/DB without touching
// callers.

import { Injectable } from "@nestjs/common";
import { TAX_RATES } from "./enums";

export interface TaxResult {
  label: string;
  rate: number;
  amount: number;
}

@Injectable()
export class TaxService {
  /** Compute tax on the post-discount taxable amount for a region (ISO-2). */
  calculate(taxableAmount: number, region = "IN"): TaxResult {
    const cfg = TAX_RATES[region?.toUpperCase()] ?? TAX_RATES.DEFAULT;
    const amount =
      Math.round(Math.max(0, taxableAmount) * cfg.rate * 100) / 100;
    return { label: cfg.label, rate: cfg.rate, amount };
  }
}
