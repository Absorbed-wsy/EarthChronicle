import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {VIETNAM_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),vietnam=data.events.filter(e=>e.periodId?.startsWith('vn-')),byId=new Map(vietnam.map(e=>[e.id,e]));
test('Vietnam corpus provides independent periods, valid dates and sourced regional records',()=>{
 assert.equal(periodsForCountry('VN'),VIETNAM_PERIODS);assert.ok(vietnam.length>=590);assert.deepEqual(periodBounds('all',2026,'VN'),[-15999,2026]);
 const specific=VIETNAM_PERIODS.filter(p=>!p.navigationOnly);assert.equal(specific.length,17);assert.ok(Object.isFrozen(VIETNAM_PERIODS));
 for(const p of VIETNAM_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');}
 for(const p of specific)assert.ok(vietnam.some(e=>e.periodId===p.id),p.id);
 const ids=new Set(),titles=new Set(),sources=new Set();
 for(const e of vietnam){
  assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);sources.add(e.sourceUrl);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);assert.equal(periodForEvent(e,'VN')?.id,e.periodId,e.id);
  for(const c of ['CN','JP','KR','KP','MN'])assert.equal(periodForEvent(e,c),null,e.id);
  assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'VN')).length,1,e.id);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'VN',e.id);assert.ok(p.regionName&&p.regionCode&&p.lon>=102&&p.lon<=110&&p.lat>=8&&p.lat<=24,e.id);
  assert.equal(new URL(e.sourceUrl).protocol,'https:');assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle),e.id);
  if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full,e.id);assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.ok(sources.size>=50);for(const category of ['政治','军事','外交','经济','社会','科技','文化','灾害'])assert.ok(vietnam.some(e=>e.category===category),category);
 for(const [c,count]of [['CN',3117],['JP',1101],['KR',454],['KP',446],['MN',451],['VN',vietnam.length]])assert.equal(data.meta.collections.filter(p=>p.countryCode===c).reduce((n,p)=>n+p.events,0),count,c);
});
test('Vietnam civil transitions preserve unique ownership and concurrent dynasty choices',()=>{
 assert.equal(periodForEvent({year:1945,date:'1945-09-01',periodId:'vn-colonial'},'VN')?.id,'vn-colonial');
 assert.equal(periodForEvent({year:1945,date:'1945-09-02',periodId:'vn-colonial'},'VN')?.id,'vn-divided');
 assert.equal(periodForEvent({year:1945},'VN'),null);
 for(const [date,id]of [['1976-07-01','vn-divided'],['1976-07-02','vn-modern']]){
  const e={year:1976,date};assert.equal(periodForEvent(e,'VN')?.id,id);assert.deepEqual(VIETNAM_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'VN')).map(p=>p.id),[id]);
 }
 assert.equal(periodForEvent({year:1976},'VN'),null);
 assert.equal(byId.get('vn-1945-bao-dai-abdication-ceremony').periodId,'vn-colonial');assert.equal(VIETNAM_PERIODS.find(p=>p.id==='vn-nguyen').endBefore,'1945-08-30');
 for(const [year,id]of [[1546,'vn-restored-le'],[1536,'vn-mac'],[1785,'vn-tayson'],[1785,'vn-restored-le'],[1865,'vn-nguyen'],[1865,'vn-colonial']])assert.equal(periodForEvent({year,periodId:id},'VN')?.id,id);
 assert.equal(byId.get('vn-1397-tay-do-citadel-construction').periodId,'vn-tran');assert.equal(byId.get('vn-1418-lam-son-uprising').periodId,'vn-ming');
});
test('Vietnam location and annual filters retain old Chinese subjects without duplicated period assignment',()=>{
 for(const e of vietnam){const p=places.get(e.placeId),f={countryCode:'VN',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,f,places),true,e.id);for(const year of [e.year-1,(e.endYear??e.year)+1])assert.equal(eventMatches(e,{...f,year},places),false,e.id);
  assert.equal(eventMatches(e,{...f,query:p.name},places),true,e.id);assert.equal(eventMatches(e,{...f,countryCode:'CN',period:'all'},places),false,e.id);
 }
 const old=data.events.filter(e=>places.get(e.placeId)?.countryCode==='VN'&&periodForEvent(e,'CN'));assert.equal(old.length,11);
 for(const e of old){assert.equal(periodForEvent(e,'VN'),null,e.id);assert.equal(eventMatches(e,{countryCode:'VN',period:'all',scope:'all'},places),true,e.id);}
});
test('Vietnam estimates, foreign meetings and current regional geography keep location limits explicit',()=>{
 assert.equal(byId.get('vn--1999-phung-nguyen-culture-estimate').date,null);assert.match(byId.get('vn-350-my-son-fourth-century-sanctuary').summary,/代表约年/);
 assert.equal(byId.get('vn-1941-viet-minh-founded').placeId,'vn-cao-bang');assert.match(byId.get('vn-1941-viet-minh-founded').summary,/不把会议放在省城/);
 assert.equal(byId.get('vn-1785-rach-gam-xoai-mut').placeId,'vn-my-tho');assert.equal(byId.get('vn-1885-can-vuong-edict').placeId,'vn-cam-lo');
 assert.equal(byId.get('vn-1954-geneva-temporary-demarcation').placeId,'vn-ben-hai');assert.match(byId.get('vn-1954-geneva-temporary-demarcation').summary,/不是永久国界/);
 for(const id of ['vn-1977-un-membership','vn-1995-asean-membership','vn-2007-wto-membership'])assert.match(byId.get(id).locationNote,/境外/);
 assert.equal(places.get('vn-yen-bai').regionName,'老街省');assert.equal(places.get('vn-tay-son').regionName,'嘉莱省');assert.equal(places.get('vn-hoi-an').regionName,'岘港市');
 assert.ok(Math.abs(places.get('vn-ho-citadel').lon-105.6047222222)<0.000001);assert.ok(Math.abs(places.get('vn-ho-citadel').lat-20.0780555556)<0.000001);
 assert.equal(byId.get('vn-1999-central-vietnam-floods').precision,'month');assert.equal(byId.get('vn-2024-typhoon-yagi-landfall').date,'2024-09-07');
});

