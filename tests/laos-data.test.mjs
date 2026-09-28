import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {LAOS_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),laos=data.events.filter(e=>e.periodId?.startsWith('la-')),byId=new Map(laos.map(e=>[e.id,e]));
test('Laos corpus has independent periods, sourced dates, categories and regional geography',()=>{
 assert.equal(periodsForCountry('LA'),LAOS_PERIODS);assert.ok(laos.length>=451);assert.deepEqual(periodBounds('all',2026,'LA'),[-9299,2026]);assert.ok(Object.isFrozen(LAOS_PERIODS));
 const specific=LAOS_PERIODS.filter(p=>!p.navigationOnly);assert.equal(specific.length,6);for(const p of LAOS_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');}
 for(const p of specific)assert.ok(laos.some(e=>e.periodId===p.id),p.id);
 const ids=new Set(),titles=new Set(),sources=new Set(),regions=new Set();
 for(const e of laos){
  assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);sources.add(e.sourceUrl);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);assert.equal(periodForEvent(e,'LA')?.id,e.periodId,e.id);assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'LA')).length,1,e.id);
  for(const c of ['CN','JP','KR','KP','MN','VN'])assert.equal(periodForEvent(e,c),null,e.id);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'LA',e.id);assert.ok(p.regionName&&p.regionCode&&p.lon>=100&&p.lon<=108&&p.lat>=13&&p.lat<=23);regions.add(p.regionCode);
  assert.equal(new URL(e.sourceUrl).protocol,'https:');assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle));
  if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full);assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.ok(sources.size>=50);assert.ok(regions.size>=18);for(const category of ['政治','军事','外交','经济','社会','科技','文化','灾害'])assert.ok(laos.some(e=>e.category===category),category);
 assert.equal(data.meta.collections.filter(p=>p.countryCode==='LA').reduce((n,p)=>n+p.events,0),laos.length);
});
test('Laos civil-date transitions do not place one event in both old and new periods',()=>{
 for(const [date,id]of [['1893-10-02','la-divided'],['1893-10-03','la-colonial'],['1953-10-21','la-colonial'],['1953-10-22','la-royal'],['1975-12-01','la-royal'],['1975-12-02','la-modern']]){
  const e={year:Number(date.slice(0,4)),date};assert.equal(periodForEvent(e,'LA')?.id,id);assert.deepEqual(LAOS_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'LA')).map(p=>p.id),[id]);
 }
 for(const year of [1893,1953,1975])assert.equal(periodForEvent({year},'LA'),null);
 for(const id of ['la-1950-us-recognizes-laos','la-1945-lao-issara-independence-declaration'])assert.equal(byId.get(id).periodId,'la-colonial');
 assert.equal(byId.get('la-1975-lao-pdr-proclaimed').date,'1975-12-02');assert.equal(byId.get('la-1707-lan-xang-partition').periodId,'la-divided');
});
test('Laos annual, country, city and text filters keep regional records discoverable',()=>{
 for(const e of laos){const p=places.get(e.placeId),f={countryCode:'LA',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,f,places),true,e.id);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);assert.equal(eventMatches(e,{...f,year:(e.endYear??e.year)+1},places),false);
  assert.equal(eventMatches(e,{...f,query:p.name},places),true);assert.equal(eventMatches(e,{...f,countryCode:'VN',period:'all'},places),false);
 }
 const palace=byId.get('la-1904-royal-palace-construction');assert.equal(palace.endYear,1909);assert.equal(eventMatches(palace,{countryCode:'LA',scope:'year',year:1909},places),true);assert.equal(eventMatches(palace,{countryCode:'LA',scope:'year',year:1910},places),false);
});
test('Laos archaeological estimates, ceasefires and overseas launch retain precision and location limits',()=>{
 assert.equal(byId.get('la--499-jar-funerary-culture-estimate').date,null);assert.match(byId.get('la-1050-vat-phou-sanctuary-eleventh-century').summary,/九至十世纪/);
 assert.match(byId.get('la-1954-geneva-laos-ceasefire-agreement').summary,/北京平均时/);assert.equal(byId.get('la-1973-vientiane-peace-agreement').date,'1973-02-21');
 const launch=byId.get('la-2015-laosat-one-launched');assert.match(launch.summary,/UTC/);assert.match(launch.summary,/北京时间/);assert.match(launch.locationNote,/西昌/);
 assert.equal(byId.get('la-2015-vaccine-derived-polio-report').date,'2015-10-08');assert.match(byId.get('la-2010-nam-theun-two-commercial-operation').locationNote,/安置村/);
 assert.equal(byId.get('la-2021-first-covax-shipment').date,'2021-03-20');assert.match(byId.get('la-2018-polio-immunization-campaign').summary,/目标/);
 assert.equal(byId.get('la-2025-hinnamno-transboundary-heritage').precision,'month');assert.match(byId.get('la-2018-xe-pian-dam-collapse').locationNote,/不以城镇坐标代替坝址/);
});

