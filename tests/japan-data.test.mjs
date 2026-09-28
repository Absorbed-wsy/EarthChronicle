import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {HISTORY_PERIODS,JAPAN_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';

const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p]));
const japan=data.events.filter(e=>e.periodId?.startsWith('jp-'));
const oldChina=data.events.filter(e=>periodForEvent(e,'CN')!==null);

test('Japanese history has independent eras, source-backed events and coherent modern geography',()=>{
  assert.equal(periodsForCountry('JP'),JAPAN_PERIODS);
  assert.ok(japan.length>=1101);
  assert.equal(new Set(JAPAN_PERIODS.map(p=>p.id)).size,JAPAN_PERIODS.length);
  assert.ok(Object.isFrozen(JAPAN_PERIODS));
  for(const p of JAPAN_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');}
  const specific=JAPAN_PERIODS.filter(p=>!p.navigationOnly);
  assert.equal(specific.length,14);
  for(const p of specific)assert.ok(japan.some(e=>eventMatchesPeriod(e,p.id,'JP')),p.id);
  assert.deepEqual(periodBounds('jp-reiwa',2027,'JP'),[2019,2027]);
  assert.deepEqual(periodBounds('jp-nara',2026,'JP'),[710,794]);
  assert.equal(periodsForCountry('CN'),HISTORY_PERIODS);
  assert.equal(periodsForCountry('FR').length,1);
  const titles=new Set(),sources=new Set();
  for(const e of japan){
    assert.ok(!titles.has(e.title),e.id);titles.add(e.title);
    assert.ok(e.summary.length>=45&&e.locationNote,e.id);assert.ok(CATEGORIES.includes(e.category),e.id);
    assert.equal(periodForEvent(e,'JP')?.id,e.periodId,e.id);
    assert.equal(periodForEvent(e,'CN'),null,e.id);
    assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'JP')).length,1,e.id);
    const p=places.get(e.placeId);assert.ok(p,e.id);assert.equal(p.countryCode,'JP',e.id);
    assert.match(p.regionCode,/^JP-(?:0[1-9]|[1-3]\d|4[0-7])$/,e.id);assert.ok(p.regionName,e.id);
    assert.ok(Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90,e.id);
    assert.ok(Number.isInteger(e.year)&&e.year>=-6999&&e.year<=Number(data.meta.reviewedThrough.slice(0,4)),e.id);
    assert.ok(e.sourceTitle,e.id);assert.equal(new URL(e.sourceUrl).protocol,'https:',e.id);sources.add(e.sourceUrl);
    assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle),e.id);
    if(e.date){assert.equal(new Date(e.date).toISOString().slice(0,10),e.date,e.id);assert.equal(Number(e.date.slice(0,4)),e.year,e.id);assert.ok(e.date<=data.meta.reviewedThrough,e.id);assert.equal(e.precision,'day',e.id);}
    else assert.equal(e.precision,'year',e.id);
  }
  assert.ok(sources.size>=260,'Japanese corpus must use diverse event-specific primary or institutional sources');
  for(const category of ['政治','制度','战争','外交','经济','社会','科技','文化','灾害','营建','建都'])assert.ok(japan.some(e=>e.category===category),category);
  assert.equal(oldChina.length,3117,'existing Chinese selection must be retained');
  assert.equal(data.meta.collections.filter(c=>c.countryCode==='CN').reduce((n,c)=>n+c.events,0),oldChina.length);
  assert.equal(data.meta.collections.filter(c=>c.countryCode==='JP').reduce((n,c)=>n+c.events,0),japan.length);
});

