/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · Signup Logic
   Submits registrations to backend (Google Sheets).
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

const { api } = window.GX;

const STEPS = [
  { num:1, label:'학교 정보'   },
  { num:2, label:'담당자 정보' },
  { num:3, label:'계정 설정'   },
];

const SCHOOL_TYPES  = ['초등학교','중학교','고등학교','초중통합','중고통합','기독교 홈스쿨 협동조합','기타'];
const REGIONS       = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];
const CONTACT_ROLES = ['교장','교감','부장교사','담임교사','행정실장','기타'];

let step = 1;

const state = {
  school:  {},
  contact: {},
  account: {},
};

const stepsEl   = document.getElementById('su-steps');
const formBody  = document.getElementById('su-form-body');
const cardFoot  = document.getElementById('su-card-foot');
const successEl = document.getElementById('su-success');

function renderSteps() {
  stepsEl.innerHTML = STEPS.map(s => `
    <div class="su-step ${s.num < step ? 'is-done' : s.num === step ? 'is-active' : ''}">
      <div class="ss-num">${s.num < step ? '✓' : s.num}</div>
      <div class="ss-label">${s.label}</div>
    </div>`).join('');
}

function renderStep() {
  renderSteps();
  if (step === 1) renderSchoolStep();
  if (step === 2) renderContactStep();
  if (step === 3) renderAccountStep();

  cardFoot.innerHTML = `
    <button class="su-btn-back" id="btn-back">${step === 1 ? '← 로그인으로' : '← 이전'}</button>
    <button class="su-btn-next" id="btn-next">${step === 3 ? '신청 완료 →' : '다음 →'}</button>`;
  document.getElementById('btn-back').addEventListener('click', onBack);
  document.getElementById('btn-next').addEventListener('click', onNext);
}

