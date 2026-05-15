/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · Admin Dashboard Logic
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const sess = window.GX.requireAuth(['admin']);
if (!sess) return;

const { CLASSROOMS, TEACHERS, STUDENTS } = window.GX;

// Mock check-in percentages per class
const MOCK_CHECKIN = { 'cls-a': 83, 'cls-b': 67, 'cls-c': 50 };
const MOCK_ALERTS = [
  { name:'태현', classId:'cls-b', level:'high',  label:'전반적 무감각 + 수면 이슈', action:'오늘 선생님과 직접 대화 권장' },
  { name:'준호', classId:'cls-a', level:'watch', label:'친구 관계 갈등 신호',      action:'쉬는 시간에 가볍게 안부 묻기' },
  { name:'지호', classId:'cls-a', level:'watch', label:'가족 관련 불안 반복',      action:'신뢰하는 어른 연결 고려' },
];

const $ = s => document.querySelector(s);

// Header school name
$('#adm-school-name').textContent = sess.schoolName;
$('#adm-date').textContent = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' });

// Stats
const totalStudents = Object.values(STUDENTS).flat().length;
const avgCheckin = Math.round(Object.values(MOCK_CHECKIN).reduce((a,b)=>a+b,0) / CLASSROOMS.length);
$('#stat-classes').textContent  = CLASSROOMS.length;
$('#stat-students').textContent = totalStudents;
$('#stat-checkin').textContent  = avgCheckin + '%';
$('#stat-alerts').textContent   = MOCK_ALERTS.length;

// Classroom cards
const grid = $('#adm-class-grid');
CLASSROOMS.forEach(cls => {
  const teacher  = TEACHERS.find(t => t.id === cls.teacherId);
  const students = STUDENTS[cls.id] || [];
  const pct      = MOCK_CHECKIN[cls.id] || 0;
  const gradeLabel = cls.grade === 'upper' ? '고등부' : cls.grade === 'lower' ? '초등부' : '중등부';

  const card = document.createElement('div');
  card.className = 'adm-class-card';
  card.innerHTML = `
    <div class="acc-top">
      <div>
        <div class="acc-name">${cls.name}</div>
        <div class="acc-teacher">담임 · ${teacher?.name || '—'} 선생님</div>
      </div>
      <span class="acc-badge">${gradeLabel}</span>
    </div>

    <div class="acc-students">
      ${students.map(s => `<span class="acc-student-chip">${s}</span>`).join('')}
    </div>

    <div class="acc-meter">
      <div class="acc-meter-row">
        <span class="acc-meter-label">오늘 체크인 완료</span>
        <span class="acc-meter-pct">${Math.round(students.length * pct / 100)} / ${students.length}명</span>
      </div>
      <div class="acc-track"><div class="acc-fill" style="width:${pct}%"></div></div>
    </div>

    <div class="acc-actions">
      <button class="acc-btn" data-cls="${cls.id}">학급 통계 보기</button>
      <button class="acc-btn acc-btn--primary" data-cls="${cls.id}" data-teacher="${cls.teacherId}">교실 열기 →</button>
    </div>`;

  grid.appendChild(card);
});

// "교실 열기" → log in as that teacher and go to app.html
grid.addEventListener('click', e => {
  const btn = e.target.closest('[data-teacher]');
  if (!btn) return;
  const cls     = CLASSROOMS.find(c => c.id === btn.dataset.cls);
  const teacher = TEACHERS.find(t => t.id === btn.dataset.teacher);
  if (!cls || !teacher) return;
  window.GX.setSession({
    role: 'admin_view',
    teacherId: teacher.id,
    teacherName: teacher.name,
    classId: cls.id,
    className: cls.name,
    grade: cls.grade,
    adminBack: true,
  });
  window.location.href = 'app.html';
});

