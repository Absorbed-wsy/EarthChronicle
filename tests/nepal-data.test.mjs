import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {NEPAL_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod,yearTickLabel} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),records=data.events.filter(e=>e.periodId?.startsWith('np-')),byId=new Map(records.map(e=>[e.id,e]));
test('Nepal has sourced records across eight periods and seven modern provinces',()=>{
 assert.equal(records.length,225);assert.equal(periodsForCountry('NP'),NEPAL_PERIODS);assert.ok(Object.isFrozen(NEPAL_PERIODS));
 assert.equal(NEPAL_PERIODS.filter(p=>!p.navigationOnly).length,8);assert.deepEqual(periodBounds('all',2026,'NP'),[-1493,2026]);
 assert.equal(data.meta.collections.filter(c=>c.countryCode==='NP').reduce((n,c)=>n+c.events,0),records.length);
 const ids=new Set(),titles=new Set(),references=new Set(),regions=new Set(),sources=new Set(),categories=new Set();
 for(const p of NEPAL_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');if(!p.navigationOnly)assert.ok(records.some(e=>e.periodId===p.id),p.id);}
 for(const e of records){
  assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);references.add(e.placeId);sources.add(e.sourceUrl);categories.add(e.category);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=60&&e.locationNote,e.id);assert.equal(periodForEvent(e,'NP')?.id,e.periodId,e.id);
  assert.equal(NEPAL_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'NP')).length,1,e.id);
  for(const country of ['CN','JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','LK'])assert.equal(periodForEvent(e,country),null,e.id+':'+country);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'NP',e.id);assert.match(p.regionCode,/^NP-GEO-[1-7]$/);assert.ok(p.lon>=80&&p.lon<=89&&p.lat>=26&&p.lat<=31,e.id);regions.add(p.regionCode);
  assert.ok(e.sources.some(s=>s.title===e.sourceTitle&&s.url===e.sourceUrl));for(const s of e.sources)assert.equal(new URL(s.url).protocol,'https:');
  assert.equal(e.title.endsWith('（约）'),e.approximate===true,e.id);
  if(e.date){assert.equal(e.precision,'day');assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(new Date(e.date+'T00:00:00Z').toISOString().slice(0,10),e.date);assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.equal(references.size,56);assert.equal(regions.size,7);assert.ok(sources.size>=50);
 for(const c of ['政治','战争','经济','社会','科技','文化','营建','制度','外交','灾害'])assert.ok(categories.has(c),c);
});
test('Nepal civil-date transitions are inclusive at the start and exclusive at the end',()=>{
 for(const [date,id]of [['1846-09-13','np-shah'],['1846-09-14','np-rana'],['1951-02-17','np-rana'],['1951-02-18','np-monarchy'],['2008-05-27','np-monarchy'],['2008-05-28','np-republic']]){
  const e={year:Number(date.slice(0,4)),date,periodId:id};assert.equal(periodForEvent(e,'NP')?.id,id,date);
  assert.equal(NEPAL_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'NP')).length,1,date);
 }
 for(const year of [1846,1951,2008])assert.equal(periodForEvent({year},'NP'),null);
 assert.equal(byId.get('np-2008-constituent-assembly-election').periodId,'np-monarchy');
 assert.equal(byId.get('np-2008-federal-democratic-republic').periodId,'np-republic');
 assert.equal(byId.get('np-1951-interim-government-act').date,null);
});
test('Nepal keeps BCE, local eras and uncertain civil days separate',()=>{
 assert.equal(byId.get('np-bce1400-suila-burial-phase').year,-1399);assert.equal(yearTickLabel(-1399),'前1400');
 assert.match(byId.get('np-bce1400-suila-burial-phase').summary,/1494.*1317/);
 assert.equal(byId.get('np-464-manadeva-changu-inscription').year,464);assert.match(byId.get('np-464-manadeva-changu-inscription').summary,/386.*78/);
 assert.equal(byId.get('np-610-sundhara-building-endowment').date,null);
 assert.equal(byId.get('np-1673-patan-public-festival-regulations').year,1673);
 assert.equal(byId.get('np-1838-ramechhap-irrigation-repair').year,1838);
 assert.equal(byId.get('np-1926-salyan-emancipation-compensation').year,1926);
 for(const key of ['np-1015-prajnaparamita-illuminated-manuscript','np-1027-svayambhuva-pancaratra-manuscript','np-1036-shivadharma-sponsored-codex','np-1920-sati-abolition','np-1948-government-act-1948','np-1951-interim-government-act','np-1960-janakpur-airport-opening','np-1962-constitution-1962-panchayat'])assert.equal(byId.get(key).date,null,key);
 assert.equal(byId.get('np-1960-janakpur-airport-opening').sources.length,2);
 assert.match(byId.get('np-1960-janakpur-airport-opening').summary,/相差一周/);
});
test('Nepal records distinguish signing, implementation and later facilities',()=>{
 assert.equal(byId.get('np-1815-sugauli-treaty-signing').date,'1815-12-02');
 assert.equal(byId.get('np-1816-sugauli-ratification-exchange').date,'1816-03-04');
 assert.equal(byId.get('np-1860-western-terai-restoration-treaty').date,'1860-11-01');assert.match(byId.get('np-1860-western-terai-restoration-treaty').summary,/11月15日/);
 assert.equal(byId.get('np-1924-emancipation-fund-letter').date,'1924-07-20');assert.equal(byId.get('np-1925-slavery-emancipation-implementation').date,null);
 assert.equal(byId.get('np-1958-pokhara-airport-opening').date,'1958-07-04');assert.match(byId.get('np-1958-pokhara-airport-opening').summary,/旧机场/);
 assert.equal(byId.get('np-2019-nepalisat-one-orbit-deployment').date,'2019-06-17');assert.match(byId.get('np-2019-nepalisat-one-orbit-deployment').summary,/空间站/);
 assert.equal(byId.get('np-2022-jaynagar-kurtha-rail-opening').date,'2022-04-02');assert.equal(records.filter(e=>e.id.includes('rail-opening')).length,1);
});
test('Nepal modern reference points do not substitute other same-named towns or actual venues',()=>{
 for(const [id,lat,lon,region]of [['np-patan',27.67658,85.31417,3],['np-barpak',28.20301,84.74755,4],['np-sundarijal',27.75947,85.42085,3],['np-hanumannagar',26.50611,86.85914,2],['np-gamgadhi',29.54759,82.15774,6],['np-libang',28.30213,82.63703,5],['np-silgadhi',29.2668,80.9841,7]]){
  const p=places.get(id);assert.equal(p.lat,lat,id);assert.equal(p.lon,lon,id);assert.equal(p.regionCode,'NP-GEO-'+region,id);assert.ok(p.sources?.some(s=>s.url.startsWith('https://www.geonames.org/')),id);
 }
 assert.match(byId.get('np-1953-everest-first-recorded-summit').locationNote,/中尼边界/);
 assert.match(byId.get('np-1955-un-membership').locationNote,/纽约/);
 assert.match(byId.get('np-2022-jaynagar-kurtha-rail-opening').locationNote,/新德里/);
 assert.match(byId.get('np-2019-nepalisat-one-orbit-deployment').locationNote,/空间站/);
});
test('Nepal geography, category and year filtering preserve durations without showing other years',()=>{
 for(const e of records){
  const p=places.get(e.placeId),filter={countryCode:'NP',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,filter,places),true,e.id);
  assert.equal(eventMatches(e,{...filter,year:e.year-1},places),false,e.id);
  assert.equal(eventMatches(e,{...filter,countryCode:'IN'},places),false,e.id);
  if(e.endYear)assert.equal(eventMatches(e,{...filter,year:e.endYear},places),true,e.id);else assert.equal(eventMatches(e,{...filter,year:e.year+1},places),false,e.id);
 }
});


