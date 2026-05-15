/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · Login Page Logic
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const { SCHOOL, CLASSROOMS, TEACHERS, setSession, getSession } = window.GX;

// If already logged in, redirect
const existing = getSession();
if (existing) {
  window.location.href = existing.role === 'admin' ? 'admin.html' : 'app.html';
}

// Populate classroom dropdown
const clsSel = document.getElementById('teacher-class-select');
CLASSROOMS.forEach(c => {
  const t = TEACHERS.find(t => t.id === c.teacherId);
  const opt = document.createElement('option');
  opt.value = c.id;
  opt.textContent = `${c.name} · ${t?.name || ''} 담임`;
  clsSel.appendChild(opt);
});

// Role tab switching
const tabs = document.querySelectorAll('.role-tab');
const teacherForm = document.getElementById('teacher-login-form');
const adminForm   = document.getElementById('admin-login-form');
let activeRole = 'teacher';

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activeRole = tab.dataset.role;
    tabs.forEach(t => t.classList.toggle('is-active', t === tab));
    teacherForm.style.display = activeRole === 'teacher' ? '' : 'none';
    adminForm.style.display   = activeRole === 'admin'   ? '' : 'none';
  });
});

// Teacher login
teacherForm.addEventListener('submit', e => {
  e.preventDefault();
  const classId = clsSel.value;
  const pw      = document.getElementById('teacher-pw').value;
  const err     = document.getElementById('teacher-err');
  err.textContent = '';

  if (!classId) { err.textContent = '학급을 선택해주세요.'; return; }

  const cls     = CLASSROOMS.find(c => c.id === classId);
  const teacher = TEACHERS.find(t => t.id === cls?.teacherId);

  if (!teacher || teacher.password !== pw) {
    err.textContent = '비밀번호가 맞지 않습니다.';
    document.getElementById('teacher-pw').value = '';
    return;
  }

  setSession({ role:'teacher', teacherId:teacher.id, teacherName:teacher.name, classId, className:cls.name, grade:cls.grade });
  window.location.href = 'app.html';
});

// Admin login
adminForm.addEventListener('submit', e => {
  e.preventDefault();
  const pw  = document.getElementById('admin-pw').value;
  const err = document.getElementById('admin-err');
  err.textContent = '';

  if (pw !== SCHOOL.password) {
    err.textContent = '비밀번호가 맞지 않습니다.';
    document.getElementById('admin-pw').value = '';
    return;
  }

  setSession({ role:'admin', schoolId:SCHOOL.id, schoolName:SCHOOL.name });
  window.location.href = 'admin.html';
});
})();
