import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {MONGOLIA_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),mongolia=data.events.filter(e=>e.periodId?.startsWith('mn-')),byId=new Map(mongolia.map(e=>[e.id,e]));

test('Mongolian corpus uses independent periods and sourced geographic records',()=>{
  assert.equal(periodsForCountry('MN'),MONGOLIA_PERIODS);assert.ok(Object.isFrozen(MONGOLIA_PERIODS));assert.ok(mongolia.length>=451);
  assert.deepEqual(periodBounds('all',2026,'MN'),[-4799,2026]);
  const specific=MONGOLIA_PERIODS.filter(p=>!p.navigationOnly);assert.equal(specific.length,9);
  for(const p of MONGOLIA_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');}
  for(const p of specific)assert.ok(mongolia.some(e=>e.periodId===p.id),p.id);
  const ids=new Set(),titles=new Set();
  for(const e of mongolia){
    assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);
    assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);
    assert.equal(periodForEvent(e,'MN')?.id,e.periodId,e.id);for(const code of ['CN','JP','KR','KP'])assert.equal(periodForEvent(e,code),null,e.id);
    assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'MN')).length,1,e.id);
    const p=places.get(e.placeId);assert.equal(p?.countryCode,'MN',e.id);assert.ok(p.regionName&&p.regionCode&&Number.isFinite(p.lon)&&Number.isFinite(p.lat),e.id);
    assert.ok(p.lon>=87&&p.lon<=120&&p.lat>=41&&p.lat<=53,e.id);assert.equal(new URL(e.sourceUrl).protocol,'https:');
    assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle),e.id);
    if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full,e.id);assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
  }
  for(const [code,count]of [['CN',4825],['JP',1101],['KR',454],['KP',446],['MN',mongolia.length]])assert.equal(data.meta.collections.filter(c=>c.countryCode===code).reduce((n,c)=>n+c.events,0),count,code);
});

test('Mongolian constitutional dates split transition years without duplicate ownership',()=>{
  for(const [before,after,oldId,newId]of [
    ['1911-12-28','1911-12-29','mn-qing','mn-bogd'],
    ['1924-11-25','1924-11-26','mn-bogd','mn-mpr'],
    ['1992-02-11','1992-02-12','mn-mpr','mn-modern'],
  ]){
    for(const [date,id]of [[before,oldId],[after,newId]]){const e={year:Number(date.slice(0,4)),date};assert.equal(periodForEvent(e,'MN')?.id,id,date);assert.deepEqual(MONGOLIA_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'MN')).map(p=>p.id),[id]);}
    const year=Number(after.slice(0,4));assert.equal(periodForEvent({year},'MN'),null);assert.equal(periodForEvent({year,date:before,periodId:newId},'MN')?.id,oldId);
  }
  assert.equal(byId.get('mn-1992-new-constitution-adopted').periodId,'mn-mpr');assert.equal(byId.get('mn-1992-new-constitution-adopted').date,'1992-01-13');
  assert.equal(byId.get('mn-1992-primary-securities-market').periodId,'mn-mpr');assert.equal(byId.get('mn-1992-new-constitution-effective').date,'1992-02-12');
});

