import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {CAMBODIA_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),cambodia=data.events.filter(e=>e.periodId?.startsWith('kh-')),byId=new Map(cambodia.map(e=>[e.id,e]));
test('Cambodia corpus has independent periods and sourced geography, dates and categories',()=>{
 assert.equal(periodsForCountry('KH'),CAMBODIA_PERIODS);assert.ok(cambodia.length>=443);assert.deepEqual(periodBounds('all',2026,'KH'),[-11999,2026]);assert.ok(Object.isFrozen(CAMBODIA_PERIODS));
 const specific=CAMBODIA_PERIODS.filter(p=>!p.navigationOnly);assert.equal(specific.length,11);for(const p of CAMBODIA_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');}
 for(const p of specific)assert.ok(cambodia.some(e=>e.periodId===p.id),p.id);
 const ids=new Set(),titles=new Set(),sources=new Set(),regions=new Set();
 for(const e of cambodia){
  assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);sources.add(e.sourceUrl);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);assert.equal(periodForEvent(e,'KH')?.id,e.periodId,e.id);assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'KH')).length,1,e.id);
  for(const c of ['CN','JP','KR','KP','MN','VN','LA'])assert.equal(periodForEvent(e,c),null,e.id);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'KH',e.id);assert.ok(p.regionName&&p.regionCode&&p.lon>=102&&p.lon<=108&&p.lat>=10&&p.lat<=15);regions.add(p.regionCode);
  assert.equal(new URL(e.sourceUrl).protocol,'https:');assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle));
  if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full);assert.equal(Number(full.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.ok(sources.size>=35);assert.ok(regions.size>=9);for(const category of ['政治','战争','外交','经济','社会','科技','文化','灾害'])assert.ok(cambodia.some(e=>e.category===category),category);
 assert.equal(data.meta.collections.filter(p=>p.countryCode==='KH').reduce((n,p)=>n+p.events,0),cambodia.length);
});
test('Cambodia civil-date transitions assign only one regime and leave uncertain boundary years unresolved',()=>{
 for(const [date,id]of [['1863-08-10','kh-post'],['1863-08-11','kh-colonial'],['1953-11-08','kh-colonial'],['1953-11-09','kh-kingdom'],['1970-10-08','kh-kingdom'],['1970-10-09','kh-republic'],['1975-04-16','kh-republic'],['1975-04-17','kh-rouge'],['1979-01-07','kh-rouge'],['1979-01-08','kh-prk'],['1989-04-29','kh-prk'],['1989-04-30','kh-transition'],['1993-09-23','kh-transition'],['1993-09-24','kh-modern']]){
  const e={year:Number(date.slice(0,4)),date};assert.equal(periodForEvent(e,'KH')?.id,id);assert.deepEqual(CAMBODIA_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'KH')).map(p=>p.id),[id]);
 }
 for(const year of [1863,1953,1970,1975,1979,1989,1993])assert.equal(periodForEvent({year},'KH'),null);
 assert.equal(byId.get('kh-1970-sihanouk-deposed').periodId,'kh-kingdom');assert.equal(byId.get('kh-1970-khmer-republic-proclaimed').date,'1970-10-09');
 assert.equal(byId.get('kh-1975-rouge-occupies-phnom-penh').date,'1975-04-17');assert.equal(byId.get('kh-1976-democratic-kampuchea-constitution').date,'1976-01-05');assert.match(byId.get('kh-1979-revolutionary-council-administration').summary,/不同记载/);
});
test('Cambodia country, regional, place and annual filters discover records without other years leaking',()=>{
 for(const e of cambodia){const p=places.get(e.placeId),f={countryCode:'KH',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,f,places),true,e.id);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);assert.equal(eventMatches(e,{...f,year:(e.endYear??e.year)+1},places),false);
  assert.equal(eventMatches(e,{...f,query:p.name},places),true);assert.equal(eventMatches(e,{...f,countryCode:'LA',period:'all'},places),false);
 }
 const occupation=byId.get('kh--11999-laang-spean-hoabinhian-phase');assert.equal(occupation.endYear,-4999);assert.equal(eventMatches(occupation,{countryCode:'KH',scope:'year',year:-7000},places),true);assert.equal(eventMatches(occupation,{countryCode:'KH',scope:'year',year:-4998},places),false);
 assert.match(places.get('kh-battambang').description,/参考/);assert.match(occupation.locationNote,/城外/);assert.match(places.get('kh-oudong').description,/同名行政市/);
});
test('Cambodia archaeology, currency, heritage and health preserve event stage and dating limits',()=>{
 const ancient=byId.get('kh-802-jayavarman-two-kulen-ceremony');assert.equal(ancient.date,null);assert.match(ancient.summary,/802至803/);assert.match(byId.get('kh-1431-angkor-political-centre-shift').summary,/继续存在/);
 assert.equal(byId.get('kh-921-kravan-vishnu-dedication').date,'0921-12-12');assert.equal(byId.get('kh-1884-french-administrative-convention').precision,'month');
 assert.equal(byId.get('kh-1979-central-bank-reestablished').date,'1979-10-10');assert.equal(byId.get('kh-1980-riel-banknotes-reissued').date,'1980-03-20');
 assert.equal(byId.get('kh-1992-untac-established').date,'1992-02-28');assert.equal(byId.get('kh-1993-kingdom-restored-constitution').date,'1993-09-24');
 const covid=byId.get('kh-2020-first-coronavirus-confirmed');assert.equal(covid.date,'2020-01-27');assert.equal(covid.placeId,'kh-sihanoukville');assert.match(covid.summary,/通报发布在次日/);
 assert.equal(byId.get('kh-2003-royal-ballet-proclaimed').year,2003);assert.equal(byId.get('kh-2008-royal-ballet-representative-list').year,2008);assert.match(byId.get('kh-2016-chapei-urgent-safeguarding').summary,/急需保护/);
 assert.equal(byId.get('kh-2024-tuol-sleng-archive-phase-two').endYear,undefined);assert.match(byId.get('kh-2024-tuol-sleng-archive-phase-two').summary,/计划延续/);
 assert.equal(byId.get('kh-2025-memorial-sites-world-heritage').date,'2025-07-11');assert.match(byId.get('kh-2025-memorial-sites-world-heritage').locationNote,/首都以外/);
});

