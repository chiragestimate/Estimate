const fs = require('fs');

function updateHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';

  const desktopBtn = `<button class="btn btn-whatsapp" id="whatsapp-btn" style="background:#0C3925;color:#ffffff !important;border:none;margin-right:4px;display:inline-flex;align-items:center;gap:6px;font-weight:600;" title="Send Invoice on WhatsApp">` + eol +
    `        <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.28-2.42 5.83a8.18 8.18 0 0 1-5.82 2.41h-.01c-1.48 0-2.93-.39-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.25-4.38c0-4.54 3.7-8.24 8.25-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.78.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3z"/></svg>` + eol +
    `        <span class="toolbar-btn-text" style="color:#ffffff !important"> WhatsApp</span>` + eol +
    `      </button>` + eol +
    `      <button class="btn btn-primary" id="pdf-btn"`;

  const mobBtn = `<button class="mob-tab mob-action-tab mob-tab-whatsapp" id="mob-whatsapp-btn" title="Send on WhatsApp">` + eol +
    `      <svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.28-2.42 5.83a8.18 8.18 0 0 1-5.82 2.41h-.01c-1.48 0-2.93-.39-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.25-4.38c0-4.54 3.7-8.24 8.25-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.78.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3z"/></svg>` + eol +
    `      <span class="mob-tab-label">WhatsApp</span>` + eol +
    `    </button>` + eol +
    `    <button class="mob-tab mob-action-tab mob-tab-pdf" id="mob-pdf-btn">`;

  if (!html.includes('id="whatsapp-btn"')) {
    html = html.replace('<button class="btn btn-primary" id="pdf-btn"', desktopBtn);
  }

  if (!html.includes('id="mob-whatsapp-btn"')) {
    html = html.replace('<button class="mob-tab mob-action-tab mob-tab-pdf" id="mob-pdf-btn">', mobBtn);
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log('Updated:', filePath);
}

updateHtml('Invoice Builder/index.html');
updateHtml('apps/Invoice Builder/index.html');
