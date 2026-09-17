const normalizeCode=value=>typeof value==='string'&&/^[a-z]{2}$/i.test(value.trim())?value.trim().toUpperCase():'';
const text=value=>typeof value==='string'?value.trim():'';
let displayNames;
try {
  displayNames=new Intl.DisplayNames(['zh-Hans'],{type:'region',style:'short',fallback:'none'});
} catch {}
const searchDisplayNames=[];
for(const [locale,style] of [['zh-Hans','long'],['en','long'],['en','short']]) {
  try {searchDisplayNames.push(new Intl.DisplayNames([locale],{type:'region',style,fallback:'none'}));} catch {}
}

function translatedName(code) {
  try {return text(displayNames?.of(code));} catch {return '';}
}

export function countryName(code) {
  const normalized=normalizeCode(code);
  return normalized?(translatedName(normalized)||normalized):'';
}

function pointCoordinates(geometry) {
  if(geometry?.type!=='Point'||!Array.isArray(geometry.coordinates))return null;
  const [lon,lat]=geometry.coordinates;
  return Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=90?{lon,lat}:null;
}

// These modern countries are location filters, not reconstructions of historical borders.
export function countryOptions(featureCollection,places=[]) {
  const countries=new Map();
  const add=(value,names=[],coordinates=null)=>{
    const code=normalizeCode(value);
    if(!code)return;
    const candidates=[translatedName(code),...names.map(text),code];
    const rank=candidates.findIndex(Boolean);
    const name=candidates[rank];
    const existing=countries.get(code);
    if(!existing)countries.set(code,{code,name,rank,...coordinates});
    else {
      if(rank<existing.rank){existing.name=name;existing.rank=rank;}
      if(coordinates&&!Number.isFinite(existing.lon))Object.assign(existing,coordinates);
    }
  };
  for(const feature of Array.isArray(featureCollection?.features)?featureCollection.features:[]) {
    const properties=feature?.properties||{};
    add(properties.country_code,[properties['name:zh'],properties.name,properties['name:en'],''],pointCoordinates(feature?.geometry));
  }
  for(const place of Array.isArray(places)?places:[])add(place?.countryCode,['','','',place?.countryName]);
  add('CN',['中国','','','']);
  return [...countries.values()].map(({rank,...country})=>country).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hans')||a.code.localeCompare(b.code));
}

export function placesInCountry(places,countryCode) {
  const values=Array.isArray(places)?places:[];
  if(text(countryCode).toLowerCase()==='all')return [...values];
  const code=normalizeCode(countryCode);
  return code?values.filter(place=>normalizeCode(place?.countryCode)===code):[];
}

export function searchCountries(countries,query) {
  const values=Array.isArray(countries)?countries:[];
  const needle=text(query).normalize('NFKC').toLowerCase();
  if(!needle)return [...values];
  return values.filter(country=>{
    const names=[text(country?.name),text(country?.code)];
    const code=normalizeCode(country?.code);
    if(code)for(const translator of searchDisplayNames) {
      try {names.push(text(translator.of(code)));} catch {}
    }
    return names.some(name=>name.normalize('NFKC').toLowerCase().includes(needle));
  });
}
