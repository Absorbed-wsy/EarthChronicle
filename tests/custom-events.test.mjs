import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChronicleDatabase, SCHEMA_VERSION } from '../database.mjs';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const base = { title: '遗址考察', year: 1405, category: '文化', summary: '现场相关资料。', sourceTitle: '个人记录', sourceUrl: '' };
const point = { name: '遗址', lon: 118.792, lat: 32.04, countryCode: 'CN', cityId: 'nanjing' };
const freePoint = { name: '自由地点', lon: 2.3522, lat: 48.8566, countryCode: 'FR', regionName: '法兰西岛', cityName: '巴黎' };
const input = location => ({ ...base, location });
const hashCanonical = db => createHash('sha256').update(JSON.stringify(db.prepare('SELECT kind,id,payload FROM canonical_records ORDER BY kind,id').all())).digest('hex');
const personal = db => db.library().events.filter(event => event.userCreated);
const customPlaces = db => db.library().places.filter(place => place.isCustom);
const reject = action => assert.throws(action, error => error.status === 400);

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'earthchronicle-test-custom-'));
  const databases = [], exports = [];
  t.after(async () => {
    for (const database of databases.reverse()) database.close();
    for (const exported of exports) await exported.cleanup();
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('earthchronicle-test-custom-'));
    await rm(resolved, { recursive: true, force: true });
  });
  return {
    directory,
    async open(name = 'database') {
      const db = await openChronicleDatabase({ databasePath: path.join(directory, `${name}.sqlite`), publicDir });
      databases.push(db); return db;
    },
    close(db) { databases.splice(databases.indexOf(db), 1); db.close(); },
    async backup(db) { const exported = await db.exportDatabase(); exports.push(exported); return exported.file; },
  };
}

test('map points belong to individual events and edits retain IDs without changing their shared city', async t => {
  const f = await fixture(t), db = await f.open();
  const originalPlaces = db.library().places;
  const first = db.saveEvent(input({ ...point, countryCode: 'cn', name: ' 遗址甲 ', regionName: '忽略', cityName: '忽略' }));
  const second = db.saveEvent(input({ ...point, name: '遗址乙', lon: 118.8 }));
  assert.equal(first.placeId, `user-place-${first.id}`);
  assert.equal(first.location.name, '遗址甲');
  assert.equal(first.location.countryCode, 'CN');
  assert.equal(first.location.regionCode, 'CN-32');
  assert.equal(first.location.regionName, '江苏省');
  assert.equal(first.location.cityId, 'nanjing');
  assert.equal(first.location.cityName, '南京');
  assert.notEqual(first.placeId, second.placeId);
  assert.deepEqual(db.library().places.filter(place => !place.isCustom), originalPlaces);
  assert.ok(customPlaces(db).every(place => place.userCreated));
  const edited = db.saveEvent({ ...base, title: '更新后的遗址', location: { ...point, lon: 119, lat: 33 } }, first.id);
  assert.equal(edited.id, first.id); assert.equal(edited.placeId, first.placeId);
  assert.equal(edited.createdAt, first.createdAt); assert.ok(edited.updatedAt > first.updatedAt);
  assert.equal(customPlaces(db).find(place => place.id === first.placeId).lon, 119);
  assert.equal(customPlaces(db).find(place => place.id === second.placeId).lon, 118.8);
  db.deleteEvent(first.id);
  assert.deepEqual(customPlaces(db).map(place => place.id), [second.placeId]);
  db.deleteEvent(second.id); assert.deepEqual(customPlaces(db), []);
});

test('free locations have stable searchable region/city IDs and may omit a city', async t => {
  const f = await fixture(t), db = await f.open();
  const first = db.saveEvent(input(freePoint));
  const second = db.saveEvent(input({ ...freePoint, name: '另一地点', lon: 2.4 }));
  assert.ok(first.location.regionCode.startsWith('FR:region:'));
  assert.ok(first.location.cityId.startsWith('FR:city:'));
  assert.equal(first.location.cityId, second.location.cityId);
  assert.equal(first.location.regionCode, second.location.regionCode);
  const regional = db.saveEvent(input({ name: '江苏遗址', lon: 119, lat: 32, countryCode: 'CN', regionName: '江苏省', cityName: '测试城市' }));
  assert.equal(regional.location.regionCode, 'CN-32', 'an existing reference region stays searchable as one region');
  const remote = db.saveEvent(input({ name: '野外遗址', lon: -180, lat: -90, countryCode: 'CN' }));
  assert.equal(remote.location.cityId, ''); assert.equal(remote.location.cityName, '');
  assert.equal(remote.location.regionCode, '');
  const normalized = db.saveEvent(input({ ...freePoint, regionName: ' Ａ ', cityName: 'Ｂ' }));
  const normalizedAgain = db.saveEvent(input({ ...freePoint, regionName: 'a', cityName: 'b' }));
  assert.equal(normalized.location.cityId, normalizedAgain.location.cityId);
});

