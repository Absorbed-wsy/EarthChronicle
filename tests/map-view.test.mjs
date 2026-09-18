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
  assert.equal(mapPixelRatio('auto', 1.5, 1000, 700), 1.5);
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

function fixture({ reducedMotion = true, resizeOnPixelRatio = false, dpr = 2, stopEmitsMoveEnd = false, cameraEmitsMoveStart = false } = {}) {
  const nodes = new Map();
  const stage = { dataset: {} };
  const node = () => ({
    clientWidth: 900, clientHeight: 700, style: {}, arrow: { style: {} }, handlers: new Map(), attributeWrites: 0,
    setAttribute() { this.attributeWrites++; },
    addEventListener(event, handler) { this.handlers.set(event, handler); },
    removeEventListener(event) { this.handlers.delete(event); },
    dispatchInput(event) { this.handlers.get(event)?.(); },
    querySelector() { return this.arrow; }, closest: () => stage,
  });
  for (const id of ['globe', 'map-projection', 'north-view', 'map-tilt']) nodes.set(id, node());
  const source = value => ({ ...value, dataWrites: 0, setData(data) { this.data = data; this.dataWrites++; } });
  class FakeMap {
    constructor(options) {
      this.handlers = new Map(); this.sources = new Map(); this.canvas = node(); this.pixelRatioChanges = []; this.cameraPixelRatios = []; this.layoutWrites = []; this.canvasResizes = 0; this.moving = false;
      this.center = options.center; this.zoom = options.zoom; this.pitch = 0; this.bearing = 0; this.options = options; this.pixelRatio = options.pixelRatio;
      this.setStyle(options.style);
    }
    on(event, fn) { const all = this.handlers.get(event) || []; all.push(fn); this.handlers.set(event, all); }
    off(event, fn) { this.handlers.set(event, (this.handlers.get(event) || []).filter(value => value !== fn)); }
    async emit(event, value = {}) { if (event === 'movestart' || event === 'moveend') this.moving = event === 'movestart'; for (const fn of this.handlers.get(event) || []) await fn(value); }
    emitSync(event, value = {}) { if (event === 'movestart' || event === 'moveend') this.moving = event === 'movestart'; for (const fn of this.handlers.get(event) || []) fn(value); }
    setStyle(style) { this.currentStyle = structuredClone(style); this.sources = new Map(Object.entries(style.sources || {}).map(([id, value]) => [id, source(value)])); this.terrain = style.terrain; }
    getStyle() { return this.currentStyle; }
    getSource(id) { return this.sources.get(id); }
    isSourceLoaded() { return this.sourceLoaded !== false; }
    isMoving() { return this.moving; }
    addSource(id, value) { this.sources.set(id, { ...source(value), getClusterExpansionZoom: async () => 7 }); }
    getLayer(id) { return this.currentStyle.layers.find(layer => layer.id === id); }
    addLayer(layer) { this.currentStyle.layers.push(layer); }
    setLayoutProperty(id, key, value) { const layer = this.getLayer(id); layer.layout = { ...layer.layout, [key]: value }; this.layoutWrites.push({ id, key, value }); }
    setPixelRatio(ratio) {
      this.pixelRatio = ratio; this.pixelRatioChanges.push(ratio); this.canvasResizes++;
      // MapLibre's setPixelRatio resizes the canvas, which synchronously reports
      // synthetic camera movement even though the user has not navigated.
      if (resizeOnPixelRatio) {
        this.emitSync('movestart'); this.emitSync('move'); this.emitSync('resize'); this.emitSync('moveend');
      }
    }
    getBearing() { return this.bearing; }
    getPitch() { return this.pitch; }
    getZoom() { return this.zoom; }
    getTerrain() { return this.terrain; }
    setTerrain(value) { this.terrain = value; }
    getCanvas() { return this.canvas; }
    project() { return this.projectedPoint || { x: 80, y: 90 }; }
    queryRenderedFeatures() { return this.features || []; }
    beginCamera() { this.cameraPixelRatios.push(this.pixelRatio); if (cameraEmitsMoveStart) this.emitSync('movestart'); }
    flyTo(value) { this.beginCamera(); this.flight = value; this.zoom = value.zoom; this.center = value.center; }
    easeTo(value) { this.beginCamera(); this.transition = value; Object.assign(this, value); }
    fitBounds(bounds, value) { if (this.boundsCanFit === false) return; this.beginCamera(); this.fittedBounds = bounds; this.transition = value; }
    jumpTo(value) { Object.assign(this, value); }
    setProjection(value) { this.projection = value; }
    stop() { if (stopEmitsMoveEnd) this.emitSync('moveend'); }
    resize() { this.canvasResizes++; }
    remove() { this.removed = true; }
    zoomIn(value) { this.beginCamera(); this.transition = value; this.zoom++; }
    zoomOut(value) { this.beginCamera(); this.transition = value; this.zoom--; }
  }
  const old = { window: globalThis.window, document: globalThis.document, matchMedia: globalThis.matchMedia };
  globalThis.window = { maplibregl: { Map: FakeMap }, devicePixelRatio: dpr, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { documentElement: { dataset: { theme: 'light' } }, getElementById: id => nodes.get(id) };
  globalThis.matchMedia = () => ({ matches: reducedMotion });
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
    assert.equal(map.flight.duration, 2400);
    assert.equal(map.flight.essential, true);
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

test('WebGL recovery is reported only after the replacement style renders and never during initial loading', async () => {
  const environment = fixture(), notifications = [];
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' },
    onRenderError: () => notifications.push('lost'), onRenderRecovered: () => notifications.push('recovered') });
  const map = controller.map;
  try {
    await map.emit('style.load'); await map.emit('render');
    controller.setTheme('night'); await map.emit('style.load'); await map.emit('render');
    assert.deepEqual(notifications, [], 'normal initialization and style changes cannot clear an initialization error');
    controller.setHistoryPlaces([{ id: 'nanjing', name: '南京', lon: 118.8, lat: 32.1 }]);
    await map.emit('webglcontextlost');
    assert.equal(environment.nodes.get('map-projection').disabled, true);
    await map.emit('render');
    await map.emit('webglcontextrestored'); await map.emit('render');
    assert.deepEqual(notifications, ['lost'], 'context availability alone is not a completed recovery');
    await map.emit('style.load');
    assert.deepEqual(notifications, ['lost'], 'style loading alone does not prove a successful frame');
    assert.equal(map.getSource('chronicle-history').data.features[0].properties.placeId, 'nanjing');
    await map.emit('render'); await map.emit('render');
    assert.deepEqual(notifications, ['lost', 'recovered']);
    assert.equal(environment.nodes.get('map-projection').disabled, false);
    await map.emit('webglcontextlost'); await map.emit('webglcontextrestored'); await map.emit('style.load');
    await map.emit('webglcontextlost'); await map.emit('render');
    assert.deepEqual(notifications, ['lost', 'recovered', 'lost', 'lost'], 'a second loss cancels the pending successful recovery');
    await map.emit('webglcontextrestored'); await map.emit('style.load');
    controller.destroy(); await map.emit('render');
    assert.deepEqual(notifications, ['lost', 'recovered', 'lost', 'lost'], 'destroyed maps cannot dismiss a later error');
  } finally { controller.destroy(); environment.restore(); }
});

