const fs = require('fs');
const path = require('path');

function walk(dir, ext = ['.js', '.html']) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'backups'].includes(f)) continue;
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      res = res.concat(walk(fp, ext));
    } else if (ext.some(e => f.endsWith(e))) {
      res.push(fp);
    }
  }
  return res;
}

const sqlFiles = walk('database', ['.sql']);
const tablesSql = new Set();
const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;

sqlFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = createRegex.exec(content)) !== null) {
    tablesSql.add(m[1].toLowerCase());
  }
});

const codeFiles = walk('.');
const tableOps = {};
const fromRegex = /\.from\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g;

codeFiles.forEach(fp => {
  const content = fs.readFileSync(fp, 'utf8');
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    const table = match[1].toLowerCase();
    if (!tableOps[table]) tableOps[table] = new Set();
    tableOps[table].add(fp);
  }
});

console.log('--- TABLES IN CODE BUT NOT IN SQL ---');
for (const tbl of Object.keys(tableOps)) {
  if (!tablesSql.has(tbl)) {
    console.log(`- ${tbl}: used in ${Array.from(tableOps[tbl]).join(', ')}`);
  }
}

console.log('\n--- TABLES IN SQL BUT NOT IN CODE ---');
for (const tbl of Array.from(tablesSql).sort()) {
  if (!tableOps[tbl]) {
    console.log(`- ${tbl}`);
  }
}