test('Cambodia institutional chronology separates construction, opening, legal enactment and judicial stages',()=>{
 for(const [id,date]of [['kh-1917-museum-foundation','1917-08-15'],['kh-1920-museum-open','1920-04-13'],['kh-1951-museum-administration-transfer','1951-08-09'],['kh-1979-museum-reopened','1979-04-13'],['kh-1960-water-authority-decree','1960-03-24'],['kh-2003-eccc-agreement-signed','2003-06-06'],['kh-2005-eccc-agreement-effective','2005-04-29'],['kh-2010-duch-trial-judgment','2010-07-26'],['kh-2012-duch-appeal-life','2012-02-03'],['kh-2022-case-00202-appeal-final','2022-09-22']])assert.equal(byId.get(id)?.date,date,id);
 assert.match(byId.get('kh-1938-khmer-dictionary-volume-one').summary,/第二卷尚未出版/);
 assert.match(byId.get('kh-2018-case-00202-judgment').summary,/农谢另被认定针对占族/);
 assert.match(byId.get('kh-2026-national-mine-action-policy').summary,/未来.*不作为已完成/);assert.equal(byId.get('kh-2026-national-mine-action-policy').endYear,undefined);
});
test('Cambodia provincial health and mine training records are retrieved by place and year',()=>{
 for(const [id,place,year]of [['kh-2018-rabies-battambang-centre','kh-battambang',2018],['kh-2019-rabies-kampong-cham-centre','kh-kampong-cham',2019],['kh-1997-mine-training-centre','kh-kampong-chhnang',1997]]){
  const e=byId.get(id),p=places.get(place);assert.equal(e.placeId,place);assert.equal(eventMatches(e,{countryCode:'KH',region:p.regionCode,city:p.id,scope:'year',year},places),true);assert.equal(eventMatches(e,{countryCode:'KH',city:p.id,scope:'year',year:year-1},places),false);
 }
 assert.equal(byId.get('kh-1190-bayon-building').date,null);assert.match(byId.get('kh-1190-bayon-building').locationNote,/约年/);
});