test('explicit map navigation keeps animation when operating-system motion is disabled', async () => {
  for (const reducedMotion of [true, false]) {
    const environment = fixture({ reducedMotion });
    const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' } });
    const map = controller.map;
    const animated = (options, milliseconds) => {
      assert.equal(options.duration, milliseconds);
      assert.equal(options.essential, true, 'MapLibre otherwise substitutes jumpTo when reduced motion is enabled');
    };
    const location = (options, milliseconds = 2400) => {
      animated(options, milliseconds);
      assert.equal(typeof options.easing, 'function');
      const progress = [0, .1, .25, .5, .75, .9, 1].map(options.easing);
      assert.equal(progress[0], 0);
      assert.equal(progress.at(-1), 1);
      assert.equal(progress[3], .5);
      assert.ok(progress.every((value, index) => index === 0 || value > progress[index - 1]), 'the camera must keep travelling toward the destination');
      assert.ok(progress[1] < .03 && progress.at(-2) > .97, 'location travel gently accelerates and decelerates');
    };
    try {
      await map.emit('style.load');
      assert.equal(map.options.fadeDuration, reducedMotion ? 0 : 180, 'decorative tile fades still follow the system preference');
      for (const flat of [false, true]) {
        if (flat) controller.toggleProjection();
        controller.flyPlace({ lon: 2.35, lat: 48.85 });
        location(map.flight);
        controller.flyPlace({ lon: 139.75, lat: 35.68 }, { zoom: 3.5, milliseconds: 1500 });
        location(map.flight, 1500);
        assert.equal(map.flight.zoom, 3.5);
        const bounds = [[118, 31], [120, 32]];
        controller.fitBounds(bounds, { padding: 60, maxZoom: 7, pitch: 0 });
        assert.deepEqual(map.fittedBounds, bounds);
        location(map.transition);
        assert.equal(map.transition.padding, 60);
        assert.equal(map.transition.maxZoom, 7);
        controller.home();
        location(map.flight);
        controller.zoomIn();
        animated(map.transition, 250);
        controller.zoomOut();
        animated(map.transition, 250);
        map.bearing = 30;
        environment.nodes.get('north-view').onclick();
        animated(map.transition, 500);
        assert.equal(map.bearing, 0);
      }
      controller.toggleProjection();
      controller.toggleTilt();
      animated(map.transition, 500);
      assert.equal(map.pitch, 50);
      map.features = [{ source: 'chronicle-history', properties: { cluster: true, cluster_id: 1 }, geometry: { type: 'Point', coordinates: [118.8, 32.1] } }];
      await map.emit('click', { point: { x: 80, y: 90 } });
      location(map.flight, 1200);
    } finally { controller.destroy(); environment.restore(); }
  }
});

