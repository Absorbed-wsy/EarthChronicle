import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {MYANMAR_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),records=data.events.filter(e=>e.periodId?.startsWith('mm-')),byId=new Map(records.map(e=>[e.id,e]));
test('Myanmar country navigation preserves parallel regional histories and sourced event ownership',()=>{
 assert.equal(periodsForCountry('MM'),MYANMAR_PERIODS);assert.ok(records.length>=495);assert.equal(MYANMAR_PERIODS.filter(p=>!p.navigationOnly).length,15);assert.deepEqual(periodBounds('all',2026,'MM'),[-19999,2026]);assert.ok(Object.isFrozen(MYANMAR_PERIODS));
 for(const p of MYANMAR_PERIODS){assert.ok(Object.isFrozen(p));if(!p.navigationOnly){assert.equal(new URL(p.sourceURL).protocol,'https:');assert.ok(records.some(e=>e.periodId===p.id),p.id);}}
 const ids=new Set(),titles=new Set(),sources=new Set(),regions=new Set();
 for(const e of records){
  assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);sources.add(e.sourceUrl);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);assert.equal(periodForEvent(e,'MM')?.id,e.periodId,e.id);assert.equal(MYANMAR_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'MM')).length,1,e.id);
  for(const c of ['CN','JP','KR','KP','MN','VN','LA','KH','TH'])assert.equal(periodForEvent(e,c),null,e.id);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'MM',e.id);assert.ok(p.regionName&&p.regionCode&&p.lon>=92&&p.lon<=102&&p.lat>=9&&p.lat<=29);regions.add(p.regionCode);
  assert.equal(new URL(e.sourceUrl).protocol,'https:');assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle));
  if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full);assert.equal(Number(full.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.ok(sources.size>=30);assert.ok(regions.size>=9);
 for(const category of ['政治','战争','外交','经济','社会','科技','文化','灾害'])assert.ok(records.some(e=>e.category===category),category);
 assert.equal(data.meta.collections.filter(p=>p.countryCode==='MM').reduce((n,p)=>n+p.events,0),records.length);
});
test('Myanmar modern transitions use actual civil dates, while incomplete transition years remain ambiguous',()=>{
 for(const [date,id]of [['1948-01-03','mm-colonial'],['1948-01-04','mm-union'],['1962-03-01','mm-union'],['1962-03-02','mm-military'],['2011-03-29','mm-military'],['2011-03-30','mm-reform'],['2021-01-31','mm-reform'],['2021-02-01','mm-contemporary']]){
  const e={year:Number(date.slice(0,4)),date};assert.equal(periodForEvent(e,'MM')?.id,id,date);assert.deepEqual(MYANMAR_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'MM')).map(p=>p.id),[id]);
 }
 for(const year of [1430,1752,1824,1948,1962,2011,2021])assert.equal(periodForEvent({year},'MM'),null);
 assert.equal(byId.get('mm-1539-hanthawaddy-toungoo-conquest').periodId,'mm-hanthawaddy');assert.equal(eventMatchesPeriod(byId.get('mm-1539-hanthawaddy-toungoo-conquest'),'mm-toungoo','MM'),false);
 assert.equal(byId.get('mm-1666-arakan-chittagong-loss').periodId,'mm-mrauku');
});
test('Myanmar annual and geographical filters include only the chosen region and active years',()=>{
 for(const e of records){const p=places.get(e.placeId),f={countryCode:'MM',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,f,places),true,e.id);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);assert.equal(eventMatches(e,{...f,year:(e.endYear??e.year)+1},places),false);assert.equal(eventMatches(e,{...f,query:p.name},places),true);assert.equal(eventMatches(e,{...f,countryCode:'TH',period:'all'},places),false);
 }
 assert.equal(places.get('mm-shwebo').lat,22.56925);assert.equal(places.get('mm-bagan').lat,21.17264);assert.equal(places.get('mm-pathein').lat,16.77919);assert.equal(places.get('mm-inwa').lat,21.85479);
});
test('Myanmar archaeology distinguishes ancient chronology, modern excavation and heritage registration',()=>{
 const bronze=byId.get('mm--999-oakaie-copper-transition');assert.equal(bronze.approximate,true);assert.equal(bronze.date,null);assert.match(bronze.locationNote,/公元前1000/);
 assert.equal(byId.get('mm-101-halin-urban-formation').endYear,300);assert.equal(byId.get('mm-1-sriksetra-urban-formation').endYear,300);
 assert.equal(byId.get('mm-1998-nyaunggan-excavation').endYear,1999);assert.equal(byId.get('mm-2014-oakaie-excavation').endYear,2015);
 assert.match(byId.get('mm-2013-badahlin-new-excavation').summary,/不能.*壁画/);
 assert.equal(byId.get('mm-1113-myazedi-inscription').year,1113);assert.equal(byId.get('mm-2015-myazedi-memory-world').year,2015);assert.match(byId.get('mm-1904-myazedi-third-fragment').locationNote,/不声称.*Forchhammer/);
 assert.equal(byId.get('mm-1557-bayinnaung-bell').date,'1557-05-23');assert.equal(byId.get('mm-2017-bayinnaung-memory-world').year,2017);assert.match(byId.get('mm-1868-kuthodaw-stones-complete').summary,/巴利文/);
});
test('Myanmar institutional and disaster records distinguish stages and reference locations',()=>{
 assert.equal(byId.get('mm-1947-independence-treaty').date,'1947-10-17');assert.match(byId.get('mm-1947-independence-treaty').locationNote,/伦敦/);assert.equal(byId.get('mm-1948-independence-day').date,'1948-01-04');assert.equal(byId.get('mm-1948-united-nations-membership').date,'1948-04-19');
 assert.equal(byId.get('mm-1948-union-bank').date,'1948-04-03');assert.equal(byId.get('mm-1952-central-bank-functions').date,'1952-07-01');assert.equal(byId.get('mm-2011-government-transfer').date,'2011-03-30');
 assert.equal(byId.get('mm-2014-population-census').date,'2014-03-30');assert.match(byId.get('mm-2014-population-census').locationNote,/二十九日/);assert.equal(byId.get('mm-2020-trachoma-validation').date,'2020-09-11');
 assert.equal(byId.get('mm-2008-nargis-cyclone').placeId,'mm-labutta');assert.match(byId.get('mm-2008-nargis-cyclone').summary,/不能.*单城/);assert.equal(byId.get('mm-2025-mandalay-earthquake').placeId,'mm-sagaing');assert.match(byId.get('mm-2025-mandalay-earthquake').summary,/7.7/);assert.match(byId.get('mm-2025-mandalay-earthquake').locationNote,/12:50:52/);
});

