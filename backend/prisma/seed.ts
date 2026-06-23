import { PrismaClient, BillingCycle, DiscountType, UserRole, AdminRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Seeding database...');

  // ── Pest categories ──────────────────────────────────────────────────────────
  const pestCategories = await Promise.all([
    prisma.pestCategory.upsert({
      where: { slug: 'cockroaches' },
      update: {},
      create: { name: 'Cockroaches', slug: 'cockroaches', description: 'German, American, and Oriental cockroach control', isActive: true },
    }),
    prisma.pestCategory.upsert({
      where: { slug: 'termites' },
      update: {},
      create: { name: 'Termites', slug: 'termites', description: 'Subterranean and dry-wood termite elimination', isActive: true },
    }),
    prisma.pestCategory.upsert({
      where: { slug: 'rodents' },
      update: {},
      create: { name: 'Rodents', slug: 'rodents', description: 'Rat and mouse control and exclusion', isActive: true },
    }),
    prisma.pestCategory.upsert({
      where: { slug: 'ants' },
      update: {},
      create: { name: 'Ants', slug: 'ants', description: 'Fire ant, carpenter ant, and trail ant control', isActive: true },
    }),
    prisma.pestCategory.upsert({
      where: { slug: 'mosquitoes' },
      update: {},
      create: { name: 'Mosquitoes', slug: 'mosquitoes', description: 'Mosquito fogging and breeding-site elimination', isActive: true },
    }),
    prisma.pestCategory.upsert({
      where: { slug: 'bed-bugs' },
      update: {},
      create: { name: 'Bed Bugs', slug: 'bed-bugs', description: 'Heat and chemical bed bug treatment', isActive: true },
    }),
    prisma.pestCategory.upsert({
      where: { slug: 'spiders' },
      update: {},
      create: { name: 'Spiders', slug: 'spiders', description: 'Spider web removal and preventive spray', isActive: true },
    }),
  ]);
  console.log(`  ✓ ${pestCategories.length} pest categories`);

  // ── Service categories ───────────────────────────────────────────────────────
  const [catResidential, catCommercial, catInspection] = await Promise.all([
    prisma.serviceCategory.upsert({
      where: { slug: 'residential' },
      update: {},
      create: { name: 'Residential', slug: 'residential', description: 'Home pest control services', isActive: true, sortOrder: 1 },
    }),
    prisma.serviceCategory.upsert({
      where: { slug: 'commercial' },
      update: {},
      create: { name: 'Commercial', slug: 'commercial', description: 'Business and industrial pest management', isActive: true, sortOrder: 2 },
    }),
    prisma.serviceCategory.upsert({
      where: { slug: 'inspection' },
      update: {},
      create: { name: 'Inspection & Assessment', slug: 'inspection', description: 'Pest risk assessments and pre-treatment surveys', isActive: true, sortOrder: 3 },
    }),
  ]);
  console.log('  ✓ 3 service categories');

  const [pestCockroach, pestTermite, pestRodent, pestAnt, pestMosquito, pestBedBug] = pestCategories;

  // ── Services ─────────────────────────────────────────────────────────────────
  const services = await Promise.all([
    prisma.service.upsert({
      where: { slug: 'general-pest-control' },
      update: {},
      create: {
        name: 'General Pest Control', slug: 'general-pest-control',
        description: 'Comprehensive spray treatment covering cockroaches, ants, spiders and common crawling insects.',
        basePrice: 799, currency: 'INR', estimatedDurationMin: 60,
        isActive: true, categoryId: catResidential.id, pestCategoryId: pestCockroach.id,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'termite-treatment' },
      update: {},
      create: {
        name: 'Termite Treatment', slug: 'termite-treatment',
        description: 'Soil treatment and bait-station installation for subterranean termite colonies.',
        basePrice: 3499, currency: 'INR', estimatedDurationMin: 180,
        isActive: true, categoryId: catResidential.id, pestCategoryId: pestTermite.id,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'rodent-control' },
      update: {},
      create: {
        name: 'Rodent Control', slug: 'rodent-control',
        description: 'Baiting, trapping, and entry-point exclusion for rats and mice.',
        basePrice: 1299, currency: 'INR', estimatedDurationMin: 90,
        isActive: true, categoryId: catResidential.id, pestCategoryId: pestRodent.id,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'mosquito-fogging' },
      update: {},
      create: {
        name: 'Mosquito Fogging', slug: 'mosquito-fogging',
        description: 'ULV cold-fogging to eliminate adult mosquitoes and larvae.',
        basePrice: 999, currency: 'INR', estimatedDurationMin: 45,
        isActive: true, categoryId: catResidential.id, pestCategoryId: pestMosquito.id,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'bed-bug-treatment' },
      update: {},
      create: {
        name: 'Bed Bug Treatment', slug: 'bed-bug-treatment',
        description: 'Chemical spray and steam treatment for bed frames, mattresses, and furniture.',
        basePrice: 2499, currency: 'INR', estimatedDurationMin: 120,
        isActive: true, categoryId: catResidential.id, pestCategoryId: pestBedBug.id,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'ant-control' },
      update: {},
      create: {
        name: 'Ant Control', slug: 'ant-control',
        description: 'Gel-bait and perimeter spray targeting fire ants, carpenter ants, and trail ants.',
        basePrice: 699, currency: 'INR', estimatedDurationMin: 45,
        isActive: true, categoryId: catResidential.id, pestCategoryId: pestAnt.id,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'commercial-pest-management' },
      update: {},
      create: {
        name: 'Commercial Pest Management', slug: 'commercial-pest-management',
        description: 'Monthly/quarterly pest management programme for restaurants, offices, and warehouses.',
        basePrice: 4999, currency: 'INR', estimatedDurationMin: 120,
        isActive: true, categoryId: catCommercial.id,
      },
    }),
    prisma.service.upsert({
      where: { slug: 'pre-purchase-inspection' },
      update: {},
      create: {
        name: 'Pre-Purchase Inspection', slug: 'pre-purchase-inspection',
        description: 'Full pest and termite inspection with written report for property buyers.',
        basePrice: 1499, currency: 'INR', estimatedDurationMin: 90,
        isActive: true, categoryId: catInspection.id,
      },
    }),
  ]);
  console.log(`  ✓ ${services.length} services`);

  // ── Service packages ─────────────────────────────────────────────────────────
  const [svcGeneral, svcTermite, svcRodent, svcMosquito] = services;

  const pkgHomeShield = await prisma.servicePackage.upsert({
    where: { slug: 'home-shield-combo' },
    update: {},
    create: {
      name: 'Home Shield Combo', slug: 'home-shield-combo',
      description: 'General Pest Control + Ant Control in one visit. Best for new homes.',
      price: 1299, currency: 'INR', isActive: true,
    },
  });

  const pkgCompleteProtection = await prisma.servicePackage.upsert({
    where: { slug: 'complete-protection' },
    update: {},
    create: {
      name: 'Complete Protection', slug: 'complete-protection',
      description: 'Termite + Rodent + General Pest in one comprehensive treatment.',
      price: 4999, currency: 'INR', isActive: true,
    },
  });

  // PackageService join rows (idempotent via composite PK)
  await Promise.all([
    prisma.packageService.upsert({
      where: { packageId_serviceId: { packageId: pkgHomeShield.id, serviceId: svcGeneral.id } },
      update: {}, create: { packageId: pkgHomeShield.id, serviceId: svcGeneral.id, quantity: 1 },
    }),
    prisma.packageService.upsert({
      where: { packageId_serviceId: { packageId: pkgHomeShield.id, serviceId: services[5].id } },
      update: {}, create: { packageId: pkgHomeShield.id, serviceId: services[5].id, quantity: 1 },
    }),
    prisma.packageService.upsert({
      where: { packageId_serviceId: { packageId: pkgCompleteProtection.id, serviceId: svcGeneral.id } },
      update: {}, create: { packageId: pkgCompleteProtection.id, serviceId: svcGeneral.id, quantity: 1 },
    }),
    prisma.packageService.upsert({
      where: { packageId_serviceId: { packageId: pkgCompleteProtection.id, serviceId: svcTermite.id } },
      update: {}, create: { packageId: pkgCompleteProtection.id, serviceId: svcTermite.id, quantity: 1 },
    }),
    prisma.packageService.upsert({
      where: { packageId_serviceId: { packageId: pkgCompleteProtection.id, serviceId: svcRodent.id } },
      update: {}, create: { packageId: pkgCompleteProtection.id, serviceId: svcRodent.id, quantity: 1 },
    }),
  ]);
  console.log('  ✓ 2 service packages');

  // ── Subscription plans ───────────────────────────────────────────────────────
  await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { slug: 'monthly-basic' },
      update: {},
      create: {
        name: 'Monthly Basic', slug: 'monthly-basic',
        description: 'One general pest control visit per month.',
        price: 699, currency: 'INR', billingCycle: BillingCycle.MONTHLY, visitsPerCycle: 1, isActive: true,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { slug: 'quarterly-standard' },
      update: {},
      create: {
        name: 'Quarterly Standard', slug: 'quarterly-standard',
        description: 'One visit every 3 months covering general pests and mosquitoes.',
        price: 1799, currency: 'INR', billingCycle: BillingCycle.QUARTERLY, visitsPerCycle: 1, isActive: true,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { slug: 'annual-premium' },
      update: {},
      create: {
        name: 'Annual Premium', slug: 'annual-premium',
        description: 'Quarterly visits + annual termite inspection. Best value.',
        price: 5999, currency: 'INR', billingCycle: BillingCycle.YEARLY, visitsPerCycle: 4, isActive: true,
      },
    }),
  ]);
  console.log('  ✓ 3 subscription plans');

  // ── Welcome coupon ───────────────────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10', description: '10% off your first booking',
      discountType: DiscountType.PERCENTAGE, discountValue: 10,
      maxRedemptions: 1000, perUserLimit: 1,
      validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31'),
      isActive: true,
    },
  });
  await prisma.coupon.upsert({
    where: { code: 'FLAT200' },
    update: {},
    create: {
      code: 'FLAT200', description: '₹200 off on bookings above ₹999',
      discountType: DiscountType.FIXED, discountValue: 200,
      maxRedemptions: 500, perUserLimit: 1,
      validFrom: new Date('2024-01-01'), validUntil: new Date('2026-12-31'),
      isActive: true,
    },
  });
  console.log('  ✓ 2 coupons');

  // ── Admin user ───────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Nira@2000', BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: 'contact@dnrpestcontrol.in' },
    update: { status: UserStatus.ACTIVE },
    create: {
      email: 'contact@dnrpestcontrol.in',
      fullName: 'DNR Admin',
      phone: '+919000000001',
      role: UserRole.ADMIN,
      adminRole: AdminRole.SUPER_ADMIN,
      passwordHash: adminHash,
      emailVerified: true,
    },
  });
  console.log('  ✓ 1 admin (contact@dnrpestcontrol.in / Nira@2000)');

  // ── Test technician ──────────────────────────────────────────────────────────
  const techHash = await bcrypt.hash('Tech@1234', BCRYPT_ROUNDS);
  const techUser = await prisma.user.upsert({
    where: { email: 'tech@dnrpestcontrol.in' },
    update: {},
    create: {
      email: 'tech@dnrpestcontrol.in', fullName: 'Rajan Kumar',
      phone: '+919876543210', role: UserRole.TECHNICIAN,
      passwordHash: techHash, emailVerified: true,
    },
  });

  const techProfile = await prisma.technicianProfile.upsert({
    where: { userId: techUser.id },
    update: {},
    create: {
      userId: techUser.id, licenseNumber: 'TN-PEST-2024-001',
      licenseExpiry: new Date('2026-03-31'),
      skills: ['General Pest Control', 'Termite Treatment', 'Rodent Control', 'Mosquito Fogging'],
      isAvailable: true,
    },
  });

  // Service areas for the technician
  const existingArea = await prisma.serviceArea.findFirst({ where: { technicianId: techProfile.id } });
  if (!existingArea) {
    await prisma.serviceArea.createMany({
      data: [
        { name: 'Chennai Central', postalCodes: ['600001', '600002', '600003', '600005'], technicianId: techProfile.id },
        { name: 'Chennai South', postalCodes: ['600020', '600032', '600041', '600044'], technicianId: techProfile.id },
      ],
    });
  }
  console.log('  ✓ 1 technician (tech@dnrpestcontrol.in / Tech@1234)');

  // ── Test customer ────────────────────────────────────────────────────────────
  const custHash = await bcrypt.hash('Customer@1234', BCRYPT_ROUNDS);
  const custUser = await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      email: 'customer@test.com', fullName: 'Priya Sharma',
      phone: '+919876543211', role: UserRole.CUSTOMER,
      passwordHash: custHash, emailVerified: true,
    },
  });

  const custProfile = await prisma.customerProfile.upsert({
    where: { userId: custUser.id },
    update: {},
    create: { userId: custUser.id, customerType: 'RESIDENTIAL' },
  });

  const existingAddr = await prisma.address.findFirst({ where: { customerId: custProfile.id } });
  if (!existingAddr) {
    await prisma.address.create({
      data: {
        customerId: custProfile.id, label: 'Home',
        line1: '42, Anna Nagar East', city: 'Chennai',
        state: 'Tamil Nadu', postalCode: '600102', country: 'IN',
        isDefault: true,
      },
    });
  }
  console.log('  ✓ 1 customer (customer@test.com / Customer@1234)');

  console.log('\nSeed complete.');
  console.log('  Admin:      contact@dnrpestcontrol.in / Nira@2000');
  console.log('  Technician: tech@dnrpestcontrol.in   / Tech@1234');
  console.log('  Customer:   customer@test.com         / Customer@1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
