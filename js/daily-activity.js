// ==========================================
// DAILY ACTIVITY LOG
// Vinay Automobiles
// ==========================================

let currentUser = null;

document.addEventListener('DOMContentLoaded', async function () {
  const session = SessionManager.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;

  document.getElementById('userAvatar').textContent = (currentUser.name || '?')[0].toUpperCase();
  document.getElementById('userName').textContent   = currentUser.name || '';
  document.getElementById('userRole').textContent   = (currentUser.role || '').charAt(0).toUpperCase() + (currentUser.role || '').slice(1);

  const today = new Date();
  document.getElementById('todayLabel').textContent = today.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  if (currentUser.role === 'admin') {
    document.getElementById('adminSection').style.display = 'block';
    setDefaultDates();
    loadAdminReport();
  } else {
    document.getElementById('adminSection').style.display = 'none';
  }

  await loadTodayEntry();
});

// ── Today's Entry (Sales / Admin self-log) ──────────────────────────────────

async function loadTodayEntry() {
  try {
    setFormLoading(true);
    const res = await API.getDailyActivity();
    if (!res.success) { showMsg('Failed to load: ' + res.message, 'error'); return; }

    // Update live booking badge
    document.getElementById('bookingLiveCount').textContent = res.bookingsLive || 0;

    if (res.entry) {
      document.getElementById('inp-enquiries').value     = res.entry.enquiries     || 0;
      document.getElementById('inp-sales').value         = res.entry.sales         || 0;
      document.getElementById('inp-google').value        = res.entry.googleRatings || 0;
      document.getElementById('inp-testrides').value     = res.entry.testRides     || 0;
      document.getElementById('savedBadge').style.display = 'inline-flex';
    }
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
  finally    { setFormLoading(false); }
}

async function saveActivity() {
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const data = {
      enquiries:     parseInt(document.getElementById('inp-enquiries').value)  || 0,
      sales:         parseInt(document.getElementById('inp-sales').value)      || 0,
      googleRatings: parseInt(document.getElementById('inp-google').value)     || 0,
      testRides:     parseInt(document.getElementById('inp-testrides').value)  || 0
    };

    const res = await API.saveDailyActivity(data);
    if (!res.success) { showMsg('Save failed: ' + res.message, 'error'); return; }

    document.getElementById('bookingLiveCount').textContent = res.bookingsLive || 0;
    document.getElementById('savedBadge').style.display = 'inline-flex';
    showMsg('✅ Activity saved!', 'success');
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
  finally {
    btn.disabled = false; btn.textContent = '💾 Save';
  }
}

function setFormLoading(on) {
  ['inp-enquiries','inp-sales','inp-google','inp-testrides','btnSave'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.disabled = on;
  });
}

// ── Admin Report ─────────────────────────────────────────────────────────────

function setDefaultDates() {
  const today = new Date();
  const d6ago = new Date(today); d6ago.setDate(d6ago.getDate() - 6);
  document.getElementById('rpt-from').value = fmtDateInput(d6ago);
  document.getElementById('rpt-to').value   = fmtDateInput(today);
}

async function loadAdminReport() {
  const from = document.getElementById('rpt-from').value;
  const to   = document.getElementById('rpt-to').value;
  if (!from || !to) { showMsg('Select date range', 'error'); return; }

  const tbody = document.getElementById('rpt-body');
  const empty = document.getElementById('rpt-empty');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#888">Loading…</td></tr>';
  empty.style.display = 'none';

  try {
    const res = await API.getDailyActivityReport(from, to);
    if (!res.success) { showMsg('Failed: ' + res.message, 'error'); return; }

    const data = res.data || [];
    if (!data.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    tbody.innerHTML = data.map(function(r) {
      const gapAbs  = Math.abs(r.gap || 0);
      const gapCls  = r.gap > 0 ? 'gap-red' : r.gap < 0 ? 'gap-green' : 'gap-zero';
      const gapTxt  = r.gap > 0 ? '▲ ' + r.gap + ' unlogged' : r.gap < 0 ? '▼ ' + gapAbs + ' extra' : '✓';
      return '<tr>'
        + '<td>' + fmtDateDisplay(r.date) + '</td>'
        + '<td><strong>' + esc(r.executiveName) + '</strong></td>'
        + '<td class="num">' + r.enquiries + '</td>'
        + '<td class="num">' + r.bookings  + '</td>'
        + '<td class="num">' + r.sales     + '</td>'
        + '<td class="num">' + r.googleRatings + '</td>'
        + '<td class="num">' + r.testRides + '</td>'
        + '<td class="num">' + r.crmWalkIns + '</td>'
        + '<td class="num gap-cell ' + gapCls + '">' + gapTxt + '</td>'
        + '</tr>';
    }).join('');
  } catch(e) { showMsg('Error: ' + e.message, 'error'); }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtDateInput(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function fmtDateDisplay(s) {
  if (!s) return '—';
  try {
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  } catch(e) { return s; }
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let _msgTimer = null;
function showMsg(msg, type) {
  const el = document.getElementById('msg');
  el.textContent = msg;
  el.className   = 'msg msg-' + (type || 'info');
  el.style.display = 'block';
  clearTimeout(_msgTimer);
  _msgTimer = setTimeout(function() { el.style.display = 'none'; }, 3500);
}
