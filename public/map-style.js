export const LOCAL_FONTS = ['Microsoft YaHei', 'Segoe UI', 'Arial', 'sans-serif'];

const nonempty = key => ['case', ['all', ['has', key], ['!=', ['get', key], '']], ['get', key], null];
// Keep the actual local name. Missing translations never become guessed names.
export function bilingualNameExpression() {
  return ['let', 'local', ['coalesce', nonempty('name'), nonempty('name:latin'), nonempty('name:en'), ''],
    'chinese', ['coalesce', nonempty('name:zh-Hans'), nonempty('name:zh'), nonempty('name_zh'), ''],
    ['case', ['any', ['==', ['var', 'chinese'], ''], ['==', ['var', 'local'], ''], ['==', ['var', 'local'], ['var', 'chinese']]],
      ['format', ['case', ['!=', ['var', 'chinese'], ''], ['var', 'chinese'], ['var', 'local']], {}],
      ['format', ['var', 'chinese'], {}, '\n', {}, ['var', 'local'], {'font-scale': 0.85}]]];
}

export function isPlaceLayer(layer) {
  return layer?.type === 'symbol' && (layer['source-layer'] === 'place' || layer.metadata?.['earthchronicle:place'] === true);
}

function readableSize(value) {
  if (typeof value === 'number') return Math.max(12, value);
  if (!Array.isArray(value)) return 13;
  const copy = structuredClone(value);
  if (copy[0] === 'interpolate') for (let i = 4; i < copy.length; i += 2) if (typeof copy[i] === 'number') copy[i] = Math.max(12, copy[i]);
  if (copy[0] === 'step') for (let i = 2; i < copy.length; i += 2) if (typeof copy[i] === 'number') copy[i] = Math.max(12, copy[i]);
  return copy;
}

