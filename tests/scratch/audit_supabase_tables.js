const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'backups') continue;
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      walk(fp, fileList);
    } else if (f.endsWith('.js') || f.endsWith('.html')) {
      fileList.push(fp);
    }
  }
  return fileList;
}

const files = walk('.');
const tableOps = {};
const fromRegex = /\.from\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g;

files.forEach(fp => {
  const content = fs.readFileSync(fp, 'utf8');
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    const table = match[1];
    if (!tableOps[table]) {
      tableOps[table] = {
        files: new Set(),
        select: false,
        insert: false,
        update: false,
        delete: false,
        upsert: false
      };
    }
    tableOps[table].files.add(fp);

    const snippet = content.substring(match.index, match.index + 350);
    if (/\.select\b/.test(snippet)) tableOps[table].select = true;
    if (/\.insert\b/.test(snippet)) tableOps[table].insert = true;
    if (/\.update\b/.test(snippet)) tableOps[table].update = true;
    if (/\.delete\b/.test(snippet)) tableOps[table].delete = true;
    if (/\.upsert\b/.test(snippet)) tableOps[table].upsert = true;
  }
});

const report = {};
for (const [tbl, info] of Object.entries(tableOps)) {
  report[tbl] = {
    operations: [
      info.select ? 'SELECT' : null,
      info.insert ? 'INSERT' : null,
      info.update ? 'UPDATE' : null,
      info.delete ? 'DELETE' : null,
      info.upsert ? 'UPSERT' : null
    ].filter(Boolean),
    filesCount: info.files.size,
    sampleFiles: Array.from(info.files).slice(0, 4)
  };
}

console.log(JSON.stringify(report, null, 2));
