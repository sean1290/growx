/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · School Profile (super admin view)
   Reads schoolId from URL ?id=<schoolId>
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const { api, requireAuth, clearSession } = window.GX;
const sess = requireAuth(['super_admin']);
if (!sess) return;

const $   = s => document.querySelector(s);
const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$('#adm-logout').addEventListener('click', clearSession);

const params = new URLSearchParams(location.search);
const schoolId = params.get('id');
if (!schoolId) {
  $('#asp-title').textContent = '학교 ID가 필요합니다';
  return;
}

async function load() {
  try {
    const res = await api('getSchoolProfile', { schoolId });
    if (!res.ok) throw new Error(res.error || 'load failed');
    render(res);
  } catch (e) {
    $('#asp-title').textContent = '불러오기 실패';
    $('#asp-sub').textContent = e.message;
    console.error(e);
  }
}

function render(d) {
  const { school, teachers, classrooms, students, recentCheckIns, totalCheckIns } = d;

  $('#asp-eyebrow').textContent = `${school.type || '—'} · ${school.region || '—'}`;
  $('#asp-title').textContent   = school.name;
  $('#asp-sub').textContent     = `승인일 ${school.decidedAt ? new Date(school.decidedAt).toLocaleDateString('ko-KR') : '—'} · 신청일 ${school.submittedAt ? new Date(school.submittedAt).toLocaleDateString('ko-KR') : '—'}`;

  const statusLabel = school.status === 'approved' ? '승인됨' : school.status === 'rejected' ? '거절됨' : '검토 중';
  const statusEl = $('#asp-status');
  statusEl.textContent = statusLabel;
  statusEl.className = `rc-status rc-status--${school.status}`;

  $('#asp-classes').textContent  = classrooms.length;
  $('#asp-teachers').textContent = teachers.length;
  $('#asp-students').textContent = students.length;
  $('#asp-checkins').textContent = totalCheckIns || 0;

  const today = new Date().toISOString().slice(0,10);
  const todayCount = recentCheckIns.filter(r => String(r['제출 시각']).startsWith(today)).length;
  $('#asp-checkin-sub').textContent = todayCount > 0 ? `오늘 ${todayCount}건` : '오늘 0건';

  // School info card
  $('#asp-info-grid').innerHTML = `
    <div class="rc-info-row"><span class="rc-info-label">담당자</span><span class="rc-info-val">${esc(school.contactName)} ${esc(school.contactRole)}</span></div>
    <div class="rc-info-row"><span class="rc-info-label">로그인 이메일</span><span class="rc-info-val">${esc(school.adminEmail)}</span></div>
    <div class="rc-info-row"><span class="rc-info-label">담당자 연락처</span><span class="rc-info-val">${esc(school.contactPhone)}</span></div>
    <div class="rc-info-row"><span class="rc-info-label">학교 대표 전화</span><span class="rc-info-val">${esc(school.phone) || '—'}</span></div>
    <div class="rc-info-row"><span class="rc-info-label">홈페이지</span><span class="rc-info-val">${school.website ? `<a href="${esc(school.website)}" target="_blank" rel="noopener">${esc(school.website)}</a>` : '—'}</span></div>
    ${school.contactNote ? `<div class="rc-info-row" style="grid-column:1/-1"><span class="rc-info-label">신청 시 문의사항</span><span class="rc-info-val">${esc(school.contactNote)}</span></div>` : ''}
  `;

  // Classrooms
  const classGrid = $('#asp-class-grid');
  if (!classrooms.length) {
    classGrid.innerHTML = `<div class="sa-empty">아직 등록된 학급이 없습니다. 학교 관리자(${esc(school.adminEmail)})가 학급을 추가하면 여기에 표시됩니다.</div>`;
  } else {
    classGrid.innerHTML = classrooms.map(cls => {
      const teacher  = teachers.find(t => t.classId === cls.id);
      const classKids = students.filter(s => s.classId === cls.id);
      const classCheckIns = recentCheckIns.filter(r => r['학급'] === cls.name).length;
      return `
        <div class="adm-class-card">
          <div class="acc-top">
            <div>
              <div class="acc-name">${esc(cls.name)}</div>
              <div class="acc-teacher">담임 · ${teacher ? esc(teacher.name) + ' 선생님' : '미지정'}</div>
            </div>
            <span class="acc-badge">${esc(cls.grade)}</span>
          </div>
          <div class="acc-students">
            ${classKids.length ? classKids.map(s => `<span class="acc-student-chip">${esc(s.name)}</span>`).join('') : '<span style="font-size:11px;color:var(--fg-mute)">학생 없음</span>'}
          </div>
          <div class="acc-meter">
            <div class="acc-meter-row">
              <span class="acc-meter-label">최근 체크인 (최근 30건 중)</span>
              <span class="acc-meter-pct">${classCheckIns}건</span>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // Recent check-ins
  const recentList = $('#asp-recent-list');
  $('#asp-recent-count').textContent = recentCheckIns.length ? `(최근 ${recentCheckIns.length}건)` : '(아직 활동 없음)';
  if (!recentCheckIns.length) {
    recentList.innerHTML = `<div class="sa-empty">아직 학생들의 체크인 기록이 없습니다.</div>`;
  } else {
    recentList.innerHTML = `
      <div class="reg-card reg-card--approved" style="padding:0;overflow:hidden">
        <table class="asp-activity">
          <thead>
            <tr>
              <th>시각</th>
              <th>유형</th>
              <th>학급</th>
              <th>학생</th>
              <th>감정</th>
              <th>원인 / 관계</th>
            </tr>
          </thead>
          <tbody>
            ${recentCheckIns.map(r => `
              <tr>
                <td>${esc(String(r['제출 시각'] || '').replace('T', ' ').slice(0, 16))}</td>
                <td><span class="asp-tag asp-tag--${r.type}">${r.type === 'arrival' ? '등교' : '하교'}</span></td>
                <td>${esc(r['학급'] || '')}</td>
                <td>${esc(r['학생'] || '')}</td>
                <td>${esc(r['감정'] || '')}</td>
                <td>${esc(r['원인'] || r['관계'] || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

load();
})();