test('Vietnam reforms, archaeology and operational milestones retain independent chronology',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 assert.equal(get('vn-1396-thong-bao-hoi-sao-paper-money').periodId,'vn-tran');assert.equal(get('vn-1397-tran-private-land-limit').periodId,'vn-tran');
 assert.match(get('vn-1401-ho-dependent-servant-limit').summary,/未获得自由/);assert.equal(get('vn-1404-ho-exam-writing-mathematics').periodId,'vn-ho');
 assert.equal(get('vn-1529-mac-first-metropolitan-exam').periodId,'vn-mac');assert.equal(get('vn-1554-restored-le-special-exam').periodId,'vn-restored-le');
 assert.equal(get('vn-1976-national-election-1976').date,'1976-04-25');assert.equal(get('vn-1976-national-election-1976').periodId,'vn-divided');
 for(const [id,date]of [['vn-1959-constitution-1959-adoption','1959-12-31'],['vn-1980-constitution-1980-adoption','1980-12-18'],['vn-1992-constitution-1992-adoption','1992-04-15']])assert.equal(get(id).date,date);
 assert.equal(get('vn-1988-hoa-binh-first-generating-unit').date,null);assert.match(get('vn-1988-hoa-binh-first-generating-unit').summary,/11月9日成立/);
 assert.equal(get('vn-2024-hcm-metro-one-commercial-service').date,'2024-12-22');assert.match(get('vn-2024-hcm-metro-one-commercial-service').summary,/2025年3月/);
 assert.equal(get('vn-2020-central-vietnam-floods-2020').precision,'month');assert.equal(get('vn-2020-typhoon-molave-landfall').date,'2020-10-28');
 for(const [id,saka]of [['vn-875-dong-duong-buddhist-foundation',797],['vn-898-ban-lanh-sanctuary-restoration',820],['vn-902-an-thai-lokanatha-consecration',824],['vn-991-my-son-harivarman-rededication',913]]){
  const e=get(id);assert.equal(e.year,saka+78);assert.equal(e.date,null);assert.equal(e.periodId,'vn-champa');assert.match(e.sourceUrl,/dharmalekha/);
 }
 assert.equal(places.get('vn-hoa-binh').regionName,'富寿省');assert.equal(places.get('vn-ben-tre').regionName,'永隆省');assert.equal(places.get('vn-dong-hoi').regionName,'广治省');
 assert.equal(get('vn-2003-nha-nhac-unesco-proclamation').year,2003);assert.match(get('vn-2003-phong-nha-world-heritage').summary,/2025年/);
});