test('Cambodia new corpus separates port construction, completion and public opening',()=>{
 for(const [id,date]of [['kh-1956-sihanouk-port-construction','1956-05-16'],['kh-1959-sihanouk-old-port-completion','1959-08-15'],['kh-1960-sihanouk-old-port-open','1960-04'],['kh-1964-engineering-institute-inauguration','1964-09-20'],['kh-1981-engineering-first-restored-intake','1981-09-17'],['kh-1993-engineering-french-agreement','1993-09-10'],['kh-1963-sihanouk-aid-rejection-announcement','1963-11-16'],['kh-1966-communist-party-renaming','1966-09'],['kh-1967-samlaut-peasant-clashes','1967-04'],['kh-2002-first-commune-council-election','2002-02-03']]) assert.equal(byId.get(id)?.date,date,id);
 assert.equal(byId.get('kh-1993-engineering-french-agreement').periodId,'kh-transition');
 assert.equal(byId.get('kh-1975-us-embassy-evacuation').periodId,'kh-republic');
 assert.equal(byId.get('kh-1970-nixon-cambodia-operation-announcement').periodId,'kh-kingdom');
 assert.equal(byId.get('kh-2002-commune-sangkat-fund').precision,'month');
 assert.match(byId.get('kh-2002-commune-sangkat-fund').locationNote,/24日与25日差异/);
 assert.equal(byId.get('kh-2019-bakheng-third-phase').endYear,undefined);
});
test('Cambodia provincial archaeology and public health use annual and regional filters',()=>{
 for(const [id,place,year]of [['kh-1994-svay-rieng-community-tb','kh-svay-rieng',1994],['kh-1997-kampot-tb-programme','kh-kampot',1997],['kh-2005-kampong-trach-aids-clinic','kh-kampong-trach',2005],['kh-1967-samlaut-peasant-clashes','kh-samlaut',1967],['kh-2011-prohear-provincial-exhibition','kh-prey-veng',2011]]){
  const e=byId.get(id),p=places.get(place);assert.equal(e.placeId,place);
  assert.equal(eventMatches(e,{countryCode:'KH',region:p.regionCode,city:p.id,scope:'year',year},places),true);
  assert.equal(eventMatches(e,{countryCode:'KH',city:p.id,scope:'year',year:year-1},places),false);
 }
 assert.equal(byId.get('kh--99-prohear-iron-age-burials').year,-99);
 assert.match(byId.get('kh--99-prohear-iron-age-burials').locationNote,/公元前100年/);
 assert.equal(byId.get('kh-1000-ta-keo-building').date,null);
 assert.match(byId.get('kh-1000-ta-keo-building').summary,/不能把雷击传说/);
 assert.equal(byId.get('kh-2022-banteay-kdei-gate-restoration').endYear,2023);
 assert.match(byId.get('kh-2022-banteay-kdei-gate-restoration').summary,/2024年一月为成果通报/);
});

