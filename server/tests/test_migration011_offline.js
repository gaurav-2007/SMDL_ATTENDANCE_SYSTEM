/**
 * Reproducible offline unit & stateful-mock regression suite for Migration 011
 * and backend safety/lifecycle fixes.
 *
 * NOTE: This test suite runs completely offline against an in-memory stateful mock
 * of Supabase/PostgREST, mocked notification/storage adapters, and controlled IST clocks.
 * It does NOT execute SQL or test real PostgreSQL constraints / PostgREST queries.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SERVER_SRC = path.resolve(__dirname, '../src');
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/011_add_lectures_status.sql'
);

let autoSeq = 1;
function nextMockId(prefix = 'id') {
  autoSeq += 1;
  return `${prefix}-${autoSeq}`;
}

function deepClone(val) {
  if (val === null || typeof val !== 'object') return val;
  return JSON.parse(JSON.stringify(val));
}

function getPath(obj, dotPath) {
  if (!obj || !dotPath) return undefined;
  const parts = String(dotPath).split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

function hydrateRow(table, row, selectCols, tables) {
  if (!tables || !row || typeof row !== 'object') return { hydrated: deepClone(row), failedInner: false };
  const out = deepClone(row);

  const byId = (tbl, id) => {
    if (!id || !Array.isArray(tables[tbl])) return null;
    const found = tables[tbl].find((r) => r.id === id);
    return found ? deepClone(found) : null;
  };

  if (out.subject_id && !out.subject && Array.isArray(tables.subjects)) {
    const s = byId('subjects', out.subject_id);
    if (s) {
      if (s.division_id && !s.division && Array.isArray(tables.divisions)) {
        s.division = byId('divisions', s.division_id);
      }
      if (s.course_id && !s.course && Array.isArray(tables.courses)) {
        s.course = byId('courses', s.course_id);
      }
      out.subject = s;
      out.subjects = deepClone(s);
    }
  } else if (out.subject && !out.subjects) {
    out.subjects = out.subject;
  }

  if (out.division_id && !out.division && Array.isArray(tables.divisions)) {
    const d = byId('divisions', out.division_id);
    if (d) {
      if (d.course_id && !d.course && Array.isArray(tables.courses)) {
        d.course = byId('courses', d.course_id);
      }
      out.division = d;
      out.divisions = deepClone(d);
    }
  } else if (out.division && !out.divisions) {
    out.divisions = out.division;
  }

  if (out.course_id && !out.course && Array.isArray(tables.courses)) {
    const c = byId('courses', out.course_id);
    if (c) {
      out.course = c;
      out.courses = deepClone(c);
    }
  }

  if (out.teacher_id && !out.teacher && Array.isArray(tables.teachers)) {
    const t = byId('teachers', out.teacher_id);
    if (t) {
      if (t.user_id && !t.user && Array.isArray(tables.users)) {
        t.user = byId('users', t.user_id);
        t.users = deepClone(t.user);
      }
      out.teacher = t;
      out.teachers = deepClone(t);
    }
  } else if (out.teacher && !out.teachers) {
    out.teachers = out.teacher;
  }

  if (out.user_id && !out.user && Array.isArray(tables.users)) {
    const u = byId('users', out.user_id);
    if (u) {
      out.user = u;
      out.users = deepClone(u);
    }
  } else if (out.users && !out.user) {
    out.user = out.users;
  }

  if (table === 'attendance' && out.lecture_id && !out.lectures && Array.isArray(tables.lectures)) {
    const lec = byId('lectures', out.lecture_id);
    if (lec) {
      out.lectures = hydrateRow('lectures', lec, null, tables).hydrated;
      out.lecture = deepClone(out.lectures);
    }
  }

  if (out.student_id && !out.students && Array.isArray(tables.students)) {
    const st = byId('students', out.student_id);
    if (st) {
      out.students = hydrateRow('students', st, null, tables).hydrated;
      out.student = deepClone(out.students);
    }
  }

  let failedInner = false;
  if (typeof selectCols === 'string') {
    const innerRegex = /(\w+)!inner\b/g;
    let m;
    while ((m = innerRegex.exec(selectCols)) !== null) {
      const relName = m[1];
      const val = out[relName];
      if (!val || (Array.isArray(val) && val.length === 0)) {
        failedInner = true;
        break;
      }
    }
  }

  return { hydrated: out, failedInner };
}

function ilikeToRegex(pattern) {
  const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${regexStr}$`, 'i');
}

function likeToRegex(pattern) {
  const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${regexStr}$`);
}

function isSqlNull(val) {
  return val === null || val === undefined;
}

function evaluateSingleFilter(row, f) {
  const actual = getPath(row, f.col);
  switch (f.op) {
    case 'eq':
      return !isSqlNull(actual) && !isSqlNull(f.val) && actual === f.val;
    case 'neq':
      // PostgreSQL/PostgREST: NULL <> 'X' evaluates to UNKNOWN (false in WHERE)
      return !isSqlNull(actual) && !isSqlNull(f.val) && actual !== f.val;
    case 'gte':
      return !isSqlNull(actual) && !isSqlNull(f.val) && actual >= f.val;
    case 'lte':
      return !isSqlNull(actual) && !isSqlNull(f.val) && actual <= f.val;
    case 'gt':
      return !isSqlNull(actual) && !isSqlNull(f.val) && actual > f.val;
    case 'lt':
      return !isSqlNull(actual) && !isSqlNull(f.val) && actual < f.val;
    case 'in':
      return Array.isArray(f.val) && !isSqlNull(actual) && f.val.includes(actual);
    case 'like':
      return !isSqlNull(actual) && !isSqlNull(f.val) && likeToRegex(f.val).test(String(actual));
    case 'ilike':
      return !isSqlNull(actual) && !isSqlNull(f.val) && ilikeToRegex(f.val).test(String(actual));
    case 'is':
      return f.val === null ? isSqlNull(actual) : actual === f.val;
    case 'not': {
      if (f.subOp === 'is') {
        return !evaluateSingleFilter(row, { op: 'is', col: f.col, val: f.val });
      }
      if (isSqlNull(actual)) {
        return false;
      }
      if (f.subOp === 'in' && typeof f.val === 'string' && f.val.startsWith('(') && f.val.endsWith(')')) {
        const items = f.val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
        return !items.includes(String(actual));
      }
      return !evaluateSingleFilter(row, { op: f.subOp, col: f.col, val: f.val });
    }
    case 'or': {
      const expr = String(f.expr || '').trim();
      if (!expr) return true;
      const clauses = expr.split(',').map((c) => c.trim()).filter(Boolean);
      return clauses.some((clause) => {
        const m = clause.match(/^([^.]+)\.(eq|neq|gte|lte|gt|lt|ilike|like|is)\.(.*)$/);
        if (!m) {
          throw new Error(`Unsupported mock .or clause: ${clause}`);
        }
        const [, col, subOp, rawVal] = m;
        let val = rawVal;
        if (subOp === 'is') {
          if (rawVal === 'null') val = null;
          else if (rawVal === 'true') val = true;
          else if (rawVal === 'false') val = false;
        }
        return evaluateSingleFilter(row, { op: subOp, col, val });
      });
    }
    default:
      throw new Error(`Unsupported mock filter operator: ${f.op}`);
  }
}

function executeStatefulQuery(state, tables, uniqueConstraints, onQueryLog) {
  if (onQueryLog) onQueryLog(state);
  const rows = tables[state.table];
  if (!Array.isArray(rows)) {
    return { data: state.singleMode ? null : [], error: null, count: 0 };
  }

  if (state.action === 'select') {
    const matched = [];
    for (const rawRow of rows) {
      const { hydrated, failedInner } = hydrateRow(state.table, rawRow, state.selectCols, tables);
      if (failedInner) continue;
      if (state.filters.every((f) => evaluateSingleFilter(hydrated, f))) {
        matched.push(hydrated);
      }
    }

    if (state.orderBy) {
      const { col, opts } = state.orderBy;
      const asc = !opts || opts.ascending !== false;
      matched.sort((a, b) => {
        const va = getPath(a, col);
        const vb = getPath(b, col);
        if (va === vb) return 0;
        if (va === undefined || va === null) return asc ? 1 : -1;
        if (vb === undefined || vb === null) return asc ? -1 : 1;
        if (typeof va === 'number' && typeof vb === 'number') {
          return asc ? va - vb : vb - va;
        }
        const cmp = String(va).localeCompare(String(vb));
        return asc ? cmp : -cmp;
      });
    }

    const totalCount = matched.length;
    let limited = typeof state.limitCount === 'number' ? matched.slice(0, state.limitCount) : matched;
    if (Array.isArray(state.rangeSlice)) {
      limited = limited.slice(state.rangeSlice[0], state.rangeSlice[1] + 1);
    }

    if (state.singleMode === 'single') {
      if (limited.length !== 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: `JSON object requested, ${limited.length === 0 ? 'no' : 'multiple'} rows returned`,
          },
          count: totalCount,
        };
      }
      return { data: limited[0], error: null, count: 1 };
    }

    if (state.singleMode === 'maybeSingle') {
      if (limited.length > 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple rows returned',
          },
          count: totalCount,
        };
      }
      return { data: limited[0] || null, error: null, count: totalCount };
    }

    if (state.selectOpts && state.selectOpts.head === true) {
      return { data: null, error: null, count: totalCount };
    }

    return {
      data: limited,
      error: null,
      count: state.selectOpts && state.selectOpts.count === 'exact' ? totalCount : limited.length,
    };
  }

  if (state.action === 'insert') {
    const incoming = Array.isArray(state.insertPayload) ? state.insertPayload : [state.insertPayload];
    const uniqueColsList = uniqueConstraints && uniqueConstraints[state.table];
    const inserted = [];

    for (const item of incoming) {
      const candidate = {
        id: item.id || nextMockId(state.table.slice(0, 3)),
        created_at: item.created_at || new Date().toISOString(),
        ...deepClone(item),
      };

      if (Array.isArray(uniqueColsList)) {
        for (const cols of uniqueColsList) {
          const dup = rows.some((existing) => cols.every((c) => existing[c] === candidate[c]));
          if (dup) {
            return {
              data: null,
              error: { code: '23505', message: `duplicate key violates unique constraint (${cols.join(',')})` },
            };
          }
        }
      }

      rows.push(candidate);
      inserted.push(hydrateRow(state.table, candidate, state.selectCols, tables).hydrated);
    }

    if (state.singleMode === 'single' || state.singleMode === 'maybeSingle') {
      return { data: inserted[0] || null, error: null };
    }
    return { data: inserted, error: null };
  }

  if (state.action === 'update') {
    const updated = [];
    for (let i = 0; i < rows.length; i += 1) {
      const { hydrated } = hydrateRow(state.table, rows[i], state.selectCols, tables);
      if (state.filters.every((f) => evaluateSingleFilter(hydrated, f))) {
        rows[i] = { ...rows[i], ...deepClone(state.updatePayload) };
        updated.push(hydrateRow(state.table, rows[i], state.selectCols, tables).hydrated);
      }
    }

    if (state.singleMode === 'single') {
      if (updated.length !== 1) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, no/multiple rows updated' },
        };
      }
      return { data: updated[0], error: null };
    }
    if (state.singleMode === 'maybeSingle') {
      if (updated.length > 1) {
        return { data: null, error: { code: 'PGRST116', message: 'Multiple rows updated' } };
      }
      return { data: updated[0] || null, error: null };
    }
    return { data: updated, error: null };
  }

  if (state.action === 'delete') {
    const kept = [];
    const removed = [];
    for (const r of rows) {
      const { hydrated } = hydrateRow(state.table, r, state.selectCols, tables);
      if (state.filters.every((f) => evaluateSingleFilter(hydrated, f))) {
        removed.push(hydrated);
      } else {
        kept.push(r);
      }
    }
    tables[state.table] = kept;
    return { data: removed, error: null };
  }

  return { data: null, error: null };
}

function createSupabaseMock(handlers = {}) {
  return {
    from(table) {
      const state = {
        table,
        action: 'select',
        selectCols: null,
        selectOpts: null,
        insertPayload: null,
        updatePayload: null,
        filters: [],
        orderBy: null,
        limitCount: null,
        singleMode: null,
      };

      const execute = () => {
        if (handlers.onQuery) {
          const override = handlers.onQuery({ ...state });
          if (override !== undefined) return override;
        }
        if (handlers.tables) {
          return executeStatefulQuery(state, handlers.tables, handlers.uniqueConstraints, handlers.onLog);
        }
        return { data: null, error: null, count: 0 };
      };

      const builder = {
        select(cols, opts) {
          if (state.action === 'select') {
            state.selectCols = cols;
            state.selectOpts = opts || null;
          } else if (cols) {
            state.selectCols = cols;
          }
          return builder;
        },
        insert(payload) {
          state.action = 'insert';
          state.insertPayload = payload;
          return builder;
        },
        update(payload) {
          state.action = 'update';
          state.updatePayload = payload;
          return builder;
        },
        delete() {
          state.action = 'delete';
          return builder;
        },
        eq(col, val) {
          state.filters.push({ op: 'eq', col, val });
          return builder;
        },
        neq(col, val) {
          state.filters.push({ op: 'neq', col, val });
          return builder;
        },
        gte(col, val) {
          state.filters.push({ op: 'gte', col, val });
          return builder;
        },
        lte(col, val) {
          state.filters.push({ op: 'lte', col, val });
          return builder;
        },
        gt(col, val) {
          state.filters.push({ op: 'gt', col, val });
          return builder;
        },
        lt(col, val) {
          state.filters.push({ op: 'lt', col, val });
          return builder;
        },
        in(col, val) {
          state.filters.push({ op: 'in', col, val });
          return builder;
        },
        ilike(col, val) {
          state.filters.push({ op: 'ilike', col, val });
          return builder;
        },
        is(col, val) {
          state.filters.push({ op: 'is', col, val });
          return builder;
        },
        not(col, subOp, val) {
          state.filters.push({ op: 'not', col, subOp, val });
          return builder;
        },
        or(expr) {
          state.filters.push({ op: 'or', expr });
          return builder;
        },
        order(col, opts) {
          state.orderBy = { col, opts };
          return builder;
        },
        limit(n) {
          state.limitCount = n;
          return builder;
        },
        range(from, to) {
          state.rangeSlice = [from, to];
          return builder;
        },
        single() {
          state.singleMode = 'single';
          return Promise.resolve(execute());
        },
        maybeSingle() {
          state.singleMode = 'maybeSingle';
          return Promise.resolve(execute());
        },
        then(resolve, reject) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };

      return builder;
    },
  };
}

function setModuleMock(relPath, exportsObj) {
  const fullPath = path.resolve(SERVER_SRC, relPath);
  require.cache[fullPath] = {
    id: fullPath,
    filename: fullPath,
    loaded: true,
    exports: exportsObj,
  };
}

function clearModule(relPath) {
  const fullPath = path.resolve(SERVER_SRC, relPath);
  delete require.cache[fullPath];
}

function clearAllTargets() {
  [
    'config/env.js',
    'config/db.js',
    'utils/dateUtils.js',
    'utils/jwt.js',
    'services/selfieStorageService.js',
    'services/notificationService.js',
    'services/timetableService.js',
    'services/lectureScheduler.js',
    'services/attendanceNotificationService.js',
    'services/otpService.js',
    'services/emailService.js',
    'services/passwordResetService.js',
    'middleware/auth.js',
    'middleware/roles.js',
    'middleware/errorHandler.js',
    'middleware/rateLimiter.js',
    'routes/lectureRoutes.js',
    'routes/attendanceRoutes.js',
    'routes/academicRoutes.js',
    'routes/adminRoutes.js',
    'routes/announcementRoutes.js',
    'routes/notificationRoutes.js',
    'routes/authRoutes.js',
    'controllers/lectureController.js',
    'controllers/attendanceController.js',
    'controllers/academicController.js',
    'controllers/announcementController.js',
    'controllers/notificationController.js',
    'controllers/authController.js',
    'controllers/adminController.js',
  ].forEach(clearModule);
}

function dispatchExpressRoute(app, { method = 'GET', url = '/', token = null, body = null } = {}) {
  const http = require('http');
  const { PassThrough } = require('stream');

  return new Promise((resolve, reject) => {
    const outChunks = [];
    const bodyBuf = body !== null && body !== undefined
      ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8')
      : null;

    const socket = new PassThrough();
    socket.remoteAddress = '127.0.0.1';
    socket.encrypted = false;

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = { host: 'localhost' };
    if (token) {
      req.headers.authorization = `Bearer ${token}`;
    }
    if (bodyBuf !== null) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = String(bodyBuf.length);
    }

    const res = new http.ServerResponse(req);
    const guardTimer = setTimeout(() => {
      reject(new Error(`dispatchExpressRoute timeout for ${method} ${url}`));
    }, 5000);

    let settled = false;
    const finishCapture = () => {
      if (settled) return;
      settled = true;
      clearTimeout(guardTimer);
      const rawBody = Buffer.concat(outChunks).toString('utf8');
      let parsedBody = rawBody;
      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : null;
      } catch (_e) {}
      resolve({
        statusCode: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody,
        rawBody,
      });
    };

    res.write = (chunk, encoding, cb) => {
      if (typeof encoding === 'function') {
        cb = encoding;
        encoding = undefined;
      }
      if (chunk !== undefined && chunk !== null) {
        outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding || 'utf8'));
      }
      if (typeof cb === 'function') cb();
      return true;
    };

    const origEnd = res.end.bind(res);
    res.end = (chunk, encoding, cb) => {
      if (typeof chunk === 'function') {
        cb = chunk;
        chunk = undefined;
      } else if (typeof encoding === 'function') {
        cb = encoding;
        encoding = undefined;
      }
      if (chunk !== undefined && chunk !== null) {
        outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding || 'utf8'));
      }
      const ret = origEnd(undefined, undefined, cb);
      finishCapture();
      return ret;
    };

    res.on('error', (err) => {
      clearTimeout(guardTimer);
      reject(err);
    });

    app(req, res);
    process.nextTick(() => {
      if (bodyBuf !== null) {
        req.push(bodyBuf);
      }
      req.push(null);
    });
  });
}

function callHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        resolve(res);
        return this;
      },
    };
    const next = (err) => {
      if (err) {
        err.statusCode = res.statusCode === 200 ? 500 : res.statusCode;
        reject(err);
      } else {
        resolve(res);
      }
    };
    handler(req, res, next);
  });
}

async function runTests() {
  const results = [];
  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`PASS: ${name}`);
    } catch (err) {
      results.push({ name, passed: false, error: err });
      console.error(`FAIL: ${name}\n`, err);
    }
  }

  // =========================================================================
  // 1. Baseline & Migration 011
  // =========================================================================
  await test('Migration 011 untouched draft contains schema, backfill, constraint & indexes', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    assert(sql.includes("ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'"));
    assert(sql.includes("CHECK (status IN ('SCHEDULED', 'ACTIVE', 'ONGOING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'))"));
    assert(sql.includes('CREATE INDEX IF NOT EXISTS idx_lectures_date_status'));
    assert(sql.includes('CREATE INDEX IF NOT EXISTS idx_lectures_div_subj_status'));
  });

  await test('All 6 modified modules load cleanly with mocked db/deps', () => {
    clearAllTargets();
    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock() });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({}),
      uploadAttendanceSelfie: async () => ({}),
      deleteSelfieObject: async () => ({}),
      generateSelfieSignedUrl: async () => '',
    });
    setModuleMock('services/notificationService.js', {
      createNotification: async () => {},
      sendToUsers: async () => {},
    });

    const mods = [
      'services/timetableService.js',
      'services/lectureScheduler.js',
      'services/attendanceNotificationService.js',
      'controllers/lectureController.js',
      'controllers/attendanceController.js',
      'controllers/adminController.js',
    ];
    for (const m of mods) {
      const loaded = require(path.resolve(SERVER_SRC, m));
      assert(loaded && typeof loaded === 'object', `${m} failed to load`);
    }
    clearAllTargets();
  });

  // =========================================================================
  // 2. FIX 1 (Stateful Evaluator): timetableService multi-division, locks & provenance
  // =========================================================================
  await test('FIX 1 (Stateful): timetableService skips cancelled, swapped, explicit rescheduled; ignores other dates & unrelated day rows; creates missing with lock', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: (d) => (typeof d === 'string' && d.length === 10 ? d : '2026-11-10'),
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 550,
      getKolkataTimeString: () => '09:10:00',
    });

    const tables = {
      users: [
        { id: 'u-t2', full_name: 'Teacher 2' },
        { id: 'u-t3', full_name: 'Teacher 3' },
        { id: 'u-t4', full_name: 'Teacher 4' },
      ],
      teachers: [
        { id: 'tch-1', user_id: null },
        { id: 'tch-2', user_id: 'u-t2' },
        { id: 'tch-3', user_id: 'u-t3' },
        { id: 'tch-4', user_id: 'u-t4' },
        { id: 'tch-g', user_id: null, full_name: 'Girish Kumbhar' },
      ],
      divisions: [
        { id: 'div-1', name: 'SY Div A', division_name: 'A' },
        { id: 'div-2', name: 'SY Div B', division_name: 'B' },
        { id: 'div-legacy', name: 'FYBSc CS', division_name: 'A' },
      ],
      subjects: [
        { id: 'sub-1', name: 'Math', code: 'M1', division_id: 'div-1' },
        { id: 'sub-2', name: 'OS', code: 'OS1', division_id: 'div-1' },
        { id: 'sub-proxy', name: 'Proxy Python', code: 'PX', division_id: 'div-1' },
        { id: 'sub-3', name: 'DBMS', code: 'DB1', division_id: 'div-2' },
        { id: 'sub-missing', name: 'Python Lab', code: 'PYL', division_id: 'div-2' },
        { id: 'sub-iks', name: 'Indian Knowledge Systems (IKS)', code: 'IKS', division_id: 'div-legacy' },
      ],
      division_timetables: [
        { id: 's1', division_id: 'div-1', day_of_week: 'tuesday', start_time: '09:00:00', end_time: '10:00:00', subject_id: 'sub-1', teacher_id: 'tch-1', is_lab: false },
        { id: 's2', division_id: 'div-1', day_of_week: 'TUESDAY', start_time: '10:00:00', end_time: '11:00:00', subject_id: 'sub-2', teacher_id: 'tch-2', is_lab: false },
        { id: 's3', division_id: 'div-2', day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00', subject_id: 'sub-3', teacher_id: 'tch-3', is_lab: false },
        { id: 's4', division_id: 'div-2', day_of_week: 'Tuesday', start_time: '11:00:00', end_time: '12:00:00', subject_id: 'sub-missing', teacher_id: 'tch-4', is_lab: true },
        // Wednesday slot must be ignored by Tuesday .ilike('day_of_week', 'Tuesday') query!
        { id: 's-wed', division_id: 'div-2', day_of_week: 'Wednesday', start_time: '12:00:00', end_time: '13:00:00', subject_id: 'sub-1', teacher_id: 'tch-1', is_lab: false },
      ],
      lectures: [
        // Div 1 @ 09:00 cancelled -> do not recreate
        { id: 'lec-div1-cancel', division_id: 'div-1', subject_id: 'sub-1', lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'CANCELLED', topic: '[CANCELLED] Math' },
        // Div 1 @ 10:00 swapped/proxy -> do not recreate
        { id: 'lec-div1-proxy', division_id: 'div-1', subject_id: 'sub-proxy', lecture_date: '2026-11-10', start_time: '10:00:00', end_time: '11:00:00', status: 'SCHEDULED', topic: 'Proxy Python' },
        // Div 2 @ 09:00 rescheduled explicitly to 14:00 -> do not recreate
        { id: 'lec-div2-resched', division_id: 'div-2', subject_id: 'sub-3', lecture_date: '2026-11-10', start_time: '14:00:00', end_time: '15:00:00', status: 'RESCHEDULED', topic: '[RESCHEDULED] DBMS' },
        // Div 2 extra manual class at 15:00 for sub-missing -> genuine 11:00 missing slot MUST STILL be created!
        { id: 'lec-div2-extra', division_id: 'div-2', subject_id: 'sub-missing', lecture_date: '2026-11-10', start_time: '15:00:00', end_time: '16:00:00', status: 'SCHEDULED', topic: 'Extra Doubt Session' },
        // Yesterday row at 11:00 must be ignored by eq('lecture_date', '2026-11-10')!
        { id: 'lec-yesterday', division_id: 'div-2', subject_id: 'sub-missing', lecture_date: '2026-11-09', start_time: '11:00:00', end_time: '12:00:00', status: 'COMPLETED', topic: 'Yesterday' },
      ],
    };

    const insertBatches = [];
    setModuleMock('config/db.js', {
      supabaseAdmin: createSupabaseMock({
        tables,
        onLog(q) {
          if (q.table === 'lectures' && q.action === 'insert') insertBatches.push(q.insertPayload);
        },
      }),
    });

    const tt = require(path.resolve(SERVER_SRC, 'services/timetableService.js'));
    const [c1, c2] = await Promise.all([
      tt.syncTodayLectures('2026-11-10'),
      tt.syncTodayLectures('2026-11-10'),
    ]);
    assert.strictEqual(c1.inserted, 2);
    assert.strictEqual(c2.inserted, 2);
    assert.strictEqual(insertBatches.length, 1);

    const createdKeys = insertBatches[0].map((r) => `${r.division_id}-${r.subject_id}`);
    assert.deepStrictEqual(createdKeys, ['div-2-sub-missing', 'div-legacy-sub-iks']);
    assert.strictEqual(insertBatches[0][0].created_by, 'u-t4');
    assert.strictEqual(insertBatches[0][1].created_by, null);
    assert.strictEqual(tables.lectures.filter((l) => l.lecture_date === '2026-11-10').length, 6);

    const repeat = await tt.syncTodayLectures('2026-11-10');
    assert.strictEqual(repeat.inserted, 0);
    assert.strictEqual(insertBatches.length, 1);
    clearAllTargets();
  });

  // =========================================================================
  // 3. FIX 2 & Section 4 (Stateful Evaluator): markAttendance, cancelled + replacement, 409, PGRST116, 23505
  // =========================================================================
  await test('FIX 2 & Section 4 (Stateful): markAttendance slot resolution, cancelled+unique replacement, multiple active 409, direct IDs, PGRST116 & 23505', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: () => '2026-11-10',
      getKolkataMinutes: () => 570,
    });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({ buffer: Buffer.from('img'), mimeType: 'image/jpeg', extension: 'jpg' }),
      uploadAttendanceSelfie: async (arg) => ({
        storagePath: `${arg.studentId}/${arg.attendanceId}.jpg`,
        uploadedAt: '2026-11-10T09:30:00.000Z',
        expiresAt: '2026-12-10T09:30:00.000Z',
      }),
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => 'signed',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });
    setModuleMock('services/attendanceNotificationService.js', { checkAndNotifyLowAttendance: async () => {} });

    const tables = {
      divisions: [
        { id: 'div-1', name: 'FY', division_name: 'A' },
      ],
      students: [
        { id: 'stu-1', user_id: 'u1', student_id: 'S1', division_id: 'div-1' },
        { id: 'stu-2', user_id: 'u2', student_id: 'S2', division_id: 'div-1' },
        { id: 'stu-3', user_id: 'u3', student_id: 'S3', division_id: 'div-1' },
      ],
      subjects: [
        { id: 'sub-1', name: 'DSA', code: 'DSA', division_id: 'div-1' },
        { id: 'sub-proxy', name: 'Proxy Sub', code: 'PRX', division_id: 'div-1' },
      ],
      division_timetables: [
        { id: 'slot-1', division_id: 'div-1', subject_id: 'sub-1', teacher_id: 'tch-1', day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00' },
      ],
      lectures: [],
      attendance: [],
      system_config: [],
    };

    const queriedTables = new Set();
    let mode = 'NORMAL';
    let simulate23505Once = false;
    let lectureInsertCount = 0;

    setModuleMock('config/db.js', {
      supabaseAdmin: createSupabaseMock({
        tables,
        onLog(q) {
          queriedTables.add(q.table);
          if (q.table === 'lectures' && q.action === 'insert') lectureInsertCount += 1;
        },
        onQuery(q) {
          queriedTables.add(q.table);
          if (q.table === 'attendance_records') {
            throw new Error('FORBIDDEN: attendance_records must not be queried at runtime');
          }
          if (mode === 'DB_ERROR_PGRST116' && q.table === 'lectures' && q.action === 'select' && !q.singleMode) {
            return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple rows returned' } };
          }
          if (simulate23505Once && q.table === 'lectures' && q.action === 'insert') {
            simulate23505Once = false;
            tables.lectures.push({
              id: 'lec-concurrent-winner',
              division_id: 'div-1',
              subject_id: 'sub-1',
              lecture_date: '2026-11-10',
              start_time: '09:00:00',
              end_time: '10:00:00',
              status: 'SCHEDULED',
              topic: 'DSA',
            });
            return { data: null, error: { code: '23505', message: 'duplicate key violation' } };
          }
          return undefined; // fall through to real stateful query evaluator!
        },
      }),
    });

    const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));
    const mkBody = (lecId) => ({ lecture_id: lecId, latitude: 19.02479, longitude: 73.10159, selfie: 'data' });
    const reqU1 = { id: 'u1', role: 'student', status: 'ACTIVE' };
    const reqU2 = { id: 'u2', role: 'student', status: 'ACTIVE' };
    const reqU3 = { id: 'u3', role: 'student', status: 'ACTIVE' };

    // 1. Single scheduled lecture at slot -> 201
    tables.lectures = [{
      id: 'lec-sched-1', division_id: 'div-1', subject_id: 'sub-1', lecture_date: '2026-11-10',
      start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'DSA',
    }];
    const rOne = await callHandler(ac.markAttendance, { user: reqU1, body: mkBody('slot-1') });
    assert.strictEqual(rOne.statusCode, 201);
    assert.strictEqual(rOne.body.data.attendance.lecture_id, 'lec-sched-1');
    assert.strictEqual(lectureInsertCount, 0);

    // 2. Single legacy [CANCELLED] lecture -> 400
    tables.attendance = [];
    tables.lectures = [{
      id: 'lec-cancel-legacy', division_id: 'div-1', subject_id: 'sub-1', lecture_date: '2026-11-10',
      start_time: '09:00:00', end_time: '10:00:00', status: 'ACTIVE', topic: '[CANCELLED] DSA',
    }];
    await assert.rejects(
      () => callHandler(ac.markAttendance, { user: reqU1, body: mkBody('slot-1') }),
      (e) => e.statusCode === 400 && /cancelled/.test(e.message)
    );

    // 3. Cancelled original + UNIQUE non-cancelled replacement at same 09:00 slot via slot-1 -> resolves to replacement (NEVER cancelled!)
    tables.attendance = [];
    tables.lectures = [
      {
        id: 'l-orig-cancelled', division_id: 'div-1', subject_id: 'sub-1', lecture_date: '2026-11-10',
        start_time: '09:00:00', end_time: '10:00:00', status: 'CANCELLED', topic: '[CANCELLED] DSA',
      },
      {
        id: 'l-replacement', division_id: 'div-1', subject_id: 'sub-proxy', lecture_date: '2026-11-10',
        start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'Proxy Replacement',
      },
    ];
    const rReplace = await callHandler(ac.markAttendance, { user: reqU1, body: mkBody('slot-1') });
    assert.strictEqual(rReplace.statusCode, 201);
    assert.strictEqual(rReplace.body.data.attendance.lecture_id, 'l-replacement');
    assert.strictEqual(lectureInsertCount, 0);

    // Existing direct lecture-ID behavior preserved: passing cancelled l-orig-cancelled directly still rejects 400!
    await assert.rejects(
      () => callHandler(ac.markAttendance, { user: reqU2, body: mkBody('l-orig-cancelled') }),
      (e) => e.statusCode === 400 && /cancelled/.test(e.message)
    );
    // Passing l-replacement directly still works -> 201
    const rDirectReplace = await callHandler(ac.markAttendance, { user: reqU2, body: mkBody('l-replacement') });
    assert.strictEqual(rDirectReplace.statusCode, 201);
    assert.strictEqual(rDirectReplace.body.data.attendance.lecture_id, 'l-replacement');

    // Duplicate attendance on replacement lecture -> 400 and no duplicate insert
    const beforeDupCount = tables.attendance.length;
    await assert.rejects(
      () => callHandler(ac.markAttendance, { user: reqU2, body: mkBody('l-replacement') }),
      (e) => e.statusCode === 400 && /already marked/i.test(e.message)
    );
    assert.strictEqual(tables.attendance.length, beforeDupCount);

    // 4. Multiple active non-cancelled rows at 09:00 (plus cancelled row) -> 409 Conflict!
    tables.attendance = [];
    tables.lectures.push({
      id: 'l-second-active', division_id: 'div-1', subject_id: 'sub-1', lecture_date: '2026-11-10',
      start_time: '09:00:00', end_time: '10:00:00', status: 'ONGOING', topic: 'Second Conflicting',
    });
    await assert.rejects(
      () => callHandler(ac.markAttendance, { user: reqU1, body: mkBody('slot-1') }),
      (e) => e.statusCode === 409 && /Multiple conflicting/.test(e.message)
    );
    assert.strictEqual(lectureInsertCount, 0);

    // 5. DB error PGRST116 -> 500, no insert
    tables.lectures = [];
    mode = 'DB_ERROR_PGRST116';
    await assert.rejects(
      () => callHandler(ac.markAttendance, { user: reqU1, body: mkBody('slot-1') }),
      (e) => e.statusCode === 500
    );
    mode = 'NORMAL';
    assert.strictEqual(lectureInsertCount, 0);

    // 6. Concurrent missing slot fallback -> single lecture created
    const [c1, c2] = await Promise.all([
      callHandler(ac.markAttendance, { user: reqU1, body: mkBody('slot-1') }),
      callHandler(ac.markAttendance, { user: reqU2, body: mkBody('slot-1') }),
    ]);
    assert.strictEqual(c1.statusCode, 201);
    assert.strictEqual(c2.statusCode, 201);
    assert.strictEqual(lectureInsertCount, 1);

    // 7. 23505 multi-worker duplicate recovery
    tables.lectures = [];
    tables.attendance = [];
    simulate23505Once = true;
    const r23505 = await callHandler(ac.markAttendance, { user: reqU3, body: mkBody('slot-1') });
    assert.strictEqual(r23505.statusCode, 201);
    assert.strictEqual(r23505.body.data.attendance.lecture_id, 'lec-concurrent-winner');

    assert(!queriedTables.has('attendance_records'), 'attendance_records must never be queried');
    assert(queriedTables.has('attendance'), 'attendance table must be canonical');
    clearAllTargets();
  });

  // =========================================================================
  // 4. FIX 3 & Section 5: reschedule + createLecture late-time & normalization
  // =========================================================================
  await test('FIX 3 & Section 5: reschedule & createLecture reject 23:30+60m default overflow 400, reject cross-midnight, preserve explicit 23:30-23:59, HH:MM normalization', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: () => '2026-11-10',
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 550,
      getKolkataTimeString: () => '09:10:00',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });

    const tables = {
      teachers: [{ id: 'tch-a', user_id: 'u-tch-a', teacher_id: 'T1' }],
      subjects: [{ id: 'sub-1', name: 'DSA', code: 'DSA', division_id: 'div-1' }],
      divisions: [{ id: 'div-1', name: 'SY BSc', division_name: 'A' }],
      teacher_subjects: [{ id: 'ts-1', teacher_id: 'tch-a', subject_id: 'sub-1' }],
      lectures: [
        {
          id: 'lec-1', division_id: 'div-1', subject_id: 'sub-1', teacher_id: 'tch-a',
          lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00',
          status: 'SCHEDULED', topic: 'DSA Lecture',
        },
        {
          id: 'lec-short-format', division_id: 'div-1', subject_id: 'sub-1', teacher_id: 'tch-a',
          lecture_date: '2026-11-10', start_time: '09:00', end_time: '10:00',
          status: 'SCHEDULED', topic: 'DSA Lecture',
        },
      ],
      students: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });
    const lc = require(path.resolve(SERVER_SRC, 'controllers/lectureController.js'));
    const teacherAUser = { id: 'u-tch-a', role: 'teacher', status: 'ACTIVE' };

    // 1. Move 09:00-10:00 -> 14:00 preserves 60m duration -> 15:00:00 & RESCHEDULED
    const rMove = await callHandler(lc.updateLecture, {
      user: teacherAUser, params: { id: 'lec-1' }, body: { start_time: '14:00' },
    });
    assert.strictEqual(rMove.statusCode, 200);
    assert.strictEqual(rMove.body.data.lecture.end_time, '15:00:00');
    assert.strictEqual(rMove.body.data.lecture.status, 'RESCHEDULED');

    tables.lectures[0] = {
      ...tables.lectures[0],
      start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'DSA Lecture',
    };

    // 2. Reschedule 23:30 without end_time (+60m > 23:59) -> rejected 400
    await assert.rejects(
      () => callHandler(lc.updateLecture, { user: teacherAUser, params: { id: 'lec-1' }, body: { start_time: '23:30' } }),
      (e) => e.statusCode === 400 && /exceed 23:59/.test(e.message)
    );

    // 3. Reschedule with explicit 23:30-23:59 -> allowed 200
    const rExplicitLate = await callHandler(lc.updateLecture, {
      user: teacherAUser, params: { id: 'lec-1' }, body: { start_time: '23:30', end_time: '23:59' },
    });
    assert.strictEqual(rExplicitLate.statusCode, 200);
    assert.strictEqual(rExplicitLate.body.data.lecture.end_time, '23:59:00');

    // 4. Inverted / cross-midnight -> 400
    await assert.rejects(
      () => callHandler(lc.updateLecture, { user: teacherAUser, params: { id: 'lec-1' }, body: { start_time: '23:30', end_time: '00:30' } }),
      (e) => e.statusCode === 400
    );

    // 5. createLecture at 23:30 without end_time -> rejected 400 (no silent clamp to 23:59!)
    await assert.rejects(
      () => callHandler(lc.createLecture, {
        user: teacherAUser,
        body: { subject_id: 'sub-1', division_id: 'div-1', lecture_date: '2026-11-10', start_time: '23:30' },
      }),
      (e) => e.statusCode === 400 && /exceed 23:59/.test(e.message)
    );

    // 6. createLecture at 23:30 with cross-midnight end_time -> rejected 400
    await assert.rejects(
      () => callHandler(lc.createLecture, {
        user: teacherAUser,
        body: { subject_id: 'sub-1', division_id: 'div-1', lecture_date: '2026-11-10', start_time: '23:30', end_time: '00:30' },
      }),
      (e) => e.statusCode === 400
    );

    // 7. createLecture at 23:30 with explicit end_time 23:59 -> accepted 201
    const rCreateExplicitLate = await callHandler(lc.createLecture, {
      user: teacherAUser,
      body: { subject_id: 'sub-1', division_id: 'div-1', lecture_date: '2026-11-10', start_time: '23:30', end_time: '23:59' },
    });
    assert.strictEqual(rCreateExplicitLate.statusCode, 201);
    assert.strictEqual(rCreateExplicitLate.body.data.lecture.end_time, '23:59:00');

    // 8. createLecture at 22:59 without end_time -> fits cleanly at 23:59:00 -> accepted 201
    const rCreateBoundaryOk = await callHandler(lc.createLecture, {
      user: teacherAUser,
      body: { subject_id: 'sub-1', division_id: 'div-1', lecture_date: '2026-11-10', start_time: '22:59' },
    });
    assert.strictEqual(rCreateBoundaryOk.statusCode, 201);
    assert.strictEqual(rCreateBoundaryOk.body.data.lecture.end_time, '23:59:00');

    // 9. HH:MM vs HH:MM:SS equivalence keeps scheduleChanged=false
    const rHHMM = await callHandler(lc.updateLecture, {
      user: teacherAUser,
      params: { id: 'lec-short-format' },
      body: { start_time: '09:00:00', end_time: '10:00', lecture_date: '2026-11-10', topic: 'DSA Edited Topic' },
    });
    assert.strictEqual(rHHMM.statusCode, 200);
    assert.strictEqual(tables.lectures.find((l) => l.id === 'lec-short-format').status, 'SCHEDULED');

    // 10. Status precedence & ACTIVE -> SCHEDULED
    const rExplicitActive = await callHandler(lc.updateLecture, {
      user: teacherAUser, params: { id: 'lec-short-format' }, body: { start_time: '16:00', status: 'ACTIVE' },
    });
    assert.strictEqual(rExplicitActive.body.data.lecture.status, 'UPCOMING');
    assert.strictEqual(tables.lectures.find((l) => l.id === 'lec-short-format').status, 'SCHEDULED');
    clearAllTargets();
  });

  // =========================================================================
  // 5. FIX 4 & 5 Auth Matrix + Section 6 Teacher Read-Scope
  // =========================================================================
  await test('Auth & Section 6 Read-Scope: Fail-closed mutations/attendance/selfies AND teacher list view_only vs can_manage separation', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: () => '2026-11-10',
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 570, // 09:30 IST
      getKolkataTimeString: () => '09:30:00',
    });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({}),
      uploadAttendanceSelfie: async () => ({}),
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => 'https://signed.example/selfie.jpg',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });
    setModuleMock('services/attendanceNotificationService.js', { checkAndNotifyLowAttendance: async () => {} });

    const tables = {
      users: [
        { id: 'u-admin', full_name: 'Admin', role: 'admin', status: 'ACTIVE' },
        { id: 'u-tch-a', full_name: 'Teacher A', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-tch-b', full_name: 'Teacher B', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-tch-no-prof', full_name: 'No Profile', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-stu-1', full_name: 'Student 1', role: 'student', status: 'ACTIVE' },
      ],
      teachers: [
        { id: 'tch-a', user_id: 'u-tch-a', teacher_id: 'TA' },
        { id: 'tch-b', user_id: 'u-tch-b', teacher_id: 'TB' },
      ],
      divisions: [
        { id: 'div-a', name: 'SY BSc', division_name: 'A' },
        { id: 'div-b', name: 'SY BSc', division_name: 'B' },
      ],
      subjects: [
        { id: 'sub-shared', name: 'OS', code: 'OS', division_id: 'div-a' },
        { id: 'sub-null-div', name: 'Elective NoDiv', code: 'EL1', division_id: null },
        { id: 'sub-null-tt', name: 'Elective WithTT', code: 'EL2', division_id: null },
        { id: 'sub-other', name: 'Other Only B', code: 'OTH', division_id: 'div-b' },
      ],
      teacher_subjects: [
        { id: 'ts-a-shared', teacher_id: 'tch-a', subject_id: 'sub-shared' },
        { id: 'ts-b-shared', teacher_id: 'tch-b', subject_id: 'sub-shared' },
        { id: 'ts-b-other', teacher_id: 'tch-b', subject_id: 'sub-other' },
        { id: 'ts-a-nulldiv', teacher_id: 'tch-a', subject_id: 'sub-null-div' },
        { id: 'ts-a-nulltt', teacher_id: 'tch-a', subject_id: 'sub-null-tt' },
      ],
      division_timetables: [
        { id: 'tt-null-ok', division_id: 'div-a', subject_id: 'sub-null-tt', teacher_id: 'tch-a', day_of_week: 'Tuesday', start_time: '12:00:00', end_time: '13:00:00' },
      ],
      students: [{ id: 'stu-1', user_id: 'u-stu-1', student_id: 'ROLL01', division_id: 'div-a' }],
      lectures: [
        {
          id: 'lec-owned-b-shared', division_id: 'div-a', subject_id: 'sub-shared', teacher_id: 'tch-b',
          lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'Owned by B Shared',
        },
        {
          id: 'lec-owned-a', division_id: 'div-a', subject_id: 'sub-shared', teacher_id: 'tch-a',
          lecture_date: '2026-11-10', start_time: '09:15:00', end_time: '10:15:00', status: 'SCHEDULED', topic: 'Owned by A',
        },
        {
          id: 'lec-owned-b-other', division_id: 'div-b', subject_id: 'sub-other', teacher_id: 'tch-b',
          lecture_date: '2026-11-10', start_time: '10:00:00', end_time: '11:00:00', status: 'SCHEDULED', topic: 'Other Div/Subject',
        },
        {
          id: 'lec-unassigned-valid', division_id: 'div-a', subject_id: 'sub-shared', teacher_id: null,
          lecture_date: '2026-11-10', start_time: '11:00:00', end_time: '12:00:00', status: 'SCHEDULED', topic: 'Unassigned Valid',
        },
        {
          id: 'lec-unassigned-nulldiv', division_id: 'div-a', subject_id: 'sub-null-div', teacher_id: null,
          lecture_date: '2026-11-10', start_time: '13:00:00', end_time: '14:00:00', status: 'SCHEDULED', topic: 'Null Div Unverifiable',
        },
        {
          id: 'lec-unassigned-tt-ok', division_id: 'div-a', subject_id: 'sub-null-tt', teacher_id: null,
          lecture_date: '2026-11-10', start_time: '12:00:00', end_time: '13:00:00', status: 'SCHEDULED', topic: 'Null Div With TT',
        },
        {
          id: 'lec-cancelled', division_id: 'div-a', subject_id: 'sub-shared', teacher_id: 'tch-a',
          lecture_date: '2026-11-10', start_time: '15:00:00', end_time: '16:00:00', status: 'ACTIVE', topic: '[CANCELLED] Cancelled Legacy',
        },
      ],
      attendance: [
        { id: 'att-b-1', lecture_id: 'lec-owned-b-shared', student_id: 'stu-1', status: 'PRESENT', selfie_url: 'a.jpg', selfie_storage_path: 'stu-1/a.jpg' },
        { id: 'att-unassigned-1', lecture_id: 'lec-unassigned-valid', student_id: 'stu-1', status: 'ABSENT', selfie_url: 'b.jpg', selfie_storage_path: 'stu-1/b.jpg' },
      ],
      attendance_audit_logs: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });
    const lc = require(path.resolve(SERVER_SRC, 'controllers/lectureController.js'));
    const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));

    const teacherA = { id: 'u-tch-a', role: 'teacher', status: 'ACTIVE' };
    const teacherNoProf = { id: 'u-tch-no-prof', role: 'teacher', status: 'ACTIVE' };
    const adminUser = { id: 'u-admin', role: 'admin', status: 'ACTIVE' };

    // A) Fail-closed mutations & attendance/selfie checks on Teacher B's lecture
    await assert.rejects(
      () => callHandler(lc.updateLectureStatus, { user: teacherA, params: { id: 'lec-owned-b-shared' }, body: { status: 'ONGOING' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.updateLecture, { user: teacherA, params: { id: 'lec-owned-b-shared' }, body: { topic: 'Hijack' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.deleteLecture, { user: teacherA, params: { id: 'lec-owned-b-shared' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(ac.getLectureAttendance, { user: teacherA, params: { lectureId: 'lec-owned-b-shared' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(ac.overrideAttendance, { user: teacherA, body: { lecture_id: 'lec-owned-b-shared', student_pk: 'stu-1', status: 'PRESENT' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(ac.getAttendanceSelfie, { user: teacherA, params: { attendanceId: 'att-b-1' } }),
      (e) => e.statusCode === 403
    );

    // B) Teacher read-scope checks (getActiveLectures, getTodaySchedule, getAllLectures)
    const rActiveA = await callHandler(lc.getActiveLectures, { user: teacherA });
    const activeIdsA = rActiveA.body.data.lectures.map((l) => l.id);
    assert(!activeIdsA.includes('lec-owned-b-shared'), 'getActiveLectures must NOT return another teacher owned lecture');
    assert(!activeIdsA.includes('lec-owned-b-other'));
    assert(!activeIdsA.includes('lec-unassigned-nulldiv'));
    assert(activeIdsA.includes('lec-owned-a'));
    assert(activeIdsA.includes('lec-unassigned-valid'));
    assert(activeIdsA.includes('lec-unassigned-tt-ok'));

    const rTodayA = await callHandler(lc.getTodaySchedule, { user: teacherA, query: {} });
    const myIdsA = rTodayA.body.data.my_lectures.map((l) => l.id);
    assert(!myIdsA.includes('lec-owned-b-shared'), 'my_lectures must exclude another teacher owned lecture');
    assert(myIdsA.includes('lec-owned-a'));
    assert(myIdsA.includes('lec-unassigned-valid'));
    assert.strictEqual(rTodayA.body.data.current_lecture.id, 'lec-owned-a');
    // all_lectures preserves co-teaching visibility for sub-shared with view_only=true, can_manage=false!
    const sharedInAll = rTodayA.body.data.all_lectures.find((l) => l.id === 'lec-owned-b-shared');
    assert(sharedInAll, 'Co-teaching visibility preserved in all_lectures');
    assert.strictEqual(sharedInAll.can_manage, false);
    assert.strictEqual(sharedInAll.view_only, true);
    assert(!rTodayA.body.data.all_lectures.some((l) => l.id === 'lec-owned-b-other'));

    const rAllA = await callHandler(lc.getAllLectures, { user: teacherA });
    const sharedAllRow = rAllA.body.data.lectures.find((l) => l.id === 'lec-owned-b-shared');
    assert(sharedAllRow && sharedAllRow.can_manage === false && sharedAllRow.view_only === true);
    assert(!rAllA.body.data.lectures.some((l) => l.id === 'lec-owned-b-other'));
    assert.strictEqual(rAllA.body.data.lectures.find((l) => l.id === 'lec-owned-a').can_manage, true);

    // Missing teacher profile fails closed on lists too (no leak of all lectures!)
    const rActiveNoProf = await callHandler(lc.getActiveLectures, { user: teacherNoProf });
    const rTodayNoProf = await callHandler(lc.getTodaySchedule, { user: teacherNoProf, query: {} });
    const rAllNoProf = await callHandler(lc.getAllLectures, { user: teacherNoProf });
    assert.deepStrictEqual(rActiveNoProf.body.data.lectures, []);
    assert.deepStrictEqual(rTodayNoProf.body.data.my_lectures, []);
    assert.deepStrictEqual(rTodayNoProf.body.data.all_lectures, []);
    assert.deepStrictEqual(rAllNoProf.body.data.lectures, []);

    // Admin read & manage access intact
    const rAllAdmin = await callHandler(lc.getAllLectures, { user: adminUser });
    assert(rAllAdmin.body.data.lectures.some((l) => l.id === 'lec-owned-b-other'));

    // C) createLecture/updateLecture subject+div guards & unassigned fallback checks
    await assert.rejects(
      () => callHandler(lc.createLecture, { user: teacherA, body: { subject_id: 'sub-other', division_id: 'div-b', start_time: '16:00', end_time: '17:00' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.createLecture, { user: teacherA, body: { subject_id: 'sub-shared', division_id: 'div-b', start_time: '16:00', end_time: '17:00' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.createLecture, { user: teacherA, body: { subject_id: 'sub-null-div', division_id: 'div-a', start_time: '16:00', end_time: '17:00' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.updateLecture, { user: teacherA, params: { id: 'lec-owned-a' }, body: { division_id: 'div-b' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.updateLectureStatus, { user: teacherA, params: { id: 'lec-unassigned-nulldiv' }, body: { status: 'ONGOING' } }),
      (e) => e.statusCode === 403
    );

    const rUnassignedTT = await callHandler(lc.updateLectureStatus, {
      user: teacherA, params: { id: 'lec-unassigned-tt-ok' }, body: { status: 'ONGOING' },
    });
    assert.strictEqual(rUnassignedTT.statusCode, 200);

    const rRosterOk = await callHandler(ac.getLectureAttendance, { user: teacherA, params: { lectureId: 'lec-unassigned-valid' } });
    assert.strictEqual(rRosterOk.statusCode, 200);

    const rSelfieOk = await callHandler(ac.getAttendanceSelfie, { user: teacherA, params: { attendanceId: 'att-unassigned-1' } });
    assert.strictEqual(rSelfieOk.statusCode, 200);
    assert.strictEqual(rSelfieOk.body.data.signed_url, 'https://signed.example/selfie.jpg');

    const rOverride = await callHandler(ac.overrideAttendance, {
      user: teacherA, body: { lecture_id: 'lec-unassigned-valid', student_pk: 'stu-1', status: 'PRESENT', reason: 'In class' },
    });
    assert.strictEqual(rOverride.statusCode, 200);
    assert.strictEqual(tables.attendance_audit_logs.length, 1);

    await assert.rejects(
      () => callHandler(ac.overrideAttendance, { user: adminUser, body: { lecture_id: 'lec-cancelled', student_pk: 'stu-1', status: 'PRESENT' } }),
      (e) => e.statusCode === 400
    );
    clearAllTargets();
  });

  // =========================================================================
  // 6. CRITICAL Safety Tests: Manual Extra ONGOING/COMPLETED vs Explicit Provenance, Multi-Slot Ambiguity & Cross-Date Limits
  // =========================================================================
  await test('Section 2 & 3 Safety: Manual extra ONGOING/COMPLETED lectures NEVER suppress or hijack timetable slots; explicit RESCHEDULED->ONGOING->COMPLETED provenance works; ambiguous & cross-date fail safely', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: (d) => (typeof d === 'string' && d.length === 10 ? d : '2026-11-10'),
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 855, // 14:15 IST
      getKolkataTimeString: () => '14:15:00',
    });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({ buffer: Buffer.from('img'), mimeType: 'image/jpeg', extension: 'jpg' }),
      uploadAttendanceSelfie: async (arg) => ({
        storagePath: `${arg.studentId}/${arg.attendanceId}.jpg`,
        uploadedAt: '2026-11-10T14:15:00.000Z',
        expiresAt: '2026-12-10T14:15:00.000Z',
      }),
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => 'signed',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });
    setModuleMock('services/attendanceNotificationService.js', { checkAndNotifyLowAttendance: async () => {} });

    const tables = {
      users: [
        { id: 'u-stu', full_name: 'Stu', role: 'student', status: 'ACTIVE' },
        { id: 'u-tch', full_name: 'Prof X', role: 'teacher', status: 'ACTIVE' },
      ],
      teachers: [{ id: 'tch-1', user_id: 'u-tch', teacher_id: 'T1' }],
      divisions: [{ id: 'div-1', name: 'SY BSc', division_name: 'A' }],
      subjects: [
        { id: 'sub-math', name: 'Mathematics', code: 'MTH', division_id: 'div-1' },
        { id: 'sub-chem', name: 'Chemistry', code: 'CHM', division_id: 'div-1' },
        { id: 'sub-bio', name: 'Biology', code: 'BIO', division_id: 'div-1' },
        { id: 'sub-phys', name: 'Physics', code: 'PHY', division_id: 'div-1' },
        { id: 'sub-eng', name: 'English', code: 'ENG', division_id: 'div-1' },
      ],
      teacher_subjects: [
        { id: 'ts-1', teacher_id: 'tch-1', subject_id: 'sub-math' },
      ],
      students: [{ id: 'stu-1', user_id: 'u-stu', student_id: 'S01', division_id: 'div-1' }],
      division_timetables: [
        // Math: 1 slot at 09:00 -> will undergo full RESCHEDULED -> ONGOING -> COMPLETED lifecycle (moved to 14:00)
        { id: 'slot-math-09', division_id: 'div-1', day_of_week: 'Tuesday', subject_id: 'sub-math', teacher_id: 'tch-1', start_time: '09:00:00', end_time: '10:00:00', is_lab: false },
        // Chemistry: 1 slot at 13:00 (open at 14:15 via 1h grace!) + unrelated manual ONGOING lecture at 10:00
        { id: 'slot-chem-13', division_id: 'div-1', day_of_week: 'Tuesday', subject_id: 'sub-chem', teacher_id: 'tch-1', start_time: '13:00:00', end_time: '14:00:00', is_lab: false },
        // Biology: 1 slot at 13:30 (open at 14:15!) + unrelated manual COMPLETED lecture at 10:00
        { id: 'slot-bio-1330', division_id: 'div-1', day_of_week: 'Tuesday', subject_id: 'sub-bio', teacher_id: 'tch-1', start_time: '13:30:00', end_time: '14:30:00', is_lab: false },
        // Physics: 2 slots on same day (10:00 & 11:00) -> ambiguous reschedule test
        { id: 'slot-phys-10', division_id: 'div-1', day_of_week: 'Tuesday', subject_id: 'sub-phys', teacher_id: 'tch-1', start_time: '10:00:00', end_time: '11:00:00', is_lab: false },
        { id: 'slot-phys-11', division_id: 'div-1', day_of_week: 'Tuesday', subject_id: 'sub-phys', teacher_id: 'tch-1', start_time: '11:00:00', end_time: '12:00:00', is_lab: false },
        // English: 1 slot at 09:30 today, moved to TOMORROW (2026-11-11) -> cross-date limitation test
        { id: 'slot-eng-0930', division_id: 'div-1', day_of_week: 'Tuesday', subject_id: 'sub-eng', teacher_id: 'tch-1', start_time: '09:30:00', end_time: '10:30:00', is_lab: false },
      ],
      lectures: [
        // Math original slot row (about to be rescheduled to 14:00 via controller!)
        { id: 'lec-math-orig', division_id: 'div-1', subject_id: 'sub-math', teacher_id: 'tch-1', lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'Mathematics' },
        // Unrelated manual ONGOING extra Chemistry lecture at 08:00 (NO [RESCHEDULED] tag)
        { id: 'lec-chem-manual-ongoing', division_id: 'div-1', subject_id: 'sub-chem', teacher_id: 'tch-1', lecture_date: '2026-11-10', start_time: '08:00:00', end_time: '09:00:00', status: 'ONGOING', topic: 'Extra Chem Revision' },
        // Unrelated manual COMPLETED extra Biology lecture at 08:30 (NO [RESCHEDULED] tag)
        { id: 'lec-bio-manual-completed', division_id: 'div-1', subject_id: 'sub-bio', teacher_id: 'tch-1', lecture_date: '2026-11-10', start_time: '08:30:00', end_time: '09:20:00', status: 'COMPLETED', topic: 'Morning Doubt Class' },
        // Ambiguous off-slot Physics lecture at 15:00 when BOTH 10:00 and 11:00 are unmatched
        { id: 'lec-phys-1500', division_id: 'div-1', subject_id: 'sub-phys', teacher_id: 'tch-1', lecture_date: '2026-11-10', start_time: '15:00:00', end_time: '16:00:00', status: 'RESCHEDULED', topic: '[RESCHEDULED] Physics' },
        // English moved to TOMORROW (2026-11-11) 14:00 -> must NOT be falsely bound to today's slot!
        { id: 'lec-eng-tomorrow', division_id: 'div-1', subject_id: 'sub-eng', teacher_id: 'tch-1', lecture_date: '2026-11-11', start_time: '14:00:00', end_time: '15:00:00', status: 'RESCHEDULED', topic: '[RESCHEDULED] English' },
      ],
      attendance: [],
      system_config: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });
    const tt = require(path.resolve(SERVER_SRC, 'services/timetableService.js'));
    const lc = require(path.resolve(SERVER_SRC, 'controllers/lectureController.js'));
    const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));
    const teacherReqUser = { id: 'u-tch', role: 'teacher', status: 'ACTIVE' };
    const studentReqUser = { id: 'u-stu', role: 'student', status: 'ACTIVE' };

    // A) Execute REAL controller lifecycle on Math: SCHEDULED 09:00 -> RESCHEDULED 14:00 -> ONGOING
    const rResched = await callHandler(lc.updateLectureStatus, {
      user: teacherReqUser,
      params: { id: 'lec-math-orig' },
      body: { status: 'RESCHEDULED', new_time: '14:00' },
    });
    assert.strictEqual(rResched.statusCode, 200);
    assert.strictEqual(rResched.body.data.lecture.topic, '[RESCHEDULED] Mathematics');

    const rStart = await callHandler(lc.updateLectureStatus, {
      user: teacherReqUser,
      params: { id: 'lec-math-orig' },
      body: { status: 'ONGOING' },
    });
    assert.strictEqual(rStart.statusCode, 200);
    assert.strictEqual(rStart.body.data.lecture.status, 'ONGOING');
    // Provenance MUST be preserved when transitioning RESCHEDULED -> ONGOING!
    assert.strictEqual(rStart.body.data.lecture.topic, '[RESCHEDULED] Mathematics');

    // B) Check Student UI BEFORE syncTodayLectures runs:
    const rStudentOngoing = await callHandler(lc.getStudentTodayClasses, { user: studentReqUser, query: {} });
    // 1. Math shows ONCE at 14:00 ONGOING (09:00 not duplicated!)
    const mathStuCards = rStudentOngoing.body.data.classes.filter((c) => c.subject_code === 'MTH');
    assert.strictEqual(mathStuCards.length, 1);
    assert.strictEqual(mathStuCards[0].lecture_id, 'lec-math-orig');
    assert.strictEqual(mathStuCards[0].status, 'ONGOING');
    assert.strictEqual(mathStuCards[0].start_time, '14:00:00');

    // 2. Chemistry (manual ONGOING at 08:00) + Biology (manual COMPLETED at 08:30) MUST NOT hijack 13:00 / 13:30 slots!
    const chemCards = rStudentOngoing.body.data.classes.filter((c) => c.subject_code === 'CHM');
    assert.strictEqual(chemCards.length, 2, 'Manual extra ONGOING lecture must remain separate from unmatched 13:00 slot');
    assert(chemCards.some((c) => c.lecture_id === 'lec-chem-manual-ongoing' && c.start_time === '08:00:00' && c.status === 'ONGOING'));
    assert(chemCards.some((c) => c.timetable_id === 'slot-chem-13' && c.lecture_id === null && c.start_time === '13:00:00'));

    const bioCards = rStudentOngoing.body.data.classes.filter((c) => c.subject_code === 'BIO');
    assert.strictEqual(bioCards.length, 2, 'Manual extra COMPLETED lecture must remain separate from unmatched 13:30 slot');
    assert(bioCards.some((c) => c.lecture_id === 'lec-bio-manual-completed' && c.start_time === '08:30:00' && c.status === 'COMPLETED'));
    assert(bioCards.some((c) => c.timetable_id === 'slot-bio-1330' && c.lecture_id === null && c.start_time === '13:30:00'));

    // 3. Ambiguous Physics 10:00 & 11:00 must NOT bind lec-phys-1500
    const physSlotCards = rStudentOngoing.body.data.classes.filter((c) => c.subject_code === 'PHY' && c.timetable_id);
    assert.strictEqual(physSlotCards.length, 2);
    assert.strictEqual(physSlotCards[0].lecture_id, null);
    assert.strictEqual(physSlotCards[1].lecture_id, null);

    // 4. Cross-date English moved to tomorrow must NOT bind to today's 09:30 card
    const engCards = rStudentOngoing.body.data.classes.filter((c) => c.subject_code === 'ENG');
    assert.strictEqual(engCards.length, 1);
    assert.strictEqual(engCards[0].timetable_id, 'slot-eng-0930');
    assert.strictEqual(engCards[0].lecture_id, null);

    // C) Attendance slot resolution while Math is ONGOING:
    // 1. Math slot-math-09 -> resolves to lec-math-orig (14:00 ONGOING)!
    const rMarkMath = await callHandler(ac.markAttendance, {
      user: studentReqUser, body: { lecture_id: 'slot-math-09', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rMarkMath.statusCode, 201);
    assert.strictEqual(rMarkMath.body.data.attendance.lecture_id, 'lec-math-orig');

    // 2. Chemistry slot-chem-13 -> MUST NOT hijack lec-chem-manual-ongoing; creates genuine 13:00 Chemistry lecture!
    const rMarkChem = await callHandler(ac.markAttendance, {
      user: studentReqUser, body: { lecture_id: 'slot-chem-13', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rMarkChem.statusCode, 201);
    assert.notStrictEqual(rMarkChem.body.data.attendance.lecture_id, 'lec-chem-manual-ongoing');
    const createdChemLec = tables.lectures.find((l) => l.id === rMarkChem.body.data.attendance.lecture_id);
    assert.strictEqual(createdChemLec.start_time, '13:00:00');

    // 3. Biology slot-bio-1330 -> MUST NOT hijack lec-bio-manual-completed; creates genuine 13:30 Biology lecture!
    const rMarkBio = await callHandler(ac.markAttendance, {
      user: studentReqUser, body: { lecture_id: 'slot-bio-1330', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rMarkBio.statusCode, 201);
    assert.notStrictEqual(rMarkBio.body.data.attendance.lecture_id, 'lec-bio-manual-completed');
    const createdBioLec = tables.lectures.find((l) => l.id === rMarkBio.body.data.attendance.lecture_id);
    assert.strictEqual(createdBioLec.start_time, '13:30:00');

    // 4. Ambiguous Physics slot -> 409 Conflict!
    await assert.rejects(
      () => callHandler(ac.markAttendance, {
        user: studentReqUser, body: { lecture_id: 'slot-phys-10', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
      }),
      (e) => e.statusCode === 409
    );

    // D) Transition Math RESCHEDULED+ONGOING -> COMPLETED via updateLectureStatus, then check UI display, syncTodayLectures & attendance!
    const rComplete = await callHandler(lc.updateLectureStatus, {
      user: teacherReqUser,
      params: { id: 'lec-math-orig' },
      body: { status: 'COMPLETED' },
    });
    assert.strictEqual(rComplete.statusCode, 200);
    assert.strictEqual(rComplete.body.data.lecture.status, 'COMPLETED');
    assert.strictEqual(rComplete.body.data.lecture.topic, '[RESCHEDULED] Mathematics');

    // Remove the created chem/bio rows temporarily to verify syncTodayLectures itself does NOT suppress chem 13:00, bio 13:30, or today's eng 09:30,
    // while Math (now COMPLETED with [RESCHEDULED]) IS NOT recreated at 09:00 and Physics warns cleanly!
    tables.lectures = tables.lectures.filter((l) => l.id !== createdChemLec.id && l.id !== createdBioLec.id);
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (msg, ...rest) => warnings.push(`${msg} ${JSON.stringify(rest)}`);
    let syncRes;
    try {
      syncRes = await tt.syncTodayLectures('2026-11-10');
    } finally {
      console.warn = origWarn;
    }
    // Sync must insert: Chem 13:00, Bio 13:30, Physics 10:00 & 11:00 (after ambiguous warning), Eng 09:30 (cross-date not suppressed!) = 5 rows; Math 09:00 = 0!
    assert.strictEqual(syncRes.inserted, 5);
    assert.strictEqual(tables.lectures.filter((l) => l.subject_id === 'sub-math').length, 1);
    assert(tables.lectures.some((l) => l.subject_id === 'sub-chem' && l.start_time === '13:00:00'));
    assert(tables.lectures.some((l) => l.subject_id === 'sub-bio' && l.start_time === '13:30:00'));
    assert(tables.lectures.some((l) => l.subject_id === 'sub-eng' && l.lecture_date === '2026-11-10' && l.start_time === '09:30:00'));
    assert(warnings.some((w) => /Ambiguous rescheduled slot mapping/.test(w)));

    // Teacher UI getTodaySchedule strips [RESCHEDULED] in formatted display `topic` while keeping `status: 'COMPLETED'`
    const rTeacherToday = await callHandler(lc.getTodaySchedule, { user: teacherReqUser, query: { date: '2026-11-10' } });
    const mathTeacherCard = rTeacherToday.body.data.my_lectures.find((l) => l.id === 'lec-math-orig');
    assert.strictEqual(mathTeacherCard.status, 'COMPLETED');
    assert.strictEqual(mathTeacherCard.topic, 'Mathematics');

    // Reset Math attendance & verify COMPLETED Math still resolves via slot-math-09 (and UI shows COMPLETED once)!
    tables.attendance = [];
    const rStudentCompleted = await callHandler(lc.getStudentTodayClasses, { user: studentReqUser, query: {} });
    const mathAfter = rStudentCompleted.body.data.classes.filter((c) => c.subject_code === 'MTH');
    assert.strictEqual(mathAfter.length, 1);
    assert.strictEqual(mathAfter[0].status, 'COMPLETED');
    assert.strictEqual(mathAfter[0].lecture_id, 'lec-math-orig');

    const rMarkCompleted = await callHandler(ac.markAttendance, {
      user: studentReqUser, body: { lecture_id: 'slot-math-09', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rMarkCompleted.statusCode, 201);
    assert.strictEqual(rMarkCompleted.body.data.attendance.lecture_id, 'lec-math-orig');

    // E) Transition RESCHEDULED+COMPLETED Math -> CANCELLED clears reschedule provenance in DB
    const rCancelResched = await callHandler(lc.updateLectureStatus, {
      user: teacherReqUser,
      params: { id: 'lec-math-orig' },
      body: { status: 'CANCELLED', reason: 'Canceled after reschedule' },
    });
    assert.strictEqual(rCancelResched.statusCode, 200);
    assert.strictEqual(rCancelResched.body.data.lecture.status, 'CANCELLED');
    assert.strictEqual(rCancelResched.body.data.lecture.topic, '[CANCELLED] Mathematics');
    assert(!rCancelResched.body.data.lecture.topic.includes('[RESCHEDULED]'));
    const mathInDbAfterCancel = tables.lectures.find((l) => l.id === 'lec-math-orig');
    assert.strictEqual(mathInDbAfterCancel.status, 'CANCELLED');
    assert.strictEqual(mathInDbAfterCancel.topic, '[CANCELLED] Mathematics');

    clearAllTargets();
  });

  // =========================================================================
  // 7. Time Boundaries: No 24:xx window expiration + case-insensitive day_of_week
  // =========================================================================
  await test('Time Boundaries: No 24:xx window expiration in lectureController or markAttendance + case-insensitive day_of_week', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: () => '2026-11-10',
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 1440,
      getKolkataTimeString: () => '23:59:00',
    });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({}),
      uploadAttendanceSelfie: async () => ({}),
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => '',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });
    setModuleMock('services/attendanceNotificationService.js', { checkAndNotifyLowAttendance: async () => {} });

    const tables = {
      users: [{ id: 'u-stu', full_name: 'Stu', role: 'student', status: 'ACTIVE' }],
      divisions: [{ id: 'div-1', name: 'FY', division_name: 'A' }],
      subjects: [{ id: 'sub-late', name: 'Late Session', code: 'LATE', division_id: 'div-1' }],
      teachers: [],
      students: [{ id: 'stu-1', user_id: 'u-stu', student_id: 'S01', division_id: 'div-1' }],
      division_timetables: [
        { id: 'slot-late', division_id: 'div-1', day_of_week: 'tUeSdAy', subject_id: 'sub-late', start_time: '23:30:00', end_time: '23:50:00', is_lab: false },
      ],
      lectures: [
        { id: 'lec-late', division_id: 'div-1', subject_id: 'sub-late', lecture_date: '2026-11-10', start_time: '23:30:00', end_time: '23:50:00', status: 'SCHEDULED', topic: 'Late Class' },
      ],
      attendance: [],
      system_config: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });
    const lc = require(path.resolve(SERVER_SRC, 'controllers/lectureController.js'));
    const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));

    const rToday = await callHandler(lc.getStudentTodayClasses, { user: { id: 'u-stu', role: 'student', status: 'ACTIVE' }, query: {} });
    assert.strictEqual(rToday.statusCode, 200);
    assert.strictEqual(rToday.body.data.source, 'division_timetables');
    assert.strictEqual(rToday.body.data.classes[0].window_expires_at, '23:59');

    await assert.rejects(
      () => callHandler(ac.markAttendance, {
        user: { id: 'u-stu', role: 'student', status: 'ACTIVE' },
        body: { lecture_id: 'lec-late', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
      }),
      (e) => e.statusCode === 400 && e.message.includes('until 23:59') && !/24:/.test(e.message)
    );
    clearAllTargets();
  });

  // =========================================================================
  // 8. Existing features (stateful mock): IST reminders, low-attendance, reports & admin live summary
  // =========================================================================
  await test('Existing features (stateful mock): IST reminders, low-attendance CANCELLED exclusion, myStats/reports & admin live summary', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: (d = new Date()) => {
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);
      },
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 590,
      getKolkataTimeString: () => '09:50:00',
    });

    const sentUsersCalls = [];
    const createdNotifs = [];
    setModuleMock('services/notificationService.js', {
      createNotification: async (p) => { createdNotifs.push(p); },
      sendToUsers: async (uids, p) => { sentUsersCalls.push({ uids, p }); },
    });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({}),
      uploadAttendanceSelfie: async () => ({}),
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => '',
    });

    const tables = {
      system_config: [
        { config_key: 'lecture_reminder_window_minutes', config_value: '15' },
        { config_key: 'lecture_reminders_enabled', config_value: 'true' },
        { config_key: 'low_attendance_reminders_enabled', config_value: 'true' },
        { config_key: 'low_attendance_threshold', config_value: '75' },
      ],
      users: [
        { id: 'u-s1', full_name: 'Student 1', role: 'student', status: 'ACTIVE' },
        { id: 'u-t1', full_name: 'Prof 1', role: 'teacher', status: 'ACTIVE' },
      ],
      courses: [{ id: 'c1', name: 'BSc CS' }],
      divisions: [{ id: 'div-1', name: 'FY', division_name: 'A' }],
      subjects: [{ id: 'sub-dbms', name: 'DBMS', code: 'DBMS', division_id: 'div-1' }],
      teachers: [{ id: 'tch-1', user_id: 'u-t1', teacher_id: 'T1' }],
      students: [{ id: 'stu-1', user_id: 'u-s1', student_id: 'R1', division_id: 'div-1', course_id: 'c1' }],
      lectures: [
        { id: 'lec-upcoming', division_id: 'div-1', subject_id: 'sub-dbms', teacher_id: 'tch-1', lecture_date: '2026-11-10', start_time: '10:00:00', end_time: '11:00:00', status: 'SCHEDULED', topic: 'DBMS Indexing' },
        { id: 'lec-already-ongoing', division_id: 'div-1', subject_id: 'sub-dbms', teacher_id: 'tch-1', lecture_date: '2026-11-10', start_time: '10:02:00', end_time: '11:02:00', status: 'ONGOING', topic: 'Ongoing' },
        { id: 'lec-past-1', division_id: 'div-1', subject_id: 'sub-dbms', teacher_id: 'tch-1', lecture_date: '2026-11-08', start_time: '09:00:00', end_time: '10:00:00', status: 'COMPLETED', topic: 'ER Model' },
        { id: 'lec-cancelled-today', division_id: 'div-1', subject_id: 'sub-dbms', teacher_id: 'tch-1', lecture_date: '2026-11-10', start_time: '10:03:00', end_time: '11:03:00', status: 'CANCELLED', topic: '[CANCELLED] Cancelled' },
      ],
      attendance: [
        { id: 'a1', lecture_id: 'lec-past-1', student_id: 'stu-1', status: 'PRESENT' },
        { id: 'a2', lecture_id: 'lec-cancelled-today', student_id: 'stu-1', status: 'PRESENT' },
      ],
      lecture_notification_logs: [],
      low_attendance_warnings: [],
    };

    const RealDate = global.Date;
    const fixedNow = new RealDate('2026-11-10T04:20:00.000Z').getTime(); // 09:50 IST
    global.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(fixedNow);
        else super(...args);
      }
      static now() { return fixedNow; }
    };

    try {
      setModuleMock('config/db.js', {
        supabaseAdmin: createSupabaseMock({
          tables,
          uniqueConstraints: {
            lecture_notification_logs: [['event_key']],
            low_attendance_warnings: [['student_id', 'subject_id', 'warning_period_start']],
          },
        }),
      });

      const ls = require(path.resolve(SERVER_SRC, 'services/lectureScheduler.js'));
      const ans = require(path.resolve(SERVER_SRC, 'services/attendanceNotificationService.js'));
      const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));
      const adm = require(path.resolve(SERVER_SRC, 'controllers/adminController.js'));

      await ls.processUpcomingLectureReminders();
      assert.strictEqual(sentUsersCalls.length, 1);
      assert.deepStrictEqual(sentUsersCalls[0].uids, ['u-s1']);
      assert.strictEqual(createdNotifs.some((n) => n.userId === 'u-t1' && n.type === 'LECTURE_STARTING'), true);

      await ls.processUpcomingLectureReminders();
      assert.strictEqual(sentUsersCalls.length, 1);

      await ans.checkAndNotifyLowAttendance('stu-1', 'sub-dbms');
      const lowWarns = createdNotifs.filter((n) => n.type === 'LOW_ATTENDANCE');
      assert.strictEqual(lowWarns.length, 1);
      assert.strictEqual(lowWarns[0].metadata.total, 3);
      assert.strictEqual(lowWarns[0].metadata.attended, 1);
      assert.strictEqual(lowWarns[0].metadata.attendance_percentage, 33);

      await ans.checkAndNotifyLowAttendance('stu-1', 'sub-dbms');
      assert.strictEqual(createdNotifs.filter((n) => n.type === 'LOW_ATTENDANCE').length, 1);

      const rStats = await callHandler(ac.getMyStats, { user: { id: 'u-s1', role: 'student', status: 'ACTIVE' } });
      assert.strictEqual(rStats.body.data.stats.total_lectures, 3);
      assert.strictEqual(rStats.body.data.stats.attended, 1);
      assert.strictEqual(rStats.body.data.stats.percentage, 33);

      const rRep = await callHandler(ac.getReportsOverview, { user: { id: 'u-admin', role: 'admin', status: 'ACTIVE' }, query: { days: '30' } });
      assert.strictEqual(rRep.statusCode, 200);
      assert.strictEqual(rRep.body.data.total_lectures, 3);
      assert.strictEqual(rRep.body.data.low_attendance[0].total, 3);

      const rLive = await callHandler(adm.getLiveAttendanceSummary, { user: { id: 'u-admin', role: 'admin', status: 'ACTIVE' } });
      assert.strictEqual(rLive.statusCode, 200);
      assert.strictEqual(rLive.body.data.today_lectures_count, 2);
      assert.strictEqual(rLive.body.data.present_count, 0);
    } finally {
      global.Date = RealDate;
      clearAllTargets();
    }
  });

  // =========================================================================
  // 9. [FIX 1 & FIX 5] Real Express Route Middleware + Controller Defense-in-Depth
  //    Guards on GET /api/lectures, GET /api/lectures/today, /active & /today-classes
  // =========================================================================
  await test('FIX 1 & FIX 5 (Route Middleware + Controller Defense-in-Depth): Role/active guards and student division isolation', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: (d) => (typeof d === 'string' && d.length === 10 ? d : '2026-11-10'),
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 570, // 09:30 IST
      getKolkataTimeString: () => '09:30:00',
    });

    const tables = {
      users: [
        { id: 'u-admin', full_name: 'Admin', email: 'admin@smdl.edu', role: 'admin', status: 'ACTIVE' },
        { id: 'u-admin-pending', full_name: 'Pending Admin', email: 'padmin@smdl.edu', role: 'admin', status: 'PENDING' },
        { id: 'u-tch-a', full_name: 'Teacher A', email: 'ta@smdl.edu', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-tch-pending', full_name: 'Teacher Pending', email: 'tp@smdl.edu', role: 'teacher', status: 'PENDING' },
        { id: 'u-stu-a', full_name: 'Student A', email: 'sa@smdl.edu', role: 'student', status: 'ACTIVE' },
        { id: 'u-stu-pending', full_name: 'Student Pending', email: 'sp@smdl.edu', role: 'student', status: 'PENDING' },
        { id: 'u-stu-nulldiv', full_name: 'Student NullDiv', email: 'sn@smdl.edu', role: 'student', status: 'ACTIVE' },
      ],
      teachers: [
        { id: 'tch-a', user_id: 'u-tch-a', teacher_id: 'TA' },
        { id: 'tch-pending', user_id: 'u-tch-pending', teacher_id: 'TP' },
      ],
      students: [
        { id: 'stu-a', user_id: 'u-stu-a', student_id: 'RA', division_id: 'div-a' },
        { id: 'stu-p', user_id: 'u-stu-pending', student_id: 'RP', division_id: 'div-a' },
        { id: 'stu-n', user_id: 'u-stu-nulldiv', student_id: 'RN', division_id: null },
      ],
      divisions: [
        { id: 'div-a', name: 'FY Div A', division_name: 'A' },
        { id: 'div-b', name: 'FY Div B', division_name: 'B' },
      ],
      subjects: [
        { id: 'sub-a', name: 'DSA', code: 'DSA', division_id: 'div-a' },
        { id: 'sub-b', name: 'DBMS', code: 'DBMS', division_id: 'div-b' },
      ],
      teacher_subjects: [
        { id: 'ts-1', teacher_id: 'tch-a', subject_id: 'sub-a' },
      ],
      division_timetables: [
        { id: 'tt-a', division_id: 'div-a', subject_id: 'sub-a', teacher_id: 'tch-a', day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00', is_lab: false },
        { id: 'tt-b', division_id: 'div-b', subject_id: 'sub-b', teacher_id: null, day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00', is_lab: false },
      ],
      lectures: [
        {
          id: 'lec-div-a', division_id: 'div-a', subject_id: 'sub-a', teacher_id: 'tch-a',
          lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'DSA A',
        },
        {
          id: 'lec-div-b', division_id: 'div-b', subject_id: 'sub-b', teacher_id: null,
          lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'DBMS B',
        },
      ],
      attendance: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });

    const express = require('express');
    const protect = require(path.resolve(SERVER_SRC, 'middleware/auth.js'));
    const lectureRoutes = require(path.resolve(SERVER_SRC, 'routes/lectureRoutes.js'));
    const lc = require(path.resolve(SERVER_SRC, 'controllers/lectureController.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));
    const { signToken } = require(path.resolve(SERVER_SRC, 'utils/jwt.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/lectures', lectureRoutes);
    app.get('/api/student/today-classes', protect, lc.getStudentTodayClasses);
    app.use(errorHandler);

    const tokAdmin = signToken({ id: 'u-admin', role: 'admin' });
    const tokTeacherA = signToken({ id: 'u-tch-a', role: 'teacher' });
    const tokTeacherPending = signToken({ id: 'u-tch-pending', role: 'teacher' });
    const tokStudentA = signToken({ id: 'u-stu-a', role: 'student' });
    const tokStudentPending = signToken({ id: 'u-stu-pending', role: 'student' });
    const tokStudentNullDiv = signToken({ id: 'u-stu-nulldiv', role: 'student' });

    // --- PART A: Real Express Route Middleware Tests ---
    const rUnauth = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures' });
    assert.strictEqual(rUnauth.statusCode, 401);

    // 1. Student calling GET /api/lectures -> 403
    const rStuAll = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures', token: tokStudentA });
    assert.strictEqual(rStuAll.statusCode, 403);
    assert.strictEqual(rStuAll.body.success, false);

    // 2. Pending users (teacher & student) calling GET /api/lectures -> 403
    const rTchPendAll = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures', token: tokTeacherPending });
    assert.strictEqual(rTchPendAll.statusCode, 403);
    const rStuPendAll = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures', token: tokStudentPending });
    assert.strictEqual(rStuPendAll.statusCode, 403);

    // 3 & 4. Student and Pending teacher calling GET /api/lectures/today?date=2026-11-12 -> 403 and NO sync insert!
    const lecCountBeforeRoute = tables.lectures.length;
    const rStuToday = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/today?date=2026-11-12', token: tokStudentA });
    assert.strictEqual(rStuToday.statusCode, 403);
    const rTchPendToday = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/today?date=2026-11-12', token: tokTeacherPending });
    assert.strictEqual(rTchPendToday.statusCode, 403);
    const rStuPendToday = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/today?date=2026-11-12', token: tokStudentPending });
    assert.strictEqual(rStuPendToday.statusCode, 403);
    assert.strictEqual(tables.lectures.filter((l) => l.lecture_date === '2026-11-12').length, 0);
    assert.strictEqual(tables.lectures.length, lecCountBeforeRoute);

    // 5. Active teacher & admin access to GET /api/lectures and GET /api/lectures/today -> 200
    const rTchAll = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures', token: tokTeacherA });
    assert.strictEqual(rTchAll.statusCode, 200);
    assert.deepStrictEqual(rTchAll.body.data.lectures.map((l) => l.id), ['lec-div-a']);

    const rTchToday = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/today', token: tokTeacherA });
    assert.strictEqual(rTchToday.statusCode, 200);
    assert.deepStrictEqual(rTchToday.body.data.all_lectures.map((l) => l.id), ['lec-div-a']);

    const rAdmAll = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures', token: tokAdmin });
    assert.strictEqual(rAdmAll.statusCode, 200);
    assert.strictEqual(rAdmAll.body.data.lectures.length, 2);

    const rAdmToday = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/today', token: tokAdmin });
    assert.strictEqual(rAdmToday.statusCode, 200);
    assert.strictEqual(rAdmToday.body.data.all_lectures.length, 2);

    // 6. Student endpoints via real routes (/active, /today-classes, /api/student/today-classes)
    const rStuActive = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/active?division_id=div-b', token: tokStudentA });
    assert.strictEqual(rStuActive.statusCode, 200);
    assert.deepStrictEqual(rStuActive.body.data.lectures.map((l) => l.division_id), ['div-a']);

    const rStuClasses = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/today-classes?division_id=div-b', token: tokStudentA });
    assert.strictEqual(rStuClasses.statusCode, 200);
    assert.strictEqual(rStuClasses.body.data.classes.length, 1);
    assert.strictEqual(rStuClasses.body.data.classes[0].subject_code, 'DSA');

    // Null-division student CANNOT spoof ?division_id= or fall back to divisions.limit(1)
    const rNullActive = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/active?division_id=div-a', token: tokStudentNullDiv });
    assert.strictEqual(rNullActive.statusCode, 200);
    assert.deepStrictEqual(rNullActive.body.data.lectures, []);

    const rNullClasses1 = await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/today-classes?division_id=div-a', token: tokStudentNullDiv });
    assert.strictEqual(rNullClasses1.statusCode, 200);
    assert.deepStrictEqual(rNullClasses1.body.data.classes, []);
    assert.strictEqual(rNullClasses1.body.data.classes_count, 0);
    assert.strictEqual(rNullClasses1.body.data.source, 'unassigned_division');

    const rNullClasses2 = await dispatchExpressRoute(app, { method: 'GET', url: '/api/student/today-classes?division_id=div-b', token: tokStudentNullDiv });
    assert.strictEqual(rNullClasses2.statusCode, 200);
    assert.deepStrictEqual(rNullClasses2.body.data.classes, []);
    assert.strictEqual(rNullClasses2.body.data.source, 'unassigned_division');

    // --- PART B: Direct Controller Defense-in-Depth Calls (no route middleware) ---
    await assert.rejects(
      () => callHandler(lc.getAllLectures, { user: { id: 'u-stu-a', role: 'student', status: 'ACTIVE' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.getAllLectures, { user: { id: 'u-tch-pending', role: 'teacher', status: 'PENDING' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.getAllLectures, { user: { id: 'u-admin-pending', role: 'admin', status: 'PENDING' } }),
      (e) => e.statusCode === 403
    );

    const beforeCtrlSync = tables.lectures.length;
    await assert.rejects(
      () => callHandler(lc.getTodaySchedule, { user: { id: 'u-stu-a', role: 'student', status: 'ACTIVE' }, query: { date: '2026-11-13' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.getTodaySchedule, { user: { id: 'u-tch-pending', role: 'teacher', status: 'PENDING' }, query: { date: '2026-11-13' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.getTodaySchedule, { user: { id: 'u-admin-pending', role: 'admin', status: 'PENDING' }, query: { date: '2026-11-13' } }),
      (e) => e.statusCode === 403
    );
    assert.strictEqual(tables.lectures.filter((l) => l.lecture_date === '2026-11-13').length, 0);
    assert.strictEqual(tables.lectures.length, beforeCtrlSync);

    clearAllTargets();
  });

  // =========================================================================
  // 10. [FIX 2] Cross-Division Student Attendance Enforcement (Route + Controller)
  // =========================================================================
  await test('FIX 2 (Route + Controller): markAttendance blocks cross-division direct & slot IDs (zero inserts) and safely handles null student division', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: () => '2026-11-10',
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 570, // 09:30 IST
      getKolkataTimeString: () => '09:30:00',
    });

    let uploadCallCount = 0;
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({ buffer: Buffer.from('img'), mimeType: 'image/jpeg', extension: 'jpg' }),
      uploadAttendanceSelfie: async (arg) => {
        uploadCallCount += 1;
        return {
          storagePath: `${arg.studentId}/${arg.attendanceId}.jpg`,
          uploadedAt: '2026-11-10T09:30:00.000Z',
          expiresAt: '2026-12-10T09:30:00.000Z',
        };
      },
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => 'signed',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });
    setModuleMock('services/attendanceNotificationService.js', { checkAndNotifyLowAttendance: async () => {} });

    const tables = {
      users: [
        { id: 'u-s1', full_name: 'Stu Div1', role: 'student', status: 'ACTIVE' },
        { id: 'u-s-null', full_name: 'Stu Null', role: 'student', status: 'ACTIVE' },
        { id: 'u-s-cm', full_name: 'Stu CourseMismatch', role: 'student', status: 'ACTIVE' },
        { id: 'u-s-mc', full_name: 'Stu MissingCourse', role: 'student', status: 'ACTIVE' },
      ],
      courses: [
        { id: 'c-bsc', name: 'BSc CS', code: 'BSC' },
        { id: 'c-bcom', name: 'BCom', code: 'BCOM' },
      ],
      students: [
        { id: 'stu-1', user_id: 'u-s1', student_id: 'R1', division_id: 'div-1', course_id: 'c-bsc' },
        { id: 'stu-null', user_id: 'u-s-null', student_id: 'RN', division_id: null, course_id: 'c-bsc' },
        { id: 'stu-cm', user_id: 'u-s-cm', student_id: 'RCM', division_id: 'div-1', course_id: 'c-bcom' },
        { id: 'stu-mc', user_id: 'u-s-mc', student_id: 'RMC', division_id: 'div-1', course_id: null },
      ],
      divisions: [
        { id: 'div-1', name: 'FY BSc A', division_name: 'A', course_id: 'c-bsc' },
        { id: 'div-2', name: 'FY BSc B', division_name: 'B', course_id: 'c-bsc' },
        { id: 'div-bcom', name: 'FY BCom A', division_name: 'A', course_id: 'c-bcom' },
      ],
      subjects: [
        { id: 'sub-1', name: 'Math', code: 'MTH', division_id: 'div-1' },
        { id: 'sub-2', name: 'OS', code: 'OS', division_id: 'div-2' },
        { id: 'sub-bcom', name: 'Accounts', code: 'ACC', division_id: 'div-bcom' },
      ],
      division_timetables: [
        { id: 'slot-div1', division_id: 'div-1', subject_id: 'sub-1', day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00' },
        { id: 'slot-div2-uncreated', division_id: 'div-2', subject_id: 'sub-2', day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00' },
      ],
      lectures: [
        { id: 'lec-div1', division_id: 'div-1', subject_id: 'sub-1', lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'Math' },
        { id: 'lec-div2', division_id: 'div-2', subject_id: 'sub-2', lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'OS' },
        { id: 'lec-bcom', division_id: 'div-bcom', subject_id: 'sub-bcom', lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'Accounts' },
        { id: 'lec-div2-cancelled', division_id: 'div-2', subject_id: 'sub-2', lecture_date: '2026-11-10', start_time: '09:15:00', end_time: '10:15:00', status: 'CANCELLED', topic: '[CANCELLED] OS' },
      ],
      attendance: [],
      attendance_audit_logs: [],
      system_config: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });

    const express = require('express');
    const attendanceRoutes = require(path.resolve(SERVER_SRC, 'routes/attendanceRoutes.js'));
    const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));
    const { signToken } = require(path.resolve(SERVER_SRC, 'utils/jwt.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/attendance', attendanceRoutes);
    app.use(errorHandler);

    const tokStu1 = signToken({ id: 'u-s1', role: 'student' });
    const tokStuNull = signToken({ id: 'u-s-null', role: 'student' });
    const tokStuCM = signToken({ id: 'u-s-cm', role: 'student' });
    const tokStuMC = signToken({ id: 'u-s-mc', role: 'student' });

    const initialLecCount = tables.lectures.length;

    // 1. Assigned student cross-division direct lecture via real route (ignoring smuggled division_id/course_id) -> 403
    const rCrossDirect = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/attendance/mark',
      token: tokStu1,
      body: { lecture_id: 'lec-div2', division_id: 'div-2', course_id: 'c-bsc', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rCrossDirect.statusCode, 403);

    // 2. Assigned student cross-division timetable slot ID via controller -> 403 BEFORE creating fallback lecture row!
    await assert.rejects(
      () => callHandler(ac.markAttendance, {
        user: { id: 'u-s1', role: 'student', status: 'ACTIVE' },
        body: { lecture_id: 'slot-div2-uncreated', division_id: 'div-2', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
      }),
      (e) => e.statusCode === 403
    );

    // 3. CRITICAL: Null-division student self-enrollment MUST BE COMPLETELY BLOCKED across Div A, Div B, external slot & other course!
    for (const targetLecId of ['lec-div1', 'lec-div2', 'slot-div2-uncreated', 'lec-bcom', 'lec-div2-cancelled']) {
      const rNullRoute = await dispatchExpressRoute(app, {
        method: 'POST',
        url: '/api/attendance/mark',
        token: tokStuNull,
        body: { lecture_id: targetLecId, division_id: 'div-1', course_id: 'c-bsc', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
      });
      assert.strictEqual(rNullRoute.statusCode, 403, `Null-division student must get 403 for ${targetLecId}`);
      assert(/not assigned to a division/i.test(rNullRoute.body.message));

      await assert.rejects(
        () => callHandler(ac.markAttendance, {
          user: { id: 'u-s-null', role: 'student', status: 'ACTIVE' },
          body: { lecture_id: targetLecId, latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
        }),
        (e) => e.statusCode === 403
      );
    }

    // Verify ZERO state mutation after all null-division attempts
    assert.strictEqual(tables.lectures.length, initialLecCount, 'No lecture may be created');
    assert.strictEqual(tables.attendance.length, 0, 'No attendance row may be inserted');
    assert.strictEqual(tables.attendance_audit_logs.length, 0, 'No audit row may be inserted');
    assert.strictEqual(uploadCallCount, 0, 'No selfie upload may occur');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-null').division_id, null);
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-null').course_id, 'c-bsc');

    // 4. Assigned student with stale non-null mismatched course_id (stu-cm) -> fail closed 403, zero inserts
    const rCM = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/attendance/mark',
      token: tokStuCM,
      body: { lecture_id: 'lec-div1', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rCM.statusCode, 403);
    assert.strictEqual(tables.attendance.length, 0);
    assert.strictEqual(uploadCallCount, 0);

    // 5. Direct controller call without ACTIVE status must fail closed 403 (no undefined status bypass!)
    await assert.rejects(
      () => callHandler(ac.markAttendance, {
        user: { id: 'u-s1', role: 'student' },
        body: { lecture_id: 'lec-div1', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
      }),
      (e) => e.statusCode === 403
    );

    // 6. Valid assigned same-division + same-course attendance succeeds -> 201
    const rSameDiv = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/attendance/mark',
      token: tokStu1,
      body: { lecture_id: 'lec-div1', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rSameDiv.statusCode, 201);
    assert.strictEqual(tables.attendance.length, 1);
    assert.strictEqual(tables.attendance[0].student_id, 'stu-1');

    // 7. Duplicate attendance still rejected -> 400 and no duplicate insert
    const rDup = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/attendance/mark',
      token: tokStu1,
      body: { lecture_id: 'lec-div1', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rDup.statusCode, 400);
    assert.strictEqual(tables.attendance.length, 1);

    // 8. Legacy student with valid assigned division_id and NULL students.course_id (stu-mc):
    // blocked 403 on other divisions/courses, allowed 201 on own assigned division without mutating profile!
    for (const deniedLec of ['lec-div2', 'lec-bcom']) {
      const rMcDenied = await dispatchExpressRoute(app, {
        method: 'POST',
        url: '/api/attendance/mark',
        token: tokStuMC,
        body: { lecture_id: deniedLec, latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
      });
      assert.strictEqual(rMcDenied.statusCode, 403);
    }
    const rMC = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/attendance/mark',
      token: tokStuMC,
      body: { lecture_id: 'lec-div1', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rMC.statusCode, 201);
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-mc').division_id, 'div-1');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-mc').course_id, null);

    clearAllTargets();
  });

  // =========================================================================
  // 11. [FIX 3 & FIX 4] Unified Teacher Authorization + Nullable Subject Division
  // =========================================================================
  await test('FIX 3 & FIX 4: division_timetables-only teacher works consistently AND nullable subject.division_id prevents cross-division view_only', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: () => '2026-11-10',
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 570,
      getKolkataTimeString: () => '09:30:00',
    });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({}),
      uploadAttendanceSelfie: async () => ({}),
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => 'https://signed.example/tt.jpg',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });
    setModuleMock('services/attendanceNotificationService.js', { checkAndNotifyLowAttendance: async () => {} });

    const tables = {
      users: [
        { id: 'u-adm', full_name: 'Admin', role: 'admin', status: 'ACTIVE' },
        { id: 'u-tch-tt', full_name: 'TT Only', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-tch-ts', full_name: 'TS Co', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-tch-elec-a1', full_name: 'Elec A1', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-tch-elec-b', full_name: 'Elec B', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-stu', full_name: 'Stu A', role: 'student', status: 'ACTIVE' },
      ],
      teachers: [
        { id: 'tch-tt', user_id: 'u-tch-tt', teacher_id: 'TTT' },
        { id: 'tch-ts', user_id: 'u-tch-ts', teacher_id: 'TTS' },
        { id: 'tch-elec-a1', user_id: 'u-tch-elec-a1', teacher_id: 'TEA1' },
        { id: 'tch-elec-b', user_id: 'u-tch-elec-b', teacher_id: 'TEB' },
      ],
      divisions: [
        { id: 'div-a', name: 'SY A', division_name: 'A' },
        { id: 'div-b', name: 'SY B', division_name: 'B' },
      ],
      subjects: [
        { id: 'sub-a', name: 'AI', code: 'AI', division_id: 'div-a' },
        { id: 'sub-b', name: 'ML', code: 'ML', division_id: 'div-b' },
        { id: 'sub-elec', name: 'Open Elective', code: 'OE', division_id: null },
      ],
      teacher_subjects: [
        // Note: tch-tt has ZERO rows in teacher_subjects!
        { id: 'ts-co-a', teacher_id: 'tch-ts', subject_id: 'sub-a' },
        // Shared nullable elective: both elec-a1 (Div A) and elec-b (Div B) have teacher_subjects row
        { id: 'ts-ea1', teacher_id: 'tch-elec-a1', subject_id: 'sub-elec' },
        { id: 'ts-eb', teacher_id: 'tch-elec-b', subject_id: 'sub-elec' },
      ],
      division_timetables: [
        { id: 'dt-tt-a', division_id: 'div-a', subject_id: 'sub-a', teacher_id: 'tch-tt', day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00' },
        { id: 'dt-ea1', division_id: 'div-a', subject_id: 'sub-elec', teacher_id: 'tch-elec-a1', day_of_week: 'Tuesday', start_time: '11:00:00', end_time: '12:00:00' },
        // Same-division elective co-teacher for Div A via timetable
        { id: 'dt-tt-elec-a', division_id: 'div-a', subject_id: 'sub-elec', teacher_id: 'tch-tt', day_of_week: 'Tuesday', start_time: '12:00:00', end_time: '13:00:00' },
        // Different-division elective teacher for Div B ONLY
        { id: 'dt-eb', division_id: 'div-b', subject_id: 'sub-elec', teacher_id: 'tch-elec-b', day_of_week: 'Tuesday', start_time: '11:00:00', end_time: '12:00:00' },
      ],
      students: [{ id: 'stu-a', user_id: 'u-stu', student_id: 'S1', division_id: 'div-a' }],
      lectures: [
        { id: 'lec-unassigned-a', division_id: 'div-a', subject_id: 'sub-a', teacher_id: null, lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'AI Unassigned' },
        { id: 'lec-owned-ts-a', division_id: 'div-a', subject_id: 'sub-a', teacher_id: 'tch-ts', lecture_date: '2026-11-10', start_time: '10:00:00', end_time: '11:00:00', status: 'SCHEDULED', topic: 'AI Owned By TS' },
        { id: 'lec-elec-diva-ea1', division_id: 'div-a', subject_id: 'sub-elec', teacher_id: 'tch-elec-a1', lecture_date: '2026-11-10', start_time: '11:00:00', end_time: '12:00:00', status: 'SCHEDULED', topic: 'OE Div A' },
        { id: 'lec-elec-divb-eb', division_id: 'div-b', subject_id: 'sub-elec', teacher_id: 'tch-elec-b', lecture_date: '2026-11-10', start_time: '11:00:00', end_time: '12:00:00', status: 'SCHEDULED', topic: 'OE Div B' },
      ],
      attendance: [
        { id: 'att-a1', lecture_id: 'lec-unassigned-a', student_id: 'stu-a', status: 'PRESENT', selfie_storage_path: 'stu-a/att-a1.jpg' },
      ],
      attendance_audit_logs: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });
    const lc = require(path.resolve(SERVER_SRC, 'controllers/lectureController.js'));
    const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));

    const reqTT = { id: 'u-tch-tt', role: 'teacher', status: 'ACTIVE' };
    const reqElecA1 = { id: 'u-tch-elec-a1', role: 'teacher', status: 'ACTIVE' };
    const reqElecB = { id: 'u-tch-elec-b', role: 'teacher', status: 'ACTIVE' };

    // A) division_timetables-only teacher (tch-tt) CAN create, manage unassigned, access roster/override/selfie, and view own/co-taught Div A
    const rCreateTT = await callHandler(lc.createLecture, {
      user: reqTT,
      body: { division_id: 'div-a', subject_id: 'sub-a', lecture_date: '2026-11-10', start_time: '14:00', end_time: '15:00' },
    });
    assert.strictEqual(rCreateTT.statusCode, 201);
    assert(tables.lectures.some((l) => l.id === rCreateTT.body.data.lecture.id && l.division_id === 'div-a'));

    const rStatTT = await callHandler(lc.updateLectureStatus, {
      user: reqTT,
      params: { id: 'lec-unassigned-a' },
      body: { status: 'ONGOING' },
    });
    assert.strictEqual(rStatTT.statusCode, 200);
    assert.strictEqual(tables.lectures.find((l) => l.id === 'lec-unassigned-a').status, 'ONGOING');

    const rRosterTT = await callHandler(ac.getLectureAttendance, { user: reqTT, params: { lectureId: 'lec-unassigned-a' } });
    assert.strictEqual(rRosterTT.statusCode, 200);
    const rSelfieTT = await callHandler(ac.getAttendanceSelfie, { user: reqTT, params: { attendanceId: 'att-a1' } });
    assert.strictEqual(rSelfieTT.statusCode, 200);
    const rOverrideTT = await callHandler(ac.overrideAttendance, {
      user: reqTT,
      body: { lecture_id: 'lec-unassigned-a', student_pk: 'stu-a', status: 'PRESENT', reason: 'TT teacher verified' },
    });
    assert.strictEqual(rOverrideTT.statusCode, 200);

    // B) division_timetables-only teacher STILL cannot create in wrong division/subject or manage other teacher's owned lecture
    await assert.rejects(
      () => callHandler(lc.createLecture, { user: reqTT, body: { division_id: 'div-b', subject_id: 'sub-b', start_time: '14:00', end_time: '15:00' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.createLecture, { user: reqTT, body: { division_id: 'div-b', subject_id: 'sub-a', start_time: '14:00', end_time: '15:00' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.updateLectureStatus, { user: reqTT, params: { id: 'lec-owned-ts-a' }, body: { status: 'ONGOING' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(ac.getLectureAttendance, { user: reqTT, params: { lectureId: 'lec-owned-ts-a' } }),
      (e) => e.statusCode === 403
    );

    // C) FIX 4: Nullable subject.division_id=null -> SAME-division co-teacher gets view_only, DIFF-division teacher gets ZERO visibility!
    const rTTAll = await callHandler(lc.getAllLectures, { user: reqTT });
    const ttAllIds = rTTAll.body.data.lectures.map((l) => l.id);
    assert(ttAllIds.includes('lec-unassigned-a'));
    assert(ttAllIds.includes('lec-owned-ts-a'), 'Same-division co-teacher via division_timetables sees owned lecture as view_only');
    assert.strictEqual(rTTAll.body.data.lectures.find((l) => l.id === 'lec-owned-ts-a').view_only, true);
    assert.strictEqual(rTTAll.body.data.lectures.find((l) => l.id === 'lec-owned-ts-a').can_manage, false);
    assert(ttAllIds.includes('lec-elec-diva-ea1'), 'Same-division nullable elective co-teacher sees Div A elective as view_only');
    assert.strictEqual(rTTAll.body.data.lectures.find((l) => l.id === 'lec-elec-diva-ea1').view_only, true);
    assert(!ttAllIds.includes('lec-elec-divb-eb'), 'Different-division Div B nullable elective MUST NOT be visible');

    // Div A elective teacher sees Div A own, MUST NOT see Div B elective even though both share ts(sub-elec)!
    const rEA1Today = await callHandler(lc.getTodaySchedule, { user: reqElecA1, query: {} });
    assert(!rEA1Today.body.data.all_lectures.some((l) => l.id === 'lec-elec-divb-eb'));
    assert(rEA1Today.body.data.my_lectures.some((l) => l.id === 'lec-elec-diva-ea1'));

    // Div B elective teacher MUST NOT see Div A elective in all_lectures or getAllLectures!
    const rEBAll = await callHandler(lc.getAllLectures, { user: reqElecB });
    assert.deepStrictEqual(rEBAll.body.data.lectures.map((l) => l.id), ['lec-elec-divb-eb']);
    const rEBToday = await callHandler(lc.getTodaySchedule, { user: reqElecB, query: {} });
    assert(!rEBToday.body.data.all_lectures.some((l) => l.id === 'lec-elec-diva-ea1'));

    // D) Missing teacher profile fails closed on mutations & roster; Admin retains full access
    const reqMissingProf = { id: 'u-tch-missing-prof', role: 'teacher', status: 'ACTIVE' };
    const reqAdmin = { id: 'u-adm', role: 'admin', status: 'ACTIVE' };
    await assert.rejects(
      () => callHandler(lc.createLecture, { user: reqMissingProf, body: { division_id: 'div-a', subject_id: 'sub-a', start_time: '16:00', end_time: '17:00' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.updateLectureStatus, { user: reqMissingProf, params: { id: 'lec-unassigned-a' }, body: { status: 'COMPLETED' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(ac.getLectureAttendance, { user: reqMissingProf, params: { lectureId: 'lec-unassigned-a' } }),
      (e) => e.statusCode === 403
    );
    const rAdmAll = await callHandler(lc.getAllLectures, { user: reqAdmin });
    assert(rAdmAll.body.data.lectures.some((l) => l.id === 'lec-elec-divb-eb'));
    const rAdmStatus = await callHandler(lc.updateLectureStatus, { user: reqAdmin, params: { id: 'lec-elec-divb-eb' }, body: { status: 'COMPLETED' } });
    assert.strictEqual(rAdmStatus.statusCode, 200);

    clearAllTargets();
  });

  // =========================================================================
  // 12. SQL/PostgREST Null Semantics in Stateful Mock
  // =========================================================================
  await test('Mock SQL/PostgREST Null Semantics: NULL <> val evaluates UNKNOWN (excluded), matched only via .is(col, null)', async () => {
    const tables = {
      lectures: [
        { id: 'l-sched', status: 'SCHEDULED' },
        { id: 'l-cancel', status: 'CANCELLED' },
        { id: 'l-null', status: null },
      ],
    };
    const db = createSupabaseMock({ tables });
    const { data: neqRows } = await db.from('lectures').select('id, status').neq('status', 'CANCELLED');
    assert.deepStrictEqual(neqRows.map((r) => r.id), ['l-sched']);

    const { data: eqNullRows } = await db.from('lectures').select('id').eq('status', null);
    assert.deepStrictEqual(eqNullRows, []);

    const { data: isNullRows } = await db.from('lectures').select('id').is('status', null);
    assert.deepStrictEqual(isNullRows.map((r) => r.id), ['l-null']);

    const { data: notNullRows } = await db.from('lectures').select('id').not('status', 'is', null);
    assert.deepStrictEqual(notNullRows.map((r) => r.id), ['l-sched', 'l-cancel']);
  });

  // =========================================================================
  // 13. [FIX 2] Account Status Matrix (ACTIVE, PENDING, INACTIVE, REJECTED,
  //     SUSPENDED, DISABLED) + /api/auth/me + No Undefined-Status Bypass
  // =========================================================================
  await test('Account Status Enforcement (Route + Controller): PENDING, INACTIVE, REJECTED, SUSPENDED, DISABLED blocked across operational routes while /auth/me & public registration stay intact', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: () => '2026-11-10',
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 570,
      getKolkataTimeString: () => '09:30:00',
    });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({ buffer: Buffer.from('img'), mimeType: 'image/jpeg', extension: 'jpg' }),
      uploadAttendanceSelfie: async () => ({
        storagePath: 'stu-1/s.jpg',
        uploadedAt: '2026-11-10T09:30:00.000Z',
        expiresAt: '2026-12-10T09:30:00.000Z',
      }),
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => 'https://signed.example/selfie-ok.jpg',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });
    setModuleMock('services/attendanceNotificationService.js', { checkAndNotifyLowAttendance: async () => {} });

    const tables = {
      users: [
        { id: 'u-adm-act', full_name: 'Admin Act', email: 'adm@smdl.edu', role: 'admin', status: 'ACTIVE' },
        { id: 'u-tch-act', full_name: 'Teacher Act', email: 'ta@smdl.edu', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-tch-pend', full_name: 'Teacher Pend', email: 'tp@smdl.edu', role: 'teacher', status: 'PENDING' },
        { id: 'u-stu-act', full_name: 'Student Act', email: 'sa@smdl.edu', role: 'student', status: 'ACTIVE' },
        { id: 'u-stu-pend', full_name: 'Student Pend', email: 'sp@smdl.edu', role: 'student', status: 'PENDING' },
        { id: 'u-stu-inact', full_name: 'Student Inact', email: 'si@smdl.edu', role: 'student', status: 'INACTIVE' },
        { id: 'u-stu-rej', full_name: 'Student Rej', email: 'sr@smdl.edu', role: 'student', status: 'REJECTED' },
        { id: 'u-stu-susp', full_name: 'Student Susp', email: 'ss@smdl.edu', role: 'student', status: 'SUSPENDED' },
        { id: 'u-stu-dis', full_name: 'Student Dis', email: 'sd@smdl.edu', role: 'student', status: 'DISABLED' },
      ],
      courses: [{ id: 'c1', name: 'BSc CS', code: 'BSC' }],
      divisions: [{ id: 'div-a', name: 'FY A', division_name: 'A', course_id: 'c1' }],
      subjects: [{ id: 'sub-a', name: 'DSA', code: 'DSA', division_id: 'div-a' }],
      teachers: [
        { id: 'tch-act', user_id: 'u-tch-act', teacher_id: 'TA' },
        { id: 'tch-pend', user_id: 'u-tch-pend', teacher_id: 'TP' },
      ],
      teacher_subjects: [
        { id: 'ts-pend', teacher_id: 'tch-pend', subject_id: 'sub-a' },
      ],
      students: [
        { id: 'stu-act', user_id: 'u-stu-act', student_id: 'RA', division_id: 'div-a', course_id: 'c1' },
        { id: 'stu-pend', user_id: 'u-stu-pend', student_id: 'RP', division_id: 'div-a', course_id: 'c1' },
      ],
      division_timetables: [
        { id: 'tt-a', division_id: 'div-a', subject_id: 'sub-a', teacher_id: 'tch-pend', day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00' },
      ],
      lectures: [
        { id: 'lec-a', division_id: 'div-a', subject_id: 'sub-a', teacher_id: 'tch-pend', lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'DSA' },
      ],
      attendance: [
        { id: 'att-pend-1', lecture_id: 'lec-a', student_id: 'stu-pend', status: 'PRESENT', selfie_url: 's.jpg', selfie_storage_path: 'stu-pend/s.jpg' },
        { id: 'att-act-1', lecture_id: 'lec-a', student_id: 'stu-act', status: 'PRESENT', selfie_url: 'sa.jpg', selfie_storage_path: 'stu-act/sa.jpg' },
      ],
      announcements: [
        { id: 'ann-1', title: 'Notice', content: 'Hello', target_type: 'ALL', sent_by: 'u-adm-act', created_at: '2026-11-10T01:00:00.000Z' },
      ],
      notifications: [
        { id: 'n-1', user_id: 'u-stu-act', type: 'ANNOUNCEMENT', is_read: false, message: 'Hi', created_at: new Date().toISOString() },
      ],
      notification_preferences: [],
      device_tokens: [],
      system_config: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });

    const express = require('express');
    const protect = require(path.resolve(SERVER_SRC, 'middleware/auth.js'));
    const { restrictToActiveOnly } = require(path.resolve(SERVER_SRC, 'middleware/roles.js'));
    const authRoutes = require(path.resolve(SERVER_SRC, 'routes/authRoutes.js'));
    const lectureRoutes = require(path.resolve(SERVER_SRC, 'routes/lectureRoutes.js'));
    const attendanceRoutes = require(path.resolve(SERVER_SRC, 'routes/attendanceRoutes.js'));
    const academicRoutes = require(path.resolve(SERVER_SRC, 'routes/academicRoutes.js'));
    const announcementRoutes = require(path.resolve(SERVER_SRC, 'routes/announcementRoutes.js'));
    const notificationRoutes = require(path.resolve(SERVER_SRC, 'routes/notificationRoutes.js'));
    const lc = require(path.resolve(SERVER_SRC, 'controllers/lectureController.js'));
    const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));
    const acadCtrl = require(path.resolve(SERVER_SRC, 'controllers/academicController.js'));
    const annCtrl = require(path.resolve(SERVER_SRC, 'controllers/announcementController.js'));
    const notifCtrl = require(path.resolve(SERVER_SRC, 'controllers/notificationController.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));
    const { signToken } = require(path.resolve(SERVER_SRC, 'utils/jwt.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/lectures', lectureRoutes);
    app.use('/api/attendance', attendanceRoutes);
    app.use('/api/academic', academicRoutes);
    app.use('/api/announcements', announcementRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.get('/api/student/today-classes', protect, restrictToActiveOnly, lc.getStudentTodayClasses);
    app.get('/student/today-classes', protect, restrictToActiveOnly, lc.getStudentTodayClasses);
    app.use(errorHandler);

    const tokAdmAct = signToken({ id: 'u-adm-act', role: 'admin' });
    const tokStuAct = signToken({ id: 'u-stu-act', role: 'student' });
    const tokStuPend = signToken({ id: 'u-stu-pend', role: 'student' });
    const tokTchPend = signToken({ id: 'u-tch-pend', role: 'teacher' });
    const inactiveTokens = [
      signToken({ id: 'u-stu-inact', role: 'student' }),
      signToken({ id: 'u-stu-rej', role: 'student' }),
      signToken({ id: 'u-stu-susp', role: 'student' }),
      signToken({ id: 'u-stu-dis', role: 'student' }),
    ];

    // 1. PENDING student blocked 403 across ALL operational attendance, lecture, academic timetable, announcement & notification routes!
    const pendingStudentBlockedGets = [
      '/api/attendance/my-stats',
      '/api/attendance/att-pend-1/selfie',
      '/api/attendance/geofence-config',
      '/api/lectures/active',
      '/api/lectures/today-classes',
      '/api/student/today-classes',
      '/student/today-classes',
      '/api/lectures/timetable',
      '/api/academic/timetable/div-a',
      '/api/announcements',
      '/api/notifications',
    ];
    for (const url of pendingStudentBlockedGets) {
      const r = await dispatchExpressRoute(app, { method: 'GET', url, token: tokStuPend });
      assert.strictEqual(r.statusCode, 403, `PENDING student must receive 403 on GET ${url}`);
    }
    const rPendMark = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/attendance/mark',
      token: tokStuPend,
      body: { lecture_id: 'lec-a', latitude: 19.02479, longitude: 73.10159, selfie: 'data' },
    });
    assert.strictEqual(rPendMark.statusCode, 403);
    assert.strictEqual(tables.attendance.length, 2, 'PENDING student must not create attendance');

    const rPendDev = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/notifications/devices',
      token: tokStuPend,
      body: { fcm_token: 'tok-x' },
    });
    assert.strictEqual(rPendDev.statusCode, 403);

    // 2. PENDING teacher (even owning lec-a & assigned subject) blocked 403 on selfie, active, today, timetable, announcements, notifications!
    for (const url of [
      '/api/attendance/att-act-1/selfie',
      '/api/attendance/geofence-config',
      '/api/lectures/active',
      '/api/lectures/today',
      '/api/lectures/timetable',
      '/api/academic/timetable/div-a',
      '/api/announcements',
      '/api/notifications',
    ]) {
      const r = await dispatchExpressRoute(app, { method: 'GET', url, token: tokTchPend });
      assert.strictEqual(r.statusCode, 403, `PENDING teacher must receive 403 on GET ${url}`);
    }

    // 3. INACTIVE / REJECTED / SUSPENDED / DISABLED rejected 401 by protect on all protected endpoints including /auth/me
    for (const badTok of inactiveTokens) {
      for (const url of ['/api/auth/me', '/api/lectures/active', '/api/attendance/my-stats', '/api/notifications']) {
        const r = await dispatchExpressRoute(app, { method: 'GET', url, token: badTok });
        assert.strictEqual(r.statusCode, 401, `Inactive/rejected user must receive 401 on GET ${url}`);
      }
    }

    // 4. PENDING users CAN still check /api/auth/me for approval screen, AND public registration/firebase config stay 200
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/auth/me', token: tokTchPend })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/auth/me', token: tokStuPend })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/courses' })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/divisions' })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/subjects' })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/notifications/firebase-config' })).statusCode, 200);

    // 5. ACTIVE users succeed cleanly
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/active', token: tokStuAct })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/student/today-classes', token: tokStuAct })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/timetable', token: tokStuAct })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/attendance/my-stats', token: tokStuAct })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/attendance/geofence-config', token: tokStuAct })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/attendance/att-act-1/selfie', token: tokAdmAct })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/announcements', token: tokStuAct })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/notifications', token: tokStuAct })).statusCode, 200);

    // 6. Direct controller calls omitting status (undefined) or with PENDING must NEVER silently bypass!
    for (const badUser of [
      { id: 'u-stu-act', role: 'student' },
      { id: 'u-stu-pend', role: 'student', status: 'PENDING' },
    ]) {
      await assert.rejects(() => callHandler(ac.getMyStats, { user: badUser }), (e) => e.statusCode === 403);
      await assert.rejects(() => callHandler(ac.getAttendanceSelfie, { user: badUser, params: { attendanceId: 'att-pend-1' } }), (e) => e.statusCode === 403);
      await assert.rejects(() => callHandler(lc.getActiveLectures, { user: badUser }), (e) => e.statusCode === 403);
      await assert.rejects(() => callHandler(lc.getStudentTodayClasses, { user: badUser, query: {} }), (e) => e.statusCode === 403);
      await assert.rejects(() => callHandler(acadCtrl.getDivisionTimetable, { user: badUser, params: { division_id: 'div-a' }, query: {} }), (e) => e.statusCode === 403);
      await assert.rejects(() => callHandler(annCtrl.getAnnouncements, { user: badUser }), (e) => e.statusCode === 403);
      await assert.rejects(() => callHandler(notifCtrl.getNotifications, { user: badUser, query: {} }), (e) => e.statusCode === 403);
    }
    await assert.rejects(
      () => callHandler(lc.updateLectureStatus, { user: { id: 'u-tch-pend', role: 'teacher', status: 'PENDING' }, params: { id: 'lec-a' }, body: { status: 'ONGOING' } }),
      (e) => e.statusCode === 403
    );
    await assert.rejects(
      () => callHandler(lc.updateLectureStatus, { user: { id: 'u-tch-act', role: 'teacher' }, params: { id: 'lec-a' }, body: { status: 'ONGOING' } }),
      (e) => e.statusCode === 403
    );

    clearAllTargets();
  });

  // =========================================================================
  // 14. [FIX 3 & FIX 4] Academic Timetable Privacy + getMyStats Null/Error Handling
  // =========================================================================
  await test('FIX 3 & FIX 4: Academic timetable blocks cross-division & null-div students and hides faculty emails; getMyStats avoids UUID null query and surfaces DB errors', async () => {
    clearAllTargets();

    const tables = {
      users: [
        { id: 'u-adm', full_name: 'Admin', email: 'admin@smdl.edu', role: 'admin', status: 'ACTIVE' },
        { id: 'u-tch', full_name: 'Prof Faculty', email: 'faculty-secret@smdl.edu', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-stu-a', full_name: 'Stu A', email: 'sa@smdl.edu', role: 'student', status: 'ACTIVE' },
        { id: 'u-stu-null', full_name: 'Stu Null', email: 'sn@smdl.edu', role: 'student', status: 'ACTIVE' },
      ],
      teachers: [
        { id: 'tch-1', user_id: 'u-tch', teacher_id: 'T1' },
      ],
      students: [
        { id: 'stu-a', user_id: 'u-stu-a', student_id: 'RA', division_id: 'div-a', course_id: 'c1' },
        { id: 'stu-null', user_id: 'u-stu-null', student_id: 'RN', division_id: null, course_id: 'c1' },
      ],
      courses: [{ id: 'c1', name: 'BSc CS', code: 'BSC' }],
      divisions: [
        { id: 'div-a', name: 'FY A', division_name: 'A', course_id: 'c1' },
        { id: 'div-b', name: 'FY B', division_name: 'B', course_id: 'c1' },
      ],
      subjects: [
        { id: 'sub-a', name: 'DSA', code: 'DSA', division_id: 'div-a' },
        { id: 'sub-b', name: 'OS', code: 'OS', division_id: 'div-b' },
      ],
      division_timetables: [
        { id: 'tt-a1', division_id: 'div-a', subject_id: 'sub-a', teacher_id: 'tch-1', day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '10:00:00', room_number: '101', is_lab: false },
        { id: 'tt-b1', division_id: 'div-b', subject_id: 'sub-b', teacher_id: 'tch-1', day_of_week: 'Tuesday', start_time: '10:00:00', end_time: '11:00:00', room_number: '202', is_lab: false },
      ],
      lectures: [],
      attendance: [],
    };

    const queryLog = [];
    let simulateDbErrorOn = null;
    setModuleMock('config/db.js', {
      supabaseAdmin: createSupabaseMock({
        tables,
        onLog(q) {
          queryLog.push({ table: q.table, action: q.action, filters: q.filters });
        },
        onQuery(q) {
          if (simulateDbErrorOn && q.table === simulateDbErrorOn) {
            return { data: null, error: { code: 'XX000', message: 'simulated db failure' } };
          }
          return undefined;
        },
      }),
    });

    const express = require('express');
    const academicRoutes = require(path.resolve(SERVER_SRC, 'routes/academicRoutes.js'));
    const ac = require(path.resolve(SERVER_SRC, 'controllers/attendanceController.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));
    const { signToken } = require(path.resolve(SERVER_SRC, 'utils/jwt.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/academic', academicRoutes);
    app.use(errorHandler);

    const tokStuA = signToken({ id: 'u-stu-a', role: 'student' });
    const tokStuNull = signToken({ id: 'u-stu-null', role: 'student' });
    const tokTch = signToken({ id: 'u-tch', role: 'teacher' });
    const tokAdm = signToken({ id: 'u-adm', role: 'admin' });

    // 1. Active Div-A student requests own division -> 200 and faculty email is stripped!
    const rOwnTT = await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/timetable/div-a', token: tokStuA });
    assert.strictEqual(rOwnTT.statusCode, 200);
    assert.strictEqual(rOwnTT.body.data.slots.length, 1);
    assert.strictEqual(rOwnTT.body.data.slots[0].id, 'tt-a1');
    assert.strictEqual(rOwnTT.body.data.slots[0].teacher.user.full_name, 'Prof Faculty');
    assert.strictEqual(rOwnTT.body.data.slots[0].teacher.user.email, undefined, 'Teacher email MUST NOT be exposed to student');
    if (rOwnTT.body.data.slots[0].teacher.users) {
      assert.strictEqual(rOwnTT.body.data.slots[0].teacher.users.email, undefined);
    }

    // 2. Active Div-A student requests Div-B (even with ?division_id=div-a) -> 403!
    const rOtherTT = await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/timetable/div-b?division_id=div-a', token: tokStuA });
    assert.strictEqual(rOtherTT.statusCode, 403);

    // 3. Null-division student requests any division -> 403!
    const rNullTT = await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/timetable/div-a', token: tokStuNull });
    assert.strictEqual(rNullTT.statusCode, 403);

    // 4. Active teacher & admin keep access to Div-B (including email) -> 200
    const rTchTT = await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/timetable/div-b', token: tokTch });
    assert.strictEqual(rTchTT.statusCode, 200);
    assert.strictEqual(rTchTT.body.data.slots[0].teacher.user.email, 'faculty-secret@smdl.edu');
    const rAdmTT = await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/timetable/div-b', token: tokAdm });
    assert.strictEqual(rAdmTT.statusCode, 200);

    // 5. FIX 4: getMyStats for null-division student returns safe unassigned response WITHOUT querying lectures with division_id=null!
    queryLog.length = 0;
    const rNullStats = await callHandler(ac.getMyStats, { user: { id: 'u-stu-null', role: 'student', status: 'ACTIVE' } });
    assert.strictEqual(rNullStats.statusCode, 200);
    assert.strictEqual(rNullStats.body.data.division_assigned, false);
    assert.strictEqual(rNullStats.body.data.student_info.division, null);
    assert.strictEqual(rNullStats.body.data.stats.total_lectures, 0);
    assert.deepStrictEqual(rNullStats.body.data.history, []);
    assert(!queryLog.some((q) => q.table === 'lectures'), 'Must never query lectures with null division_id');

    // 6. getMyStats surfaces DB errors explicitly as 500 rather than hiding them
    simulateDbErrorOn = 'lectures';
    await assert.rejects(
      () => callHandler(ac.getMyStats, { user: { id: 'u-stu-a', role: 'student', status: 'ACTIVE' } }),
      (e) => e.statusCode === 500
    );
    simulateDbErrorOn = 'students';
    await assert.rejects(
      () => callHandler(ac.getMyStats, { user: { id: 'u-stu-a', role: 'student', status: 'ACTIVE' } }),
      (e) => e.statusCode === 500
    );

    clearAllTargets();
  });

  // =========================================================================
  // 15. [FIX 5] Login Status Enforcement via Real POST /api/auth/login
  // =========================================================================
  await test('FIX 5 (Route Middleware + AuthController): INACTIVE/REJECTED/SUSPENDED/DISABLED login rejected 401 without JWT; PENDING preserves /auth/me; ACTIVE works', async () => {
    clearAllTargets();
    const { hashPassword } = require(path.resolve(SERVER_SRC, 'utils/password.js'));
    const pwHash = await hashPassword('SecretPass123!');

    const tables = {
      users: [
        { id: 'u-act-s', full_name: 'Active Stu', email: 'active.stu@smdl.edu', password_hash: pwHash, role: 'student', status: 'ACTIVE', last_login_at: null },
        { id: 'u-pend-t', full_name: 'Pending Tch', email: 'pend.tch@smdl.edu', password_hash: pwHash, role: 'teacher', status: 'PENDING', last_login_at: null },
        { id: 'u-inact', full_name: 'Inactive User', email: 'inactive@smdl.edu', password_hash: pwHash, role: 'student', status: 'INACTIVE', last_login_at: null },
        { id: 'u-rej', full_name: 'Rejected User', email: 'rejected@smdl.edu', password_hash: pwHash, role: 'student', status: 'REJECTED', last_login_at: null },
        { id: 'u-susp', full_name: 'Suspended User', email: 'suspended@smdl.edu', password_hash: pwHash, role: 'teacher', status: 'SUSPENDED', last_login_at: null },
        { id: 'u-dis', full_name: 'Disabled User', email: 'disabled@smdl.edu', password_hash: pwHash, role: 'teacher', status: 'DISABLED', last_login_at: null },
      ],
      students: [
        { id: 'stu-act', user_id: 'u-act-s', student_id: 'R10', division_id: 'div-a', course_id: 'c1' },
      ],
      teachers: [
        { id: 'tch-p', user_id: 'u-pend-t', teacher_id: 'T10', department: 'CS', designation: 'Lecturer' },
      ],
      teacher_subjects: [],
      courses: [{ id: 'c1', name: 'BSc CS', code: 'BSC' }],
      divisions: [{ id: 'div-a', name: 'FY A', division_name: 'A', course_id: 'c1' }],
      division_timetables: [],
      lectures: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });

    const express = require('express');
    const authRoutes = require(path.resolve(SERVER_SRC, 'routes/authRoutes.js'));
    const lectureRoutes = require(path.resolve(SERVER_SRC, 'routes/lectureRoutes.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/lectures', lectureRoutes);
    app.use(errorHandler);

    // 1. INACTIVE, REJECTED, SUSPENDED, DISABLED -> 401 and NO JWT minted
    for (const email of ['inactive@smdl.edu', 'rejected@smdl.edu', 'suspended@smdl.edu', 'disabled@smdl.edu']) {
      const rBadLogin = await dispatchExpressRoute(app, {
        method: 'POST',
        url: '/api/auth/login',
        body: { email, password: 'SecretPass123!' },
      });
      assert.strictEqual(rBadLogin.statusCode, 401, `${email} must be rejected 401 at login`);
      assert.strictEqual(rBadLogin.body.token, undefined);
      assert.strictEqual(rBadLogin.body.data, undefined);
      assert.strictEqual(tables.users.find((u) => u.email === email).last_login_at, null);
    }

    // 2. PENDING account can log in, reach /api/auth/me, and is still blocked on operational routes
    const rPendLogin = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'pend.tch@smdl.edu', password: 'SecretPass123!' },
    });
    assert.strictEqual(rPendLogin.statusCode, 200);
    assert(rPendLogin.body.data.token, 'PENDING account needs token for approval-status check');
    assert.strictEqual(rPendLogin.body.data.account_status, 'PENDING');
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/auth/me', token: rPendLogin.body.data.token })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/active', token: rPendLogin.body.data.token })).statusCode, 403);

    // 3. ACTIVE login works end-to-end
    const rActLogin = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/login',
      body: { email: 'active.stu@smdl.edu', password: 'SecretPass123!' },
    });
    assert.strictEqual(rActLogin.statusCode, 200);
    assert(rActLogin.body.data.token);
    assert.strictEqual((await dispatchExpressRoute(app, { method: 'GET', url: '/api/lectures/active', token: rActLogin.body.data.token })).statusCode, 200);

    clearAllTargets();
  });

  // =========================================================================
  // 16. [A1-Transfer] transferStudentDivision consistency & failure safety
  // =========================================================================
  await test('A1-Transfer (Route + Controller): derives course from division, blocks spoofed course override, rejects invalid division & DB failure', async () => {
    clearAllTargets();

    const tables = {
      users: [
        { id: 'u-adm', full_name: 'Admin', email: 'admin@smdl.edu', role: 'admin', status: 'ACTIVE' },
        { id: 'u-adm-pend', full_name: 'Pend Adm', email: 'padm@smdl.edu', role: 'admin', status: 'PENDING' },
        { id: 'u-stu-1', full_name: 'Stu One', email: 's1@smdl.edu', role: 'student', status: 'ACTIVE' },
        { id: 'u-stu-2', full_name: 'Stu Two', email: 's2@smdl.edu', role: 'student', status: 'ACTIVE' },
        { id: 'u-tch', full_name: 'Teacher', email: 't@smdl.edu', role: 'teacher', status: 'ACTIVE' },
      ],
      courses: [
        { id: 'c-bsc', name: 'BSc CS', code: 'BSC' },
        { id: 'c-bcom', name: 'BCom', code: 'BCOM' },
      ],
      divisions: [
        { id: 'div-bsc-a', course_id: 'c-bsc', name: 'FY BSc', division_name: 'A' },
        { id: 'div-bsc-b', course_id: 'c-bsc', name: 'FY BSc', division_name: 'B' },
        { id: 'div-bcom-a', course_id: 'c-bcom', name: 'FY BCom', division_name: 'A' },
      ],
      students: [
        { id: 'stu-1', user_id: 'u-stu-1', student_id: 'CS-101', division_id: 'div-bsc-a', course_id: 'c-bsc' },
        { id: 'stu-2', user_id: 'u-stu-2', student_id: 'LEG-202', division_id: 'div-bsc-a', course_id: null },
      ],
    };

    let failStudentUpdate = false;
    setModuleMock('config/db.js', {
      supabaseAdmin: createSupabaseMock({
        tables,
        onQuery(q) {
          if (failStudentUpdate && q.table === 'students' && q.action === 'update') {
            return { data: null, error: { code: 'XX000', message: 'simulated update failure' } };
          }
          return undefined;
        },
      }),
    });

    const express = require('express');
    const adminRoutes = require(path.resolve(SERVER_SRC, 'routes/adminRoutes.js'));
    const adminCtrl = require(path.resolve(SERVER_SRC, 'controllers/adminController.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));
    const { signToken } = require(path.resolve(SERVER_SRC, 'utils/jwt.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use(errorHandler);

    const tokAdm = signToken({ id: 'u-adm', role: 'admin' });
    const tokAdmPend = signToken({ id: 'u-adm-pend', role: 'admin' });
    const tokStu = signToken({ id: 'u-stu-1', role: 'student' });
    const tokTch = signToken({ id: 'u-tch', role: 'teacher' });

    // 1. Existing authorization preserved (non-admin & PENDING admin blocked 403)
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/admin/students/stu-1/transfer', token: tokStu, body: { new_division_id: 'div-bsc-b' },
    })).statusCode, 403);
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/admin/students/stu-1/transfer', token: tokTch, body: { new_division_id: 'div-bsc-b' },
    })).statusCode, 403);
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/admin/students/stu-1/transfer', token: tokAdmPend, body: { new_division_id: 'div-bsc-b' },
    })).statusCode, 403);

    // 2. Same-course transfer updates division and keeps matching course
    const rSameCourse = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/admin/students/stu-1/transfer',
      token: tokAdm,
      body: { new_division_id: 'div-bsc-b', reason: 'Batch rebalance' },
    });
    assert.strictEqual(rSameCourse.statusCode, 200);
    assert.strictEqual(rSameCourse.body.data.reason, 'Batch rebalance');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-1').division_id, 'div-bsc-b');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-1').course_id, 'c-bsc');

    // 3. Cross-course transfer omitting new_course_id (matches React TransferDivisionModal) derives new course from target division
    const rCrossCourse = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/admin/students/stu-1/transfer',
      token: tokAdm,
      body: { new_division_id: 'div-bcom-a', reason: 'Program switch' },
    });
    assert.strictEqual(rCrossCourse.statusCode, 200);
    assert.strictEqual(rCrossCourse.body.data.reason, 'Program switch');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-1').division_id, 'div-bcom-a');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-1').course_id, 'c-bcom');

    // 4. Client-supplied incorrect new_course_id cannot override target division's course
    const rSpoofedCourse = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/admin/students/stu-2/transfer',
      token: tokAdm,
      body: { new_division_id: 'div-bcom-a', new_course_id: 'c-bsc', reason: 'Audit fix' },
    });
    assert.strictEqual(rSpoofedCourse.statusCode, 200);
    assert.strictEqual(rSpoofedCourse.body.data.student.course_id, 'c-bcom');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-2').division_id, 'div-bcom-a');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-2').course_id, 'c-bcom');

    // 5. Invalid/nonexistent target division rejected 404, existing division/course intact
    const rBadDiv = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/admin/students/stu-1/transfer',
      token: tokAdm,
      body: { new_division_id: 'div-nonexistent', reason: 'Bad div' },
    });
    assert.strictEqual(rBadDiv.statusCode, 404);
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-1').division_id, 'div-bcom-a');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-1').course_id, 'c-bcom');

    // 6. Failed DB update throws 500, does NOT falsely report success, and preserves prior division/course
    failStudentUpdate = true;
    const rDbFail = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/admin/students/stu-1/transfer',
      token: tokAdm,
      body: { new_division_id: 'div-bsc-a', reason: 'Retry' },
    });
    assert.strictEqual(rDbFail.statusCode, 500);
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-1').division_id, 'div-bcom-a');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-1').course_id, 'c-bcom');
    await assert.rejects(
      () => callHandler(adminCtrl.transferStudentDivision, {
        params: { student_id: 'stu-1' },
        body: { new_division_id: 'div-bsc-a' },
      }),
      (e) => e.statusCode === 500
    );

    clearAllTargets();
  });

  // =========================================================================
  // 17. [A1-BulkImport] bulkImportStudents validation, derivation & duplicates
  // =========================================================================
  await test('A1-BulkImport (Route + Controller): derives course from division, rejects mismatches & bad divisions, keeps unassigned & duplicate handling', async () => {
    clearAllTargets();

    const tables = {
      users: [
        { id: 'u-adm', full_name: 'Admin', email: 'admin@smdl.edu', role: 'admin', status: 'ACTIVE' },
        { id: 'u-existing', full_name: 'Existing Stu', email: 'exist@student.smdl.ac.in', role: 'student', status: 'ACTIVE' },
      ],
      courses: [
        { id: 'c-bsc', name: 'BSc CS', code: 'BSC' },
        { id: 'c-bcom', name: 'BCom', code: 'BCOM' },
      ],
      divisions: [
        { id: 'div-bsc', course_id: 'c-bsc', name: 'FY BSc', division_name: 'A' },
        { id: 'div-bcom', course_id: 'c-bcom', name: 'FY BCom', division_name: 'A' },
      ],
      students: [
        { id: 'stu-exist', user_id: 'u-existing', student_id: 'EX-100', division_id: 'div-bsc', course_id: null },
      ],
    };

    let failInsertStudentRoll = null;
    setModuleMock('config/db.js', {
      supabaseAdmin: createSupabaseMock({
        tables,
        onQuery(q) {
          if (
            failInsertStudentRoll &&
            q.table === 'students' &&
            q.action === 'insert' &&
            q.insertPayload &&
            q.insertPayload.student_id === failInsertStudentRoll
          ) {
            return { data: null, error: { code: 'XX000', message: 'simulated student insert error' } };
          }
          return undefined;
        },
      }),
    });

    const express = require('express');
    const adminRoutes = require(path.resolve(SERVER_SRC, 'routes/adminRoutes.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));
    const { signToken } = require(path.resolve(SERVER_SRC, 'utils/jwt.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use(errorHandler);

    const tokAdm = signToken({ id: 'u-adm', role: 'admin' });

    // 1. Batch division_id supplied with course_id omitted -> derives course_id from division
    const rDerived = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/admin/students/bulk-import',
      token: tokAdm,
      body: {
        division_id: 'div-bsc',
        students: [
          { roll_number: 'CS-201', full_name: 'Derived Student', email: 'cs201@student.smdl.ac.in' },
          // Also existing user/roll re-import updates division + heals NULL course_id cleanly
          { roll_number: 'EX-100', full_name: 'Existing Stu', email: 'exist@student.smdl.ac.in', division_id: 'div-bcom' },
        ],
      },
    });
    assert.strictEqual(rDerived.statusCode, 201);
    assert.strictEqual(rDerived.body.data.imported_count, 2);
    assert.strictEqual(rDerived.body.data.error_count, 0);
    const stu201 = tables.students.find((s) => s.student_id === 'CS-201');
    assert.strictEqual(stu201.division_id, 'div-bsc');
    assert.strictEqual(stu201.course_id, 'c-bsc');
    const stuExistUpdated = tables.students.find((s) => s.student_id === 'EX-100');
    assert.strictEqual(stuExistUpdated.division_id, 'div-bcom');
    assert.strictEqual(stuExistUpdated.course_id, 'c-bcom');

    // 2. Matching explicit course & division -> success; mismatched course & invalid division -> row rejected without creating orphan users
    const userCountBefore = tables.users.length;
    const stuCountBefore = tables.students.length;
    failInsertStudentRoll = 'ROLLBACK-99';
    const rMixed = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/admin/students/bulk-import',
      token: tokAdm,
      body: {
        students: [
          { roll_number: 'CS-202', full_name: 'Valid Match', email: 'cs202@smdl.edu', division_id: 'div-bsc', course_id: 'c-bsc' },
          { roll_number: 'BAD-MISMATCH', full_name: 'Bad Pair', email: 'badpair@smdl.edu', division_id: 'div-bsc', course_id: 'c-bcom' },
          { roll_number: 'BAD-DIV', full_name: 'Bad Div', email: 'baddiv@smdl.edu', division_id: 'div-missing' },
          { roll_number: 'UNASS-1', full_name: 'Unassigned Stu', email: 'unass1@smdl.edu' },
          { roll_number: 'CS-201', full_name: 'Duplicate Roll Other Email', email: 'attacker@smdl.edu', division_id: 'div-bsc' },
          { roll_number: 'ROLLBACK-99', full_name: 'Rollback On DB Fail', email: 'rb99@smdl.edu', division_id: 'div-bsc' },
        ],
      },
    });
    assert.strictEqual(rMixed.statusCode, 201);
    assert.strictEqual(rMixed.body.data.imported_count, 2, 'CS-202 and UNASS-1 must succeed');
    assert.strictEqual(rMixed.body.data.error_count, 4, 'Mismatch, invalid div, dup roll conflict, and DB fail must be rejected');

    const stu202 = tables.students.find((s) => s.student_id === 'CS-202');
    assert.strictEqual(stu202.division_id, 'div-bsc');
    assert.strictEqual(stu202.course_id, 'c-bsc');

    const stuUnass = tables.students.find((s) => s.student_id === 'UNASS-1');
    assert.strictEqual(stuUnass.division_id, null);
    assert.strictEqual(stuUnass.course_id, null);

    // Zero orphan users created for rejected rows!
    assert.strictEqual(tables.students.length, stuCountBefore + 2);
    assert.strictEqual(tables.users.length, userCountBefore + 2);
    assert(!tables.users.some((u) => ['badpair@smdl.edu', 'baddiv@smdl.edu', 'attacker@smdl.edu', 'rb99@smdl.edu'].includes(u.email)));

    clearAllTargets();
  });

  // =========================================================================
  // 18. [A1-Register] registerStudent course/division derivation & rejection
  // =========================================================================
  await test('A1-Register (Route + Controller): derives course from division, accepts matches, rejects mismatches, keeps unassigned registration', async () => {
    clearAllTargets();
    setModuleMock('services/otpService.js', {
      createOtp: async () => ({ otp: '123456', expiresInSeconds: 300 }),
      verifyOtp: async () => ({ success: true, otpToken: 'ok' }),
      isEmailVerified: async () => true,
      consumeVerification: async () => {},
    });
    setModuleMock('services/emailService.js', {
      sendOtpEmail: async () => {},
      sendTeacherApprovalEmail: async () => {},
      sendTeacherRejectionEmail: async () => {},
    });

    const tables = {
      users: [],
      courses: [
        { id: 'c-bsc', name: 'B.Sc. Computer Science', code: 'BSC-CS' },
        { id: 'c-bcom', name: 'Bachelor of Commerce', code: 'BCOM' },
      ],
      divisions: [
        { id: 'div-bsc', course_id: 'c-bsc', name: 'FY BSc', division_name: 'A' },
        { id: 'div-bcom', course_id: 'c-bcom', name: 'FY BCom', division_name: 'A' },
      ],
      students: [],
      teachers: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });

    const express = require('express');
    const authRoutes = require(path.resolve(SERVER_SRC, 'routes/authRoutes.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);

    // 1. Valid division with omitted course_id -> derives course_id from division
    const rDivOnly = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/register/student',
      body: {
        full_name: 'Stu Derived',
        email: 'reg1@smdl.edu',
        password: 'Password123',
        roll_number: 'REG-1',
        division_id: 'div-bsc',
      },
    });
    assert.strictEqual(rDivOnly.statusCode, 201);
    const s1 = tables.students.find((s) => s.student_id === 'REG-1');
    assert.strictEqual(s1.division_id, 'div-bsc');
    assert.strictEqual(s1.course_id, 'c-bsc');

    // 2. Valid matching course_id + division_id + branch -> succeeds
    const rMatch = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/register/student',
      body: {
        full_name: 'Stu Match',
        email: 'reg2@smdl.edu',
        password: 'Password123',
        roll_number: 'REG-2',
        course_id: 'c-bcom',
        division_id: 'div-bcom',
        branch: 'Bachelor of Commerce',
      },
    });
    assert.strictEqual(rMatch.statusCode, 201);
    const s2 = tables.students.find((s) => s.student_id === 'REG-2');
    assert.strictEqual(s2.division_id, 'div-bcom');
    assert.strictEqual(s2.course_id, 'c-bcom');

    // 3. Mismatched division_id + course_id, and mismatched division_id + branch -> rejected 400 with ZERO DB writes
    const userCountPre = tables.users.length;
    const rBadCourse = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/register/student',
      body: {
        full_name: 'Bad Course',
        email: 'bad1@smdl.edu',
        password: 'Password123',
        roll_number: 'BAD-1',
        division_id: 'div-bsc',
        course_id: 'c-bcom',
      },
    });
    assert.strictEqual(rBadCourse.statusCode, 400);

    const rBadBranch = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/register/student',
      body: {
        full_name: 'Bad Branch',
        email: 'bad2@smdl.edu',
        password: 'Password123',
        roll_number: 'BAD-2',
        division_id: 'div-bsc',
        branch: 'BCom',
      },
    });
    assert.strictEqual(rBadBranch.statusCode, 400);

    const rBadDivId = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/register/student',
      body: {
        full_name: 'Missing Div',
        email: 'bad3@smdl.edu',
        password: 'Password123',
        roll_number: 'BAD-3',
        division_id: 'div-does-not-exist',
      },
    });
    assert.strictEqual(rBadDivId.statusCode, 400);
    assert.strictEqual(tables.users.length, userCountPre, 'Rejected registrations must not create users');

    // 4. No division supplied -> preserves unassigned registration even when divisions exist
    const rUnassigned = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/register/student',
      body: {
        full_name: 'Stu Unassigned',
        email: 'reg-unass@smdl.edu',
        password: 'Password123',
        roll_number: 'REG-UNASS',
      },
    });
    assert.strictEqual(rUnassigned.statusCode, 201);
    const sUnass = tables.students.find((s) => s.student_id === 'REG-UNASS');
    assert.strictEqual(sUnass.division_id, null);
    assert.strictEqual(sUnass.course_id, null);

    // 5. LoginPage legacy quick-register flow (no division_id, sends course_id + branch + class + division) keeps working
    const rQuick = await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/auth/register/student',
      body: {
        full_name: 'Quick Stu',
        email: 'quick@smdl.edu',
        password: 'Password123',
        roll_number: 'REG-QUICK',
        course_id: 'c-bsc',
        branch: 'B.Sc. Computer Science',
        class: 'FY',
        division: 'A',
      },
    });
    assert.strictEqual(rQuick.statusCode, 201);
    const sQuick = tables.students.find((s) => s.student_id === 'REG-QUICK');
    assert.strictEqual(sQuick.division_id, 'div-bsc');
    assert.strictEqual(sQuick.course_id, 'c-bsc');

    clearAllTargets();
  });

  // =========================================================================
  // 19. [A1-Attendance] End-to-end markAttendance compatibility after transfer/import
  // =========================================================================
  await test('A1-Attendance E2E: transferred/imported/legacy NULL-course students succeed cleanly; stale non-null, null-div, cross-div, dup & cancelled fail safely', async () => {
    clearAllTargets();
    setModuleMock('utils/dateUtils.js', {
      getKolkataDateString: () => '2026-11-10',
      getKolkataDayName: () => 'Tuesday',
      getKolkataMinutes: () => 570,
      getKolkataTimeString: () => '09:30:00',
    });
    setModuleMock('services/selfieStorageService.js', {
      validateAndDecodeSelfie: () => ({ buffer: Buffer.from('img'), mimeType: 'image/jpeg', extension: 'jpg' }),
      uploadAttendanceSelfie: async ({ studentId, attendanceId }) => ({
        storagePath: `${studentId}/${attendanceId}.jpg`,
        uploadedAt: '2026-11-10T09:30:00.000Z',
        expiresAt: '2026-12-10T09:30:00.000Z',
      }),
      deleteSelfieObject: async () => {},
      generateSelfieSignedUrl: async () => 'https://signed.example/s.jpg',
    });
    setModuleMock('services/notificationService.js', { createNotification: async () => {}, sendToUsers: async () => {} });
    setModuleMock('services/attendanceNotificationService.js', { checkAndNotifyLowAttendance: async () => {} });

    const tables = {
      users: [
        { id: 'u-adm', full_name: 'Admin', email: 'adm@smdl.edu', role: 'admin', status: 'ACTIVE' },
        { id: 'u-xfer', full_name: 'Transferred Stu', email: 'xfer@smdl.edu', role: 'student', status: 'ACTIVE' },
        { id: 'u-leg', full_name: 'Legacy NullCourse', email: 'leg@smdl.edu', role: 'student', status: 'ACTIVE' },
        { id: 'u-stale', full_name: 'Stale Course', email: 'stale@smdl.edu', role: 'student', status: 'ACTIVE' },
        { id: 'u-nulldiv', full_name: 'Null Div', email: 'nd@smdl.edu', role: 'student', status: 'ACTIVE' },
      ],
      courses: [
        { id: 'c-bsc', name: 'BSc CS', code: 'BSC' },
        { id: 'c-bcom', name: 'BCom', code: 'BCOM' },
      ],
      divisions: [
        { id: 'div-bsc', course_id: 'c-bsc', name: 'FY BSc', division_name: 'A' },
        { id: 'div-bcom', course_id: 'c-bcom', name: 'FY BCom', division_name: 'A' },
      ],
      subjects: [
        { id: 'sub-bsc', name: 'DSA', code: 'DSA', division_id: 'div-bsc' },
        { id: 'sub-bcom', name: 'Accounts', code: 'ACC', division_id: 'div-bcom' },
      ],
      division_timetables: [],
      lectures: [
        { id: 'lec-bsc', division_id: 'div-bsc', subject_id: 'sub-bsc', lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'DSA' },
        { id: 'lec-bcom', division_id: 'div-bcom', subject_id: 'sub-bcom', lecture_date: '2026-11-10', start_time: '09:00:00', end_time: '10:00:00', status: 'SCHEDULED', topic: 'Accounts' },
        { id: 'lec-bsc-can', division_id: 'div-bsc', subject_id: 'sub-bsc', lecture_date: '2026-11-10', start_time: '09:10:00', end_time: '10:10:00', status: 'CANCELLED', topic: '[CANCELLED] DSA' },
      ],
      students: [
        { id: 'stu-xfer', user_id: 'u-xfer', student_id: 'XF1', division_id: 'div-bsc', course_id: 'c-bsc' },
        { id: 'stu-leg', user_id: 'u-leg', student_id: 'LG1', division_id: 'div-bsc', course_id: null },
        { id: 'stu-stale', user_id: 'u-stale', student_id: 'ST1', division_id: 'div-bsc', course_id: 'c-bcom' },
        { id: 'stu-nd', user_id: 'u-nulldiv', student_id: 'ND1', division_id: null, course_id: 'c-bsc' },
      ],
      attendance: [],
      system_config: [],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });

    const express = require('express');
    const adminRoutes = require(path.resolve(SERVER_SRC, 'routes/adminRoutes.js'));
    const attendanceRoutes = require(path.resolve(SERVER_SRC, 'routes/attendanceRoutes.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));
    const { signToken } = require(path.resolve(SERVER_SRC, 'utils/jwt.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    app.use('/api/attendance', attendanceRoutes);
    app.use(errorHandler);

    const tokAdm = signToken({ id: 'u-adm', role: 'admin' });
    const tokXfer = signToken({ id: 'u-xfer', role: 'student' });
    const tokLeg = signToken({ id: 'u-leg', role: 'student' });
    const tokStale = signToken({ id: 'u-stale', role: 'student' });
    const tokND = signToken({ id: 'u-nulldiv', role: 'student' });
    const coords = { latitude: 19.02479, longitude: 73.10159, selfie: 'data' };

    // 1. Transfer stu-xfer across courses (without new_course_id) -> marks BCom 201, blocked on old BSc 403
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/admin/students/stu-xfer/transfer', token: tokAdm, body: { new_division_id: 'div-bcom', reason: 'Switch' },
    })).statusCode, 200);
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokXfer, body: { lecture_id: 'lec-bcom', ...coords },
    })).statusCode, 201);
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokXfer, body: { lecture_id: 'lec-bsc', ...coords },
    })).statusCode, 403);

    // 2. Bulk import student with division_id & omitted course_id -> marks assigned division 201
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST',
      url: '/api/admin/students/bulk-import',
      token: tokAdm,
      body: { division_id: 'div-bsc', students: [{ roll_number: 'BI-1', full_name: 'Bulk Stu', email: 'bi1@smdl.edu' }] },
    })).statusCode, 201);
    const bulkStuUser = tables.users.find((u) => u.email === 'bi1@smdl.edu');
    const tokBulk = signToken({ id: bulkStuUser.id, role: 'student' });
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokBulk, body: { lecture_id: 'lec-bsc', ...coords },
    })).statusCode, 201);

    // 3. Legacy student (valid division_id + NULL course_id) -> 201 for own division, ZERO profile mutation, 403 cross-division
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokLeg, body: { lecture_id: 'lec-bsc', ...coords },
    })).statusCode, 201);
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-leg').division_id, 'div-bsc');
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-leg').course_id, null);
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokLeg, body: { lecture_id: 'lec-bcom', ...coords },
    })).statusCode, 403);

    // 4. Duplicate & cancelled rejected 400
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokLeg, body: { lecture_id: 'lec-bsc', ...coords },
    })).statusCode, 400);
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokLeg, body: { lecture_id: 'lec-bsc-can', ...coords },
    })).statusCode, 400);

    // 5. Stale non-null course_id & NULL division_id remain rejected 403 (zero inserts)
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokStale, body: { lecture_id: 'lec-bsc', ...coords },
    })).statusCode, 403);
    assert.strictEqual((await dispatchExpressRoute(app, {
      method: 'POST', url: '/api/attendance/mark', token: tokND, body: { lecture_id: 'lec-bsc', division_id: 'div-bsc', ...coords },
    })).statusCode, 403);
    assert.strictEqual(tables.students.find((s) => s.id === 'stu-nd').division_id, null);

    clearAllTargets();
  });

  // =========================================================================
  // 20. [C1] /api/academic/teachers-list Admin-Only Route + Controller Auth
  // =========================================================================
  await test('C1 (/api/academic/teachers-list): ACTIVE admin gets faculty emails; teacher, student, PENDING/INACTIVE/missing status/missing role & unauth blocked', async () => {
    clearAllTargets();

    const tables = {
      users: [
        { id: 'u-adm-act', full_name: 'Adm Act', email: 'adm@smdl.edu', role: 'admin', status: 'ACTIVE' },
        { id: 'u-adm-pend', full_name: 'Adm Pend', email: 'admp@smdl.edu', role: 'admin', status: 'PENDING' },
        { id: 'u-adm-inact', full_name: 'Adm Inact', email: 'admi@smdl.edu', role: 'admin', status: 'INACTIVE' },
        { id: 'u-tch-act', full_name: 'Prof Active', email: 'faculty-secret@smdl.edu', role: 'teacher', status: 'ACTIVE' },
        { id: 'u-tch-pend', full_name: 'Prof Pending', email: 'faculty-pend@smdl.edu', role: 'teacher', status: 'PENDING' },
        { id: 'u-stu-act', full_name: 'Stu Act', email: 'stu@smdl.edu', role: 'student', status: 'ACTIVE' },
      ],
      teachers: [
        { id: 't-1', user_id: 'u-tch-act', teacher_id: 'T01', department: 'CS', designation: 'HOD' },
        { id: 't-2', user_id: 'u-tch-pend', teacher_id: 'T02', department: 'IT', designation: 'Lecturer' },
      ],
    };

    setModuleMock('config/db.js', { supabaseAdmin: createSupabaseMock({ tables }) });

    const express = require('express');
    const academicRoutes = require(path.resolve(SERVER_SRC, 'routes/academicRoutes.js'));
    const acadCtrl = require(path.resolve(SERVER_SRC, 'controllers/academicController.js'));
    const errorHandler = require(path.resolve(SERVER_SRC, 'middleware/errorHandler.js'));
    const { signToken } = require(path.resolve(SERVER_SRC, 'utils/jwt.js'));

    const app = express();
    app.use(express.json());
    app.use('/api/academic', academicRoutes);
    app.use(errorHandler);

    const tokAdmAct = signToken({ id: 'u-adm-act', role: 'admin' });
    const tokAdmPend = signToken({ id: 'u-adm-pend', role: 'admin' });
    const tokAdmInact = signToken({ id: 'u-adm-inact', role: 'admin' });
    const tokTchAct = signToken({ id: 'u-tch-act', role: 'teacher' });
    const tokStuAct = signToken({ id: 'u-stu-act', role: 'student' });

    // 1. ACTIVE admin via Express route -> 200 with faculty emails preserved
    const rAdm = await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/teachers-list', token: tokAdmAct });
    assert.strictEqual(rAdm.statusCode, 200);
    assert.strictEqual(rAdm.body.data.teachers.length, 1);
    assert.strictEqual(rAdm.body.data.teachers[0].user.email, 'faculty-secret@smdl.edu');

    // 2. Unauthorized authenticated roles/statuses via Express route (no teachers/email leaked)
    for (const { label, tok, expectedCode } of [
      { label: 'ACTIVE teacher', tok: tokTchAct, expectedCode: 403 },
      { label: 'ACTIVE student', tok: tokStuAct, expectedCode: 403 },
      { label: 'PENDING admin', tok: tokAdmPend, expectedCode: 403 },
      { label: 'INACTIVE admin (protect)', tok: tokAdmInact, expectedCode: 401 },
      { label: 'Unauthenticated', tok: null, expectedCode: 401 },
    ]) {
      const r = await dispatchExpressRoute(app, { method: 'GET', url: '/api/academic/teachers-list', token: tok });
      assert.strictEqual(r.statusCode, expectedCode, `${label} expected ${expectedCode}`);
      assert.strictEqual(r.body?.data?.teachers, undefined);
      assert(!String(r.rawBody || '').includes('faculty-secret@smdl.edu'));
    }

    // 3. Direct controller defense-in-depth checks
    const rDirectAdm = await callHandler(acadCtrl.getTeachersList, {
      user: { id: 'u-adm-act', role: 'admin', status: 'ACTIVE' },
    });
    assert.strictEqual(rDirectAdm.statusCode, 200);
    assert.strictEqual(rDirectAdm.body.data.teachers[0].user.email, 'faculty-secret@smdl.edu');

    for (const badUser of [
      { id: 'u-tch-act', role: 'teacher', status: 'ACTIVE' },
      { id: 'u-stu-act', role: 'student', status: 'ACTIVE' },
      { id: 'u-adm-pend', role: 'admin', status: 'PENDING' },
      { id: 'u-adm-inact', role: 'admin', status: 'INACTIVE' },
      { id: 'u-adm-act', role: 'admin' },
      { id: 'u-adm-act', status: 'ACTIVE' },
    ]) {
      await assert.rejects(
        () => callHandler(acadCtrl.getTeachersList, { user: badUser }),
        (e) => e.statusCode === 403
      );
    }

    await assert.rejects(
      () => callHandler(acadCtrl.getTeachersList, {}),
      (e) => e.statusCode === 401
    );

    clearAllTargets();
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

let summaryPrinted = false;
process.on('beforeExit', (code) => {
  if (!summaryPrinted) {
    console.error('Fatal runner error: event loop drained before test summary completed');
    process.exitCode = code || 1;
  }
});

runTests().then(() => {
  summaryPrinted = true;
}).catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
