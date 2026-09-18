import { buildMapStyle, isPlaceLayer, LOCAL_FONTS } from './map-style.js';

const HISTORY_SOURCE = 'chronicle-history';
const HISTORY_LAYERS = ['history-clusters', 'history-cluster-labels', 'history-points', 'history-labels'];
const DRAFT_SOURCE = 'chronicle-draft';
const MAX_MARKER_LATITUDE = 85.0511287798066;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
// Keep deliberate map navigation animated, even when Windows disables decorative
// effects. MapLibre also needs essential:true to retain the spatial transition.
const cameraTransition = milliseconds => ({ duration: milliseconds, essential: true });
// Ease into and out of location changes with zero endpoint speed/acceleration.
const locationTransition = (milliseconds = 2400) => ({ ...cameraTransition(milliseconds), easing: t => t * t * t * (t * (6 * t - 15) + 10) });
const HOME_CENTER = [111, 29];

export function globeFitZoom(width, height) {
  if (!(width > 0 && height > 0)) return 1.6;
  // MapLibre's default field of view gives a focal distance of 1.5 × height.
  // Invert the sphere's perspective silhouette so 92% of the shorter side is used.
  const focalDistance = 1.5 * height;
  const screenRadius = 0.46 * Math.min(width, height);
  const globeRadius = screenRadius * (screenRadius + Math.hypot(screenRadius, focalDistance)) / focalDistance;
  const circumference = 2 * Math.PI * globeRadius * Math.cos(HOME_CENTER[1] * Math.PI / 180);
  return clamp(Math.log2(circumference / 512), -2, 19);
}

export function mapPixelRatio(quality, dpr = 1, width = 0, height = 0) {
  const profiles = { auto: [2, 8e6], high: [3, 12e6], smooth: [1, 4e6] };
  const [limit, budget] = profiles[quality] || profiles.auto;
  const ratio = Math.min(clamp(Number(dpr) || 1, 1, 3), limit);
  const area = Number(width) * Number(height);
  return area > 0 ? Math.min(ratio, Math.sqrt(budget / area)) : ratio;
}

export function placeZoom(properties = {}, currentZoom = 0) {
  const kind = properties.class || properties.type || properties.kind || 'city';
  const target = { continent: 2.2, country: 4.5, state: 6.5, province: 6.5, city: 11, town: 12, village: 13, hamlet: 14, suburb: 14, quarter: 15, neighbourhood: 15 }[kind] || 11;
  return clamp(Math.max(target, Number(currentZoom) + 1), 0, 19);
}

export function historyFeatures(places, { selectedPlaceId, counts = {} } = {}) {
  return { type: 'FeatureCollection', features: places.filter(place => Number.isFinite(Number(place.lon)) && Number.isFinite(Number(place.lat))).map(place => {
    const count = counts instanceof Map ? counts.get(place.id) || 0 : counts[place.id] || 0;
    return { type: 'Feature', id: place.id, properties: { placeId: place.id, name: place.name || '', count, selected: place.id === selectedPlaceId, label: `${place.name || ''}${count ? ` · ${count}` : ''}` }, geometry: { type: 'Point', coordinates: [Number(place.lon), clamp(Number(place.lat), -85.051129, 85.051129)] } };
  }) };
}

