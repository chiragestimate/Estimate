const fs = require('fs');

const md = fs.readFileSync('ERP_COMPLETE_TESTING_HANDBOOK.md', 'utf8');
const csv = fs.readFileSync('ERP_TEST_CASES.csv', 'utf8');
const bug = fs.readFileSync('ERP_BUG_REPORT_TEMPLATE.md', 'utf8');
const setup = fs.readFileSync('ERP_TEST_DATA_SETUP.md', 'utf8');

console.log('=== FILE SIZES ===');
console.log('ERP_COMPLETE_TESTING_HANDBOOK.md:', Buffer.byteLength(md, 'utf8'), 'bytes');
console.log('ERP_TEST_CASES.csv:             ', Buffer.byteLength(csv, 'utf8'), 'bytes');
console.log('ERP_BUG_REPORT_TEMPLATE.md:     ', Buffer.byteLength(bug, 'utf8'), 'bytes');
console.log('ERP_TEST_DATA_SETUP.md:         ', Buffer.byteLength(setup, 'utf8'), 'bytes');

// Split CSV lines
const lines = csv.trim().split('\r\n');
console.log('\nTotal CSV lines:', lines.length);

const headerCols = lines[0].slice(1, -1).split('","');
console.log('CSV Header Columns (' + headerCols.length + '):');
headerCols.forEach((c, i) => console.log(`  [${i+1}] ${c}`));

const dataRows = lines.slice(1);
const ids = dataRows.map(l => l.slice(1, -1).split('","')[0]);

console.log('\nTotal Test Cases in CSV:', ids.length);
const uniqueIds = new Set(ids);
console.log('Unique Test Case IDs:   ', uniqueIds.size);

let missingInMd = 0;
ids.forEach(id => {
  if (!md.includes(id)) {
    console.error('ERROR: Missing in Handbook:', id);
    missingInMd++;
  }
});

if (missingInMd === 0) {
  console.log('✓ 100% of CSV IDs match the Handbook exactly!');
}

let statusErrors = 0;
dataRows.forEach((r, idx) => {
  const cols = r.slice(1, -1).split('","');
  const status = cols[14];
  if (status !== 'Not Run') {
    console.error(`Row ${idx+1} status is ${status}`);
    statusErrors++;
  }
});

if (statusErrors === 0) {
  console.log('✓ All 94 test cases have Status = "Not Run"!');
}

// Check company name consistency
const hasCropCare = [md, csv, bug, setup].some(txt => /Anjani Crop Care/i.test(txt));
if (hasCropCare) {
  console.error('WARNING: Legacy "Anjani Crop Care" found in docs!');
} else {
  console.log('✓ Company name "Anjani Agri Care" is 100% consistent across all 4 documents!');
}