test('Cambodia legislation and census dates distinguish promulgation, translations and enumeration',()=>{
 for(const [id,date]of [['kh-2001-land-law-promulgated','2001-08-30'],['kh-2002-forestry-law-promulgated','2002-08-31'],['kh-2006-fisheries-law-promulgated','2006-05-21'],['kh-2008-protected-areas-law-promulgated','2008-02-15'],['kh-1996-environment-law-promulgated','1996-12-24'],['kh-1999-environmental-impact-assessment-process','1999-08-11'],['kh-2007-civil-code-promulgated','2007-12-08'],['kh-1998-population-census-1998','1998-03-03'],['kh-2008-population-census-2008','2008-03-03'],['kh-2019-population-census-2019','2019-03-03']])assert.equal(byId.get(id)?.date,date,id);
 assert.equal(byId.get('kh-1997-labour-code-promulgated').precision,'month');
 assert.equal(byId.get('kh-1962-first-modern-population-census').periodId,'kh-kingdom');
 assert.equal(byId.get('kh-2011-civil-code-application').date,'2011-12');
 assert.match(byId.get('kh-2011-civil-code-application').locationNote,/20日.*21日/);
 assert.match(byId.get('kh-2006-fisheries-law-promulgated').summary,/2007年三月.*不作为/);
 assert.match(byId.get('kh-1998-population-census-1998').summary,/未能进入/);
});
test('Cambodia elections and regional recovery retain filters, event stages and geographic limits',()=>{
 for(const [id,date]of [['kh-1998-national-assembly-election-1998','1998-07-26'],['kh-2003-national-assembly-election-2003','2003-07-27'],['kh-2008-national-assembly-election-2008','2008-07-27'],['kh-2013-national-assembly-election-2013','2013-07-28'],['kh-2017-commune-council-election-2017','2017-06-04'],['kh-2018-national-assembly-election-2018','2018-07-29'],['kh-2023-national-assembly-election-2023','2023-07-23'],['kh-2006-senate-first-indirect-election','2006-01-22'],['kh-2018-poipet-sisophon-railway-reopened','2018-04-04'],['kh-2018-battambang-pursat-railway-reopened','2018-05-29'],['kh-2018-northern-railway-whole-route-operational','2018-07-04'],['kh-2023-siem-reap-angkor-airport-opens','2023-10-16'],['kh-2025-techo-airport-operations-relocated','2025-09-09']])assert.equal(byId.get(id)?.date,date,id);
 assert.match(byId.get('kh-2006-senate-first-indirect-election').summary,/不属于.*直接投票/);
 assert.match(byId.get('kh-2018-northern-railway-whole-route-operational').summary,/不等于.*国际客运/);
 assert.match(byId.get('kh-2021-phnom-penh-takmao-lockdown').summary,/不能.*全国/);
 for(const [id,place,year]of [['kh-2018-poipet-sisophon-railway-reopened','kh-poipet',2018],['kh-2016-pursat-drought-water-shortage','kh-pursat',2016],['kh-2016-ratana-drought-water-health','kh-banlung',2016],['kh-2000-upper-mekong-flood-return','kh-stung-treng',2000],['kh-2015-tsubasa-bridge-open','kh-neak-loeang',2015],['kh-2011-kampong-thom-flood-observation','kh-kampong-thom',2011]]){
  const e=byId.get(id),p=places.get(place);assert.equal(e.placeId,place,id);
  assert.equal(eventMatches(e,{countryCode:'KH',region:p.regionCode,city:p.id,scope:'year',year},places),true);
  assert.equal(eventMatches(e,{countryCode:'KH',city:p.id,scope:'year',year:year-1},places),false);
 }
 assert.equal(byId.get('kh-1929-northern-railway-building-phase').endYear,1942);
 assert.equal(byId.get('kh-2009-railway-concession-agreement').endYear,undefined);
 assert.match(byId.get('kh-2012-sihanouk-death').locationNote,/中国北京/);
});

