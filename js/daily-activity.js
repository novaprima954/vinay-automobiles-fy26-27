// ==========================================
// DAILY ACTIVITY LOG  v3
// ==========================================

let currentUser  = null;
let _reportCache = [];

document.addEventListener('DOMContentLoaded', async function () {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;
  document.getElementById('userAvatar').textContent = (currentUser.name || '?')[0].toUpperCase();
  document.getElementById('userName').textContent   = currentUser.name  || '';
  document.getElementById('userRole').textContent   = cap(currentUser.role || '');

  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('en-IN', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  const isAdmin = currentUser.role === 'admin';
  const isSales = currentUser.role === 'sales';

  // Sales: simplify booking card to manual-only (hide live system side)
  if (isSales) {
    const sysHalf = document.querySelector('.booking-half:last-child');
    const divider = document.querySelector('.booking-divider');
    if (sysHalf) sysHalf.style.display = 'none';
    if (divider) divider.style.display = 'none';
  }

  if (isAdmin) {
    document.getElementById('adminSection').style.display = 'block';
    setDefaultDates();
    loadAdminReport();

    const engMonthEl = document.getElementById('eng-month');
    if (engMonthEl) {
      const now = new Date();
      engMonthEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
    loadEngagementReport();
  }

  await loadTodayEntry();
});

// ── Today's Entry ─────────────────────────────────────────────────────────────

async function loadTodayEntry() {
  setFormDisabled(true);
  try {
    const res = await API.getDailyActivity();
    if (!res.success) { showMsg('Failed to load: ' + res.message, 'error'); return; }

    // Only show live booking count on admin's own form
    if (currentUser.role === 'admin') {
      setLiveCount(res.bookingsLive);
    }

    if (res.entry) {
      setField('inp-enquiries',       res.entry.enquiries);
      setField('inp-bookings-manual', res.entry.bookingsManual);
      setField('inp-sales',           res.entry.sales);
      setField('inp-google',          res.entry.googleRatings);
      setField('inp-testrides',       res.entry.testRides);
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

    if (currentUser.role === 'admin') setLiveCount(res.bookingsLive);

    document.getElementById('savedBadge').style.display = 'inline-flex';
    showMsg('✅ Activity saved!', 'success');
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
  finally {
    btn.disabled = false; btn.textContent = '💾 Save Today\'s Log';
  }
}

function setLiveCount(n) {
  const el = document.getElementById('bookingLiveCount');
  if (el) el.textContent = (n != null ? n : '—');
}
function setFormDisabled(on) {
  ['inp-enquiries','inp-bookings-manual','inp-sales','inp-google','inp-testrides','btnSave'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.disabled = on;
  });
}

// ── Admin Report ──────────────────────────────────────────────────────────────

function setDefaultDates() {
  const today = iso(new Date());
  document.getElementById('rpt-from').value = today;
  document.getElementById('rpt-to').value   = today;
}

async function loadAdminReport() {
  const from  = document.getElementById('rpt-from').value;
  const to    = document.getElementById('rpt-to').value;
  if (!from || !to) { showMsg('Select date range', 'error'); return; }

  const tbody = document.getElementById('rpt-body');
  const empty = document.getElementById('rpt-empty');
  tbody.innerHTML = '<tr><td colspan="15" style="text-align:center;padding:20px;color:#888">Loading…</td></tr>';
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
  document.getElementById('rpt-body').innerHTML = _reportCache.map(function(r, idx) {
    return buildReportRow(r, idx);
  }).join('');
}

function buildReportRow(r, idx) {
  const eGap = gapHtml(r.enquiryGap);
  const bGap = gapHtml(r.bookingGap);
  const sGap = gapHtml(r.salesGap);

  var confirmCell = r.confirmedBy
    ? '<td class="c"><div class="confirmed-badge">✅ ' + esc(r.confirmedBy)
        + '<br><span style="font-weight:400;color:#888">' + esc(r.confirmedAt) + '</span></div></td>'
    : '<td class="c"><button class="btn-row-confirm" onclick="confirmRow(' + idx + ')">✅ Confirm</button></td>';

  const crmWiTitle  = detailTitle(r.crmWalkInDetail, 'model');
  const bookSysTitle = detailTitle(r.bookingsSystemDetail, 'variant');
  const saleSysTitle = detailTitle(r.salesSystemDetail, 'variant');

  return '<tr id="rpt-row-' + idx + '">'
    + '<td style="white-space:nowrap">' + fmtDate(r.date) + '</td>'
    + '<td><strong>' + esc(r.executiveName) + '</strong></td>'
    + '<td class="c">' + r.enquiries      + '</td>'
    + '<td class="c"' + (crmWiTitle ? ' title="' + crmWiTitle + '"' : '') + '>' + r.crmWalkIns     + '</td>'
    + '<td class="c gap ' + eGap.cls + '">' + eGap.txt + '</td>'
    + '<td class="c">' + r.bookingsManual + '</td>'
    + '<td class="c"' + (bookSysTitle ? ' title="' + bookSysTitle + '"' : '') + '>' + r.bookingsSystem + '</td>'
    + '<td class="c gap ' + bGap.cls + '">' + bGap.txt + '</td>'
    + '<td class="c">' + r.salesManual    + '</td>'
    + '<td class="c"' + (saleSysTitle ? ' title="' + saleSysTitle + '"' : '') + '>' + r.salesSystem    + '</td>'
    + '<td class="c gap ' + sGap.cls + '">' + sGap.txt + '</td>'
    + '<td class="c">' + r.googleRatings  + '</td>'
    + '<td class="c">' + r.testRides      + '</td>'
    + '<td class="c"><button class="btn-row-edit" onclick="startEditRow(' + idx + ')">✏️</button></td>'
    + confirmCell
    + '</tr>';
}

// ── Admin inline edit ─────────────────────────────────────────────────────────

function startEditRow(idx) {
  const r   = _reportCache[idx];
  const row = document.getElementById('rpt-row-' + idx);
  if (!row) return;

  const confirmCell = r.confirmedBy
    ? '<td class="c"><div class="confirmed-badge">✅ ' + esc(r.confirmedBy) + '</div></td>'
    : '<td class="c"><button class="btn-row-confirm" onclick="confirmRow(' + idx + ')">✅ Confirm</button></td>';

  row.innerHTML =
    '<td style="white-space:nowrap;font-size:11px">' + fmtDate(r.date) + '</td>'
    + '<td style="font-size:11px"><strong>' + esc(r.executiveName) + '</strong></td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-enq-' + idx + '" value="' + r.enquiries      + '" min="0"></td>'
    + '<td class="c" style="color:#aaa;font-size:11px">'  + r.crmWalkIns     + '</td>'
    + '<td class="c" style="color:#aaa;font-size:10px">—</td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-bm-'  + idx + '" value="' + r.bookingsManual + '" min="0"></td>'
    + '<td class="c" style="color:#aaa;font-size:11px">'  + r.bookingsSystem + '</td>'
    + '<td class="c" style="color:#aaa;font-size:10px">—</td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-sal-' + idx + '" value="' + r.salesManual    + '" min="0"></td>'
    + '<td class="c" style="color:#aaa;font-size:11px">'  + r.salesSystem    + '</td>'
    + '<td class="c" style="color:#aaa;font-size:10px">—</td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-goo-' + idx + '" value="' + r.googleRatings  + '" min="0"></td>'
    + '<td class="c"><input type="number" class="edit-input" id="ei-tr-'  + idx + '" value="' + r.testRides      + '" min="0"></td>'
    + '<td class="c"><button class="btn-edit-save"   onclick="saveEditRow(' + idx + ')">✓</button> '
    +                '<button class="btn-edit-cancel" onclick="renderReportTable()">✗</button></td>'
    + confirmCell;
}

async function saveEditRow(idx) {
  const r = _reportCache[idx];
  const data = {
    enquiries:      numEl('ei-enq-' + idx),
    bookingsManual: numEl('ei-bm-'  + idx),
    sales:          numEl('ei-sal-' + idx),   // maps to salesManual in sheet col F
    googleRatings:  numEl('ei-goo-' + idx),
    testRides:      numEl('ei-tr-'  + idx)
  };
  try {
    const res = await API.adminUpdateDailyActivity(r.date, r.executiveName, data);
    if (!res.success) { showMsg('Update failed: ' + res.message, 'error'); return; }
    _reportCache[idx] = Object.assign({}, r, {
      enquiries:      data.enquiries,
      bookingsManual: data.bookingsManual,
      salesManual:    data.sales,
      googleRatings:  data.googleRatings,
      testRides:      data.testRides,
      bookingGap:     data.bookingsManual - r.bookingsSystem,
      salesGap:       data.sales          - r.salesSystem,
      enquiryGap:     data.enquiries      - r.crmWalkIns
    });
    renderReportTable();
    showMsg('✅ Updated', 'success');
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
}

// ── Admin confirm ─────────────────────────────────────────────────────────────

async function confirmRow(idx) {
  const r = _reportCache[idx];
  try {
    const res = await API.adminConfirmDailyActivity(r.date, r.executiveName);
    if (!res.success) { showMsg('Confirm failed: ' + res.message, 'error'); return; }
    _reportCache[idx] = Object.assign({}, r, {
      confirmedBy: res.confirmedBy,
      confirmedAt: res.confirmedAt
    });
    renderReportTable();
    showMsg('✅ Confirmed by ' + res.confirmedBy, 'success');
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
}

// ── Monthly Engagement report ──────────────────────────────────────────────────

let _engagementCache = { rows: [], totals: null };

async function loadEngagementReport() {
  const month = document.getElementById('eng-month').value;
  if (!month) { showMsg('Select a month', 'error'); return; }

  const tbody = document.getElementById('eng-body');
  const empty = document.getElementById('eng-empty');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888">Loading…</td></tr>';
  empty.style.display = 'none';

  try {
    const res = await API.getMonthlyEngagementReport(month);
    if (!res.success) { showMsg('Failed: ' + res.message, 'error'); return; }

    _engagementCache = { rows: res.rows || [], totals: res.totals || null };

    // Populate executive filter dropdown
    const filterEl = document.getElementById('eng-exec-filter');
    const prevSelection = filterEl.value;
    filterEl.innerHTML = '<option value="">All Executives</option>' +
      _engagementCache.rows.map(function(r) {
        return '<option value="' + esc(r.executive) + '">' + esc(r.executive) + '</option>';
      }).join('');
    filterEl.value = prevSelection && _engagementCache.rows.some(function(r) { return r.executive === prevSelection; })
      ? prevSelection : '';

    if (!_engagementCache.rows.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    renderEngagementTable();
  } catch (e) { showMsg('Error: ' + e.message, 'error'); }
}

function renderEngagementTable() {
  const tbody = document.getElementById('eng-body');
  const selectedExec = document.getElementById('eng-exec-filter').value;

  const rows = selectedExec
    ? _engagementCache.rows.filter(function(r) { return r.executive === selectedExec; })
    : _engagementCache.rows;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No data for this executive.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(function(r) {
    return '<tr>'
      + '<td><strong>' + esc(r.executive) + '</strong></td>'
      + '<td class="c">' + r.enquiries + '</td>'
      + '<td class="c">' + r.sales + '</td>'
      + '<td class="c">' + r.googleReviews + '</td>'
      + '<td class="c">' + r.googlePercent + '%</td>'
      + '<td class="c">' + r.testRides + '</td>'
      + '<td class="c">' + r.testRidePercent + '%</td>'
      + '</tr>';
  }).join('');

  // Show combined totals row only when viewing all executives
  if (!selectedExec && _engagementCache.totals) {
    const t = _engagementCache.totals;
    tbody.innerHTML += '<tr style="font-weight:700;background:#f5f7fa;">'
      + '<td>TOTAL</td>'
      + '<td class="c">' + t.enquiries + '</td>'
      + '<td class="c">' + t.sales + '</td>'
      + '<td class="c">' + t.googleReviews + '</td>'
      + '<td class="c">' + t.googlePercent + '%</td>'
      + '<td class="c">' + t.testRides + '</td>'
      + '<td class="c">' + t.testRidePercent + '%</td>'
      + '</tr>';
  }
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
    return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  } catch(e) { return s; }
}

function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// Builds a hover tooltip string listing customer name, mobile, model/variant (+ financier for bookings/sales)
function detailTitle(list, variantField) {
  if (!list || !list.length) return '';
  return list.map(function(d) {
    const extra = variantField === 'variant' ? [d.model, d.variant].filter(Boolean).join(' ') : d.model;
    const parts = [d.customerName, d.mobileNo].filter(Boolean).join(' - ');
    const finPart = d.financierName ? ' [' + d.financierName + ']' : '';
    return parts + (extra ? ' - ' + extra : '') + finPart;
  }).join('\n').replace(/"/g, '&quot;');
}

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function getNum(id) { const el = document.getElementById(id); return el ? (parseInt(el.value) || 0) : 0; }
function numEl(id)  { const el = document.getElementById(id); return el ? (parseInt(el.value) || 0) : 0; }
function setField(id, val) { const el = document.getElementById(id); if (el) el.value = (val || 0); }

let _msgTimer = null;
function showMsg(msg, type) {
  const el = document.getElementById('msg');
  el.textContent = msg;
  el.className   = 'msg msg-' + (type || 'info');
  el.style.display = 'block';
  clearTimeout(_msgTimer);
  _msgTimer = setTimeout(function() { el.style.display = 'none'; }, 4000);
}