test('Mongolian annual map selection honors dates, ongoing construction and old foreign subjects',()=>{
  for(const e of mongolia){const p=places.get(e.placeId),f={countryCode:'MN',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
    assert.equal(eventMatches(e,f,places),true,e.id);for(const year of [e.year-1,(e.endYear??e.year)+1])assert.equal(eventMatches(e,{...f,year},places),false,e.id);
    assert.equal(eventMatches(e,{...f,query:p.name},places),true,e.id);assert.equal(eventMatches(e,{...f,countryCode:'CN',period:'all'},places),false,e.id);
  }
  const old=data.events.filter(e=>places.get(e.placeId)?.countryCode==='MN'&&periodForEvent(e,'CN'));assert.equal(old.length,15);
  for(const e of old){assert.equal(periodForEvent(e,'MN'),null,e.id);assert.equal(eventMatches(e,{countryCode:'MN',period:'all',scope:'all'},places),true,e.id);}
  const building=byId.get('mn-1654-saridag-construction');for(const year of [1654,1660,1686])assert.equal(eventMatches(building,{countryCode:'MN',period:'mn-postimperial',scope:'year',year},places),true);
});

test('Ancient estimates and new airport coordinates do not imply fabricated exact sites',()=>{
  assert.equal(byId.get('mn--1199-deer-stone-bronze-age').date,null);assert.match(byId.get('mn--1199-deer-stone-bronze-age').title,/约公元前1200/);
  assert.equal(byId.get('mn-1639-urga-original-foundation').placeId,'mn-burd');assert.match(byId.get('mn-1639-urga-original-foundation').summary,/不把今天乌兰巴托/);
  const airport=places.get('mn-khushig-valley');assert.ok(Math.abs(airport.lon-106.82)<0.00001&&Math.abs(airport.lat-47.64694444)<0.00001);
  assert.equal(airport.regionCode,'MN-047');assert.match(byId.get('mn-2021-new-international-airport-opened').locationNote,/旧机场/);
  assert.equal(places.get('mn-noyon-uul').regionCode,'MN-047');assert.match(byId.get('mn-1206-chinggis-onon-assembly').locationNote,/未经|不将/);
  assert.equal(byId.get('mn-2026-xiongnu-cemeteries-world-heritage').year,2026);assert.match(byId.get('mn-2026-xiongnu-cemeteries-world-heritage').sourceUrl,/decisions\/9176/);
});


test('Mongolian regional expansion distinguishes source months, historic sites and service periods',()=>{
  const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
  assert.equal(get('mn-1260-ariq-boke-election').date,'1260-06');assert.equal(get('mn-1260-ariq-boke-election').precision,'month');
  assert.equal(get('mn-1925-first-western-hospital').date,'1925-10');assert.equal(get('mn-1921-bogd-government-restoration').date,'1921-02');
  assert.notEqual(places.get('mn-delgerkhaan-tuv').id,places.get('mn-khuduu-aral').id);assert.ok(places.get('mn-delgerkhaan-tuv').lon<106&&places.get('mn-khuduu-aral').lon>109);
  assert.equal(places.get('mn-buren').regionCode,'MN-047');assert.equal(places.get('mn-tsetserleg').regionCode,'MN-073');assert.equal(places.get('mn-tsagaannuur-selenge').regionCode,'MN-049');
  assert.equal(get('mn-1942-dundgovi-provincial-assembly').placeId,'mn-mandalgovi');assert.match(get('mn-1942-dundgovi-provincial-assembly').locationNote,/46公里/);
  assert.equal(get('mn-1987-khovsgol-museum-zoo').endYear,1993);for(const year of [1987,1990,1993])assert.equal(eventMatches(get('mn-1987-khovsgol-museum-zoo'),{countryCode:'MN',period:'mn-mpr',scope:'year',year},places),true);
  for(const year of [1986,1994])assert.equal(eventMatches(get('mn-1987-khovsgol-museum-zoo'),{countryCode:'MN',period:'all',scope:'year',year},places),false);
  assert.equal(get('mn-1931-state-central-theatre').year,1931);assert.equal(get('mn-1960-drama-theatre-building').year,1960);
  assert.equal(get('mn-1941-cyrillic-writing-adoption').date,'1941-05-09');assert.equal(get('mn-1946-cyrillic-official-implementation').date,'1946-01-01');
});


test('Mongolian expansion retains local dates, distinct earthquake epicentres and historical geography',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 assert.equal(get('mn-1905-tsetserleg-earthquake').date,'1905-07-09');assert.equal(get('mn-1905-bulnay-earthquake').date,'1905-07-23');
 assert.notEqual(get('mn-1905-tsetserleg-earthquake').placeId,'mn-tsetserleg');assert.equal(places.get('mn-tsetserleg-quake').lat,49.709);
 assert.equal(get('mn-2021-khovsgol-lake-earthquake').date,'2021-01-12');assert.match(get('mn-2021-khovsgol-lake-earthquake').summary,/世界时/);
 assert.equal(get('mn-1624-tsogt-poem-rock-inscription').precision,'year');assert.equal(get('mn-1624-tsogt-poem-rock-inscription').date,null);assert.equal(get('mn-1624-tsogt-poem-rock-inscription').placeId,'mn-delgerkhaan-tuv');
 assert.equal(get('mn-1757-chingunjav-capture-khankh').placeId,'mn-khankh');assert.match(get('mn-1757-chingunjav-capture-khankh').locationNote,/北京/);
 assert.equal(get('mn-1733-manzushir-first-construction').endYear,1747);assert.equal(get('mn-1204-naiman-nakhu-campaign').placeId,'mn-mogod');
 assert.equal(places.get('mn-baganuur').regionCode,'MN-1');assert.equal(places.get('mn-choir').regionCode,'MN-064');
});


