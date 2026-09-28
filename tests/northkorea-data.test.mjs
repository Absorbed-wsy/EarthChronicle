import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {NORTH_KOREA_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),north=data.events.filter(e=>e.periodId?.startsWith('kp-')),byId=new Map(north.map(e=>[e.id,e]));

test('Northern Korean geography has independent sourced periods and keeps all previous corpora',()=>{
  assert.equal(periodsForCountry('KP'),NORTH_KOREA_PERIODS);assert.ok(Object.isFrozen(NORTH_KOREA_PERIODS));assert.ok(north.length>=446);
  assert.deepEqual(periodBounds('all',2026,'KP'),[-2499,2026]);
  const specific=NORTH_KOREA_PERIODS.filter(p=>!p.navigationOnly);assert.equal(specific.length,10);
  for(const p of NORTH_KOREA_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');}
  for(const p of specific)assert.ok(north.some(e=>e.periodId===p.id),p.id);
  const ids=new Set(),titles=new Set(),sources=new Set(),regions=new Set();
  for(const e of north){
    assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);
    assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);
    assert.equal(periodForEvent(e,'KP')?.id,e.periodId,e.id);for(const code of ['CN','JP','KR'])assert.equal(periodForEvent(e,code),null,e.id);
    assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'KP')).length,1,e.id);
    const p=places.get(e.placeId);assert.equal(p?.countryCode,'KP',e.id);assert.match(p.regionCode,/^KP-\d{2}$/);regions.add(p.regionCode);
    assert.ok(p.regionName&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90,e.id);
    assert.ok(Number.isInteger(e.year)&&e.year>=-2499&&e.year<=2026,e.id);assert.equal(new URL(e.sourceUrl).protocol,'https:');sources.add(e.sourceUrl);
    assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle),e.id);
    if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full,e.id);assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
  }
  assert.equal(regions.size,13);assert.ok(sources.size>=245);
  for(const [code,count]of [['CN',3117],['JP',1101],['KR',454],['KP',north.length]])assert.equal(data.meta.collections.filter(c=>c.countryCode===code).reduce((n,c)=>n+c.events,0),count,code);
});

test('Northern modern periods split boundary years on the correct establishment days',()=>{
  for(const [before,after,oldId,newId]of [
    ['1897-10-11','1897-10-12','kp-joseon','kp-empire'],
    ['1910-08-28','1910-08-29','kp-empire','kp-colonial'],
    ['1945-08-14','1945-08-15','kp-colonial','kp-liberation'],
    ['1948-09-08','1948-09-09','kp-liberation','kp-dprk'],
  ]){
    for(const [date,id]of [[before,oldId],[after,newId]]){const e={year:Number(date.slice(0,4)),date};assert.equal(periodForEvent(e,'KP')?.id,id,date);assert.deepEqual(NORTH_KOREA_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'KP')).map(p=>p.id),[id]);}
    const year=Number(after.slice(0,4));assert.equal(periodForEvent({year},'KP'),null);assert.equal(periodForEvent({year,periodId:newId},'KP')?.id,newId);
    assert.equal(periodForEvent({year,date:before,periodId:newId},'KP')?.id,oldId);
  }
  assert.equal(periodForEvent({year:1948,date:'1948-08-15'},'KP')?.id,'kp-liberation');
  assert.equal(byId.get('kp-1948-dprk-established').date,'1948-09-09');
  assert.equal(byId.get('kp-1897-nampo-port-opening').date,'1897-10-01');assert.equal(byId.get('kp-1897-soongsil-founded').date,'1897-10-10');
  for(const id of ['kp-1392-jeong-mongju-assassination','kp-1392-joseon-established-gaegyeong'])assert.equal(byId.get(id).date,null,id);
  assert.equal(byId.get('kp-1392-jeong-mongju-assassination').periodId,'kp-goryeo');assert.equal(byId.get('kp-1392-joseon-established-gaegyeong').periodId,'kp-joseon');
});