test('Japanese period, city, keyword and annual map scopes do not leak foreign or adjacent-year records',()=>{
  for(const e of japan){
    const p=places.get(e.placeId),filter={countryCode:'JP',region:p.regionCode,city:e.placeId,period:e.periodId,scope:'year',year:e.year};
    assert.equal(eventMatches(e,filter,places),true,e.id);
    for(const year of [e.year-1,e.year+1])assert.equal(eventMatches(e,{...filter,year},places),false,e.id);
    assert.equal(eventMatches(e,{...filter,countryCode:'CN',period:'all'},places),false,e.id);
    assert.equal(eventMatches(e,{...filter,city:'different-place'},places),false,e.id);
    assert.equal(eventMatches(e,{...filter,query:p.aliases[0]??p.name},places),true,e.id);
    assert.equal(eventMatches(e,{...filter,scope:'all',year:2026},places),true,e.id);
    assert.equal(eventMatches(e,{...filter,countryCode:'all',period:'all'},places),true,e.id);
  }
  const oldAbroad=oldChina.filter(e=>places.get(e.placeId)?.countryCode==='JP');
  assert.equal(oldAbroad.length,14);
  for(const e of oldAbroad){
    assert.equal(eventMatches(e,{countryCode:'JP',period:'all',scope:'all'},places),true,e.id);
    assert.equal(periodForEvent(e,'JP'),null,e.id);
  }
  const olympics=japan.find(e=>e.id==='jp-2021-tokyo2020');
  assert.equal(olympics.year,2021);assert.equal(olympics.date,'2021-07-23');
  assert.equal(eventMatches(olympics,{countryCode:'JP',scope:'year',year:2020},places),false);
});

test('Japanese modern era changes split the same year at their verified effective civil dates',()=>{
  for(const [before,after,oldId,newId] of [
    ['1912-07-29','1912-07-30','jp-meiji','jp-taisho'],
    ['1926-12-24','1926-12-25','jp-taisho','jp-showa'],
    ['1989-01-07','1989-01-08','jp-showa','jp-heisei'],
    ['2019-04-30','2019-05-01','jp-heisei','jp-reiwa'],
  ]){
    for(const [date,id] of [[before,oldId],[after,newId]]){
      const e={year:Number(date.slice(0,4)),date};
      assert.equal(periodForEvent(e,'JP')?.id,id,date);
      assert.deepEqual(JAPAN_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'JP')).map(p=>p.id),[id]);
    }
    const uncertain={year:Number(after.slice(0,4))};
    assert.equal(periodForEvent(uncertain,'JP'),null);
    assert.equal(periodForEvent({...uncertain,periodId:newId},'JP')?.id,newId);
  }
  assert.equal(periodForEvent({year:1338,era:'元'},'JP'),null);
  assert.equal(periodForEvent({year:1338,era:'室町'},'CN'),null);
  assert.equal(periodForEvent({year:1333,periodId:'jp-kenmu'},'JP')?.id,'jp-kenmu');
  assert.equal(periodForEvent({year:1333},'JP'),null);
});

test('Japanese institution and regional records use the actual start or decision dates',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  const port=byId.get('jp-1868-kobe-port-open');assert.equal(port.date,'1868-01-01');assert.equal(periodForEvent(port,'JP')?.id,'jp-edo');assert.equal(eventMatchesPeriod(port,'jp-meiji','JP'),false);
  for(const [id,date]of [['jp-1978-okinawa-730','1978-07-30'],['jp-1989-consumption-tax-start','1989-04-01'],['jp-2009-lay-judge-system','2009-05-21'],['jp-2022-adult-age-eighteen','2022-04-01'],['jp-2024-negative-rate-policy-end','2024-03-19']])assert.equal(byId.get(id)?.date,date,id);
  const ryukyu=byId.get('jp-1470-second-sho-dynasty');assert.match(ryukyu.locationNote,/不表示当时主权归属/);
  const capsule=byId.get('jp-2020-hayabusa2-capsule-return');assert.match(capsule.locationNote,/实际在澳大利亚/);
});