test('Laos expanded archaeology stays within navigation and distinguishes research from fossil age',()=>{
 const jars=byId.get('la--949-site-two-jar-placement-estimate');assert.equal(jars.date,null);assert.match(jars.summary,/1240至660/);assert.equal(periodForEvent(jars,'LA')?.id,'la-early');
 assert.equal(eventMatches(jars,{countryCode:'LA',scope:'year',year:-949},places),true);assert.equal(eventMatches(jars,{countryCode:'LA',scope:'year',year:-950},places),false);
 const research=byId.get('la-2015-tam-pa-ling-morphology-paper');assert.equal(research.date,'2015-04-07');assert.match(research.summary,/发表/);assert.equal(byId.get('la-2023-tam-pa-ling-oldest-dating').date,'2023-06-13');
 assert.match(byId.get('la-1904-sayabuli-right-bank-convention').date,/^1904-02$/);assert.equal(byId.get('la-2012-pasteur-institute-open').date,'2012-01-23');
});
test('Laos local events retain separate migrations, legal stages, city aliases and local dates',()=>{
 const local=byId.get('la-1976-samakhisay-villages-merged');assert.match(local.locationNote,/十五公里/);assert.notEqual(local.id,byId.get('la-1976-houayhok-fire-relocation').id);
 const town=places.get('la-pakse'),oldTown=places.get('la-champasak');assert.notEqual(town.id,oldTown.id);assert.equal(town.name,'巴色');assert.equal(oldTown.name,'占巴塞');
 assert.equal(byId.get('la-1991-border-treaty-signed').date,'1991-10-24');assert.equal(byId.get('la-1992-border-treaty-effective').date,'1992-01-21');
 assert.equal(byId.get('la-2013-xaysomboun-province-created').date,'2013-12-13');assert.match(byId.get('la-2013-phongsali-ethnic-museum-exhibition').summary,/新展陈/);
 assert.equal(byId.get('la-2019-northern-laos-earthquake').date,'2019-11-21');assert.match(byId.get('la-2019-northern-laos-earthquake').summary,/UTC11月20日/);
 const flood=byId.get('la-2019-southern-podul-kajiki-flood');assert.equal(flood.date,'2019-08');assert.match(flood.summary,/8月29日至9月2日/);
 const bridge=byId.get('la-2011-third-friendship-bridge-open');assert.equal(bridge.placeId,'la-thakhek');assert.equal(bridge.date,'2011-11-11');
 assert.equal(byId.get('la-2015-japanese-encephalitis-campaign').date,'2015-04-20');assert.equal(byId.get('la-2015-fourth-national-census').date,'2015-03-01');
});

test('Laos treaty, independence and war records distinguish inscription and report dates',()=>{
 const treaty=byId.get('la-1560-lanxang-ayutthaya-friendship');assert.equal(treaty.year,1560);assert.equal(treaty.date,null);assert.equal(treaty.periodId,'la-lanxang');assert.match(treaty.summary,/1563/);assert.match(treaty.locationNote,/泰国/);
 const fragments=byId.get('la-1905-treaty-stone-fragments-rescue');assert.equal(fragments.endYear,1914);assert.match(fragments.summary,/运输途中船难/);
 assert.equal(byId.get('la-1949-franco-lao-general-convention').date,'1949-07-19');assert.equal(byId.get('la-1949-franco-lao-general-convention').periodId,'la-colonial');assert.match(byId.get('la-1949-franco-lao-general-convention').locationNote,/巴黎/);
 assert.equal(byId.get('la-1902-holy-men-savannakhet-attack').date,'1902-04');assert.equal(byId.get('la-1953-sam-neua-april-offensive').date,'1953-04');assert.equal(byId.get('la-1963-quinim-assassinated').date,'1963-04-01');
 assert.equal(byId.get('la-1960-vientiane-december-battle').date,'1960-12');assert.equal(byId.get('la-1961-partial-ceasefire-negotiations').date,'1961-05');assert.match(byId.get('la-1961-partial-ceasefire-negotiations').summary,/局部停火/);
});
test('Laos regional institutions and warfare remain distinct from national currency and culture projects',()=>{
 const press=byId.get('la-1968-kpl-news-agency-founded'),treasury=byId.get('la-1968-patriotic-front-central-treasury');assert.equal(press.placeId,'la-viengxai');assert.equal(treasury.placeId,press.placeId);assert.equal(press.date,'1968-01-06');assert.equal(treasury.date,'1968-10-07');assert.equal(treasury.periodId,'la-royal');
 const exchange=byId.get('la-1976-unified-kip-circulation');assert.equal(exchange.date,'1976-06');assert.equal(exchange.periodId,'la-modern');assert.equal(exchange.placeId,'la-vientiane');
 const battle=byId.get('la-1971-lam-son-seven-nineteen');assert.equal(battle.date,'1971-02-08');assert.equal(places.get(battle.placeId).name,'车邦');assert.equal(places.get(battle.placeId).regionName,'沙湾拿吉省');assert.equal(eventMatches(battle,{countryCode:'LA',city:'la-xepon',year:1971,scope:'year'},places),true);
 const offensive=byId.get('la-1971-sayasila-southern-offensive');assert.equal(offensive.date,'1971-07-27');assert.match(offensive.summary,/年底/);assert.equal(offensive.placeId,'la-salavan');
 assert.equal(byId.get('la-1936-phra-keo-restoration').endYear,1942);assert.equal(byId.get('la-1957-patuxai-construction').endYear,1968);
 assert.equal(byId.get('la-2007-digital-manuscripts-project-start').date,'2007-10');assert.equal(byId.get('la-2007-digital-manuscripts-project-start').endYear,2011);assert.equal(byId.get('la-2009-manuscripts-online-library').year,2009);
 assert.equal(byId.get('la-1992-red-cross-independent-status').date,'1992-04-04');assert.equal(byId.get('la-2017-red-cross-law-adopted').periodId,'la-modern');
});

