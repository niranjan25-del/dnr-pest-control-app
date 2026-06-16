// src/modules/invoices/templates/company.ts
//
// Static company/issuer details printed on every invoice. Move to config/DB if these need to
// change without a deploy (e.g. GSTIN per state). Brand green matches the platform (#1E8E5A).

export const COMPANY = {
  name: 'DNR Pest Control',
  tagline: 'Certified Pest Management Services',
  addressLines: ['DNR Pest Control Pvt. Ltd.', 'Bengaluru, Karnataka', 'India'],
  email: 'billing@dnrpestcontrol.in',
  phone: '+91 80 0000 0000',
  website: 'www.dnrpestcontrol.in',
  gstin: '', // fill with the registered GSTIN
  brandColor: '#1E8E5A',
};
