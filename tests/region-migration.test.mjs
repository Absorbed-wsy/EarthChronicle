import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openChronicleDatabase, validateEvent, validatePreferences } from '../database.mjs';
import { CATEGORIES } from '../public/domain.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const regionKeys = ['countryCode', 'regionCode', 'regionName'];
const personal = { title: '保留个人记录', year: 2026, placeId: 'nanjing', category: '文化', summary: '迁移前的个人内容', sourceTitle: '个人资料', sourceUrl: '' };
const hash = db => createHash('sha256').update(JSON.stringify(db.prepare('SELECT kind,id,payload FROM canonical_records ORDER BY kind,id').all())).digest('hex');
function updateHash(db) { db.prepare("UPDATE metadata SET value=? WHERE key='canonicalHash'").run(hash(db)); }
async function temporary() { return mkdtemp(path.join(tmpdir(), 'earthchronicle-test-regions-')); }
async function clean(directory) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
  assert.ok(path.basename(resolved).startsWith('earthchronicle-test-regions-'));
  await rm(resolved, { recursive: true, force: true });
}
async function oldDatabase(file, version = 4) {
  const database = await openChronicleDatabase({ databasePath: file, publicDir });
  const event = database.saveEvent(personal);
  database.savePreferences({ theme: 'paper', timelineHeight: 204 });
  database.saveContentConfig({ enabled: true, port: 9123 });
  database.close();
  const raw = new DatabaseSync(file);
  try {
    const put = raw.prepare("UPDATE canonical_records SET payload=? WHERE kind='place' AND id=?");
    for (const row of raw.prepare("SELECT id,payload FROM canonical_records WHERE kind='place'").all()) {
      const place = JSON.parse(row.payload);
      for (const key of regionKeys) delete place[key];
      put.run(JSON.stringify(place), row.id);
    }
    if (version === 3) raw.exec('CREATE TABLE science_assets (id TEXT PRIMARY KEY, content_type TEXT NOT NULL, sha256 TEXT NOT NULL, data BLOB NOT NULL) STRICT');
    raw.exec(`PRAGMA user_version=${version}`);
    updateHash(raw);
    return { event, oldHash: hash(raw) };
  } finally { raw.close(); }
}

test('opening an existing database persists modern reference regions without changing events or preferences', async () => {
  const directory = await temporary(); let database;
  try {
    const file = path.join(directory, 'existing.sqlite');
    const { event, oldHash } = await oldDatabase(file);
    database = await openChronicleDatabase({ databasePath: file, publicDir: path.join(directory, 'no-seed-files') });
    const library = database.library();
    assert.equal(library.places.length, 5);
    assert.deepEqual(library.places.filter(place => place.regionCode === 'CN-32').map(place => place.id).sort(), ['nanjing', 'taicang']);
    assert.ok(library.places.every(place => place.countryCode === 'CN' && place.regionName));
    assert.equal(library.places.find(place => place.id === 'beijing').regionCode, 'CN-11');
    assert.equal(library.places.find(place => place.id === 'fengyang').regionName, '安徽省');
    assert.equal(library.places.find(place => place.id === 'xian').regionName, '陕西省');
    assert.deepEqual(library.events.find(item => item.id === event.id), event);
    assert.deepEqual(database.preferences(), { theme: 'paper', timelineHeight: 204 });
    assert.deepEqual(database.contentConfig(), { enabled: true, port: 9123 });
    database.close(); database = null;
    const raw = new DatabaseSync(file, { readOnly: true });
    try {
      assert.notEqual(hash(raw), oldHash);
      assert.equal(raw.prepare("SELECT value FROM metadata WHERE key='canonicalHash'").get().value, hash(raw));
      assert.equal(JSON.parse(raw.prepare("SELECT payload FROM canonical_records WHERE kind='place' AND id='nanjing'").get().payload).regionName, '江苏省');
    } finally { raw.close(); }
    database = await openChronicleDatabase({ databasePath: file, publicDir });
    assert.deepEqual(database.library(), library, 'migration must remain idempotent');
  } finally { database?.close(); await clean(directory); }
});

