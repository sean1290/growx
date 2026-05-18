/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · Auth + Backend Client
   Talks to Google Apps Script web app for all data.
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const API_URL = 'https://script.google.com/macros/s/AKfycbzQeAyeF99u6SQCT2CG3x0TmAjH-Bedtc17kTJsxYbYUaf0JS8IM1PzAuTHdk5OWp7h/exec';

const KEY = 'growx_session';

async function api(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}

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

window.GX = { api, getSession, setSession, clearSession, requireAuth };
})();
