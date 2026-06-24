// src/modules/invoices/templates/invoice.template.ts
//
// Programmatic invoice layout rendered with pdfkit. Kept separate from the generator so the
// look can evolve independently of the buffering logic. Sections: header (company), invoice
// meta, bill-to, line-items table, totals (subtotal/discount/tax/total), payment, footer.

import type PDFDocument from "pdfkit";
import { COMPANY } from "./company";
import { InvoicePdfData } from "../interfaces";

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function renderInvoice(
  doc: typeof PDFDocument.prototype,
  data: InvoicePdfData,
): void {
  const left = 50;
  const right = 545;

  // --- Header ---
  doc.fillColor(COMPANY.brandColor).fontSize(22).text(COMPANY.name, left, 50);
  doc.fillColor("#666").fontSize(9).text(COMPANY.tagline, left, 76);
  doc.fillColor("#333").fontSize(8);
  COMPANY.addressLines.forEach((line, i) => doc.text(line, left, 96 + i * 12));
  doc.text(
    `${COMPANY.email}  •  ${COMPANY.phone}`,
    left,
    96 + COMPANY.addressLines.length * 12,
  );
  if (COMPANY.gstin)
    doc.text(
      `GSTIN: ${COMPANY.gstin}`,
      left,
      108 + COMPANY.addressLines.length * 12,
    );

  // --- Invoice meta (right aligned) ---
  doc
    .fillColor("#111")
    .fontSize(16)
    .text("INVOICE", right - 150, 50, { width: 150, align: "right" });
  doc
    .fontSize(9)
    .fillColor("#333")
    .text(`No: ${data.invoiceNumber}`, right - 200, 74, {
      width: 200,
      align: "right",
    })
    .text(`Status: ${data.status}`, right - 200, 88, {
      width: 200,
      align: "right",
    })
    .text(
      `Issued: ${data.issuedDate.toISOString().slice(0, 10)}`,
      right - 200,
      102,
      { width: 200, align: "right" },
    );
  if (data.dueDate) {
    doc.text(
      `Due: ${data.dueDate.toISOString().slice(0, 10)}`,
      right - 200,
      116,
      { width: 200, align: "right" },
    );
  }

  // --- Bill to ---
  let y = 170;
  doc.fillColor(COMPANY.brandColor).fontSize(10).text("BILL TO", left, y);
  doc
    .fillColor("#111")
    .fontSize(10)
    .text(data.customer.name, left, y + 16);
  doc
    .fillColor("#444")
    .fontSize(9)
    .text(data.customer.email, left, y + 31)
    .text(data.customer.phone ?? "", left, y + 44);
  if (data.customer.address)
    doc.text(data.customer.address, left, y + 57, { width: 250 });

  // --- Line items table ---
  y = 260;
  doc
    .fillColor(COMPANY.brandColor)
    .rect(left, y, right - left, 20)
    .fill();
  doc
    .fillColor("#fff")
    .fontSize(9)
    .text("Description", left + 8, y + 6)
    .text("Qty", 360, y + 6, { width: 40, align: "right" })
    .text("Unit", 410, y + 6, { width: 60, align: "right" })
    .text("Amount", 470, y + 6, { width: 67, align: "right" });
  y += 26;
  doc.fillColor("#111").fontSize(9);
  for (const item of data.lineItems) {
    doc
      .text(item.description, left + 8, y, { width: 300 })
      .text(String(item.quantity), 360, y, { width: 40, align: "right" })
      .text(money(item.unitAmount, data.currency), 410, y, {
        width: 60,
        align: "right",
      })
      .text(money(item.amount, data.currency), 470, y, {
        width: 67,
        align: "right",
      });
    y += 20;
  }

  // --- Totals ---
  y += 10;
  const totalsX = 360;
  const row = (label: string, value: string, bold = false) => {
    doc
      .fillColor(bold ? "#111" : "#444")
      .fontSize(bold ? 11 : 9)
      .text(label, totalsX, y, { width: 110, align: "right" })
      .text(value, 470, y, { width: 67, align: "right" });
    y += bold ? 20 : 16;
  };
  row("Subtotal", money(data.subtotal, data.currency));
  if (data.discount > 0)
    row("Discount", `- ${money(data.discount, data.currency)}`);
  row(
    `${data.tax.label} (${(data.tax.rate * 100).toFixed(0)}%)`,
    money(data.tax.amount, data.currency),
  );
  doc.moveTo(totalsX, y).lineTo(right, y).strokeColor("#ddd").stroke();
  y += 6;
  row("Total", money(data.total, data.currency), true);

  // --- Payment ---
  if (data.payment) {
    y += 16;
    doc.fillColor(COMPANY.brandColor).fontSize(10).text("PAYMENT", left, y);
    doc
      .fillColor("#444")
      .fontSize(9)
      .text(`Method: ${data.payment.method}`, left, y + 16)
      .text(`Status: ${data.payment.status}`, left, y + 30)
      .text(`Paid: ${money(data.payment.amount, data.currency)}`, left, y + 44);
    if (data.payment.transactionId)
      doc.text(`Txn: ${data.payment.transactionId}`, left, y + 58, {
        width: 300,
      });
  }

  // --- Footer ---
  doc
    .fillColor("#999")
    .fontSize(8)
    .text(
      `Thank you for choosing ${COMPANY.name}. ${COMPANY.website}`,
      left,
      760,
      { width: right - left, align: "center" },
    );
}
