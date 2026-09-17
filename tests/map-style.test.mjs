import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMapStyle,isPlaceLayer,LOCAL_FONTS} from '../public/map-style.js';

const baseStyle=JSON.parse(await readFile(new URL('../public/maps/liberty.json',import.meta.url),'utf8'));

test('bundled overview works without any online tile, font or sprite dependency',()=>{
  const style=buildMapStyle({online:false,baseStyle});
  assert.equal(style.glyphs,undefined);
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
    assert.equal(style.glyphs,undefined);
    assert.equal(style.sources.ne2_shaded,undefined);
    assert.equal(style.layers.find(l=>l.id==='online-background').layout.visibility,'none');
    for(const layer of style.layers.filter(isPlaceLayer)) {
      assert.deepEqual(layer.layout['text-font'],LOCAL_FONTS);
      assert.match(JSON.stringify(layer.layout['text-field']),/name:zh-Hans/);
      assert.match(JSON.stringify(layer.layout['text-field']),/"name"/);
    }
    assert.equal(new Set(style.layers.map(l=>l.id)).size,style.layers.length);
  }
  assert.equal(JSON.stringify(baseStyle),original,'theme changes must not mutate the source style');
  assert.equal(buildMapStyle({terrain:false,baseStyle}).sources.terrain,undefined);
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