test('Vietnam prehistoric and southern cultural records retain independent periods and approximate chronology',()=>{
 const first=byId.get('vn--15999-hoabinhian-early-cultural-stage');assert.ok(first);assert.equal(first.year,1-16000);assert.equal(first.date,null);assert.match(first.summary,/代表约年/);
 assert.deepEqual(periodBounds('vn-early',2026,'VN'),[-15999,-110]);assert.deepEqual(periodBounds('vn-funan',2026,'VN'),[1,700]);
 const southern=byId.get('vn-50-oc-eo-funan-early-trading-stage');assert.equal(southern.periodId,'vn-funan');assert.equal(periodForEvent(southern,'VN')?.id,'vn-funan');assert.match(southern.summary,/代表约年/);
 assert.equal(eventMatchesPeriod(southern,'vn-northern','VN'),false);assert.equal(eventMatchesPeriod(southern,'vn-champa','VN'),false);
 const excavation=byId.get('vn-1944-oc-eo-malleret-excavation');assert.equal(excavation.placeId,southern.placeId);assert.equal(excavation.periodId,'vn-colonial');
 for(const [year,id]of [[-4999,'vn--4999-da-but-coastal-neolithic-stage'],[1926,'vn-1926-da-but-first-excavation'],[-499,'vn--499-sa-huynh-jar-burial-stage'],[1909,'vn-1909-sa-huynh-archaeological-discovery']])assert.equal(byId.get(id).year,year,id);
 for(const [id,name]of [['vn-quynh-van','乂安省'],['vn-nam-dan','乂安省'],['vn-con-cuong','乂安省'],['vn-doi-son','宁平省'],['vn-nam-dinh','宁平省'],['vn-an-nhon','嘉莱省'],['vn-oc-eo','安江省']])assert.equal(places.get(id).regionName,name,id);
 const circuit=byId.get('vn-1010-ly-twenty-four-circuits');assert.equal(circuit.periodId,'vn-ly');assert.match(circuit.summary,/二十四路/);
 const cattle=byId.get('vn-1117-ly-draft-cattle-protection');assert.equal(cattle.category,'制度');assert.match(cattle.summary,/农业/);
 assert.equal(byId.get('vn-1121-sung-thien-dien-linh-stele').placeId,'vn-doi-son');assert.equal(byId.get('vn-987-le-hoan-doi-son-ploughing').placeId,'vn-doi-son');
 assert.equal(byId.get('vn-1171-ly-coastal-inspection-mapping').endYear,1172);assert.match(byId.get('vn-1171-ly-coastal-inspection-mapping').locationNote,/实际巡察/);
 assert.equal(byId.get('vn-1773-tay-son-quy-nhon-capture').placeId,'vn-an-nhon');assert.match(byId.get('vn-1744-quy-nhon-prefecture-seat-transfer').summary,/沿海/);
});

