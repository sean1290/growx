/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · Auth / Shared Account Data
   All account data lives here; session stored in localStorage.
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const SCHOOL = { id:'growx001', name:'Grow X 기독학교', password:'school2026' };

const CLASSROOMS = [
  { id:'cls-a', name:'중등부 1반', teacherId:'t001', grade:'middle' },
  { id:'cls-b', name:'중등부 2반', teacherId:'t002', grade:'middle' },
  { id:'cls-c', name:'고등부 1반', teacherId:'t003', grade:'upper'  },
];

const TEACHERS = [
  { id:'t001', name:'김하나', classId:'cls-a', password:'teacher01' },
  { id:'t002', name:'이은혜', classId:'cls-b', password:'teacher02' },
  { id:'t003', name:'박믿음', classId:'cls-c', password:'teacher03' },
];

const STUDENTS = {
  'cls-a': ['김폭스','준호','민지','서윤','지호','예은'],
  'cls-b': ['태현','하은','도윤','수빈','재원','유진'],
  'cls-c': ['성민','지아','현우','소연','민준','지수'],
};

const KEY = 'growx_session';

function getSession() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; }
  catch { return null; }
}

function setSession(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem(KEY);
  window.location.href = 'login.html';
}

function requireAuth(allowedRoles) {
  const sess = getSession();
  if (!sess || !allowedRoles.includes(sess.role)) {
    window.location.href = 'login.html';
    return null;
  }
  return sess;
}

window.GX = { SCHOOL, CLASSROOMS, TEACHERS, STUDENTS, getSession, setSession, clearSession, requireAuth };
})();