test('Cambodia early inscriptions retain approximate years and distinct Sambor geography',()=>{
 for(const id of ['kh-611-k600-temple-performers','kh-683-k127-zero-date-inscription','kh-667-k53-medical-family-dedication','kh-692-k132-physician-goddess-dedication','kh-1011-royal-palace-loyalty-oath','kh-1190-banteay-chhmar-temple-complex']){
  const e=byId.get(id);assert.equal(e.precision,'year',id);assert.equal(e.date,null,id);assert.equal(e.endYear,undefined,id);
 }
 for(const id of ['kh-683-k127-zero-date-inscription','kh-692-k132-physician-goddess-dedication'])assert.equal(byId.get(id).placeId,'kh-kratie');
 assert.match(byId.get('kh-683-k127-zero-date-inscription').summary,/604.*605/);
 assert.match(byId.get('kh-611-k600-temple-performers').summary,/不能.*现代王家芭蕾/);
 assert.equal(byId.get('kh--399-angkor-borei-early-settlement').year,-399);
 assert.equal(byId.get('kh--199-vat-komnou-burial-phase').endYear,200);
 const p=places.get('kh-banteay-chhmar');assert.equal(p.regionCode,'KH-GEO-25');
 assert.ok(Math.abs(p.lat-(14+4/60+16/3600))<1e-9);assert.ok(Math.abs(p.lon-(103+5/60+59/3600))<1e-9);
 const e=byId.get('kh-2020-banteay-chhmar-tentative-list');assert.equal(e.date,'2020-03-27');assert.match(e.summary,/不等于.*世界遗产/);
 assert.equal(eventMatches(e,{countryCode:'KH',region:p.regionCode,city:p.id,scope:'year',year:2020},places),true);
 assert.equal(eventMatches(e,{countryCode:'KH',city:p.id,scope:'year',year:2019},places),false);
});
test('Cambodia colonial and conflict records distinguish authorization, operations and later commemoration',()=>{
 for(const [id,date]of [['kh-1864-protectorate-treaty-ratifications','1864-04-14'],['kh-1867-franco-siamese-cambodia-treaty','1867-07-15'],['kh-1887-indochinese-union-administration','1887-10-17'],['kh-1911-indochina-governor-general-powers','1911-10-20'],['kh-1905-stung-treng-administrative-transfer','1905-01-01'],['kh-1946-franco-cambodian-modus-vivendi','1946-01-07'],['kh-1946-first-consultative-assembly-election','1946-09-01'],['kh-1969-operation-menu-first-bombing','1969-03-18'],['kh-1973-neak-loeang-bombing-error','1973-08-06'],['kh-1973-us-cambodia-bombing-halt','1973-08-15'],['kh-1991-unamic-authorized','1991-10-16'],['kh-1992-unamic-mine-clearance-mandate','1992-01-08'],['kh-1992-refugee-repatriation-first-group','1992-03-30'],['kh-1979-tuol-sleng-museum-open','1979-08-19'],['kh-2021-tuol-sleng-digital-archives-launched','2021-01-29'],['kh-1958-iaea-first-membership','1958-02-06'],['kh-2009-iaea-membership-restored','2009-11-23']])assert.equal(byId.get(id)?.date,date,id);
 assert.match(byId.get('kh-1887-indochinese-union-administration').summary,/不包括老挝/);
 assert.equal(byId.get('kh-1945-japanese-backed-independence-declaration').date,'1945-03');
 assert.match(byId.get('kh-1945-japanese-backed-independence-declaration').locationNote,/13日.*12日/);
 assert.equal(byId.get('kh-1973-neak-loeang-bombing-error').placeId,'kh-neak-loeang');
 assert.equal(byId.get('kh-1973-m13-current-site-prison-phase').endYear,1975);
 assert.equal(byId.get('kh-1975-s21-security-office-operational').date,'1975-10');
 assert.match(byId.get('kh-1975-s21-security-office-operational').summary,/不能.*自始/);
 assert.equal(byId.get('kh-1988-choeung-ek-memorial-stupa-built').year,1988);
 assert.match(byId.get('kh-1988-choeung-ek-memorial-stupa-built').locationNote,/1989.*落成/);
 assert.equal(byId.get('kh-1993-large-scale-refugee-return-completed').date,'1993-04');
});