export function initMapView({ maplibregl: M, container = 'globe', baseStyle, preferences = {}, onHistoryPlace = () => {}, onPickPoint = () => {}, onProjectionChange = () => {}, onStatus = () => {}, onNotice = () => {}, onRenderError = () => {}, onRenderRecovered = () => {} } = {}) {
  if (!M?.Map) throw new Error('地图组件未能加载');
  const element = typeof container === 'string' ? document.getElementById(container) : container;
  let settings = { mapSource: 'roads', mapTerrain: true, mapQuality: 'auto', ...preferences };
  let theme = document.documentElement.dataset.theme || 'light';
  let flat = false, labels = true, ready = false, destroyed = false, terrainFailed = false, notified = false, fitOverview = true;
  let history = historyFeatures([]), selectedPlaceId, styleSerial = 0, onlineReady = false, onlineContent = false;
  let historySignature = JSON.stringify(history);
  let mapWidth = element.clientWidth, mapHeight = element.clientHeight;
  let lastRatio = mapPixelRatio(settings.mapQuality, window.devicePixelRatio, element.clientWidth, element.clientHeight);
  let picking = false, draftPoint = null, navigationSerial = 0, changingQuality = false;
  let contextLost = false, recoveryPending = false;
  const failures = new Set();
  const style = () => {
    // Keep elevation available across style changes in flat view; only the 3D mesh is disabled there.
    const value = buildMapStyle({ theme, online: settings.mapSource !== 'offline', terrain: settings.mapTerrain !== false, baseStyle });
    value.projection = { type: flat ? 'mercator' : 'globe' };
    return value;
  };
  const map = new M.Map({
    container: element, style: style(), center: HOME_CENTER, zoom: globeFitZoom(element.clientWidth, element.clientHeight), pitch: 0, bearing: 0,
    minZoom: -2, maxZoom: 19, maxPitch: 60, maxTileCacheSize: 160, maxTileCacheZoomLevels: 3,
    cancelPendingTileRequestsWhileZooming: true, renderWorldCopies: false, trackResize: false,
    fadeDuration: reducedMotion() ? 0 : 180,
    pixelRatio: lastRatio,
    canvasContextAttributes: { antialias: true }, attributionControl: { compact: false },
    localIdeographFontFamily: false,
    locale: { 'AttributionControl.ToggleAttribution': '地图资料来源', 'Map.Title': '地球史书地图' },
  });
  const controls = { projection: document.getElementById('map-projection'), north: document.getElementById('north-view'), tilt: document.getElementById('map-tilt') };
  const stage = element.closest('.earth-stage');
  const listeners = [];
  const on = (event, handler) => { map.on(event, handler); listeners.push([event, handler]); };
  const canvas = map.getCanvas();
  const inputEvents = ['wheel', 'pointerdown', 'touchstart', 'keydown'];
  const preserveUserView = () => { fitOverview = false; ++navigationSerial; };
  for (const event of inputEvents) canvas.addEventListener(event, preserveUserView, { passive: true });

  function quality() {
    if (destroyed || changingQuality) return;
    const ratio = mapPixelRatio(settings.mapQuality, window.devicePixelRatio, element.clientWidth, element.clientHeight);
    if (Math.abs(ratio - (lastRatio || 0)) < .001) return;
    lastRatio = ratio;
    // Resize only for an actual quality/display change. Camera movement keeps
    // the same sharp canvas and never reallocates its render buffers.
    changingQuality = true;
    try { map.setPixelRatio(ratio); }
    finally { changingQuality = false; }
  }
  function syncControls() {
    const { projection, north, tilt } = controls;
    if (projection) {
      projection.disabled = !ready;
      projection.textContent = flat ? '3D' : '2D';
      projection.title = flat ? '收拢为立体地球' : '展开为平面地图';
      projection.setAttribute('aria-label', projection.title);
      projection.setAttribute('aria-pressed', String(flat));
    }
    if (stage) stage.dataset.projection = flat ? '2d' : '3d';
    if (north) {
      north.disabled = !ready;
      const degrees = Math.round((map.getBearing() + 360) % 360);
      const arrow = north.querySelector('.compass-arrow');
      if (arrow) arrow.style.transform = `rotate(${-degrees}deg)`;
      north.title = `朝北 · 当前方位 ${degrees}°，点击恢复北向上`;
    }
    if (tilt) {
      const inclined = !flat && map.getPitch() > 20;
      tilt.disabled = !ready || flat;
      tilt.title = inclined ? '切换为俯视' : '倾斜查看地形';
      tilt.setAttribute('aria-label', tilt.title);
      tilt.setAttribute('aria-pressed', String(inclined));
    }
  }
  function report() {
    const message = failures.size ? '部分地图数据暂时无法加载，已保留可用底图。' : '';
    onStatus(message);
    if (message && !notified) { notified = true; onNotice(message); }
  }
  function setTerrain() {
    if (!ready) return;
    const desired = !flat && settings.mapSource !== 'offline' && settings.mapTerrain !== false && !terrainFailed && map.getSource('terrain');
    const current = map.getTerrain();
    if (desired && !current) map.setTerrain({ source: 'terrain', exaggeration: 1 });
    else if (!desired && current) map.setTerrain(null);
  }
  function addHistoryLayers() {
    if (!map.getSource(HISTORY_SOURCE)) map.addSource(HISTORY_SOURCE, { type: 'geojson', data: history, cluster: true, clusterMaxZoom: 7, clusterRadius: 42 });
    else map.getSource(HISTORY_SOURCE).setData(history);
    const dark = theme === 'night';
    const accent = dark ? '#f2d7a5' : '#74521d', ink = dark ? '#f4e3c7' : '#574327', halo = dark ? '#15242d' : '#ffffff';
    const definitions = [
      { id: 'history-clusters', type: 'circle', filter: ['has', 'point_count'], paint: { 'circle-radius': 8, 'circle-color': accent, 'circle-stroke-color': halo, 'circle-stroke-width': 2 } },
      { id: 'history-cluster-labels', type: 'symbol', filter: ['has', 'point_count'], layout: { 'text-field': ['concat', ['to-string', ['get', 'point_count']], ' 处地点'], 'text-font': LOCAL_FONTS, 'text-size': 13, 'text-anchor': 'left', 'text-offset': [1, 0] }, paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.8 } },
      { id: 'history-points', type: 'circle', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': ['case', ['get', 'selected'], 7, ['>', ['get', 'count'], 0], 5, 3.5], 'circle-color': ['case', ['get', 'selected'], accent, ['>', ['get', 'count'], 0], dark ? '#d1b37b' : '#9d773a', dark ? '#6c858c' : '#66807e'], 'circle-stroke-color': halo, 'circle-stroke-width': 2 } },
      { id: 'history-labels', type: 'symbol', filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'label'], 'text-font': LOCAL_FONTS, 'text-size': 13, 'text-anchor': 'left', 'text-offset': [1, 0], 'symbol-sort-key': ['case', ['get', 'selected'], -1, 0] }, paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.8 } },
    ];
    for (const layer of definitions) if (!map.getLayer(layer.id)) map.addLayer({ ...layer, source: HISTORY_SOURCE });
  }
  function coordinates(point) {
    const lon = point?.lon ?? point?.lng, lat = point?.lat;
    if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    return [lon, lat];
  }
  function addDraftLayers() {
    const data = { type: 'FeatureCollection', features: draftPoint ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: draftPoint } }] : [] };
    if (!map.getSource(DRAFT_SOURCE)) map.addSource(DRAFT_SOURCE, { type: 'geojson', data });
    else map.getSource(DRAFT_SOURCE).setData(data);
    // White and near-black rings remain distinct from both terrain and history markers.
    const layers = [
      { id: 'draft-point-halo', type: 'circle', paint: { 'circle-radius': 10, 'circle-color': '#ffffff', 'circle-stroke-color': '#21172f', 'circle-stroke-width': 2 } },
      { id: 'draft-point', type: 'circle', paint: { 'circle-radius': 4, 'circle-color': '#21172f' } },
    ];
    for (const layer of layers) if (!map.getLayer(layer.id)) map.addLayer({ ...layer, source: DRAFT_SOURCE });
  }
  function setDraftPoint(point) {
    if (destroyed) return false;
    const next = point === null ? null : coordinates(point);
    if (point !== null && (!next || Math.abs(next[1]) > MAX_MARKER_LATITUDE)) return false;
    draftPoint = next;
    if (ready) addDraftLayers();
    return true;
  }
  function setPicking(value) {
    if (destroyed) return;
    ++navigationSerial;
    picking = value === true;
    canvas.style.cursor = picking ? 'crosshair' : '';
  }
  function applyLabels() {
    if (!ready) return;
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && (isPlaceLayer(layer) || layer.id === 'history-labels' || layer.id === 'history-cluster-labels')) {
      const baseHidden = onlineReady && layer.metadata?.['earthchronicle:base-label'];
      const visibility = labels && !baseHidden ? 'visible' : 'none';
      if ((layer.layout?.visibility ?? 'visible') !== visibility) map.setLayoutProperty(layer.id, 'visibility', visibility);
    }
  }
  function syncOnlineLayers() {
    if (destroyed || !ready || !map.getLayer('online-background')) return;
    // Loading each new batch of tiles must not repeatedly hide/show the base
    // labels during a flight: visibility changes reparse their GeoJSON tiles.
    if (map.isMoving()) return;
    const complete = onlineContent && !failures.has('openmaptiles') && map.isSourceLoaded('openmaptiles');
    if (complete === onlineReady) return;
    onlineReady = complete;
    map.setLayoutProperty('online-background', 'visibility', onlineReady ? 'visible' : 'none');
    applyLabels();
  }
  function rebuild() {
    if (destroyed) return;
    ++styleSerial; ready = false; terrainFailed = false; onlineReady = false; onlineContent = false; failures.clear(); notified = false; report();
    map.setStyle(style(), { diff: false });
    syncControls();
  }
  on('style.load', () => {
    if (destroyed) return;
    ready = true;
    addHistoryLayers(); addDraftLayers(); setTerrain(); applyLabels(); syncOnlineLayers(); syncControls(); quality();
    onProjectionChange(flat);
  });
  on('error', event => {
    if (destroyed) return;
    failures.add(event.sourceId || 'map');
    if (event.sourceId === 'terrain') { terrainFailed = true; if (ready) map.setTerrain(null); }
    if (event.sourceId === 'openmaptiles') syncOnlineLayers();
    report();
  });
  on('sourcedata', event => {
    if (event.sourceId !== 'openmaptiles') return;
    if (event.sourceDataType === 'content') onlineContent = true;
    syncOnlineLayers();
  });
  on('sourcedataloading', event => { if (event.sourceId === 'openmaptiles') syncOnlineLayers(); });
  on('idle', syncOnlineLayers);
  // stop() can immediately be followed by another flight. Let that flight
  // start before deciding whether it is safe to update the base labels.
  on('moveend', () => queueMicrotask(syncOnlineLayers));
  on('webglcontextlost', event => {
    if (destroyed) return;
    contextLost = true; recoveryPending = false; ready = false;
    syncControls(); onRenderError(event);
  });
  on('webglcontextrestored', () => {
    if (destroyed) return;
    recoveryPending = contextLost; contextLost = false;
    rebuild();
  });
  on('render', () => {
    // Loading the replacement style is not yet a successful draw. Only a
    // rendered frame after a known context loss can dismiss its error overlay.
    if (destroyed || contextLost || !ready || !recoveryPending) return;
    recoveryPending = false; onRenderRecovered();
  });
  on('rotate', syncControls);
  on('pitch', syncControls);
  on('movestart', event => {
    if (event.originalEvent) fitOverview = false;
  });

  function interactiveFeatures(point) {
    if (!ready) return [];
    const layers = map.getStyle().layers.filter(layer => HISTORY_LAYERS.includes(layer.id) || isPlaceLayer(layer)).map(layer => layer.id);
    if (!layers.length) return [];
    return map.queryRenderedFeatures([[point.x - 3, point.y - 3], [point.x + 3, point.y + 3]], { layers });
  }
  function flyPlace(place, { zoom = 11, milliseconds } = {}) {
    const lon = Number(place?.lon ?? place?.lng), lat = Number(place?.lat);
    if (destroyed || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
    preserveUserView();
    map.stop();
    map.flyTo({ center: [lon, clamp(lat, -85.051129, 85.051129)], zoom: clamp(zoom, 0, 19), pitch: flat ? 0 : map.getPitch(), bearing: map.getBearing(), ...locationTransition(milliseconds) });
  }
  on('click', async event => {
    const navigation = ++navigationSerial;
    if (picking) {
      if (!ready || destroyed || (event.originalEvent?.button !== undefined && event.originalEvent.button !== 0)) return;
      const position = coordinates(event.lngLat), point = event.point;
      if (!position || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
      // Globe unprojection clamps sky clicks to its horizon. A public API round trip
      // rejects those positions without relying on MapLibre's private transform.
      const projected = map.project(event.lngLat);
      if (!Number.isFinite(projected?.x) || !Number.isFinite(projected?.y) || Math.hypot(projected.x - point.x, projected.y - point.y) > .5) return;
      // GeoJSON circles use Mercator tiles even in globe mode and cannot retain
      // polar latitudes. Reject the point rather than silently move its marker.
      if (Math.abs(position[1]) > MAX_MARKER_LATITUDE) { onNotice('该纬度暂不支持事件标记'); return; }
      const feature = interactiveFeatures(point).find(candidate => candidate.geometry?.type === 'Point' && isPlaceLayer(candidate.layer));
      const properties = feature?.properties || {}, picked = { lon: position[0], lat: position[1] };
      const name = properties['name:zh'] || properties.name;
      const countryCode = properties.country_code || properties.countryCode;
      if (typeof name === 'string' && name.trim()) picked.name = name.trim();
      if (typeof countryCode === 'string' && /^[A-Z]{2}$/i.test(countryCode)) picked.countryCode = countryCode.toUpperCase();
      onPickPoint(picked);
      return;
    }
    const features = interactiveFeatures(event.point);
    const historical = features.find(feature => feature.source === HISTORY_SOURCE);
    if (historical?.properties?.cluster) {
      const serial = styleSerial, source = map.getSource(HISTORY_SOURCE);
      try {
        const zoom = await source.getClusterExpansionZoom(historical.properties.cluster_id);
        if (!destroyed && serial === styleSerial && navigation === navigationSerial) flyPlace({ lon: historical.geometry.coordinates[0], lat: historical.geometry.coordinates[1] }, { zoom: Math.max(zoom, map.getZoom() + 1), milliseconds: 1200 });
      } catch { /* A style change may cancel the cluster request. */ }
      return;
    }
    if (historical) {
      onHistoryPlace(historical.properties.placeId);
      if (historical.geometry?.type === 'Point') flyPlace({ lon: historical.geometry.coordinates[0], lat: historical.geometry.coordinates[1] }, { zoom: placeZoom({ class: 'city' }, map.getZoom()) });
      return;
    }
    const feature = features.find(candidate => candidate.geometry?.type === 'Point' && isPlaceLayer(candidate.layer));
    if (!feature) return;
    flyPlace({ lon: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }, { zoom: placeZoom(feature.properties, map.getZoom()) });
  });
  on('mousemove', event => { canvas.style.cursor = picking ? 'crosshair' : interactiveFeatures(event.point).length ? 'pointer' : ''; });
  on('mouseout', () => { canvas.style.cursor = picking ? 'crosshair' : ''; });

  function toggleProjection() {
    if (!ready) return;
    preserveUserView();
    map.stop(); flat = !flat;
    map.jumpTo({ pitch: 0, bearing: 0 });
    map.setProjection({ type: flat ? 'mercator' : 'globe' });
    setTerrain(); syncControls(); onProjectionChange(flat);
  }
  function toggleTilt() {
    if (!ready || flat) return;
    preserveUserView();
    map.stop(); map.easeTo({ pitch: map.getPitch() > 20 ? 0 : 50, ...cameraTransition(500) });
  }
  if (controls.projection) controls.projection.onclick = toggleProjection;
  if (controls.north) controls.north.onclick = () => { preserveUserView(); map.stop(); map.easeTo({ bearing: 0, ...cameraTransition(500) }); };
  if (controls.tilt) controls.tilt.onclick = toggleTilt;
  const resize = () => {
    if (destroyed) return;
    const width = element.clientWidth, height = element.clientHeight;
    const ratio = mapPixelRatio(settings.mapQuality, window.devicePixelRatio, width, height);
    const sizeChanged = width !== mapWidth || height !== mapHeight;
    const ratioChanged = Math.abs(ratio - lastRatio) >= .001;
    if (!sizeChanged && !ratioChanged) return;
    mapWidth = width; mapHeight = height;
    // setPixelRatio already resizes the canvas; never allocate it twice.
    if (ratioChanged) quality();
    else map.resize();
    if (fitOverview && !flat && element.clientWidth > 0 && element.clientHeight > 0) {
      const zoom = globeFitZoom(element.clientWidth, element.clientHeight);
      if (Math.abs(map.getZoom() - zoom) > .001) { map.stop(); map.jumpTo({ center: HOME_CENTER, zoom, pitch: 0, bearing: 0 }); }
    }
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(element);
  const retry = () => { if (!destroyed && settings.mapSource !== 'offline') rebuild(); };
  window.addEventListener('online', retry);
  window.addEventListener('resize', resize);
  syncControls();

  return {
    map, isFlat: () => flat, resize, retry, flyPlace, toggleProjection, toggleTilt, setPicking, setDraftPoint,
    fitBounds(bounds, options = {}) { preserveUserView(); map.stop(); map.fitBounds(bounds, { ...options, ...locationTransition(options.duration) }); },
    home() { ++navigationSerial; fitOverview = !flat; map.stop(); map.flyTo({ center: flat ? [0, 15] : HOME_CENTER, zoom: flat ? 0 : globeFitZoom(element.clientWidth, element.clientHeight), pitch: 0, bearing: 0, ...locationTransition() }); },
    zoomIn() { preserveUserView(); map.zoomIn(cameraTransition(250)); },
    zoomOut() { preserveUserView(); map.zoomOut(cameraTransition(250)); },
    applyPreferences(next) {
      const oldSource = settings.mapSource, oldTerrain = settings.mapTerrain;
      settings = { ...settings, ...next };
      if (settings.mapSource !== oldSource || settings.mapTerrain !== oldTerrain) rebuild();
      quality();
    },
    setTheme(next) { if (next && next !== theme) { theme = next; rebuild(); } },
    setLabels(value) { labels = value !== false; applyLabels(); },
    setHistoryPlaces(places, options = {}) {
      selectedPlaceId = options.selectedPlaceId;
      if (options.labels !== undefined) labels = options.labels !== false;
      const next = historyFeatures(places, { ...options, selectedPlaceId });
      const signature = JSON.stringify(next), changed = signature !== historySignature;
      history = next; historySignature = signature;
      if (ready) { if (changed) map.getSource(HISTORY_SOURCE)?.setData(history); applyLabels(); }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; observer?.disconnect();
      window.removeEventListener('online', retry); window.removeEventListener('resize', resize);
      for (const event of inputEvents) canvas.removeEventListener(event, preserveUserView);
      for (const [event, listener] of listeners) map.off(event, listener);
      for (const element of Object.values(controls)) if (element) element.onclick = null;
      map.remove();
    },
  };
}