test('Laos prehistoric expansion preserves calibrated intervals and distinguishes excavation years',()=>{
 const old=byId.get('la--9299-vang-ta-leow-hearth-dating-estimate');assert.equal(old.date,null);assert.equal(old.endYear,-9199);assert.equal(periodBounds('all',2026,'LA')[0],old.year);assert.equal(periodForEvent(old,'LA')?.id,'la-early');assert.match(old.summary,/9300至9200/);
 for(const [year,expected]of [[-9300,false],[-9299,true],[-9200,true],[-9199,true],[-9198,false]])assert.equal(eventMatches(old,{countryCode:'LA',scope:'year',year},places),expected);
 const burial=byId.get('la-130-phou-phaa-khao-iron-age-burial-estimate');assert.equal(burial.endYear,350);assert.match(burial.summary,/切入较早/);assert.equal(byId.get('la-2008-vang-ta-leow-test-excavation').periodId,'la-modern');assert.equal(byId.get('la-2010-tham-an-mah-jar-burial-excavation').date,'2010-01');
 const inscription=byId.get('la-1510-somphou-temple-land-inscription');assert.equal(places.get(inscription.placeId).name,'沙那坎');assert.match(inscription.summary,/年代争议/);assert.equal(byId.get('la-1535-photisarath-sangha-supervision-inscription').precision,'year');assert.equal(byId.get('la-1555-ban-don-sing-stupa-endowment').date,null);assert.match(byId.get('la-1535-photisarath-sangha-supervision-inscription').locationNote,/泰国/);
 assert.match(byId.get('la-1481-ming-response-to-lanxang-war').summary,/文书记载/);assert.match(byId.get('la-750-thalat-mon-inscription-estimate').summary,/中点/);
});
test('Laos legal, public health and returnee records keep pilot, validation and treaty stages separate',()=>{
 assert.equal(byId.get('la-1979-immunization-pilot-districts').year,1979);assert.match(byId.get('la-1979-immunization-pilot-districts').summary,/试点县/);assert.equal(byId.get('la-1982-national-expanded-immunization').year,1982);
 const validated=byId.get('la-2023-filariasis-elimination-validation');assert.equal(validated.date,'2023-02');assert.match(validated.summary,/十月/);assert.match(validated.summary,/公共卫生问题/);assert.equal(byId.get('la-2012-filariasis-mass-medication').endYear,2017);
 assert.equal(byId.get('la-2007-first-human-h5n1-reported').date,'2007-02-27');assert.match(byId.get('la-2007-first-human-h5n1-reported').summary,/报告日期不等于/);
 assert.equal(byId.get('la-2007-health-sciences-university-reorganization').date,'2007-05-22');assert.equal(byId.get('la-1998-setthathirath-hospital-new-buildings').endYear,2000);assert.equal(byId.get('la-2010-provincial-hospital-medical-training').date,'2010-01');
 const a=byId.get('la-1977-vietnam-friendship-cooperation-treaty'),b=byId.get('la-1977-vietnam-boundary-delimitation-treaty');assert.equal(a.date,b.date);assert.notEqual(a.id,b.id);assert.match(b.summary,/勘界/);
 assert.equal(byId.get('la-1980-unhcr-voluntary-return-request').date,'1980-03');assert.equal(byId.get('la-1995-khammouane-refugee-settlement').date,'1995-02-28');assert.match(byId.get('la-1995-khammouane-refugee-settlement').locationNote,/未.*村名/);assert.equal(byId.get('la-1994-bokeo-returnee-reintegration').placeId,'la-huay-xai');
 assert.equal(byId.get('la-1987-world-heritage-convention-ratification').date,'1987-03-20');assert.equal(byId.get('la-1993-hin-nam-no-protected-area').year,1993);assert.equal(byId.get('la-2020-hin-nam-no-national-park').year,2020);assert.match(byId.get('la-1975-usaid-mission-withdrawal').summary,/不等同/);
});

