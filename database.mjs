import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, readFile, writeFile, mkdtemp, rm, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { CATEGORIES } from './public/domain.js';

export const SCHEMA_VERSION = 5;
export const MAX_DATABASE_BYTES = 2 * 1024 * 1024 * 1024;
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
// Only retained to recognize backups made before the removed feature was retired.
const LEGACY_ASSET_SCHEMA = 'CREATE TABLE science_assets (id TEXT PRIMARY KEY, content_type TEXT NOT NULL, sha256 TEXT NOT NULL, data BLOB NOT NULL) STRICT';
const isRetiredKind = kind => kind.startsWith('geology-');
const isRetiredMetadata = key => key.startsWith('evolution');
const isRetiredPreference = key => key.startsWith('geo');
const parseJson = (value) => { try { return JSON.parse(value); } catch { throw new RequestError(400, '数据库中的记录格式不正确。'); } };
// Modern reference regions support searching, not historical boundaries. Keep
// this migration restricted to the original five places so future catalogues
// and personal records cannot be silently rewritten.
const REFERENCE_REGIONS = Object.freeze({
  nanjing: { countryCode: 'CN', regionCode: 'CN-32', regionName: '江苏省' },
  taicang: { countryCode: 'CN', regionCode: 'CN-32', regionName: '江苏省' },
  beijing: { countryCode: 'CN', regionCode: 'CN-11', regionName: '北京市' },
  fengyang: { countryCode: 'CN', regionCode: 'CN-34', regionName: '安徽省' },
  xian: { countryCode: 'CN', regionCode: 'CN-61', regionName: '陕西省' },
});
function placeWithReferenceRegion(place, id) {
  const region = Object.hasOwn(REFERENCE_REGIONS, id) ? REFERENCE_REGIONS[id] : null;
  if (!region) return place;
  const payload = { ...place };
  for (const [key, value] of Object.entries(region)) {
    if (Object.hasOwn(payload, key) && payload[key] !== value) throw new RequestError(400, '数据库中的内置地点资料与当前版本不一致，不能修改只读资料。');
    delete payload[key];
  }
  return { ...payload, ...region };
}
const historyHash = (db, legacy = false) => createHash('sha256').update(JSON.stringify(canonicalRows(db)
  .filter(row => !legacy || !isRetiredKind(row.kind))
  .map(row => row.kind === 'place' && Object.hasOwn(REFERENCE_REGIONS, row.id)
    ? { ...row, payload: JSON.stringify(placeWithReferenceRegion(parseJson(row.payload), row.id)) }
    : row))).digest('hex');
const validTimestamp = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
function nextTimestamp(previous) {
  // Imported records may come from a computer whose clock is ahead of ours.
  // Every local edit must still sort after that record during the next merge.
  const milliseconds = Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0);
  if (!Number.isFinite(milliseconds) || milliseconds > Date.parse('9999-12-31T23:59:59.999Z')) throw new RequestError(400, '记录时间超出支持范围，请检查导入文件的时间。');
  return new Date(milliseconds).toISOString();
}