test('canvas resizing and genuine movement cannot start high-DPI resolution changes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const environment = fixture({ resizeOnPixelRatio: true });
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline', mapQuality: 'auto' } });
  const map = controller.map;
  try {
    await map.emit('style.load');
    assert.equal(map.pixelRatio, 2);
    assert.deepEqual(map.pixelRatioChanges, [], 'the constructor already allocated the correct resolution');
    const initialChanges = [...map.pixelRatioChanges];
    for (let step = 0; step < 20; step++) t.mock.timers.tick(100);
    assert.deepEqual(map.pixelRatioChanges, initialChanges, 'stationary high-DPI rendering must not oscillate every 100 ms');

    await map.emit('movestart');
    assert.deepEqual(map.pixelRatioChanges, initialChanges);
    for (let step = 0; step < 20; step++) t.mock.timers.tick(100);
    assert.equal(map.pixelRatio, 2, 'map detail must remain sharp throughout the transition');
    await map.emit('moveend');
    for (let step = 0; step < 20; step++) t.mock.timers.tick(100);
    assert.deepEqual(map.pixelRatioChanges, initialChanges, 'completing a movement must not resize the canvas either');

    await map.emit('movestart');
    await map.emit('moveend');
    controller.destroy();
    t.mock.timers.tick(1000);
    assert.deepEqual(map.pixelRatioChanges, initialChanges, 'destroyed maps must not perform a delayed canvas resize');
    assert.equal(map.removed, true);
  } finally { controller.destroy(); environment.restore(); }
});

