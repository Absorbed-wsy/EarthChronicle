const STORAGE_KEY = 'earthchronicle.preferences.v1';
const THEMES = new Set(['light', 'paper', 'night']);
const PANEL_LIMITS = {
  explorer: { min: 240, max: 440, initial: 300, label: '事件列表' },
  detail: { min: 260, max: 480, initial: 324, label: '详情面板' },
};
const TIMELINE_LIMITS = { min: 88, max: 300, initial: 88 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizePreferences(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const preferences = { theme: THEMES.has(saved.theme) ? saved.theme : 'light' };
  for (const [name, limits] of Object.entries(PANEL_LIMITS)) {
    const width = saved[`${name}Width`];
    preferences[`${name}Width`] = Number.isFinite(width)
      ? clamp(width, limits.min, limits.max) : limits.initial;
    preferences[`${name}Collapsed`] = saved[`${name}Collapsed`] === true;
  }
  const previousDefault = ((saved.layoutVersion === undefined || saved.layoutVersion === 3) && saved.timelineHeight === 96)
    || ((saved.layoutVersion === undefined || saved.layoutVersion === 2) && saved.timelineHeight === 124)
    || ((saved.layoutVersion === undefined || saved.layoutVersion === 1) && saved.timelineHeight === 156);
  preferences.timelineHeight = Number.isFinite(saved.timelineHeight) && !previousDefault
    ? Math.round(clamp(saved.timelineHeight, TIMELINE_LIMITS.min, TIMELINE_LIMITS.max)) : TIMELINE_LIMITS.initial;
  preferences.layoutVersion = 4;
  preferences.timelineCollapsed = saved.timelineCollapsed === true;
  preferences.mapSource = saved.mapSource === 'offline' ? 'offline' : 'roads';
  preferences.mapTerrain = saved.mapTerrain !== false;
  preferences.mapQuality = ['auto', 'high', 'smooth'].includes(saved.mapQuality) ? saved.mapQuality : 'auto';
  return preferences;
}

// Local desktop settings can migrate this snapshot into the database. Remote
// browsers keep their appearance private to that browser instead.
export function readLegacyPreferences() {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return normalizePreferences({}); }
}