test('Nepal epigraphy uses individually checked local eras without fabricated civil days',()=>{
 for(const [id,year,inscription]of [
  ['np-640-yengahiti-labour-property-charter',640,'in02067'],
  ['np-641-sonaguthi-corvee-exemption',641,'in02068'],
  ['np-643-yengahiti-restored-temple-estates',643,'in02072'],
  ['np-695-lagantol-estate-tibet-porters',695,'in02083'],
  ['np-724-minanatha-seven-part-water-allocation',724,'in02086'],
  ['np-733-pashupati-silver-lotus-dedication',733,'in02087']]){
  const e=byId.get(id);assert.equal(e.year,year,id);assert.equal(e.date,null,id);assert.equal(e.precision,'year');
  assert.ok(e.sources.some(s=>s.url.includes(inscription)&&s.url.includes('section=metadata')),id);
 }
 assert.match(byId.get('np-724-minanatha-seven-part-water-allocation').summary,/七份/);
 assert.equal(byId.get('np-1847-sankhu-resthouse-well-trust').year,1847);
 assert.equal(byId.get('np-1847-sankhu-resthouse-well-trust').date,null);
 assert.equal(byId.get('np-1357-dullu-prithvimalla-genealogy-pillar').year,1357);
 assert.equal(records.filter(e=>e.id.includes('dullu-prithvimalla')).length,1);
});
test('Nepal building phases and power commissioning keep uncertain dates and later capacity separate',()=>{
 const sundari=byId.get('np-1627-sundari-cok-early-courtyard');assert.equal(sundari.approximate,true);assert.equal(sundari.year,1627);assert.match(sundari.summary,/1628/);
 assert.equal(byId.get('np-1565-char-narayana-consecration').year,1565);
 assert.equal(byId.get('np-1671-north-taleju-consecration').year,1671);
 assert.match(byId.get('np-1984-devighat-hydropower-commissioning').summary,/14\.1/);
 assert.equal(byId.get('np-1995-trishuli-capacity-renovation').year,1995);
 assert.equal(byId.get('np-1985-electricity-authority-merger').date,'1985-08-16');
 const mm=byId.get('np-2008-middle-marsyangdi-inauguration');assert.equal(mm.date,'2008-12-14');assert.equal(mm.periodId,'np-republic');assert.match(mm.summary,/商业运行/);
 const patan=records.filter(e=>/krishna.*temple|krishna-mandir/.test(e.id));assert.equal(patan.length,2);
 assert.equal(new Set(patan.map(e=>e.year)).size,2);
});
test('Nepal new reference points avoid same-name villages and preserve modern province membership',()=>{
 for(const [id,lat,lon,region]of [
 ['np-sankhu',27.72993,85.464,3],['np-dullu',28.86415,81.60619,6],
 ['np-sunakothi',27.63442,85.32258,3],['np-bungmati',27.62945,85.30342,3],
 ['np-trishuli',27.92255,85.14899,3],['np-bhimphedi',27.5405,85.13546,3],
 ['np-abukhaireni',27.90465,84.53566,4],['np-galyang',27.94413,83.67198,4],
 ['np-besishahar',28.22778,84.38078,4],['np-ilam',26.90943,87.92824,1],
 ['np-ramgram',27.53333,83.66667,5]]){
 const p=places.get(id);assert.equal(p.lat,lat,id);assert.equal(p.lon,lon,id);assert.equal(p.regionCode,'NP-GEO-'+region,id);
 assert.ok(records.some(e=>e.placeId===id),id);assert.ok(p.sources.some(s=>s.url.startsWith('https://www.geonames.org/')),id);
 }
 assert.match(byId.get('np-659-vajresvara-endowment-trust').locationNote,/发现地点/);
 assert.match(byId.get('np-1979-gandak-irrigation-power-construction').locationNote,/普拉塔普尔/);
});

