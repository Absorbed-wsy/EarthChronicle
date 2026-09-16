import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';

export const SCHEMA_VERSION = 2;
async function removeTemporary(directory) {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !/^earthchronicle-(import|export)-/.test(path.basename(resolved))) throw new Error('Invalid temporary path');
  await rm(resolved, {recursive:true,force:true});
}
const APPLICATION_ID = 0x4543524e;
export class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }
const SCHEMAS = {
  canonical_records: 'CREATE TABLE canonical_records (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(kind, id)) STRICT',
  metadata: 'CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
  user_events: 'CREATE TABLE user_events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT',
  preferences: 'CREATE TABLE preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
  settings: 'CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
};
const canonicalRows = (db) => db.prepare('SELECT kind, id, payload FROM canonical_records ORDER BY kind, id').all();
const canonicalHash = (db) => createHash('sha256').update(JSON.stringify(canonicalRows(db))).digest('hex');
const parseJson = (value) => { try { return JSON.parse(value); } catch { throw new RequestError(400, '数据库中的记录格式不正确。'); } };
const validTimestamp = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function nextTimestamp(previous) {
  // Imported records may come from a computer whose clock is ahead of ours.
  // Every local edit must still sort after that record during the next merge.
  const milliseconds = Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0);
  if (!Number.isFinite(milliseconds) || milliseconds > Date.parse('9999-12-31T23:59:59.999Z')) throw new RequestError(400, '记录时间超出支持范围，请检查导入文件的时间。');
  return new Date(milliseconds).toISOString();
}

export function validateEvent(input, places, id = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError(400, '事件必须是一个对象。');
  const text = (key, max, required = false) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new RequestError(400, `${key} 内容缺失或过长。`);
    return value.trim();
  };
  const title = text('title', 160, true), summary = text('summary', 6000, true), placeId = text('placeId', 120, true);
  if (!places.has(placeId)) throw new RequestError(400, '请选择已有的地点。');
  const year = input.year;
  if (!Number.isSafeInteger(year) || year < 1 || year > 9999) throw new RequestError(400, '个人事件支持公元 1 至 9999 年，请输入整数。');
  const endYear = input.endYear === '' || input.endYear === undefined || input.endYear === null ? null : input.endYear;
  if (endYear !== null && (!Number.isSafeInteger(endYear) || endYear < year || endYear > 9999)) throw new RequestError(400, '结束年份必须不早于开始年份。');
  const category = text('category', 60, true);
  if (!['建都', '营建', '制度', '文化', '航海', '战争'].includes(category)) throw new RequestError(400, '请选择有效的事件类型。');
  const sourceTitle = text('sourceTitle', 300, true), sourceUrl = text('sourceUrl', 2000);
  if (sourceUrl) {
    let url;
    try { url = new URL(sourceUrl); } catch { throw new RequestError(400, '来源链接必须是有效的网页地址。'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new RequestError(400, '来源链接仅支持 http 或 https 网页地址。');
  }
  if (id !== null && (typeof id !== 'string' || !/^user-[a-zA-Z0-9_-]{1,100}$/.test(id))) throw new RequestError(400, '个人事件 ID 无效。');
  return { title, year, endYear, placeId, category, summary, sourceTitle, sourceUrl, id: id || `user-${randomUUID()}` };
}

export function validatePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError(400, '显示设置格式不正确。');
  const ranges = { explorerWidth: [240, 440], detailWidth: [260, 480], timelineHeight: [116, 300] };
  const booleans = ['explorerCollapsed', 'detailCollapsed', 'timelineCollapsed'];
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'theme' && ['light', 'paper', 'night'].includes(value)) result[key] = value;
    else if (ranges[key] && Number.isInteger(value) && value >= ranges[key][0] && value <= ranges[key][1]) result[key] = value;
    else if (booleans.includes(key) && typeof value === 'boolean') result[key] = value;
    else throw new RequestError(400, `显示设置 ${key} 无效。`);
  }
  return result;
}

function publicEvent(row) {
  const event = parseJson(row.payload);
  return { ...event, createdAt: row.created_at, updatedAt: row.updated_at, origin: 'user', userCreated: true, sources: [{ title: event.sourceTitle, url: event.sourceUrl }] };
}

