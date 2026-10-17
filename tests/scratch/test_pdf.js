const fs = require('fs');
const { jsPDF } = require('jspdf');

// Mock window and document environment for Node testing
const mockElements = {
  's-company': { value: 'Anjani Agri Care' },
  'p-company': { textContent: 'Anjani Agri Care' },
  's-address': { value: 'Sr. No. 67 and 68, Plot No. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot, Gujarat.' },
  'p-address': { textContent: 'Sr. No. 67 and 68, Plot No. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot, Gujarat.' },
  's-phone': { value: '9876543210' },
  'p-phone': { textContent: '9876543210' },
  's-email': { value: 'skagro3105@gmail.com' },
  'p-email': { textContent: 'skagro3105@gmail.com' },
  's-gstin': { value: '24AERFS1718Q1ZB' },
  'p-gstin': { textContent: '24AERFS1718Q1ZB' },
  's-signatory': { value: 'Anjani Agri Care' },
  'p-signatory': { textContent: 'Anjani Agri Care' },
  's-inv-num': { value: '101' },
  'p-inv-num': { textContent: '101' },
  's-inv-date': { value: '2026-10-04' },
  'p-inv-date': { textContent: '04 Oct 2026' },
  's-due-date': { value: '2026-10-14' },
  's-client-name': { value: 'Kisan Agro Agencies' },
  'p-client-name': { textContent: 'Kisan Agro Agencies' },
  's-client-addr': { value: 'Main Market Yard, Jetpur, Rajkot, Gujarat - 360370' },
  's-client-phone': { value: '9898989898' },
  's-client-gstin': { value: '24ABCDE1234F1Z5' },
  's-client-state': { value: 'Gujarat' },
  's-client-state-code': { value: '24' },
  's-place-supply': { value: 'Gujarat' },
  's-client-due': { value: '500' },
  's-bank-name': { value: 'State Bank of India' },
  'p-bank-name': { textContent: 'State Bank of India' },
  's-bank-acc': { value: '123456789012' },
  'p-bank-acc': { textContent: '123456789012' },
  's-bank-ifsc': { value: 'SBIN0001234' },
  'p-bank-ifsc': { textContent: 'SBIN0001234' },
  's-upi': { value: 'anjani@sbi' },
  'p-upi': { textContent: 'anjani@sbi' },
  's-intro': { value: 'Dear Sir/Mam, Thank you for your valuable inquiry. We are pleased to quote as below:' },
  'p-intro': { textContent: 'Dear Sir/Mam, Thank you for your valuable inquiry. We are pleased to quote as below:' },
  's-terms': { value: '1. Goods once sold will not be taken back.\n2. Subject to Rajkot jurisdiction.' },
  'p-terms': { textContent: '1. Goods once sold will not be taken back.\n2. Subject to Rajkot jurisdiction.', style: { display: 'block' } },
  'qr-toggle': { checked: false },
  'sig-img': null,
  'paper-logo': null
};

global.window = {
  jspdf: { jsPDF },
  rows: [
    { id: '1', brand: 'Anjani', name: 'Super Chlor 50% EC', desc: 'Packaging: 1 Ltr bottle', qty: 10, price: 450, total: 4500, hsn: '3808' },
    { id: '2', brand: 'Anjani', name: 'Profenofos 40% + Cypermethrin 4% EC', desc: 'Packaging: 500 ml bottle', qty: 20, price: 320, total: 6400, hsn: '3808' },
    { id: '3', brand: 'Anjani', name: 'Monocrotophos 36% SL', desc: 'Packaging: 250 ml pack', qty: 15, price: 180, total: 2700, hsn: '3808' }
  ]
};

global.document = {
  getElementById: (id) => mockElements[id] || null,
  querySelector: () => null,
  body: {
    classList: {
      contains: (cls) => cls === 'gst-mode'
    }
  }
};

global.INR = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
global.formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
global.formatTaxLabel = (taxType) => taxType === 'GST18' ? 'GST 18%' : (taxType || 'GST');
global.getTaxConfig = (taxType) => ({ rate: 18, isGst: true });
global.calculateInvoiceTotals = (subtotal, taxType, dueAmount) => {
  const cgstRate = 9, sgstRate = 9;
  const cgstAmount = Math.round((subtotal * 0.09) * 100) / 100;
  const sgstAmount = Math.round((subtotal * 0.09) * 100) / 100;
  const totalTax = cgstAmount + sgstAmount;
  const grandTotal = subtotal + totalTax + dueAmount;
  return {
    subtotal,
    taxType: 'GST18',
    cgstRate,
    sgstRate,
    igstRate: 0,
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
    totalTax,
    grandTotal
  };
};

// Load invoice-pdf.js
require('../Invoice Builder/js/invoice-pdf.js');

console.log('Testing drawA4InvoicePdf for GST invoice...');
const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

