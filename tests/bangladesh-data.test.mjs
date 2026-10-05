import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import{CATEGORIES,eventMatches}from'../public/domain.js';
import{BANGLADESH_PERIODS,periodsForCountry,periodForEvent,periodBounds,eventMatchesPeriod,yearTickLabel}from'../public/history-navigation.js';
const h=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8')),pm=new Map(h.places.map(p=>[p.id,p])),records=h.events.filter(e=>e.periodId?.startsWith('bd-')),em=new Map(records.map(e=>[e.id,e])),byKey=k=>records.find(e=>e.id.endsWith('-'+k));
test('Bangladesh has sourced records in seven periods and consistent modern geography',()=>{
 assert.equal(records.length,263);assert.equal(periodsForCountry('BD'),BANGLADESH_PERIODS);assert.ok(Object.isFrozen(BANGLADESH_PERIODS));assert.deepEqual(periodBounds('all',2026,'BD'),[-399,2026]);
 const specific=BANGLADESH_PERIODS.filter(p=>!p.navigationOnly);assert.equal(specific.length,7);for(const p of specific){assert.ok(Object.isFrozen(p));assert.ok(records.some(e=>e.periodId===p.id));assert.equal(new URL(p.sourceURL).protocol,'https:');}
 assert.equal(h.meta.collections.filter(c=>c.countryCode==='BD').reduce((n,c)=>n+c.events,0),263);
 const ids=new Set(),titles=new Set(),points=new Set(),regions=new Set(),cats=new Set(),sources=new Set();
 for(const e of records){assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);points.add(e.placeId);cats.add(e.category);sources.add(e.sourceUrl);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=60&&e.locationNote,e.id);assert.equal(periodForEvent(e,'BD')?.id,e.periodId);
  assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'BD')).length,1,e.id);
  for(const c of ['CN','JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,c),null,e.id+':'+c);
  const p=pm.get(e.placeId);assert.equal(p?.countryCode,'BD');assert.match(p.regionCode,/^BD-GEO-(8[1-7]|H)$/);assert.equal(p.adminLevel,'city');assert.ok(p.lat>=20&&p.lat<=27&&p.lon>=88&&p.lon<=93);regions.add(p.regionCode);
  assert.ok(e.sources.some(s=>s.title===e.sourceTitle&&s.url===e.sourceUrl));for(const s of e.sources)assert.equal(new URL(s.url).protocol,'https:');
  assert.equal(e.title.endsWith('（约）'),e.approximate===true,e.id);
  if(e.date){assert.equal(e.precision,'day');assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(new Date(e.date+'T00:00:00Z').toISOString().slice(0,10),e.date);assert.ok(e.date<=h.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.equal(points.size,52);assert.equal(regions.size,8);assert.ok(sources.size>=29);assert.equal(cats.size,10);
});
test('Bangladesh date transitions never double assign partition or independence days',()=>{
 for(const[date,id]of [['1947-08-14','bd-british'],['1947-08-15','bd-eastpakistan'],['1971-03-25','bd-eastpakistan'],['1971-03-26','bd-independent']]){
  const e={year:Number(date.slice(0,4)),date};assert.equal(periodForEvent(e,'BD')?.id,id,date);
  assert.equal(BANGLADESH_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'BD')).length,1,date);
 }
 for(const year of [1947,1971])assert.equal(periodForEvent({year},'BD'),null);
 assert.equal(byKey('east-bengal-province').date,'1947-08-15');assert.equal(byKey('east-bengal-province').periodId,'bd-eastpakistan');
 assert.equal(byKey('operation-searchlight').periodId,'bd-eastpakistan');assert.equal(byKey('independence-declaration').periodId,'bd-independent');
 assert.equal(byKey('engineering-university-renaming').date,null);assert.equal(byKey('engineering-university-renaming').periodId,'bd-independent');
 const bad={year:1971,date:'1971-03-25',periodId:'bd-independent'};assert.notEqual(periodForEvent(bad,'BD')?.id,'bd-independent');
});
test('Bangladesh archaeology separates ancient acts, discovery and later protection',()=>{
 const city=byKey('mahasthan-foundation');assert.equal(city.year,-299);assert.equal(yearTickLabel(city.year),'前300');assert.equal(city.approximate,true);assert.equal(city.endYear,undefined);assert.match(city.summary,/4至3世纪/);
 const grant=byKey('paharpur-jain-grant'),found=byKey('paharpur-copperplate-discovery');
 assert.equal(grant.year,479);assert.equal(grant.date,null);assert.equal(grant.approximate,true);assert.match(grant.summary,/笈多159/);assert.match(grant.summary,/耆那教/);
 assert.equal(found.date,'1927-11-29');assert.match(found.summary,/发现/);
 assert.equal(byKey('paharpur-protection').year,1919);assert.equal(byKey('paharpur-trial-excavation').year,1923);
 for(const k of ['mahasthan-earthquake','wazir-beldanga-building','kaitahar-mosque-school','kusumba-mosque']){assert.equal(byKey(k).date,null);assert.equal(byKey(k).approximate,true);assert.equal(byKey(k).endYear,undefined);}
 assert.equal(byKey('mymensingh-primary-education').year,1871);assert.equal(byKey('mymensingh-primary-education').approximate,true);
});
test('Bangladesh legal dates distinguish declaration, government, adoption, operation and retroactivity',()=>{
 for(const[k,date]of [['independence-declaration','1971-03-26'],['provisional-government','1971-04-10'],['mujibnagar-oath','1971-04-17'],['dhaka-military-surrender','1971-12-16'],['constitution-adoption','1972-11-04'],['constitution-commencement','1972-12-16'],['bangladesh-bank-order','1972-10-31'],['un-charter-undertaking','1972-08-08'],['un-membership','1974-09-17']])assert.equal(byKey(k).date,date,k);
 assert.match(byKey('bangladesh-bank-order').summary,/1971年12月16日/);assert.match(byKey('bangladesh-bank-order').summary,/追溯/);
 assert.match(byKey('un-membership').summary,/纽约/);assert.match(byKey('blood-dissent-telegram').summary,/不是美国正式承认/);
 assert.equal(byKey('varendra-university-transfer').date,'1964-08-24');assert.match(byKey('varendra-university-transfer').summary,/10月11日/);
 assert.match(byKey('rupsha-bridge-civil-completion').summary,/2005年5月/);assert.equal(byKey('rupsha-bridge-civil-completion').date,null);
});
test('Bangladesh modern homonyms use the correct district rather than similarly named settlements',()=>{
 for(const[id,lat,lon,region]of [['bd-shibganj',25.00146,89.32266,'83'],['bd-tarash',24.43026,89.37218,'83'],['bd-kishoreganj',24.43944,90.78291,'81'],['bd-sonargaon',23.65,90.61667,'81'],['bd-madhabpur',24.10038,91.29506,'86'],['bd-padamdi',23.67742,89.54696,'81'],['bd-matlab',23.34754,90.70775,'84']]){
  const p=pm.get(id);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.regionCode,'BD-GEO-'+region);assert.ok(p.sources.some(s=>s.url.startsWith('https://www.geonames.org/')));
 }
 assert.match(pm.get('bd-shibganj').description,/博格拉/);assert.match(pm.get('bd-kishoreganj').description,/朗布尔/);assert.match(pm.get('bd-meherpur').description,/区域参考/);
});
test('Bangladesh filters combine modern place, specific period, year and category',()=>{
 for(const e of records){const p=pm.get(e.placeId),f={countryCode:'BD',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year,category:e.category};assert.equal(eventMatches(e,f,pm),true,e.id);
  assert.equal(eventMatches(e,{...f,countryCode:'IN',period:'all'},pm),false);assert.equal(eventMatches(e,{...f,city:'bd-nonexistent'},pm),false);
  assert.equal(eventMatches(e,{...f,year:e.year-1},pm),false);assert.equal(eventMatches(e,{...f,year:(e.endYear??e.year)+1},pm),false);
 }
 const excavation=byKey('mahasthan-bairagir-excavation');for(const year of [2014,2019,2025])assert.equal(eventMatches(excavation,{countryCode:'BD',period:'bd-independent',scope:'year',year},pm),true);
 assert.equal(eventMatches(excavation,{countryCode:'BD',period:'bd-independent',scope:'year',year:2026},pm),false);
 const line=byKey('dhaka-chittagong-telegraph');assert.equal(line.endYear,1859);assert.equal(eventMatches(line,{countryCode:'BD',scope:'year',year:1859},pm),true);
});
test('Bangladesh selection does not clone already bundled shared battles and regional flight events',()=>{
 for(const id of ['mm-1666-arakan-chittagong-loss','mm-1541-arakan-chittagong-coin','in-1757-plassey-battle','in-1947-independence-act-assent','mm-1978-rakhine-flight-1978'])assert.ok(h.events.some(e=>e.id===id));
 assert.ok(!records.some(e=>e.year===1666&&/征服|攻占/.test(e.title)));assert.ok(!records.some(e=>e.year===1757&&/普拉西|帕拉西/.test(e.title)));
 assert.ok(!records.some(e=>e.year===1947&&e.date==='1947-07-18'));
 assert.ok(!records.some(e=>/罗兴亚.*(逃亡|逃离|流离)/.test(e.title)));
});