for (const version of [2, 3, 4]) test(`version ${version} backups without region metadata still import personal records`, async () => {
  const directory = await temporary(); let target;
  try {
    const file = path.join(directory, 'old.sqlite');
    const { event, oldHash } = await oldDatabase(file, version);
    target = await openChronicleDatabase({ databasePath: path.join(directory, 'target.sqlite'), publicDir });
    target.saveContentConfig({ enabled: false, port: 9234 });
    assert.deepEqual(await target.importDatabaseFile(file), { imported: 1, updated: 0, skipped: 0 });
    assert.deepEqual(target.library().events.find(item => item.id === event.id), event);
    assert.deepEqual(target.preferences(), { theme: 'paper', timelineHeight: 204 });
    assert.deepEqual(target.contentConfig(), { enabled: false, port: 9234 });
    const raw = new DatabaseSync(file, { readOnly: true });
    try { assert.equal(hash(raw), oldHash, 'backup must remain untouched'); } finally { raw.close(); }
  } finally { target?.close(); await clean(directory); }
});

test('compatibility normalization still rejects altered region values, coordinates and historical text', async () => {
  const directory = await temporary(); let target;
  try {
    const original = path.join(directory, 'old.sqlite');
    await oldDatabase(original);
    target = await openChronicleDatabase({ databasePath: path.join(directory, 'target.sqlite'), publicDir });
    target.savePreferences({ theme: 'night' });
    for (const [name, kind, id, change] of [
      ['region', 'place', 'nanjing', value => ({ ...value, regionCode: 'CN-11' })],
      ['coordinates', 'place', 'nanjing', value => ({ ...value, lat: 40 })],
      ['history', 'history-event', 'ming-001', value => ({ ...value, summary: '改写历史正文' })],
    ]) {
      const file = path.join(directory, `${name}.sqlite`); await copyFile(original, file);
      const raw = new DatabaseSync(file);
      try {
        const value = JSON.parse(raw.prepare('SELECT payload FROM canonical_records WHERE kind=? AND id=?').get(kind, id).payload);
        raw.prepare('UPDATE canonical_records SET payload=? WHERE kind=? AND id=?').run(JSON.stringify(change(value)), kind, id);
        updateHash(raw);
      } finally { raw.close(); }
      await assert.rejects(target.importDatabaseFile(file), /只读资料/);
      assert.equal(target.counts().personalEvents, 0);
      assert.deepEqual(target.preferences(), { theme: 'night' });
    }
  } finally { target?.close(); await clean(directory); }
});

test('region migration checks the original checksum before changing stored places', async () => {
  const directory = await temporary();
  try {
    const file = path.join(directory, 'bad.sqlite'); await oldDatabase(file);
    let raw = new DatabaseSync(file);
    raw.prepare("UPDATE canonical_records SET payload='{}' WHERE kind='history-event' AND id='ming-001'").run(); raw.close();
    await assert.rejects(openChronicleDatabase({ databasePath: file, publicDir }), /只读资料校验失败/);
    raw = new DatabaseSync(file, { readOnly: true });
    try { assert.equal(JSON.parse(raw.prepare("SELECT payload FROM canonical_records WHERE kind='place' AND id='nanjing'").get().payload).regionCode, undefined); }
    finally { raw.close(); }
  } finally { await clean(directory); }
});

test('event categories match the shared catalogue and layout migration metadata is constrained', () => {
  for (const category of CATEGORIES) assert.equal(validateEvent({ ...personal, category }, new Set(['nanjing'])).category, category);
  assert.throws(() => validateEvent({ ...personal, category: '无效类别' }, new Set(['nanjing'])), /有效的事件类型/);
  for (const layoutVersion of [1, 2, 3, 4, 5]) assert.deepEqual(validatePreferences({ layoutVersion, timelineHeight: 96 }), { layoutVersion, timelineHeight: 96 });
  for (const timelineHeight of [88, 124, 156, 300]) assert.deepEqual(validatePreferences({ timelineHeight }), { timelineHeight });
  for (const timelineHeight of [87, 301]) assert.throws(() => validatePreferences({ timelineHeight }), /显示设置.*无效/);
  for (const layoutVersion of [0, 6, 1.5, '2', null]) assert.throws(() => validatePreferences({ layoutVersion }), /显示设置.*无效/);
});
