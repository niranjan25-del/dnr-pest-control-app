// src/modules/invoices/invoices.module.ts
//
// Exports InvoicesService so the payment success path (Step 9) can trigger PDF generation
// after an invoice is marked PAID, and StorageService for reuse.

import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceNumberService } from "./invoice-number.service";
import { PdfGeneratorService } from "./pdf-generator.service";
import { StorageService } from "./storage.service";
import { TaxService } from "./tax.service";

@Module({
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceNumberService,
    PdfGeneratorService,
    StorageService,
    TaxService,
  ],
  exports: [InvoicesService, InvoiceNumberService, TaxService],
})
export class InvoicesModule {}
