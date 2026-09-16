// Shared navigation keeps historical markers and reconstruction layers in one scene.
export function initMapNavigation(viewer, onProjectionChange) {
  const C = window.Cesium;
  const scene = viewer.scene;
  const camera = viewer.camera;
  const projection = document.getElementById('map-projection');
  const north = document.getElementById('north-view');
  const arrow = north.querySelector('.compass-arrow');
  const stage = document.querySelector('.earth-stage');
  const duration = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.6;
  const isFlat = () => scene.mode === C.SceneMode.SCENE2D;

  function centerPoint() {
    const point = new C.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
    return camera.pickEllipsoid(point, scene.globe.ellipsoid);
  }
  function sync() {
    const flat = isFlat();
    projection.textContent = flat ? '3D' : '2D';
    projection.title = flat ? '收拢为立体地球' : '展开为平面地图';
    projection.setAttribute('aria-label', projection.title);
    projection.setAttribute('aria-pressed', String(flat));
    stage.dataset.projection = flat ? '2d' : '3d';
    onProjectionChange?.(flat);
  }
  projection.disabled = false;
  north.disabled = false;
  projection.onclick = () => {
    camera.cancelFlight();
    const flat = isFlat();
    const point = centerPoint();
    const center = point ? C.Cartographic.fromCartesian(point) : C.Cartographic.clone(camera.positionCartographic);
    const height = C.Math.clamp(camera.positionCartographic.height, 18000, 35000000);
    // A zero-duration morph avoids intermediate frames with a stale camera or layer.
    if (flat) scene.morphTo3D(0);
    else scene.morphTo2D(0);
    camera.setView({
      destination: C.Cartesian3.fromRadians(center.longitude, center.latitude, height),
      orientation: {heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0},
    });
    sync();
    scene.requestRender();
  };
  north.onclick = () => {
    camera.cancelFlight();
    const center = centerPoint();
    if (!isFlat() && center) {
      const range = C.Cartesian3.distance(camera.positionWC, center);
      // Calculate pitch at the map's center, preserving the center and viewing distance.
      const transform = C.Transforms.eastNorthUpToFixedFrame(center);
      const local = C.Matrix4.multiplyByPoint(C.Matrix4.inverseTransformation(transform, new C.Matrix4()), camera.positionWC, new C.Cartesian3());
      const pitch = -Math.asin(C.Math.clamp(local.z / range, -1, 1));
      camera.flyToBoundingSphere(new C.BoundingSphere(center, 0), {
        offset: new C.HeadingPitchRange(0, pitch, range), duration: duration(),
      });
    } else {
      camera.setView({orientation: {heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0}});
    }
    scene.requestRender();
  };
  let previousAngle;
  scene.postRender.addEventListener(() => {
    const degrees = Math.round(C.Math.toDegrees(camera.heading || 0)) % 360;
    if (degrees === previousAngle) return;
    previousAngle = degrees;
    arrow.style.transform = `rotate(${-degrees}deg)`;
    north.title = `朝北 · 当前方位 ${degrees}°，点击恢复北向上`;
  });
  sync();
  return {isFlat};
}