test('Nepal early charters preserve dated local actions rather than retrospective founding dates',()=>{
 for(const [id,year,inscription]of [
 ['np-466-lazimpat-naravarman-temple',466,'in02007'],
 ['np-477-deopatan-ratnesvara-land-donation',477,'in02009'],
 ['np-480-deopatan-prabhukesvara-written-grant',480,'in02013'],
 ['np-527-kisipidi-office-jurisdiction-restriction',527,'in02017'],
 ['np-597-satungal-wood-gathering-protection',597,'in02034'],
 ['np-598-khopasi-headman-jurisdiction',598,'in02037'],
 ['np-606-harigaon-palace-distribution-schedule',606,'in02041'],
 ['np-608-sanga-material-oil-contribution-exemption',608,'in02043'],
 ['np-624-patan-canal-repair-endowment',624,'in02056'],
 ['np-631-balambu-water-conduit-cloth-tax-exemption',631,'in02061']]){
  const e=byId.get(id);assert.equal(e.year,year,id);assert.equal(e.date,null);assert.equal(e.precision,'year');
  assert.equal(e.periodId,'np-licchavi');assert.ok(e.sources.some(s=>s.url.includes(inscription+'/?section=metadata')),id);
 }
 assert.match(byId.get('np-624-patan-canal-repair-endowment').summary,/修复.*早先.*运河/);
 assert.match(byId.get('np-633-thankot-pond-land-grant-restoration').summary,/恢复.*旧赠地.*早于本年/);
 assert.match(byId.get('np-598-khopasi-headman-jurisdiction').summary,/五十.*贡献要求/);
 assert.match(byId.get('np-608-sanga-material-oil-contribution-exemption').summary,/十二罐.*不能.*全部税役/);
});
test('Nepal parallel charters merge copies and preserve unresolved era readings',()=>{
 const ganadeva=records.filter(e=>e.sourceUrl.includes('in02022/'));
 assert.equal(ganadeva.length,1);for(const id of ['in02022','in02023','in02024','in02025'])assert.ok(ganadeva[0].sources.some(s=>s.url.includes(id)),id);
 assert.equal(records.filter(e=>e.sourceUrl.includes('in02032/')).length,0);
 for(const [id,year,pattern]of [
 ['np-594-patan-garlic-onion-tax-exemption',594,/594.*595/],
 ['np-595-budhanilkantha-three-tax-charter',595,/517.*518/],
 ['np-605-bungmati-office-exclusion-charter',605,/34.*29/],
 ['np-633-maligaon-remarriage-property-jurisdiction',633,/57.*59.*633.*635/],
 ['np-705-balambu-temple-estate-surplus-charter',705,/129.*705.*109/],
 ['np-847-changu-pratibala-image-endowment',847,/271.*272.*172/]]){
  const e=byId.get(id);assert.equal(e.year,year);assert.equal(e.date,null);assert.equal(e.approximate,true);assert.match(e.summary,pattern);
 }
 assert.equal(byId.get('np-847-changu-pratibala-image-endowment').periodId,'np-medieval');
 assert.equal(byId.get('np-505-changu-nirapeksa-parental-effigies').periodId,'np-licchavi');
 assert.equal(byId.get('np-464-manadeva-changu-inscription').year,464);
 assert.match(byId.get('np-633-maligaon-remarriage-property-jurisdiction').summary,/无子.*有子.*限制/);
 assert.match(byId.get('np-705-balambu-temple-estate-surplus-charter').summary,/剩余收入由村民分配/);
});
test('Nepal dated manuscripts distinguish separate copies, mixed bundles and manuscript production',()=>{
 for(const [id,year,archive]of [
 ['np-828-paramesvaratantra-palm-leaf-copy',828,/Add\.1049/],
 ['np-1008-prajnaparamita-add866-colophon',1008,/Add\.866/],
 ['np-1037-kulalikamnaya-palm-leaf-copy',1037,/5-877/],
 ['np-1039-lotus-sutra-add1683-copy',1039,/Add\.1683/],
 ['np-1049-vaisnavadharmasastra-danadharma-copy',1049,/A27\/2/],
 ['np-1065-lotus-sutra-add1684-copy',1065,/Add\.1684/],
 ['np-1068-bhadracari-pranidhana-palm-leaf-copy',1068,/Add\.1680/],
 ['np-1084-candragomin-sisyalekha-copy',1084,/Add\.1161/],
 ['np-1165-dharmacakra-prajnaparamita-copy',1165,/Add\.1693/],
 ['np-1199-anandadatta-candra-grammar-copy',1199,/Add\.1657/]]){
  const e=byId.get(id);assert.equal(e.year,year,id);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.periodId,'np-medieval');
  assert.match(e.summary,archive);assert.equal(e.placeId,'np-kathmandu');
 }
 const earliest=byId.get('np-828-paramesvaratantra-palm-leaf-copy');
 assert.match(earliest.sourceTitle,/Dominik Wujastyk/);assert.match(earliest.summary,/828.*857.*859/);
 assert.match(byId.get('np-1068-bhadracari-pranidhana-palm-leaf-copy').summary,/其他残叶.*不同年代/);
 assert.match(byId.get('np-1084-candragomin-sisyalekha-copy').summary,/不是月官的生卒/);
 assert.match(byId.get('np-1199-anandadatta-candra-grammar-copy').summary,/不将.*创作时间/);
 assert.equal(records.filter(e=>e.periodId==='np-medieval').length,15);
});
test('Nepal western-valley reference points retain specific modern coordinates and qualified ancient locations',()=>{
 for(const [id,lat,lon,geonames]of [
 ['np-thankot',27.688,85.202,'1282684'],['np-balambu',27.69156,85.24745,'7961866'],
 ['np-budhanilkantha',27.7768,85.36206,'1283569'],['np-satungal',27.68595,85.25295,'7962463'],
 ['np-sanga',27.645,85.48069,'7963522']]){
  const p=places.get(id);assert.equal(p.countryCode,'NP');assert.equal(p.regionCode,'NP-GEO-3');assert.equal(p.lat,lat);assert.equal(p.lon,lon);
  assert.ok(p.sources.some(s=>s.url==='https://www.geonames.org/'+geonames+'/'));assert.ok(records.some(e=>e.placeId===id));
 }
 assert.match(byId.get('np-527-kisipidi-office-jurisdiction-restriction').locationNote,/基西皮迪.*附近/);
 assert.match(byId.get('np-633-thankot-pond-land-grant-restoration').locationNote,/古滕乔村.*未确定/);
 assert.match(byId.get('np-597-satungal-wood-gathering-protection').locationNote,/古卡敦嘎村.*不等同/);
 assert.match(byId.get('np-608-sanga-material-oil-contribution-exemption').locationNote,/村中心点不等于碑址/);
});

