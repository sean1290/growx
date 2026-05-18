/* ─────────────────────────────────────────────────────────────
   Grow X SSEL · Workspace (v0.4)
   Auth-aware: teacher auto-login, student list from session class
   ───────────────────────────────────────────────────────────── */

(() => {
'use strict';

// ════════════════════════════════════════════════════════════
// AUTH — require session
// ════════════════════════════════════════════════════════════

const _sess = window.GX.requireAuth(['teacher', 'admin_view', 'student']);
if (!_sess) return;

const SESSION = _sess;
const STUDENT_OBJS = [];  // populated async; each: {id, name}

const ARRIVAL_COL_MAP = {
  valence_arousal:   '에너지',
  primary_emotion:   '감정',
  arrival_body_zone: '몸의 위치',
  cause:             '원인',
  prayer_plan:       '한 줄 기도',
};
const DEPARTURE_COL_MAP = {
  dep_primary:      '감정',
  dep_secondary:    '세부 감정',
  body_zone:        '몸의 위치',
  reg_strategy:     '조절 전략',
  social_quality:   '관계',
  mission_feedback: '미션 피드백',
  strength_moment:  '자랑스러운 순간',
  goal:             '내일 다짐',
  thanksgiving:     '감사',
};

function paraphraseAnswer(q, val) {
  if (val === undefined || val === null || val === '') return '';
  switch (q.type) {
    case 'arousal': {
      const labels = ['','아주 낮음','낮음','보통','높음','아주 높음'];
      return labels[val] || String(val);
    }
    case 'emotion_primary': {
      const e = EMO_PRIMARY.find(x => x.id === val);
      return e ? e.label : String(val);
    }
    case 'emotion_secondary': {
      for (const arr of Object.values(EMO_SECONDARY)) {
        const m = arr.find(x => x.id === val);
        if (m) return m.label;
      }
      return String(val);
    }
    case 'body': {
      const arr = Array.isArray(val) ? val : [val];
      return arr.map(id => {
        const z = BODY_ZONES.find(x => x.id === id);
        return z ? z.label : id;
      }).join(', ');
    }
    case 'regulation': {
      const arr = Array.isArray(val) ? val : [val];
      return arr.map(id => {
        const r = REG_STRATEGIES.find(x => x.id === id);
        return r ? r.name : id;
      }).join(', ');
    }
    case 'chips': {
      return Array.isArray(val) ? val.join(', ') : String(val);
    }
    case 'slider': {
      const labels = q.labels || [];
      if (typeof val === 'number') return labels[val] || String(val);
      return String(val);
    }
    case 'text': return String(val);
    case 'mission_feedback': {
      if (val && typeof val === 'object') {
        const parts = [];
        if (val.status) parts.push(val.status === 'done' ? '✓ 완료' : val.status === 'tried' ? '시도함' : '못함');
        if (Array.isArray(val.feeling) && val.feeling.length) parts.push(val.feeling.join(', '));
        if (val.note) parts.push(val.note);
        return parts.join(' · ');
      }
      return String(val);
    }
    default: return String(val);
  }
}

function buildAnswersPayload(type, ans) {
  const Q = type === 'arrival' ? Q_ARRIVAL : Q_DEPARTURE;
  const colMap = type === 'arrival' ? ARRIVAL_COL_MAP : DEPARTURE_COL_MAP;
  const out = {};
  Q.forEach(q => {
    const col = colMap[q.id];
    if (!col) return; // skip non-answer questions (curation)
    out[col] = paraphraseAnswer(q, ans[q.id]);
  });
  return out;
}

async function submitCheckInToBackend(type, ans) {
  if (!ST.student) return;
  // Departure check-in: assemble mission_feedback from the scattered ST state
  const fullAns = { ...ans };
  if (type === 'departure') {
    fullAns.mission_feedback = {
      status:  ST.arrival?.missionStatus || '',
      feeling: ST.departure?.missionFeeling || [],
      note:    ST.departure?.missionNote || '',
    };
  }
  try {
    await window.GX.api('submitCheckIn', {
      type,
      studentName: ST.student,
      schoolName:  SESSION.schoolName || '',
      className:   SESSION.className  || '',
      answers:     buildAnswersPayload(type, fullAns),
    });
  } catch (e) { console.warn('submitCheckIn failed', e); }
}

async function addStudentToBackend(name) {
  try {
    const res = await window.GX.api('addStudent', {
      classId: SESSION.classId,
      schoolId: SESSION.schoolId || '',
      name,
    });
    if (res.ok) {
      STUDENT_OBJS.push({ id: res.studentId, classId: SESSION.classId, schoolId: SESSION.schoolId, name });
      STUDENTS.push(name);
      return true;
    }
    alert(res.error || '추가 실패');
    return false;
  } catch (e) { alert('서버 오류: ' + e.message); return false; }
}

async function deleteStudentFromBackend(name) {
  const so = STUDENT_OBJS.find(s => s.name === name);
  if (!so) return false;
  try {
    const res = await window.GX.api('deleteStudent', { studentId: so.id });
    if (res.ok) {
      const i = STUDENT_OBJS.findIndex(s => s.id === so.id);
      if (i !== -1) STUDENT_OBJS.splice(i, 1);
      const j = STUDENTS.indexOf(name);
      if (j !== -1) STUDENTS.splice(j, 1);
      return true;
    }
    return false;
  } catch (e) { alert('삭제 실패: ' + e.message); return false; }
}

// ════════════════════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════════════════════

const STUDENTS = [];  // mutable array; hydrated from backend at init

const EMO_PRIMARY = [
  { id:'joyful',  label:'기쁨·감사',   face:'😊', color:'#F59E0B', desc:'기분 좋고 활기차요' },
  { id:'calm',    label:'평온·안정',   face:'😌', color:'#0284C7', desc:'차분하고 편안해요' },
  { id:'heavy',   label:'무거움·슬픔', face:'😢', color:'#9333EA', desc:'마음이 가라앉아요' },
  { id:'anxious', label:'불안·걱정',   face:'😟', color:'#F43F5E', desc:'긴장되거나 걱정돼요' },
  { id:'angry',   label:'짜증·화남',   face:'😤', color:'#EF4444', desc:'화나거나 억울해요' },
  { id:'numb',    label:'무감각·피곤', face:'😶', color:'#94A3B8', desc:'아무 느낌이 없어요' },
];

const EMO_SECONDARY = {
  joyful:[
    {id:'grateful',label:'감사한',dot:'#F59E0B',desc:'누군가에게 고마워요'},
    {id:'excited',label:'설레는',dot:'#FBBF24',desc:'기대되고 두근거려요'},
    {id:'proud',label:'뿌듯한',dot:'#D97706',desc:'내가 잘 해낸 것 같아요'},
    {id:'hopeful',label:'희망찬',dot:'#92400E',desc:'앞으로가 기대돼요'},
  ],
  calm:[
    {id:'peaceful',label:'평화로운',dot:'#0284C7',desc:'마음이 고요해요'},
    {id:'content',label:'만족한',dot:'#0369A1',desc:'지금 이 순간이 충분해요'},
    {id:'focused',label:'집중된',dot:'#075985',desc:'하고 싶은 게 분명해요'},
    {id:'rested',label:'쉬어진',dot:'#7DD3FC',desc:'몸과 마음이 충전됐어요'},
  ],
  heavy:[
    {id:'sad',label:'슬픈',dot:'#9333EA',desc:'눈물이 나요'},
    {id:'lonely',label:'외로운',dot:'#7C3AED',desc:'혼자인 것 같아요'},
    {id:'miss',label:'그리운',dot:'#A855F7',desc:'누군가가 그리워요'},
    {id:'ashamed',label:'부끄러운',dot:'#C084FC',desc:'부끄럽거나 민망해요'},
  ],
  anxious:[
    {id:'nervous',label:'긴장된',dot:'#F43F5E',desc:'발표·시험이 걱정돼요'},
    {id:'worried',label:'걱정되는',dot:'#FB7185',desc:'나쁜 일이 생길까 봐요'},
    {id:'confused',label:'혼란스러운',dot:'#FDA4AF',desc:'어떻게 해야 할지 모르겠어요'},
    {id:'rushed',label:'쫓기는',dot:'#FF6B8A',desc:'시간이 부족해요'},
  ],
  angry:[
    {id:'frustrated',label:'답답한',dot:'#EF4444',desc:'일이 마음대로 안 돼요'},
    {id:'betrayed',label:'배신당한',dot:'#DC2626',desc:'믿었던 사람이 상처를 줬어요'},
    {id:'jealous',label:'질투나는',dot:'#B91C1C',desc:'친구가 부러워요'},
    {id:'unfair',label:'억울한',dot:'#FF8C00',desc:'나만 불공평한 것 같아요'},
  ],
  numb:[
    {id:'tired',label:'피곤한',dot:'#94A3B8',desc:'몸과 마음이 지쳐요'},
    {id:'bored',label:'지루한',dot:'#64748B',desc:'아무것도 하고 싶지 않아요'},
    {id:'empty',label:'텅 빈',dot:'#475569',desc:'아무 감정이 없어요'},
    {id:'detached',label:'멀어진',dot:'#334155',desc:'모든 게 남의 일 같아요'},
  ],
};

const BODY_ZONES = [
  {id:'head',label:'머리',icon:'🧠'},
  {id:'chest',label:'가슴',icon:'❤️'},
  {id:'stomach',label:'배',icon:'🌀'},
  {id:'shoulders',label:'어깨',icon:'💪'},
  {id:'throat',label:'목',icon:'🔊'},
  {id:'nowhere',label:'잘 모르겠어요',icon:'❓'},
];


const REG_STRATEGIES = [
  {id:'prayer',name:'기도하기',icon:'🙏',desc:'하나님께 마음을 올려드려요',type:'adaptive'},
  {id:'talk',name:'말하기',icon:'💬',desc:'믿는 사람에게 털어놓아요',type:'adaptive'},
  {id:'breathe',name:'심호흡',icon:'🌬️',desc:'천천히 숨을 고르며 진정해요',type:'adaptive'},
  {id:'scripture',name:'말씀 묵상',icon:'📖',desc:'성경 구절에 집중해요',type:'adaptive'},
  {id:'exercise',name:'몸 움직이기',icon:'🏃',desc:'걷거나 스트레칭해요',type:'adaptive'},
  {id:'journaling',name:'글 쓰기',icon:'✏️',desc:'생각을 종이에 쏟아내요',type:'adaptive'},
  {id:'ignore',name:'무시하기',icon:'🙈',desc:'감정을 없는 척해요',type:'maladaptive'},
  {id:'outburst',name:'폭발하기',icon:'💢',desc:'소리 지르거나 던져요',type:'maladaptive'},
];

const AXES = [
  {id:1, ko:'자기 인식', anchor:'하나님의 형상',  weekday:1},
  {id:2, ko:'자기 관리', anchor:'절제와 인내',    weekday:2},
  {id:3, ko:'사회 인식', anchor:'이웃 사랑',      weekday:3},
  {id:4, ko:'관계 기술', anchor:'용서와 화목',    weekday:4},
  {id:5, ko:'의사결정',  anchor:'지혜',           weekday:5},
];

const MISSIONS = {
  1:{
    lower:  '오늘 내 기분을 색깔 하나로 표현해봐. 빨간색인지, 파란색인지, 회색인지. 쉬는 시간에 친구한테 말해줘.',
    middle: '오늘 가장 크게 느낀 감정이 뭔지 떠올려봐. 그 감정이 언제, 어떤 상황에서 왔는지 두 줄만 적어봐.',
    upper:  '오늘 내 감정이 어떻게 바뀌었는지 추적해봐. 아침엔 어땠고, 무슨 일이 그 감정을 바꿨는지 적어봐.',
  },
  2:{
    lower:  '화가 치밀어 오를 때 말하기 직전에 속으로 셋만 세봐. 오늘 딱 한 번만 해봐.',
    middle: '감정이 확 올라오는 순간을 느끼면, 잠깐 멈추고 숨 한 번만 고르고 나서 말해봐.',
    upper:  '오늘 해야 할 일 중에 정말 중요한 것 세 가지만 골라봐. 그것만 먼저 해.',
  },
  3:{
    lower:  '오늘 좀 힘들어 보이는 친구가 있었어? 쉬는 시간에 그 친구한테 "괜찮아?" 한마디만 건네봐.',
    middle: '오늘 겉으로는 웃지만 뭔가 지쳐 보이는 친구가 있어? 그 옆에 그냥 잠깐 있어줘봐. 말 안 해도 돼.',
    upper:  '오늘 반에서 조용히 혼자 있는 친구가 보여? 그 친구한테 먼저 말 한마디 걸어봐. 뭐든 좋아.',
  },
  4:{
    lower:  '오늘 친구랑 불편한 일이 있었어? "그때 나 좀 속상했어"라고 솔직하게 말해봐. 딱 그 한마디만.',
    middle: '친구한테 섭섭한 게 있을 때 "너 왜 그래" 말고 "나는 그때 좀 서운했어"로 시작해봐.',
    upper:  '오늘 갈등이 있었거나 생길 것 같아? 상대방이 왜 그랬을지, 딱 한 가지 이유만 생각해봐.',
  },
  5:{
    lower:  '뭔가 고르기 전에 딱 한 번만 물어봐. "하나님이 보셔도 괜찮을까?" 그것만.',
    middle: '오늘 결정해야 할 게 있어? 먼저 기도하고, 믿는 어른한테 한마디만 물어봐.',
    upper:  '오늘 중요한 선택을 앞두고 있어? 결과가 좋은 선택 말고, 하나님 앞에서 떳떳한 선택이 뭔지 생각해봐.',
  },
};
const MISSION_WHY = {
  1:'내 감정을 정확히 아는 게 자기 인식의 시작이야. 하나님이 만드신 "나"를 더 잘 알아가는 연습이에요.',
  2:'절제는 한 번에 생기지 않아. 오늘 이 작은 한 걸음이 나중에 진짜 큰 힘이 돼.',
  3:'예수님은 항상 주변 사람을 먼저 알아채셨어. 친구를 알아차리는 것이 사랑의 시작이야.',
  4:'먼저 다가가는 게 진짜 용기야. 관계를 지키는 게 이기는 것보다 훨씬 중요해.',
  5:'하나님을 신뢰하는 것에서 지혜가 시작돼. 결정 전에 하나님께 먼저 묻는 게 습관이 되면 좋겠어.',
};
const MISSION_VERSES = {
  1:{text:'"하나님이 자기 형상대로 사람을 창조하시되"', ref:'창세기 1:27'},
  2:{text:'"오직 성령의 열매는 … 절제니 이같은 것을 금지할 법이 없느니라"', ref:'갈라디아서 5:22-23'},
  3:{text:'"네 이웃을 네 자신과 같이 사랑하라"', ref:'마가복음 12:31'},
  4:{text:'"서로 친절하게 하며 불쌍히 여기며 서로 용서하기를"', ref:'에베소서 4:32'},
  5:{text:'"너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라"', ref:'잠언 3:5'},
};

const VERSES = [
  {text:'"수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라"', ref:'마태복음 11:28', clusters:['heavy','anxious']},
  {text:'"두려워하지 말라 내가 너와 함께 함이라"', ref:'이사야 41:10', clusters:['anxious']},
  {text:'"항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라"', ref:'데살로니가전서 5:16-18', clusters:['joyful','calm']},
  {text:'"여호와는 나의 목자시니 내게 부족함이 없으리로다"', ref:'시편 23:1', clusters:['numb','lonely','empty']},
  {text:'"화평하게 하는 자는 복이 있나니"', ref:'마태복음 5:9', clusters:['angry']},
  {text:'"내게 능력 주시는 자 안에서 내가 모든 것을 할 수 있느니라"', ref:'빌립보서 4:13', clusters:['numb','tired','heavy']},
];

const CAUSES = ['친구 관계','가족','학업·과제','건강·수면','신앙·기도','선생님과의 관계','내 자신','잘 모르겠어요'];
const SOCIAL_QUALITY = ['정말 좋았어요','괜찮았어요','조금 어려웠어요','갈등이 있었어요'];
const FEELING_CHIPS = ['어려웠어요','용기가 났어요','기뻤어요','아직 안 했어요','생각해볼게요','또 하고 싶어요'];

// Teacher mock
const MOCK_FEED = [
  {name:'서윤', session:'하교', emo:'평온·안정', cause:'학업·과제', time:'14:32'},
  {name:'준호', session:'하교', emo:'무거움·슬픔', cause:'친구 관계', time:'14:28', risk:'watch'},
  {name:'민지', session:'하교', emo:'기쁨·감사', cause:'신앙·기도', time:'14:21'},
  {name:'지호', session:'하교', emo:'불안·걱정', cause:'가족', time:'14:15', risk:'watch'},
  {name:'예은', session:'등교', emo:'평온·안정', cause:'—', time:'08:42'},
  {name:'태현', session:'등교', emo:'무감각·피곤', cause:'건강·수면', time:'08:38', risk:'high'},
  {name:'하은', session:'등교', emo:'기쁨·감사', cause:'—', time:'08:32'},
  {name:'도윤', session:'등교', emo:'평온·안정', cause:'—', time:'08:29'},
  {name:'수빈', session:'등교', emo:'불안·걱정', cause:'학업·과제', time:'08:24'},
  {name:'재원', session:'등교', emo:'평온·안정', cause:'—', time:'08:18'},
];
const MOCK_ALERTS = [];  // populated from real check-in patterns later
const MOCK_AXES_WEEK = [
  {name:'자기 인식', pct:74, color:'#2E3550'},
  {name:'자기 관리', pct:63, color:'#4A5D3F'},
  {name:'사회 인식', pct:68, color:'#C77F4A'},
  {name:'관계 기술', pct:80, color:'#9C5B7E'},
  {name:'의사결정',  pct:61, color:'#3C6E91'},
];
const MOCK_CLASS_PULSE = [
  {name:'기쁨·감사', pct:34, color:'#F59E0B'},
  {name:'평온·안정', pct:42, color:'#0284C7'},
  {name:'무거움·슬픔', pct:8,  color:'#9333EA'},
  {name:'불안·걱정', pct:11, color:'#F43F5E'},
  {name:'무감각·피곤', pct:5, color:'#94A3B8'},
];

// ════════════════════════════════════════════════════════════
// STATE & UTILS
// ════════════════════════════════════════════════════════════

const ST = {
  view: 'home',
  student: '',
  grade: 'middle',
  teacherAuthed: false,
  arrival: { step:0, ans:{}, missionShown:false, missionStatus:null },
  departure: { step:0, ans:{}, missionFeeling:[], missionNote:'' },
};

function nameCall(fullName) {
  const given = fullName.length >= 3 ? fullName.slice(1) : fullName;
  const code = given.slice(-1).charCodeAt(0);
  const hasBatchim = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0;
  return given + (hasBatchim ? '아' : '야');
}

function generatePersonalMessage(student, arousal, primaryEmo, bodyZones, cause) {
  const tag      = nameCall(student);
  const emo      = EMO_PRIMARY.find(e => e.id === primaryEmo);
  const emoLabel = emo?.label || '그 감정';

  const realZones = (bodyZones || []).filter(z => z !== 'nowhere');
  const zoneStr   = realZones.map(z => BODY_ZONES.find(b => b.id === z)?.label || z).join('과 ');
  const bodyPart  = zoneStr ? `${zoneStr}에서 ` : '';

  const energyNote = !arousal     ? '오늘도 잘 왔어.'
                   : arousal <= 2 ? '에너지가 좀 낮은 상태로 왔구나.'
                   : arousal >= 4 ? '오늘 에너지가 넘치게 왔구나!'
                   :                '오늘도 제자리에서 잘 왔어.';

  const causePart = cause && cause !== '잘 모르겠어요' ? ` ${cause}에서 오는 마음인 것 같아.` : '';

  switch (primaryEmo) {
    case 'joyful':
      return `${tag}, ${energyNote} ${emoLabel} 마음으로 오늘을 시작했구나.${causePart} ${bodyPart}그 기쁨과 감사가 느껴지지? 오늘 그 마음 한 사람에게 흘려보내봐. 하나님이 주신 기쁨은 나눌수록 더 커져.`;
    case 'calm':
      return `${tag}, ${energyNote} ${emoLabel} 마음이 오늘 너를 감싸고 있구나.${causePart} ${bodyPart}이 고요함, 얼마나 소중한 선물인지 알아? 오늘 이 평온함 안에서 좋은 결정 하나를 내려봐. 잔잔한 물가로 이끄시는 하나님이 오늘도 함께야.`;
    case 'heavy':
      return `${tag}, ${energyNote} ${emoLabel} 마음이 ${bodyPart}느껴지는구나.${causePart} 그 무게 혼자 다 들지 않아도 돼. 예수님은 지금도 "수고하고 무거운 짐 진 자들아, 내게 오라"고 부르고 계셔.`;
    case 'anxious':
      return `${tag}, ${energyNote} ${emoLabel} 마음이 ${bodyPart}올라오고 있구나.${causePart} 걱정이 밀려올 때 기억해 — 하나님은 오늘도 너보다 먼저 그 길에 가 계셔. 한 걸음씩만 가면 충분해.`;
    case 'angry':
      return `${tag}, ${energyNote} ${emoLabel} 마음이 ${bodyPart}느껴지는구나.${causePart} 그 답답함과 억울함, 충분히 느껴도 돼. 화는 정직한 감정이야. 오늘 표현 방식 딱 하나만 조심스럽게 골라봐. 하나님은 네 마음을 다 아셔.`;
    case 'numb':
      return `${tag}, ${energyNote} ${emoLabel} 상태로 오늘 왔구나.${causePart} ${bodyPart}지치고 텅 빈 느낌일 때 하나님은 "쉬어라"고 말씀하셔. 오늘 딱 한 사람에게만 마음을 살짝 열어봐.`;
    default:
      return `${tag}, 오늘 네 마음을 솔직하게 가져다줘서 고마워. 하나님은 오늘도 너와 함께하셔.`;
  }
}

const $  = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const todayAxis = () => {
  const wd = new Date().getDay();
  return AXES.find(a => a.weekday === wd) || AXES[0];
};
const matchVerse = (id1, id2) => {
  const m = VERSES.filter(v => v.clusters.includes(id1) || v.clusters.includes(id2));
  const pool = m.length ? m : VERSES;
  return pool[Math.floor(Math.random() * pool.length)];
};
const toast = msg => {
  const t = $('#app-toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-show'), 2400);
};
const greetingForNow = () => {
  const h = new Date().getHours();
  return h < 11 ? '좋은 아침이에요' : h < 16 ? '좋은 오후예요' : '수고했어요';
};

// ════════════════════════════════════════════════════════════
// HOME VIEW
// ════════════════════════════════════════════════════════════

function renderHome() {
  const hasStudent = !!ST.student;
  const greet = ST.student ? `${ST.student}님,<br><em>${greetingForNow()}</em>` : `오늘의 마음을<br><em>살펴봐요</em>`;
  const sub = ST.student
    ? '지금 시간에 맞는 체크인을 골라주세요. 등교 체크인을 하면 오늘의 미션도 함께 받아요.'
    : '먼저 이름을 선택해주세요. 등교 체크인부터 시작할 수 있어요.';

  $('#view-home').innerHTML = `
    <div class="home">
      <div class="home-greet">
        <div class="hg-eyebrow">Grow X SSEL · ${new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})}</div>
        <h1 class="hg-title">${greet}</h1>
        <p class="hg-sub">${sub}</p>
      </div>

      <div class="home-pick">
        <div class="hp-label">학생 선택</div>
        ${STUDENTS.length ? `
        <div class="hp-select-wrap">
          <select class="hp-select" id="home-student">
            <option value="">— 이름을 선택하세요 —</option>
            ${STUDENTS.map(s => `<option value="${esc(s)}" ${s===ST.student?'selected':''}>${esc(s)}</option>`).join('')}
          </select>
          <span class="hp-caret" aria-hidden="true">▾</span>
        </div>` : `
        <div style="padding:16px;background:var(--paper-2);border-radius:var(--r-md);font-size:13px;color:var(--fg-mute);text-align:center">
          담임 선생님이 아직 학생을 등록하지 않았습니다.
        </div>`}
      </div>

      <div class="home-actions">
        <button class="home-card home-card--arrival" id="go-arrival" ${hasStudent?'':'disabled'}>
          <div class="hc-icon">🌅</div>
          <div class="hc-title">등교 체크인</div>
          <div class="hc-sub">감정 인식 · 신체 자각 · 오늘의 말씀<br>+ 오늘의 미션 받기</div>
          <div class="hc-arrow"><span>약 3분</span><span class="arr">→</span></div>
        </button>
        <button class="home-card home-card--departure" id="go-departure" ${hasStudent?'':'disabled'}>
          <div class="hc-icon">🌙</div>
          <div class="hc-title">하교 체크인</div>
          <div class="hc-sub">감정 변화 · 조절 전략 · 미션 피드백<br>+ 내일 다짐</div>
          <div class="hc-arrow"><span>약 5분</span><span class="arr">→</span></div>
        </button>
      </div>

      <div class="home-foot">
        “강하고 담대하라 두려워하지 말며 놀라지 말라 네가 어디로 가든지 네 하나님 여호와가 너와 함께 하느니라”
        <span class="hf-ref">— 여호수아 1:9</span>
      </div>
    </div>`;

  $('#home-student').addEventListener('change', e => {
    ST.student = e.target.value;
    renderHome();
  });
  $('#go-arrival')?.addEventListener('click', () => {
    if (!ST.student) return toast('이름을 먼저 선택해주세요');
    ST.arrival = { step:0, ans:{}, missionShown:false, missionStatus:null };
    switchView('arrival');
  });
  $('#go-departure')?.addEventListener('click', () => {
    if (!ST.student) return toast('이름을 먼저 선택해주세요');
    ST.departure = { step:0, ans:{}, missionFeeling:[], missionNote:'' };
    switchView('departure');
  });
}

// ════════════════════════════════════════════════════════════
// CHECK-IN QUESTIONS
// ════════════════════════════════════════════════════════════

// Arrival = 5 question steps + 1 mission step (rendered separately at end)
const Q_ARRIVAL = [
  {id:'valence_arousal',  phase:'감정 인식', title:'지금 에너지는 어느 정도예요?', sub:'몸과 마음을 느껴봐요.', type:'arousal'},
  {id:'primary_emotion',  phase:'감정 인식', title:'지금 마음이 어때요?', sub:'가장 가까운 것 하나만 골라요.', type:'emotion_primary'},
  {id:'arrival_body_zone',phase:'신체 자각', title:'그 감정, 몸 어디서 느껴지나요?', sub:'1초만요 — 긴장되거나 무거운 곳이 있나요?', research:'Somatic Awareness — 감정은 항상 몸의 신호로 먼저 와요.', type:'body'},
  {id:'cause',            phase:'원인 탐색', title:'이 마음, 어디서 왔을까요?', sub:'가장 큰 원인 하나만요.', type:'chips', options:CAUSES, max:1, cols:4, research:'원인을 명명하는 것만으로 편도체 활성도가 감소합니다. (Lieberman, 2007)'},
  {id:'curation',         phase:'오늘의 처방', title:'오늘의 말씀과 한마디', sub:'AI가 너의 답을 보고 골라준 처방.', type:'curation'},
  {id:'prayer_plan',      phase:'기도 계획',   title:'오늘 하나님께 드릴 한 줄 기도', sub:'짧아도 괜찮아요. 진심이면 충분해요.', type:'text', placeholder:'예: 오늘 친구에게 먼저 인사할 용기를 주세요'},
];

// Departure = 8 + 1 mission feedback step
const Q_DEPARTURE = [
  {id:'dep_primary', phase:'감정 돌아보기', title:'지금 이 순간 마음이 어때요?', sub:'등교할 때와 비교해봐요.', type:'emotion_primary'},
  {id:'dep_secondary', phase:'감정 세분화', title:'그 감정을 더 정확하게 표현한다면요?', sub:'더 정확하게 이름 붙일수록, 그 감정이 나를 덜 흔들어요.', research:'Emotional Granularity (Kuppens et al., 2021) — 하루를 보낸 후가 감정을 더 정확하게 명명할 수 있어요.', type:'emotion_secondary'},
  {id:'body_zone', phase:'신체 자각', title:'지금 그 감정이 몸 어디에 있어요?', sub:'1초만요 — 머리, 가슴, 배, 어깨 중 긴장된 곳이 있나요?', research:'Somatic Awareness — 감정은 항상 몸의 신호로 먼저 와요.', type:'body'},
  {id:'reg_strategy', phase:'지금 이 순간', title:'지금 이 감정, 어떻게 하고 싶어요?', sub:'지금 당장 할 수 있는 것을 골라봐요. 여러 개도 돼요.', research:'SERA — 과거 회상보다 현재 의도 선택이 더 정확한 데이터를 만들어요.', type:'regulation'},
  {id:'social_quality', phase:'관계 점검', title:'오늘 친구나 선생님과의 관계는요?', sub:'솔직하게 느낀 대로 밀어봐요.', type:'slider', labels:['갈등 있었어요','조금 어려웠어요','괜찮았어요','정말 좋았어요']},
  {id:'mission_feedback', phase:'미션 피드백', title:'오늘 받은 미션, 어떻게 됐어요?', sub:'아침에 받은 미션을 떠올려봐요. 어떤 시도였든 괜찮아요.', type:'mission_feedback'},
  {id:'strength_moment', phase:'강점 발견', title:'오늘 잘한 것, 자랑스러운 순간 있었나요?', sub:'아주 작은 것도 충분해요.', research:'DESSA — 강점 기반 성찰이 결핍 중심보다 동기와 자존감을 더 효과적으로 높여요.', type:'text', placeholder:'예: 발표할 때 떨렸지만 끝까지 했어요'},
  {id:'goal', phase:'내일 다짐', title:'내일 딱 한 가지만 해볼 거예요?', sub:'오늘 하루를 보고 나서 내일 시도해보고 싶은 것.', research:'Implementation Intention — 다음 날의 구체적 행동 설정이 실천을 2-3배 높여요.', type:'text', placeholder:'예: 내일 아침 친구에게 먼저 안부 묻기'},
  {id:'thanksgiving', phase:'감사와 기도', title:'오늘 하나님께 감사한 것 하나를 써봐요', sub:'"범사에 감사하라" — 살전 5:18', type:'text', placeholder:'오늘 감사한 것...'},
];

// ════════════════════════════════════════════════════════════
// CHECK-IN RENDERER
// ════════════════════════════════════════════════════════════

function renderCheckin(session) {
  const isArrival = session === 'arrival';
  const Q = isArrival ? Q_ARRIVAL : Q_DEPARTURE;
  const state = ST[session];

  // Arrival post-mission step
  if (isArrival && state.missionShown) {
    return renderArrivalMission();
  }

  const i = state.step;
  const q = Q[i];

  const ticks = Q.map((_, idx) => {
    const cls = idx < i ? 'is-done' : idx === i ? 'is-now' : '';
    return `<span class="cir-tick ${cls}"></span>`;
  }).join('');

  const research = q.research ? `
    <div class="cir-research">
      <span class="rlabel">근거</span>
      ${esc(q.research)}
    </div>` : '';

  const sessionLabel = isArrival ? '등교 체크인' : '하교 체크인';
  const sessionEn = isArrival ? `Arrival · ${Q.length} stages` : `Departure · ${Q.length} stages`;

  const head = `
    <div class="view-head">
      <div>
        <div class="vh-eyebrow">${sessionEn}</div>
        <h1 class="vh-title">${sessionLabel} · <em>${esc(q.phase)}</em></h1>
        <p class="vh-sub">${esc(q.sub || '')}</p>
      </div>
      <div class="vh-aside">
        <span class="num">${String(i+1).padStart(2,'0')} / ${String(Q.length).padStart(2,'0')}</span>
        <span>${esc(ST.student)}</span>
      </div>
    </div>`;

  const body = `
    <div class="checkin">
      <aside class="ci-rail">
        <div class="cir-phase">${esc(q.phase)}</div>
        <div class="cir-step-num">${String(i+1).padStart(2,'0')}<span class="of">/ ${String(Q.length).padStart(2,'0')}</span></div>
        <div class="cir-progress">${ticks}</div>
        ${research}
        <div class="ci-rail-nav">
          <button class="appbtn appbtn--ghost" data-act="prev" ${i===0?'disabled':''}>← 이전</button>
          <button class="appbtn appbtn--paper" data-act="home">홈으로</button>
        </div>
      </aside>

      <div class="ci-main">
        <h2 class="cim-question">${esc(q.title)}</h2>
        ${renderQuestionBody(session, q, state.ans)}
        <div class="cim-actions">
          <span class="cim-hint">${i === Q.length-1 ? (isArrival ? '저장 후 오늘의 미션을 받습니다' : '저장 후 홈으로 돌아갑니다') : '다음 단계로'}</span>
          <button class="appbtn appbtn--ink" data-act="next">
            ${i === Q.length-1 ? (isArrival ? '미션 받기' : '체크인 완료') : '다음'} <span class="a">→</span>
          </button>
        </div>
      </div>
    </div>`;

  const viewId = isArrival ? '#view-arrival' : '#view-departure';
  $(viewId).innerHTML = head + body;
  bindCheckinHandlers(session, q);
}

function renderQuestionBody(session, q, ans) {
  switch (q.type) {
    case 'arousal': {
      const labels = ['아주 낮음','낮음','보통','높음','아주 높음'];
      const faces = ['😴','🥱','😐','💪','🔥'];
      const sel = ans[q.id] || 0;
      return `<div class="arousal">${
        [1,2,3,4,5].map(n => `
          <div class="arousal-cell ${sel===n?'is-selected':''}" data-val="${n}">
            <div class="ac-face">${faces[n-1]}</div>
            <div class="ac-label">${labels[n-1]}</div>
            <div class="ac-num">${n}/5</div>
          </div>`).join('')
      }</div>`;
    }
    case 'emotion_primary': {
      const sel = ans[q.id] || '';
      const emoGrid = `<div class="emo-grid">${
        EMO_PRIMARY.map(e => `
          <div class="emo-card ${sel===e.id?'is-selected':''}" data-val="${e.id}" style="--emo-c:${e.color}">
            <div class="ec-face">${e.face}</div>
            <div class="ec-label">${e.label}</div>
            <div class="ec-desc">${e.desc}</div>
          </div>`).join('')
      }</div>`;

      return emoGrid;
    }
    case 'emotion_secondary': {
      const primary = (ST.departure.ans.dep_primary) || 'calm';
      const subs = EMO_SECONDARY[primary] || [];
      const sel = ans[q.id] || '';
      return `<div class="emo-sub-grid">${
        subs.map(s => `
          <div class="emo-sub ${sel===s.id?'is-selected':''}" data-val="${s.id}" style="--es-c:${s.dot}">
            <span class="es-dot"></span>
            <div class="es-label">${s.label}</div>
            <div class="es-desc">${s.desc}</div>
          </div>`).join('')
      }</div>`;
    }
    case 'body': {
      const sel = ans[q.id] || [];
      return `<div class="body-grid">${
        BODY_ZONES.map(b => `
          <div class="body-cell ${sel.includes(b.id)?'is-selected':''}" data-val="${b.id}">
            <span class="bc-icon">${b.icon}</span>
            <span class="bc-label">${b.label}</span>
          </div>`).join('')
      }</div>`;
    }
    case 'regulation': {
      const sel = ans[q.id] || [];
      return `<div class="reg-grid">${
        REG_STRATEGIES.map(r => `
          <div class="reg-card ${r.type==='maladaptive'?'is-harmful':''} ${sel.includes(r.id)?'is-selected':''}" data-val="${r.id}">
            <span class="rc-icon">${r.icon}</span>
            <div class="rc-name">${r.name}</div>
            <div class="rc-desc">${r.desc}</div>
            ${r.type==='maladaptive' ? '<span class="rc-tag">주의</span>' : ''}
          </div>`).join('')
      }</div>`;
    }
    case 'chips': {
      const sel = Array.isArray(ans[q.id]) ? ans[q.id] : (ans[q.id] ? [ans[q.id]] : []);
      if (q.cols) {
        return `<div class="chip-grid" style="grid-template-columns:repeat(${q.cols},1fr)">${
          q.options.map(o => `<button class="chip-pill ${sel.includes(o)?'is-selected':''}" data-val="${esc(o)}">${esc(o)}</button>`).join('')
        }</div>`;
      }
      return `<div class="chip-row">${
        q.options.map(o => `
          <button class="chip-pill ${sel.includes(o)?'is-selected':''}" data-val="${o}">${o}</button>`).join('')
      }</div>`;
    }
    case 'slider': {
      const labels = q.labels;
      const cur = ans[q.id] !== undefined ? ans[q.id] : 2;
      const idx  = typeof cur === 'number' ? cur : labels.indexOf(cur);
      const val  = idx >= 0 ? idx : 2;
      return `
        <div class="social-slider">
          <div class="ssl-labels">
            <span class="ssl-left">${esc(labels[0])}</span>
            <span class="ssl-right">${esc(labels[labels.length-1])}</span>
          </div>
          <div class="ssl-track-wrap">
            <input type="range" class="ssl-input" min="0" max="${labels.length-1}" step="1" value="${val}" data-id="${q.id}" data-labels='${JSON.stringify(labels)}'>
            <div class="ssl-stops">${labels.map((_,i) => `<span class="ssl-stop ${i===val?'is-active':''}"></span>`).join('')}</div>
          </div>
          <div class="ssl-value">${esc(labels[val])}</div>
        </div>`;
    }
    case 'text': {
      const v = ans[q.id] || '';
      return `<textarea class="app-text" data-id="${q.id}" placeholder="${esc(q.placeholder||'')}">${esc(v)}</textarea>`;
    }
    case 'curation': {
      const a   = ST.arrival.ans;
      const primary   = a.primary_emotion;
      const verse     = matchVerse(primary);
      const msg       = generatePersonalMessage(
        ST.student,
        a.valence_arousal,
        primary,
        a.arrival_body_zone,
        a.cause
      );
      return `
        <div class="curation">
          <div class="verse">
            <div class="vlabel">오늘의 말씀</div>
            <div class="vtext">${esc(verse.text)}</div>
            <div class="vref">— ${esc(verse.ref)}</div>
          </div>
          <div class="msg">
            <div class="mlabel">한 마디</div>
            <div class="mtext">${esc(msg)}</div>
          </div>
        </div>`;
    }
    case 'mission_feedback': {
      const axis = todayAxis();
      const mText = MISSIONS[axis.id][ST.grade] || MISSIONS[axis.id].lower;
      const sel = ST.departure.missionFeeling || [];
      return `
        <div class="mission-recap">
          <div class="mr-label">오늘 아침에 받은 미션</div>
          <div class="mr-title">${esc(mText)}</div>
          <div class="mr-axis">${esc(axis.ko)} · ${esc(axis.anchor)}</div>
        </div>
        <div class="mission-status" style="margin-top:18px">
          <button class="ms-toggle ${ST.arrival.missionStatus==='not'?'is-active':''}" data-status="not">
            <div class="mst-label">못 했어요</div>
            <div class="mst-hint">다음에 다시</div>
          </button>
          <button class="ms-toggle ${ST.arrival.missionStatus==='doing'?'is-active':''}" data-status="doing">
            <div class="mst-label">시도했어요</div>
            <div class="mst-hint">진행 중</div>
          </button>
          <button class="ms-toggle ${ST.arrival.missionStatus==='done'?'is-active':''}" data-status="done">
            <div class="mst-label">완료했어요</div>
            <div class="mst-hint">기록 남기기</div>
          </button>
        </div>
        <div class="mf-head" style="margin-top:18px">어땠어요? (여러 개 선택 가능)</div>
        <div class="chip-row">${
          FEELING_CHIPS.map(f => `<button class="chip-pill ${sel.includes(f)?'is-selected':''}" data-feeling="${esc(f)}">${esc(f)}</button>`).join('')
        }</div>
        <textarea class="app-text" data-id="missionNote" placeholder="오늘 미션에 대한 생각을 자유롭게 써봐요" style="margin-top:14px">${esc(ST.departure.missionNote||'')}</textarea>
      `;
    }
  }
  return '';
}


function bindCheckinHandlers(session, q) {
  const isArrival = session === 'arrival';
  const Q = isArrival ? Q_ARRIVAL : Q_DEPARTURE;
  const state = ST[session];
  const root = $(isArrival ? '#view-arrival' : '#view-departure');

  // Slider
  root.querySelectorAll('.ssl-input').forEach(el => {
    const updateSlider = () => {
      const idx    = parseInt(el.value, 10);
      const labels = JSON.parse(el.dataset.labels);
      state.ans[el.dataset.id] = idx;
      const valueEl = root.querySelector('.ssl-value');
      if (valueEl) valueEl.textContent = labels[idx];
      root.querySelectorAll('.ssl-stop').forEach((s, i) => s.classList.toggle('is-active', i === idx));
    };
    el.addEventListener('input', updateSlider);
  });

  root.querySelectorAll('[data-val]').forEach(el => {
    el.addEventListener('click', () => {
      const val = el.dataset.val;
      const ans = state.ans;
      switch (q.type) {
        case 'arousal': ans[q.id] = parseInt(val,10); break;
        case 'emotion_primary': ans[q.id] = val; break;
        case 'emotion_secondary': ans[q.id] = val; break;
        case 'body': {
          const cur = ans[q.id] || [];
          ans[q.id] = cur.includes(val) ? cur.filter(v=>v!==val) : [...cur,val];
          break;
        }
        case 'regulation': {
          const cur = ans[q.id] || [];
          ans[q.id] = cur.includes(val) ? cur.filter(v=>v!==val) : [...cur,val];
          break;
        }
        case 'chips': {
          const cur = Array.isArray(ans[q.id]) ? ans[q.id] : (ans[q.id] ? [ans[q.id]] : []);
          const next = cur.includes(val) ? cur.filter(v=>v!==val) : [...cur,val];
          ans[q.id] = (q.max === 1) ? (next.slice(-1)[0] || '') : next;
          break;
        }
      }
      renderCheckin(session);
    });
  });

  // mission_feedback handlers
  root.querySelectorAll('[data-status]').forEach(el => {
    el.addEventListener('click', () => {
      ST.arrival.missionStatus = el.dataset.status;
      renderCheckin(session);
    });
  });
  root.querySelectorAll('[data-feeling]').forEach(el => {
    el.addEventListener('click', () => {
      const f = el.dataset.feeling;
      const cur = ST.departure.missionFeeling || [];
      ST.departure.missionFeeling = cur.includes(f) ? cur.filter(x=>x!==f) : [...cur,f];
      renderCheckin(session);
    });
  });

  // textareas
  root.querySelectorAll('.app-text').forEach(t => {
    t.addEventListener('input', e => {
      const id = e.target.dataset.id;
      if (id === 'missionNote') ST.departure.missionNote = e.target.value;
      else state.ans[id] = e.target.value;
    });
  });

  // nav
  root.querySelector('[data-act="prev"]')?.addEventListener('click', () => {
    if (state.step > 0) { state.step--; renderCheckin(session); }
  });
  root.querySelector('[data-act="home"]')?.addEventListener('click', () => switchView('home'));
  root.querySelector('[data-act="next"]')?.addEventListener('click', () => {
    if (state.step < Q.length - 1) { state.step++; renderCheckin(session); }
    else {
      if (isArrival) {
        state.missionShown = true;
        submitCheckInToBackend('arrival', state.ans);
        renderArrivalMission();
      } else {
        submitCheckInToBackend('departure', state.ans);
        toast('하교 체크인이 저장됐어요 ✓');
        if (SESSION.role === 'student') {
          ST.student = '';
          ST.departure = { step:0, ans:{}, missionFeeling:[], missionNote:'' };
        }
        switchView('home');
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
// ARRIVAL POST-CHECK MISSION SCREEN
// ════════════════════════════════════════════════════════════

function renderArrivalMission() {
  const axis = todayAxis();
  const weekday = ['일','월','화','수','목','금','토'][new Date().getDay()];
  const mText = MISSIONS[axis.id][ST.grade] || MISSIONS[axis.id].lower;
  const mVerse = MISSION_VERSES[axis.id];
  const mWhy = MISSION_WHY[axis.id];

  $('#view-arrival').innerHTML = `
    <div class="view-head">
      <div>
        <div class="vh-eyebrow">등교 체크인 완료 · 오늘의 미션</div>
        <h1 class="vh-title">${esc(ST.student)}, 오늘의 미션이에요</h1>
        <p class="vh-sub">${weekday}요일 · ${esc(axis.ko)} (${esc(axis.anchor)}). 하루 동안 시도해보고 하교 체크인에서 어땠는지 알려줘요.</p>
      </div>
      <div class="vh-aside">
        <span class="num">${String(axis.id).padStart(2,'0')} / 05</span>
        <span>CASEL 5축</span>
      </div>
    </div>

    <div class="mission-block">
      <div class="mission-hero">
        <div class="mh-pill"><span>오늘의 미션 · ${esc(axis.ko)}</span></div>
        <div class="mh-title">${esc(mText)}</div>
        <div class="mh-why">${esc(mWhy)}</div>
        <div class="mh-axis-meta">
          <span class="dot"></span>
          <span>요일별 5축 SSEL 자동 매칭</span>
        </div>
      </div>

      <div class="mission-verse">
        <div class="mv-label">미션 전 묵상</div>
        <div class="mv-text">${esc(mVerse.text)}</div>
        <div class="mv-ref">— ${esc(mVerse.ref)}</div>
      </div>

      <div class="cim-actions">
        <span class="cim-hint">하교 체크인에서 미션 피드백을 남길 수 있어요</span>
        <div style="display:flex;gap:10px">
          <button class="appbtn appbtn--paper" id="m-back">← 이전</button>
          <button class="appbtn appbtn--ink" id="m-done">홈으로 <span class="a">→</span></button>
        </div>
      </div>
    </div>`;

  $('#m-back').addEventListener('click', () => {
    ST.arrival.missionShown = false;
    renderCheckin('arrival');
  });
  $('#m-done').addEventListener('click', () => {
    toast('미션을 기억해두세요 ⭐');
    if (SESSION.role === 'student') {
      ST.student = '';
      ST.arrival = { step:0, ans:{}, missionShown:false, missionStatus:null };
    }
    switchView('home');
  });
}

// ════════════════════════════════════════════════════════════
// TEACHER VIEW
// ════════════════════════════════════════════════════════════

let CLASS_CHECKINS = [];   // hydrated from backend on each renderTeacher

const EMO_COLORS = {
  '기쁨·감사':'#F59E0B','평온·안정':'#0284C7','무거움·슬픔':'#9333EA',
  '불안·걱정':'#F43F5E','짜증·화남':'#EF4444','무감각·피곤':'#94A3B8',
};
function emoColor(label) { return EMO_COLORS[label] || '#94A3B8'; }
function todayStr() { return new Date().toISOString().slice(0,10); }
function startedToday(ts) { return String(ts || '').startsWith(todayStr()); }

async function loadClassCheckIns() {
  try {
    const res = await window.GX.api('getClassCheckIns', { className: SESSION.className });
    CLASS_CHECKINS = res.ok ? (res.checkins || []) : [];
    // newest first by 제출 시각
    CLASS_CHECKINS.sort((a,b) => String(b['제출 시각']).localeCompare(String(a['제출 시각'])));
  } catch (e) { console.warn('checkins load failed', e); CLASS_CHECKINS = []; }
}

function studentSummary(name) {
  const all = CLASS_CHECKINS.filter(c => c['학생'] === name);
  const today = all.filter(c => startedToday(c['제출 시각']));
  const todayArrival = today.find(c => c.type === 'arrival');
  const todayDeparture = today.find(c => c.type === 'departure');
  const lastEmotion = all[0]?.['감정'] || '';
  return { all, today, todayArrival, todayDeparture, lastEmotion };
}

function renderTeacher() {
  // Render shell synchronously; hydrate via loadClassCheckIns()
  paintTeacher();
  loadClassCheckIns().then(paintTeacher);
}

function paintTeacher() {
  const todayDate = new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
  const arrivalsToday   = CLASS_CHECKINS.filter(c => c.type==='arrival'   && startedToday(c['제출 시각'])).length;
  const departuresToday = CLASS_CHECKINS.filter(c => c.type==='departure' && startedToday(c['제출 시각'])).length;
  const totalCheckIns   = CLASS_CHECKINS.length;
  const checkedInToday  = new Set(CLASS_CHECKINS.filter(c => startedToday(c['제출 시각'])).map(c => c['학생'])).size;

  $('#view-teacher').innerHTML = `
    <div class="view-head">
      <div>
        <div class="vh-eyebrow">교사 대시보드 · ${esc(todayDate)}</div>
        <h1 class="vh-title">${esc(SESSION.className || '')} <em>정서 흐름</em></h1>
        <p class="vh-sub">학생을 클릭하면 개별 체크인 기록과 요약 그래프를 볼 수 있어요.</p>
      </div>
      <div class="vh-aside">
        <span class="num">${STUDENTS.length}명</span>
        <span>${esc(SESSION.className || '')}${SESSION.teacherName ? ' · ' + esc(SESSION.teacherName) + ' 담임' : ''}</span>
      </div>
    </div>

    <div class="t-kpi">
      <div class="kpi"><div class="k-label">오늘 참여</div><div class="k-value"><em>${checkedInToday}</em><span style="font-size:14px;color:var(--fg-mute)"> / ${STUDENTS.length}</span></div><div class="k-hint">고유 학생 수</div></div>
      <div class="kpi"><div class="k-label">오늘 등교 체크인</div><div class="k-value" style="color:#B45309"><em>${arrivalsToday}</em></div><div class="k-hint">건</div></div>
      <div class="kpi"><div class="k-label">오늘 하교 체크인</div><div class="k-value" style="color:#1E40AF"><em>${departuresToday}</em></div><div class="k-hint">건</div></div>
      <div class="kpi"><div class="k-label">누적 체크인</div><div class="k-value"><em>${totalCheckIns}</em></div><div class="k-hint">전체 기록</div></div>
    </div>

    <div class="t-section-head" style="margin-top:28px;margin-bottom:14px">
      <div class="tsh-title">학생 목록 (${STUDENTS.length}명)</div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="t-add-btn" id="t-add-student">+ 학생 추가</button>
        ${STUDENTS.length ? `<button class="t-share-btn" id="t-share-link" title="학생 디바이스용 링크">📱 학생용 링크</button>` : ''}
      </div>
    </div>

    ${STUDENTS.length
      ? `<div class="t-student-grid">${STUDENTS.map(renderStudentCard).join('')}</div>`
      : `<div class="t-empty">아직 학생이 없습니다.<br>위 <b>+ 학생 추가</b> 버튼으로 학생을 등록해주세요.</div>`}

    <div class="cim-actions" style="padding-top:24px;border:0;justify-content:flex-end">
      <button class="appbtn appbtn--ghost" id="t-logout">${SESSION.adminBack ? '← 관리자로 돌아가기' : '로그아웃'}</button>
    </div>`;

  // Card click → open profile modal
  $('#view-teacher').querySelectorAll('[data-open-profile]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-checkin]') || e.target.closest('[data-delete]')) return;
      openStudentProfile(el.dataset.openProfile);
    });
  });
  $('#view-teacher').querySelectorAll('[data-checkin]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      ST.student = btn.dataset.checkin;
      ST.arrival = { step:0, ans:{}, missionShown:false, missionStatus:null };
      switchView('home');
    });
  });
  $('#view-teacher').querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const name = btn.dataset.delete;
      if (!confirm(`${name} 학생을 삭제하시겠습니까? 이 학생의 체크인 기록은 시트에 남습니다.`)) return;
      const ok = await deleteStudentFromBackend(name);
      if (ok) renderTeacher();
    });
  });

  $('#t-logout')?.addEventListener('click', () => {
    if (SESSION.adminBack) {
      window.location.href = SESSION.adminBack === 'school-admin.html' ? 'school-admin.html' : 'admin.html';
    } else {
      window.GX.clearSession();
    }
  });

  $('#t-add-student')?.addEventListener('click', openBulkAddModal);

  $('#t-share-link')?.addEventListener('click', () => {
    const url = `${location.origin}/student.html?class=${encodeURIComponent(SESSION.classId)}`;
    navigator.clipboard.writeText(url).then(() => toast('학생용 링크가 복사되었습니다 ✓')).catch(() => prompt('학생 디바이스에서 이 URL을 열어주세요:', url));
  });
}

