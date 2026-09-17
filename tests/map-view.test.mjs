import test from 'node:test';
import assert from 'node:assert/strict';
import { globeFitZoom, historyFeatures, initMapView, mapPixelRatio, placeZoom } from '../public/map-view.js';

test('globe overview enlarges ordinary windows and adapts to narrow or short map areas', () => {
  assert.ok(globeFitZoom(900, 700) > 1.6);
  assert.ok(globeFitZoom(350, 700) < globeFitZoom(900, 700));
  assert.ok(globeFitZoom(1000, 320) < globeFitZoom(900, 700));
  assert.ok(Math.abs(globeFitZoom(1800, 1400) - globeFitZoom(900, 700) - 1) < 1e-10);
  assert.equal(globeFitZoom(0, 0), 1.6);
  assert.ok(Number.isFinite(globeFitZoom(80, 700)));
});

test('map drawing respects high-DPI quality and large-window pixel budgets', () => {
  assert.equal(mapPixelRatio('auto', 2, 1000, 700), 2);
  assert.equal(mapPixelRatio('high', 3, 1000, 700), 3);
  assert.equal(mapPixelRatio('smooth', 3, 1000, 700), 1);
  assert.equal(mapPixelRatio('auto', 3, 1000, 700, true), 1.5);
  for (const [quality, budget] of [['auto', 8e6], ['high', 12e6], ['smooth', 4e6]]) {
    const ratio = mapPixelRatio(quality, 3, 3840, 2160);
    assert.ok(ratio * ratio * 3840 * 2160 <= budget + 1);
  }
});

test('city navigation chooses useful detail and never zooms out from a closer view', () => {
  assert.ok(placeZoom({ class: 'country' }) < placeZoom({ class: 'city' }));
  assert.ok(placeZoom({ class: 'city' }) < placeZoom({ class: 'village' }));
  assert.equal(placeZoom({ class: 'city' }, 14), 15);
  assert.equal(placeZoom({ class: 'city' }, 19), 19);
});

test('history GeoJSON preserves event counts and selections without accepting invalid coordinates', () => {
  const data = historyFeatures([
    { id: 'a', name: '南京', lon: 118.8, lat: 32.1 },
    { id: 'b', name: '北京', lon: 116.4, lat: 39.9 },
    { id: 'invalid', name: '未知', lon: 'not-a-coordinate', lat: 3 },
  ], { selectedPlaceId: 'b', counts: new Map([['a', 2]]) });
  assert.equal(data.features.length, 2);
  assert.deepEqual(data.features[0].geometry.coordinates, [118.8, 32.1]);
  assert.equal(data.features[0].properties.label, '南京 · 2');
  assert.equal(data.features[1].properties.selected, true);
  assert.equal(data.features[1].properties.label, '北京');
});