// Alert strip
const alertList = $('#adm-alert-list');
MOCK_ALERTS.forEach(a => {
  const cls = CLASSROOMS.find(c => c.id === a.classId);
  const item = document.createElement('div');
  item.className = `adm-alert${a.level === 'high' ? ' adm-alert--high' : ''}`;
  item.innerHTML = `
    <span class="adm-alert-dot"></span>
    <span class="adm-alert-name">${a.name}</span>
    <span class="adm-alert-class">${cls?.name || '—'}</span>
    <span class="adm-alert-label">${a.label}</span>
    <span class="adm-alert-action">${a.action}</span>`;
  alertList.appendChild(item);
});

// Logout
$('#adm-logout').addEventListener('click', () => window.GX.clearSession());

// ── Registration requests ─────────────────────
const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function loadRegistrations() {
  return JSON.parse(localStorage.getItem('growx_registrations') || '[]');
}
function saveRegistrations(regs) {
  localStorage.setItem('growx_registrations', JSON.stringify(regs));
}

function renderRegistrations() {
  const regs    = loadRegistrations();
  const list    = $('#adm-reg-list');
  const counter = $('#adm-reg-count');
  const pending = regs.filter(r => r.status === 'pending').length;
  counter.textContent = pending > 0 ? `(대기 중 ${pending}건)` : '(신청 없음)';

  if (!regs.length) {
    list.innerHTML = `<div class="reg-empty">아직 신청이 없습니다. 학교가 회원가입하면 여기서 확인할 수 있습니다.</div>`;
    return;
  }

  list.innerHTML = regs.slice().reverse().map(r => {
    const date = new Date(r.submittedAt).toLocaleDateString('ko-KR', {year:'numeric',month:'long',day:'numeric'});
    const statusLabel = r.status === 'approved' ? '승인됨' : r.status === 'rejected' ? '거절됨' : '검토 중';
    const clsTags = (r.classrooms||[]).map(c => `<span class="rc-classroom-tag">${esc(c.name)} · ${esc(c.teacherName)}</span>`).join('');
    const isProcessed = r.status !== 'pending';
    return `
      <div class="reg-card reg-card--${r.status}" data-reg-id="${esc(r.id)}">
        <div class="rc-top">
          <div>
            <div class="rc-school">${esc(r.school?.name)}</div>
            <div class="rc-meta">${esc(r.school?.type)} · ${esc(r.school?.region)} · 신청일 ${date}</div>
          </div>
          <span class="rc-status rc-status--${r.status}">${statusLabel}</span>
        </div>
        <div class="rc-info">
          <div class="rc-info-row"><span class="rc-info-label">담당자</span><span class="rc-info-val">${esc(r.contact?.name)} ${esc(r.contact?.role)}</span></div>
          <div class="rc-info-row"><span class="rc-info-label">이메일</span><span class="rc-info-val">${esc(r.contact?.email)}</span></div>
          <div class="rc-info-row"><span class="rc-info-label">연락처</span><span class="rc-info-val">${esc(r.contact?.phone)}</span></div>
          <div class="rc-info-row"><span class="rc-info-label">학급 수</span><span class="rc-info-val">${(r.classrooms||[]).length}개</span></div>
          ${r.contact?.note ? `<div class="rc-info-row" style="grid-column:1/-1"><span class="rc-info-label">문의사항</span><span class="rc-info-val">${esc(r.contact.note)}</span></div>` : ''}
        </div>
        ${clsTags ? `<div class="rc-classrooms">${clsTags}</div>` : ''}
        <div class="rc-actions">
          <button class="rc-btn rc-btn--approve" data-action="approve" data-id="${esc(r.id)}" ${isProcessed?'disabled':''}>✓ 승인</button>
          <button class="rc-btn rc-btn--reject"  data-action="reject",  data-id="${esc(r.id)}" ${isProcessed?'disabled':''}>✗ 거절</button>
        </div>
      </div>`;
  }).join('');

  // Bind approve/reject
  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const regs  = loadRegistrations();
      const reg   = regs.find(r => r.id === btn.dataset.id);
      if (!reg) return;
      reg.status = btn.dataset.action === 'approve' ? 'approved' : 'rejected';
      saveRegistrations(regs);
      renderRegistrations();
    });
  });
}

renderRegistrations();
})();