test('Laos corrected inscription keeps identity, dual readings and annual filtering',()=>{
 const e=byId.get('la-1497-thakhek-lao-script-inscription');assert.equal(e.year,1494);assert.equal(e.date,null);assert.equal(e.periodId,'la-lanxang');assert.equal(e.placeId,'la-thakhek');assert.match(e.summary,/2018/);assert.match(e.summary,/1497/);assert.equal(e.sources.length,3);assert.match(e.sourceUrl,/current_situation/);
 assert.equal(eventMatches(e,{countryCode:'LA',scope:'year',year:1494},places),true);assert.equal(eventMatches(e,{countryCode:'LA',scope:'year',year:1497},places),false);
 assert.equal(laos.filter(n=>n.title===e.title).length,1);
});
test('Laos local history distinguishes inscription, recovery, diplomatic journey and reconstruction stages',()=>{
 const ancient=byId.get('la-1540-simuang-sema-zodiac-dating'),find=byId.get('la-2007-simuang-road-sema-excavation');assert.equal(ancient.date,null);assert.equal(ancient.periodId,'la-lanxang');assert.equal(find.date,'2007-01');assert.equal(find.periodId,'la-modern');assert.match(ancient.summary,/换算/);
 assert.equal(byId.get('la-1867-mouhot-tomb-survey-commission').date,'1867-05-10');assert.equal(byId.get('la-1890-mouhot-tomb-pavie-reconstruction').date,'1890-06');assert.match(byId.get('la-1890-mouhot-tomb-pavie-reconstruction').summary,/1887年访墓/);
 const journey=byId.get('la-1647-leria-return-journey');assert.equal(journey.endYear,1648);assert.equal(journey.date,null);assert.match(journey.locationNote,/越南北部/);assert.equal(eventMatches(journey,{countryCode:'LA',scope:'year',year:1648},places),true);assert.equal(eventMatches(journey,{countryCode:'LA',scope:'year',year:1649},places),false);
 for(const [id,name,region]of [['la-muang-sing','勐兴','琅南塔省'],['la-xieng-hon','香洪','沙耶武里省'],['la-muang-khoun','孟坤','川圹省']]){const p=places.get(id);assert.equal(p.name,name);assert.equal(p.regionName,region);assert.ok(p.sources[0].url.startsWith('https://www.geonames.org/'));}
 assert.equal(byId.get('la-1479-later-le-phuan-campaign').placeId,'la-muang-khoun');assert.equal(byId.get('la-1834-phuan-depopulation-order').date,'1834-04');assert.match(byId.get('la-1834-phuan-depopulation-order').summary,/命令而非实际/);
});

test('Laos succession dating retains conflicting readings without duplicate incidents',()=>{
 const deposition=byId.get('la-1371-fa-ngum-deposition-dating');assert.equal(deposition.date,null);assert.equal(deposition.endYear,1373);assert.match(deposition.summary,/不写成两次政变/);
 const invasion=byId.get('la-1574-burmese-intervention-dating');assert.equal(invasion.endYear,1575);assert.equal(eventMatches(invasion,{countryCode:'LA',scope:'year',year:1575},places),true);assert.equal(eventMatches(invasion,{countryCode:'LA',scope:'year',year:1576},places),false);
 const conflict=byId.get('la-1622-voravongsa-death-dating');assert.equal(conflict.endYear,1623);assert.match(conflict.summary,/碑铭/);assert.match(conflict.locationNote,/不能直接等同现代他曲/);
 assert.equal(byId.get('la-1591-no-muang-return-enthronement').periodId,'la-lanxang');
});
test('Laos wartime boundaries distinguish demands, agreements, policy and actual retrocession',()=>{
 for(const [id,date]of [['la-1940-thai-right-bank-territorial-demand','1940-09-18'],['la-1941-tokyo-border-protocol','1941-03-11'],['la-1941-tokyo-peace-convention','1941-05-09'],['la-1944-us-postwar-border-position','1944-10-19'],['la-1945-french-territory-repudiation-note','1945-08-22']]){assert.equal(byId.get(id).date,date);assert.equal(byId.get(id).periodId,'la-colonial');}
 assert.match(byId.get('la-1941-tokyo-peace-convention').summary,/不代表全部老挝/);assert.match(byId.get('la-1944-us-postwar-border-position').summary,/不等于.*当日/);
 const appeal=byId.get('la-1947-issara-regional-federation-memorandum');assert.equal(appeal.date,'1947-01-01');assert.match(appeal.locationNote,/报告日期是1月7日/);assert.match(appeal.summary,/不认为联邦已成立/);
 assert.equal(byId.get('la-1946-franco-lao-modus-vivendi').date,'1946-08-27');assert.equal(byId.get('la-1949-royal-constitution-revision').date,'1949-09-14');assert.match(byId.get('la-1949-royal-constitution-revision').summary,/成年男性/);
});
test('Laos manuscript preservation separates fieldwork, publication and foundation window',()=>{
 assert.equal(byId.get('la-1910-manuscript-inventory-proposal').date,'1910-02-10');assert.equal(byId.get('la-1914-finot-luang-prabang-manuscript-survey').date,'1914-06-06');
 const library=byId.get('la-1914-royal-library-foundation-window');assert.equal(library.date,null);assert.equal(library.endYear,1917);assert.match(library.summary,/建立窗口/);assert.equal(eventMatches(library,{countryCode:'LA',scope:'year',year:1917},places),true);assert.equal(eventMatches(library,{countryCode:'LA',scope:'year',year:1918},places),false);
 assert.match(byId.get('la-1353-mass-standard-fourteenth-century-estimate').summary,/阶段展示值/);assert.match(byId.get('la-1525-pot-shaped-weights-estimate').summary,/研究推断/);
 assert.equal(byId.get('la-2004-vientiane-road-pilot-archaeology').year,2004);assert.match(byId.get('la-2004-vientiane-road-pilot-archaeology').summary,/早于2007年/);
 assert.equal(byId.get('la-1894-namtha-envoy-boundary-discussion').date,'1894-09');assert.match(byId.get('la-2018-namlue-shrine-relocation').locationNote,/不是神祠的精确位置/);
});