export async function openChronicleDatabase({ databasePath, publicDir }) {
  if (databasePath !== ':memory:') await mkdir(path.dirname(path.resolve(databasePath)), { recursive: true });
  const db = new DatabaseSync(databasePath, { allowExtension: false });
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; PRAGMA trusted_schema=OFF;');
    const oldVersion = db.prepare('PRAGMA user_version').get().user_version;
    if (oldVersion > SCHEMA_VERSION) throw new Error('数据库来自较新的地球史书，请使用相应版本打开。');
    const existing = db.prepare("SELECT name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const names = new Set(existing.map((row) => row.name));
    // The original application only had user_events. Retain every row while upgrading its schema.
    db.exec('BEGIN IMMEDIATE');
    try {
      if (names.has('user_events') && !/\bSTRICT\s*$/i.test(existing.find((row) => row.name === 'user_events').sql)) {
        db.exec('ALTER TABLE user_events RENAME TO legacy_user_events');
        db.exec(SCHEMAS.user_events);
        db.exec('INSERT INTO user_events SELECT id, payload, created_at, updated_at FROM legacy_user_events; DROP TABLE legacy_user_events');
      }
      for (const [name, schema] of Object.entries(SCHEMAS)) if (!names.has(name)) db.exec(schema);
      db.exec(`PRAGMA user_version=${SCHEMA_VERSION}; PRAGMA application_id=${APPLICATION_ID}; COMMIT`);
    } catch (error) { db.exec('ROLLBACK'); throw error; }

    const seeded = db.prepare("SELECT value FROM metadata WHERE key='canonicalHash'").get();
    if (!seeded) {
      if (db.prepare('SELECT count(*) AS count FROM canonical_records').get().count) throw new Error('内置资料未完整初始化，请保留数据库并检查文件。');
      const history = parseJson(await readFile(path.join(publicDir, 'data', 'history.json'), 'utf8'));
      const manifest = parseJson(await readFile(path.join(publicDir, 'data', 'geology', 'manifest.json'), 'utf8'));
      if (!Array.isArray(history.events) || !Array.isArray(history.places) || !Array.isArray(manifest.snapshots)) throw new Error('初始资料格式有误。');
      const entries = [['history-meta', 'main', history.meta], ...history.places.map((p) => ['place', p.id, p]), ...history.events.map((e) => ['history-event', e.id, e]), ['geology-manifest', 'main', manifest]];
      for (const snapshot of manifest.snapshots) {
        if (!Number.isFinite(snapshot.ma) || !/^\d+\.geojson$/.test(snapshot.file)) throw new Error('地球演化初始资料格式有误。');
        const geo = parseJson(await readFile(path.join(publicDir, 'data', 'geology', snapshot.file), 'utf8'));
        if (geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) throw new Error('地球演化初始资料格式有误。');
        entries.push(['geology-snapshot', String(snapshot.ma), geo]);
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const insert = db.prepare('INSERT INTO canonical_records(kind,id,payload) VALUES (?,?,?)');
        for (const [kind, id, payload] of entries) insert.run(kind, id, JSON.stringify(payload));
        db.prepare('INSERT INTO metadata(key,value) VALUES (?,?)').run('canonicalHash', canonicalHash(db));
        db.prepare('INSERT INTO metadata(key,value) VALUES (?,?)').run('appId', 'earth-chronicle');
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    } else if (seeded.value !== canonicalHash(db)) throw new Error('内置只读资料校验失败，请从原始备份恢复。');
    db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run('contentServer', JSON.stringify({ enabled: false, port: 8080 }));

    const selectKind = db.prepare('SELECT payload FROM canonical_records WHERE kind=? ORDER BY id');
    const selectCanonical = db.prepare('SELECT payload FROM canonical_records WHERE kind=? AND id=?');
    const placeIds = new Set(selectKind.all('place').map((row) => parseJson(row.payload).id));
    const getCanonical = (kind, id) => { const row = selectCanonical.get(kind, String(id)); return row ? parseJson(row.payload) : null; };
    const userGet = db.prepare('SELECT id, payload, created_at, updated_at FROM user_events WHERE id=?');
    const userPut = db.prepare('INSERT INTO user_events(id,payload,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at');
    const userAll = db.prepare('SELECT id, payload, created_at, updated_at FROM user_events ORDER BY created_at,id');
    const prefPut = db.prepare('INSERT INTO preferences(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const preferences = () => Object.fromEntries(db.prepare('SELECT key,value FROM preferences ORDER BY key').all().map((row) => [row.key, parseJson(row.value)]));
    const savePreferences = (values) => { const checked = validatePreferences(values); for (const [key, value] of Object.entries(checked)) prefPut.run(key, JSON.stringify(value)); return preferences(); };
    return {
      close() { db.close(); },
      library() { return { meta: getCanonical('history-meta', 'main'), places: selectKind.all('place').map((row) => parseJson(row.payload)), events: [...selectKind.all('history-event').map((row) => ({ ...parseJson(row.payload), origin: 'bundled', userCreated: false })), ...userAll.all().map(publicEvent)] }; },
      geologyManifest() { return getCanonical('geology-manifest', 'main'); },
      geologySnapshot(ma) { return getCanonical('geology-snapshot', ma); },
      counts() { const count = (kind) => Number(db.prepare('SELECT count(*) AS count FROM canonical_records WHERE kind=?').get(kind).count); return { schemaVersion: SCHEMA_VERSION, historyEvents: count('history-event'), places: count('place'), geologySnapshots: count('geology-snapshot'), personalEvents: Number(db.prepare('SELECT count(*) AS count FROM user_events').get().count) }; },
      preferences, savePreferences,
      contentConfig() { return parseJson(db.prepare("SELECT value FROM settings WHERE key='contentServer'").get().value); },
      saveContentConfig(config) { db.prepare("UPDATE settings SET value=? WHERE key='contentServer'").run(JSON.stringify(config)); },
      saveEvent(input, id = null) {
        if (id && !/^user-[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new RequestError(403, '明确历史记录为只读，不能修改。');
        const old = id ? userGet.get(id) : null;
        if (id && !old) throw new RequestError(404, '未找到该个人事件。');
        const event = validateEvent(input, placeIds, id), now = nextTimestamp(old?.updated_at);
        userPut.run(event.id, JSON.stringify(event), old?.created_at || now, now);
        return publicEvent(userGet.get(event.id));
      },
      deleteEvent(id) {
        if (!/^user-[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new RequestError(403, '明确历史记录为只读，不能删除。');
        if (!db.prepare('DELETE FROM user_events WHERE id=?').run(id).changes) throw new RequestError(404, '未找到该个人事件。');
      },
      async exportDatabase() {
        const directory = await mkdtemp(path.join(tmpdir(), 'earthchronicle-export-'));
        try { const file = path.join(directory, 'chronicle.sqlite'); await backup(db, file); return await readFile(file); }
        finally { await removeTemporary(directory); }
      },
      async importDatabase(bytes) {
        if (!Buffer.isBuffer(bytes) || bytes.length < 100 || bytes.subarray(0, 16).toString('latin1') !== 'SQLite format 3\0') throw new RequestError(400, '请选择地球史书导出的 SQLite 数据库。');
        const directory = await mkdtemp(path.join(tmpdir(), 'earthchronicle-import-'));
        let source;
        try {
          const file = path.join(directory, 'import.sqlite'); await writeFile(file, bytes);
          source = new DatabaseSync(file, { readOnly: true, allowExtension: false });
          source.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
          if (source.prepare('PRAGMA application_id').get().application_id !== APPLICATION_ID || source.prepare('PRAGMA user_version').get().user_version !== SCHEMA_VERSION) throw new RequestError(400, '数据库版本不兼容，请导入本版地球史书导出的数据库。');
          const objects = source.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
          if (objects.length !== Object.keys(SCHEMAS).length || objects.some((row) => row.type !== 'table' || SCHEMAS[row.name] !== row.sql)) throw new RequestError(400, '数据库结构异常，已取消导入。');
          const integrity = source.prepare('PRAGMA integrity_check').all();
          if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new RequestError(400, '数据库文件已损坏，已取消导入。');
          const sourceHash = canonicalHash(source);
          if (sourceHash !== canonicalHash(db) || source.prepare("SELECT value FROM metadata WHERE key='canonicalHash'").get()?.value !== sourceHash || source.prepare("SELECT value FROM metadata WHERE key='appId'").get()?.value !== 'earth-chronicle') throw new RequestError(400, '数据库中的内置历史或地球演化数据与当前版本不一致，不能导入修改过的只读资料。');
          if (source.prepare('SELECT count(*) AS count FROM metadata').get().count !== 2 || source.prepare('SELECT count(*) AS count FROM settings').get().count !== 1) throw new RequestError(400, '数据库设置结构异常。');
          const configuration = parseJson(source.prepare("SELECT value FROM settings WHERE key='contentServer'").get()?.value);
          if (typeof configuration.enabled !== 'boolean' || !Number.isInteger(configuration.port) || configuration.port < 1024 || configuration.port > 65535 || Object.keys(configuration).length !== 2) throw new RequestError(400, '数据库内容服务器设置无效。');
          const importedPrefs = validatePreferences(Object.fromEntries(source.prepare('SELECT key,value FROM preferences').all().map((row) => [row.key, parseJson(row.value)])));
          if (source.prepare('SELECT count(*) AS count FROM user_events').get().count > 100000) throw new RequestError(400, '数据库个人记录数量超过本版支持的范围。');
          const records = source.prepare('SELECT id,payload,created_at,updated_at FROM user_events ORDER BY id').all().map((row) => {
            const payload = parseJson(row.payload);
            if (payload.id !== row.id || !validTimestamp(row.created_at) || !validTimestamp(row.updated_at) || row.updated_at < row.created_at) throw new RequestError(400, '数据库个人记录的标识或时间无效。');
            return { ...row, event: validateEvent(payload, placeIds, row.id) };
          });
          let imported = 0, updated = 0, skipped = 0;
          db.exec('BEGIN IMMEDIATE');
          try {
            for (const row of records) {
              const existing = userGet.get(row.id);
              if (existing && existing.updated_at >= row.updated_at) { skipped++; continue; }
              userPut.run(row.id, JSON.stringify(row.event), existing?.created_at || row.created_at, row.updated_at);
              if (existing) updated++; else imported++;
            }
            savePreferences(importedPrefs);
            db.exec('COMMIT');
          } catch (error) { db.exec('ROLLBACK'); throw error; }
          return { imported, updated, skipped };
        } catch (error) {
          if (error instanceof RequestError) throw error;
          throw new RequestError(400, '无法读取该数据库，文件可能已损坏或格式不兼容。');
        } finally { source?.close(); await removeTemporary(directory); }
      },
    };
  } catch (error) { db.close(); throw error; }
}
