const fs = require('fs');

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const targetStart = 'async function downloadVectorPDF() {';
  const targetEnd = '// ─── MOBILE UI ────────────────────────────────────────────────────────────────';

  const idxStart = content.indexOf(targetStart);
  const idxEnd = content.indexOf(targetEnd);

  if (idxStart === -1 || idxEnd === -1) {
    console.error('Target not found in ' + filePath + '! idxStart:', idxStart, 'idxEnd:', idxEnd);
    return false;
  }

  const replacement = `async function downloadPDF() {
  if (typeof generateAndDownloadInvoicePDF === 'function') {
    return await generateAndDownloadInvoicePDF();
  }

  const btn = $('pdf-btn'), mobBtn = $('mob-pdf-btn');
  if (btn) {
    btn.innerHTML = '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">autorenew</span> Generating…';
    btn.disabled = true;
  }
  if (mobBtn) mobBtn.disabled = true;

  try {
    let saveResult;
    try {
      saveResult = await saveToCloud(true);
    } catch (e) {
      console.warn('Auto-save before PDF failed', e);
    }

    const payload = saveResult?.payload || extractInvoiceJSON(window.currentInvoiceId);
    const invNum = payload.InvoiceNumber || $('s-inv-num')?.value || $('p-inv-num')?.textContent || '001';
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    drawA4InvoicePdf(pdf, payload);
    savePdfBlob(pdf, 'Invoice_' + invNum + '.pdf');

    if (saveResult) {
      const nextNum = await advanceToNextInvoiceDraftAfterDownload();
      const displayNext = nextNum || $('s-inv-num')?.value || $('p-inv-num')?.textContent || '';
      toast({
        title: 'PDF Downloaded Successfully',
        nextInvoice: displayNext ? displayNext.trim() : '',
        type: 'download-success'
      });
    } else {
      toast({
        title: 'PDF Downloaded Successfully',
        type: 'download-success'
      });
    }
  } catch (err) {
    console.error('PDF error:', err);
    toast('PDF generation failed: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (btn) {
      btn.innerHTML = '<span class="material-symbols-outlined">download</span> Download PDF';
      btn.disabled = false;
    }
    if (mobBtn) mobBtn.disabled = false;
  }
}

const downloadVectorPDF = downloadPDF;

`;

  const newContent = content.slice(0, idxStart) + replacement + content.slice(idxEnd);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully updated ' + filePath);
  return true;
}

updateFile('Invoice Builder/js/main.js');
updateFile('apps/Invoice Builder/js/main.js');