test('Vietnam colonial expansion distinguishes treaty venues, parallel documents and publication dates',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 for(const [id,date]of [['vn-1862-saigon-treaty-1862','1862-06-05'],['vn-1874-saigon-peace-alliance-treaty-1874','1874-03-15'],['vn-1874-saigon-commercial-treaty-1874','1874-08-31']]){const e=get(id);assert.equal(e.date,date);assert.equal(e.placeId,'vn-ho-chi-minh-city');assert.equal(e.periodId,'vn-colonial');}
 assert.match(get('vn-1874-saigon-peace-alliance-treaty-1874').summary,/西贡.*顺化/);assert.equal(get('vn-1874-saigon-peace-alliance-treaty-1874').sources.length,2);
 assert.equal(get('vn-1888-dong-khanh-three-urban-concessions').date,'1888-10-01');assert.match(get('vn-1888-dong-khanh-three-urban-concessions').summary,/十月三日/);
 assert.equal(get('vn-1902-hanoi-exposition-public-opening').date,'1902-11-16');assert.match(get('vn-1902-hanoi-exposition-public-opening').summary,/二月/);
 assert.equal(get('vn-1906-indochina-university-foundation-decree').date,'1906-05-16');assert.equal(get('vn-1907-indochina-university-first-teaching').date,'1907-11-01');
 assert.equal(get('vn-1907-dong-kinh-nghia-thuc-opening').date,'1907-03');assert.equal(get('vn-1919-hue-final-imperial-examination').periodId,'vn-nguyen');
 assert.equal(get('vn-1917-thai-nguyen-soldiers-prisoners-uprising').date,'1917-08-31');assert.match(get('vn-1917-thai-nguyen-soldiers-prisoners-uprising').summary,/三十日夜/);
 assert.equal(get('vn-1930-communist-party-vietnam-unification').date,null);assert.match(get('vn-1930-communist-party-vietnam-unification').locationNote,/境外香港/);
 assert.equal(get('vn-1941-do-luong-soldiers-mutiny').placeId,'vn-thanh-chuong');assert.match(get('vn-1941-do-luong-soldiers-mutiny').summary,/饶市/);
 assert.equal(get('vn-1944-northern-vietnam-wartime-famine').endYear,1945);assert.equal(eventMatches(get('vn-1944-northern-vietnam-wartime-famine'),{countryCode:'VN',period:'vn-colonial',scope:'year',year:1945},places),true);
 assert.equal(get('vn-1945-tran-trong-kim-cabinet-formed').date,'1945-04-17');assert.match(get('vn-1945-tran-trong-kim-cabinet-formed').summary,/不能.*民选议会/);
 for(const [id,name]of [['vn-yen-the','北宁省'],['vn-dai-loc','岘港市'],['vn-phu-rieng','同奈省'],['vn-rach-gia','安江省'],['vn-huong-khe','河静省'],['vn-nha-trang','庆和省']])assert.equal(places.get(id).regionName,name,id);
});

test('Champa expansion separates retrospective events, archaeological discovery and approximate chronology',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 for(const [id,year]of [['vn-1190-khmer-conquest-of-champa',1190],['vn-1201-cham-heir-recognition-at-angkor',1201],['vn-1249-harideva-claims-cham-kingship',1249],['vn-1257-jaya-simhavarman-takes-panrang',1257],['vn-1266-indravarman-royal-consecration',1266]]){const e=get(id);assert.equal(e.year,year);assert.equal(e.periodId,'vn-champa');assert.equal(e.date,null);}
 assert.match(get('vn-1201-cham-heir-recognition-at-angkor').locationNote,/境外|今柬埔寨/);
 assert.match(get('vn-1013-ponagar-general-cult-restoration').summary,/1013至1014.*813/);
 assert.match(get('vn-1401-vijaya-royal-land-redemption').summary,/不能.*登基日/);
 assert.equal(get('vn-1409-drang-lai-forest-irrigation-settlement').placeId,'vn-ayun-pa');assert.equal(places.get('vn-ayun-pa').regionName,'嘉莱省');
 assert.match(get('vn-2006-hoa-lai-stela-discovery').summary,/778.*839/);assert.equal(get('vn-2006-hoa-lai-stela-discovery').periodId,'vn-modern');
 assert.equal(get('vn-450-go-thap-buddhist-vishnu-sculptures').periodId,'vn-funan');for(const y of [1993,1997])assert.equal(vietnam.find(e=>e.year===y&&e.placeId==='vn-thap-muoi').periodId,'vn-modern');
 const build=get('vn-1805-hue-citadel-construction');assert.equal(build.endYear,1832);assert.equal(eventMatches(build,{countryCode:'VN',period:'vn-nguyen',scope:'year',year:1820},places),true);
});

