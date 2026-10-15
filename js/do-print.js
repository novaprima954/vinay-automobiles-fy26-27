// ==========================================
// DELIVERY CHALLAN (DO) — shared print / PDF builder
// Used by delivery-challan.html (list) and accounts.html (print after Account Check = Yes).
// Needs: api.js, auth.js. PDF export additionally needs html2canvas + jsPDF.
// ==========================================
const DOPrint = (function () {

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatDMY(isoDate) {
    const parts = String(isoDate).split('-');
    if (parts.length !== 3) return isoDate;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function todayDMY() {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  function copyHtml(rec, challanNo, copyLabel) {
    const modelLine = 'TVS ' + [rec.model, rec.variant].filter(Boolean).join(' ');
    const checkItems = ['Owner Manual', 'Tool Kit', 'Battery & Warranty Card', 'Mirror', 'Saree Guard', 'Leg Guard'];

    const pendingHtml = rec.accessoryPending
      ? '<div class="do-pending"><span class="title">Pending Accessories:</span> ' + esc(rec.accessoryPending) + '</div>'
      : '';

    return '<div class="do-copy">' +
      '<div class="do-copy-label">' + esc(copyLabel) + '</div>' +
      '<div class="do-header">' +
        '<div class="do-logo"><div class="tri"></div><div class="tri-inner"></div></div>' +
        '<div class="do-header-text">' +
          '<div class="company">VINAY AUTOMOBILES</div>' +
          '<div class="addr">Mahaveer Nagar, Darwha Road, Yavatmal</div>' +
        '</div>' +
        '<span class="tvs-mark">TVS</span>' +
      '</div>' +
      '<div class="do-contact-row">' +
        '<span>👤 Executive: ' + esc(rec.executiveName || '-') + (rec.executiveMobile ? ' — ' + esc(rec.executiveMobile) : '') + '</span>' +
        '<span>☎ 9130040050</span>' +
      '</div>' +
      '<div class="do-box">' +
        '<div class="do-top-row">' +
          '<div class="from-block">' +
            '<div class="do-field-label">From</div>' +
            '<div class="do-field-value">' + esc(rec.customerName) + '</div>' +
          '</div>' +
          '<div class="meta-block">' +
            '<div class="do-field-label">Date</div>' +
            '<div class="do-field-value">' + esc(rec.deliveryDate ? formatDMY(rec.deliveryDate) : todayDMY()) + '</div>' +
            '<div class="do-field-label" style="margin-top:6px;">Delivery Challan No.</div>' +
            '<div class="do-field-value">' + esc(challanNo) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="do-declaration">I have taken delivery of the following described vehicle from Vinay Automobiles, Yavatmal, in good condition and to my entire satisfaction.</div>' +
        '<div class="do-desc-title">Description</div>' +
        '<div class="do-desc-grid">' +
          '<div class="do-desc-row full"><span class="lbl">One TVS Model</span><span class="val">' + esc(modelLine) + '</span></div>' +
          '<div class="do-desc-row"><span class="lbl">Chassis No.</span><span class="val">' + esc(rec.frameNumber) + '</span></div>' +
          '<div class="do-desc-row"><span class="lbl">Engine No.</span><span class="val">' + esc(rec.engineNumber) + '</span></div>' +
          '<div class="do-desc-row"><span class="lbl">Colour</span><span class="val">' + esc(rec.colour) + '</span></div>' +
          '<div class="do-desc-row"><span class="lbl">Key No.</span><span class="val"></span></div>' +
        '</div>' +
        '<div class="do-received-title">I have also received the following</div>' +
        '<div class="do-checks">' +
          checkItems.map(function (item) {
            return '<div class="do-check-item"><span class="do-check-box"></span>' + item + '</div>';
          }).join('') +
        '</div>' +
        '<div class="do-desc-row do-hyp-row"><span class="lbl">Hypothecation</span><span class="val">' + esc(rec.financierName || 'Cash') + '</span></div>' +
        pendingHtml +
        '<div class="do-sign-row">' +
          '<div class="line">Customer\'s Signature</div>' +
          '<div class="line">For: Vinay Automobiles</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function pageHtml(rec, challanNo) {
    return '<div class="do-page">' +
      copyHtml(rec, challanNo, 'Customer Copy') +
      copyHtml(rec, challanNo, 'Office Copy') +
    '</div>';
  }

  function buildPrintArea(rec, challanNo) {
    document.getElementById('doPrintArea').innerHTML = pageHtml(rec, challanNo);
  }

  /**
   * Issues (or reuses) the challan number, then loads the record to print.
   * via = 'Print' | 'Drive' — recorded in the log only for the first action on a booking.
   * Returns { ok, message, record, challanNo }.
   */
  async function prepare(receiptNo, via) {
    const issued = await API.issueDeliveryChallan(receiptNo, via);
    if (!issued.success) return { ok: false, message: issued.message || 'Could not issue Delivery Challan' };
    const full = await API.getDeliveryChallanRecord(receiptNo);
    if (!full.success) return { ok: false, message: full.message || 'Could not load record details' };
    return { ok: true, record: full.record, challanNo: issued.challanNo };
  }

  /** Issue + print (used by both the Delivery Challan page and the Accounts screen). */
  async function printReceipt(receiptNo) {
    const p = await prepare(receiptNo, 'Print');
    if (!p.ok) return p;
    buildPrintArea(p.record, p.challanNo);
    setTimeout(function () { window.print(); }, 200);
    return p;
  }

  /** Renders the challan off-screen and returns it as a single-page landscape A4 PDF (base64). */
  async function buildPdfBase64(rec, challanNo) {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') throw new Error('NO_LIBRARY');

    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;left:-10000px;top:0;width:1123px;height:794px;background:#fff;';
    stage.innerHTML = pageHtml(rec, challanNo);
    document.body.appendChild(stage);
    try {
      const canvas = await html2canvas(stage, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
      return pdf.output('datauristring').split(',')[1];
    } finally {
      document.body.removeChild(stage);
    }
  }

  return { prepare: prepare, printReceipt: printReceipt, buildPrintArea: buildPrintArea, buildPdfBase64: buildPdfBase64 };
})();