const service04=records.filter(e=>e.id.startsWith('np-service04-')),service04ByKey=key=>byId.get('np-service04-'+key);
test('Nepal new service records retain precise founding, teaching and legal-status dates',()=>{
 assert.equal(service04.length,42);
 for(const[k,d]of [['bpkihs-foundation','1993-01-18'],['bpkihs-university-status','1998-10-28'],['pahs-first-mbbs','2010-05-30'],['kahs-foundation','2011-10-20'],['midwest-foundation','2010-06-17'],['kathmandu-university','1991-12-11'],['nhrc-formation','2000-05-26'],['second-constituent-election','2013-11-19'],['national-assembly-election','2018-02-07'],['first-federal-parliament-sitting','2018-03-05'],['house-election-2026','2026-03-05']])assert.equal(service04ByKey(k).date,d,k);
 assert.match(service04ByKey('pahs-first-mbbs').summary,/60.*2016/);
});
test('Nepal 2008 PAHS charter belongs before the republic and opening is a separate event',()=>{
 const e=service04ByKey('pahs-foundation');assert.equal(e.year,2008);assert.equal(e.date,null);assert.equal(e.periodId,'np-monarchy');assert.match(e.summary,/2064.*共和国决议前/);
 assert.equal(periodForEvent(e,'NP')?.id,'np-monarchy');assert.equal(service04ByKey('pahs-first-mbbs').periodId,'np-republic');
});
test('Nepal rubella schedule, control and elimination remain separate and do not imply measles elimination',()=>{
 for(const[k,y]of [['rubella-vaccine-introduction',2012],['mr-second-dose',2016]])assert.equal(service04ByKey(k).year,y);
 assert.equal(service04ByKey('rubella-control-verification').date,'2018-08-03');assert.equal(service04ByKey('rubella-elimination').date,'2025-08-18');
 assert.match(service04ByKey('rubella-control-verification').summary,/2019.*报道年份/);assert.match(service04ByKey('rubella-elimination').summary,/不等于同时消除麻疹/);
 assert.equal(service04ByKey('covid-first-confirmed-case').date,'2020-01-23');assert.equal(service04ByKey('covid-vaccine-launch').date,'2021-01-27');
 assert.match(service04ByKey('leprosy-elimination').summary,/不表示.*零新增病例/);
});
test('Nepal airport inaugurations and rail extensions are not backdated to earlier facilities',()=>{
 assert.equal(service04ByKey('gauchar-inauguration').date,'1955-06-15');assert.match(service04ByKey('gauchar-inauguration').summary,/1964/);
 assert.equal(service04ByKey('gbia-inauguration').date,'2022-05-16');assert.equal(service04ByKey('pokhara-international-inauguration').date,'2023-01-01');assert.match(service04ByKey('pokhara-international-inauguration').summary,/不能.*国际定期航线/);
 assert.equal(service04ByKey('kurtha-bijalpura-rail').date,'2023-07-16');assert.match(service04ByKey('kurtha-bijalpura-rail').summary,/17.3.*巴尔迪巴斯.*后续/);assert.equal(service04ByKey('tribhuvan-first-jet').year,1967);
});
test('Nepal power records distinguish cascade stages, later capacities and calendar labels',()=>{
 for(const[k,y]of [['kulekhani-one',1982],['kulekhani-three',2019],['hetauda-diesel-initial',1963],['sunkoshi-power',1972],['seti-power',1985],['upper-trishuli-three-a',2019],['upper-tamakoshi',2021]]){const e=service04ByKey(k);assert.equal(e.year,y);assert.equal(e.date,null);assert.equal(e.endYear,undefined);}
 assert.match(service04ByKey('kulekhani-three').summary,/2076.*误作公元2076/);assert.match(service04ByKey('hetauda-diesel-initial').summary,/不能.*倒推.*1963/);assert.match(service04ByKey('upper-tamakoshi').summary,/456.*2007/);
});
test('Nepal earthquake local dates and regional points remain distinct from epicentres and magnitude scales',()=>{
 const e=service04ByKey('eastern-nepal-earthquake');assert.equal(e.date,'1988-08-21');assert.match(e.summary,/8月20日23时09分.*次日/);assert.equal(e.placeId,'np-lahan');assert.match(e.locationNote,/不是震中/);
 const j=service04ByKey('jajarkot-earthquake');assert.equal(j.date,'2023-11-03');assert.match(j.summary,/6.4.*5.7.*不同震级/);assert.equal(j.sources.length,2);
 assert.equal(service04ByKey('bihar-nepal-earthquake').date,'1934-01-15');
});
test('Nepal added modern references select the right provinces and preserve old county coverage',()=>{
 const expected={'np-dharan':['NP-GEO-1',26.81436,87.27972],'np-dhulikhel':['NP-GEO-3',27.6221,85.54281],'np-birendranagar':['NP-GEO-6',28.59669,81.61658],'np-jumla':['NP-GEO-6',29.27472,82.18383],'np-lamosangu':['NP-GEO-3',27.75812,85.84885],'np-lahan':['NP-GEO-2',26.72022,86.48258],'np-jajarkot':['NP-GEO-6',28.69801,82.19554],'np-bijalpura':['NP-GEO-2',26.89935,85.85826]};
 for(const[id,[code,lat,lon]]of Object.entries(expected)){const p=places.get(id);assert.deepEqual([p.regionCode,p.lat,p.lon],[code,lat,lon]);assert.ok(service04.some(e=>e.placeId===id));}
 assert.deepEqual(data.meta.countyCoverage,{events:1724,places:560,placesWithMultipleEvents:256});
});
test('Nepal epigraphy titles contain a single approximate suffix after the format repair',()=>{
 for(const id of ['np-594-golmadhitol-three-tax-jurisdiction','np-594-patan-garlic-onion-tax-exemption']){const e=byId.get(id);assert.equal(e.year,594);assert.equal(e.approximate,true);assert.equal(e.date,null);assert.equal(e.title.endsWith('（约）'),true);assert.equal(e.title.endsWith('（约）（约）'),false);}
});
