/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · School Admin Dashboard
   Manages teachers and classrooms within one school.
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const { api, requireAuth, setSession, clearSession } = window.GX;
const sess = requireAuth(['school_admin']);
if (!sess) return;

const $   = s => document.querySelector(s);
const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$('#sa-school-name').textContent = sess.schoolName;
$('#sa-date').textContent = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
$('#sa-logout').addEventListener('click', clearSession);

const grid = $('#sa-class-grid');
let SCHOOL_DATA = null;
let editingTeacherId = null;

async function load() {
  grid.innerHTML = `<div class="sa-empty">불러오는 중…</div>`;
  try {
    const res = await api('listSchoolData', { schoolId: sess.schoolId });
    if (!res.ok) throw new Error(res.error || 'load failed');
    SCHOOL_DATA = res;
    render();
  } catch (e) {
    grid.innerHTML = `<div class="sa-empty">데이터를 불러올 수 없습니다. ${esc(e.message)}</div>`;
    console.error(e);
  }
}

function render() {
  const { school, teachers, classrooms } = SCHOOL_DATA;

  $('#sa-stat-classes').textContent  = classrooms.length;
  $('#sa-stat-teachers').textContent = teachers.length;
  $('#sa-contact-name').textContent  = school.contactName || '—';
  $('#sa-contact-role').textContent  = school.contactRole || '—';
  $('#sa-school-type').textContent   = school.type || '—';
  $('#sa-school-region').textContent = school.region || '—';

  if (!teachers.length) {
    grid.innerHTML = `<div class="sa-empty">아직 등록된 학급이 없습니다.<br><br>오른쪽 위 <b>+ 학급/교사 추가</b> 버튼을 눌러 첫 번째 학급을 만들어 주세요.</div>`;
    return;
  }

  grid.innerHTML = teachers.map(teacherCardHTML).join('');

  grid.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.edit));
  });
  grid.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteTeacher(btn.dataset.delete));
  });
  grid.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', () => openClass(btn.dataset.open));
  });
}

function teacherCardHTML(t) {
  const cls = SCHOOL_DATA.classrooms.find(c => c.id === t.classId);
  const className = cls ? cls.name : '(학급 없음)';
  const grade     = cls ? cls.grade : '—';
  return `
    <div class="adm-class-card">
      <div class="acc-top">
        <div>
          <div class="acc-name">${esc(className)}</div>
          <div class="acc-teacher">담임 · ${esc(t.name)} 선생님</div>
        </div>
        <span class="acc-badge">${esc(grade)}</span>
      </div>

      <div class="acc-creds">
        <div>📧 ${esc(t.email)}</div>
        <div>🔑 ${esc(t.password)}</div>
      </div>

      <div class="acc-actions">
        <button class="sa-edit-btn"   data-edit="${esc(t.id)}">수정</button>
        <button class="sa-delete-btn" data-delete="${esc(t.id)}">삭제</button>
        <button class="acc-btn acc-btn--primary" data-open="${esc(t.classId)}" style="flex:1">교실 열기 →</button>
      </div>
    </div>`;
}

// ── Modal ──
const modal     = $('#sa-modal');
const modalErr  = $('#sa-modal-err');
const modalSave = $('#sa-modal-save');

$('#sa-add-teacher').addEventListener('click', () => openAddModal());
$('#sa-modal-close').addEventListener('click', closeModal);
$('#sa-modal-cancel').addEventListener('click', closeModal);
$('.sa-modal-backdrop').addEventListener('click', closeModal);
modalSave.addEventListener('click', save);

function openAddModal() {
  editingTeacherId = null;
  $('#sa-modal-title').textContent = '학급/교사 추가';
  $('#sa-class-name').value = '';
  $('#sa-teacher-name').value = '';
  $('#sa-teacher-email').value = '';
  $('#sa-teacher-pw').value = '';
  $('#sa-grade').value = '중등부';
  modalErr.textContent = '';
  modal.style.display = 'flex';
}

function openEditModal(teacherId) {
  const t = SCHOOL_DATA.teachers.find(x => x.id === teacherId);
  if (!t) return;
  const cls = SCHOOL_DATA.classrooms.find(c => c.id === t.classId);
  editingTeacherId = teacherId;
  $('#sa-modal-title').textContent = '학급/교사 수정';
  $('#sa-class-name').value    = cls ? cls.name : '';
  $('#sa-teacher-name').value  = t.name || '';
  $('#sa-teacher-email').value = t.email || '';
  $('#sa-teacher-pw').value    = t.password || '';
  $('#sa-grade').value         = cls ? cls.grade : '중등부';
  modalErr.textContent = '';
  modal.style.display = 'flex';
}

function closeModal() {
  modal.style.display = 'none';
  editingTeacherId = null;
}

async function save() {
  modalErr.textContent = '';
  const className   = $('#sa-class-name').value.trim();
  const teacherName = $('#sa-teacher-name').value.trim();
  const email       = $('#sa-teacher-email').value.trim();
  const password    = $('#sa-teacher-pw').value.trim();
  const grade       = $('#sa-grade').value;

  if (!className)   { modalErr.textContent = '학급 이름을 입력해주세요.'; return; }
  if (!teacherName) { modalErr.textContent = '교사 이름을 입력해주세요.'; return; }
  if (!email || !email.includes('@')) { modalErr.textContent = '교사 이메일을 올바르게 입력해주세요.'; return; }
  if (password.length < 6) { modalErr.textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }

  modalSave.disabled = true;
  modalSave.textContent = '저장 중…';

  try {
    let res;
    if (editingTeacherId) {
      res = await api('updateTeacher', {
        teacherId: editingTeacherId,
        updates: { name: teacherName, email, password, className, grade },
      });
    } else {
      res = await api('createTeacher', {
        schoolId: sess.schoolId,
        name: teacherName, email, password,
        className, grade,
      });
    }
    if (!res.ok) {
      modalErr.textContent = res.error || '저장에 실패했습니다.';
      return;
    }
    closeModal();
    await load();
  } catch (e) {
    modalErr.textContent = '서버 오류: ' + e.message;
  } finally {
    modalSave.disabled = false;
    modalSave.textContent = '저장';
  }
}

async function deleteTeacher(teacherId) {
  const t = SCHOOL_DATA.teachers.find(x => x.id === teacherId);
  if (!t) return;
  if (!confirm(`${t.name} 선생님과 해당 학급(학생 포함)을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
  try {
    const res = await api('deleteTeacher', { teacherId });
    if (!res.ok) throw new Error(res.error || 'delete failed');
    await load();
  } catch (e) {
    alert('삭제 실패: ' + e.message);
  }
}

function openClass(classId) {
  const cls = SCHOOL_DATA.classrooms.find(c => c.id === classId);
  const t   = SCHOOL_DATA.teachers.find(x => x.classId === classId);
  if (!cls || !t) return;
  setSession({
    role: 'admin_view',
    teacherId: t.id,
    teacherName: t.name,
    classId: cls.id,
    className: cls.name,
    grade: cls.grade,
    schoolId: sess.schoolId,
    schoolName: sess.schoolName,
    adminBack: 'school-admin.html',
  });
  window.location.href = 'app.html';
}

load();
})();