test('Cambodia inscriptions and worksite chronology keep uncertainty separate from duration',()=>{
 for(const [id,year]of [['kh-550-k40-vat-bati-buddhist-patronage',550],['kh-650-k359-sanskrit-daily-recitation',650],['kh-674-k44-temple-assets-exemption',674],['kh-803-k124-queen-temple-provision',803],['kh-1977-trapeang-thma-forced-labour',1977]]){
  const e=byId.get(id);assert.equal(e.year,year,id);assert.equal(e.date,null,id);assert.equal(e.precision,'year',id);assert.equal(e.endYear,undefined,id);
 }
 assert.match(byId.get('kh-803-k124-queen-temple-provision').locationNote,/十世纪.*不是.*刻制年/);
 assert.match(byId.get('kh-550-k40-vat-bati-buddhist-patronage').summary,/不能.*吴哥/);
 assert.equal(byId.get('kh-550-k40-vat-bati-buddhist-patronage').placeId,'kh-takeo');assert.equal(places.get('kh-takeo').regionCode,'KH-GEO-19');
 assert.equal(byId.get('kh-1977-northwest-worksite-cadre-purge').date,'1977-07');assert.match(byId.get('kh-1977-northwest-worksite-cadre-purge').locationNote,/约月/);
 assert.equal(byId.get('kh-1673-nguyen-second-intervention').endYear,1679);assert.equal(byId.get('kh-1664-ang-tan-ubhayoraj-office').endYear,undefined);
 assert.match(byId.get('kh-1679-prei-nokor-garrison-phase').locationNote,/今越南.*不是|今越南.*不表示/);
 const e=byId.get('kh-1975-forced-transfer-second-phase');assert.equal(e.date,'1975-09');assert.equal(e.endYear,1977);assert.equal(eventMatches(e,{countryCode:'KH',scope:'year',year:1977},places),true);assert.equal(eventMatches(e,{countryCode:'KH',scope:'year',year:1978},places),false);
 assert.equal(byId.get('kh-1976-four-year-economic-plan-drafted').endYear,undefined);assert.match(byId.get('kh-1976-four-year-economic-plan-drafted').locationNote,/不以.*1980.*结束/);
});
test('Cambodia relief, elections and diplomacy use occurrence dates and retain reference-place limits',()=>{
 for(const [id,date]of [['kh-1843-baphnom-commercial-letters','1843-12-17'],['kh-1976-representative-assembly-election','1976-03-20'],['kh-1979-icrc-unicef-offices-authorized','1979-09-23'],['kh-1979-relief-air-shuttle-first-flight','1979-10-13'],['kh-1980-svay-rieng-food-relief','1980-09-07'],['kh-1979-vietnam-prk-friendship-treaty','1979-02-18'],['kh-1981-prk-first-assembly-election','1981-05-01'],['kh-1985-hun-sen-first-premiership','1985-01-14'],['kh-1982-un-border-relief-operation','1982-01-01'],['kh-1982-opposition-coalition-government','1982-06-22'],['kh-1989-first-paris-peace-conference','1989-07-30'],['kh-1990-p5-political-settlement-framework','1990-08-28'],['kh-1990-supreme-national-council-agreed','1990-09-10'],['kh-1990-security-council-framework-endorsement','1990-09-20'],['kh-1970-royal-national-union-government','1970-05-05']])assert.equal(byId.get(id)?.date,date,id);
 for(const [id,date]of [['kh-1974-urban-evacuation-planning','1974-06'],['kh-1976-state-presidium-confirmation','1976-04'],['kh-1971-chenla-two-offensive','1971-08'],['kh-1979-absentia-tribunal-pol-pot-ieng-sary','1979-08'],['kh-1980-kampong-cham-leprosy-care','1980-09'],['kh-1986-private-economy-constitutional-recognition','1986-02'],['kh-1989-vietnam-reported-withdrawal','1989-09']])assert.equal(byId.get(id)?.date,date,id);
 assert.equal(byId.get('kh-1970-royal-national-union-government').periodId,'kh-kingdom');assert.match(byId.get('kh-1970-royal-national-union-government').locationNote,/北京.*而非现场/);
 assert.match(byId.get('kh-1989-vietnam-reported-withdrawal').summary,/无联合国.*认证/);assert.match(byId.get('kh-1982-opposition-coalition-government').locationNote,/吉隆坡/);
 const e=byId.get('kh-1980-svay-rieng-food-relief'),p=places.get(e.placeId);assert.equal(e.placeId,'kh-svay-rieng');assert.equal(eventMatches(e,{countryCode:'KH',region:p.regionCode,city:p.id,scope:'year',year:1980},places),true);assert.equal(eventMatches(e,{countryCode:'KH',city:'kh-phnom-penh',scope:'year',year:1980},places),false);
});

