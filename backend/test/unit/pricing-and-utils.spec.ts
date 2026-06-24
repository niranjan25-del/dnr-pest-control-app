// test/unit/pricing-and-utils.spec.ts
//
// Pure financial + utility logic: coupon discount, GST tax, pagination envelope, and geo
// radius. Deterministic and high-value — money math and distance gating are where silent
// bugs hurt most.

import { DiscountType } from "@prisma/client";
import { computeDiscount } from "src/modules/promotions/coupons/enums";
import { TaxService } from "src/modules/invoices/tax.service";
import { paginate } from "src/common/utils/pagination.util";
import { haversineKm, isWithinRadius } from "src/common/utils/geo.util";

describe("computeDiscount", () => {
  it("applies a percentage discount and rounds to 2dp", () => {
    expect(computeDiscount(DiscountType.PERCENTAGE, 10, 1500)).toBe(150);
    expect(computeDiscount(DiscountType.PERCENTAGE, 33, 99.99)).toBe(33);
  });

  it("applies a fixed discount", () => {
    expect(computeDiscount(DiscountType.FIXED, 200, 1500)).toBe(200);
  });

  it("never exceeds the base amount (a 100% coupon = free, not negative)", () => {
    expect(computeDiscount(DiscountType.PERCENTAGE, 100, 1500)).toBe(1500);
    expect(computeDiscount(DiscountType.FIXED, 5000, 1500)).toBe(1500);
  });

  it("returns 0 for a non-positive base", () => {
    expect(computeDiscount(DiscountType.PERCENTAGE, 10, 0)).toBe(0);
    expect(computeDiscount(DiscountType.FIXED, 100, -50)).toBe(0);
  });
});

describe("TaxService", () => {
  const tax = new TaxService();

  it("computes 18% GST for India and rounds to 2dp", () => {
    const r = tax.calculate(1500, "IN");
    expect(r).toEqual({ label: "GST", rate: 0.18, amount: 270 });
  });

  it("falls back to the DEFAULT rate for an unknown region", () => {
    expect(tax.calculate(100, "ZZ").amount).toBe(18);
  });

  it("clamps a negative taxable amount to 0", () => {
    expect(tax.calculate(-100).amount).toBe(0);
  });
});

describe("paginate", () => {
  it("wraps rows with a correct meta envelope", () => {
    const result = paginate([{ id: 1 }, { id: 2 }], 42, 2, 20);
    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 42,
      total_pages: 3,
    });
  });

  it("reports 0 pages when limit is 0", () => {
    expect(paginate([], 0, 1, 0).meta.total_pages).toBe(0);
  });
});

describe("geo utilities", () => {
  it("measures ~0 km between identical points", () => {
    expect(haversineKm(12.97, 77.59, 12.97, 77.59)).toBeCloseTo(0, 5);
  });

  it("measures a realistic distance across Bengaluru (a few km)", () => {
    const d = haversineKm(12.9716, 77.5946, 12.9352, 77.6245); // ~5 km
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(8);
  });

  it("gates a point inside vs outside a service radius", () => {
    const center = { lat: 12.97, lng: 77.59 };
    expect(isWithinRadius({ lat: 12.975, lng: 77.595 }, center, 5)).toBe(true);
    expect(isWithinRadius({ lat: 13.2, lng: 77.9 }, center, 5)).toBe(false);
  });
});