test('Laos cross-kingdom succession retains departure dates and alternative chronology',()=>{
 const marriage=byId.get('la-1532-phothisarat-lanna-marriage-window');assert.equal(marriage.endYear,1533);assert.equal(marriage.date,null);assert.match(marriage.summary,/不记为两次/);
 const lanna=byId.get('la-1546-setthathirath-lanna-enthronement');assert.equal(lanna.date,'1546-07-02');assert.match(lanna.locationNote,/泰国清迈/);
 const departure=byId.get('la-1548-setthathirath-leaves-chiangmai');assert.equal(departure.date,'1548-08-08');assert.match(departure.summary,/出发日/);assert.match(departure.summary,/两年差异/);
 assert.equal(byId.get('la-1804-anouvong-accession-source-year').date,null);assert.match(byId.get('la-1804-anouvong-accession-source-year').summary,/该书纪年/);
});
test('Laos tribute and royal ceremonies do not fabricate converted lunar dates or coronations',()=>{
 for(const id of ['la-1730-qing-five-year-tribute-cycle','la-1743-qing-ten-year-tribute-cycle']){assert.equal(byId.get(id).date,null);assert.match(byId.get(id).summary,/农历/);}
 assert.equal(byId.get('la-1959-sisavang-vong-death').date,'1959-10-29');assert.equal(byId.get('la-1961-sisavang-vong-state-funeral').date,'1961-04');
 assert.equal(byId.get('la-1904-sisavang-vong-accession-month').precision,'month');const king=byId.get('la-1959-savang-vatthana-accession-year');assert.equal(king.date,null);assert.match(king.summary,/不强定/);assert.match(king.summary,/加冕/);
 assert.equal(byId.get('la-1765-burmese-capture-luang-prabang').date,'1765-03');
});
test('Laos assemblies, institutional scope and regional coffee remain distinguishable',()=>{
 for(const [id,date]of [['la-1923-indigenous-consultative-assembly','1923-08-30'],['la-1941-franco-lao-protectorate-extension','1941-08-21'],['la-1945-phetsarath-unity-proclamation','1945-09-15'],['la-1946-constituent-assembly-election','1946-12-15'],['la-1947-constituent-assembly-inaugural','1947-03-15'],['la-1947-national-assembly-first-election','1947-08-24']]){assert.equal(byId.get(id).date,date);assert.equal(byId.get(id).periodId,'la-colonial');}
 assert.match(byId.get('la-1946-constituent-assembly-election').summary,/限男性/);assert.match(byId.get('la-1941-franco-lao-protectorate-extension').summary,/南部仍被排除/);
 const coffee=byId.get('la-1990-coffee-commercial-expansion');assert.equal(coffee.placeId,'la-paksong');assert.match(coffee.locationNote,/跨占巴塞/);assert.match(coffee.summary,/不将其写为咖啡首次/);assert.equal(places.get(coffee.placeId).regionCode,'LA-GEO-02');
 const un=byId.get('la-1959-security-council-laos-subcommittee');assert.equal(un.date,'1959-09-07');assert.match(un.summary,/不等于.*裁定/);assert.match(un.locationNote,/纽约/);
});