function renderSchoolStep() {
  formBody.innerHTML = `
    <div class="su-section-title">학교 / 기관 정보</div>
    <div class="su-grid">
      <div class="su-field su-col-full">
        <label class="su-label">학교·기관 이름 <span class="req">*</span></label>
        <input class="su-input" id="f-school-name" placeholder="예: 새로남기독학교" value="${esc(state.school.name||'')}">
      </div>
      <div class="su-field">
        <label class="su-label">학교 유형 <span class="req">*</span></label>
        <div class="su-select-wrap">
          <select class="su-select" id="f-school-type">
            <option value="">— 선택 —</option>
            ${SCHOOL_TYPES.map(t => `<option value="${esc(t)}" ${state.school.type===t?'selected':''}>${esc(t)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="su-field">
        <label class="su-label">지역 <span class="req">*</span></label>
        <div class="su-select-wrap">
          <select class="su-select" id="f-school-region">
            <option value="">— 선택 —</option>
            ${REGIONS.map(r => `<option value="${esc(r)}" ${state.school.region===r?'selected':''}>${esc(r)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="su-field">
        <label class="su-label">학교 대표 전화</label>
        <input class="su-input" id="f-school-phone" type="tel" placeholder="02-0000-0000" value="${esc(state.school.phone||'')}">
      </div>
      <div class="su-field">
        <label class="su-label">학교 홈페이지</label>
        <input class="su-input" id="f-school-website" placeholder="https://" value="${esc(state.school.website||'')}">
      </div>
    </div>
    <div class="su-err" id="step-err"></div>`;
}

function renderContactStep() {
  formBody.innerHTML = `
    <div class="su-section-title">담당자 정보 <span style="font-weight:400;color:var(--fg-mute);font-size:12px">— 이 분이 학교 관리자가 됩니다</span></div>
    <div class="su-grid">
      <div class="su-field">
        <label class="su-label">담당자 이름 <span class="req">*</span></label>
        <input class="su-input" id="f-contact-name" placeholder="홍길동" value="${esc(state.contact.name||'')}">
      </div>
      <div class="su-field">
        <label class="su-label">직책 <span class="req">*</span></label>
        <div class="su-select-wrap">
          <select class="su-select" id="f-contact-role">
            <option value="">— 선택 —</option>
            ${CONTACT_ROLES.map(r => `<option value="${esc(r)}" ${state.contact.role===r?'selected':''}>${esc(r)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="su-field">
        <label class="su-label">이메일 (로그인 ID) <span class="req">*</span></label>
        <input class="su-input" id="f-contact-email" type="email" placeholder="example@school.kr" value="${esc(state.contact.email||'')}">
      </div>
      <div class="su-field">
        <label class="su-label">연락처 <span class="req">*</span></label>
        <input class="su-input" id="f-contact-phone" type="tel" placeholder="010-0000-0000" value="${esc(state.contact.phone||'')}">
      </div>
      <div class="su-field su-col-full">
        <label class="su-label">도입 목적 / 기타 문의사항</label>
        <textarea class="su-textarea" id="f-contact-note" placeholder="예: 중학교 전학년 정서 돌봄 프로그램으로 도입 예정입니다.">${esc(state.contact.note||'')}</textarea>
      </div>
    </div>
    <div class="su-err" id="step-err"></div>`;
}

function renderAccountStep() {
  formBody.innerHTML = `
    <div class="su-section-title">관리자 계정 설정</div>
    <div style="margin-bottom:18px;padding:12px 14px;background:var(--soft-bg);border:1px solid rgba(29,89,240,0.12);border-radius:var(--r-md);font-size:12px;color:var(--ink-2);line-height:1.6">
      로그인 ID: <b>${esc(state.contact.email || '')}</b>
    </div>
    <div class="su-grid su-grid--full">
      <div class="su-field">
        <label class="su-label">관리자 비밀번호 <span class="req">*</span></label>
        <input class="su-input" id="f-pw" type="password" placeholder="영문+숫자 8자 이상" autocomplete="new-password">
        <div class="su-pw-hint">영문, 숫자 조합 8자 이상을 권장합니다.</div>
      </div>
      <div class="su-field">
        <label class="su-label">비밀번호 확인 <span class="req">*</span></label>
        <input class="su-input" id="f-pw-confirm" type="password" placeholder="동일하게 입력" autocomplete="new-password">
      </div>
    </div>

    <div style="margin-top:8px;margin-bottom:20px;padding:14px 16px;background:var(--soft-bg);border:1px solid rgba(29,89,240,0.12);border-radius:var(--r-md);font-size:12px;color:var(--fg-mute);line-height:1.7">
      ℹ️ 신청 후 Grow X 팀이 검토하여 24시간 이내 승인 처리합니다.<br>
      승인 완료 후 위 이메일과 비밀번호로 로그인하여 학급/교사를 설정하실 수 있습니다.
    </div>

    <div class="su-agree-list">
      <label class="su-agree">
        <input type="checkbox" id="agree-terms">
        <span class="su-agree-text"><b>[필수]</b> <a href="#">이용약관</a>에 동의합니다.</span>
      </label>
      <label class="su-agree">
        <input type="checkbox" id="agree-privacy">
        <span class="su-agree-text"><b>[필수]</b> <a href="#">개인정보 처리방침</a>에 동의하며, 학생 정서 데이터의 수집·활용에 학교 차원의 동의를 확인했습니다.</span>
      </label>
      <label class="su-agree">
        <input type="checkbox" id="agree-marketing">
        <span class="su-agree-text">[선택] Grow X SSEL 업데이트 및 교육 자료를 이메일로 받겠습니다.</span>
      </label>
    </div>
    <div class="su-err" id="step-err"></div>`;
}

function validateAndSave() {
  const err = document.getElementById('step-err');
  err.textContent = '';

  if (step === 1) {
    const name   = document.getElementById('f-school-name').value.trim();
    const type   = document.getElementById('f-school-type').value;
    const region = document.getElementById('f-school-region').value;
    if (!name)   { err.textContent = '학교 이름을 입력해주세요.'; return false; }
    if (!type)   { err.textContent = '학교 유형을 선택해주세요.'; return false; }
    if (!region) { err.textContent = '지역을 선택해주세요.'; return false; }
    state.school = {
      name, type, region,
      phone:   document.getElementById('f-school-phone').value.trim(),
      website: document.getElementById('f-school-website').value.trim(),
    };
    return true;
  }

  if (step === 2) {
    const name  = document.getElementById('f-contact-name').value.trim();
    const role  = document.getElementById('f-contact-role').value;
    const email = document.getElementById('f-contact-email').value.trim();
    const phone = document.getElementById('f-contact-phone').value.trim();
    if (!name)  { err.textContent = '담당자 이름을 입력해주세요.'; return false; }
    if (!role)  { err.textContent = '직책을 선택해주세요.'; return false; }
    if (!email || !email.includes('@')) { err.textContent = '이메일을 올바르게 입력해주세요.'; return false; }
    if (!phone) { err.textContent = '연락처를 입력해주세요.'; return false; }
    state.contact = { name, role, email, phone, note: document.getElementById('f-contact-note').value.trim() };
    return true;
  }

  if (step === 3) {
    const pw      = document.getElementById('f-pw').value;
    const pwConf  = document.getElementById('f-pw-confirm').value;
    const terms   = document.getElementById('agree-terms').checked;
    const privacy = document.getElementById('agree-privacy').checked;
    if (pw.length < 8) { err.textContent = '비밀번호는 8자 이상이어야 합니다.'; return false; }
    if (pw !== pwConf) { err.textContent = '비밀번호가 일치하지 않습니다.'; return false; }
    if (!terms)   { err.textContent = '이용약관에 동의해주세요.'; return false; }
    if (!privacy) { err.textContent = '개인정보 처리방침에 동의해주세요.'; return false; }
    state.account = { password: pw, marketing: document.getElementById('agree-marketing').checked };
    return true;
  }
  return true;
}

function onNext() {
  if (!validateAndSave()) return;
  if (step < 3) { step++; renderStep(); window.scrollTo({top:0,behavior:'smooth'}); }
  else submitRegistration();
}

function onBack() {
  if (step > 1) { step--; renderStep(); window.scrollTo({top:0,behavior:'smooth'}); }
  else window.location.href = 'login.html';
}

async function submitRegistration() {
  const btn = document.getElementById('btn-next');
  const err = document.getElementById('step-err');
  btn.disabled = true;
  btn.textContent = '제출 중…';
  err.textContent = '';

  try {
    const res = await api('registerSchool', {
      school:   state.school,
      contact:  state.contact,
      password: state.account.password,
      marketing: state.account.marketing,
    });
    if (!res.ok) {
      err.textContent = res.error || '신청 제출에 실패했습니다.';
      btn.disabled = false;
      btn.textContent = '신청 완료 →';
      return;
    }
    showSuccess({ id: res.id });
  } catch (e) {
    err.textContent = '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
    btn.disabled = false;
    btn.textContent = '신청 완료 →';
    console.error(e);
  }
}

function showSuccess(reg) {
  document.getElementById('su-card-head').style.display = 'none';
  document.querySelector('.su-steps').style.display = 'none';
  formBody.style.display = 'none';
  cardFoot.style.display = 'none';
  successEl.style.display = 'flex';
  successEl.innerHTML = `
    <div class="su-success-icon">🎉</div>
    <div class="su-success-title">신청이 접수되었습니다!</div>
    <div class="su-success-sub">
      Grow X 팀이 검토 후 <b>24시간 이내</b>에 연락드립니다.<br>
      승인 완료 후 로그인하실 수 있습니다.
    </div>
    <div class="su-success-info">
      <div class="sui-row"><span class="sui-label">학교명</span><span class="sui-val">${esc(state.school.name)}</span></div>
      <div class="sui-row"><span class="sui-label">담당자</span><span class="sui-val">${esc(state.contact.name)} ${esc(state.contact.role)}</span></div>
      <div class="sui-row"><span class="sui-label">로그인 ID</span><span class="sui-val">${esc(state.contact.email)}</span></div>
      <div class="sui-row"><span class="sui-label">신청 번호</span><span class="sui-val" style="font-size:11px;color:var(--fg-mute)">${esc(reg.id)}</span></div>
    </div>
    <a href="login.html" style="margin-top:8px;font-size:13px;color:var(--twilight-2);text-decoration:none">← 로그인 페이지로 돌아가기</a>`;
}

const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

renderStep();
})();