function fixture() {
  const nodes = new Map();
  const stage = { dataset: {} };
  const node = () => ({
    clientWidth: 900, clientHeight: 700, style: {}, handlers: new Map(), setAttribute() {},
    addEventListener(event, handler) { this.handlers.set(event, handler); },
    removeEventListener(event) { this.handlers.delete(event); },
    dispatchInput(event) { this.handlers.get(event)?.(); },
    querySelector: () => ({ style: {} }), closest: () => stage,
  });
  for (const id of ['globe', 'map-projection', 'north-view', 'map-tilt']) nodes.set(id, node());
  class FakeMap {
    constructor(options) {
      this.handlers = new Map(); this.sources = new Map(); this.canvas = node();
      this.center = options.center; this.zoom = options.zoom; this.pitch = 0; this.bearing = 0; this.options = options;
      this.setStyle(options.style);
    }
    on(event, fn) { const all = this.handlers.get(event) || []; all.push(fn); this.handlers.set(event, all); }
    off(event, fn) { this.handlers.set(event, (this.handlers.get(event) || []).filter(value => value !== fn)); }
    async emit(event, value = {}) { for (const fn of this.handlers.get(event) || []) await fn(value); }
    setStyle(style) { this.currentStyle = structuredClone(style); this.sources = new Map(Object.entries(style.sources || {}).map(([id, source]) => [id, { ...source, setData(data) { this.data = data; } }])); this.terrain = style.terrain; }
    getStyle() { return this.currentStyle; }
    getSource(id) { return this.sources.get(id); }
    isSourceLoaded() { return this.sourceLoaded !== false; }
    addSource(id, value) { this.sources.set(id, { ...value, setData(data) { this.data = data; }, getClusterExpansionZoom: async () => 7 }); }
    getLayer(id) { return this.currentStyle.layers.find(layer => layer.id === id); }
    addLayer(layer) { this.currentStyle.layers.push(layer); }
    setLayoutProperty(id, key, value) { const layer = this.getLayer(id); layer.layout = { ...layer.layout, [key]: value }; }
    setPixelRatio(ratio) { this.pixelRatio = ratio; }
    getBearing() { return this.bearing; }
    getPitch() { return this.pitch; }
    getZoom() { return this.zoom; }
    getTerrain() { return this.terrain; }
    setTerrain(value) { this.terrain = value; }
    getCanvas() { return this.canvas; }
    project() { return this.projectedPoint || { x: 80, y: 90 }; }
    queryRenderedFeatures() { return this.features || []; }
    flyTo(value) { this.flight = value; this.zoom = value.zoom; this.center = value.center; }
    easeTo(value) { Object.assign(this, value); }
    jumpTo(value) { Object.assign(this, value); }
    setProjection(value) { this.projection = value; }
    stop() {}
    resize() {}
    remove() { this.removed = true; }
    zoomIn() { this.zoom++; }
    zoomOut() { this.zoom--; }
  }
  const old = { window: globalThis.window, document: globalThis.document, matchMedia: globalThis.matchMedia };
  globalThis.window = { maplibregl: { Map: FakeMap }, devicePixelRatio: 2, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { documentElement: { dataset: { theme: 'light' } }, getElementById: id => nodes.get(id) };
  globalThis.matchMedia = () => ({ matches: true });
  return { nodes, maplibregl: { Map: FakeMap }, restore() { for (const [key, value] of Object.entries(old)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } };
}

test('clicking a base-map city flies to it, while history points keep the history selection callback', async () => {
  const environment = fixture(); let picked;
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' }, onHistoryPlace: id => { picked = id; } });
  const map = controller.map;
  try {
    controller.setHistoryPlaces([{ id: 'nanjing', name: '南京', lon: 118.8, lat: 32.1 }], { labels: false, selectedPlaceId: 'nanjing' });
    await map.emit('style.load');
    map.features = [{ source: 'base-places', geometry: { type: 'Point', coordinates: [2.35, 48.85] }, properties: { name: 'Paris', class: 'city' }, layer: { id: 'base-place-city', type: 'symbol', metadata: { 'earthchronicle:place': true } } }];
    await map.emit('click', { point: { x: 80, y: 90 } });
    assert.deepEqual(map.flight.center, [2.35, 48.85]);
    assert.equal(map.flight.zoom, 11);
    assert.equal(map.flight.duration, 0);
    assert.equal(picked, undefined);
    map.features = [{ source: 'chronicle-history', properties: { placeId: 'nanjing' }, geometry: { type: 'Point', coordinates: [118.8, 32.1] } }];
    await map.emit('click', { point: { x: 80, y: 90 } });
    assert.equal(picked, 'nanjing');
    assert.deepEqual(map.flight.center, [118.8, 32.1]);
    assert.equal(map.getLayer('history-labels').layout.visibility, 'none');
    controller.setTheme('night');
    await map.emit('style.load');
    assert.equal(map.getSource('chronicle-history').data.features[0].properties.selected, true);
    assert.equal(map.getLayer('history-labels').layout.visibility, 'none');
  } finally { controller.destroy(); environment.restore(); }
});

test('map picking uses the clicked coordinate before any history or base-place navigation', async () => {
  const environment = fixture(), picks = [], historical = [];
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' }, onPickPoint: value => picks.push(value), onHistoryPlace: id => historical.push(id) });
  const map = controller.map;
  try {
    await map.emit('style.load');
    map.features = [
      { source: 'chronicle-history', properties: { placeId: 'a' }, geometry: { type: 'Point', coordinates: [2.35, 48.85] } },
      { source: 'base-places', geometry: { type: 'Point', coordinates: [2.35, 48.85] }, properties: { name: 'Paris', 'name:zh': '巴黎', class: 'city', country_code: 'FR' }, layer: { id: 'base-place-cities', type: 'symbol', metadata: { 'earthchronicle:place': true } } },
    ];
    controller.setPicking(true);
    assert.equal(map.getCanvas().style.cursor, 'crosshair');
    await map.emit('mousemove', { point: { x: 80, y: 90 } });
    await map.emit('mouseout');
    assert.equal(map.getCanvas().style.cursor, 'crosshair');
    await map.emit('click', { point: { x: 80, y: 90 }, lngLat: { lng: 2.36, lat: 48.86 }, originalEvent: { button: 0 } });
    assert.deepEqual(picks, [{ lon: 2.36, lat: 48.86, name: '巴黎', countryCode: 'FR' }]);
    assert.deepEqual(historical, []);
    assert.equal(map.flight, undefined);
    assert.equal(map.getSource('chronicle-draft').data.features.length, 0, 'the callback decides whether to display or save a draft');

    controller.setPicking(false);
    assert.equal(map.getCanvas().style.cursor, '');
    await map.emit('mousemove', { point: { x: 80, y: 90 } });
    assert.equal(map.getCanvas().style.cursor, 'pointer');
    await map.emit('click', { point: { x: 80, y: 90 } });
    assert.deepEqual(historical, ['a']);
    assert.deepEqual(map.flight.center, [2.35, 48.85]);
    assert.equal(picks.length, 1);
  } finally { controller.destroy(); environment.restore(); }
});

test('delayed cluster expansion cannot replace a newer navigation or interrupt point picking', async () => {
  for (const action of ['place','zoom','pick','pointer','click']) {
    const environment = fixture();
    const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' } });
    const map = controller.map;
    try {
      await map.emit('style.load');
      let resolveZoom;
      map.getSource('chronicle-history').getClusterExpansionZoom = () => new Promise(resolve => { resolveZoom = resolve; });
      map.features = [{ source: 'chronicle-history', properties: { cluster: true, cluster_id: 1 }, geometry: { type: 'Point', coordinates: [118.8, 32.1] } }];
      const expanding = map.emit('click', { point: { x: 80, y: 90 } });
      if (action === 'place') controller.flyPlace({ lon: 2.35, lat: 48.85 });
      if (action === 'zoom') controller.zoomIn();
      if (action === 'pick') controller.setPicking(true);
      if (action === 'pointer') map.getCanvas().dispatchInput('pointerdown');
      if (action === 'click') { map.features = []; await map.emit('click', { point: { x: 90, y: 90 } }); }
      const currentFlight = map.flight, currentZoom = map.zoom;
      resolveZoom(8);await expanding;
      assert.equal(map.flight, currentFlight, action);
      assert.equal(map.zoom, currentZoom, action);
      if (action === 'pick') assert.equal(map.getCanvas().style.cursor, 'crosshair');
    } finally { controller.destroy(); environment.restore(); }
  }
});

test('map picking ignores sky, invalid coordinates, right clicks and a rebuilding map', async () => {
  const environment = fixture(), picks = [];
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' }, onPickPoint: value => picks.push(value) });
  const map = controller.map, point = { x: 80, y: 90 };
  try {
    controller.setPicking(true);
    await map.emit('click', { point, lngLat: { lng: 2.35, lat: 48.85 } });
    await map.emit('style.load');
    for (const lngLat of [undefined, null, { lng: NaN, lat: 20 }, { lng: 20, lat: Infinity }, { lng: 181, lat: 20 }, { lng: 20, lat: -91 }, { lng: '2.35', lat: 48.85 }]) {
      await map.emit('click', { point, lngLat });
    }
    await map.emit('click', { point, lngLat: { lng: 2.35, lat: 48.85 }, originalEvent: { button: 2 } });
    await map.emit('click', { point: { x: NaN, y: 90 }, lngLat: { lng: 2.35, lat: 48.85 } });
    map.projectedPoint = { x: 95, y: 90 };
    await map.emit('click', { point, lngLat: { lng: 2.35, lat: 48.85 } });
    map.projectedPoint = { x: Infinity, y: 90 };
    await map.emit('click', { point, lngLat: { lng: 2.35, lat: 48.85 } });
    assert.deepEqual(picks, []);

    map.projectedPoint = point;
    controller.toggleProjection();
    await map.emit('click', { point, lngLat: { lng: 2.35, lat: 48.85 } });
    assert.deepEqual(picks, [{ lon: 2.35, lat: 48.85 }]);
    controller.setTheme('night');
    await map.emit('click', { point, lngLat: { lng: 2.35, lat: 48.85 } });
    assert.equal(picks.length, 1);
  } finally { controller.destroy(); environment.restore(); }
});

test('draft markers survive theme changes and edits without altering historical places', async () => {
  const environment = fixture();
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' } });
  const map = controller.map;
  try {
    const places = [{ id: 'a', name: '南京', lon: 118.8, lat: 32.1 }];
    controller.setHistoryPlaces(places, { selectedPlaceId: 'a' });
    assert.equal(controller.setDraftPoint({ lon: 118.81, lat: 32.11 }), true);
    await map.emit('style.load');
    assert.deepEqual(map.getSource('chronicle-draft').data.features[0].geometry.coordinates, [118.81, 32.11]);
    assert.deepEqual(map.getSource('chronicle-history').data, historyFeatures(places, { selectedPlaceId: 'a' }));
    assert.equal(map.getLayer('draft-point').source, 'chronicle-draft');
    assert.equal(map.getStyle().layers.at(-1).id, 'draft-point');

    controller.setTheme('night');
    await map.emit('style.load');
    assert.deepEqual(map.getSource('chronicle-draft').data.features[0].geometry.coordinates, [118.81, 32.11]);
    assert.notEqual(map.getLayer('draft-point-halo').paint['circle-color'], map.getLayer('draft-point').paint['circle-color']);
    assert.equal(controller.setDraftPoint({ lon: 116.4, lat: 39.9 }), true);
    assert.equal(controller.setDraftPoint({ lon: 181, lat: 39.9 }), false);
    assert.equal(controller.setDraftPoint({ lon: 0, lat: 89 }), false);
    assert.deepEqual(map.getSource('chronicle-draft').data.features[0].geometry.coordinates, [116.4, 39.9]);
    controller.setPicking(true);
    controller.setPicking(false);
    assert.equal(map.getSource('chronicle-draft').data.features.length, 1, 'closing picking retains the point while its form is open');
    controller.setDraftPoint(null);
    assert.deepEqual(map.getSource('chronicle-draft').data.features, []);
    assert.deepEqual(map.getSource('chronicle-history').data, historyFeatures(places, { selectedPlaceId: 'a' }));
    controller.setTheme('light');
    await map.emit('style.load');
    assert.deepEqual(map.getSource('chronicle-draft').data.features, []);
  } finally { controller.destroy(); environment.restore(); }
});

test('polar picks report the map layer latitude limit instead of moving the chosen point', async () => {
  const environment = fixture(), picks = [], notices = [];
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' }, onPickPoint: value => picks.push(value), onNotice: value => notices.push(value) });
  const map = controller.map;
  try {
    await map.emit('style.load');
    controller.setPicking(true);
    for (const lat of [-89, 89]) await map.emit('click', { point: { x: 80, y: 90 }, lngLat: { lng: 0, lat } });
    assert.deepEqual(picks, []);
    assert.deepEqual(notices, ['该纬度暂不支持事件标记', '该纬度暂不支持事件标记']);
    await map.emit('click', { point: { x: 80, y: 90 }, lngLat: { lng: 0, lat: 85 } });
    assert.deepEqual(picks, [{ lon: 0, lat: 85 }]);
  } finally { controller.destroy(); environment.restore(); }
});

test('overview fits on resize but preserves deliberate navigation until home is requested', async () => {
  const environment = fixture();
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' } });
  const map = controller.map, element = environment.nodes.get('globe');
  try {
    assert.equal(map.getZoom(), globeFitZoom(900, 700));
    element.clientWidth = 350;
    controller.resize();
    assert.equal(map.getZoom(), globeFitZoom(350, 700));

    controller.zoomIn();
    const zoomed = map.getZoom();
    element.clientWidth = 900;
    controller.resize();
    assert.equal(map.getZoom(), zoomed);

    controller.home();
    assert.deepEqual(map.flight.center, [111, 29]);
    assert.equal(map.getZoom(), globeFitZoom(900, 700));
    element.clientHeight = 400;
    controller.resize();
    assert.equal(map.getZoom(), globeFitZoom(900, 400));

    map.getCanvas().dispatchInput('wheel');
    await map.emit('movestart');
    map.zoom = 6;
    element.clientHeight = 600;
    controller.resize();
    assert.equal(map.getZoom(), 6);

    controller.home();
    controller.flyPlace({ lon: 118.8, lat: 32.1 });
    element.clientWidth = 700;
    controller.resize();
    assert.equal(map.getZoom(), 11);
    assert.deepEqual(map.center, [118.8, 32.1]);
  } finally { controller.destroy(); environment.restore(); }
});

test('flat view disables terrain and restores the chosen terrain setting when returning to globe', async () => {
  const environment = fixture();
  const controller = initMapView({ maplibregl: environment.maplibregl }); const map = controller.map;
  try {
    await map.emit('style.load');
    assert.ok(map.getTerrain());
    controller.toggleProjection();
    assert.equal(controller.isFlat(), true);
    assert.equal(map.getTerrain(), null);
    assert.equal(environment.nodes.get('map-tilt').disabled, true);
    controller.setTheme('night');
    await map.emit('style.load');
    assert.equal(controller.isFlat(), true);
    assert.ok(!map.getTerrain());
    controller.toggleProjection();
    assert.equal(controller.isFlat(), false);
    assert.equal(map.getTerrain()?.source, 'terrain');
    controller.applyPreferences({ mapTerrain: false });
    await map.emit('style.load');
    assert.ok(!map.getTerrain());
    controller.toggleProjection(); controller.toggleProjection();
    assert.ok(!map.getTerrain());
  } finally { controller.destroy(); environment.restore(); }
});

test('online tiles replace base labels only after the visible source finishes, and failures retain the base', async () => {
  const environment = fixture();
  const controller = initMapView({ maplibregl: environment.maplibregl }); const map = controller.map;
  try {
    await map.emit('style.load');
    assert.equal(map.getLayer('online-background').layout.visibility, 'none');
    map.sourceLoaded = false;
    await map.emit('sourcedata', { sourceId: 'openmaptiles', sourceDataType: 'content' });
    assert.equal(map.getLayer('base-place-cities').layout.visibility, 'visible');
    map.sourceLoaded = true;
    await map.emit('sourcedata', { sourceId: 'openmaptiles', sourceDataType: 'content' });
    assert.equal(map.getLayer('online-background').layout.visibility, 'visible');
    assert.equal(map.getLayer('base-place-cities').layout.visibility, 'none');
    controller.setLabels(false); controller.setLabels(true);
    assert.equal(map.getLayer('base-place-cities').layout.visibility, 'none');
    map.sourceLoaded = false;
    await map.emit('sourcedataloading', { sourceId: 'openmaptiles' });
    assert.equal(map.getLayer('online-background').layout.visibility, 'none');
    assert.equal(map.getLayer('base-place-cities').layout.visibility, 'visible');
    await map.emit('error', { sourceId: 'openmaptiles' });
    map.sourceLoaded = true;
    await map.emit('sourcedata', { sourceId: 'openmaptiles', sourceDataType: 'content' });
    assert.equal(map.getLayer('online-background').layout.visibility, 'none');
  } finally { controller.destroy(); environment.restore(); }
});