test('Myanmar transport and higher education distinguish openings, extensions and institutional upgrades',()=>{
 for(const [id,date]of [['mm-1877-yangon-pyay-railway','1877-05-01'],['mm-1898-mandalay-myitkyina-railway','1898-01-01'],['mm-1902-lashio-railway','1902-12-15'],['mm-1959-yangon-circular-railway','1959-05-01'],['mm-1925-mandalay-college','1925-07-04'],['mm-1958-mandalay-independent-university','1958-06-01']])assert.equal(byId.get(id).date,date);
 assert.equal(places.get('mm-myitkyina').regionCode,'MM-GEO-04');assert.equal(places.get('mm-lashio').regionCode,'MM-GEO-11');assert.equal(places.get('mm-mottama').regionCode,'MM-GEO-13');assert.equal(places.get('mm-minhla').regionCode,'MM-GEO-15');
 assert.notEqual(places.get('mm-mottama').id,'mm-mawlamyine');assert.match(byId.get('mm-1902-lashio-railway').locationNote,/非若开/);assert.match(byId.get('mm-1885-minhla-forts').locationNote,/非历史.*精确坐标/);
});
test('Myanmar expansion preserves constitutional, election and transfer dates without inventing source precision',()=>{
 for(const [id,date]of [['mm-1947-aung-san-attlee-agreement','1947-01-27'],['mm-1947-constitution-adopted','1947-09-24'],['mm-1974-socialist-constitution','1974-01-03'],['mm-1982-citizenship-law','1982-10-15'],['mm-1988-8888-uprising','1988-08-08'],['mm-1988-slorc-takeover','1988-09-18'],['mm-2015-general-election-2015','2015-11-08'],['mm-2016-new-legislatures-2016','2016-02-01'],['mm-2016-htin-kyaw-inauguration','2016-03-30']])assert.equal(byId.get(id).date,date);
 for(const id of ['mm-1825-mrauku-first-war','mm-1825-danubyu-bandula-death','mm-1945-meiktila-campaign','mm-1985-demonetization-1985','mm-1987-demonetization-1987','mm-2016-bagan-earthquake-2016'])assert.equal(byId.get(id).precision,'month');
 assert.equal(byId.get('mm-1969-shwe-thway-publication').date,null);assert.match(byId.get('mm-1969-shwe-thway-publication').locationNote,/一月四日或四月四日/);
 assert.equal(byId.get('mm-1885-mandalay-third-war').date,'1885-11-28');assert.equal(byId.get('mm-1886-upper-burma-annexation').date,'1886-01-01');assert.equal(byId.get('mm-2016-first-stock-trading').date,'2016-03-25');
 assert.match(byId.get('mm-1961-u-thant-acting-secretary').locationNote,/纽约/);assert.match(byId.get('mm-1997-asean-accession').locationNote,/马来西亚/);
});