test('legacy city-based personal events remain editable and can be moved to their own point', async t => {
  const f = await fixture(t), db = await f.open();
  const legacy = db.saveEvent({ ...base, placeId: 'nanjing' });
  assert.equal(legacy.location, undefined); assert.equal(customPlaces(db).length, 0);
  const changed = db.saveEvent({ ...base, placeId: 'beijing', title: '旧事件编辑' }, legacy.id);
  assert.equal(changed.placeId, 'beijing');
  const moved = db.saveEvent(input(point), legacy.id);
  assert.equal(moved.id, legacy.id); assert.equal(customPlaces(db).length, 1);
  const restored = db.saveEvent({ ...base, placeId: 'nanjing' }, legacy.id);
  assert.equal(restored.location, undefined); assert.equal(customPlaces(db).length, 0);
});

test('location, text and source validation rejects malformed data without saving partial events', async t => {
  const f = await fixture(t), db = await f.open();
  for (const location of [null, [], 'location', {},
    ...[NaN, Infinity, '118', null, 181, -181].map(lon => ({ ...point, lon })),
    ...[NaN, Infinity, '32', null, 91, -91].map(lat => ({ ...point, lat })),
    ...['', 'all', 'C1', '中国', 12].map(countryCode => ({ ...point, countryCode })),
    ...['', 'x'.repeat(161), 'name\0', '\ud800'].map(name => ({ ...point, name })),
    { ...point, regionName: 'x'.repeat(101) }, { ...point, cityName: [] },
    { ...point, cityId: 'missing' }, { ...point, countryCode: 'FR' },
  ]) reject(() => db.saveEvent(input(location)));
  for (const sourceUrl of ['javascript:alert(1)', 'ftp://example.com', 'https://user:secret@example.com', 'invalid']) reject(() => db.saveEvent({ ...input(point), sourceUrl }));
  for (const sourceTitle of ['', 'x'.repeat(301)]) reject(() => db.saveEvent({ ...input(point), sourceTitle }));
  reject(() => db.saveEvent({ ...input(point), summary: '' }));
  reject(() => db.saveEvent({ ...input(point), category: '自定义' }));
  assert.equal(personal(db).length, 0); assert.equal(customPlaces(db).length, 0);
});

test('personal point IDs cannot reference another event or change built-in records', async t => {
  const f = await fixture(t), db = await f.open();
  const event = db.saveEvent(input(point));
  reject(() => db.saveEvent({ ...base, placeId: event.placeId }));
  reject(() => db.saveEvent(input({ ...point, cityId: event.placeId })));
  const free = db.saveEvent(input(freePoint));
  reject(() => db.saveEvent(input(free.location)));
  for (const id of ['ming-001', 'nanjing']) {
    assert.throws(() => db.saveEvent(input(point), id), error => error.status === 403);
    assert.throws(() => db.deleteEvent(id), error => error.status === 403);
  }
  assert.throws(() => db.saveEvent(input(point), 'user-missing'), error => error.status === 404);
  const other = db.saveEvent({ ...input({ ...point, isCustom: false, userCreated: false }), placeId: event.placeId, id: event.id });
  assert.notEqual(other.id, event.id); assert.notEqual(other.placeId, event.placeId);
  assert.ok(customPlaces(db).every(place => place.isCustom && place.userCreated));
});

test('personal events accept BCE astronomical years and reject invalid ranges', async t => {
  const f = await fixture(t), db = await f.open();
  for (const year of [-9998, -770, 0, 1, 9999]) assert.equal(db.saveEvent({ ...input(point), year }).year, year);
  const acrossEra = db.saveEvent({ ...input(point), year: -1, endYear: 1 });
  assert.equal(acrossEra.endYear, 1);
  for (const year of [-9999, 10000, 1.5, '1', NaN]) reject(() => db.saveEvent({ ...input(point), year }));
  for (const endYear of [-2, 10000, 1.5, '1']) reject(() => db.saveEvent({ ...input(point), year: -1, endYear }));
});