const normalizedName = value => value.normalize('NFKC').trim().toLocaleLowerCase('und');
function validateLocation(input, places, persisted = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError(400, '地点格式不正确。');
  const text = (key, max, required = false) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max || !value.isWellFormed() || /[\u0000-\u001f\u007f]/u.test(value) || (required && !value.trim())) throw new RequestError(400, `地点 ${key} 内容缺失或过长。`);
    return value.trim();
  };
  const name = text('name', 160, true), countryCode = text('countryCode', 2, true).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new RequestError(400, '请选择有效的国家。');
  const { lon, lat } = input;
  if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180 || typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) throw new RequestError(400, '地点坐标无效。');
  let regionName = text('regionName', 100), cityName = text('cityName', 100), regionCode = '', cityId = text('cityId', 2048);
  const canonical = places instanceof Map ? [...places.values()] : [];
  const city = cityId && places instanceof Map ? places.get(cityId) : null;
  if (city) {
    if (city.countryCode !== countryCode) throw new RequestError(400, '城市与所选国家不一致。');
    regionCode = city.regionCode || ''; regionName = city.regionName || ''; cityName = city.name;
  } else {
    const region = regionName && canonical.find(place => place.countryCode === countryCode && normalizedName(place.regionName || '') === normalizedName(regionName));
    if (region) { regionCode = region.regionCode || ''; regionName = region.regionName; }
    else if (regionName) regionCode = `${countryCode}:region:${encodeURIComponent(normalizedName(regionName))}`;
    const generatedCityId = cityName ? `${countryCode}:city:${encodeURIComponent(normalizedName(regionName))}:${encodeURIComponent(normalizedName(cityName))}` : '';
    if (cityId && (!persisted || cityId !== generatedCityId)) throw new RequestError(400, '请选择有效的城市。');
    cityId = generatedCityId;
  }
  return { name, lon, lat, countryCode, regionCode, regionName, cityId, cityName };
}