test('Japanese archaeology preserves BCE conventions, approximate dates and independent country navigation',()=>{
  const first=japan.find(e=>e.id==='jp--6999-kakinoshima');assert.ok(first);assert.equal(first.date,null);assert.equal(first.precision,'year');assert.match(first.title,/约公元前7000年/);assert.match(first.locationNote,/考古约年/);
  assert.deepEqual(periodBounds('jp-early',2026,'JP'),[-6999,538]);assert.deepEqual(periodBounds('all',2026,'JP'),[-6999,2026]);assert.deepEqual(periodBounds('all',2026,'CN'),[-769,2026]);
  assert.equal(periodForEvent(first,'JP')?.id,'jp-early');assert.equal(periodForEvent(first,'CN'),null);
  for(const id of ['jp-275-hashihaka-tomb','jp-450-daisen-tomb','jp-525-imashirozuka-tomb']){const e=japan.find(e=>e.id===id);assert.ok(e);assert.match(e.title,/约/);assert.equal(e.date,null);assert.match(e.locationNote,/代表约年|代表年/);}
  const seal=japan.find(e=>e.id==='jp-57-na-gold-seal'),discovery=japan.find(e=>e.id==='jp-1784-gold-seal-discovery');assert.match(seal.locationNote,/后汉朝廷/);assert.equal(discovery.year,1784);assert.equal(discovery.periodId,'jp-edo');
  assert.equal(data.meta.coverage[0],Math.min(...data.events.map(e=>e.year)));
});

test('Japanese local coverage spans all prefectures and separates Okinawa landings, commemoration and surrender',()=>{
  assert.equal(new Set(japan.map(e=>places.get(e.placeId).regionCode)).size,47);
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const [id,date]of [['jp-1945-kerama-landings','1945-03-26'],['jp-1945-okinawa-main-island-landings','1945-04-01'],['jp-1945-okinawa-command-collapse','1945-06-23'],['jp-1945-ryukyu-surrender-signing','1945-09-07'],['jp-1978-narita-airport-open','1978-05-20'],['jp-1874-risshisha-found','1874-04-10']])assert.equal(byId.get(id)?.date,date,id);
  assert.match(byId.get('jp-1945-okinawa-command-collapse').summary,/零散战斗.*仍继续/);assert.match(byId.get('jp-1527-iwami-ginzan-discovery').summary,/1526年/);assert.match(byId.get('jp-1841-mito-kodokan').summary,/1857年/);
});

test('Japanese regional expansion has dated local industry, disaster, heritage and administrative records',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const [id,date,region]of [['jp-1872-tomioka-silk-open','1872-10-04','JP-10'],['jp-1891-nobi-earthquake-neo','1891-10-28','JP-21'],['jp-1964-niigata-earthquake','1964-06-16','JP-15'],['jp-2001-saitama-city-founded','2001-05-01','JP-11'],['jp-2004-kii-heritage-kumano','2004-07-07','JP-30'],['jp-2004-kii-heritage-iseji','2004-07-07','JP-24'],['jp-2024-sado-gold-heritage','2024-07-27','JP-15']]){const e=byId.get(id);assert.equal(e?.date,date,id);assert.equal(places.get(e.placeId)?.regionCode,region,id);}
  for(const region of ['JP-06','JP-10','JP-11','JP-12','JP-15','JP-18','JP-21','JP-24','JP-30','JP-44'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=2,region);
  assert.match(byId.get('jp-1601-sado-aikawa-mine').summary,/更早的砂金/);assert.equal(byId.get('jp-1601-sado-aikawa-mine').periodId,'jp-momoyama');
});

test('Japanese thin prefectures now include distinct source-backed local history',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-04','JP-17','JP-19','JP-20','JP-22','JP-33','JP-35','JP-39','JP-41','JP-43','JP-45'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=6,region);
  for(const [id,date]of [['jp-1877-kumamoto-castle-fire','1877-02-19'],['jp-1896-meiji-sanriku-miyagi','1896-06-15'],['jp-1933-showa-sanriku-miyagi','1933-03-03'],['jp-1945-kofu-air-raid','1945-07-06'],['jp-1945-sendai-air-raid','1945-07-10'],['jp-1946-showa-nankai-kochi','1946-12-21'],['jp-1960-chile-tsunami-miyagi','1960-05-24'],['jp-2004-minamata-supreme-court','2004-10-15'],['jp-2019-chikuma-flood-2019','2019-10-12']])assert.equal(byId.get(id)?.date,date,id);
  assert.match(byId.get('jp-1607-kumamoto-castle-traditional-completion').summary,/争论/);assert.match(byId.get('jp-1593-matsumoto-castle-tower').locationNote,/代表年/);
});