test('all camera commands retain the same clear canvas without movement resizing', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const environment = fixture({ resizeOnPixelRatio: true, dpr: 1.5, stopEmitsMoveEnd: true, cameraEmitsMoveStart: true });
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline', mapQuality: 'auto' } });
  const map = controller.map;
  try {
    await map.emit('style.load');
    assert.equal(map.pixelRatio, 1.5);
    const initialChanges = [...map.pixelRatioChanges];
    controller.flyPlace({ lon: NaN, lat: 30 });
    assert.deepEqual(map.pixelRatioChanges, initialChanges);
    const commands = [
      () => controller.flyPlace({ lon: 2.35, lat: 48.85 }),
      () => controller.fitBounds([[118, 31], [120, 32]], { padding: 60 }),
      () => controller.home(),
      () => controller.toggleTilt(),
      () => environment.nodes.get('north-view').onclick(),
      () => controller.zoomIn(),
      () => controller.zoomOut(),
    ];
    for (const command of commands) {
      const cameras = map.cameraPixelRatios.length;
      command();
      assert.equal(map.cameraPixelRatios.length, cameras + 1);
      assert.equal(map.cameraPixelRatios.at(-1), 1.5, 'navigation must preserve display resolution from its first frame');
      t.mock.timers.tick(200);
      assert.deepEqual(map.pixelRatioChanges, initialChanges, 'interrupting the previous camera must not resize the canvas during the new flight');
      await map.emit('moveend');
      t.mock.timers.tick(100);
      assert.deepEqual(map.pixelRatioChanges, initialChanges);
    }
    const cameras = map.cameraPixelRatios.length;
    map.boundsCanFit = false;
    controller.fitBounds([[118, 31], [120, 32]], { padding: 60 });
    assert.equal(map.cameraPixelRatios.length, cameras, 'an unusably narrow viewport can decline bounds navigation');
    t.mock.timers.tick(100);
    assert.deepEqual(map.pixelRatioChanges, initialChanges, 'a declined camera move must not disturb resolution');
    t.mock.timers.tick(1000);
    assert.deepEqual(map.pixelRatioChanges, initialChanges);
  } finally { controller.destroy(); environment.restore(); }
});

test('quality settings and viewport changes enforce pixel budgets without movement feedback', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const environment = fixture({ resizeOnPixelRatio: true, dpr: 3 });
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline', mapQuality: 'auto' } });
  const map = controller.map, element = environment.nodes.get('globe');
  try {
    await map.emit('style.load');
    assert.equal(map.pixelRatio, 2);
    assert.equal(map.options.localIdeographFontFamily, false, 'prebuilt bundled ideographs avoid generating Chinese distance fields during a flight');
    assert.equal(map.options.transformRequest, undefined, 'bundled glyphs use the normal same-origin asset path');
    for (const [quality, ratio] of [['high', 3], ['smooth', 1], ['auto', 2]]) {
      controller.applyPreferences({ mapQuality: quality });
      assert.equal(map.pixelRatio, ratio);
      const changes = [...map.pixelRatioChanges];
      t.mock.timers.tick(1000);
      assert.deepEqual(map.pixelRatioChanges, changes, 'synthetic resize movement must not start another quality change');
    }
    element.clientWidth = 3840; element.clientHeight = 2160;
    for (const [quality, budget] of [['auto', 8e6], ['high', 12e6], ['smooth', 4e6]]) {
      controller.applyPreferences({ mapQuality: quality });
      controller.resize();
      assert.ok(map.pixelRatio * map.pixelRatio * element.clientWidth * element.clientHeight <= budget + 1);
      const changes = [...map.pixelRatioChanges], ratio = map.pixelRatio;
      await map.emit('movestart'); await map.emit('moveend');
      t.mock.timers.tick(1000);
      assert.equal(map.pixelRatio, ratio);
      assert.deepEqual(map.pixelRatioChanges, changes);
    }
    element.clientWidth = 900; element.clientHeight = 700;
    controller.applyPreferences({ mapQuality: 'high' });
    controller.resize();
    assert.equal(map.pixelRatio, 3, 'returning to a smaller window restores the configured detail');
  } finally { controller.destroy(); environment.restore(); }
});