test('Vietnam modern chronology distinguishes documented signing, construction, operation and disputed reports',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 assert.equal(get('vn-1946-september-modus-vivendi-signed').date,'1946-09-15');assert.match(get('vn-1946-september-modus-vivendi-signed').summary,/十四日.*十五日/);
 assert.match(get('vn-1964-tonkin-gulf-clash').summary,/未经证实/);
 const war=get('vn-1965-rolling-thunder-bombing-starts');assert.equal(war.date,'1965-03-02');assert.equal(war.endYear,1968);assert.equal(eventMatches(war,{countryCode:'VN',period:'vn-divided',scope:'year',year:1967},places),true);
 assert.equal(get('vn-1964-thac-ba-formal-construction').date,'1964-08-19');assert.equal(get('vn-1970-thac-ba-river-closure').date,'1970-02-22');assert.equal(get('vn-1971-thac-ba-first-generation').date,'1971-10-05');
 assert.equal(get('vn-2009-dung-quat-first-products').placeId,'vn-binh-son');assert.equal(get('vn-2011-dung-quat-formal-inauguration').date,'2011-01-06');
 assert.equal(get('vn-2011-thu-thiem-tunnel-public-traffic').date,'2011-11-21');assert.equal(places.get('vn-uong-bi').regionCode,places.get('vn-ha-long').regionCode);
 assert.match(get('vn-1986-bach-ho-first-commercial-oil').locationNote,/外海/);assert.equal(get('vn-1987-bach-ho-fractured-basement-discovery').date,'1987-05-09');assert.equal(get('vn-1988-bach-ho-basement-oil-production').date,'1988-09-06');
});

test('Vietnam medieval local history distinguishes uncertain calendars, contested sites and administrative artefacts',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 const b=get('vn-1408-bo-co-battle-traditional-chronology');assert.equal(b.date,null);assert.equal(b.precision,'year');assert.match(b.summary,/农历.*跨入公历/);assert.equal(b.placeId,'vn-y-yen');
 assert.match(get('vn-1416-lung-nhai-oath').locationNote,/分歧/);assert.equal(get('vn-1426-tot-dong-chuc-dong-battle').placeId,'vn-chuong-my');
 const f=get('vn-1199-ly-flood-famine-and-grain-relief');assert.equal(f.endYear,1200);assert.equal(eventMatches(f,{countryCode:'VN',period:'vn-ly',scope:'year',year:1200},places),true);
 const p=get('vn-1377-mon-ha-sanh-seal-cast');assert.match(p.locationNote,/没有说明铸造地/);assert.equal(get('vn-1962-mon-ha-sanh-seal-discovered').placeId,'vn-huong-khe');
 assert.equal(get('vn-1061-nghiem-quang-keo-founded').placeId,'vn-nam-dinh');assert.equal(get('vn-1632-keo-thai-binh-rebuilt').placeId,'vn-vu-thu');
 assert.equal(places.get('vn-bac-giang').regionCode,places.get('vn-bac-ninh').regionCode);assert.equal(places.get('vn-chi-lang').regionCode,places.get('langson').regionCode);
 assert.equal(get('vn-1407-gian-dinh-restoration-proclaimed').periodId,'vn-ming');assert.equal(get('vn-1802-tay-son-nhat-le-counteroffensive').periodId,'vn-tayson');
});