test('Myanmar restored Hanthawaddy is distinct from the earlier kingdom and stops at its documented fall',()=>{
 const p=MYANMAR_PERIODS.find(p=>p.id==='mm-restored-hanthawaddy');assert.equal(p.start,1740);assert.equal(p.endBefore,'1757-05-12');
 for(const id of ['mm-1740-pegu-uprising','mm-1744-pegu-leader-displacement','mm-1746-binnya-dala-power-transfer','mm-1752-restored-hanthawaddy-ava-capture'])assert.equal(byId.get(id).periodId,p.id);
 const fall=byId.get('mm-1757-restored-hanthawaddy-fall');assert.equal(fall.date,'1757-05-12');assert.equal(fall.periodId,'mm-konbaung');assert.equal(eventMatchesPeriod(fall,p.id,'MM'),false);
 assert.equal(periodForEvent({year:1757,date:'1757-05-11',periodId:p.id},'MM')?.id,p.id);assert.equal(periodForEvent({year:1757,date:'1757-05-12',periodId:p.id},'MM'),null);
 assert.equal(eventMatchesPeriod(byId.get('mm-1539-hanthawaddy-toungoo-conquest'),p.id,'MM'),false);assert.equal(eventMatchesPeriod(byId.get('mm-1740-pegu-uprising'),'mm-hanthawaddy','MM'),false);
});
test('Myanmar ancient building dates preserve inscription evidence, broad reign windows and excavation chronology',()=>{
 for(const [id,year]of [['mm-1183-sulamani-water-construction',1183],['mm-1211-thetso-lake-inscription',1211],['mm-2003-bagan-palace-drains-excavation',2003]])assert.equal(byId.get(id).year,year);
 for(const [id,end]of [['mm-1084-ananda-kyansittha-building',1113],['mm-1084-mya-kan-reservoir',1097],['mm-1746-binnya-dala-power-transfer',1747]]){const e=byId.get(id);assert.equal(e.endYear,end);assert.equal(e.approximate,true);assert.equal(e.date,null);}
 assert.equal(byId.get('mm-2017-nat-yekan-fieldwork').endYear,2018);assert.equal(byId.get('mm-1849-kyauktawgyi-construction').date,'1849-04-26');assert.equal(byId.get('mm-1850-kyauktawgyi-finial').date,'1850-10-29');
 assert.equal(places.get('mm-kyaukse').lat,21.6056);assert.equal(places.get('mm-kyaukse').regionCode,'MM-GEO-08');assert.equal(places.get('mm-mingun').regionCode,'MM-GEO-10');assert.equal(byId.get('mm-1866-myingun-palace-rebellion').placeId,'mm-mandalay');
});
test('Myanmar royal orders distinguish prescribed measures from construction completion or network openings',()=>{
 assert.equal(byId.get('mm-1753-shwebo-capital-construction').date,'1753-06-21');assert.equal(byId.get('mm-1785-mahamuni-arrival').date,'1785-04-27');assert.equal(byId.get('mm-1857-mandalay-capital-order').date,'1857-01-13');
 assert.equal(byId.get('mm-1810-meiktila-lake-embankment').placeId,'mm-meiktila');assert.match(byId.get('mm-1871-royal-telegraph-timber').locationNote,/不是.*首次开通/);assert.match(byId.get('mm-1607-court-household-registers').locationNote,/并非.*全国/);assert.equal(byId.get('mm-1854-mindon-coin-standard').approximate,true);
});