test('Cambodia armistice dates distinguish signature, legal force and scheduled simultaneous ceasefire',()=>{
 const signature=byId.get('kh-1954-geneva-armistice-signature'),ceasefire=byId.get('kh-1954-geneva-complete-ceasefire-effective');
 assert.equal(signature.date,'1954-07-20');assert.equal(ceasefire.date,'1954-08-07');assert.match(signature.summary,/七月二十三日生效/);assert.match(signature.locationNote,/日内瓦/);assert.match(signature.locationNote,/发送日期/);assert.match(ceasefire.summary,/文本确定/);assert.match(ceasefire.summary,/违约/);
 const transfer=byId.get('kh-1972-cheng-heng-power-transfer'),vote=byId.get('kh-1972-republic-constitution-referendum'),president=byId.get('kh-1972-lon-nol-presidential-election');
 assert.equal(transfer.date,'1972-03-10');assert.equal(vote.date,'1972-04-30');assert.equal(president.date,'1972-06-04');assert.match(transfer.summary,/行政交接/);assert.match(vote.summary,/公平/);
 const resistance=byId.get('kh-1950-son-ngoc-minh-resistance-government');assert.match(resistance.summary,/抵抗政府/);assert.match(resistance.summary,/后来成立/);assert.equal(resistance.date,null);assert.match(resistance.locationNote,/非已确认/);
});
test('Cambodia archaeological ranges, calendar limits and temple geography remain explicit',()=>{
 const snay=byId.get('kh--349-phum-snay-burial-phase'),borei=byId.get('kh--199-phnom-borei-iron-age-burials');
 assert.equal(snay.year,-349);assert.equal(snay.endYear,200);assert.equal(borei.endYear,0);assert.equal(eventMatches(snay,{countryCode:'KH',scope:'year',year:100},places),true);assert.equal(eventMatches(borei,{countryCode:'KH',scope:'year',year:1},places),false);
 const queen=byId.get('kh-1577-sujata-angkor-wat-devotion');assert.equal(queen.date,null);assert.equal(queen.precision,'year');assert.match(queen.locationNote,/儒略历/);
 assert.equal(byId.get('kh-1186-k537-royal-hospital-provision').placeId,'kh-ta-keo');assert.match(byId.get('kh-1186-k537-royal-hospital-provision').locationNote,/非茶胶省/);assert.match(byId.get('kh-650-k81-hanchey-temple-property').locationNote,/字体年代/);
 const excavation=byId.get('kh-1962-memot-earthwork-excavation');assert.equal(excavation.year,1962);assert.equal(excavation.placeId,'kh-memot');assert.match(excavation.summary,/未经测年/);assert.match(excavation.locationNote,/当时属磅湛省/);assert.equal(places.get('kh-memot').regionCode,'KH-GEO-31');
 assert.match(byId.get('kh-1948-cambodian-liberation-committee').summary,/1978/);assert.equal(byId.get('kh-1949-dap-chhuon-royal-allegiance').placeId,'kh-angkor-wat');
});