test('Vietnam modern records distinguish adoption, operation, time zones and regional disaster duration',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 assert.equal(get('vn-1953-land-reform-law-adopted').date,'1953-12-04');assert.equal(get('vn-1999-enterprise-law-1999').date,'1999-06-12');assert.match(get('vn-1999-enterprise-law-1999').summary,/2000年1月1日生效/);
 assert.equal(get('vn-2010-ham-luong-bridge-technical-opening').date,'2010-01-17');assert.match(get('vn-2010-ham-luong-bridge-technical-opening').title,/技术通车/);
 const sat=get('vn-2008-vinasat-one-launched');assert.equal(sat.date,'2008-04-19');assert.match(sat.locationNote,/越南时间/);assert.match(sat.locationNote,/库鲁/);
 const drought=get('vn-2015-drought-and-saline-intrusion');assert.equal(drought.endYear,2016);assert.equal(eventMatches(drought,{countryCode:'VN',period:'vn-modern',scope:'year',year:2016},places),true);
 assert.equal(get('vn-2016-central-coast-fish-deaths').date,'2016-04');assert.equal(get('vn-2016-formosa-responsibility-announced').date,'2016-06-30');
 assert.equal(places.get('vn-phuoc-long').regionCode,'VN-GEO-DNA');assert.ok(places.get('vn-phuoc-long').lat>11);
 assert.equal(get('vn-1969-provisional-revolutionary-government').placeId,'vn-tan-bien');assert.equal(get('vn-1975-buon-ma-thuot-captured').placeId,'vn-buon-ma-thuot');
 assert.match(get('vn-2000-western-pacific-polio-free').summary,/野生脊灰病毒/);assert.match(get('vn-1984-dalat-reactor-restarted').summary,/研究设施/);
});

test('Vietnam older history keeps calendar estimates, pre-existing institutions and multi-year works distinct',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 for(const id of ['vn-1401-ho-population-registration','vn-1462-le-exam-candidate-certification','vn-1497-le-hien-tong-accession','vn-1504-le-successive-imperial-deaths','vn-1540-mac-ming-border-submission']){assert.equal(get(id).date,null);assert.equal(get(id).precision,'year');}
 assert.match(get('vn-1497-le-hien-tong-accession').summary,/景统元年.*次年/);
 assert.equal(get('vn-1820-nguyen-imperial-document-office').year,1820);assert.equal(get('vn-1829-nguyen-cabinet-established').year,1829);assert.match(get('vn-1829-nguyen-cabinet-established').summary,/现代议会制/);
 assert.match(get('vn-1830-nguyen-hanlin-office-building').summary,/职衔早已存在/);assert.match(get('vn-1822-nguyen-first-metropolitan-examination').summary,/阮朝自身首次/);
 for(const [id,end]of [['vn-1819-vinh-te-canal-construction',1824],['vn-1835-nguyen-nine-dynastic-urns',1837],['vn-1820-minh-mang-cholera-epidemic',1821],['vn-2017-oc-eo-nen-chua-archaeology-project',2020]]){assert.equal(get(id).endYear,end);assert.equal(eventMatches(get(id),{countryCode:'VN',period:get(id).periodId,scope:'year',year:end},places),true);}
 assert.match(get('vn-350-go-thanh-oc-eo-settlement').locationNote,/代表值/);assert.match(get('vn-450-tan-long-late-oc-eo-artifacts').summary,/1897/);
 assert.match(get('vn-1540-mac-ming-border-submission').locationNote,/明方关营/);assert.equal(get('vn-1573-le-the-tong-enthronement').placeId,'vn-thanh-hoa');
 assert.equal(places.get('vn-tien-hai').regionCode,'VN-GEO-HYN');assert.equal(places.get('vn-ha-tien').regionCode,'VN-GEO-AGG');assert.ok(places.get('vn-tan-hong').lat<12);assert.equal(places.get('vn-cho-gao').regionCode,'VN-GEO-DTP');
 assert.equal(get('vn-1979-han-nom-institute-founded').date,'1979-09-13');
});