test('Bangladesh ancient relief inscription has an approximate BCE reference, separate from its modern discovery',()=>{
 const e=byKey('mahasthan-relief-inscription');assert.equal(e.year,-249);assert.equal(yearTickLabel(e.year),'前250');assert.equal(e.date,null);assert.equal(e.approximate,true);assert.equal(e.endYear,undefined);assert.match(e.summary,/姓名.*原因.*不能确定/);assert.match(e.summary,/参考/);
 const found=byKey('mahasthan-brahmi-discovery');assert.equal(found.date,'1931-11-30');assert.equal(found.placeId,e.placeId);assert.match(found.summary,/加尔各答/);
 assert.equal(records.filter(e=>e.year<1).length,2);
});
test('Bangladesh Gupta charters preserve calendar uncertainty, lost dates and corrected readings',()=>{
 for(const[k,y]of [['dhanaidaha-land-grant',433],['kalaikuri-collective-land-grant',440],['jagadispur-religious-endowment',448],['baigram-govindasvamin-endowment',448],['damodarpur-agnihotra-grant',444],['damodarpur-five-sacrifices-grant',448],['damodarpur-brahmin-settlement',483],['damodarpur-two-shrines-grant',485],['damodarpur-svetavaraha-support',544],['gunaighar-mahayana-grant',508]]){
  const e=byKey(k);assert.equal(e.year,y,k);assert.equal(e.approximate,true);assert.equal(e.date,null);assert.equal(e.endYear,undefined);assert.equal(e.periodId,'bd-ancient');
 }
 assert.match(byKey('kalaikuri-collective-land-grant').summary,/120年与121年/);assert.match(byKey('damodarpur-five-sacrifices-grant').summary,/129.*128/);
 assert.match(byKey('damodarpur-two-shrines-grant').summary,/470至500/);assert.match(byKey('damodarpur-svetavaraha-support').summary,/224.*王名残缺/);
 assert.match(byKey('damodarpur-brahmin-settlement').summary,/村民纳巴卡/);assert.doesNotMatch(byKey('damodarpur-brahmin-settlement').summary,/村长/);
 for(const e of [byKey('mainamati-ladhamadhava-grants'),byKey('mainamati-govindachandra-nattesvara')]){assert.equal(e.periodId,'bd-pala-sena');assert.equal(e.approximate,true);assert.equal(e.date,null);assert.equal(e.endYear,undefined);assert.match(e.summary,/改宗/);}
 assert.equal(byKey('damodarpur-five-plates-discovery').year,1915);assert.equal(byKey('damodarpur-five-plates-discovery').date,null);assert.match(byKey('damodarpur-five-plates-discovery').summary,/4月/);
 assert.ok(!records.some(e=>e.id.includes('ashrafpur-charter')||e.id.includes('viradharadeva')));
});
test('Bangladesh additional references distinguish same-name towns and regional landmarks',()=>{
 for(const[id,lat,lon,region,gid]of [['naogaon',24.79929,88.9321,'83',1201182],['hakimpur',25.28262,89.0191,'87',8065029],['puthia',24.36537,88.83431,'83',7483743],['savar',23.84858,90.25002,'81',1349452],['moulvibazar',24.48888,91.77075,'86',1185166],['hathazari',22.50515,91.81339,'84',1462674],['rangpur',25.74664,89.25166,'87',1185188],['munshiganj',23.5517,90.53459,'81',1336141]]){
  const p=pm.get('bd-'+id);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.regionCode,'BD-GEO-'+region);assert.ok(p.sources.some(s=>s.url==='https://www.geonames.org/'+gid+'/'));assert.match(p.description,/参考/);
 }
 assert.equal(byKey('chittagong-university-project').placeId,'bd-chattogram');assert.equal(byKey('chittagong-university-teaching').placeId,'bd-hathazari');
 assert.equal(byKey('jagadispur-religious-endowment').placeId,'bd-puthia');assert.equal(byKey('jagadispur-varendra-acquisition').placeId,'bd-rajshahi');
 assert.match(pm.get('bd-hakimpur').description,/印度/);assert.match(pm.get('bd-munshiganj').description,/以西/);
});
test('Bangladesh university chronology separates legal formation, opening, teaching and campus',()=>{
 for(const[k,date]of [['chittagong-university-project','1965-12-03'],['chittagong-university-ordinance','1966-09-25'],['chittagong-university-inauguration','1966-11-18'],['chittagong-university-teaching','1966-11-28'],['jahangirnagar-establishment','1970-08-20'],['jahangirnagar-formal-launch','1971-01-12'],['agricultural-university-ordinance','1961-08-18'],['agricultural-university-organization','1961-09-02'],['sust-establishment','1986-08-25'],['khulna-university-teaching','1991-11-25']])assert.equal(byKey(k).date,date,k);
 assert.equal(byKey('jahangirnagar-formal-launch').periodId,'bd-eastpakistan');assert.equal(byKey('jahangirnagar-charter').periodId,'bd-independent');
 assert.equal(byKey('sust-teaching').year,1991);assert.equal(byKey('sust-teaching').date,null);assert.match(byKey('sust-teaching').summary,/差异/);
 for(const[k,y]of [['rangpur-university-establishment',2008],['rangpur-university-teaching',2009],['rangpur-university-permanent-campus',2011]]){assert.equal(byKey(k).year,y);assert.equal(byKey(k).date,null);}
 assert.equal(byKey('chittagong-museum-opening').date,'1973-06-14');assert.equal(byKey('chittagong-museum-new-premises').year,1992);
});
test('Bangladesh infrastructure records use actual opening dates rather than construction or planned completion',()=>{
 assert.equal(byKey('jamuna-multipurpose-bridge-opening').date,'1998-06-23');
 const paksey=byKey('paksey-bridge-opening');assert.equal(paksey.year,2004);assert.equal(paksey.date,null);assert.match(paksey.summary,/5月/);assert.match(paksey.summary,/2月土建完成/);
 assert.equal(byKey('padma-bridge-inauguration').date,'2022-06-25');assert.equal(byKey('padma-bridge-public-traffic').date,'2022-06-26');
 assert.equal(byKey('padma-bridge-inauguration').placeId,'bd-munshiganj');assert.equal(byKey('padma-bridge-public-traffic').placeId,'bd-munshiganj');
 assert.match(byKey('padma-bridge-public-traffic').summary,/当天.*确认/);assert.match(byKey('national-digital-topographic-map').summary,/2018.*25000/);
});
test('Bangladesh heritage records distinguish tradition, proclamation and inscription procedures',()=>{
 assert.equal(byKey('baul-masterpiece-proclamation').year,2005);assert.equal(byKey('baul-representative-list').year,2008);assert.match(byKey('baul-masterpiece-proclamation').summary,/印度/);
 assert.equal(byKey('mangal-newyear-procession-begins').year,1989);assert.equal(byKey('mangal-representative-list').year,2016);
 assert.equal(byKey('intangible-convention-ratification').date,'2009-06-11');
 for(const[k,y,decision]of [['jamdani-representative-list',2013,'8.COM/8.4'],['rickshaw-art-representative-list',2023,'18.COM/8.b.23'],['tangail-saree-representative-list',2025,'20.COM/7.b.5']]){
  const e=byKey(k);assert.equal(e.year,y);assert.equal(e.date,null);assert.equal(e.sourceUrl,'https://ich.unesco.org/en/Decisions/'+decision);
 }
 assert.match(byKey('tangail-saree-representative-list').summary,/不断言.*仅流传/);assert.equal(byKey('shitalpati-representative-list').placeId,'bd-sylhet');
});
test('Bangladesh 1975 and 1990 transitions use event dates rather than reporting dates',()=>{
 for(const[k,date]of [['mujib-assassination-coup','1975-08-15'],['dhaka-jail-leaders-killed','1975-11-03'],['sayem-presidency-parliament-dissolution','1975-11-06'],['november-sepoy-revolt','1975-11-07'],['ershad-resignation-transition','1990-12-06']])assert.equal(byKey(k).date,date,k);
 assert.equal(new Date(byKey('sayem-presidency-parliament-dissolution').date+'T00:00Z').getUTCDay(),4);assert.equal(new Date(byKey('november-sepoy-revolt').date+'T00:00Z').getUTCDay(),5);
 assert.match(byKey('november-sepoy-revolt').summary,/不能.*当天已就任总统/);assert.match(byKey('ershad-resignation-transition').summary,/1996/);
 assert.equal(byKey('shilpakala-academy-new-act').date,'1989-05-31');assert.match(byKey('shilpakala-academy-new-act').summary,/1974.*不表示.*首次/);
});
test('Bangladesh garment safety separates disaster, action plan and technical consensus',()=>{
 assert.equal(byKey('tazreen-fashions-fire').date,'2012-11-24');assert.equal(byKey('rana-plaza-collapse').date,'2013-04-24');assert.match(byKey('rana-plaza-collapse').summary,/逾千.*差异/);
 assert.equal(byKey('garment-fire-structural-safety-plan').date,'2013-07-25');
 const e=byKey('garment-assessment-standards');assert.equal(e.date,'2013-11-07');assert.equal(e.placeId,'bd-dhaka');assert.equal(e.category,'制度');assert.match(e.summary,/达成一致.*随后提交/);assert.match(e.summary,/不将.*服务站/);
 assert.equal(e.sourceUrl,'https://www.ilo.org/resource/chronology-recent-events-bangladesh-ready-made-garment-rmg-sector');
 assert.ok(!records.some(e=>e.id.endsWith('-rana-coordination-cell')));
});

