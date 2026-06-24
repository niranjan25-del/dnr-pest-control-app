// src/modules/analytics/export.service.ts
//
// Renders a ReportEnvelope to CSV, Excel (exceljs), or PDF (pdfkit), stores it privately in S3
// (reusing the media S3Service), and returns a short-lived presigned download URL. Keeps export
// output identical in structure to the JSON reports.

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import * as ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { randomUUID } from "crypto";
import { S3Service } from "../media/s3.service";
import { ExportFormat } from "./enums";
import { ReportEnvelope } from "./interfaces";

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  constructor(private readonly s3: S3Service) {}

  async export(
    report: ReportEnvelope,
    format: ExportFormat,
  ): Promise<{ url: string; expires_in: number; format: ExportFormat }> {
    let buffer: Buffer;
    let ext: string;
    let contentType: string;
    try {
      if (format === ExportFormat.CSV) {
        buffer = this.toCsv(report);
        ext = "csv";
        contentType = "text/csv";
      } else if (format === ExportFormat.EXCEL) {
        buffer = await this.toExcel(report);
        ext = "xlsx";
        contentType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else {
        buffer = await this.toPdf(report);
        ext = "pdf";
        contentType = "application/pdf";
      }
    } catch (err) {
      this.logger.error(`Export render failed: ${(err as Error).message}`);
      throw new InternalServerErrorException({
        code: "EXPORT_FAILURE",
        message: "Failed to render the export",
      });
    }
    const key = `analytics/exports/${randomUUID()}.${ext}`;
    await this.s3.putObject(key, buffer, contentType);
    const url = await this.s3.presignGet(key, 300);
    return { url, expires_in: 300, format };
  }

  private toCsv(report: ReportEnvelope): Buffer {
    const lines: string[] = [
      report.title,
      `Generated,${report.generated_at.toISOString()}`,
      `Range,${report.range.from},${report.range.to}`,
      "",
    ];
    for (const section of report.sections) {
      lines.push(section.heading);
      lines.push(section.columns.map(this.csvCell).join(","));
      for (const row of section.rows)
        lines.push(row.map((c) => this.csvCell(String(c))).join(","));
      lines.push("");
    }
    return Buffer.from(lines.join("\n"), "utf8");
  }

  private csvCell(v: string): string {
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  private async toExcel(report: ReportEnvelope): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "DNR Pest Control";
    for (const section of report.sections) {
      const ws = wb.addWorksheet(section.heading.slice(0, 28) || "Sheet");
      ws.addRow(section.columns).font = { bold: true };
      section.rows.forEach((r) => ws.addRow(r));
      ws.columns.forEach((c) => {
        c.width = 22;
      });
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private toPdf(report: ReportEnvelope): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.fillColor("#1E8E5A").fontSize(18).text(report.title, 50, 50);
      doc
        .fillColor("#666")
        .fontSize(9)
        .text(
          `Generated ${report.generated_at.toISOString().slice(0, 16).replace("T", " ")}  •  ${report.range.from.slice(0, 10)} → ${report.range.to.slice(0, 10)}`,
        );
      let y = 90;
      for (const section of report.sections) {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        doc.fillColor("#1E8E5A").fontSize(12).text(section.heading, 50, y);
        y += 18;
        doc
          .fillColor("#111")
          .fontSize(8)
          .text(section.columns.join("   |   "), 50, y);
        y += 14;
        doc.fillColor("#333");
        for (const row of section.rows) {
          if (y > 760) {
            doc.addPage();
            y = 50;
          }
          doc.text(row.map((c) => String(c)).join("   |   "), 50, y, {
            width: 495,
          });
          y = doc.y + 4;
        }
        y += 10;
      }
      doc.end();
    });
  }
}