test('unchanged viewport notifications do not resize the map canvas', async () => {
  const environment = fixture({ resizeOnPixelRatio: true });
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' } });
  const map = controller.map, element = environment.nodes.get('globe');
  try {
    await map.emit('style.load');
    assert.equal(map.options.trackResize, false, 'the controller owns resize handling instead of duplicating MapLibre window listeners');
    const initialResizes = map.canvasResizes;
    controller.resize(); controller.resize(); controller.resize();
    assert.equal(map.canvasResizes, initialResizes);
    element.clientWidth = 1100;
    controller.resize();
    assert.equal(map.canvasResizes, initialResizes + 1);
    controller.resize(); controller.resize();
    assert.equal(map.canvasResizes, initialResizes + 1, 'repeated observer and window notifications share one resize');
    window.devicePixelRatio = 1.5;
    controller.resize();
    assert.equal(map.pixelRatio, 1.5);
    assert.equal(map.canvasResizes, initialResizes + 2, 'a real display scale change resizes once');
    controller.resize();
    assert.equal(map.canvasResizes, initialResizes + 2);
  } finally { controller.destroy(); environment.restore(); }
});

test('camera travel leaves orientation controls alone while rotation and tilt still update them', async () => {
  const environment = fixture();
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' } });
  const map = controller.map, projection = environment.nodes.get('map-projection');
  const north = environment.nodes.get('north-view'), tilt = environment.nodes.get('map-tilt');
  try {
    await map.emit('style.load');
    const writes = [projection.attributeWrites, north.attributeWrites, tilt.attributeWrites];
    for (let step = 0; step < 10; step++) {
      map.center = [step, 30]; map.zoom = 3 + step / 10;
      await map.emit('move');
    }
    assert.deepEqual([projection.attributeWrites, north.attributeWrites, tilt.attributeWrites], writes,
      'moving and zooming must not rewrite unchanged orientation controls every animation frame');
    map.bearing = 45;
    await map.emit('rotate');
    assert.equal(north.arrow.style.transform, 'rotate(-45deg)');
    assert.match(north.title, /45°/);
    map.pitch = 50;
    await map.emit('pitch');
    assert.equal(tilt.title, '切换为俯视');
    map.pitch = 0;
    await map.emit('pitch');
    assert.equal(tilt.title, '倾斜查看地形');
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
    assert.equal(map.getLayer('base-place-cities').layout.visibility ?? 'visible', 'visible');
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

test('tile-loading events cannot toggle base labels or re-layout text during camera travel', async () => {
  const environment = fixture();
  const controller = initMapView({ maplibregl: environment.maplibregl });
  const map = controller.map;
  const visibility = id => map.getLayer(id).layout?.visibility || 'visible';
  try {
    await map.emit('style.load');
    await map.emit('movestart');
    const startWrites = [...map.layoutWrites];
    for (const loaded of [false, true, false, true]) {
      map.sourceLoaded = loaded;
      await map.emit(loaded ? 'sourcedata' : 'sourcedataloading', { sourceId: 'openmaptiles', sourceDataType: 'content' });
      await map.emit('idle');
      assert.equal(visibility('online-background'), 'none');
      assert.equal(visibility('base-place-cities'), 'visible');
    }
    assert.deepEqual(map.layoutWrites, startWrites);
    await map.emit('moveend');
    assert.equal(visibility('online-background'), 'visible');
    assert.equal(visibility('base-place-cities'), 'none');
    const onlineWrites = [...map.layoutWrites];
    await map.emit('movestart');
    for (const loaded of [false, true, false]) {
      map.sourceLoaded = loaded;
      await map.emit(loaded ? 'sourcedata' : 'sourcedataloading', { sourceId: 'openmaptiles', sourceDataType: 'content' });
    }
    assert.deepEqual(map.layoutWrites, onlineWrites, 'a partial tile update must not repeatedly invalidate text placement mid-flight');
    await map.emit('moveend');
    assert.equal(visibility('online-background'), 'none');
    assert.equal(visibility('base-place-cities'), 'visible');
    map.sourceLoaded = true;
    await map.emit('sourcedata', { sourceId: 'openmaptiles', sourceDataType: 'content' });
    assert.equal(visibility('online-background'), 'visible', 'completed tiles can still replace the fallback after the camera stops');
    await map.emit('error', { sourceId: 'openmaptiles' });
    assert.equal(visibility('online-background'), 'none');
    assert.equal(visibility('base-place-cities'), 'visible', 'a failed source still restores the local fallback');
  } finally { controller.destroy(); environment.restore(); }
});

test('replacing a flight or destroying a map cancels deferred tile-visibility synchronization', async () => {
  const environment = fixture({ stopEmitsMoveEnd: true, cameraEmitsMoveStart: true });
  const controller = initMapView({ maplibregl: environment.maplibregl });
  const map = controller.map;
  try {
    await map.emit('style.load');
    await map.emit('sourcedata', { sourceId: 'openmaptiles', sourceDataType: 'content' });
    assert.equal(map.getLayer('online-background').layout.visibility, 'visible');
    controller.flyPlace({ lon: 2.35, lat: 48.85 });
    map.sourceLoaded = false;
    await map.emit('sourcedataloading', { sourceId: 'openmaptiles' });
    const layouts = [...map.layoutWrites];
    controller.flyPlace({ lon: 139.75, lat: 35.68 });
    await Promise.resolve();
    assert.deepEqual(map.layoutWrites, layouts, 'stop followed by a new flight must not briefly re-layout the fallback labels');
    assert.equal(map.getLayer('online-background').layout.visibility, 'visible');
    await map.emit('moveend');
    assert.equal(map.getLayer('online-background').layout.visibility, 'none', 'the final completed movement still applies pending coverage');

    map.sourceLoaded = true;
    map.emitSync('moveend');
    controller.destroy();
    let destroyedMapReads = 0;
    map.getLayer = () => { destroyedMapReads++; return undefined; };
    map.isMoving = () => { destroyedMapReads++; return false; };
    await Promise.resolve();
    assert.equal(destroyedMapReads, 0, 'deferred synchronization must not query a destroyed map');
  } finally { controller.destroy(); environment.restore(); }
});

test('unchanged event markers and label visibility do not send repeated map layout work', async () => {
  const environment = fixture();
  const controller = initMapView({ maplibregl: environment.maplibregl, preferences: { mapSource: 'offline' } });
  const map = controller.map;
  try {
    await map.emit('style.load');
    const source = map.getSource('chronicle-history'), initialWrites = source.dataWrites, initialLayouts = [...map.layoutWrites];
    for (let index = 0; index < 5; index++) {
      controller.setHistoryPlaces([], { labels: true });
      controller.setLabels(true);
    }
    assert.equal(source.dataWrites, initialWrites, 'empty years share unchanged GeoJSON instead of repeatedly reparsing it');
    assert.deepEqual(map.layoutWrites, initialLayouts);
    const places = [{ id: 'a', name: '南京', lon: 118.8, lat: 32.1 }];
    controller.setHistoryPlaces(places, { counts: new Map([['a', 2]]) });
    assert.equal(source.dataWrites, initialWrites + 1);
    controller.setHistoryPlaces(structuredClone(places), { counts: { a: 2 } });
    assert.equal(source.dataWrites, initialWrites + 1, 'equivalent fresh arrays and count containers do not resubmit the same GeoJSON');
    controller.setHistoryPlaces(places, { counts: { a: 3 } });
    assert.equal(source.dataWrites, initialWrites + 2);
    assert.equal(source.data.features[0].properties.count, 3);
    controller.setHistoryPlaces(places, { counts: { a: 3 }, selectedPlaceId: 'a' });
    assert.equal(source.dataWrites, initialWrites + 3);
    assert.equal(source.data.features[0].properties.selected, true);
    controller.setLabels(false);
    const hiddenLayouts = [...map.layoutWrites];
    controller.setLabels(false);
    assert.deepEqual(map.layoutWrites, hiddenLayouts, 'unchanged visibility must not invalidate every symbol layer');
    controller.setTheme('night'); await map.emit('style.load');
    const rebuiltSource = map.getSource('chronicle-history');
    assert.equal(rebuiltSource.data.features[0].properties.selected, true);
    const rebuiltWrites = rebuiltSource.dataWrites;
    controller.setHistoryPlaces(places, { counts: { a: 3 }, selectedPlaceId: 'a' });
    assert.equal(rebuiltSource.dataWrites, rebuiltWrites, 'style restoration retains the cached marker content');
  } finally { controller.destroy(); environment.restore(); }
});
