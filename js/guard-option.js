// Guard price options for specific models (Sales / Sales Edit).
// For the models listed here, ticking Guard asks for one of the fixed amounts below. The amount
// is NOT stored in the Guard column (that stays Yes/No): it is written as the first line of the
// Sales Remark ("Guard ₹2700 | extra remarks") and shown next to Guard in the WhatsApp message.
// To change prices or add models later, edit MODELS / AMOUNTS only.
const GuardOption = (function () {
  const MODELS  = ['jupiter 110'];   // lower-case model names
  const AMOUNTS = [2700, 2425];

  function applies(model) {
    return MODELS.indexOf(String(model || '').trim().toLowerCase()) !== -1;
  }

  function optionsHtml(selected) {
    return '<option value="">-- Guard amount --</option>' + AMOUNTS.map(function (a) {
      return '<option value="' + a + '"' + (String(selected) === String(a) ? ' selected' : '') + '>₹' + a + '</option>';
    }).join('');
  }

  function line(amount) { return amount ? 'Guard ₹' + amount : ''; }

  // Splits a saved remark into { amount, extra } (amount '' when there is no guard line)
  function parse(remark) {
    const text = String(remark || '').trim();
    const m = /^Guard ₹(\d+)(?:\s*\|\s*([\s\S]*))?$/.exec(text);
    if (!m) return { amount: '', extra: text };
    return { amount: m[1], extra: (m[2] || '').trim() };
  }

  function compose(amount, extra) {
    const e = String(extra || '').trim();
    if (!amount) return e;
    return line(amount) + (e ? ' | ' + e : '');
  }

  // Shows the locked auto line above the remark box; the box is only mandatory when there is no auto line
  function refresh(amount) {
    const l = document.getElementById('guardRemarkLine');
    const t = document.getElementById('salesRemark');
    if (l) { l.textContent = amount ? line(amount) : ''; l.style.display = amount ? 'block' : 'none'; }
    if (t) t.required = !amount;
  }

  return { applies: applies, optionsHtml: optionsHtml, parse: parse, compose: compose, refresh: refresh };
})();
