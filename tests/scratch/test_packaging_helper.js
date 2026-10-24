function formatPackagingDisplayName(itemOrName, category = '') {
  if (!itemOrName) return '';

  let name = '';
  let subtype = '';
  let itemSize = '';
  let cat = category || '';

  if (typeof itemOrName === 'object' && itemOrName !== null) {
    name = itemOrName.name || '';
    subtype = itemOrName.item_subtype || '';
    itemSize = itemOrName.item_size || '';
    cat = cat || itemOrName.category || '';
  } else {
    name = String(itemOrName);
  }

  const isBottle = /bottle/i.test(cat) || /bottle/i.test(name);
  const isBox = /box/i.test(cat) || /box/i.test(name);

  // 1. Extract and standardize the packaging size
  let sizeStr = '';
  // Check itemSize first
  const rawSize = itemSize || name;
  const sizeMatch = rawSize.match(/(\d+(?:\.\d+)?)\s*(litre|ltr|l|ml|kg|gm|g|nos|pcs)\b/i);

  if (sizeMatch) {
    const num = sizeMatch[1];
    let unit = sizeMatch[2].toUpperCase();
    if (['LITRE', 'LTR', 'L'].includes(unit)) {
      unit = 'LTR';
    } else if (unit === 'ML') {
      unit = 'ML';
    } else if (unit === 'KG') {
      unit = 'KG';
    } else if (['GM', 'G'].includes(unit)) {
      unit = 'GM';
    }
    sizeStr = `${num} ${unit}`;
  }

  // 2. Extract base packaging type
  let type = subtype ? String(subtype).trim() : '';

  if (!type || type.toLowerCase() === 'bottles' || type.toLowerCase() === 'boxes') {
    type = name;
  }

  // Remove size from type if present
  if (sizeMatch) {
    type = type.replace(new RegExp(`\\b${sizeMatch[1]}\\s*(?:litre|ltr|l|ml|kg|gm|g|nos|pcs)\\b`, 'gi'), '');
  }

  // Clean redundant packaging words
  if (isBottle) {
    type = type.replace(/\b(bottle|bottles)\b/gi, '');
  }
  if (isBox) {
    type = type.replace(/\b(box|boxes)\b/gi, '');
  }

  // Remove stock tags if present in name like "(850 avail)"
  type = type.replace(/\([^)]*avail[^)]*\)/gi, '');
  type = type.replace(/[()]/g, '');

  // Collapse whitespaces
  type = type.replace(/\s+/g, ' ').trim();

  // If type became empty, fallback to clean name
  if (!type) {
    type = isBottle ? 'Bottle' : (isBox ? 'Box' : 'Packaging');
  }

  return sizeStr ? `${type} ${sizeStr}` : type;
}

// Test cases
const testCases = [
  { input: { name: 'Imida Bottle 100 Ml', category: 'Bottles', item_subtype: 'Imida', item_size: '100 Ml' }, expected: 'Imida 100 ML' },
  { input: { name: 'Imida Bottle 250 Ml', category: 'Bottles', item_subtype: 'Imida', item_size: '250 Ml' }, expected: 'Imida 250 ML' },
  { input: { name: 'Imida Bottle 500 Ml', category: 'Bottles', item_subtype: 'Imida', item_size: '500 Ml' }, expected: 'Imida 500 ML' },
  { input: { name: 'Imida Bottle 1 Ltr', category: 'Bottles', item_subtype: 'Imida', item_size: '1 Ltr' }, expected: 'Imida 1 LTR' },
  { input: { name: 'Regular Box Box 50 Ml', category: 'Boxes', item_subtype: 'Regular Box', item_size: '50 Ml' }, expected: 'Regular 50 ML' },
  { input: { name: 'Regular Box Box 100 Ml', category: 'Boxes', item_subtype: 'Regular Box', item_size: '100 Ml' }, expected: 'Regular 100 ML' },
  { input: { name: 'Regular Box Box 250 Ml', category: 'Boxes', item_subtype: 'Regular Box', item_size: '250 Ml' }, expected: 'Regular 250 ML' },
  { input: { name: 'Regular Box Box 500 Ml', category: 'Boxes', item_subtype: 'Regular Box', item_size: '500 Ml' }, expected: 'Regular 500 ML' },
  { input: { name: 'Regular Box Box 1 Ltr', category: 'Boxes', item_subtype: 'Regular Box', item_size: '1 Ltr' }, expected: 'Regular 1 LTR' },
  { input: 'Imida Bottle 1 Ltr (850 avail)', category: 'Bottles', expected: 'Imida 1 LTR' },
  { input: 'Regular Box 1 Ltr (985 avail)', category: 'Boxes', expected: 'Regular 1 LTR' },
  { input: { name: 'HDPE Bottle 250 ML', category: 'Bottles' }, expected: 'HDPE 250 ML' },
  { input: { name: 'Corrugated Master Box 1 LTR', category: 'Boxes' }, expected: 'Corrugated Master 1 LTR' }
];

let allPassed = true;
testCases.forEach((tc, i) => {
  const result = formatPackagingDisplayName(tc.input, tc.category);
  const pass = result === tc.expected;
  if (!pass) allPassed = false;
  console.log(`Test ${i + 1}: ${pass ? 'PASS' : 'FAIL'} -> Input: "${JSON.stringify(tc.input)}" => Got: "${result}", Expected: "${tc.expected}"`);
});

if (allPassed) console.log('\nALL TEST CASES PASSED PERFECTLY!');