test('Laos early burial and copper dates remain representative years, separate from excavation',()=>{
 const burial=byId.get('la--5199-pha-phen-flexed-burial-estimate');assert.equal(burial.date,null);assert.match(burial.title,/约/);assert.match(burial.summary,/校正BP/);assert.equal(burial.placeId,'la-lak-sao');
 const mine=byId.get('la--999-vilabouly-early-copper-mining-estimate');assert.equal(mine.date,null);assert.match(mine.summary,/1071至922/);assert.match(mine.summary,/不是所有矿井同时/);assert.equal(mine.periodId,'la-early');assert.equal(eventMatches(mine,{countryCode:'LA',scope:'year',year:-999},places),true);assert.equal(eventMatches(mine,{countryCode:'LA',scope:'year',year:2008},places),false);
 assert.equal(byId.get('la-2004-pha-phen-rescue-excavation').placeId,burial.placeId);assert.equal(byId.get('la-2008-vilabouly-rescue-archaeology-start').placeId,mine.placeId);assert.equal(byId.get('la-1934-tam-hang-first-modern-excavation').date,null);assert.equal(byId.get('la-2015-tam-hang-lithic-study-published').date,'2015-09-30');
});
test('Laos river contracts distinguish existing railway repair, new roads and later paving',()=>{
 const repair=byId.get('la-1897-khone-railway-repair-start');assert.equal(repair.date,'1897-08');assert.equal(repair.placeId,'la-don-khon');assert.match(repair.summary,/既有线路修整/);
 assert.equal(byId.get('la-1927-saigon-navigation-postal-contract').date,'1927-07-07');assert.match(byId.get('la-1927-saigon-navigation-postal-contract').summary,/需转运/);assert.equal(byId.get('la-1936-river-transport-reorganization-approved').date,'1936-06-29');
 const roads=byId.get('la-1923-annam-laos-three-road-links');assert.equal(roads.date,null);assert.match(roads.summary,/第一季度/);assert.match(roads.summary,/1926至1927年铺面/);assert.equal(byId.get('la-1926-route-nine-colonial-surfacing').endYear,1927);
});
test('Laos mine opening, first production and regional reference names remain unambiguous',()=>{
 const opening=byId.get('la-2012-ban-houayxai-gold-silver-opening');assert.equal(opening.date,'2012-04-20');assert.equal(opening.placeId,'la-anouvong');assert.notEqual(opening.placeId,'la-huay-xai');assert.match(opening.summary,/五月开始/);assert.match(opening.locationNote,/波乔省/);
 for(const id of ['la-2003-sepon-first-gold-production','la-2005-sepon-first-copper-production'])assert.equal(byId.get(id).placeId,'la-vilabouly');assert.equal(places.get('la-vilabouly').regionCode,'LA-GEO-20');assert.match(places.get('la-vilabouly').description,/县域/);
 assert.match(byId.get('la-1928-luang-prabang-power-plant').summary,/不据电厂存在/);assert.match(byId.get('la-1944-sacred-buddha-novel-publication').summary,/虚构故事/);assert.equal(byId.get('la-1929-pariyatti-dhamma-school-foundation').periodId,'la-colonial');assert.equal(byId.get('la-1967-buddhist-education-institute-reorganization').periodId,'la-royal');assert.equal(byId.get('la-1996-sangha-college-name-faculties').periodId,'la-modern');
});

test('Laos treaty accession in the kingdom and later ratifications retain separate dates and scope',()=>{
 const old=byId.get('la-1974-cerd-accession');assert.equal(periodForEvent(old,'LA')?.id,'la-royal');assert.match(old.summary,/现国名/);
 const sameDay=['la-2009-iccpr-ratification','la-2009-crpd-ratification'].map(id=>byId.get(id));assert.equal(sameDay[0].date,sameDay[1].date);assert.notEqual(sameDay[0].sourceUrl,sameDay[1].sourceUrl);for(const e of sameDay){assert.equal(eventMatches(e,{countryCode:'LA',scope:'year',year:2009},places),true);assert.equal(eventMatches(e,{countryCode:'LA',scope:'year',year:2008},places),false);assert.match(e.locationNote,/交存/);}
 assert.match(byId.get('la-2012-cat-ratification').summary,/第20条/);assert.match(byId.get('la-1991-crc-accession').summary,/加入，不补写此前签署/);
});
test('Laos constitutional dates distinguish assembly text, promulgation and news publication',()=>{
 const adopted=byId.get('la-2025-constitution-revised-2025'),promulgated=byId.get('la-2025-constitution-2025-promulgated');assert.equal(adopted.date,'2025-03-20');assert.equal(promulgated.date,'2025-03-22');assert.notEqual(adopted.id,promulgated.id);assert.match(promulgated.summary,/三月二十七日/);assert.match(adopted.summary,/三月二十八日/);
 const earlier=byId.get('la-2015-constitution-revised-2015');assert.match(earlier.summary,/不把文本署日自动视为生效日/);assert.equal(earlier.date,'2015-12-08');assert.equal(byId.get('la-2003-constitution-revised-2003').date,'2003-05-06');
});
test('Laos railway local dates, early network links and currency reform keep precision limits',()=>{
 const station=byId.get('la-2023-khamsavath-station-opening'),service=byId.get('la-2024-bangkok-vientiane-direct-train');assert.equal(station.date,'2023-10-30');assert.equal(service.date,'2024-07-20');assert.match(service.summary,/前一晚/);assert.equal(service.sources.length,2);assert.match(station.locationNote,/中老铁路万象站不同/);
 const currency=byId.get('la-1979-kip-national-currency-conversion');assert.equal(currency.precision,'month');assert.match(currency.summary,/一百元/);assert.match(currency.summary,/起算日/);assert.equal(byId.get('la-1994-early-dialup-email-link').date,'1994-12');assert.equal(byId.get('la-1998-first-permanent-internet-link').date,'1998-08');
 assert.equal(byId.get('la-1966-vientiane-historic-flood').periodId,'la-royal');assert.equal(byId.get('la-2008-mekong-flood-2008').precision,'month');assert.equal(byId.get('la-2009-ketsana-southern-flood').placeId,'la-sekong');
});