test('Northern annual map filters preserve ongoing events and original foreign-subject ownership',()=>{
  for(const e of north){const p=places.get(e.placeId),f={countryCode:'KP',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
    assert.equal(eventMatches(e,f,places),true,e.id);for(const year of [e.year-1,(e.endYear??e.year)+1])assert.equal(eventMatches(e,{...f,year},places),false,e.id);
    assert.equal(eventMatches(e,{...f,query:p.name},places),true,e.id);assert.equal(eventMatches(e,{...f,scope:'all',year:2026},places),true,e.id);
    assert.equal(eventMatches(e,{...f,countryCode:'KR',period:'all'},places),false,e.id);
  }
  const old=data.events.filter(e=>places.get(e.placeId)?.countryCode==='KP'&&periodForEvent(e,'CN'));assert.equal(old.length,7);
  for(const e of old){assert.equal(periodForEvent(e,'KP'),null,e.id);assert.equal(eventMatches(e,{countryCode:'KP',period:'all',scope:'all'},places),true,e.id);}
  const famine=byId.get('kp-1996-arduous-march-crisis');for(const year of [1996,1997,1998,1999])assert.equal(eventMatches(famine,{countryCode:'KP',period:'kp-dprk',scope:'year',year},places),true);
});

test('Northern archaeological estimates, original sites and international monitoring remain explicit',()=>{
  assert.match(byId.get('kp--2499-nongpo-neolithic').title,/约公元前2500/);assert.equal(byId.get('kp--2499-nongpo-neolithic').date,null);
  assert.match(byId.get('kp-357-anak-three-tomb-inscription').summary,/分歧/);
  assert.match(byId.get('kp-776-balhae-sea-voyage').locationNote,/争议/);
  assert.equal(byId.get('kp-1019-kuju-battle').placeId,'kp-kusong');assert.equal(byId.get('kp-1348-gyeongcheonsa-pagoda').placeId,'kaesong');
  assert.match(byId.get('kp-1198-manjeok-emancipation-plan').summary,/未|计划|谋/);
  assert.match(byId.get('kp-1991-un-membership').locationNote,/纽约/);
  const nuclear=north.filter(e=>e.sourceUrl.startsWith('https://www.ctbto.org/'));assert.equal(nuclear.length,6);assert.equal(new Set(nuclear.map(e=>e.sourceUrl)).size,6);
  for(const e of nuclear){assert.equal(e.placeId,'kp-punggye-ri');assert.match(e.summary,/当量|设计/);}
  assert.ok(!north.some(e=>e.sourceUrl==='https://encykorea.aks.ac.kr/Article/E0071375'),'Historical fiction must not source the foundation of Joseon');
});

test('Northern local geography and modern archaeological dates stay distinct from historical origin',()=>{
  for(const id of ['kp-1621-jamo-fort-restored','kp-1705-jamo-fort-repaired']){assert.equal(byId.get(id).placeId,'kp-pyongsong');assert.match(byId.get(id).summary,/平城/);}
  assert.equal(byId.get('kp-1947-hungnam-industrial-college').placeId,'kp-hamhung');
  const railway=byId.get('kp-1910-pyeongnam-railway-complete');assert.equal(railway.date,'1910-10');assert.equal(railway.precision,'month');assert.equal(periodForEvent(railway,'KP').id,'kp-colonial');
  assert.equal(byId.get('kp-1948-wonsan-agricultural-college').periodId,'kp-liberation');assert.equal(byId.get('kp-1948-pyongyang-industrial-college').periodId,'kp-dprk');
  const excavation=byId.get('kp-1979-namgyeong-modern-excavation');for(const year of [1979,1980,1981])assert.equal(eventMatches(excavation,{countryCode:'KP',period:'kp-dprk',scope:'year',year},places),true);assert.equal(eventMatches(excavation,{countryCode:'KP',period:'kp-dprk',scope:'year',year:1982},places),false);
  assert.match(byId.get('kp-392-yongmyongsa-traditional-foundation').title,/约392/);assert.match(byId.get('kp-392-yongmyongsa-traditional-foundation').summary,/传统|传承/);
});
test('Northern current heritage and disaster records distinguish registration, references and the actual incident',()=>{
  for(const [year,slug]of [[2014,'arirang-intangible-heritage'],[2015,'kimchi-intangible-heritage'],[2018,'wrestling-joint-heritage'],[2022,'raengmyon-intangible-heritage'],[2024,'costume-intangible-heritage']])assert.equal(byId.get('kp-'+year+'-'+slug).year,year);
  assert.equal(byId.get('kp-2004-ryongchon-train-explosion').date,'2004-04-22');assert.equal(byId.get('kp-2004-ryongchon-train-explosion').placeId,'kp-ryongchon');
  assert.equal(byId.get('kp-2020-kaesong-liaison-office-demolished').date,'2020-06-16');
  assert.match(byId.get('kp-1993-npt-withdrawal-notice').summary,/通知|暂停/);
  assert.match(byId.get('kp-2018-wrestling-joint-heritage').locationNote,/毛里求斯/);
  assert.match(byId.get('kp-2016-north-hamgyong-floods').locationNote,/多县域|多县/);
});

test('Northern local movements and industrial stages retain original sites and distinct dates',()=>{
  assert.equal(byId.get('kp-1903-sungeui-girls-school-founded').date,'1903-10-31');assert.equal(byId.get('kp-1907-osan-school-founded').placeId,'kp-chongju');assert.match(byId.get('kp-1907-osan-school-founded').locationNote,/首尔/);
  for(const [id,date]of [['kp-1919-sonchon-school-independence-march','1919-03-01'],['kp-1919-sonchon-market-mass-demonstration','1919-03-04'],['kp-1919-haeju-gisaeng-independence-march','1919-04-01'],['kp-1930-hamhung-student-solidarity-march','1930-01-14']])assert.equal(byId.get(id).date,date,id);
  for(const [id,place]of [['kp-1914-songrim-steelworks-founded','kp-songrim'],['kp-1918-songrim-steelworks-production','kp-songrim'],['kp-1936-hochon-hydropower-start','kp-hochon'],['kp-1943-hochon-four-stations-completed','kp-hochon'],['kp-1935-jangjin-first-station-online','kp-yonggwang']])assert.equal(byId.get(id).placeId,place,id);
  assert.equal(byId.get('kp-1935-jangjin-pyongyang-high-voltage-link').placeId,'pyongyang');assert.match(byId.get('kp-1935-jangjin-pyongyang-high-voltage-link').locationNote,/接收/);
  assert.equal(byId.get('kp-1956-third-party-congress').sourceUrl,'https://encykorea.aks.ac.kr/Article/E0051961');assert.ok(!north.some(e=>e.sourceUrl==='https://encykorea.aks.ac.kr/Article/E0051960'));
});
test('Northern publications, international reports and health plans identify their actual objects',()=>{
  assert.match(byId.get('kp-1957-korean-cinema-magazine-founded').title,/杂志/);assert.equal(byId.get('kp-1982-grand-peoples-study-house-opened').date,'1982-04-01');assert.match(byId.get('kp-1982-grand-peoples-study-house-opened').summary,/图书馆|学制/);
  assert.equal(byId.get('kp-2011-kim-jong-il-death-transition').date,'2011-12-17');assert.match(byId.get('kp-2011-kim-jong-il-death-transition').summary,/两日后/);
  const report=byId.get('kp-2014-un-human-rights-inquiry-report');assert.match(report.summary,/法院|刑事判决/);assert.match(report.locationNote,/境外/);
  const health=byId.get('kp-2024-nationwide-catch-up-vaccination');assert.equal(health.precision,'month');assert.match(health.summary,/计划|不当作/);assert.match(health.locationNote,/曼谷/);
});


test('Northern fourth expansion separates disputed chronology, old towns and modern reference points',()=>{
  for(const id of ['kp--193-wiman-takes-power','kp-23-wang-diao-lelang-revolt','kp-30-wang-diao-revolt-suppressed'])assert.equal(byId.get(id).periodId,'kp-early');
  assert.match(byId.get('kp--193-wiman-takes-power').locationNote,/辽东|平壤说/);
  const gate=byId.get('kp-1433-kyongsong-south-gate-built');assert.equal(gate.placeId,'kp-sungam');assert.equal(places.get(gate.placeId).countryCode,'KP');assert.match(gate.locationNote,/朱乙/);assert.notEqual(gate.placeId,'kp-kyongsong');
  const survey=byId.get('kp-1958-daesong-fort-excavations');assert.equal(survey.date,'1958-05');assert.equal(survey.endYear,undefined);assert.match(survey.summary,/约三年/);
  for(const id of ['kp-1966-geomunmoru-cave-excavation','kp-1980-yonggok-cave-human-remains']){const e=byId.get(id);assert.equal(e.periodId,'kp-dprk');assert.match(e.summary,/差异|质疑|争议/);for(let y=e.year;y<=e.endYear;y++)assert.equal(eventMatches(e,{countryCode:'KP',period:'kp-dprk',scope:'year',year:y},places),true);}
  assert.equal(byId.get('kp-1951-kimchaek-city-renamed').placeId,'kp-kimchaek');assert.match(byId.get('kp-1951-kimchaek-city-renamed').summary,/清津/);
});

test('Northern financial, hydropower and heritage entries distinguish national systems and different registries',()=>{
  const reform=byId.get('kp-2009-currency-reform-fifth');assert.equal(reform.date,'2009-11-30');assert.match(reform.summary,/现金按百比一.*存款按十比一/);
  assert.equal(byId.get('kp-1952-supung-hydropower-air-raid').date,'1952-06-23');assert.match(byId.get('kp-1952-supung-hydropower-air-raid').summary,/不意味着水坝/);
  for(const [id,year]of [['kp-1989-paektu-biosphere-designation',1989],['kp-2025-paektu-global-geopark-designation',2025]]){const e=byId.get(id);assert.equal(e.year,year);assert.equal(e.placeId,'kp-samjiyon');assert.match(e.locationNote,/朝鲜侧/);}
  assert.match(byId.get('kp-2025-paektu-global-geopark-designation').summary,/世界遗产/);
  const health=byId.get('kp-2019-jongju-child-health-day');assert.equal(health.date,null);assert.equal(health.precision,'year');assert.match(health.summary,/发布日期/);
});


test('Northern fifth expansion separates staged rail construction, institutional ceremonies and old county towns',()=>{
  for(const [id,date]of [['kp-1905-gyeongui-north-section-completed','1905-01-26'],['kp-1905-taedong-rail-bridge-completed','1905-03-29'],['kp-1906-chongchon-rail-bridge-completed','1906-03-25'],['kp-1939-manpo-railway-fully-opened','1939-02'],['kp-1939-manpo-border-bridge-completed','1939-09-28']])assert.equal(byId.get(id).date,date,id);
  assert.match(byId.get('kp-1939-manpo-border-bridge-completed').locationNote,/集安/);
  assert.equal(byId.get('kp-2009-pust-opening-ceremony').date,'2009-09-16');assert.equal(byId.get('kp-2010-pust-first-teaching').date,'2010-10-25');
  assert.equal(byId.get('kp-1948-liberation-struggle-museum-founded').periodId,'kp-liberation');assert.equal(byId.get('kp-1972-revolution-museum-mansudae-opening').date,'1972-04-24');
  assert.match(byId.get('kp-1950-unsan-battle-us-chinese-forces').locationNote,/温井|旧云山/);
  assert.equal(places.get('kp-unsan').regionCode,'KP-03');assert.equal(places.get('kp-chosan').regionCode,'KP-04');assert.notEqual(places.get('kp-chongpyong').id,'kp-chongju');
});

test('Northern military and county health records retain duration and data provenance',()=>{
  for(const [id,date]of [['kp-1951-kaesong-armistice-talks-open','1951-07-10'],['kp-1951-panmunjom-armistice-talks-resumed','1951-10-25'],['kp-1951-wonsan-naval-blockade','1951-02-16']])assert.equal(byId.get(id).date,date,id);
  const blockade=byId.get('kp-1951-wonsan-naval-blockade');for(const y of [1951,1952,1953])assert.equal(eventMatches(blockade,{countryCode:'KP',period:'kp-dprk',scope:'year',year:y},places),true);
  const water=byId.get('kp-2019-myonggan-gravity-water-system');assert.equal(water.placeId,'kp-myonggan');assert.equal(water.date,null);assert.match(water.summary,/发布日/);
  const aid=byId.get('kp-2019-yonggwang-lingling-flood-relief');assert.equal(aid.placeId,'kp-yonggwang');assert.match(aid.summary,/估计|全国/);
  assert.equal(byId.get('kp-2017-national-mics-household-survey').date,null);assert.match(byId.get('kp-2017-national-mics-household-survey').summary,/2018|出版/);
});