test('Vietnam postwar records separate enactment, effect, reporting dates and overseas reference points',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 for(const [id,date] of [['vn-1985-currency-redenomination','1985-09-14'],['vn-1993-land-use-rights-law','1993-07-14'],['vn-2005-anti-corruption-law-adopted','2005-11-29'],['vn-2009-health-insurance-law-effective','2009-07-01'],['vn-2023-us-comprehensive-strategic-partnership','2023-09-10']])assert.equal(get(id).date,date);
 assert.match(get('vn-1993-land-use-rights-law').summary,/十月十五日生效/);assert.match(get('vn-1993-land-use-rights-law').summary,/不把使用权扩展写成土地所有权私有化/);
 assert.match(get('vn-1989-cambodia-withdrawal-announced').summary,/没有国际核验/);assert.equal(get('vn-1989-cambodia-withdrawal-announced').precision,'month');assert.equal(get('vn-1990-first-reported-hiv-case').precision,'year');
 assert.match(get('vn-1979-orderly-departure-program').locationNote,/日内瓦/);assert.match(get('vn-1991-cambodia-paris-settlement').locationNote,/法国巴黎/);assert.match(get('vn-1988-johnson-south-reef-clash').locationNote,/主权争议/);assert.match(get('vn-2014-haiyang-shiyou-981-dispute').locationNote,/不提供争议区域的国家归属/);
 for(const [id,end] of [['vn-1962-ranch-hand-herbicide-program',1971],['vn-1978-boat-refugee-surge',1979],['vn-1989-comprehensive-refugee-plan',1996],['vn-2012-danang-dioxin-cleanup',2018]]){const e=get(id);assert.equal(e.endYear,end);assert.equal(eventMatches(e,{countryCode:'VN',period:e.periodId,scope:'year',year:end},places),true);}
 assert.equal(get('vn-2019-bien-hoa-dioxin-remediation-start').endYear,undefined);assert.equal(get('vn-1978-ba-chuc-massacre').precision,'month');assert.equal(get('vn-2007-can-tho-bridge-construction-collapse').placeId,'vn-vinh-long');
 assert.equal(places.get('vn-ba-chuc').regionCode,'VN-GEO-AGG');assert.equal(places.get('vn-thu-dau-mot').regionCode,'VN-GEO-HCM');assert.equal(places.get('vn-bien-hoa').regionCode,'VN-GEO-DNA');
});

test('Vietnam gap records preserve ancient chronology, overseas battle references and date precision',()=>{
 const get=id=>{const e=byId.get(id);assert.ok(e,id);return e;};
 assert.equal(get('vn--110-han-jiaozhi-commandery-system').year,-110);assert.equal(get('vn--110-han-jiaozhi-commandery-system').precision,'year');
 assert.equal(get('vn-226-shi-family-displaced').year,226);assert.match(get('vn-263-lu-xing-jiaozhi-revolt').summary,/曹魏尚未禅位/);
 assert.equal(get('vn-571-ly-phat-tu-overthrows-trieu').precision,'year');assert.match(get('vn-571-ly-phat-tu-overthrows-trieu').summary,/570和571/);
 assert.equal(get('vn-950-ngo-xuong-van-restoration').year,950);assert.match(get('vn-950-ngo-xuong-van-restoration').summary,/951年/);
 for(const id of ['vn-1951-vinh-yen-battle','vn-1952-na-san-entrenched-camp-battle','vn-1967-dak-to-highlands-battle','vn-1998-apec-membership'])assert.equal(get(id).precision,'month');
 assert.equal(get('vn-1978-unified-currency-issue').precision,'year');assert.equal(get('vn-1968-khe-sanh-siege').date,'1968-01-21');
 assert.equal(get('vn-1971-lam-son-719-laos-incursion').date,'1971-02-08');assert.match(get('vn-1971-lam-son-719-laos-incursion').locationNote,/老挝/);
 assert.match(get('vn-1925-thanh-nien-first-issue').locationNote,/广州/);assert.match(get('vn-1995-mekong-agreement-signature').locationNote,/泰国清莱/);
 assert.equal(places.get('vn-vinh-yen').regionCode,'VN-GEO-PHT');assert.equal(places.get('vn-dak-to').regionCode,'VN-GEO-QNI');
 assert.match(get('vn-1990-companies-law-adopted').summary,/1991年四月十五日施行/);assert.equal(get('vn-2006-gender-equality-law-adopted').date,'2006-11-29');
});
