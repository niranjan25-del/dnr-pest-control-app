// src/modules/invoices/pdf-generator.service.ts
//
// Renders an InvoicePdfData into a PDF Buffer using pdfkit + the invoice template. Buffers the
// document in memory (invoices are small) and resolves the complete Buffer.

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import PDFDocument = require("pdfkit");
import { renderInvoice } from "./templates/invoice.template";
import { InvoicePdfData } from "./interfaces";

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  generate(data: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (e) => reject(e));
        renderInvoice(doc, data);
        doc.end();
      } catch (err) {
        this.logger.error(`PDF generation failed: ${(err as Error).message}`);
        reject(
          new InternalServerErrorException({
            code: "INVOICE_GENERATION_FAILED",
            message: "Could not generate the invoice PDF",
          }),
        );
      }
    });
  }
}