test('Myanmar local additions include all fifteen administrative reference regions without confusing homonyms',()=>{
 const regional=new Set(records.map(e=>places.get(e.placeId).regionCode));assert.equal(regional.size,15);
 for(const [id,lat,region]of [['mm-mawlamyine',16.49051,'13'],['mm-loikaw',19.67798,'06'],['mm-hakha',22.64452,'02'],['mm-kanpetlet',21.20341,'02'],['mm-dawei',14.0823,'12'],['mm-hpa-an',16.88953,'05']]){assert.equal(places.get(id).lat,lat);assert.equal(places.get(id).regionCode,'MM-GEO-'+region);}
 const flood=byId.get('mm-2015-chin-flood-landslides');assert.equal(flood.placeId,'mm-hakha');assert.equal(eventMatches(flood,{countryCode:'MM',period:'all',region:'MM-GEO-02',scope:'year',year:2015},places),true);assert.equal(eventMatches(flood,{countryCode:'MM',period:'all',region:'MM-GEO-05',scope:'year',year:2015},places),false);
});
test('Myanmar infrastructure records distinguish project agreements, first phases and partial delivery',()=>{
 assert.equal(byId.get('mm-1960-baluchaung-first-phase').date,'1960-03');assert.match(byId.get('mm-1960-baluchaung-first-phase').locationNote,/84兆瓦.*不能.*168兆瓦/);
 assert.equal(byId.get('mm-1974-baluchaung-second-phase').date,'1974-02');assert.equal(byId.get('mm-1994-baluchaung-renovation-complete').date,'1994-09');
 assert.equal(byId.get('mm-2015-baluchaung-rehabilitation-handover').date,'2015-02-09');assert.match(byId.get('mm-2015-baluchaung-rehabilitation-handover').locationNote,/仅两台/);assert.match(byId.get('mm-2018-dawei-hospital-grant').locationNote,/并非.*竣工/);
 assert.equal(byId.get('mm-1982-mawlamyine-technical-institute').date,'1982-12-15');assert.equal(byId.get('mm-2007-mawlamyine-technological-university').date,'2007-01-20');
});
test('Myanmar public health and heritage retain bounded claims and source date differences',()=>{
 assert.equal(byId.get('mm-2003-leprosy-elimination-threshold').date,'2003-01');assert.match(byId.get('mm-2003-leprosy-elimination-threshold').locationNote,/不等于.*根除/);
 assert.equal(byId.get('mm-2012-managed-exchange-float').date,'2012-04');assert.match(byId.get('mm-2012-managed-exchange-float').locationNote,/四月一日.*四月二日/);
 assert.equal(byId.get('mm-1994-natma-taung-national-park').year,1994);assert.equal(byId.get('mm-2014-natma-taung-tentative-list').date,'2014-02-25');assert.match(byId.get('mm-2014-natma-taung-tentative-list').summary,/不等于.*正式世界遗产/);
 assert.equal(byId.get('mm-1935-government-burma-act').date,'1935-08-02');assert.match(byId.get('mm-1935-government-burma-act').locationNote,/1937年/);
});

