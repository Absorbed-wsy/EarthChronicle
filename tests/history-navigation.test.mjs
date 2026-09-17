import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_PERIODS, periodBounds, periodsForCountry, periodsForYear, yearTickLabel } from '../public/history-navigation.js';

test('whole history and recent history extend to the current year without requiring events', () => {
  assert.deepEqual(periodBounds('all', 2026), [-769, 2026]);
  assert.deepEqual(periodBounds('modern', 2026), [1840, 2026]);
  assert.deepEqual(periodBounds('prc', 2027), [1949, 2027]);
  assert.deepEqual(periodBounds('missing', 2026), periodBounds('all', 2026));
  assert.deepEqual(periodBounds('ming', 2026), [1368, 1644]);
  assert.equal(HISTORY_PERIODS.find(period => period.id === 'republic').name, '中华民国');
  assert.deepEqual(periodBounds('republic', 2026), [1912, 1949]);
});

test('foreign and worldwide scopes never use Chinese dynasty or contemporary period metadata', () => {
  assert.equal(periodsForCountry(), HISTORY_PERIODS);
  assert.equal(periodsForCountry('CN'), HISTORY_PERIODS);
  assert.equal(periodsForCountry('CN')[0].name, '全部');
  for (const countryCode of ['all', 'FR', 'US', 'JP']) {
    const periods = periodsForCountry(countryCode);
    assert.deepEqual(periods.map(({ id, name }) => ({ id, name })), [{ id: 'all', name: '全部' }]);
    assert.equal(Object.isFrozen(periods), true);
    assert.equal(Object.isFrozen(periods[0]), true);
    assert.deepEqual(periodBounds('all', 2026, countryCode), [1, 2026]);
    assert.deepEqual(periodBounds('ming', 2026, countryCode), [1, 2026]);
    assert.deepEqual(periodBounds('modern', 2026, countryCode), [1, 2026]);
    assert.deepEqual(periodBounds('missing', 2026, countryCode), [1, 2026]);
    assert.deepEqual(periodsForYear(1421, 2026, countryCode), []);
    assert.deepEqual(periodsForYear(2026, 2026, countryCode), []);
  }
  assert.deepEqual(periodBounds('ming', 2026, 'CN'), [1368, 1644]);
  assert.equal(periodsForYear(1421, 2026, 'CN')[0].id, 'ming');
});

test('BCE bounds and tick labels have no displayed year zero or skipped year', () => {
  assert.deepEqual(periodBounds('qin', 2026), [-220, -205]);
  assert.equal(yearTickLabel(-220), '前221');
  assert.deepEqual([-2, -1, 0, 1, 2].map(yearTickLabel), ['前3', '前2', '前1', '1', '2']);
  assert.equal(yearTickLabel(NaN), '');
  assert.equal(yearTickLabel(1.5), '');
  assert.ok(periodsForYear(0, 2026).some(period => period.id === 'western-han'));
  assert.ok(periodsForYear(1, 2026).some(period => period.id === 'western-han'));
});

test('contemporary regimes and boundary years are retained instead of forced into one timeline', () => {
  const ids = year => periodsForYear(year, 2026).map(period => period.id);
  assert.deepEqual(new Set(ids(1100)), new Set(['song', 'liao', 'xixia']));
  assert.deepEqual(new Set(ids(1200)), new Set(['song', 'jin', 'xixia']));
  assert.deepEqual(new Set(ids(1636)), new Set(['ming', 'qing']));
  assert.deepEqual(new Set(ids(1949)), new Set(['prc', 'republic']));
  assert.equal(ids(1421).includes('ming'), true);
  assert.equal(ids(1645).includes('ming'), false);
  assert.deepEqual(ids(15), ['xin']);
  assert.deepEqual(ids(2027), []);
  assert.deepEqual(ids(NaN), []);
});

test('navigation metadata is immutable, has unique ids and traceable sources', () => {
  assert.equal(new Set(HISTORY_PERIODS.map(period => period.id)).size, HISTORY_PERIODS.length);
  assert.equal(Object.isFrozen(HISTORY_PERIODS), true);
  for (const period of HISTORY_PERIODS) {
    assert.equal(Object.isFrozen(period), true);
    assert.ok(Number.isInteger(period.start));
    assert.ok(period.end === null || period.end >= period.start);
    assert.equal(new URL(period.sourceURL).protocol, 'https:');
  }
  assert.equal(HISTORY_PERIODS.some(period => ['xia', 'shang', 'western-zhou'].includes(period.id)), false);
});
