// ==========================================
// DAILY ACTIVITY LOG  v2
// ==========================================

let currentUser  = null;
let _reportCache = [];   // last loaded report rows (for inline edit)

document.addEventListener('DOMContentLoaded', async function () {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;
  document.getElementById('userAvatar').textContent = (currentUser.name || '?')[0].toUpperCase();
  document.getElementById('userName').textContent   = currentUser.name  || '';
  document.getElementById('userRole').textContent   = cap(currentUser.role || '');

  const today = new Date();
  document.getElementById('todayLabel').textContent = today.toLocaleDateString('en-IN', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  if (currentUser.role === 'admin') {
    document.getElementById('adminSection').style.display = 'block';
    setDefaultDates();
    loadAdminReport();
  }

  await loadTodayEntry();
});

// ── Today's Entry ─────────────────────────────────────────────────────────────

async function loadTodayEntry() {
  setFormDisabled(true);
  try {
    const res = await API.getDailyActivity();
    if (!res.success) { showMsg('Failed to load: ' + res.message, 'error'); return; }

    setLiveCount(res.bookingsLive);

    if (res.entry) {
      setField('inp-enquiries',      res.entry.enquiries);
      setField('inp-bookings-manual', res.entry.bookingsManual);
      setField('inp-sales',          res.entry.sales);
      setField('inp-google',         res.entry.googleRatings);
      setField('inp-testrides',      res.entry.testRides);
      document.getElementById('savedBadge').style.display = 'inline-flex';
    }
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
  finally     { setFormDisabled(false); }
}

async function saveActivity() {
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const data = {
      enquiries:      getNum('inp-enquiries'),
      bookingsManual: getNum('inp-bookings-manual'),
      sales:          getNum('inp-sales'),
      googleRatings:  getNum('inp-google'),
      testRides:      getNum('inp-testrides')
    };
    const res = await API.saveDailyActivity(data);
    if (!res.success) { showMsg('Save failed: ' + res.message, 'error'); return; }
    setLiveCount(res.bookingsLive);
    document.getElementById('savedBadge').style.display = 'inline-flex';
    showMsg('✅ Activity saved!', 'success');
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
  finally {
    btn.disabled = false; btn.textContent = '💾 Save Today\'s Log';
  }
}

function setLiveCount(n) {
  document.getElementById('bookingLiveCount').textContent = (n != null ? n : '—');
}
function setFormDisabled(on) {
  ['inp-enquiries','inp-bookings-manual','inp-sales','inp-google','inp-testrides','btnSave'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.disabled = on;
  });
}

// ── Admin Report ──────────────────────────────────────────────────────────────

function setDefaultDates() {
  const today = new Date();
  const d6    = new Date(today); d6.setDate(d6.getDate() - 6);
  document.getElementById('rpt-from').value = iso(d6);
  document.getElementById('rpt-to').value   = iso(today);
}

async function loadAdminReport() {
  const from  = document.getElementById('rpt-from').value;
  const to    = document.getElementById('rpt-to').value;
  if (!from || !to) { showMsg('Select date range', 'error'); return; }

  const tbody = document.getElementById('rpt-body');
  const empty = document.getElementById('rpt-empty');
  tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:#888">Loading…</td></tr>';
  empty.style.display = 'none';

  try {
    const res = await API.getDailyActivityReport(from, to);
    if (!res.success) { showMsg('Failed: ' + res.message, 'error'); return; }

    _reportCache = res.data || [];
    if (!_reportCache.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    renderReportTable();
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
}

function renderReportTable() {
  const tbody = document.getElementById('rpt-body');
  tbody.innerHTML = _reportCache.map(function(r, idx) {
    return buildReportRow(r, idx);
  }).join('');
}

function buildReportRow(r, idx) {
  const eGap = gapHtml(r.enquiryGap);
  const bGap = gapHtml(r.bookingGap);
  return '<tr id="rpt-row-' + idx + '">'
    + '<td style="white-space:nowrap">' + fmtDate(r.date) + '</td>'
    + '<td><strong>' + esc(r.executiveName) + '</strong></td>'
    + '<td class="c">' + r.enquiries     + '</td>'
    + '<td class="c">' + r.crmWalkIns    + '</td>'
    + '<td class="c gap ' + eGap.cls + '">' + eGap.txt + '</td>'
    + '<td class="c">' + r.bookingsManual + '</td>'
    + '<td class="c">' + r.bookingsSystem + '</td>'
    + '<td class="c gap ' + bGap.cls + '">' + bGap.txt + '</td>'
    + '<td class="c">' + r.sales         + '</td>'
    + '<td class="c">' + r.googleRatings + '</td>'
    + '<td class="c">' + r.testRides     + '</td>'
    + '<td class="c"><button class="btn-row-edit" onclick="startEditRow(' + idx + ')">✏️</button></td>'
    + '</tr>';
}

function startEditRow(idx) {
  const r   = _reportCache[idx];
  const row = document.getElementById('rpt-row-' + idx);
  if (!row) return;

  row.innerHTML =
    '<td style="white-space:nowrap">' + fmtDate(r.date) + '</td>'
    + '<td><strong>' + esc(r.executiveName) + '</strong></td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-enq-' + idx  + '" value="' + r.enquiries      + '" min="0"></td>'
    + '<td class="c" style="color:#aaa">' + r.crmWalkIns + '</td>'
    + '<td class="c" style="color:#aaa">—</td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-bm-'  + idx  + '" value="' + r.bookingsManual + '" min="0"></td>'
    + '<td class="c" style="color:#aaa">' + r.bookingsSystem + '</td>'
    + '<td class="c" style="color:#aaa">—</td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-sal-' + idx  + '" value="' + r.sales          + '" min="0"></td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-goo-' + idx  + '" value="' + r.googleRatings  + '" min="0"></td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-tr-'  + idx  + '" value="' + r.testRides      + '" min="0"></td>'
    + '<td class="c" style="display:flex;gap:4px;justify-content:center">'
    + '<button class="btn-edit-save"   onclick="saveEditRow(' + idx + ')">✓</button>'
    + '<button class="btn-edit-cancel" onclick="renderReportTable()">✗</button>'
    + '</td>';
}

async function saveEditRow(idx) {
  const r = _reportCache[idx];
  const data = {
    enquiries:      numEl('ei-enq-' + idx),
    bookingsManual: numEl('ei-bm-'  + idx),
    sales:          numEl('ei-sal-' + idx),
    googleRatings:  numEl('ei-goo-' + idx),
    testRides:      numEl('ei-tr-'  + idx)
  };

  try {
    const res = await API.adminUpdateDailyActivity(r.date, r.executiveName, data);
    if (!res.success) { showMsg('Update failed: ' + res.message, 'error'); return; }

    // Update local cache
    _reportCache[idx] = Object.assign({}, r, data, {
      bookingGap:  data.bookingsManual - r.bookingsSystem,
      enquiryGap:  data.enquiries      - r.crmWalkIns
    });
    renderReportTable();
    showMsg('✅ Updated', 'success');
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gapHtml(gap) {
  if (gap  >  0) return { cls:'gap-red',   txt:'▲ ' + gap };
  if (gap  <  0) return { cls:'gap-green', txt:'▼ ' + Math.abs(gap) };
  return             { cls:'gap-zero',  txt:'✓' };
}

function fmtDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  } catch(e) { return s; }
}

function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function getNum(id) { return parseInt(document.getElementById(id).value) || 0; }
function numEl(id)  { const el = document.getElementById(id); return el ? (parseInt(el.value) || 0) : 0; }
function setField(id, val) { const el = document.getElementById(id); if (el) el.value = val || 0; }

let _msgTimer = null;
function showMsg(msg, type) {
  const el = document.getElementById('msg');
  el.textContent = msg;
  el.className   = 'msg msg-' + (type || 'info');
  el.style.display = 'block';
  clearTimeout(_msgTimer);
  _msgTimer = setTimeout(function() { el.style.display = 'none'; }, 3500);
}