test('Myanmar war records separate airfield and city capture, and keep disputed archaeological dates imprecise',()=>{
 assert.equal(byId.get('mm-1944-myitkyina-airfield').date,'1944-05-17');assert.equal(byId.get('mm-1944-myitkyina-town-capture').date,'1944-08-03');
 assert.match(byId.get('mm-1944-myitkyina-airfield').summary,/城区仍由日军控制/);assert.equal(byId.get('mm-1942-yangon-fall-1942').precision,'month');
 const e=byId.get('mm-2009-beikthano-new-mounds');assert.equal(e.date,null);assert.equal(e.precision,'year');assert.match(e.locationNote,/年份矛盾/);
 assert.equal(places.get('mm-mogaung').regionCode,'MM-GEO-04');assert.equal(places.get('mm-maungdaw').regionCode,'MM-GEO-01');
});
test('Myanmar institutions distinguish legislation, implementation and successor organizations',()=>{
 assert.equal(byId.get('mm-1874-municipal-act-first').date,'1874-03-24');assert.equal(byId.get('mm-1885-municipal-act-effect').date,'1885-01-01');
 assert.equal(byId.get('mm-1948-irrawaddy-flotilla-nationalized').periodId,'mm-union');assert.equal(byId.get('mm-1948-irrawaddy-flotilla-nationalized').date,'1948-06-01');
 assert.equal(byId.get('mm-1946-burma-broadcasting-service').date,'1946-02-15');assert.equal(byId.get('mm-1980-regular-colour-television').date,'1980-11-01');
 assert.match(byId.get('mm-2010-fec-counters-close').summary,/不能等同.*全面退出/);
});
test('Myanmar international justice distinguishes allegations, interim protection and procedural judgments',()=>{
 assert.equal(byId.get('mm-2019-gambia-icj-application').date,'2019-11-11');assert.equal(byId.get('mm-2020-icj-provisional-measures').date,'2020-01-23');
 assert.match(byId.get('mm-2020-icj-provisional-measures').summary,/不等于.*最终判决/);assert.equal(byId.get('mm-2022-icj-preliminary-objections').periodId,'mm-contemporary');
 assert.match(byId.get('mm-2022-icj-preliminary-objections').summary,/不等于.*实体责任/);assert.match(byId.get('mm-2013-meiktila-community-violence').locationNote,/不一概.*罗兴亚/);
});

