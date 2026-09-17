import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {countryName,countryOptions,placesInCountry,searchCountries} from '../public/geography.js';

const feature=(country_code,properties={},coordinates=[12,34])=>({type:'Feature',properties:{country_code,...properties},geometry:{type:'Point',coordinates}});
const collection=(...features)=>({type:'FeatureCollection',features});

test('country options always include China and use concise standard Chinese names',()=>{
  assert.deepEqual(countryOptions(null),[{code:'CN',name:'中国'}]);
  assert.equal(countryName(' cn '),'中国');
  assert.equal(countryName('GB'),'英国');
  assert.equal(countryName('US'),'美国');
  assert.equal(countryName('invalid'),'');
  assert.equal(countryName(null),'');
  const options=countryOptions(collection(feature('CN',{'name:zh':'中华人民共和国'}),feature('US',{name:'United States'})));
  assert.equal(options.find(country=>country.code==='CN').name,'中国');
  assert.equal(options.find(country=>country.code==='US').name,'美国');
});

test('country options deduplicate normalized codes, reject malformed codes and retain actual coordinates',()=>{
  const options=countryOptions(collection(
    feature('us',{name:'United States'},[NaN,30]),
    feature('US',{},[-98,39]),
    feature('-99'),feature('USA'),feature('1A'),feature(''),feature(null)
  ),[{countryCode:'us',countryName:'美利坚合众国'},{countryCode:'FR',countryName:'法国'}]);
  assert.equal(options.length,3);
  assert.deepEqual(options.find(country=>country.code==='US'),{code:'US',name:'美国',lon:-98,lat:39});
  assert.deepEqual(options.find(country=>country.code==='FR'),{code:'FR',name:'法国'});
  assert.ok(options.every(country=>/^[A-Z]{2}$/.test(country.code)));
  assert.deepEqual(options,[...options].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hans')||a.code.localeCompare(b.code)));
});

test('untranslated codes use provided names and never fabricate coordinates',()=>{
  const options=countryOptions(collection(
    feature('AA',{},[181,20]),
    feature('AA',{'name:zh':'资料名称',name:'Source name'}),
    feature('AB',{name:'Source name'},[20,91]),
    feature('AC',{'name:en':'English name'})
  ),[{countryCode:'AD',countryName:'安道尔'},{countryCode:'AH',countryName:'地点国家'},{countryCode:'AI'},{countryCode:'AJ'}]);
  assert.equal(options.find(country=>country.code==='AA').name,'资料名称');
  assert.deepEqual(options.find(country=>country.code==='AB'),{code:'AB',name:'Source name'});
  assert.equal(options.find(country=>country.code==='AH').name,'地点国家');
  assert.equal(options.find(country=>country.code==='AJ').name,'AJ');
  assert.equal(countryName('AA'),'AA');
});

test('country selection filters places without assigning unknown places to a country',()=>{
  const places=[{id:'a',countryCode:'CN'},{id:'b',countryCode:'FR'},{id:'c'},{id:'d',countryCode:'cn'}];
  assert.deepEqual(placesInCountry(places,'CN').map(place=>place.id),['a','d']);
  assert.deepEqual(placesInCountry(places,'FR').map(place=>place.id),['b']);
  assert.deepEqual(placesInCountry(places,'all'),places);
  assert.notEqual(placesInCountry(places,'all'),places);
  assert.deepEqual(placesInCountry(places,'invalid'),[]);
  assert.deepEqual(placesInCountry(null,'all'),[]);
});

test('bundled country labels provide a global searchable country catalogue',async()=>{
  const source=JSON.parse(await readFile(new URL('../public/maps/country-labels.geojson',import.meta.url),'utf8'));
  const options=countryOptions(source);
  assert.ok(options.length>=150);
  assert.equal(new Set(options.map(country=>country.code)).size,options.length);
  for(const code of ['CN','US','FR','JP','BR','ZA']) {
    const country=options.find(value=>value.code===code);
    assert.ok(country,code);
    assert.ok(country.name!==code);
    assert.ok(Number.isFinite(country.lon)&&Number.isFinite(country.lat));
  }
});

test('country search matches Chinese names, English names and case-insensitive ISO codes',()=>{
  const options=countryOptions(collection(feature('CN'),feature('FR'),feature('US'),feature('GB')));
  const codes=query=>searchCountries(options,query).map(country=>country.code);
  assert.deepEqual(codes('中国'),['CN']);
  assert.deepEqual(codes('法'),['FR']);
  assert.deepEqual(codes('  fRaNcE  '),['FR']);
  assert.deepEqual(codes('united states'),['US']);
  assert.deepEqual(codes('kingdom'),['GB']);
  assert.deepEqual(codes('cn'),['CN']);
  assert.deepEqual(codes('  Fr  '),['FR']);
  assert.deepEqual(codes('不存在的国家'),[]);
});

test('country search includes standard long names while retaining concise option labels',()=>{
  const options=countryOptions(collection(feature('HK'),feature('MO')));
  const hongKong=options.find(country=>country.code==='HK');
  assert.equal(hongKong.name,'香港');
  assert.deepEqual(searchCountries(options,'香港特别行政区'),[hongKong]);
  assert.deepEqual(searchCountries(options,'hong kong'),[hongKong]);
  assert.equal(hongKong.name,'香港');
});

test('country search preserves option order and data, including the all-countries option',()=>{
  const options=Object.freeze([
    Object.freeze({code:'all',name:'全部'}),
    Object.freeze({code:'US',name:'美国',lon:-98,lat:39}),
    Object.freeze({code:'GB',name:'英国',lon:-2,lat:54}),
    Object.freeze({code:'CN',name:'中国',lon:104,lat:35})
  ]);
  assert.deepEqual(searchCountries(options,'国'),options.slice(1));
  assert.deepEqual(searchCountries(options,'全部'),[options[0]]);
  assert.deepEqual(searchCountries(options,'ALL'),[options[0]]);
  assert.deepEqual(searchCountries(options,'  '),options);
  assert.notEqual(searchCountries(options,''),options);
  assert.deepEqual(searchCountries(null,''),[]);
  assert.deepEqual(searchCountries(options,null),options);
});