export function validateEvent(input, places, id = null, { persisted = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError(400, '事件必须是一个对象。');
  const text = (key, max, required = false) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new RequestError(400, `${key} 内容缺失或过长。`);
    return value.trim();
  };
  if (id !== null && (typeof id !== 'string' || !/^user-[a-zA-Z0-9_-]{1,100}$/.test(id))) throw new RequestError(400, '个人事件 ID 无效。');
  const eventId = id || `user-${randomUUID()}`;
  const title = text('title', 160, true), summary = text('summary', 6000, true);
  const location = input.location === undefined ? null : validateLocation(input.location, places, persisted);
  const placeId = location ? `user-place-${eventId}` : text('placeId', 120, true);
  if (!location && !places.has(placeId)) throw new RequestError(400, '请选择已有的地点。');
  if (persisted && location && input.placeId !== placeId) throw new RequestError(400, '个人事件的地点标识无效。');
  const year = input.year;
  if (!Number.isSafeInteger(year) || year < -9998 || year > 9999) throw new RequestError(400, '年份必须在公元前 9999 年至公元 9999 年之间。');
  const endYear = input.endYear === '' || input.endYear === undefined || input.endYear === null ? null : input.endYear;
  if (endYear !== null && (!Number.isSafeInteger(endYear) || endYear < year || endYear > 9999)) throw new RequestError(400, '结束年份必须不早于开始年份。');
  const category = text('category', 60, true);
  if (!CATEGORIES.includes(category)) throw new RequestError(400, '请选择有效的事件类型。');
  const sourceTitle = text('sourceTitle', 300, true), sourceUrl = text('sourceUrl', 2000);
  if (sourceUrl) {
    let url;
    try { url = new URL(sourceUrl); } catch { throw new RequestError(400, '来源链接必须是有效的网页地址。'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new RequestError(400, '来源链接仅支持 http 或 https 网页地址。');
  }
  return { title, year, endYear, placeId, category, summary, sourceTitle, sourceUrl, id: eventId, ...(location ? { location } : {}) };
}

export function validatePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError(400, '显示设置格式不正确。');
  const ranges = { explorerWidth: [240, 440], detailWidth: [260, 480], timelineHeight: [88, 300], layoutVersion: [1, 4] };
  const booleans = ['explorerCollapsed', 'detailCollapsed', 'timelineCollapsed', 'mapTerrain'];
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === 'theme' && ['light', 'paper', 'night'].includes(value)) result[key] = value;
    else if (key === 'mapSource' && ['roads', 'offline'].includes(value)) result[key] = value;
    else if (key === 'mapQuality' && ['auto', 'high', 'smooth'].includes(value)) result[key] = value;
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
    const seeded = names.has('metadata') ? db.prepare("SELECT value FROM metadata WHERE key='canonicalHash'").get() : null;
    if (seeded && seeded.value !== canonicalHash(db)) throw new Error('内置只读资料校验失败，请从原始备份恢复。');
    if (!seeded && names.has('canonical_records') && db.prepare('SELECT count(*) AS count FROM canonical_records').get().count) throw new Error('内置资料未完整初始化，请保留数据库并检查文件。');
    let entries = [];
    if (!seeded) {
      const history = parseJson(await readFile(path.join(publicDir, 'data', 'history.json'), 'utf8'));
      if (!Array.isArray(history.events) || !Array.isArray(history.places)) throw new Error('初始资料格式有误。');
      entries = [['history-meta', 'main', history.meta], ...history.places.map(p => ['place', p.id, p]), ...history.events.map(e => ['history-event', e.id, e])];
    }
    // Validate the complete old read-only corpus before changing its hash. The
    // same transaction upgrades legacy personal rows and retires obsolete data.
    db.exec('PRAGMA secure_delete=ON; BEGIN IMMEDIATE');
    try {
      if (names.has('user_events') && !/\bSTRICT\s*$/i.test(existing.find(row => row.name === 'user_events').sql)) {
        db.exec('ALTER TABLE user_events RENAME TO legacy_user_events');
        db.exec(SCHEMAS.user_events);
        db.exec('INSERT INTO user_events SELECT id, payload, created_at, updated_at FROM legacy_user_events; DROP TABLE legacy_user_events');
      }
      for (const [name, schema] of Object.entries(SCHEMAS)) if (!names.has(name)) db.exec(schema);
      if (!seeded) {
        const insert = db.prepare('INSERT INTO canonical_records(kind,id,payload) VALUES (?,?,?)');
        for (const [kind, id, payload] of entries) insert.run(kind, id, JSON.stringify(payload));
        db.prepare('INSERT INTO metadata(key,value) VALUES (?,?)').run('appId', 'earth-chronicle');
      }
      if (oldVersion < 4) {
        db.exec("DROP TABLE IF EXISTS science_assets; DELETE FROM canonical_records WHERE kind GLOB 'geology-*'; DELETE FROM metadata WHERE key GLOB 'evolution*'; DELETE FROM preferences WHERE key GLOB 'geo*'");
      }
      const updatePlace = db.prepare("UPDATE canonical_records SET payload=? WHERE kind='place' AND id=?");
      for (const row of db.prepare("SELECT id,payload FROM canonical_records WHERE kind='place'").all()) {
        if (!Object.hasOwn(REFERENCE_REGIONS, row.id)) continue;
        const payload = JSON.stringify(placeWithReferenceRegion(parseJson(row.payload), row.id));
        if (payload !== row.payload) updatePlace.run(payload, row.id);
      }
      db.prepare("INSERT INTO metadata(key,value) VALUES ('canonicalHash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(canonicalHash(db));
      db.exec(`PRAGMA user_version=${SCHEMA_VERSION}; PRAGMA application_id=${APPLICATION_ID}; COMMIT`);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    if (oldVersion > 0 && oldVersion < 4) {
      // Reclaim removed BLOB pages and truncate the WAL so exported/current
      // database files no longer carry the retired dataset in free pages.
      db.exec('VACUUM; PRAGMA wal_checkpoint(TRUNCATE)');
    }
    db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run('contentServer', JSON.stringify({ enabled: false, port: 8080 }));

    const selectKind = db.prepare('SELECT payload FROM canonical_records WHERE kind=? ORDER BY id');
    const selectCanonical = db.prepare('SELECT payload FROM canonical_records WHERE kind=? AND id=?');
    const canonicalPlaces = new Map(selectKind.all('place').map((row) => { const place = parseJson(row.payload); return [place.id, place]; }));
    const getCanonical = (kind, id) => { const row = selectCanonical.get(kind, String(id)); return row ? parseJson(row.payload) : null; };
    const userGet = db.prepare('SELECT id, payload, created_at, updated_at FROM user_events WHERE id=?');
    const userPut = db.prepare('INSERT INTO user_events(id,payload,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at');
    const userAll = db.prepare('SELECT id, payload, created_at, updated_at FROM user_events ORDER BY created_at,id');
    const prefPut = db.prepare('INSERT INTO preferences(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const preferences = () => Object.fromEntries(db.prepare('SELECT key,value FROM preferences ORDER BY key').all().map((row) => [row.key, parseJson(row.value)]));
    const savePreferences = (values) => { const checked = validatePreferences(values); for (const [key, value] of Object.entries(checked)) prefPut.run(key, JSON.stringify(value)); return preferences(); };
    return {
      close() { db.close(); },
      library() {
        const personal = userAll.all().map(publicEvent);
        const places = [...selectKind.all('place').map(row => parseJson(row.payload)), ...personal.filter(event => event.location).map(event => ({ ...event.location, id: event.placeId, isCustom: true, userCreated: true }))];
        return { meta: getCanonical('history-meta', 'main'), places, events: [...selectKind.all('history-event').map((row) => ({ ...parseJson(row.payload), origin: 'bundled', userCreated: false })), ...personal] };
      },
      counts() { const count = kind => Number(db.prepare('SELECT count(*) AS count FROM canonical_records WHERE kind=?').get(kind).count); return { schemaVersion: SCHEMA_VERSION, historyEvents: count('history-event'), places: count('place'), personalEvents: Number(db.prepare('SELECT count(*) AS count FROM user_events').get().count) }; },
      preferences, savePreferences,
      contentConfig() { return parseJson(db.prepare("SELECT value FROM settings WHERE key='contentServer'").get().value); },
      saveContentConfig(config) { db.prepare("UPDATE settings SET value=? WHERE key='contentServer'").run(JSON.stringify(config)); },
      saveEvent(input, id = null) {
        if (id && !/^user-[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new RequestError(403, '明确历史记录为只读，不能修改。');
        const old = id ? userGet.get(id) : null;
        if (id && !old) throw new RequestError(404, '未找到该个人事件。');
        const event = validateEvent(input, canonicalPlaces, id), now = nextTimestamp(old?.updated_at);
        userPut.run(event.id, JSON.stringify(event), old?.created_at || now, now);
        return publicEvent(userGet.get(event.id));
      },
      deleteEvent(id) {
        if (!/^user-[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new RequestError(403, '明确历史记录为只读，不能删除。');
        if (!db.prepare('DELETE FROM user_events WHERE id=?').run(id).changes) throw new RequestError(404, '未找到该个人事件。');
      },
      async exportDatabase() {
        const directory = await mkdtemp(path.join(tmpdir(), 'earthchronicle-export-'));
        try { const file = path.join(directory, 'chronicle.sqlite'); await backup(db, file); return { file, size: (await stat(file)).size, cleanup: () => removeTemporary(directory) }; }
        catch (error) { await removeTemporary(directory); throw error; }
      },
      async importDatabaseFile(file) {
        const info = await stat(file);
        if (info.size < 100 || info.size > MAX_DATABASE_BYTES) throw new RequestError(400, '请选择大小有效的地球史书 SQLite 数据库。');
        const header = Buffer.alloc(16), handle = await open(file, 'r');
        try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
        if (header.toString('latin1') !== 'SQLite format 3\0') throw new RequestError(400, '请选择地球史书导出的 SQLite 数据库。');
        let source;
        try {
          source = new DatabaseSync(file, { readOnly: true, allowExtension: false });
          source.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
          const sourceVersion = source.prepare('PRAGMA user_version').get().user_version;
          if (source.prepare('PRAGMA application_id').get().application_id !== APPLICATION_ID || ![2, 3, 4, SCHEMA_VERSION].includes(sourceVersion)) throw new RequestError(400, '数据库版本不兼容，请导入地球史书版本 2、3、4 或 5 的数据库。');
          const objects = source.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
          const schemas = sourceVersion === 3 ? { ...SCHEMAS, science_assets: LEGACY_ASSET_SCHEMA } : SCHEMAS;
          const schemaNames = Object.keys(schemas);
          if (objects.length !== schemaNames.length || objects.some((row) => row.type !== 'table' || !schemaNames.includes(row.name) || schemas[row.name] !== row.sql)) throw new RequestError(400, '数据库结构异常，已取消导入。');
          const integrity = source.prepare('PRAGMA integrity_check').all();
          if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new RequestError(400, '数据库文件已损坏，已取消导入。');
          const sourceHash = canonicalHash(source);
          if (source.prepare("SELECT value FROM metadata WHERE key='canonicalHash'").get()?.value !== sourceHash || source.prepare("SELECT value FROM metadata WHERE key='appId'").get()?.value !== 'earth-chronicle') throw new RequestError(400, '数据库中的内置历史资料与当前版本不一致，不能导入修改过的只读资料。');
          // Old backups have no reference-region fields. Normalize only those
          // additions after checking the original checksum; all other content
          // must still match, including the entire event text and place data.
          if (historyHash(source, sourceVersion < 4) !== historyHash(db)) throw new RequestError(400, '数据库中的内置历史资料与当前版本不一致，不能导入修改过的只读资料。');
          const metadataKeys = source.prepare('SELECT key FROM metadata').all().map(row => row.key);
          if (metadataKeys.some(key => !['canonicalHash', 'appId'].includes(key) && !(sourceVersion === 3 && isRetiredMetadata(key))) || source.prepare('SELECT count(*) AS count FROM settings').get().count !== 1) throw new RequestError(400, '数据库设置结构异常。');
          const configuration = parseJson(source.prepare("SELECT value FROM settings WHERE key='contentServer'").get()?.value);
          if (typeof configuration.enabled !== 'boolean' || !Number.isInteger(configuration.port) || configuration.port < 1024 || configuration.port > 65535 || Object.keys(configuration).length !== 2) throw new RequestError(400, '数据库内容服务器设置无效。');
          const importedPrefs = validatePreferences(Object.fromEntries(source.prepare('SELECT key,value FROM preferences').all().filter(row => sourceVersion >= 4 || !isRetiredPreference(row.key)).map(row => [row.key, parseJson(row.value)])));
          if (source.prepare('SELECT count(*) AS count FROM user_events').get().count > 100000) throw new RequestError(400, '数据库个人记录数量超过本版支持的范围。');
          const records = source.prepare('SELECT id,payload,created_at,updated_at FROM user_events ORDER BY id');
          const checkedRow = (row) => {
            const payload = parseJson(row.payload);
            if (payload.id !== row.id || !validTimestamp(row.created_at) || !validTimestamp(row.updated_at) || row.updated_at < row.created_at) throw new RequestError(400, '数据库个人记录的标识或时间无效。');
            return { ...row, event: validateEvent(payload, canonicalPlaces, row.id, { persisted: true }) };
          };
          for (const row of records.iterate()) checkedRow(row);
          let imported = 0, updated = 0, skipped = 0;
          db.exec('BEGIN IMMEDIATE');
          try {
            for (const original of records.iterate()) {
              const row = checkedRow(original);
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
        } finally { source?.close(); }
      },
      async importDatabase(bytes) {
        // Compatibility for callers with small in-memory fixtures. HTTP uses
        // importDatabaseFile so large backups never need a whole-file Buffer.
        if (!Buffer.isBuffer(bytes) || bytes.length > MAX_DATABASE_BYTES) throw new RequestError(400, '请选择地球史书导出的 SQLite 数据库。');
        const directory = await mkdtemp(path.join(tmpdir(), 'earthchronicle-import-'));
        try { const file = path.join(directory, 'import.sqlite'); await writeFile(file, bytes); return await this.importDatabaseFile(file); }
        finally { await removeTemporary(directory); }
      },
    };
  } catch (error) { db.close(); throw error; }
}