test('Myanmar inscriptions and museum material keep retrospective and acquisition dates separate',()=>{
 for(const id of ['mm-1168-cansu-royal-donation','mm-1455-shin-sawbu-land-inscription','mm-1612-ratanapon-building'])assert.equal(byId.get(id).precision,'year');
 assert.match(byId.get('mm-1372-shwedagon-binnya-u-repair').locationNote,/十五世纪碑铭追记/);
 assert.match(byId.get('mm-1612-ratanapon-building').locationNote,/1985.*入藏/);assert.equal(byId.get('mm-1535-shitthaung-building').approximate,true);
 assert.equal(places.get('mm-kyaikmaraw').regionCode,'MM-GEO-13');
});
test('Myanmar elections and border evacuation distinguish limited change from completed transfer',()=>{
 assert.equal(byId.get('mm-1954-joint-military-commission-end').date,'1954-09-01');assert.match(byId.get('mm-1954-joint-military-commission-end').summary,/没有完全消失/);
 assert.equal(byId.get('mm-2010-general-election-2010').date,'2010-11-07');assert.equal(byId.get('mm-2011-parliament-first-session-2011').periodId,'mm-military');
 assert.equal(byId.get('mm-2012-parliament-by-election-2012').date,'2012-04-01');assert.match(byId.get('mm-2012-parliament-by-election-2012').locationNote,/45席.*48席/);
 assert.equal(byId.get('mm-2011-shan-earthquake-2011').periodId,'mm-military');
});
test('Myanmar health and flood records preserve local geography and exposure limitations',()=>{
 assert.equal(byId.get('mm-2020-covid-first-confirmed').date,'2020-03-23');assert.match(byId.get('mm-2020-covid-first-confirmed').summary,/两例/);
 assert.equal(byId.get('mm-2021-tonzang-delta-wave').placeId,'mm-tonzang');assert.equal(places.get('mm-tonzang').regionCode,'MM-GEO-02');
 assert.equal(byId.get('mm-2023-cyclone-mocha-landfall').date,'2023-05-14');assert.match(byId.get('mm-2024-yagi-remnants-flood').locationNote,/并未.*登陆/);
 assert.equal(places.get('mm-nyaungdon').regionCode,'MM-GEO-03');assert.match(byId.get('mm-2024-nyaungdon-flood-2024').locationNote,/暴露并非.*损失/);
});

test('Myanmar capital chronology includes Ketumati without merging parallel kingdoms',()=>{
 assert.equal(MYANMAR_PERIODS.find(p=>p.id==='mm-toungoo').start,1510);
 assert.equal(byId.get('mm-1510-ketumati-city-founding').periodId,'mm-toungoo');
 assert.equal(byId.get('mm-1364-mao-twin-capitals-fall').periodId,'mm-ava');
 assert.equal(byId.get('mm-1594-mawlamyine-governor-revolt').periodId,'mm-toungoo');
 assert.equal(eventMatchesPeriod(byId.get('mm-1599-nandabayin-bago-fall'),'mm-hanthawaddy','MM'),false);
 assert.equal(places.get('mm-tagaung').regionCode,'MM-GEO-08');assert.equal(places.get('mm-tagaung').lat,23.50372);
});
test('Myanmar census and legal dates distinguish reference instants, plans and enactments',()=>{
 assert.equal(byId.get('mm-1953-postwar-census-stages').endYear,1954);assert.match(byId.get('mm-1953-postwar-census-stages').locationNote,/1955.*取消/);
 assert.equal(byId.get('mm-1973-national-census-1973').date,'1973-04-01');assert.match(byId.get('mm-1973-national-census-1973').locationNote,/三月三十一日.*参考/);
 assert.equal(byId.get('mm-2019-child-rights-law').date,'2019-07-23');assert.match(byId.get('mm-2019-child-rights-law').locationNote,/次日.*二十四日/);
 assert.equal(byId.get('mm-1993-crc-reservations-withdrawn').date,'1993-10-19');
});
test('Myanmar local publication and railway records preserve independent dates and sites',()=>{
 assert.equal(byId.get('mm-1946-ludu-daily-establishment').date,'1946-04-19');
 assert.equal(byId.get('mm-1943-ba-maw-state-declaration').date,'1943-08-01');assert.match(byId.get('mm-1943-ba-maw-state-declaration').locationNote,/八月十一日.*报道/);
 assert.equal(byId.get('mm-1943-burma-thai-railway-complete').precision,'month');assert.match(byId.get('mm-1943-burma-thai-railway-complete').locationNote,/泰国Konkoita/);
 assert.equal(places.get('mm-thanbyuzayat').regionCode,'MM-GEO-13');assert.equal(places.get('mm-yenangyaung').regionCode,'MM-GEO-15');
});