test('Mughal architecture references distinguish homonymous towns and later construction periods',()=>{
 const chat=byKey('chatmohar-shahi-mosque'),kh=byKey('kherua-sherpur-mosque'),atia=byKey('atia-mosque'),bajra=byKey('bajra-mosque');
 assert.deepEqual([chat.year,kh.year,atia.year,bajra.year],[1582,1582,1609,1741]);assert.equal(chat.placeId,'bd-chatmohar');assert.equal(kh.placeId,'bd-sherpur-bogra');assert.equal(atia.placeId,'bd-delduar');assert.equal(bajra.placeId,'bd-begamganj');
 const sp=pm.get(kh.placeId),dp=pm.get(atia.placeId),bp=pm.get(bajra.placeId);assert.deepEqual([sp.lat,sp.lon],[24.67653,89.41589]);assert.equal(sp.regionCode,'BD-GEO-83');assert.ok(sp.sources.some(s=>s.url==='https://www.geonames.org/8429842/'));assert.equal(dp.regionCode,'BD-GEO-81');assert.equal(bp.regionCode,'BD-GEO-84');
 const later=byKey('nayabad-mosque');assert.equal(later.year,1793);assert.equal(later.periodId,'bd-british');assert.equal(later.placeId,'bd-kaharol');
});
test('Approximate Mughal journeys and building ranges never fabricate days or persistent durations',()=>{
 for(const key of ['hajiganj-river-fort','shahjahan-dhaka-visit','shahjahan-bengal-administration','shahjahan-qadam-rasul-visit','arakan-envoys-dhaka','idrakpur-river-fort','sonakanda-river-fort','begumbazar-five-dome-mosque']){
  const e=byKey(key);assert.ok(e.approximate,key);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.periodId,'bd-mughal');
 }
 assert.match(byKey('shahjahan-dhaka-visit').summary,/尚未即位|尚未|皇子/);assert.match(byKey('arakan-envoys-dhaka').summary,/不据.*认定|不.*属国/);assert.equal(byKey('shahjahan-qadam-rasul-visit').placeId,'bd-narayanganj');
 const mint=byKey('dhaka-mint-coin-evidence');assert.equal(mint.year,1617);assert.match(mint.summary,/钱币年代/);assert.match(mint.summary,/不.*成立/);
});
test('Lalbagh construction, interruption and preservation remain separate historical stages',()=>{
 const start=em.get('bd-1678-lalbagh-fort'),stop=byKey('lalbagh-construction-abandoned'),pres=byKey('lalbagh-dhaka-committee-preservation'),arch=byKey('lalbagh-archaeology-jurisdiction');
 assert.deepEqual([start.year,stop.year,pres.year,arch.year],[1678,1684,1844,1910]);for(const e of [start,stop,pres,arch])assert.equal(e.placeId,'bd-dhaka');assert.equal(stop.periodId,'bd-mughal');assert.equal(pres.periodId,'bd-british');assert.match(stop.summary,/未完成/);
});
test('Microcredit and BRAC field work, registration and name change preserve distinct phases',()=>{
 assert.equal(byKey('grameen-jobra-pilot').year,1976);assert.equal(byKey('grameen-jobra-pilot').placeId,'bd-hathazari');assert.equal(byKey('grameen-bank-institution').year,1983);
 const field=byKey('brac-sulla-field-relief'),reg=byKey('brac-society-registration'),name=byKey('brac-society-name-change'),shift=byKey('brac-long-term-development');
 assert.deepEqual([field.date,reg.date,name.date],['1972-01-17','1972-03-21','1992-06-15']);assert.equal(field.placeId,'bd-sulla');assert.equal(reg.placeId,'bd-dhaka');assert.equal(pm.get(field.placeId).regionCode,'BD-GEO-86');assert.ok(shift.approximate);assert.equal(shift.date,null);assert.equal(shift.endYear,undefined);assert.match(shift.summary,/到1974年|阶段/);
});
test('Atomic commission continuity and independent regulatory authority keep their actual dates',()=>{
 const commission=byKey('atomic-energy-commission'),law=byKey('atomic-regulatory-act'),regulator=byKey('atomic-regulatory-authority'),renew=byKey('atomic-commission-law-renewal');
 assert.equal(commission.year,1973);assert.equal(commission.date,null);assert.deepEqual([law.date,regulator.date,renew.date],['2012-06-19','2013-02-12','2017-11-22']);assert.match(renew.summary,/连续性/);
 const siting=byKey('rooppur-siting-licence'),build=byKey('rooppur-first-concrete'),vessel=byKey('rooppur-reactor-vessel'),fuel=byKey('rooppur-first-fuel-ceremony');
 assert.deepEqual([siting.date,build.date,vessel.year,fuel.date],['2016-06-21','2017-11-30',2021,'2023-10-05']);assert.equal(vessel.date,null);for(const e of [siting,build,vessel,fuel])assert.equal(e.placeId,'bd-ishwardi');assert.match(fuel.summary,/视频/);assert.match(fuel.summary,/维也纳/);assert.match(build.summary,/不表示已经发电/);
});
test('Dhaka metro opening ceremony does not replace the next day passenger service date',()=>{
 const opening=byKey('mrt6-opening-ceremony'),service=byKey('mrt6-passenger-service');assert.deepEqual([opening.date,service.date],['2022-12-28','2022-12-29']);assert.equal(opening.placeId,'bd-dhaka');assert.equal(service.placeId,'bd-dhaka');assert.match(service.summary,/两站/);assert.match(opening.sourceUrl,/12390142_01\.pdf$/);
});
test('Dhaka metro nine station and sixteen station milestones keep phased operations',()=>{
 const north=byKey('mrt6-northern-nine-stations'),south=byKey('mrt6-motijheel-service'),all=byKey('mrt6-original-sixteen-stations');assert.deepEqual([north.date,south.date,all.date],['2023-03-31','2023-11-05','2023-12-31']);assert.match(north.summary,/九座/);assert.match(south.summary,/不.*十六站/);assert.match(all.summary,/原有十六/);assert.match(all.summary,/不代表.*卡马拉普尔/);
});
test('Transport completion, opening ceremony and dedicated rail bridge do not merge unrelated dates',()=>{
 const meghna=byKey('meghna-first-bridge-ceremony'),airport=byKey('chattogram-airport-development'),tunnel=byKey('karnaphuli-tunnel-inauguration'),rail=byKey('jamuna-dedicated-rail-bridge');
 assert.equal(meghna.year,1991);assert.equal(meghna.date,null);assert.match(meghna.summary,/5月/);assert.match(meghna.summary,/2月/);assert.equal(airport.year,2003);assert.equal(airport.date,null);assert.match(airport.summary,/扩建|设施改善/);
 assert.deepEqual([tunnel.date,rail.date],['2023-10-28','2025-03-18']);assert.equal(rail.placeId,'bd-tangail');assert.match(rail.summary,/与1998年.*不同/);assert.match(rail.locationNote,/东岸/);
});
test('Cyclones preserve estimated casualties, cross night start and unproven calendar days',()=>{
 const bhola=byKey('bhola-cyclone'),old=byKey('chittagong-cyclone1991'),sidr=byKey('sidr-cyclone');
 assert.deepEqual([bhola.date,old.date,sidr.date],['1970-11-12',null,'2007-11-15']);assert.equal(bhola.periodId,'bd-eastpakistan');assert.equal(old.year,1991);assert.equal(sidr.placeId,'bd-barguna');assert.match(bhola.summary,/30万至50万/);assert.match(old.summary,/估计|不同资料/);assert.match(sidr.summary,/超过三千/);
});
test('Architectural tentative listing has three primary nominations and is not inscription',()=>{
 const e=byKey('architectural-tentative-list');assert.equal(e.date,'2023-05-17');assert.equal(e.sources.length,3);assert.deepEqual(e.sources.map(s=>s.url.match(/667[235]/)?.[0]).sort(),['6672','6673','6675']);assert.match(e.title,/预备名单/);assert.match(e.summary,/莫卧儿与殖民时期寺庙群/);assert.match(e.summary,/不表示已经列入/);assert.equal(e.placeId,'bd-dhaka');
});
