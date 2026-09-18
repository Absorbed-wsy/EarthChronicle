import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMapStyle,isPlaceLayer,LOCAL_FONTS} from '../public/map-style.js';

const baseStyle=JSON.parse(await readFile(new URL('../public/maps/liberty.json',import.meta.url),'utf8'));
function bundledGlyphs(style,origin='http://localhost') {
  assert.ok(style.glyphs.includes('{range}')&&style.glyphs.includes('{fontstack}'),'glyph URL must preserve MapLibre substitution fields');
  const fontstack=LOCAL_FONTS.join(',');
  const url=new URL(style.glyphs.replace('{range}','19968-20223').replace('{fontstack}',encodeURIComponent(fontstack)));
  assert.equal(url.origin,origin,'font requests stay on the application server instead of an external glyph service');
  assert.equal(url.pathname,'/maps/fonts/noto-sans/19968-20223.pbf');
  assert.equal(url.searchParams.get('fontstack'),fontstack,'the requested font stack remains a valid encoded query value');
}

test('bundled overview works without any online tile, font or sprite dependency',()=>{
  const style=buildMapStyle({online:false,baseStyle});
  bundledGlyphs(style);
  assert.equal(style.sources.openmaptiles,undefined);
  assert.equal(style.sources.terrain,undefined);
  for(const source of Object.values(style.sources))assert.match(source.data,/^\/maps\/[a-z-]+\.geojson$/);
  assert.equal(new URL(style.sprite).pathname,'/maps/sprite');
  assert.equal(style.layers.filter(isPlaceLayer).length,2);
});

test('online detail keeps local fonts, bilingual names and the bundled fallback in every theme',()=>{
  const original=JSON.stringify(baseStyle);
  for(const theme of ['light','paper','night']) {
    const style=buildMapStyle({theme,online:true,terrain:true,baseStyle});
    assert.equal(style.sources.openmaptiles.url,'https://tiles.openfreemap.org/planet');
    assert.equal(style.sources.terrain.encoding,'terrarium');
    bundledGlyphs(style);
    assert.equal(style.sources.ne2_shaded,undefined);
    assert.equal(style.layers.find(l=>l.id==='online-background').layout.visibility,'none');
    for(const layer of style.layers.filter(isPlaceLayer)) {
      assert.deepEqual(layer.layout['text-font'],LOCAL_FONTS);
      assert.match(JSON.stringify(layer.layout['text-field']),/name:zh-Hans/);
      assert.match(JSON.stringify(layer.layout['text-field']),/"name"/);
    }
    for(const layer of style.layers.filter(layer=>layer.layout?.['text-field'])) {
      assert.deepEqual(layer.layout['text-font'],LOCAL_FONTS);
    }
    assert.equal(new Set(style.layers.map(l=>l.id)).size,style.layers.length);
  }
  assert.equal(JSON.stringify(baseStyle),original,'theme changes must not mutate the source style');
  assert.equal(buildMapStyle({terrain:false,baseStyle}).sources.terrain,undefined);
});

test('local map fonts include installed Chinese and Latin font families',()=>{
  assert.deepEqual(LOCAL_FONTS,['Microsoft YaHei','Segoe UI','Arial','sans-serif'],
    'installed families remain available as fallback if a bundled glyph cannot load');
});

test('both map modes request prebuilt glyphs from the current desktop or content-server origin',()=>{
  const previous=globalThis.location;
  try {
    for(const href of ['http://127.0.0.1:8743/','http://192.168.0.10:8123/','https://chronicle.example/history/']) {
      globalThis.location={href};
      for(const online of [true,false])bundledGlyphs(buildMapStyle({online,baseStyle}),new URL(href).origin);
    }
  } finally {
    if(previous===undefined)delete globalThis.location;else globalThis.location=previous;
  }
});

test('bundled places include real Chinese names, unique stable ids and valid coordinates',async()=>{
  for(const [file,minimum] of [['country-labels',150],['places',1000]]) {
    const data=JSON.parse(await readFile(new URL(`../public/maps/${file}.geojson`,import.meta.url),'utf8'));
    assert.equal(data.type,'FeatureCollection');assert.ok(data.features.length>=minimum);
    assert.equal(new Set(data.features.map(f=>f.id)).size,data.features.length);
    for(const feature of data.features) {
      assert.ok(feature.properties.name);assert.ok(feature.properties['name:zh']);
      assert.equal(feature.geometry.type,'Point');
      const [lon,lat]=feature.geometry.coordinates;
      assert.ok(lon>=-180&&lon<=180&&lat>=-90&&lat<=90);
      assert.ok(Number.isFinite(feature.properties.rank));
    }
    if(file==='places')for(const name of ['巴黎','东京','纽约','伦敦'])assert.ok(data.features.some(f=>f.properties['name:zh']===name),name);
  }
});