test('version 5 backups preserve free locations, city links, sources and updates', async t => {
  const f = await fixture(t), source = await f.open('source'), target = await f.open('target');
  const fixed = source.saveEvent({ ...input(point), sourceTitle: '资料页', sourceUrl: 'https://example.com/source' });
  const free = source.saveEvent(input(freePoint));
  const legacy = source.saveEvent({ ...base, placeId: 'beijing' });
  source.savePreferences({ theme: 'paper' });
  const file = await f.backup(source), raw = new DatabaseSync(file, { readOnly: true });
  assert.equal(raw.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION); raw.close();
  assert.deepEqual(await target.importDatabaseFile(file), { imported: 3, updated: 0, skipped: 0 });
  assert.deepEqual(personal(target), personal(source)); assert.deepEqual(customPlaces(target), customPlaces(source));
  assert.equal(personal(target).find(event => event.id === fixed.id).sources[0].url, 'https://example.com/source');
  assert.equal(personal(target).find(event => event.id === legacy.id).location, undefined);
  assert.deepEqual(await target.importDatabaseFile(file), { imported: 0, updated: 0, skipped: 3 });
  const changed = source.saveEvent(input({ ...freePoint, cityName: '新城市', lon: 4 }), free.id);
  assert.deepEqual(await target.importDatabaseFile(await f.backup(source)), { imported: 0, updated: 1, skipped: 2 });
  assert.deepEqual(personal(target).find(event => event.id === free.id), changed);
  assert.equal(customPlaces(target).filter(place => place.id === free.placeId).length, 1);
  assert.equal(customPlaces(target).find(place => place.id === free.placeId).cityName, '新城市');
});

test('version 4 databases open and import without changing existing personal records or settings', async t => {
  const f = await fixture(t), source = await f.open('old');
  const event = source.saveEvent({ ...base, placeId: 'nanjing' });
  source.savePreferences({ theme: 'night' }); source.saveContentConfig({ enabled: true, port: 9138 });
  f.close(source);
  const file = path.join(f.directory, 'old.sqlite'), raw = new DatabaseSync(file);
  raw.exec('PRAGMA user_version=4'); raw.close();
  const oldCopy = path.join(f.directory, 'old-copy.sqlite'); await copyFile(file, oldCopy);
  const opened = await f.open('old');
  assert.equal(opened.counts().schemaVersion, 5); assert.deepEqual(personal(opened), [event]);
  assert.deepEqual(opened.preferences(), { theme: 'night' }); assert.deepEqual(opened.contentConfig(), { enabled: true, port: 9138 });
  const target = await f.open('target');
  assert.deepEqual(await target.importDatabaseFile(oldCopy), { imported: 1, updated: 0, skipped: 0 });
  assert.deepEqual(personal(target), [event]); assert.equal(target.contentConfig().enabled, false);
});

test('invalid imported points abort the entire merge and retain the local library and preferences', async t => {
  const f = await fixture(t), source = await f.open('source'), target = await f.open('target');
  source.saveEvent(input(point)); source.saveEvent(input(freePoint)); source.savePreferences({ theme: 'paper' });
  target.saveEvent({ ...base, title: '保留的本地记录', placeId: 'beijing' }); target.savePreferences({ theme: 'night' });
  const before = target.library(), backup = await f.backup(source);
  for (const [label, change] of [
    ['coordinate', event => { event.location.lon = 181; }],
    ['country-city', event => { event.location.countryCode = 'FR'; event.location.cityId = 'nanjing'; }],
    ['place-id', event => { event.placeId = 'user-place-user-other'; }],
    ['city-id', event => { event.location.cityId = 'FR:city:forged'; }],
    ['url', event => { event.sourceUrl = 'javascript:alert(1)'; }],
  ]) {
    const file = path.join(f.directory, `${label}.sqlite`); await copyFile(backup, file);
    const raw = new DatabaseSync(file), row = raw.prepare('SELECT id,payload FROM user_events ORDER BY id DESC LIMIT 1').get();
    const event = JSON.parse(row.payload); change(event);
    raw.prepare('UPDATE user_events SET payload=? WHERE id=?').run(JSON.stringify(event), row.id); raw.close();
    await assert.rejects(target.importDatabaseFile(file), error => error.status === 400);
    assert.deepEqual(target.library(), before); assert.deepEqual(target.preferences(), { theme: 'night' });
  }
});

test('version 4 and 5 imports still reject canonical changes even when their hashes are recalculated', async t => {
  const f = await fixture(t), source = await f.open('source'), target = await f.open('target');
  source.saveEvent(input(point)); const backup = await f.backup(source);
  for (const version of [4, 5]) {
    const file = path.join(f.directory, `canonical-${version}.sqlite`); await copyFile(backup, file);
    const raw = new DatabaseSync(file);
    raw.prepare('INSERT INTO canonical_records(kind,id,payload) VALUES (?,?,?)').run('geology-test', 'unexpected', '{}');
    raw.prepare("UPDATE metadata SET value=? WHERE key='canonicalHash'").run(hashCanonical(raw));
    raw.exec(`PRAGMA user_version=${version}`); raw.close();
    await assert.rejects(target.importDatabaseFile(file), /只读资料/);
    assert.equal(target.counts().personalEvents, 0);
  }
});