test('Mongolian archaeological dates and local institutions retain independent geography',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 const early=get('mn--4799-tamsag-neolithic-habitation');assert.equal(early.date,null);assert.equal(early.precision,'year');assert.match(early.title,/约公元前4800/);assert.match(early.summary,/1950/);assert.equal(periodForEvent(early,'MN').id,'mn-early');
 assert.equal(places.get('mn-bayanjargalan-tuv').regionCode,'MN-047');assert.equal(places.get('mn-tariat').regionCode,'MN-073');
 assert.notEqual(get('mn-1707-nomgon-sangiin-dalai-origin').placeId,get('mn-1853-erdenedalai-sangiin-dalai-expansion').placeId);
 assert.equal(get('mn-1924-danzan-execution').date,'1924-08-30');assert.equal(get('mn-1924-danzan-execution').periodId,'mn-bogd');assert.equal(get('mn-1992-danzan-bavaasan-rehabilitation').periodId,'mn-modern');
 assert.equal(get('mn-1995-tsagaan-agui-international-excavation').periodId,'mn-modern');assert.equal(get('mn-2005-boroo-swiss-mongolian-excavation').endYear,2007);
 assert.equal(get('mn-1982-bor-undur-mine-first-operation').year,1982);assert.equal(get('mn-1985-bor-undur-processing-first-stage').year,1985);assert.equal(get('mn-1990-bor-undur-processing-full-design').year,1990);assert.match(get('mn-1990-bor-undur-processing-full-design').summary,/设计/);
});


test('Mongolian legal and heritage records distinguish institutional stages and locations',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 for(const id of ['mn-1911-khalkha-july-independence-deliberation','mn-1911-khalkha-interim-administration-formation'])assert.equal(get(id).periodId,'mn-qing');
 assert.equal(get('mn-1922-nalaikh-coal-mine-nationalisation').periodId,'mn-bogd');assert.equal(get('mn-1927-supreme-court-operation-begins').date,'1927-01-01');
 const mine=get('mn-1958-nalaikh-large-mine-construction-completion');assert.match(mine.summary,/设计/);assert.equal(mine.placeId,'mn-nalaikh');
 const city=places.get('mn-sukhbaatar'),province=places.get('mn-baruun-urt');assert.equal(city.regionCode,'MN-049');assert.equal(province.regionCode,'MN-051');assert.notEqual(city.lon,province.lon);
 const burial=get('mn-2004-tavan-tolgoi-num-initial-excavation');assert.equal(places.get(burial.placeId).regionCode,'MN-051');assert.ok(burial.sources.some(s=>s.url.includes('radiocarbon')));assert.notEqual(burial.placeId,'mn-tavan-tolgoi');
 assert.equal(get('mn-1958-central-stadium-opening').date,'1958-11-14');assert.notEqual(get('mn-1958-central-sports-palace-opening').id,get('mn-1958-central-stadium-opening').id);
 assert.match(get('mn-1944-franchise-restrictions-1944-amendment').summary,/不称为妇女首次/);assert.match(get('mn-2008-urtiin-duu-joint-representative-list').summary,/中国与蒙古/);assert.match(get('mn-2023-constitution-parliament-126-members-reform').summary,/四十八/);
});


test('Mongolian manuscript, legal and disaster records retain distinct dates and scopes',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 assert.equal(get('mn-1921-bogd-government-tangarag-agreement').date,'1921-11-01');assert.equal(get('mn-1922-hereditary-dependent-service-abolition').periodId,'mn-bogd');
 assert.equal(get('mn-1922-bodoo-political-execution').date,'1922-08-31');assert.equal(get('mn-1997-bodoo-group-judicial-rehabilitation').date,'1997-06-11');
 assert.equal(get('mn-1601-tsogt-white-house-temple-construction').endYear,1617);assert.match(get('mn-1635-sholoi-invitation-ligden-household').summary,/未实现/);
 assert.equal(get('mn-1970-khalkha-birch-bark-manuscript-discovery').placeId,'mn-dashinchilen');assert.match(get('mn-1614-khalkha-autumn-birch-bark-law').locationNote,/不定位到/);
 assert.match(get('mn-1996-forest-steppe-fire-emergency').summary,/森林/);assert.equal(get('mn-2000-constitutional-court-1999-amendments-annulment').date,'2000-11-29');
 assert.equal(get('mn-2022-cabinet-parliament-dual-office-limit-removal').date,'2022-08-25');
});