test('Japanese prefectures with three prior records now have diverse dated coverage',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-05','JP-06','JP-07','JP-08','JP-09','JP-32','JP-34','JP-36','JP-37'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=8,region);
  for(const [id,date]of [['jp-1889-akita-city-formed','1889-04-01'],['jp-1983-nihonkai-chubu-akita','1983-05-26'],['jp-1997-akita-shinkansen','1997-03-22'],['jp-1881-kuriko-tunnel-open','1881-10-03'],['jp-1967-uetsu-flood-oguni','1967-08-28'],['jp-2013-izumo-taisha-transfer','2013-05-10'],['jp-1985-onaruto-bridge-open','1985-06-08'],['jp-1999-tokaimura-criticality','1999-09-30'],['jp-1868-aizu-surrender','1868-09-22'],['jp-2022-tadami-line-reopens','2022-10-01'],['jp-1975-sanyo-shinkansen-hiroshima','1975-03-10'],['jp-1996-hiroshima-dome-unesco','1996-12-05']])assert.equal(byId.get(id)?.date,date,id);
  assert.match(byId.get('jp-1901-tanaka-ashio-petition').locationNote,/东京/);
});

test('five more thin Japanese prefectures have local politics, industry, culture and disaster coverage',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-21','JP-30','JP-31','JP-38','JP-44'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=12,region);
  for(const [id,date]of [['jp-1854-hirogawa-ansei-tsunami','1854-12-24'],['jp-1889-wakayama-city-established','1889-04-01'],['jp-1945-wakayama-air-raid','1945-07-09'],['jp-1946-showa-nankai-wakayama','1946-12-21'],['jp-2000-western-tottori-earthquake','2000-10-06'],['jp-2016-central-tottori-earthquake','2016-10-21'],['jp-1882-itagaki-gifu-attack','1882-04-06'],['jp-1976-anpachi-levee-breach','1976-09-12'],['jp-1873-ehime-prefecture-established','1873-02-20'],['jp-1888-iyotetsu-first-line','1888-10-28'],['jp-1945-matsuyama-air-raid','1945-07-26']])assert.equal(byId.get(id)?.date,date,id);
  assert.match(byId.get('jp-2015-world-tsunami-day-hirogawa').locationNote,/联合国/);
});

test('eight thin Japanese prefectures gain regionally diverse events and precise dates',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-10','JP-11','JP-12','JP-16','JP-18','JP-24','JP-25','JP-28'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=12,region);
  for(const [id,date]of [['jp-1876-mie-watarai-merged','1876-04-18'],['jp-1945-kobe-air-raid-march','1945-03-17'],['jp-2005-amagasaki-derailment','2005-04-25'],['jp-1883-toyama-prefecture-restored','1883-05-09'],['jp-1985-jal-flight-123-uenomura','1985-08-12'],['jp-1945-kumagaya-air-raid','1945-08-14'],['jp-1881-fukui-prefecture-reestablished','1881-02-07'],['jp-1873-chiba-prefecture-founded','1873-06-15']])assert.equal(byId.get(id)?.date,date,id);
  const chiba=japan.filter(e=>places.get(e.placeId)?.regionCode==='JP-12');assert.ok(new Set(chiba.map(e=>e.placeId)).size>=8);assert.ok(chiba.some(e=>e.year<1900));
});

test('Niigata, Ishikawa, Yamanashi, Nagano, Shizuoka and Aichi gain local histories',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-15','JP-17','JP-19','JP-20','JP-22','JP-23'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=14,region);
  for(const [id,date]of [['jp-1869-niigata-port-international','1869-01-01'],['jp-1898-kanazawa-railway-station','1898-04-01'],['jp-1994-matsumoto-sarin-1994','1994-06-27'],['jp-1911-hamamatsu-city-established','1911-07-01'],['jp-1945-hamamatsu-air-raid-june','1945-06-18'],['jp-1945-mikawa-earthquake-1945','1945-01-13'],['jp-2022-kyoutou-fruit-heritage','2022-07-18']])assert.equal(byId.get(id)?.date,date,id);
  assert.match(byId.get('jp-2004-chuetsu-earthquake-2004').locationNote,/多市町/);
});