export function buildMapStyle({theme = 'light', online = true, terrain = true, baseStyle = {}} = {}) {
  const dark = theme === 'night', paper = theme === 'paper';
  const color = dark
    ? {land:'#24343b',water:'#142d40',ink:'#e2eceb',halo:'#17272e',boundary:'#627c86',park:'#294d41'}
    : paper ? {land:'#eee6d4',water:'#b9d4d3',ink:'#514830',halo:'#faf5e7',boundary:'#b3a992',park:'#d7dfbf'}
    : {land:'#f5f3ed',water:'#b9d9e7',ink:'#314c53',halo:'#ffffff',boundary:'#a8baba',park:'#d8e8cb'};
  const sources = {
    'base-land':{type:'geojson',data:'/maps/land.geojson',attribution:'<a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>'},
    'base-countries':{type:'geojson',data:'/maps/countries.geojson'},
    'base-countries-labels':{type:'geojson',data:'/maps/country-labels.geojson'},
    'base-cities':{type:'geojson',data:'/maps/places.geojson'},
  };
  const layers = [
    {id:'base-background',type:'background',paint:{'background-color':color.water}},
    {id:'base-land',type:'fill',source:'base-land',paint:{'fill-color':color.land}},
    {id:'base-boundaries',type:'line',source:'base-countries',paint:{'line-color':color.boundary,'line-width':0.55,'line-opacity':0.65}},
  ];
  if (online) {
    sources.openmaptiles = {type:'vector',url:'https://tiles.openfreemap.org/planet',attribution:'<a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'};
    layers.push({id:'online-background',type:'background',layout:{visibility:'none'},paint:{'background-color':color.land}});
    for (const original of baseStyle.layers || []) {
      if (original.source !== 'openmaptiles') continue;
      const layer = structuredClone(original), label = layer.type === 'symbol';
      layer.paint ||= {};
      // The bundled atlas names rail icons "railway" and provides US federal
      // shields only up to three characters. Keep longer route numbers visible.
      if (layer['source-layer'] === 'poi' && layer.layout?.['icon-image']) {
        const icon = layer.layout['icon-image'];
        layer.layout['icon-image'] = ['match', icon, 'rail', 'railway', icon];
      }
      if (['highway-shield-us-interstate','road_shield_us'].includes(layer.id)) {
        layer.layout['icon-image'] = ['case', ['all', ['>', ['get','ref_length'], 3], ['!=', ['get','network'], 'us-state']],
          ['concat','road_',['get','ref_length']], layer.layout['icon-image']];
      }
      if (label && layer.layout?.['text-field']) {
        layer.layout['text-font'] = [...LOCAL_FONTS];
        // Road shields use route numbers; only names receive a translation.
        if (JSON.stringify(layer.layout['text-field']).includes('name')) layer.layout['text-field'] = bilingualNameExpression();
        layer.paint['text-color'] = color.ink;
        layer.paint['text-halo-color'] = color.halo;
        layer.paint['text-halo-width'] = 1.4;
        layer.paint['text-halo-blur'] = 0.4;
        if (isPlaceLayer(layer)) {
          layer.metadata = {...layer.metadata,'earthchronicle:place':true};
          layer.layout['text-size'] = readableSize(layer.layout['text-size']);
          layer.layout['text-line-height'] = 1.2;
          layer.layout['text-max-width'] = 11;
        }
      }
      const sourceLayer = layer['source-layer'];
      if (sourceLayer === 'water' && layer.type === 'fill') layer.paint['fill-color'] = color.water;
      if (sourceLayer === 'waterway' && layer.type === 'line') layer.paint['line-color'] = color.water;
      if (dark || paper) {
        if (layer.type === 'fill' && sourceLayer !== 'water') layer.paint['fill-color'] = /park|landcover/.test(sourceLayer) ? color.park : dark ? '#34464c' : '#e3dbc7';
        if (layer.type === 'line' && sourceLayer !== 'waterway') {
          layer.paint['line-color'] = /boundary/.test(sourceLayer) ? color.boundary : dark ? (layer.id.includes('casing') ? '#26383f' : /motorway|trunk/.test(layer.id) ? '#b4a276' : '#7a8b8e') : layer.paint['line-color'];
        }
      }
      layers.push(layer);
    }
    if (terrain) sources.terrain = {
      type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize:256,maxzoom:15,encoding:'terrarium',
      attribution:'<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Mapzen terrain</a> · <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank">USGS / SRTM / GMTED / ETOPO1</a>',
    };
    if (terrain) {
      const index = layers.findIndex(layer => layer.type === 'symbol');
      layers.splice(index < 0 ? layers.length : index, 0, {
        id:'terrain-relief',type:'hillshade',source:'terrain',minzoom:5,
        paint:{'hillshade-exaggeration':0.5,'hillshade-shadow-color':dark?'#081820':'#526751','hillshade-highlight-color':dark?'#738886':'#fffdf3','hillshade-accent-color':dark?'#314742':'#9aab8b','hillshade-illumination-direction':315,'hillshade-illumination-anchor':'viewport'},
      });
    }
  }
  const baseLabel = (id,source,country) => ({
    id,type:'symbol',source,metadata:{'earthchronicle:place':true,'earthchronicle:base-label':true},
    minzoom:country?0:2,maxzoom:country?8:24,
    filter:['<=',country?['max',0,['-', ['get','minzoom'],1.5]]:['get','minzoom'],['zoom']],
    layout:{'text-field':bilingualNameExpression(),'text-font':[...LOCAL_FONTS],'text-size':country?14:13,'text-line-height':1.2,'text-max-width':10,'symbol-sort-key':['get','rank'],'text-padding':country?10:5},
    paint:{'text-color':color.ink,'text-halo-color':color.halo,'text-halo-width':1.5},
  });
  layers.push(baseLabel('base-place-countries','base-countries-labels',true),baseLabel('base-place-cities','base-cities',false));
  // All fonts and icon sheets are local. Only visible detail tiles use the network.
  return {version:8,name:'EarthChronicle',projection:{type:'globe'},sprite:new URL('/maps/sprite',globalThis.location?.href||'http://localhost/').href,sources,layers};
}
