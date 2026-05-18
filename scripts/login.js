/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · Login Page Logic
   Email + password → routed by role from backend.
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const { api, setSession, getSession, clearSession } = window.GX;

// Already logged in → redirect
const existing = getSession();
if (existing) {
  routeByRole(existing.role);
}

const form     = document.getElementById('login-form');
const emailEl  = document.getElementById('login-email');
const pwEl     = document.getElementById('login-pw');
const errEl    = document.getElementById('login-err');
const submitEl = document.getElementById('login-submit');

form.addEventListener('submit', async e => {
  e.preventDefault();
  errEl.textContent = '';
  const email = emailEl.value.trim();
  const pw    = pwEl.value;
  if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }

  submitEl.disabled = true;
  submitEl.innerHTML = '확인 중…';

  try {
    const res = await api('login', { email, password: pw });
    if (!res.ok) {
      errEl.textContent = res.error || '로그인에 실패했습니다.';
      pwEl.value = '';
      return;
    }
    const { role } = res;
    const sess = { ...res };
    delete sess.ok;
    setSession(sess);
    routeByRole(role);
  } catch (err) {
    errEl.textContent = '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
    console.error(err);
  } finally {
    submitEl.disabled = false;
    submitEl.innerHTML = '로그인 <span aria-hidden="true">→</span>';
  }
});

function routeByRole(role) {
  if (role === 'super_admin')  window.location.href = 'admin.html';
  else if (role === 'school_admin') window.location.href = 'school-admin.html';
  else if (role === 'teacher') window.location.href = 'app.html';
  else clearSession();
}
})();