test('six sparse western Japanese prefectures gain local dates and distinct topics',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-41','JP-35','JP-43','JP-33','JP-39','JP-45'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=16,region);
  for(const [id,date]of [['jp-1949-saga-prefectural-office-fire','1949-02-18'],['jp-1950-saga-prefectural-office-rebuilt','1950-12-14'],['jp-1921-ube-city-coal-development','1921-11-01'],['jp-1875-oda-prefecture-merged-okayama','1875-12-10'],['jp-1876-hojo-prefecture-merged-okayama','1876-04-18'],['jp-1891-sanyo-railway-okayama-arrives','1891-03-18'],['jp-2022-nishi-kyushu-shinkansen-saga','2022-09-23']])assert.equal(byId.get(id)?.date,date,id);
  assert.match(byId.get('jp-1975-sameura-dam-management-start').summary,/1973年/);
});

test('six sparse northern and southern Japanese prefectures gain regional chronology',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-02','JP-03','JP-04','JP-05','JP-37','JP-46'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=17,region);
  for(const [id,date] of [['jp-1894-akita-great-flood-1894','1894-08-24'],['jp-1896-rikuu-earthquake-akita','1896-08-31'],['jp-1902-akita-station-rail-open','1902-10-21'],['jp-1955-shiun-maru-ferry-disaster','1955-05-11']])assert.equal(byId.get(id)?.date,date,id);
  assert.match(byId.get('jp-1858-hashino-blast-furnaces-built').summary,/1860年/);
  assert.match(byId.get('jp-1871-kagawa-first-prefecture').summary,/1871年/);
});

test('six thin prefectures gain history across periods and localities',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-06','JP-07','JP-08','JP-09','JP-32','JP-36'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=18,region);
  for(const [id,date]of [['jp-1992-yamagata-shinkansen-to-yamagata','1992-07-01'],['jp-1999-yamagata-shinkansen-to-shinjo','1999-12-04']])assert.equal(byId.get(id)?.date,date,id);
  assert.match(byId.get('jp-1871-tochigi-utsunomiya-two-prefectures').summary,/1871年/);
  assert.match(byId.get('jp-1657-dai-nihonshi-editing-start').summary,/1906年/);
});

test('six additional Japanese prefectures gain distinct regional histories',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-40','JP-34','JP-28','JP-21','JP-24','JP-38'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=18,region);
  assert.equal(byId.get('jp-1945-gifu-city-air-raid')?.date,'1945-07-09');
  assert.equal(byId.get('jp-1335-kenmu-ise-shrine-hojo-land')?.periodId,'jp-kenmu');
  assert.match(byId.get('jp-1976-shirakawa-ogimachi-preservation').summary,/1995年/);
});

test('Fukui, Toyama and Tottori gain early and local history',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-18','JP-16','JP-31'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=21,region);
  assert.equal(byId.get('jp-1243-dogen-moves-to-echizen')?.periodId,'jp-kamakura');
  assert.equal(byId.get('jp-1183-kurikara-battle-yoshinaka')?.periodId,'jp-heian');
  assert.equal(byId.get('jp-1912-sanin-main-line-connects-tottori')?.date,'1912-03-01');
  assert.equal(byId.get('jp-2004-fukui-heavy-rain-2004')?.date,'2004-07-18');
});

test('Wakayama, Shiga and Gunma have broader regional chronology',()=>{
  const byId=new Map(japan.map(e=>[e.id,e]));
  for(const region of ['JP-30','JP-25','JP-10'])assert.ok(japan.filter(e=>places.get(e.placeId)?.regionCode===region).length>=24,region);
  assert.equal(byId.get('jp-672-jinshin-seta-bridge-battle')?.periodId,'jp-asuka');
  assert.equal(byId.get('jp-1585-ota-castle-water-siege')?.periodId,'jp-momoyama');
  assert.equal(byId.get('jp-1890-ertugrul-kashino-wreck')?.date,'1890-09-16');
  assert.equal(byId.get('jp-2007-oze-national-park-established')?.periodId,'jp-heisei');
});
