/**
 * Grow X SSEL · Backend (Google Apps Script)
 * Deploy as Web App, set "Who has access" = Anyone.
 * Frontend POSTs JSON with text/plain content type to avoid CORS preflight.
 */

const SUPER_ADMIN = {
  email: 'admin@growx.kr',
  password: 'growx2026'
};

// ── One-time setup (run this manually after first paste) ──
function setup() {
  ['Schools','Teachers','Classrooms','Students','ArrivalCheckIns','DepartureCheckIns'].forEach(name => _sheet(name));
  Logger.log('All sheets initialized.');
}

// ── Routing ──
function doGet(e) {
  return _json({ ok: true, message: 'Grow X SSEL API is alive.' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const a = body.action;

    if (a === 'registerSchool')     return _registerSchool(body);
    if (a === 'login')              return _login(body);
    if (a === 'listRegistrations')  return _listRegistrations(body);
    if (a === 'decideRegistration') return _decideRegistration(body);
    if (a === 'listSchoolData')     return _listSchoolData(body);
    if (a === 'createTeacher')      return _createTeacher(body);
    if (a === 'updateTeacher')      return _updateTeacher(body);
    if (a === 'deleteTeacher')      return _deleteTeacher(body);
    if (a === 'getClassRoster')     return _getClassRoster(body);
    if (a === 'addStudent')         return _addStudent(body);
    if (a === 'deleteStudent')      return _deleteStudent(body);
    if (a === 'submitCheckIn')      return _submitCheckIn(body);
    if (a === 'getClassCheckIns')   return _getClassCheckIns(body);
    if (a === 'getStudentCheckIns') return _getStudentCheckIns(body);
    if (a === 'getSchoolProfile')   return _getSchoolProfile(body);

    return _json({ ok: false, error: 'Unknown action: ' + a });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// ── Sheet schema ──
const HEADERS = {
  Schools:    ['id','name','type','region','phone','website','contactName','contactRole','contactEmail','contactPhone','contactNote','adminEmail','adminPassword','status','submittedAt','decidedAt','marketing'],
  Teachers:   ['id','schoolId','classId','name','email','password','createdAt'],
  Classrooms: ['id','schoolId','name','grade','teacherId','createdAt'],
  Students:   ['id','classId','schoolId','name','createdAt'],
  ArrivalCheckIns:   ['제출 시각','학교','학급','학생','에너지','감정','몸의 위치','원인','한 줄 기도'],
  DepartureCheckIns: ['제출 시각','학교','학급','학생','감정','세부 감정','몸의 위치','조절 전략','관계','미션 피드백','자랑스러운 순간','내일 다짐','감사']
};

// ── Sheet helpers ──
function _sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    const headers = HEADERS[name];
    if (headers) {
      s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      s.setFrozenRows(1);
    }
  }
  return s;
}

function _read(name) {
  const s = _sheet(name);
  if (s.getLastRow() < 2) return [];
  const values = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues();
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function _append(name, obj) {
  const s = _sheet(name);
  const headers = HEADERS[name];
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  s.appendRow(row);
}

function _rowOf(name, id) {
  const s = _sheet(name);
  if (s.getLastRow() < 2) return -1;
  const ids = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

function _update(name, id, updates) {
  const s = _sheet(name);
  const rowIdx = _rowOf(name, id);
  if (rowIdx === -1) return false;
  const headers = HEADERS[name];
  for (const k in updates) {
    const col = headers.indexOf(k);
    if (col !== -1) s.getRange(rowIdx, col + 1).setValue(updates[k]);
  }
  return true;
}

function _delete(name, id) {
  const s = _sheet(name);
  const rowIdx = _rowOf(name, id);
  if (rowIdx === -1) return false;
  s.deleteRow(rowIdx);
  return true;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Actions ──

function _registerSchool(body) {
  const id = 'reg_' + Date.now();
  _append('Schools', {
    id,
    name:          body.school.name,
    type:          body.school.type,
    region:        body.school.region,
    phone:         body.school.phone || '',
    website:       body.school.website || '',
    contactName:   body.contact.name,
    contactRole:   body.contact.role,
    contactEmail:  body.contact.email,
    contactPhone:  body.contact.phone,
    contactNote:   body.contact.note || '',
    adminEmail:    body.contact.email,
    adminPassword: body.password,
    status:        'pending',
    submittedAt:   new Date().toISOString(),
    decidedAt:     '',
    marketing:     body.marketing ? 'true' : 'false'
  });
  return _json({ ok: true, id });
}

function _login(body) {
  const email = String(body.email || '').trim().toLowerCase();
  const pw    = String(body.password || '');

  if (email === SUPER_ADMIN.email.toLowerCase() && pw === SUPER_ADMIN.password) {
    return _json({ ok: true, role: 'super_admin', email: SUPER_ADMIN.email, name: 'Grow X 운영팀' });
  }

  const schools = _read('Schools');
  const approved = schools.find(s =>
    String(s.adminEmail).toLowerCase() === email &&
    String(s.adminPassword) === pw &&
    s.status === 'approved'
  );
  if (approved) {
    return _json({
      ok: true, role: 'school_admin',
      schoolId: approved.id, schoolName: approved.name,
      email: approved.adminEmail, name: approved.contactName
    });
  }

  const pending = schools.find(s =>
    String(s.adminEmail).toLowerCase() === email &&
    String(s.adminPassword) === pw &&
    s.status === 'pending'
  );
  if (pending) return _json({ ok: false, error: '아직 승인 대기 중인 계정입니다.' });

  const rejected = schools.find(s =>
    String(s.adminEmail).toLowerCase() === email &&
    String(s.adminPassword) === pw &&
    s.status === 'rejected'
  );
  if (rejected) return _json({ ok: false, error: '신청이 거절된 계정입니다.' });

  const teacher = _read('Teachers').find(t =>
    String(t.email).toLowerCase() === email && String(t.password) === pw
  );
  if (teacher) {
    const cls = _read('Classrooms').find(c => c.id === teacher.classId);
    const sch = schools.find(s => s.id === teacher.schoolId);
    return _json({
      ok: true, role: 'teacher',
      teacherId: teacher.id, teacherName: teacher.name, email: teacher.email,
      classId: teacher.classId, className: cls ? cls.name : '', grade: cls ? cls.grade : '',
      schoolId: teacher.schoolId, schoolName: sch ? sch.name : ''
    });
  }

  return _json({ ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
}

function _listRegistrations(body) {
  return _json({ ok: true, rows: _read('Schools') });
}

function _decideRegistration(body) {
  const status = body.decision === 'approve' ? 'approved' : 'rejected';
  _update('Schools', body.id, { status, decidedAt: new Date().toISOString() });
  return _json({ ok: true });
}

function _listSchoolData(body) {
  const school = _read('Schools').find(s => s.id === body.schoolId);
  if (!school) return _json({ ok: false, error: 'School not found' });
  const teachers   = _read('Teachers').filter(t => t.schoolId === body.schoolId);
  const classrooms = _read('Classrooms').filter(c => c.schoolId === body.schoolId);
  return _json({ ok: true, school, teachers, classrooms });
}

function _createTeacher(body) {
  const email = String(body.email).trim().toLowerCase();
  if (_read('Teachers').some(t => String(t.email).toLowerCase() === email)) {
    return _json({ ok: false, error: '이미 사용 중인 이메일입니다.' });
  }
  const teacherId = 't_' + Date.now();
  const classId   = 'c_' + Date.now();
  const now       = new Date().toISOString();

  _append('Classrooms', {
    id: classId,
    schoolId: body.schoolId,
    name: body.className,
    grade: body.grade || '중등부',
    teacherId,
    createdAt: now
  });
  _append('Teachers', {
    id: teacherId,
    schoolId: body.schoolId,
    classId,
    name: body.name,
    email: body.email,
    password: body.password,
    createdAt: now
  });
  return _json({ ok: true, teacherId, classId });
}

function _updateTeacher(body) {
  const { teacherId, updates } = body;
  const teacher = _read('Teachers').find(t => t.id === teacherId);
  if (!teacher) return _json({ ok: false, error: 'Teacher not found' });

  const tu = {};
  ['name','email','password'].forEach(k => { if (updates[k] !== undefined) tu[k] = updates[k]; });
  if (Object.keys(tu).length) _update('Teachers', teacherId, tu);

  const cu = {};
  if (updates.className !== undefined) cu.name  = updates.className;
  if (updates.grade     !== undefined) cu.grade = updates.grade;
  if (Object.keys(cu).length) _update('Classrooms', teacher.classId, cu);

  return _json({ ok: true });
}

function _deleteTeacher(body) {
  const teacher = _read('Teachers').find(t => t.id === body.teacherId);
  if (!teacher) return _json({ ok: false, error: 'Not found' });
  if (teacher.classId) {
    _delete('Classrooms', teacher.classId);
    _read('Students').filter(s => s.classId === teacher.classId).forEach(s => _delete('Students', s.id));
  }
  _delete('Teachers', body.teacherId);
  return _json({ ok: true });
}

function _getClassRoster(body) {
  const cls = _read('Classrooms').find(c => c.id === body.classId);
  if (!cls) return _json({ ok: false, error: 'Class not found' });
  const students = _read('Students').filter(s => s.classId === body.classId);
  const school = _read('Schools').find(s => s.id === cls.schoolId);
  return _json({
    ok: true,
    classInfo: { id: cls.id, name: cls.name, grade: cls.grade, schoolId: cls.schoolId, schoolName: school ? school.name : '' },
    students,
  });
}

function _addStudent(body) {
  const studentId = 's_' + Date.now();
  _append('Students', {
    id: studentId,
    classId: body.classId,
    schoolId: body.schoolId,
    name: body.name,
    createdAt: new Date().toISOString()
  });
  return _json({ ok: true, studentId });
}

function _deleteStudent(body) {
  _delete('Students', body.studentId);
  return _json({ ok: true });
}

function _submitCheckIn(body) {
  const sheetName = body.type === 'arrival' ? 'ArrivalCheckIns' : 'DepartureCheckIns';
  const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  const row = Object.assign({
    '제출 시각': ts,
    '학교':      body.schoolName || '',
    '학급':      body.className || '',
    '학생':      body.studentName || '',
  }, body.answers || {});
  _append(sheetName, row);
  return _json({ ok: true });
}

function _getClassCheckIns(body) {
  // Read from both sheets and tag with type
  const arrivals = _read('ArrivalCheckIns').map(r => Object.assign({ type:'arrival' }, r));
  const deps     = _read('DepartureCheckIns').map(r => Object.assign({ type:'departure' }, r));
  const all = arrivals.concat(deps).filter(r => r['학급'] === body.className);
  return _json({ ok: true, checkins: all });
}

function _getStudentCheckIns(body) {
  const arrivals = _read('ArrivalCheckIns').map(r => Object.assign({ type:'arrival' }, r));
  const deps     = _read('DepartureCheckIns').map(r => Object.assign({ type:'departure' }, r));
  const all = arrivals.concat(deps).filter(r => r['학생'] === body.studentName);
  return _json({ ok: true, checkins: all });
}

function _getSchoolProfile(body) {
  const school = _read('Schools').find(s => s.id === body.schoolId);
  if (!school) return _json({ ok: false, error: 'School not found' });

  const teachers   = _read('Teachers').filter(t => t.schoolId === body.schoolId);
  const classrooms = _read('Classrooms').filter(c => c.schoolId === body.schoolId);
  const students   = _read('Students').filter(s => s.schoolId === body.schoolId);

  const arrivals = _read('ArrivalCheckIns').map(r => Object.assign({ type:'arrival' }, r));
  const deps     = _read('DepartureCheckIns').map(r => Object.assign({ type:'departure' }, r));
  const checkins = arrivals.concat(deps)
    .filter(r => r['학교'] === school.name)
    .sort((a, b) => String(b['제출 시각']).localeCompare(String(a['제출 시각'])));

  return _json({
    ok: true,
    school, teachers, classrooms, students,
    recentCheckIns: checkins.slice(0, 30),
    totalCheckIns:  checkins.length,
  });
}
