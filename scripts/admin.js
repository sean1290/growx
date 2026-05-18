/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · Super Admin (Grow X 운영팀) Dashboard
   Reviews school registrations from the backend.
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const { api, requireAuth, clearSession } = window.GX;
const sess = requireAuth(['super_admin']);
if (!sess) return;

const $ = s => document.querySelector(s);
const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$('#adm-date').textContent = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
$('#adm-logout').addEventListener('click', clearSession);

const regList = $('#adm-reg-list');
const approvedList = $('#adm-approved-list');

async function load() {
  regList.innerHTML = `<div class="reg-empty">불러오는 중…</div>`;
  approvedList.innerHTML = '';
  try {
    const res = await api('listRegistrations');
    if (!res.ok) throw new Error(res.error || 'load failed');
    render(res.rows || []);
  } catch (e) {
    regList.innerHTML = `<div class="reg-empty">데이터를 불러올 수 없습니다. ${esc(e.message)}</div>`;
    console.error(e);
  }
}

function render(rows) {
  const pending  = rows.filter(r => r.status === 'pending');
  const approved = rows.filter(r => r.status === 'approved');
  const rejected = rows.filter(r => r.status === 'rejected');

  $('#stat-pending').textContent  = pending.length;
  $('#stat-approved').textContent = approved.length;
  $('#stat-rejected').textContent = rejected.length;
  $('#stat-total').textContent    = rows.length;

  // Pending + recent decisions
  const counter = $('#adm-reg-count');
  counter.textContent = pending.length > 0 ? `(대기 중 ${pending.length}건)` : '(신청 없음)';

  const recent = rows.slice().sort((a,b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  const pendingOrRecent = pending.length ? pending : recent.slice(0, 5);

  if (!rows.length) {
    regList.innerHTML = `<div class="reg-empty">아직 신청이 없습니다. signup.html에서 신청하면 여기에 표시됩니다.</div>`;
  } else if (!pending.length) {
    regList.innerHTML = `<div class="reg-empty">검토 대기 중인 신청이 없습니다.</div>`;
  } else {
    regList.innerHTML = pending.map(regCardHTML).join('');
    regList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => decide(btn.dataset.id, btn.dataset.action));
    });
  }

  // Approved schools
  if (!approved.length) {
    approvedList.innerHTML = `<div class="reg-empty">아직 승인된 학교가 없습니다.</div>`;
  } else {
    approvedList.innerHTML = approved.map(approvedCardHTML).join('');
    approvedList.querySelectorAll('[data-school-id]').forEach(card => {
      card.addEventListener('click', () => {
        window.location.href = 'admin-school.html?id=' + encodeURIComponent(card.dataset.schoolId);
      });
    });
  }
}

function regCardHTML(r) {
  const date = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'}) : '—';
  return `
    <div class="reg-card reg-card--${esc(r.status)}" data-reg-id="${esc(r.id)}">
      <div class="rc-top">
        <div>
          <div class="rc-school">${esc(r.name)}</div>
          <div class="rc-meta">${esc(r.type)} · ${esc(r.region)} · 신청일 ${date}</div>
        </div>
        <span class="rc-status rc-status--${esc(r.status)}">검토 중</span>
      </div>
      <div class="rc-info">
        <div class="rc-info-row"><span class="rc-info-label">담당자</span><span class="rc-info-val">${esc(r.contactName)} ${esc(r.contactRole)}</span></div>
        <div class="rc-info-row"><span class="rc-info-label">로그인 ID</span><span class="rc-info-val">${esc(r.adminEmail)}</span></div>
        <div class="rc-info-row"><span class="rc-info-label">연락처</span><span class="rc-info-val">${esc(r.contactPhone)}</span></div>
        <div class="rc-info-row"><span class="rc-info-label">학교 전화</span><span class="rc-info-val">${esc(r.phone) || '—'}</span></div>
        ${r.contactNote ? `<div class="rc-info-row" style="grid-column:1/-1"><span class="rc-info-label">문의사항</span><span class="rc-info-val">${esc(r.contactNote)}</span></div>` : ''}
      </div>
      <div class="rc-actions">
        <button class="rc-btn rc-btn--approve" data-action="approve" data-id="${esc(r.id)}">✓ 승인</button>
        <button class="rc-btn rc-btn--reject"  data-action="reject"  data-id="${esc(r.id)}">✗ 거절</button>
      </div>
    </div>`;
}

function approvedCardHTML(r) {
  const date = r.decidedAt ? new Date(r.decidedAt).toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'}) : '—';
  return `
    <div class="reg-card reg-card--approved reg-card--clickable" data-school-id="${esc(r.id)}">
      <div class="rc-top">
        <div>
          <div class="rc-school">${esc(r.name)}</div>
          <div class="rc-meta">${esc(r.type)} · ${esc(r.region)} · 승인일 ${date}</div>
        </div>
        <span class="rc-status rc-status--approved">승인됨</span>
      </div>
      <div class="rc-info">
        <div class="rc-info-row"><span class="rc-info-label">담당자</span><span class="rc-info-val">${esc(r.contactName)} ${esc(r.contactRole)}</span></div>
        <div class="rc-info-row"><span class="rc-info-label">로그인 ID</span><span class="rc-info-val">${esc(r.adminEmail)}</span></div>
        <div class="rc-info-row"><span class="rc-info-label">연락처</span><span class="rc-info-val">${esc(r.contactPhone)}</span></div>
      </div>
    </div>`;
}

async function decide(id, action) {
  const decision = action === 'approve' ? 'approve' : 'reject';
  const buttons = regList.querySelectorAll(`[data-id="${id}"]`);
  buttons.forEach(b => b.disabled = true);
  try {
    const res = await api('decideRegistration', { id, decision });
    if (!res.ok) throw new Error(res.error || 'failed');
    await load();
  } catch (e) {
    alert('처리에 실패했습니다: ' + e.message);
    buttons.forEach(b => b.disabled = false);
  }
}

load();
})();