test('Cambodia education distinguishes preparatory decisions, reopening and merger',()=>{
 const teacher=byId.get('kh-1980-teacher-training-reopening'),arts=byId.get('kh-1981-fine-arts-school-reopening');
 assert.equal(teacher.date,'1980-05-13');assert.equal(arts.date,'1981-01-27');assert.match(arts.locationNote,/1980年五月九日为筹备/);assert.match(arts.summary,/中等层次/);
 assert.equal(byId.get('kh-1917-cambodian-art-school-decree').date,'1917-12-14');assert.equal(byId.get('kh-1965-royal-fine-arts-university-decree').date,'1965-01-18');
 assert.match(byId.get('kh-1988-phnom-penh-university-merger').summary,/外语学院/);assert.equal(byId.get('kh-1988-phnom-penh-university-merger').date,null);
 assert.equal(byId.get('kh-2002-concession-logging-suspension').date,'2002-01-01');assert.match(byId.get('kh-2002-concession-logging-suspension').locationNote,/2001年十二月/);
 assert.match(byId.get('kh-1921-chup-rubber-estate-established').summary,/不认定/);assert.equal(places.get(byId.get('kh-1921-chup-rubber-estate-established').placeId).regionCode,'KH-GEO-31');
});
test('Cambodia inscriptions, sport and contemporary reporting preserve distinct dates and scopes',()=>{
 for(const id of ['kh-1612-japanese-angkor-ink-inscription','kh-1632-morimoto-angkor-devotion']){const e=byId.get(id);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.match(e.locationNote,/旧历/);}
 assert.match(byId.get('kh-1715-angkor-plan-japanese-copy').locationNote,/日本/);assert.match(byId.get('kh-1715-angkor-plan-japanese-copy').summary,/疑问/);
 const vote=byId.get('kh-1955-sangkum-assembly-election');assert.equal(vote.date,'1955-09-11');assert.match(vote.locationNote,/九月十二日/);assert.match(vote.summary,/美国使馆报告认为/);
 assert.equal(byId.get('kh-1966-asian-ganefo-opening').date,'1966-11-26');assert.match(byId.get('kh-1966-asian-ganefo-opening').summary,/亚洲范围/);assert.match(byId.get('kh-1966-asian-ganefo-opening').summary,/雅加达/);
 const mounds=byId.get('kh-1050-angkor-wat-mound-grid-phase');assert.equal(mounds.endYear,undefined);assert.match(mounds.locationNote,/概率|模型/);assert.equal(eventMatches(mounds,{countryCode:'KH',scope:'year',year:1075},places),false);
 assert.equal(byId.get('kh-2025-national-ai-education-conference').date,'2025-11-24');assert.match(byId.get('kh-2025-national-ai-education-conference').locationNote,/2026年更新/);assert.equal(byId.get('kh-2018-lkhon-khol-urgent-safeguarding').placeId,'kh-ta-khmao');
});

test('Cambodia royal correspondence separates written offers, investiture and later results',()=>{
 assert.equal(byId.get('kh-1699-danish-company-trade-letter').date,'1699-12-17');
 const patent=byId.get('kh-1704-macau-merchant-settlement-patent');assert.equal(patent.date,'1704-05-30');assert.match(patent.summary,/不证明.*已经落实/);
 assert.equal(byId.get('kh-1806-ang-chan-royal-titles').date,null);assert.equal(byId.get('kh-1807-vietnam-investiture-seal').year,1807);assert.match(byId.get('kh-1807-vietnam-investiture-seal').summary,/未立即实施直接统治/);
 const chronicle=byId.get('kh-1878-nupparoth-chronicle-revision');assert.equal(chronicle.year,1878);assert.match(chronicle.locationNote,/1907年/);assert.equal(chronicle.periodId,'kh-colonial');
});
test('Cambodia early modern inscriptions preserve approximate dates and evidence locations',()=>{
 for(const id of ['kh-1737-longvek-royal-recruitment-mission','kh-1744-tonle-sap-southern-security-campaign']){const e=byId.get(id);assert.equal(e.date,null);assert.equal(e.endYear,undefined);assert.match(e.locationNote,/约/);assert.equal(eventMatches(e,{countryCode:'KH',scope:'year',year:e.year+1},places),false);}
 const battle=byId.get('kh-1747-princess-royal-forces-conflict');assert.equal(battle.placeId,'kh-angkor-wat');assert.match(battle.locationNote,/碑址而非战场/);assert.match(battle.summary,/一方/);
 assert.equal(byId.get('kh-1701-angkor-long-poem-memorial').year,1701);assert.match(byId.get('kh-1701-angkor-long-poem-memorial').locationNote,/2001年/);
 const ordinations=byId.get('kh-1776-mission-local-priest-ordinations');assert.match(ordinations.summary,/族属分开/);assert.equal(ordinations.date,null);
});