export function initPreferences({
  initialPreferences = null,
  onPreferencesChange = () => {},
  persistLocally = true,
  onThemeChange = () => {},
  onLayoutChange = () => {},
  onMapChange = () => {},
} = {}) {
  const preferences = normalizePreferences(initialPreferences ?? (persistLocally ? readLegacyPreferences() : {}));
  const workspace = document.querySelector('.workspace');
  const themeSelect = document.getElementById('theme-select');
  const timeline = document.getElementById('timeline');
  const timelineHandle = document.getElementById('timeline-resizer');
  const removers = [];
  let frame = 0;
  let drag = null;
  let destroyed = false;
  let locked = false;
  const panels = Object.fromEntries(Object.entries(PANEL_LIMITS).map(([name, limits]) => [name, {
    ...limits,
    aside: document.getElementById(name),
    handle: document.getElementById(`${name}-resizer`),
  }]));

  function listen(target, event, callback, options) {
    if (!target) return;
    target.addEventListener(event, callback, options);
    removers.push(() => target.removeEventListener(event, callback, options));
  }

  function snapshot() {
    return { ...preferences };
  }

  function save(notify = true) {
    if (persistLocally) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); }
      catch { /* Appearance still works when browser storage is unavailable. */ }
    }
    if (notify) onPreferencesChange(snapshot());
  }

  function setTheme(theme, persist = true) {
    if (!THEMES.has(theme) || (locked && persist)) return;
    preferences.theme = theme;
    document.documentElement.dataset.theme = theme;
    if (themeSelect) themeSelect.value = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = { light: '#f5f7f6', paper: '#f4eedf', night: '#101719' }[theme];
    if (persist) save();
    onThemeChange(theme);
  }

  function mode() {
    return window.innerWidth <= 640 ? 'mobile' : window.innerWidth <= 950 ? 'tablet' : 'desktop';
  }

  function isResizable(name) {
    if (name === 'timeline') return !!workspace && !!timeline && !preferences.timelineCollapsed;
    return !!workspace && !preferences[`${name}Collapsed`]
      && mode() !== 'mobile' && (name === 'explorer' || mode() === 'desktop');
  }

  function calculateWidths() {
    const widths = {
      explorer: preferences.explorerWidth,
      detail: preferences.detailWidth,
    };
    if (!workspace || mode() === 'mobile') return widths;
    const visible = Object.keys(panels).filter(isResizable);
    const handlesWidth = visible.reduce((sum, name) => sum + (panels[name].handle?.offsetWidth || 6), 0);
    const available = Math.max(0, workspace.clientWidth - 280 - handlesWidth);
    const total = visible.reduce((sum, name) => sum + widths[name], 0);
    if (total > available) {
      const capacity = visible.reduce((sum, name) => sum + widths[name] - panels[name].min, 0);
      const reduction = Math.min(total - available, capacity);
      for (const name of visible) {
        const share = capacity ? (widths[name] - panels[name].min) / capacity : 0;
        widths[name] = Math.round(widths[name] - reduction * share);
      }
    }
    return widths;
  }

  function maximumWidth(name, widths) {
    const panel = panels[name];
    if (!isResizable(name)) return panel.max;
    const other = name === 'explorer' ? 'detail' : 'explorer';
    const handleWidth = panel.handle?.offsetWidth || 6;
    const otherWidth = isResizable(other) ? widths[other] + (panels[other].handle?.offsetWidth || 6) : 0;
    return Math.max(panel.min, Math.min(panel.max, workspace.clientWidth - 280 - handleWidth - otherWidth));
  }

  function applyLayout() {
    if (!workspace) return;
    if (themeSelect) themeSelect.disabled = locked;
    for (const [id, key] of [['map-source', 'mapSource'], ['map-quality', 'mapQuality'], ['map-terrain', 'mapTerrain']]) {
      const control = document.getElementById(id);
      if (!control) continue;
      if (id === 'map-terrain') control.checked = preferences[key];
      else control.value = preferences[key];
      control.disabled = locked || (id === 'map-terrain' && preferences.mapSource === 'offline');
    }
    for (const [name, panel] of Object.entries(panels)) {
      const collapsed = preferences[`${name}Collapsed`];
      workspace.classList.toggle(`${name}-collapsed`, collapsed);
      if (panel.aside) panel.aside.hidden = collapsed;
      if (panel.handle) {
        panel.handle.hidden = !isResizable(name);
        panel.handle.tabIndex = isResizable(name) && !locked ? 0 : -1;
        panel.handle.setAttribute('aria-disabled', String(!isResizable(name) || locked));
      }
    }
    const widths = calculateWidths();
    for (const [name, panel] of Object.entries(panels)) {
      workspace.style.setProperty(`--${name}-width`, `${widths[name]}px`);
      if (panel.handle) {
        panel.handle.setAttribute('aria-valuenow', String(Math.round(widths[name])));
        panel.handle.setAttribute('aria-valuemin', String(panel.min));
        panel.handle.setAttribute('aria-valuemax', String(Math.floor(maximumWidth(name, widths))));
        panel.handle.setAttribute('aria-valuetext', `${panel.label}宽度 ${Math.round(widths[name])} 像素`);
      }
    }
    workspace.classList.toggle('timeline-collapsed', preferences.timelineCollapsed);
    workspace.style.setProperty('--timeline-height', `${preferences.timelineHeight}px`);
    if (timeline) timeline.hidden = preferences.timelineCollapsed;
    if (timelineHandle) {
      timelineHandle.hidden = !isResizable('timeline');
      timelineHandle.tabIndex = isResizable('timeline') && !locked ? 0 : -1;
      timelineHandle.setAttribute('aria-disabled', String(!isResizable('timeline') || locked));
      timelineHandle.setAttribute('aria-valuenow', String(preferences.timelineHeight));
      timelineHandle.setAttribute('aria-valuemin', String(TIMELINE_LIMITS.min));
      timelineHandle.setAttribute('aria-valuemax', String(TIMELINE_LIMITS.max));
      timelineHandle.setAttribute('aria-valuetext', `时间轴高度 ${preferences.timelineHeight} 像素`);
    }
    for (const name of ['explorer', 'detail', 'timeline']) {
      const checkbox = document.getElementById(`display-${name}`);
      if (checkbox) { checkbox.checked = !preferences[`${name}Collapsed`]; checkbox.disabled = locked; }
    }
  }

  function scheduleLayout() {
    if (frame || destroyed) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      applyLayout();
      onLayoutChange();
    });
  }

  function setPanelCollapsed(name, collapsed) {
    if (locked || (!panels[name] && name !== 'timeline')) return;
    if (drag?.name === name) endDrag();
    preferences[`${name}Collapsed`] = !!collapsed;
    applyLayout();
    save();
    scheduleLayout();
  }

  function setWidth(name, requested) {
    const widths = calculateWidths();
    // Start an explicit resize from what is visible after a viewport change.
    // Otherwise an oversized saved opposite panel would keep pushing back.
    const other = name === 'explorer' ? 'detail' : 'explorer';
    if (isResizable(other)) preferences[`${other}Width`] = widths[other];
    preferences[`${name}Width`] = Math.round(clamp(requested, panels[name].min, maximumWidth(name, widths)));
    applyLayout();
    scheduleLayout();
  }

  function setTimelineHeight(height, persist = true) {
    if (!Number.isFinite(height) || locked) return;
    preferences.timelineHeight = Math.round(clamp(height, TIMELINE_LIMITS.min, TIMELINE_LIMITS.max));
    applyLayout();
    if (persist) save();
    scheduleLayout();
  }

  function endDrag(persist = true) {
    if (!drag) return;
    const finished = drag;
    drag = null;
    document.documentElement.classList.remove('resizing-sidebars');
    document.documentElement.classList.remove('resizing-timeline');
    document.body.style.cursor = finished.cursor;
    document.body.style.userSelect = finished.userSelect;
    if (finished.handle.hasPointerCapture?.(finished.pointerId)) {
      finished.handle.releasePointerCapture(finished.pointerId);
    }
    if (persist) save();
    scheduleLayout();
  }

  if (timelineHandle) {
    timelineHandle.setAttribute('role', 'separator');
    timelineHandle.setAttribute('aria-controls', 'timeline');
    timelineHandle.setAttribute('aria-orientation', 'horizontal');
    timelineHandle.setAttribute('aria-label', '调整时间轴高度');
    timelineHandle.title = '上下拖动调节时间轴高度，或使用方向键';
    timelineHandle.style.touchAction = 'none';
    listen(timelineHandle, 'pointerdown', event => {
      if (locked || !isResizable('timeline') || event.button !== 0 || !event.isPrimary || drag) return;
      event.preventDefault();
      drag = {
        name: 'timeline', handle: timelineHandle, pointerId: event.pointerId,
        startY: event.clientY, startHeight: preferences.timelineHeight,
        cursor: document.body.style.cursor, userSelect: document.body.style.userSelect,
      };
      timelineHandle.focus({ preventScroll: true });
      timelineHandle.setPointerCapture(event.pointerId);
      document.documentElement.classList.add('resizing-timeline');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
    listen(timelineHandle, 'pointermove', event => {
      if (drag?.name !== 'timeline' || drag.pointerId !== event.pointerId) return;
      setTimelineHeight(drag.startHeight + drag.startY - event.clientY, false);
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(timelineHandle, eventName, event => {
        if (drag?.name === 'timeline' && drag.pointerId === event.pointerId) endDrag();
      });
    }
    listen(timelineHandle, 'keydown', event => {
      if (locked || !isResizable('timeline') || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? TIMELINE_LIMITS.min
        : event.key === 'End' ? TIMELINE_LIMITS.max
          : preferences.timelineHeight + (event.key === 'ArrowUp' ? 16 : -16);
      setTimelineHeight(next);
    });
  }
  for (const name of ['explorer', 'detail', 'timeline']) {
    const checkbox = document.getElementById(`display-${name}`);
    listen(checkbox, 'change', () => setPanelCollapsed(name, !checkbox.checked));
  }

  for (const [name, panel] of Object.entries(panels)) {
    if (!panel.handle) continue;
    panel.handle.setAttribute('role', 'separator');
    panel.handle.setAttribute('aria-controls', name);
    panel.handle.setAttribute('aria-orientation', 'vertical');
    panel.handle.setAttribute('aria-label', `调整${panel.label}宽度`);
    panel.handle.title = '拖动调节宽度，或使用方向键';
    panel.handle.style.touchAction = 'none';
    listen(panel.handle, 'pointerdown', event => {
      if (locked || !isResizable(name) || event.button !== 0 || !event.isPrimary || drag) return;
      event.preventDefault();
      drag = {
        name, handle: panel.handle, pointerId: event.pointerId,
        startX: event.clientX, startWidth: calculateWidths()[name],
        cursor: document.body.style.cursor, userSelect: document.body.style.userSelect,
      };
      panel.handle.focus({ preventScroll: true });
      panel.handle.setPointerCapture(event.pointerId);
      document.documentElement.classList.add('resizing-sidebars');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    listen(panel.handle, 'pointermove', event => {
      if (!drag || drag.name !== name || drag.pointerId !== event.pointerId) return;
      const direction = name === 'explorer' ? 1 : -1;
      setWidth(name, drag.startWidth + (event.clientX - drag.startX) * direction);
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(panel.handle, eventName, event => {
        if (drag?.pointerId === event.pointerId) endDrag();
      });
    }
    listen(panel.handle, 'keydown', event => {
      if (locked || !isResizable(name) || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const widths = calculateWidths();
      const direction = name === 'explorer' ? 1 : -1;
      const next = event.key === 'Home' ? panel.min
        : event.key === 'End' ? maximumWidth(name, widths)
          : widths[name] + (event.key === 'ArrowRight' ? 16 : -16) * direction;
      setWidth(name, next);
      save();
    });
  }

  listen(themeSelect, 'change', () => setTheme(themeSelect.value));
  for (const [id, key] of [['map-source', 'mapSource'], ['map-quality', 'mapQuality'], ['map-terrain', 'mapTerrain']]) {
    const control = document.getElementById(id);
    listen(control, 'change', () => {
      if (locked) return;
      preferences[key] = id === 'map-terrain' ? control.checked : control.value;
      applyLayout(); save(); onMapChange(snapshot());
    });
  }
  listen(window, 'resize', () => {
    if (drag && !isResizable(drag.name)) endDrag();
    scheduleLayout();
  });
  listen(window, 'blur', endDrag);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleLayout) : null;
  if (workspace) observer?.observe(workspace);
  const globe = document.getElementById('globe');
  if (globe) observer?.observe(globe);
  setTheme(preferences.theme, false);
  applyLayout();
  scheduleLayout();

  return {
    setTheme,
    setPanelCollapsed,
    setTimelineHeight,
    setLocked(value) {
      if (value) endDrag();
      locked = !!value;
      applyLayout();
      scheduleLayout();
    },
    snapshot,
    applyPreferences(importedPreferences, { notify = false } = {}) {
      endDrag(false);
      Object.assign(preferences, normalizePreferences(importedPreferences));
      setTheme(preferences.theme, false);
      applyLayout();
      save(notify);
      onMapChange(snapshot());
      scheduleLayout();
    },
    destroy() {
      endDrag();
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      removers.forEach(remove => remove());
    },
  };
}