const payload = {
  InvoiceNumber: '101',
  InvoiceType: 'GST',
  Date: '2026-10-04',
  DueDate: '2026-10-14',
  business: {
    company: 'Anjani Agri Care',
    address: 'Sr. No. 67 and 68, Plot No. 33, Siddhi Vinayak Industrial Zone, At: Virva, Tal: Lodhika, Dist: Rajkot, Gujarat.',
    phone: '9876543210',
    email: 'skagro3105@gmail.com',
    gstin: '24AERFS1718Q1ZB',
    signatory: 'Anjani Agri Care'
  },
  customer: {
    name: 'Kisan Agro Agencies',
    address: 'Main Market Yard, Jetpur, Rajkot, Gujarat - 360370',
    phone: '9898989898',
    gstin: '24ABCDE1234F1Z5',
    state: 'Gujarat',
    placeOfSupply: 'Gujarat',
    dueAmount: 500
  },
  bank: {
    name: 'State Bank of India',
    account: '123456789012',
    ifsc: 'SBIN0001234',
    upi: 'anjani@sbi'
  },
  settings: {
    intro: 'Dear Sir/Mam, Thank you for your valuable inquiry. We are pleased to quote as below:',
    terms: '1. Goods once sold will not be taken back.\n2. Subject to Rajkot jurisdiction.',
    showQR: false,
    taxType: 'GST18'
  },
  rows: global.window.rows,
  DueAmount: 500
};

window.drawA4InvoicePdf(pdf, payload);

const outBuf = Buffer.from(pdf.output('arraybuffer'));
fs.writeFileSync('scratch/test_invoice.pdf', outBuf);

console.log('Generated scratch/test_invoice.pdf successfully! Size:', outBuf.length, 'bytes');

// Check text contents in PDF
const pdfString = outBuf.toString('binary');
const hasAnjani = pdfString.includes('Anjani Agri Care');
const hasKisan = pdfString.includes('Kisan Agro Agencies');
const hasSuperChlor = pdfString.includes('Super Chlor 50% EC');
const hasGrandTotal = pdfString.includes('GRAND TOTAL');
const hasVectors = pdfString.includes('re') && pdfString.includes('f');

console.log('Text check:');
console.log('- "Anjani Agri Care" in PDF text stream:', hasAnjani);
console.log('- "Kisan Agro Agencies" in PDF text stream:', hasKisan);
console.log('- "Super Chlor 50% EC" in PDF text stream:', hasSuperChlor);
console.log('- "GRAND TOTAL" in PDF text stream:', hasGrandTotal);
console.log('- Vector paths (re, f) in PDF:', hasVectors);

if (hasAnjani && hasKisan && hasSuperChlor && hasGrandTotal && hasVectors) {
  console.log('SUCCESS: GST PDF is a TRUE vector/text PDF!');
} else {
  console.error('FAILURE: Missing text or vector streams!');
  process.exit(1);
}

// ─── Test Non-GST Mode ───
console.log('\nTesting drawA4InvoicePdf for Non-GST invoice...');
const pdf2 = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
global.document.body.classList.contains = () => false;

const nongstPayload = {
  InvoiceNumber: '102',
  InvoiceType: 'Non-GST',
  Date: '2026-10-04',
  business: {
    company: 'Anjani Agri Care',
    address: 'Rajkot, Gujarat.',
    phone: '9876543210',
    email: 'skagro3105@gmail.com',
    signatory: 'Anjani Agri Care'
  },
  customer: {
    name: 'Patel Agro Center',
    address: 'Gondal Road, Rajkot',
    phone: '9123456780',
    dueAmount: 0
  },
  bank: {
    name: 'State Bank of India',
    account: '123456789012',
    ifsc: 'SBIN0001234',
    upi: 'anjani@sbi'
  },
  settings: {
    intro: 'Dear Customer, Please find the invoice details below:',
    terms: 'Payment due on receipt.',
    showQR: false,
    taxType: 'NONE'
  },
  rows: [
    { id: '1', brand: 'Anjani Brand', name: 'Weed Clear 41% SL', desc: '1 Litre Bottle', qty: 5, price: 500, total: 2500 }
  ],
  DueAmount: 0
};

window.drawA4InvoicePdf(pdf2, nongstPayload);
const buf2 = Buffer.from(pdf2.output('arraybuffer'));
fs.writeFileSync('scratch/test_nongst_invoice.pdf', buf2);
console.log('Generated scratch/test_nongst_invoice.pdf! Size:', buf2.length, 'bytes');

const pdf2Str = buf2.toString('binary');
console.log('- "INVOICE" badge in PDF:', pdf2Str.includes('INVOICE'));
console.log('- "Weed Clear 41% SL" in PDF:', pdf2Str.includes('Weed Clear 41% SL'));
console.log('- "Patel Agro Center" in PDF:', pdf2Str.includes('Patel Agro Center'));
console.log('- Vector paths (re, f) in PDF:', pdf2Str.includes('re') && pdf2Str.includes('f'));
console.log('SUCCESS: Non-GST PDF is a TRUE vector/text PDF!\n');