test('Myanmar modern records separate observation dates, enactments and financing from results',()=>{
 assert.equal(byId.get('mm-2020-general-election-2020').date,'2020-11-08');
 assert.match(byId.get('mm-2020-general-election-2020').locationNote,/十一月十日.*声明/);
 assert.equal(byId.get('mm-2016-investment-law-2016').date,'2016-10-18');
 assert.match(byId.get('mm-2015-national-electrification-credit').locationNote,/批准.*不能/);
 assert.match(byId.get('mm-2024-icc-warrant-application').locationNote,/申请.*签发.*逮捕.*定罪/);
});
test('Myanmar locality and archaeology records do not merge homonyms or date art from charcoal',()=>{
 assert.equal(places.get('mm-paletwa').regionCode,'MM-GEO-02');assert.equal(places.get('mm-paletwa').lat,21.30447);
 assert.equal(places.get('mm-thanlyin').regionCode,'MM-GEO-17');
 assert.equal(byId.get('mm-1969-badah-lin-excavation').endYear,1972);
 assert.match(byId.get('mm-1969-badah-lin-excavation').locationNote,/不将炭样.*岩画年代/);
 assert.equal(byId.get('mm-1996-badah-lin-tentative-list').date,'1996-10-04');
 assert.match(byId.get('mm-1996-badah-lin-tentative-list').locationNote,/不能写成正式/);
});
test('Myanmar civil resistance, chronological disputes and conscription remain independently dated',()=>{
 assert.equal(byId.get('mm-2021-civil-disobedience-launch').date,'2021-02-02');
 assert.equal(byId.get('mm-2021-naypyitaw-protester-shot').date,'2021-02-09');
 assert.match(byId.get('mm-2021-naypyitaw-protester-shot').locationNote,/死亡日期.*九日/);
 assert.equal(byId.get('mm-2024-conscription-law-activation').date,'2024-02-10');
 assert.match(byId.get('mm-1527-ava-tho-han-bwa-rule').locationNote,/1526.*1527/);
 assert.equal(byId.get('mm-2024-paletwa-territorial-change').precision,'month');
});

test('Myanmar election records keep phased voting separate from constitutions and transfers',()=>{
 assert.equal(byId.get('mm-1947-constituent-assembly-vote').date,'1947-04-09');
 assert.equal(byId.get('mm-1951-first-parliamentary-election').date,'1951-06');
 assert.equal(byId.get('mm-1951-first-parliamentary-election').endYear,1952);
 assert.equal(byId.get('mm-1960-parliamentary-election-1960').date,'1960-02-06');
 assert.match(byId.get('mm-2008-constitution-referendum-2008').locationNote,/五月二十四日.*不把.*政府自述.*独立认证/);
});
test('Myanmar regional ceasefires and army origins preserve distinct geographical scopes',()=>{
 assert.equal(places.get('mm-pangkham').regionCode,'MM-GEO-11');
 assert.equal(places.get('mm-laukkai').lat,23.69611);
 assert.equal(places.get('mm-laiza').regionCode,'MM-GEO-04');
 assert.equal(byId.get('mm-2009-arakan-army-formation').placeId,'mm-laiza');
 assert.match(byId.get('mm-2013-kachin-seven-point-agreement').locationNote,/不将.*永久停火/);
 assert.equal(byId.get('mm-2011-kachin-war-resumption').date,'2011-06');
 assert.equal(byId.get('mm-1941-independence-army-formation').precision,'month');
});
test('Myanmar legal and infrastructure milestones keep separate dates and implementation limits',()=>{
 assert.equal(byId.get('mm-1961-buddhism-state-religion').date,'1961-08-26');
 assert.equal(byId.get('mm-1961-religious-minorities-amendment').date,'1961-09-25');
 assert.equal(byId.get('mm-2013-gas-pipeline-operation').date,'2013-07-28');
 assert.equal(byId.get('mm-2017-oil-pipeline-operation').date,'2017-04-10');
 assert.equal(places.get('mm-kyaukpyu').lon,93.55134);
 assert.equal(byId.get('mm-2015-thilawa-sez-opening').placeId,'mm-thanlyin');
 assert.match(byId.get('mm-2011-myitsone-dam-suspension').locationNote,/暂停与永久取消不同/);
});