test('Laos same-named That Luang sites remain distinct in location and chronology',()=>{
 const temple=byId.get('la-1818-luang-prabang-that-luang-foundation'),tower=byId.get('la-1566-pha-that-luang-founded');
 assert.ok(tower);assert.equal(temple.placeId,'la-luang-prabang');assert.equal(tower.placeId,'la-vientiane');assert.notEqual(temple.id,tower.id);
 assert.match(temple.locationNote,/不指万象/);assert.match(temple.summary,/暂定|修订/);
 assert.equal(eventMatches(temple,{countryCode:'LA',city:'la-vientiane',scope:'year',year:1818},places),false);
 assert.equal(eventMatches(temple,{countryCode:'LA',city:'la-luang-prabang',scope:'year',year:1818},places),true);
});
test('Laos regional inscriptions, unexecuted campaign plans and memoir dates retain evidence limits',()=>{
 const stele=byId.get('la-1520-muang-khop-inscription'),plan=byId.get('la-1792-joint-campaign-plan-postponed'),campaign=byId.get('la-1802-vientiane-troops-nghe-an-offensive');
 assert.equal(places.get(stele.placeId).regionCode,'LA-GEO-13');assert.match(stele.summary,/可能/);assert.equal(stele.date,null);
 assert.match(plan.summary,/计划推迟/);assert.match(campaign.locationNote,/今越南义安/);assert.equal(campaign.precision,'year');assert.equal(campaign.date,null);assert.match(campaign.summary,/农历三月/);
 assert.equal(byId.get('la-1885-tung-chieng-kam-stockade-assault').date,'1885-02-22');
 const celebration=byId.get('la-1892-royal-coronation-festivities');assert.equal(celebration.precision,'month');assert.equal(celebration.date,'1892-07');assert.match(celebration.summary,/不把首日装饰日期认作加冕日/);
});

test('Laos local migration periods retain different regions, continued campaigns and chronological cautions',()=>{
 const north=byId.get('la-1812-nan-northwestern-deportation-campaign'),phuan=byId.get('la-1876-phuan-forced-migration-1876');
 assert.equal(north.endYear,1813);assert.equal(north.placeId,'la-viang-phoukha');assert.equal(phuan.placeId,'la-muang-khoun');assert.notEqual(north.placeId,phuan.placeId);
 assert.equal(eventMatches(north,{countryCode:'LA',scope:'year',year:1813},places),true);assert.equal(eventMatches(north,{countryCode:'LA',scope:'year',year:1814},places),false);
 const sameTown=byId.get('la-1885-chiang-khaeng-capital-muang-sing');assert.match(sameTown.summary,/1883至1884/);assert.equal(sameTown.precision,'year');
 const declaration=byId.get('la-1896-muang-sing-mekong-boundary-declaration');assert.equal(declaration.date,'1896-05-10');assert.equal(declaration.periodId,'la-colonial');assert.match(declaration.summary,/次日签署/);
});
test('Laos inscriptions distinguish stated dates, reused materials and uncertain provenance',()=>{
 const old=byId.get('la-1497-thakhek-lao-script-inscription');assert.equal(old.year,1494);assert.equal(old.date,null);assert.match(old.summary,/2020/);assert.match(old.summary,/后世追记/);assert.equal(old.sources.length,3);
 const reused=byId.get('la-1545-si-phoum-reused-boundary-stone');assert.equal(reused.date,'1545-09-09');assert.match(reused.summary,/材料再利用/);
 const discovered=byId.get('la-1902-say-fong-stele-discovery');assert.equal(discovered.precision,'month');assert.match(discovered.summary,/可能从别处迁入/);assert.match(discovered.locationNote,/二十公里/);
 assert.equal(byId.get('la-1548-maha-that-slate-inscription').date,'1548-05-18');assert.match(byId.get('la-1548-maha-that-slate-inscription').summary,/仍属推测/);
});

test('Laos assembly, coup and labour records keep actual event dates distinct from document dates',()=>{
 assert.equal(byId.get('la-1965-restricted-assembly-election').date,'1965-07-18');
 assert.equal(byId.get('la-1966-assembly-budget-defeat').date,'1966-09-16');
 assert.equal(byId.get('la-1967-national-assembly-election-1967').date,'1967-01-01');
 const earlier=byId.get('la-1966-thao-ma-air-force-coup'),later=byId.get('la-1973-thao-ma-second-coup');
 assert.equal(earlier.date,'1966-10-21');assert.equal(later.date,'1973-08-20');assert.notEqual(earlier.sourceUrl,later.sourceUrl);
 const battle=byId.get('la-1968-nam-bak-defeat');assert.equal(battle.date,'1968-01');assert.equal(battle.precision,'month');assert.match(battle.summary,/三月报告日/);
 assert.equal(eventMatches(battle,{countryCode:'LA',scope:'year',year:1968},places),true);assert.equal(eventMatches(battle,{countryCode:'LA',scope:'year',year:1969},places),false);
 assert.equal(byId.get('la-1990-labour-code-1990').date,'1990-12-24');assert.equal(byId.get('la-1994-labour-act-1994').date,'1994-03-14');assert.equal(byId.get('la-2013-labour-law-2013').date,'2013-12-24');
});
test('Laos overseas sports milestones preserve country filters and historical period boundaries',()=>{
 for(const id of ['la-1951-football-federation-foundation','la-1952-football-fifa-affiliation'])assert.equal(byId.get(id).periodId,'la-colonial');
 for(const [id,host]of [['la-1959-first-seap-games-participation','曼谷'],['la-2000-first-paralympic-delegation','悉尼'],['la-2008-first-paralympic-medal','北京']]){
  const e=byId.get(id);assert.equal(e.placeId,'la-vientiane');assert.match(e.locationNote,new RegExp(host));
  assert.equal(eventMatches(e,{countryCode:'LA',scope:'all'},places),true);assert.equal(eventMatches(e,{countryCode:'CN',scope:'all'},places),false);
 }
 const medal=byId.get('la-2008-first-paralympic-medal');assert.match(medal.summary,/157\.5/);assert.ok(medal.sources.some(s=>s.url.includes('/beijing-2008/results/')));
 assert.match(byId.get('la-1939-tripitaka-lao-three-volumes').summary,/三卷/);assert.match(byId.get('la-1939-tripitaka-lao-three-volumes').summary,/项目停止/);
 assert.equal(byId.get('la-1970-long-tieng-defence').placeId,'la-long-tieng');assert.match(byId.get('la-1970-long-tieng-defence').summary,/请求/);
});