function renderStudentCard(name) {
  const s = studentSummary(name);
  const last = s.all[0];
  const color = s.lastEmotion ? emoColor(s.lastEmotion) : '#94A3B8';
  const cnt = s.all.length;
  const statusTag = s.todayArrival && s.todayDeparture
    ? `<span class="tsc-tag tsc-tag--both">등교+하교 ✓</span>`
    : s.todayArrival
    ? `<span class="tsc-tag tsc-tag--arrival">등교 ✓</span>`
    : s.todayDeparture
    ? `<span class="tsc-tag tsc-tag--departure">하교 ✓</span>`
    : `<span class="tsc-tag tsc-tag--none">오늘 미체크인</span>`;
  return `
    <div class="t-student-card" data-open-profile="${esc(name)}">
      <div class="tsc-head">
        <div class="tsc-avatar" style="background:${color}22;color:${color}">${esc(name[0])}</div>
        <div class="tsc-name-wrap">
          <div class="tsc-name">${esc(name)}</div>
          <div class="tsc-meta">총 ${cnt}회 체크인${last ? ' · 최근 ' + esc(last['감정'] || '') : ''}</div>
        </div>
        <button class="tsc-delete" data-delete="${esc(name)}" title="삭제">×</button>
      </div>
      <div class="tsc-mid">${statusTag}</div>
      <div class="tsc-actions">
        <button class="tsc-btn" data-open-profile="${esc(name)}">프로필 보기</button>
        <button class="tsc-btn tsc-btn--primary" data-checkin="${esc(name)}">체크인 시작 →</button>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// STUDENT PROFILE MODAL
// ════════════════════════════════════════════════════════════

async function openStudentProfile(name) {
  const mount = $('#t-modal-mount');
  mount.innerHTML = `
    <div class="t-modal" id="sp-modal">
      <div class="t-modal-backdrop"></div>
      <div class="t-modal-card t-modal-card--xl">
        <div class="t-modal-head">
          <h2 id="sp-modal-title">${esc(name)} 프로필</h2>
          <button class="t-modal-close">×</button>
        </div>
        <div class="t-modal-body" id="sp-modal-body">
          <div style="padding:40px;text-align:center;color:var(--fg-mute)">불러오는 중…</div>
        </div>
      </div>
    </div>`;
  const close = () => mount.innerHTML = '';
  mount.querySelector('.t-modal-close').addEventListener('click', close);
  mount.querySelector('.t-modal-backdrop').addEventListener('click', close);

  let checkins = [];
  try {
    const res = await window.GX.api('getStudentCheckIns', { studentName: name });
    checkins = res.ok ? (res.checkins || []) : [];
    checkins.sort((a,b) => String(b['제출 시각']).localeCompare(String(a['제출 시각'])));
  } catch (e) {
    $('#sp-modal-body').innerHTML = `<div style="padding:40px;text-align:center;color:#EF4444">불러오기 실패: ${esc(e.message)}</div>`;
    return;
  }

  const arrivals = checkins.filter(c => c.type === 'arrival');
  const deps     = checkins.filter(c => c.type === 'departure');
  const total = checkins.length;

  // Emotion distribution
  const emoCounts = {};
  checkins.forEach(c => { const e = c['감정']; if (e) emoCounts[e] = (emoCounts[e]||0) + 1; });
  const emoEntries = Object.entries(emoCounts).sort((a,b) => b[1] - a[1]);
  const dominant = emoEntries[0]?.[0] || '—';

  // Energy timeline (last 10 arrivals, oldest→newest)
  const energyLabels = ['', '아주 낮음','낮음','보통','높음','아주 높음'];
  const energyTimeline = arrivals.slice(0,10).reverse().map(a => ({
    label: String(a['제출 시각'] || '').slice(5,10).replace('-','/'),
    val: energyLabels.indexOf(a['에너지']) || 0,
    raw: a['에너지'] || '',
  })).filter(e => e.val > 0);

  // Cause / relationship signals
  const causeCounts = {};
  arrivals.forEach(a => { const c = a['원인']; if (c) causeCounts[c] = (causeCounts[c]||0) + 1; });
  const topCauses = Object.entries(causeCounts).sort((a,b) => b[1]-a[1]).slice(0,3);

  const body = $('#sp-modal-body');
  body.innerHTML = `
    <div class="sp-summary">
      <div class="sp-summary-card">
        <div class="ssc-label">누적 체크인</div>
        <div class="ssc-value">${total}<span class="ssc-unit">회</span></div>
        <div class="ssc-sub">등교 ${arrivals.length} · 하교 ${deps.length}</div>
      </div>
      <div class="sp-summary-card">
        <div class="ssc-label">대표 감정</div>
        <div class="ssc-value" style="color:${emoColor(dominant)};font-size:20px;line-height:1.3">${esc(dominant)}</div>
        <div class="ssc-sub">${emoEntries[0]?.[1] || 0}회 등장</div>
      </div>
      <div class="sp-summary-card">
        <div class="ssc-label">최근 체크인</div>
        <div class="ssc-value" style="font-size:18px;line-height:1.3">${checkins[0] ? esc(String(checkins[0]['제출 시각']).slice(0,16).replace('T',' ')) : '—'}</div>
        <div class="ssc-sub">${checkins[0] ? (checkins[0].type === 'arrival' ? '등교' : '하교') + ' · ' + esc(checkins[0]['감정'] || '') : '—'}</div>
      </div>
      <div class="sp-summary-card">
        <div class="ssc-label">주요 원인</div>
        <div class="ssc-value" style="font-size:16px;line-height:1.3">${topCauses[0]?.[0] ? esc(topCauses[0][0]) : '—'}</div>
        <div class="ssc-sub">${topCauses.slice(1).map(c => esc(c[0])).join(' · ') || '—'}</div>
      </div>
    </div>

    <div class="sp-charts">
      ${emoEntries.length ? renderEmotionPie(emoEntries, total) : ''}
      ${energyTimeline.length ? renderEnergyChart(energyTimeline) : ''}
    </div>

    <div class="sp-section-head">
      <h3>체크인 기록 (${total}건)</h3>
      <button class="tsc-btn tsc-btn--primary" data-modal-checkin="${esc(name)}">+ 새 체크인 시작 →</button>
    </div>

    ${total === 0
      ? `<div class="sp-empty">아직 체크인 기록이 없습니다.</div>`
      : `<div class="sp-history">${checkins.map(checkinRowHTML).join('')}</div>`}
  `;

  body.querySelector('[data-modal-checkin]')?.addEventListener('click', () => {
    ST.student = name;
    ST.arrival = { step:0, ans:{}, missionShown:false, missionStatus:null };
    close();
    switchView('home');
  });
}

function renderEmotionPie(entries, total) {
  let acc = 0;
  const stops = entries.map(([emo, count]) => {
    const start = (acc / total) * 100;
    acc += count;
    const end = (acc / total) * 100;
    return `${emoColor(emo)} ${start}% ${end}%`;
  }).join(', ');
  const legend = entries.map(([emo, count]) => `
    <li>
      <span class="pl-dot" style="background:${emoColor(emo)}"></span>
      <span class="pl-label">${esc(emo)}</span>
      <span class="pl-count">${count}건 · ${Math.round(count/total*100)}%</span>
    </li>`).join('');
  return `
    <div class="sp-chart-card">
      <div class="scc-title">감정 분포</div>
      <div class="pie-wrap">
        <div class="pie" style="background: conic-gradient(${stops})"></div>
        <ul class="pie-legend">${legend}</ul>
      </div>
    </div>`;
}

function renderEnergyChart(points) {
  const max = 5;
  const colors = ['', '#94A3B8','#94A3B8','#0284C7','#22C55E','#F59E0B'];
  return `
    <div class="sp-chart-card">
      <div class="scc-title">에너지 변화 (최근 등교 체크인)</div>
      <div class="energy-chart">
        ${points.map(p => `
          <div class="ec-col">
            <div class="ec-bar-wrap"><div class="ec-bar" style="height:${(p.val/max)*100}%;background:${colors[p.val]}"></div></div>
            <div class="ec-val">${p.val}</div>
            <div class="ec-label">${esc(p.label)}</div>
          </div>`).join('')}
      </div>
      <div class="ec-axis">1 = 아주 낮음 · 5 = 아주 높음</div>
    </div>`;
}

function checkinRowHTML(c) {
  const ts = String(c['제출 시각'] || '').slice(0,16).replace('T',' ');
  const isArrival = c.type === 'arrival';
  const tagClass = isArrival ? 'tsc-tag--arrival' : 'tsc-tag--departure';
  const tagText = isArrival ? '등교' : '하교';
  const emoTxt = c['감정'] || '';
  const detailRows = isArrival
    ? [
        ['에너지', c['에너지']],
        ['몸의 위치', c['몸의 위치']],
        ['원인', c['원인']],
        ['한 줄 기도', c['한 줄 기도']],
      ]
    : [
        ['세부 감정', c['세부 감정']],
        ['몸의 위치', c['몸의 위치']],
        ['조절 전략', c['조절 전략']],
        ['관계', c['관계']],
        ['미션 피드백', c['미션 피드백']],
        ['자랑스러운 순간', c['자랑스러운 순간']],
        ['내일 다짐', c['내일 다짐']],
        ['감사', c['감사']],
      ];
  return `
    <div class="sp-record">
      <div class="spr-top">
        <span class="tsc-tag ${tagClass}">${tagText}</span>
        <span class="spr-time">${esc(ts)}</span>
        <span class="spr-emo" style="color:${emoColor(emoTxt)}">${esc(emoTxt)}</span>
      </div>
      <div class="spr-grid">
        ${detailRows.filter(([_, v]) => v).map(([k, v]) => `
          <div class="spr-cell"><span class="spr-k">${esc(k)}</span><span class="spr-v">${esc(v)}</span></div>
        `).join('')}
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// BULK ADD STUDENT MODAL
// ════════════════════════════════════════════════════════════

function openBulkAddModal() {
  const mount = $('#t-modal-mount');
  const existing = STUDENTS.slice();
  mount.innerHTML = `
    <div class="t-modal" id="bulk-modal">
      <div class="t-modal-backdrop"></div>
      <div class="t-modal-card">
        <div class="t-modal-head">
          <h2>학생 추가</h2>
          <button class="t-modal-close">×</button>
        </div>
        <div class="t-modal-body">
          <p style="font-size:13px;color:var(--fg-mute);margin-bottom:14px">한 줄에 한 명씩 이름을 입력하세요. 한 번에 여러 명 추가 가능합니다.</p>
          <textarea class="bulk-add-text" id="bulk-add-text" placeholder="예시:&#10;김지호&#10;이서연&#10;박민준" rows="10" autofocus></textarea>
          <div class="bulk-add-existing">
            <div class="bae-label">이미 등록된 학생 (${existing.length}명)</div>
            <div class="bae-chips">
              ${existing.length ? existing.map(n => `<span class="bae-chip">${esc(n)}</span>`).join('') : '<span style="font-size:12px;color:var(--fg-mute)">아직 없음</span>'}
            </div>
          </div>
          <div class="sa-err" id="bulk-add-err"></div>
        </div>
        <div class="t-modal-foot">
          <button class="sa-btn sa-btn--ghost" id="bulk-cancel">취소</button>
          <button class="sa-btn sa-btn--primary" id="bulk-submit">추가</button>
        </div>
      </div>
    </div>`;

  const close = () => mount.innerHTML = '';
  mount.querySelector('.t-modal-close').addEventListener('click', close);
  mount.querySelector('.t-modal-backdrop').addEventListener('click', close);
  mount.querySelector('#bulk-cancel').addEventListener('click', close);

  // Focus textarea
  setTimeout(() => $('#bulk-add-text')?.focus(), 50);

  mount.querySelector('#bulk-submit').addEventListener('click', async () => {
    const text = $('#bulk-add-text').value;
    const names = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const err = $('#bulk-add-err');
    err.textContent = '';
    if (!names.length) { err.textContent = '이름을 한 명 이상 입력해주세요.'; return; }

    const dupes = names.filter(n => STUDENTS.includes(n));
    if (dupes.length) { err.textContent = `이미 등록된 학생: ${dupes.join(', ')}`; return; }

    const btn = $('#bulk-submit');
    btn.disabled = true;
    btn.textContent = `추가 중… (0/${names.length})`;

    let success = 0;
    for (let i = 0; i < names.length; i++) {
      btn.textContent = `추가 중… (${i+1}/${names.length})`;
      const ok = await addStudentToBackend(names[i]);
      if (ok) success++;
    }

    close();
    toast(`${success}명 추가되었습니다 ✓`);
    renderTeacher();
  });
}


// ════════════════════════════════════════════════════════════
// ROUTER & INIT
// ════════════════════════════════════════════════════════════

function switchView(view) {
  ST.view = view;
  $$('.view').forEach(v => v.classList.toggle('is-active', v.dataset.view === view));
  window.scrollTo({top:0, behavior:'smooth'});

  switch (view) {
    case 'home':      renderHome(); break;
    case 'arrival':   renderCheckin('arrival'); break;
    case 'departure': renderCheckin('departure'); break;
    case 'teacher':   renderTeacher(); break;
  }
}

async function loadRoster() {
  try {
    const res = await window.GX.api('getClassRoster', { classId: SESSION.classId });
    if (res.ok) {
      if (res.classInfo) {
        SESSION.className  = res.classInfo.name;
        SESSION.grade      = res.classInfo.grade;
        SESSION.schoolId   = res.classInfo.schoolId   || SESSION.schoolId;
        SESSION.schoolName = res.classInfo.schoolName || SESSION.schoolName;
      }
      if (res.students) {
        STUDENT_OBJS.length = 0;
        STUDENT_OBJS.push(...res.students);
        STUDENTS.length = 0;
        STUDENTS.push(...res.students.map(s => s.name));
      }
    }
  } catch (e) { console.warn('roster load failed', e); }
}

async function init() {
  $('#top-date').textContent = new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});

  await loadRoster();

  if (SESSION.role === 'student') {
    // Student mode: show class badge, hide teacher button
    const badge = $('#student-class-badge');
    if (badge) badge.textContent = SESSION.className || '';
    $('#open-teacher')?.style && ($('#open-teacher').style.display = 'none');
    switchView('home');
    return;
  }

  // Auth: teacher header button now goes directly to teacher dashboard
  $('#open-teacher')?.addEventListener('click', () => {
    ST.teacherAuthed = true;
    switchView('teacher');
  });

  // Start at teacher view if logged in as teacher/admin_view
  if (SESSION.role === 'teacher' || SESSION.role === 'admin_view') {
    ST.teacherAuthed = true;
    switchView('teacher');
  } else {
    switchView('home');
  }
}

document.addEventListener('DOMContentLoaded', init);

})();