test('Myanmar early Mon kingdom routing includes its Martaban foundation without cross-period duplication',()=>{
 const e=byId.get('mm-1287-wareru-mottama-kingdom');
 assert.equal(MYANMAR_PERIODS.find(p=>p.id==='mm-hanthawaddy').start,1287);
 assert.equal(e.placeId,'mm-mottama');
 assert.deepEqual(MYANMAR_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'MM')).map(p=>p.id),['mm-hanthawaddy']);
 assert.equal(eventMatchesPeriod(e,'mm-bagan','MM'),false);
});
test('Myanmar capital and cultural records preserve evidence, intervals and tentative status',()=>{
 const e=byId.get('mm-1634-thalun-return-to-inwa');
 assert.equal(e.endYear,1635);assert.match(e.summary,/此前仍是正式王都/);
 assert.equal(byId.get('mm-2005-naypyitaw-administrative-relocation').date,'2005-11-07');
 assert.match(byId.get('mm-1059-manuha-temple-traditional-date').locationNote,/传统定年/);
 assert.match(byId.get('mm-1996-upper-cities-tentative-list').summary,/尚非正式世界遗产入选/);
 assert.equal(byId.get('mm-1313-pinya-royal-city').placeId,'mm-inwa');
 assert.match(byId.get('mm-1313-pinya-royal-city').locationNote,/并非同一地点/);
});
test('Myanmar colonial institutions distinguish beginnings, implementation and elected transfers',()=>{
 assert.equal(byId.get('mm-1886-military-police-levies').precision,'month');
 assert.equal(byId.get('mm-1898-fingerprint-bureau').category,'科技');
 assert.match(byId.get('mm-1925-military-police-reorganization').locationNote,/1924年建议与1925年实施/);
 assert.equal(byId.get('mm-1922-legislative-election-1922').date,'1922-11');
 assert.equal(byId.get('mm-1946-aung-san-executive-council').date,'1946-09-26');
 assert.equal(byId.get('mm-1960-u-nu-civilian-return').date,'1960-04-04');
});

test('Myanmar local histories preserve calendar uncertainty and geographical scope',()=>{
 const e=byId.get('mm-1869-tachileik-settlement-letter');
 assert.equal(e.approximate,true);assert.equal(e.endYear,1870);assert.equal(e.date,null);
 assert.equal(byId.get('mm-1557-bayinnaung-mogaung-conquest').date,null);
 assert.match(byId.get('mm-1875-western-karenni-agreement').summary,/西部地区/);
 assert.match(byId.get('mm-1875-western-karenni-agreement').locationNote,/非签约地点/);
 assert.equal(byId.get('mm-1890-stedman-durbar-1890').placeId,'mm-yawnghwe');
 assert.equal(places.get('mm-yawnghwe').regionCode,'MM-GEO-11');
 assert.equal(places.get('mm-kengtung').lat,21.29149);
});
test('Myanmar palace restoration is distinct from original residence and dated ceremonies',()=>{
 assert.equal(byId.get('mm-1858-mandalay-royal-residence').date,'1858-07-16');
 assert.match(byId.get('mm-1989-mandalay-palace-rebuilding').locationNote,/非|不将复建/);
 assert.equal(byId.get('mm-1996-mandalay-palace-reopening').date,'1996-09-18');
 assert.equal(byId.get('mm-1839-upper-burma-earthquake-1839').date,'1839-03-23');
 assert.match(byId.get('mm-1913-candamuni-commentary-stones').summary,/三藏正文.*不同/);
});