test('Laos education and child protection milestones separate adoption from promulgation and effect',()=>{
 const education=byId.get('la-2025-revised-education-law-effective');assert.equal(education.date,'2025-04-04');assert.match(education.summary,/2024年/);
 const children=byId.get('la-2006-child-rights-protection-law');assert.equal(children.date,'2006-12-27');assert.match(children.summary,/次年一月/);
 assert.equal(byId.get('la-2023-amended-child-rights-law-effective').date,'2023-12-04');assert.equal(byId.get('la-2015-anti-human-trafficking-law').date,'2015-12-17');
 const oldLand=byId.get('la-2003-land-law-replacement-2003'),newLand=byId.get('la-2019-land-law-revision-2019');assert.notEqual(oldLand.sourceUrl,newLand.sourceUrl);assert.equal(newLand.date,'2019-06-21');assert.ok(newLand.sources.some(s=>s.url.startsWith('https://asean.org/')));
 const provincial=byId.get('la-2016-first-provincial-assembly-elections');assert.equal(provincial.precision,'year');assert.equal(provincial.date,null);
});
test('Laos current elections and cultural programmes retain actual dates and useful year filters',()=>{
 assert.equal(byId.get('la-2026-tenth-national-assembly-election').date,'2026-02-22');assert.equal(byId.get('la-2026-thongloun-presidential-reelection').date,'2026-03-23');assert.equal(byId.get('la-2026-xaysomphone-phomvihane-death').date,'2026-08-08');
 const library=byId.get('la-1956-national-library-established');assert.equal(library.periodId,'la-royal');assert.equal(eventMatches(library,{countryCode:'LA',scope:'year',year:1956},places),true);assert.equal(eventMatches(library,{countryCode:'LA',scope:'year',year:1955},places),false);
 const film=byId.get('la-2010-luang-prabang-first-film-festival');assert.equal(film.date,'2010-12-04');assert.equal(film.placeId,'la-luang-prabang');
 const training=byId.get('la-2016-film-talent-lab-launch');assert.equal(training.endYear,2019);assert.equal(eventMatches(training,{countryCode:'LA',scope:'year',year:2018},places),true);assert.equal(eventMatches(training,{countryCode:'LA',scope:'year',year:2020},places),false);
});

test('Laos continuing education covers real programme years without leaking into future years',()=>{
 const e=byId.get('la-1969-vientiane-functional-literacy-programme');assert.equal(e.endYear,1972);assert.equal(e.periodId,'la-royal');
 assert.equal(eventMatches(e,{countryCode:'LA',scope:'year',year:1971},places),true);assert.equal(eventMatches(e,{countryCode:'LA',scope:'year',year:1973},places),false);
 assert.equal(byId.get('la-2015-intensive-primary-education-national-declaration').precision,'month');
 const olympic=byId.get('la-1980-first-olympic-participation');assert.ok(olympic.sources.some(s=>s.url.endsWith('Official%20IOC%20Report.pdf')));assert.match(olympic.locationNote,/莫斯科/);assert.equal(eventMatches(olympic,{countryCode:'LA',scope:'all'},places),true);assert.equal(eventMatches(olympic,{countryCode:'CN',scope:'all'},places),false);
});
test('Laos leadership transitions distinguish party, state and temporary assembly appointments',()=>{
 const party=byId.get('la-2021-thongloun-first-party-secretary-election'),state=byId.get('la-2021-thongloun-phankham-government-election');assert.equal(party.date,'2021-01-15');assert.equal(state.date,'2021-03-22');assert.notEqual(party.sourceUrl,state.sourceUrl);
 assert.equal(byId.get('la-2006-choummaly-bouasone-government-election').date,'2006-06');assert.equal(byId.get('la-2016-bounnhang-thongloun-government-election').date,'2016-04-20');
 const acting=byId.get('la-2026-sounthone-acting-assembly-president');assert.equal(acting.date,'2026-08-18');assert.match(acting.summary,/代理/);assert.match(acting.summary,/正式.*选举/);
 assert.equal(byId.get('la-2022-sonexay-prime-minister-election').date,'2022-12-30');assert.equal(byId.get('la-2026-sonexay-prime-minister-reelection').date,'2026-03-23');
});
