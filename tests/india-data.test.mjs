import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {INDIA_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),records=data.events.filter(e=>e.periodId?.startsWith('in-')),byId=new Map(records.map(e=>[e.id,e]));
test('India has attributed, sourced and geographically anchored records across all periods',()=>{
 assert.equal(periodsForCountry('IN'),INDIA_PERIODS);assert.equal(records.length,743);assert.equal(INDIA_PERIODS.filter(p=>!p.navigationOnly).length,19);assert.deepEqual(periodBounds('all',2026,'IN'),[-19999,2026]);assert.ok(Object.isFrozen(INDIA_PERIODS));
 const ids=new Set(),titles=new Set(),sources=new Set(),regions=new Set(),categories=new Set();
 for(const p of INDIA_PERIODS){assert.ok(Object.isFrozen(p));if(!p.navigationOnly){assert.equal(new URL(p.sourceURL).protocol,'https:');assert.ok(records.some(e=>e.periodId===p.id),p.id);}}
 for(const e of records){assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);sources.add(e.sourceUrl);categories.add(e.category);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);assert.equal(periodForEvent(e,'IN')?.id,e.periodId,e.id);assert.equal(INDIA_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'IN')).length,1,e.id);
  for(const c of ['CN','JP','KR','KP','MN','VN','LA','KH','TH','MM'])assert.equal(periodForEvent(e,c),null,e.id);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'IN',e.id);assert.ok(p.regionName&&p.regionCode&&p.lon>=68&&p.lon<=98&&p.lat>=7&&p.lat<=37,e.id);regions.add(p.regionCode);
  assert.equal(new URL(e.sourceUrl).protocol,'https:');assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle));
  if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full);assert.equal(Number(e.date.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.ok(sources.size>=120);assert.ok(regions.size>=24);for(const c of ['政治','战争','经济','科技','文化','营建','制度'])assert.ok(categories.has(c),c);
 assert.equal(data.meta.collections.filter(p=>p.countryCode==='IN').reduce((n,p)=>n+p.events,0),743);
});
test('India independence and republican transitions use effective civil dates without overlap',()=>{
 for(const [date,id]of [['1858-09-01','in-company'],['1858-09-02','in-british'],['1947-08-14','in-british'],['1947-08-15','in-dominion'],['1950-01-25','in-dominion'],['1950-01-26','in-republic']]){
  const e={year:Number(date.slice(0,4)),date,periodId:id};assert.equal(periodForEvent(e,'IN')?.id,id,date);
 }
 for(const year of [1858,1947,1950])assert.equal(periodForEvent({year},'IN'),null);
 assert.equal(byId.get('in-1858-government-india-act').periodId,'in-company');assert.equal(byId.get('in-1858-crown-government-act-commences').date,'1858-09-02');assert.equal(byId.get('in-1858-queen-proclamation-allahabad').placeId,'in-prayagraj');
 assert.equal(byId.get('in-1853-india-first-passenger-rail').date,'1853-04-16');assert.equal(byId.get('in-1927-congress-simon-boycott').placeId,'in-chennai');assert.equal(byId.get('in-1930-salt-law-broken-dandi').placeId,'in-dandi');
 assert.equal(byId.get('in-1948-gandhi-assassinated').date,'1948-01-30');assert.equal(byId.get('in-2005-rti-act-main-commencement').date,'2005-10-12');assert.equal(byId.get('in-2014-mars-orbiter-mars-arrival').placeId,'in-bengaluru');
 assert.equal(byId.get('in-1947-india-dominion-independence').date,'1947-08-15');assert.equal(byId.get('in-1950-republic-founded').date,'1950-01-26');
});
test('India records filter by modern reference place and year without cross-country leakage',()=>{
 for(const e of records){const p=places.get(e.placeId),filters={countryCode:'IN',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,filters,places),true,e.id);assert.equal(eventMatches(e,{...filters,year:e.year-1},places),false);assert.equal(eventMatches(e,{...filters,year:(e.endYear??e.year)+1},places),false);assert.equal(eventMatches(e,{...filters,countryCode:'CN',period:'all'},places),false);
 }
 assert.equal(places.get('in-sriharikota').regionCode,'IN-GEO-02');assert.equal(byId.get('in-2023-chandrayaan-three').placeId,'in-sriharikota');
 assert.equal(byId.get('in-1192-tarain-ghurid-victory').placeId,'new-delhi');assert.match(byId.get('in-1192-tarain-ghurid-victory').locationNote,/不是战场/);
 assert.equal(data.events.filter(e=>e.placeId==='new-delhi'&&!e.periodId?.startsWith('in-')).length>=1,true);
});

test('regional archaeological phases keep explicit ownership and calendar precision',()=>{
 const early=records.filter(e=>/^in-(bce|ce)\d+-/.test(e.id));
 assert.equal(early.length,50);
 assert.deepEqual(periodBounds('in-early-south',2026,'IN'),[-599,499]);
 for(const e of early){
  const match=e.id.match(/^in-(bce|ce)(\d+)-/),expected=match[1]==='bce'?1-Number(match[2]):Number(match[2]);
  assert.equal(e.year,expected,e.id);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.approximate,true);
  assert.match(e.title,/（约）$/);assert.equal(e.endYear,undefined,e.id);
 }
 const regional=byId.get('in-bce1900-hallur-pulse-plant-use');
 assert.equal(eventMatchesPeriod(regional,'in-prehistory','IN'),true);
 assert.equal(eventMatchesPeriod(regional,'in-harappan','IN'),false);
 const south=byId.get('in-bce580-keeladi-early-habitation');
 assert.equal(eventMatchesPeriod(south,'in-early-south','IN'),true);
 assert.equal(eventMatchesPeriod(south,'in-early-states','IN'),false);
 const gola=places.get('in-gola-dhoro');
 assert.equal(gola.regionCode,'IN-GEO-09');assert.ok(Math.abs(gola.lon-(70+37/60+10/3600))<1e-6);
 assert.equal(places.get('in-shirur').regionCode,'IN-GEO-16');
 assert.equal(places.get('in-udaipur-rajasthan').regionCode,'IN-GEO-24');
 assert.equal(places.get('in-fatehabad').regionCode,'IN-GEO-10');
 assert.ok(places.get('in-paravur-north').lat>10);
});
test('Ramappa construction uses its documented year instead of dynasty boundaries',()=>{
 const e=byId.get('in-1123-ramappa-kakatiya-temple');
 assert.equal(e.year,1213);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);
 assert.equal(e.periodId,'in-south');assert.equal(e.placeId,'in-palampet');
 const filters={countryCode:'IN',period:'in-south',scope:'year',year:1213};
 assert.equal(eventMatches(e,filters,places),true);
 for(const year of [1123,1212,1214,1323])assert.equal(eventMatches(e,{...filters,year},places),false);
});

test('Salt March departure has one stable record and preserves both government sources',()=>{
 const e=byId.get('in-1930-salt-march');
 assert.equal(byId.has('in-1930-salt-march-departs'),false);
 assert.equal(e.date,'1930-03-12');assert.equal(e.precision,'day');assert.equal(e.placeId,'in-ahmedabad');
 assert.equal(e.sources.length,2);assert.equal(e.sources[0].url,e.sourceUrl);
 assert.equal(e.sources[0].url,'https://www.gandhismriti.gov.in/more/chronology-mahatma-gandhi');
 assert.equal(e.sources[1].url,'https://cmsadmin.amritmahotsav.nic.in/day-1-12th-march.htm');
 const coast=byId.get('in-1930-salt-law-broken-dandi');assert.equal(coast.date,'1930-04-06');assert.equal(coast.placeId,'in-dandi');
});
test('Hoysala sites have distinct consecrations instead of a two-century map marker',()=>{
 const e=byId.get('in-1100-hoysala-temples');
 assert.equal(e.title,'贝鲁尔陈纳凯沙瓦神庙奉献');assert.equal(e.year,1117);assert.equal(e.placeId,'in-belur');
 assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);
 const filters={countryCode:'IN',period:'in-south',scope:'year',year:1117};
 assert.equal(eventMatches(e,filters,places),true);
 for(const year of [1100,1116,1118,1299])assert.equal(eventMatches(e,{...filters,year},places),false);
 const other=[['in-1121-halebidu-hoysalesvara-consecration',1121,'in-halebidu'],['in-1268-somanathapura-keshava-consecration',1268,'in-mysuru']];
 for(const [id,year,place]of other){const v=byId.get(id);assert.equal(v.year,year);assert.equal(v.placeId,place);assert.equal(v.endYear,undefined);assert.equal(v.approximate,undefined);}
});
test('Ancient Indian regional references distinguish homonyms and museum holdings',()=>{
 assert.equal(byId.get('in-426-udayagiri-parshva-installation').placeId,'in-vidisha');
 assert.equal(places.get('in-vidisha').regionCode,'IN-GEO-35');
 assert.equal(byId.get('in-466-indor-oil-guild-lamp').placeId,'in-anupshahr');
 assert.equal(places.get('in-anupshahr').regionCode,'IN-GEO-36');
 assert.equal(byId.get('in-457-talagunda-kadamba-dynastic-pillar').placeId,'in-shikaripura');
 assert.equal(places.get('in-shikaripura').regionCode,'IN-GEO-19');
 assert.equal(byId.get('in-437-mandsaur-silk-guild-sun-temple').placeId,'in-mandsaur');
 assert.ok(places.get('in-kovilpatti').lat>9&&places.get('in-kovilpatti').lat<10);
});


test('Chola co-regnal years do not restart at the later independent accession',()=>{
 for(const [id,year,rejected]of [['in-1015-ukkal-tank-boats-endowment',1015,1017],['in-1020-melpadi-pastoral-surety-agreement',1020,1022]]){
  const e=byId.get(id);assert.ok(e);assert.equal(e.year,year);assert.match(e.summary,/1012年共治/);assert.equal(e.approximate,true);assert.equal(e.date,null);
  assert.equal(eventMatches(e,{countryCode:'IN',period:'in-south',scope:'year',year:rejected},places),false);
 }
 assert.equal(byId.get('in-1014-rajendra-chola-rule').year,1014);
});
test('Tirumukkudal hospital and college belong to a single sixth-year endowment',()=>{
 const e=byId.get('in-1068-tirumukkudal-college-hospital-endowment');
 assert.equal(e.periodId,'in-south');assert.equal(e.approximate,true);assert.equal(e.precision,'year');assert.equal(e.date,null);assert.match(e.summary,/第六王年/);assert.match(e.summary,/十五床医院/);
 assert.equal(records.filter(v=>v.id.includes('tirumukkudal-')).length,1);assert.equal(e.placeId,'in-kanchipuram');assert.match(e.locationNote,/地区参考/);
 for(const year of [1067,1069,1932])assert.equal(eventMatches(e,{countryCode:'IN',period:'in-south',scope:'year',year},places),false);
});
test('Medieval village references distinguish nearby homonyms and modern state ownership',()=>{
 for(const [id,gid,lat,lon,state]of [['in-manimangalam','1263711',12.91711,80.04171,'25'],['in-melpadi','1263155',13.063,79.28106,'25'],['in-tindivanam','1254444',12.234,79.65551,'25'],['in-kolar','1266305',13.13768,78.12999,'19'],['in-draksharama','1272350',16.7915,82.05941,'02'],['in-uttiramerur','1253623',12.61433,79.75748,'25']]){
  const p=places.get(id);assert.ok(p);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.regionCode,'IN-GEO-'+state);assert.equal(p.countryCode,'IN');assert.match(p.sources[0].url,new RegExp('/'+gid+'/'));
 }
});
test('Inscription findspots do not replace the location or date of recalled activities',()=>{
 const order=byId.get('in-1008-thanjavur-land-revenue-default-order');assert.equal(order.placeId,'in-thanjavur');assert.match(order.sourceUrl,/ukkal/);
 const works=byId.get('in-1128-chidambaram-vikrama-gold-works');assert.match(works.summary,/第十五王年.*第十王年/);assert.equal(works.approximate,true);
 const drak=byId.get('in-1103-draksharama-multisite-support-inscription');assert.equal(drak.placeId,'in-draksharama');assert.match(drak.summary,/追述/);assert.equal(drak.approximate,undefined);assert.equal(drak.date,null);
});
test('Separate village grants and later fiscal actions do not collapse into one date',()=>{
 for(const ids of [['in-1068-perumber-land-reclamation-grant','in-1080-perumber-temple-tax-relief'],['in-1186-chidambaram-keralarajan-garden-order','in-1188-chidambaram-valuvarayan-garden-deeds']]){
  const [a,b]=ids.map(id=>byId.get(id));assert.ok(a&&b);assert.equal(a.placeId,b.placeId);assert.notEqual(a.year,b.year);assert.notEqual(a.sourceUrl,b.sourceUrl);
  for(const [chosen,other]of [[a,b],[b,a]]){const f={countryCode:'IN',city:chosen.placeId,period:'in-south',scope:'year',year:chosen.year};assert.equal(eventMatches(chosen,f,places),true);assert.equal(eventMatches(other,f,places),false);}
 }
});
test('Connected charters and family patronage remain unified with their document numbers',()=>{
 const a=byId.get('in-1013-melpadi-memorial-temple-land-grants'),b=byId.get('in-1118-manimangalam-festival-tax-capital'),c=byId.get('in-1233-manimangalam-accountant-sons-patronage');
 assert.match(a.sourceTitle,/15、16号/);assert.match(b.sourceTitle,/31、32号/);assert.equal(c.sources.length,2);assert.match(c.sources[0].title,/39号/);assert.match(c.sources[1].title,/41号/);
 assert.equal(c.approximate,true);assert.match(c.summary,/暂定/);
 for(const e of [a,b,c]){assert.equal(e.endYear,undefined);assert.equal(e.date,null);for(const s of e.sources)assert.equal(new URL(s.url).hash,'');}
});
test('Astronomically checked medieval years do not claim unconverted modern civil days',()=>{
 for(const [id,year]of [['in-991-tiruvalam-temple-account-inspection',991],['in-1046-manimangalam-temple-land-purchase',1046],['in-1118-manimangalam-festival-tax-capital',1118],['in-1180-tirumanikuli-cattle-lamp-contract',1180],['in-1189-manimangalam-vanguard-chief-land-gift',1189]]){
  const e=byId.get(id);assert.equal(e.year,year);assert.equal(e.approximate,undefined);assert.equal(e.precision,'year');assert.equal(e.date,null);
 }
});


test('Northern inscriptions preserve their original era and broad dating',()=>{
 const ranges=[
 ['in-494-karitalai-jayanatha-land-charter','493至495年','174年'],
 ['in-497-khoh-jayanatha-temple-endowment','496至498年','177年'],
 ['in-511-majhgawam-hastin-brahman-charter','510至512年','191年'],
 ['in-514-khoh-sarvanatha-four-shares','513至515年','193年'],
 ['in-529-khoh-samksobha-goddess-grant','528至530年','209年'],
 ['in-534-khoh-pulindabhata-temple-confirmation','533至534年','214年']];
 for(const[id,range,era]of ranges){const e=byId.get(id);assert.ok(e,id);assert.ok(e.summary.includes(range),id);assert.ok(e.summary.includes(era),id);assert.equal(e.approximate,true,id);assert.equal(e.date,null,id);assert.equal(e.precision,'year',id);}
 const four=byId.get('in-514-khoh-sarvanatha-four-shares');assert.match(four.summary,/两份.*一份.*一份/);assert.equal(four.year,514);
});
test('Bhumara critical reading identifies the village head family as pillar donors',()=>{
 const e=byId.get('in-509-bhumara-shivadasa-pillar');assert.ok(e);
 assert.match(e.summary,/村长瓦苏之子.*因达那之孙湿婆达萨立柱/);
 assert.match(e.summary,/纠正.*误作君主.*界标/);
 assert.equal(e.sources[0].url,'https://dharmalekha.info/texts/INSSiddham00080');
 assert.equal(e.approximate,true);assert.equal(e.periodId,'in-early-medieval');
});
test('Private Sun temple donors and identical pillar witnesses are not multiplied into events',()=>{
 const sun=byId.get('in-525-gwalior-matrcheta-sun-temple');assert.match(sun.summary,/摩特里切塔在山上建造太阳神庙/);assert.match(sun.summary,/第十五王年/);assert.match(sun.summary,/515至540年/);assert.equal(sun.approximate,true);
 const pillars=records.filter(e=>e.sources.some(s=>/in00094|in00095/i.test(s.url)));
 assert.equal(pillars.length,1);assert.match(pillars[0].summary,/两根同文柱.*同一铭文工程/);assert.match(pillars[0].summary,/没有明确纪年/);
 const confirmation=byId.get('in-534-khoh-pulindabhata-temple-confirmation');assert.match(confirmation.summary,/旧授、转赠和批准属于同一确认文书/);
});
test('Late Islamic months are assigned to the correct CE year rather than chapter headings',()=>{
 const years=[
 ['minhaj-nasiriya-reappointment',1245,'643年'],
 ['ranthambhor-campaign-loss',1249,'646年'],
 ['hansi-minhaj-inam-possession',1250,'647年'],
 ['tabarhindh-arslan-assignment',1254,'651年'],
 ['hansi-siwalik-military-arrangements',1255,'653年']];
 for(const[slug,year,original]of years){const matches=records.filter(e=>e.id.endsWith('-'+slug));assert.equal(matches.length,1,slug);const e=matches[0];assert.equal(e.year,year,slug);assert.ok(e.summary.includes(original),slug);assert.equal(e.date,null);assert.equal(e.precision,'year');}
 assert.match(byId.get('in-1249-ranthambhor-campaign-loss').summary,/没有可靠证据.*攻下堡垒/);
});
test('Court marriage, ministerial offices and namesakes retain their corrected identities',()=>{
 const marriage=byId.get('in-1249-nasiruddin-balban-daughter-marriage');assert.match(marriage.summary,/马哈茂德迎娶.*巴尔班.*女儿/);assert.match(marriage.sources[0].title,/Raverty/);
 const offices=byId.get('in-1253-ulugh-khan-hansi-dismissal');assert.match(offices.summary,/朱奈迪的宰相职务与赖汉的王室事务官职/);
 const rebel=byId.get('in-1251-nagaur-kishlu-submission');assert.match(rebel.summary,/与后来成为德里苏丹的乌鲁格汗.*不同/);
 const sher=byId.get('in-1259-sher-khan-gwalior-assignment');assert.match(sher.summary,/不是十六世纪苏尔王朝的舍尔沙/);
});
test('Raziya capture and death remain separate regional nodes and exact days are not invented',()=>{
 const capture=byId.get('in-1240-raziya-tabarhindh-capture'),death=byId.get('in-1240-raziya-altuniya-kaithal-death');
 assert.equal(capture.placeId,'in-bathinda');assert.equal(death.placeId,'in-kaithal');
 assert.equal(capture.year,1240);assert.equal(death.year,1240);assert.equal(capture.date,null);assert.equal(death.date,null);
 assert.ok(capture.sources.some(s=>s.url==='https://mcbathinda.punjab.gov.in/Home'));
 assert.match(capture.summary,/斋月/);assert.match(death.summary,/赖比尔前月/);
});
test('North Indian town references distinguish state and geographic homonyms',()=>{
 const expected=[
 ['in-hansi',29.10239,75.96253,'10','1270417'],
 ['in-badaun',28.03811,79.12668,'36','1275163'],
 ['in-katni',23.83776,80.39405,'35','1262395'],
 ['in-mehrauli',28.51997,77.18031,'07','1264352'],
 ['in-taraori',29.80147,76.92825,'10','1254413'],
 ['in-bathinda',30.20747,74.93893,'23','1276070'],
 ['in-nuh',28.10296,77.00144,'10','1261145']];
 for(const[id,lat,lon,state,gid]of expected){const p=places.get(id);assert.equal(p.countryCode,'IN');assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.regionCode,'IN-GEO-'+state);assert.ok(p.sources.some(s=>s.url==='https://www.geonames.org/'+gid+'/'));assert.equal(p.adminLevel,undefined);}
});
test('Tomb construction, death, gateway dating and neighboring well and mosque dates remain distinct',()=>{
 const tomb=byId.get('in-1235-mehrauli-iltutmish-tomb-build'),death=byId.get('in-1236-iltutmish-death-rukn-succession');
 assert.equal(tomb.category,'营建');assert.equal(death.category,'政治');assert.match(tomb.summary,/死亡与继位事件另属1236年/);
 const ghari=byId.get('in-1232-delhi-sultan-ghari-tomb');assert.equal(ghari.approximate,true);assert.match(ghari.summary,/1231至1232年/);assert.match(ghari.summary,/不是1246年登基的同名苏丹/);
 const gate=byId.get('in-1311-mehrauli-alai-darwaza');assert.equal(gate.approximate,true);assert.match(gate.summary,/1310至1311年/);
 const nili=byId.get('in-1506-delhi-nili-mosque');assert.equal(nili.approximate,true);assert.match(nili.summary,/1505至1506年/);
 const well=byId.get('in-1506-mehrauli-rajon-stepwell');assert.equal(well.year,1506);assert.match(well.summary,/相邻清真寺.*1512年/);assert.equal(well.approximate,undefined);
});
test('Campaign launch dates and chronicle completion do not turn into annually repeated spans',()=>{
 const campaign=byId.get('in-1251-nasiruddin-gwalior-campaign-launch');assert.match(campaign.summary,/1252年/);assert.equal(campaign.endYear,undefined);assert.equal(eventMatches(campaign,{year:1251},places),true);assert.equal(eventMatches(campaign,{year:1252},places),false);
 const disputed=byId.get('in-1256-kutlugh-badaun-conflict');assert.equal(disputed.approximate,true);assert.match(disputed.summary,/1255至1256年/);
 const chronicle=byId.get('in-1260-minhaj-nasiri-main-history');assert.match(chronicle.summary,/658年.*闪瓦鲁月/);assert.equal(chronicle.date,null);
 for(const id of ['in-1211-iltutmish-delhi-accession','in-1216-tarain-yalduz-defeat'])assert.equal(byId.get(id).approximate,true);
 for(const e of records.filter(e=>e.id.includes('ulugh-khan-')&&e.year<1266))assert.equal(e.periodId,'in-sultanate');
});

test('Akbar reforms retain distinct tax scopes and years',()=>{
 const captive=byId.get('in-1562-captives-families-enslavement-ban'),pilgrim=byId.get('in-1563-mathura-pilgrimage-tax-remission'),jizya=byId.get('in-1564-jizya-tax-remission');
 assert.match(captive.summary,/家属/);assert.match(captive.summary,/奴隶关系/);assert.equal(pilgrim.placeId,'in-mathura');assert.equal(jizya.placeId,'in-agra');
 for(const [e,y]of [[captive,1562],[pilgrim,1563],[jizya,1564]]){assert.equal(e.year,y);assert.equal(e.date,null);assert.equal(eventMatches(e,{countryCode:'IN',period:'in-mughal',scope:'year',year:y},places),true);assert.equal(eventMatches(e,{countryCode:'IN',period:'in-mughal',scope:'year',year:y+1},places),false);}
});
test('Ibadatkhana building, expanded discussions and later religious code are separate stages',()=>{
 const built=byId.get('in-1575-ibadatkhana-debate-house'),expanded=byId.get('in-1578-ibadatkhana-expanded-discussions'),old=byId.get('in-1582-akbar-religious-code');
 assert.deepEqual([built.year,expanded.year,old.year],[1575,1578,1582]);assert.match(expanded.summary,/1580年抵达/);assert.ok(expanded.sources.some(s=>s.url.endsWith('#fn-368a')));
});
test('Mughal early-year and late-year events keep the checked civil year',()=>{
 for(const[id,y]of [['in-1561-bairam-khan-patan-assassination',1561],['in-1568-chittor-fort-capture',1568],['in-1570-ajmer-shrine-administration',1570],['in-1572-cambay-port-merchants-audience',1572],['in-1584-sarkhej-muzaffar-defeat',1584],['in-1601-asirgarh-fort-surrender',1601]]){const e=byId.get(id);assert.equal(e.year,y);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.match(e.locationNote,/纪年依据/);}
});
test('Ahmadnagar siege, negotiated peace and final capture do not share a year',()=>{
 const first=byId.get('in-1595-ahmadnagar-chand-bibi-siege'),peace=byId.get('in-1596-ahmadnagar-berar-peace'),fall=byId.get('in-1600-ahmadnagar-fort-capture');
 assert.deepEqual([first.year,peace.year,fall.year],[1595,1596,1600]);for(const e of [first,peace,fall])assert.equal(e.placeId,'in-ahmadnagar');
 assert.match(fall.locationNote,/1601.*误植/);assert.match(peace.summary,/不等于.*接管/);assert.equal(eventMatches(fall,{countryCode:'IN',period:'in-mughal',scope:'year',year:1601},places),false);
});
test('New Mughal city references distinguish modern homonyms and renamed cities',()=>{
 for(const[id,gid,lat,lon,state]of [['in-sarangpur','1257237',23.56651,76.47306,'35'],['in-banda','1277397',25.47758,80.33491,'36'],['in-jaleswar','1269413',21.80176,87.2225,'21'],['in-rajmahal','1258843',25.05303,87.83048,'38'],['in-ahmadnagar','1279228',19.09457,74.73843,'16'],['in-bijbehara','1275692',33.79378,75.107,'12']]){const p=places.get(id);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.countryCode,'IN');assert.equal(p.regionCode,'IN-GEO-'+state);assert.match(p.sources[0].url,new RegExp('/'+gid+'/'));}
 assert.equal(places.get('in-ahmadnagar').name,'阿希利耶讷格尔');assert.ok(places.get('in-ahmadnagar').aliases.includes('Ahmednagar'));assert.equal(byId.get('in-1572-sarnal-ibrahim-battle').placeId,'in-ahmedabad');assert.match(byId.get('in-1572-sarnal-ibrahim-battle').locationNote,/未在地图定位/);
});
test('Ilahi epoch and decree are not confused with Akbar accession',()=>{
 const e=byId.get('in-1584-ilahi-era-promulgation');assert.equal(e.year,1584);assert.equal(byId.get('in-1556-akbar-accession').year,1556);assert.match(e.summary,/追溯.*1556年/);assert.equal(eventMatches(e,{countryCode:'IN',period:'in-mughal',scope:'year',year:1556},places),false);
});
test('Posthumous Akbarnama continuation and Jahangir account are attributed separately',()=>{
 for(const id of ['in-1602-abul-fazl-antri-assassination','in-1604-salim-agra-return-confinement','in-1605-akbar-death-at-agra']){const e=byId.get(id);assert.match(e.sourceTitle,/后人续篇/);assert.ok(e.sources.some(s=>s.url.endsWith('#p-1204')));}
 const death=byId.get('in-1602-abul-fazl-antri-assassination');assert.equal(death.placeId,'in-gwalior');assert.ok(death.sources.some(s=>s.url.includes('011001081/all#p-25')));
});
test('Mughal epidemic and flood records preserve diagnostic and casualty limits',()=>{
 const ga=byId.get('in-1575-gaur-epidemic-abandonment'),fl=byId.get('in-1582-fatehpur-reservoir-flood'),relief=byId.get('in-1597-srinagar-food-relief');
 assert.match(ga.summary,/疫病/);assert.match(ga.summary,/没有.*诊断/);assert.equal(ga.placeId,'in-malda');assert.equal(fl.year,1582);assert.match(fl.summary,/未提供.*死亡总数/);assert.equal(relief.placeId,'in-srinagar');assert.match(relief.summary,/少雨/);assert.match(relief.summary,/不作为精确/);
});
test('Jahangir accession decrees distinguish orders from completed public works',()=>{
 const e=byId.get('in-1605-jahangir-twelve-ordinances');assert.match(e.summary,/十二项/);assert.match(e.summary,/医院/);assert.match(e.summary,/不声称.*建成/);
 for(const id of ['in-1605-jahangir-agra-accession','in-1605-jahangir-chain-of-justice','in-1605-jahangir-new-coin-weights']){const r=byId.get(id);assert.equal(r.year,1605);assert.equal(r.placeId,'in-agra');assert.equal(r.date,null);assert.match(r.sourceUrl,/011001081\/all#p-/);}
});
test('Expanded Mughal records retain a single India period and year-only map visibility',()=>{
 const list=records.filter(e=>e.periodId==='in-mughal');assert.equal(list.length,254);
 for(const e of list){assert.equal(periodForEvent(e,'IN')?.id,'in-mughal');for(const country of ['CN','JP','NP','LK'])assert.equal(periodForEvent(e,country),null);}
 const e=byId.get('in-1592-orissa-mansingh-campaign');assert.match(e.summary,/追述.*1590/);assert.equal(eventMatches(e,{countryCode:'IN',period:'in-mughal',scope:'year',year:1590},places),false);
});

test('Jahangir regnal winter records use the following civil year',()=>{
 for(const[id,y]of [['in-1610-army-crop-damage-compensation',1610],['in-1612-cooked-food-kitchens-expanded',1612],['in-1612-provincial-officials-royal-prerogatives',1612],['in-1614-ajmer-caldrons-poor-feeding',1614],['in-1615-mewar-amar-singh-settlement',1615],['in-1616-khadki-mughal-raid-burning',1616],['in-1617-mandu-restored-palaces-court-arrival',1617],['in-1618-jain-sewra-expulsion-farmans',1618],['in-1619-agra-plague-court-fatehpur-diversion',1619]]){
 const e=byId.get(id);assert.equal(e.year,y);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.match(e.locationNote,/纪年依据/);
 const filters={countryCode:'IN',period:'in-mughal',scope:'year',year:y};assert.equal(eventMatches(e,filters,places),true);assert.equal(eventMatches(e,{...filters,year:y-1},places),false);}
});
test('Mughal coin orders preserve distinct weight, commemorative and zodiac stages',()=>{
 const a=byId.get('in-1611-restore-original-coin-weight'),b=byId.get('in-1618-khambhat-double-weight-gold-silver-tankas'),c=byId.get('in-1618-zodiac-coin-design-ordered');assert.deepEqual([a.year,b.year,c.year],[1611,1618,1618]);assert.equal(a.placeId,'in-agra');assert.equal(b.placeId,'in-khambhat');assert.equal(c.placeId,'in-jhalod');assert.match(b.summary,/两倍/);assert.match(c.summary,/黄道星座/);assert.ok(c.sources.some(s=>s.url.endsWith('#fn-6')));
});
test('Nur Mahal marriage cites the manuscript annotation rather than an absent memoir statement',()=>{
 const e=byId.get('in-1611-jahangir-nur-mahal-marriage');assert.match(e.sourceTitle,/校注.*手稿批注/);assert.ok(e.sourceUrl.endsWith('#fn-192'));assert.equal(e.year,1611);assert.equal(e.approximate,undefined);const later=byId.get('in-1612-khurram-mumtaz-marriage');assert.equal(later.year,1612);assert.match(later.summary,/阿尔朱曼德|穆姆塔兹/);
});
test('Akbar tomb redesign, completion and Chashma Nur chronogram keep separate years',()=>{
 const early=byId.get('in-1608-sikandra-akbar-tomb-redesign'),done=byId.get('in-1613-sikandra-akbar-mausoleum-completed'),garden=byId.get('in-1615-ajmer-chashma-nur-water-garden');assert.deepEqual([early.year,done.year,garden.year],[1608,1613,1615]);assert.match(done.sourceUrl,/agra.nic.in/);assert.ok(garden.sources.some(s=>s.url.endsWith('#fn-270')));assert.equal(eventMatches(done,{countryCode:'IN',period:'in-mughal',scope:'year',year:1608},places),false);
});
test('Kokra campaign keeps its approximate date and regional reference limits',()=>{
 const e=byId.get('in-1616-kokra-diamond-mines-administration');assert.equal(e.approximate,true);assert.match(e.title,/（约）$/);assert.equal(e.placeId,'in-ranchi');assert.equal(e.endYear,undefined);assert.equal(e.date,null);assert.match(e.locationNote,/参考/);const added=records.filter(e=>e.year>=1606&&e.year<=1619);assert.equal(added.filter(e=>e.approximate).length,1);
});
test('New Jahangir references distinguish Indian homonyms and renamed Khadki',()=>{
 for(const[id,gid,lat,lon,state]of [['in-mandu','1263833',22.34125,75.4013,'35'],['in-dahod','1273687',22.83283,74.25986,'09'],['in-dhar','1272892',22.59373,75.29774,'35'],['in-mahemdavad','1264398',22.82359,72.75551,'09'],['in-sambhajinagar','1278149',19.87757,75.34226,'16']]){const p=places.get(id);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.regionCode,'IN-GEO-'+state);assert.equal(p.countryCode,'IN');assert.ok(p.sources[0].url.includes('/'+gid+'/'));}
 const p=places.get('in-sambhajinagar');assert.equal(p.name,'恰特拉帕蒂桑巴吉讷格尔');assert.ok(p.aliases.includes('Khadki')&&p.aliases.includes('Aurangabad'));assert.ok(p.sources.some(s=>s.url.includes('chhatrapatisambhajinagar.maharashtra.gov.in')));
});
test('Epidemic reports, selective releases and translation commissions retain scope',()=>{
 assert.match(byId.get('in-1618-ahmedabad-city-camp-fever-outbreak').summary,/不.*现代病原/);assert.match(byId.get('in-1618-kashmir-epidemic-fire-report').summary,/报告.*统计/);assert.match(byId.get('in-1618-ranthambore-prisoners-released').summary,/除涉杀人/);assert.match(byId.get('in-1618-mahemdavad-persian-quran-translation-order').locationNote,/没有.*推断.*已完稿/);assert.equal(byId.get('in-1618-aurangzeb-born-dahod').date,null);assert.ok(byId.get('in-1618-aurangzeb-born-dahod').sources.some(s=>s.url.endsWith('#fn-47a')));
});
test('Jahangir additions preserve India ownership and modern reference filters',()=>{
 const additions=records.filter(e=>e.periodId==='in-mughal');assert.equal(additions.length,254);assert.equal(records.filter(e=>e.periodId==='in-mughal').length,254);assert.equal(new Set(records.map(e=>e.placeId)).size,234);
 for(const e of additions){const p=places.get(e.placeId);assert.equal(p.countryCode,'IN');assert.equal(periodForEvent(e,'IN')?.id,'in-mughal');for(const c of ['CN','JP','NP','LK','PK','BD'])assert.equal(periodForEvent(e,c),null);assert.equal(eventMatches(e,{countryCode:'IN',city:e.placeId,scope:'year',year:e.year},places),true);}
});

test('Late Jahangir regnal months remain in their actual civil year',()=>{
 for(const[id,y]of [['in-1620-sirhind-garden-restoration-order',1620],['in-1620-khan-alam-persia-return-kalanaur',1620],['in-1621-nur-saray-palace-garden-completion-recorded',1621],['in-1621-agra-court-return-after-first-kashmir-tour',1621],['in-1622-itimad-daula-death-kangra-camp',1622],['in-1623-agra-rebel-prince-treasure-attempt',1623],['in-1624-agra-muqarrab-governor-after-itibar-death',1624],['in-1624-sayyid-bahwa-delhi-governor-return',1624]]){
 const e=byId.get(id);assert.equal(e.year,y);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.approximate,undefined);assert.match(e.locationNote,/纪年依据/);const f={countryCode:'IN',period:'in-mughal',scope:'year',year:y};assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:y-1},places),false);}
});
test('Memoir and Mutamad continuation sources remain separately attributed',()=>{
 for(const id of ['in-1619-agra-lashkar-administration-transfer','in-1621-jalandhar-meteorite-iron-court-weapons','in-1622-faujdari-cess-abolition-kashmir-court']){const e=byId.get(id);assert.match(e.sourceTitle,/贾汉吉尔本人/);assert.doesNotMatch(e.sourceTitle,/穆塔马德汗/);}
 for(const id of ['in-1623-agra-rebel-prince-treasure-attempt','in-1623-baluchpur-imperial-rebel-armies-battle','in-1624-orissa-shahjahan-entry-government-withdrawal-report']){const e=byId.get(id);assert.match(e.sourceTitle,/穆塔马德汗奉旨续记/);assert.doesNotMatch(e.sourceTitle,/贾汉吉尔本人/);}
});
test('Kangra surrender, administration and later mosque order retain separate stages',()=>{
 const a=byId.get('in-1620-kangra-fort-surrender-after-blockade'),b=byId.get('in-1620-kangra-fort-district-administration-established'),c=byId.get('in-1622-kangra-fort-inspection-mosque-order');assert.deepEqual([a.year,b.year,c.year],[1620,1620,1622]);assert.equal(a.placeId,'in-kangra');assert.equal(b.placeId,'in-kangra');assert.equal(c.placeId,'in-kangra');assert.match(a.summary,/受命将领/);assert.match(c.summary,/下令修建/);assert.ok(a.sources.some(s=>s.url.endsWith('#fn-185d')));
});
test('Kishtwar changing control and Sirhindi release remain chronological',()=>{
 assert.equal(byId.get('in-1619-ahmad-sirhindi-gwalior-imprisonment').placeId,'in-gwalior');assert.equal(byId.get('in-1620-ahmad-sirhindi-released-at-kashmir-court').placeId,'in-srinagar');const ids=['in-1620-kishtwar-revolt-garrison-collapse-reinforcements','in-1621-kishtwar-iradat-control-posts-restored','in-1622-kishtwar-renewed-revolt-iradat-expedition','in-1622-kunwar-singh-kishtwar-rule-restored'];assert.deepEqual(ids.map(id=>byId.get(id).year),[1620,1621,1622,1622]);for(let id of ids)assert.equal(byId.get(id).placeId,'in-kishtwar');assert.equal(byId.get('in-1620-kishtwar-ruler-court-conditional-release').placeId,'in-srinagar');
});
test('Indian reference homonyms choose Punjab Himachal Rajasthan and Jharkhand',()=>{
 for(const[id,gid,state,lat,lon]of [['in-kalanaur','1268475','23',32.01227,75.15063],['in-jalandhar','1268782','23',31.32556,75.57917],['in-nurpur-himachal','1261121','11',32.3015,75.88481],['in-chamba','1274848','11',32.55531,76.12647],['in-dhaulpur','1272805','24',26.69286,77.87968],['in-rajmahal','1258843','38',25.05303,87.83048],['in-bijapur','1275701','19',16.82442,75.71537]]){const p=places.get(id);assert.equal(p.regionCode,'IN-GEO-'+state);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.countryCode,'IN');assert.ok(p.sources[0].url.endsWith('/'+gid+'/'));}
 assert.equal(places.has('in-rajmahal-jharkhand'),false);assert.match(places.get('in-asirgarh').description,/废弃聚落/);
});
test('Court mothers and Mughal Armenian official keep distinct identities',()=>{
 const a=byId.get('in-1619-jagat-gosain-shahjahan-mother-death'),b=byId.get('in-1623-maryam-zamani-death-agra');assert.deepEqual([a.year,b.year],[1619,1623]);assert.match(a.summary,/沙贾汗之母|沙贾汗的母/);assert.match(b.summary,/母亲玛丽亚姆/);assert.match(byId.get('in-1621-zul-qarnain-sambhar-faujdar-appointment').summary,/亚美尼亚裔/);assert.match(byId.get('in-1621-abul-hasan-deccan-service-sirhind').summary,/同名宫廷画家/);
});
test('Natural observations and old garden repairs do not become spurious foundations',()=>{
 assert.match(byId.get('in-1620-kashmir-cherry-tree-planting-order').summary,/此前阿克巴时期/);assert.match(byId.get('in-1620-verinag-pool-pavilions-inspected-completed').summary,/王子时期/);assert.match(byId.get('in-1620-pampore-saffron-harvest-revenue-practices-recorded').summary,/不.*本年新设/);assert.match(byId.get('in-1620-jhelam-cooperative-boat-fishing-observed').summary,/非.*发明年/);const e=byId.get('in-1621-jalandhar-meteorite-iron-court-weapons');assert.equal(e.placeId,'in-jalandhar');assert.match(e.locationNote,/未指明村名/);assert.ok(e.sources.some(s=>s.url.endsWith('#fn-205')));assert.equal(e.date,null);
});
test('Deccan campaign phases and eastern reports retain their scope',()=>{
 const a=byId.get('in-1616-khadki-mughal-raid-burning'),b=byId.get('in-1621-khirki-second-mughal-campaign-destruction');assert.deepEqual([a.year,b.year],[1616,1621]);assert.equal(a.placeId,b.placeId);assert.match(byId.get('in-1623-agra-rebel-prince-treasure-attempt').summary,/不能写成阿格拉堡已被攻陷/);assert.match(byId.get('in-1624-machilipatnam-shahjahan-coastal-transit-report').summary,/不把港口过境写成占领/);const e=byId.get('in-1624-rajmahal-ibrahim-fort-defense-report');assert.equal(e.placeId,'in-rajmahal');assert.match(e.summary,/不提前叙写后续城池易手/);
});
test('Expanded Mughal year and city filters retain country ownership',()=>{
 const additions=records.filter(e=>e.periodId==='in-mughal'&&e.year>=1619&&e.year<=1624);assert.equal(additions.length,90);for(const e of additions){assert.equal(places.get(e.placeId).countryCode,'IN');assert.equal(periodForEvent(e,'IN')?.id,'in-mughal');for(const c of ['CN','JP','NP','LK','PK','BD'])assert.equal(periodForEvent(e,c),null);assert.equal(eventMatches(e,{countryCode:'IN',city:e.placeId,scope:'year',year:e.year},places),true);assert.equal(eventMatches(e,{countryCode:'IN',city:e.placeId,scope:'year',year:e.year+1},places),false);}
});

const ancient12=records.filter(e=>e.id.startsWith('in-ancient12-')),a12=key=>byId.get('in-ancient12-'+key);
test('ancient Indian inscriptions preserve uncertain chronology and one selected year',()=>{
 assert.equal(ancient12.length,33);assert.deepEqual(Object.fromEntries(['in-maurya','in-post-maurya','in-early-south','in-gupta'].map(id=>[id,ancient12.filter(e=>e.periodId===id).length])),{'in-maurya':19,'in-post-maurya':6,'in-early-south':2,'in-gupta':6});
 for(const e of ancient12){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,e.id.endsWith('rudradaman-sudarsana-repair')?undefined:true);assert.equal(e.title.endsWith('（约）'),!!e.approximate);
  for(const y of [e.year-1,e.year+1])assert.equal(eventMatches(e,{countryCode:'IN',period:e.periodId,scope:'year',year:y},places),false,e.id);assert.equal(eventMatches(e,{countryCode:'IN',period:e.periodId,scope:'year',year:e.year,city:e.placeId},places),true,e.id);
 }
 for(const [key,year]of [['maski-asoka-name',-255],['nanaghat-naganika-sacrifices',-64],['sittannavasal-kavuti-bed',-49],['rudradaman-sudarsana-repair',150],['hirahadagalli-garden-immunities',338],['pikira-village-grant',485],['bendiganahalli-ganga-land-gift',425]])assert.equal(a12(key).year,year,key);
});
test('undated Ashokan texts do not turn comparison dates or travel nights into exact dates',()=>{
 const queen=a12('queen-karuvaki-gift-register'),bhabru=a12('bhabru-seven-discourses'),rup=a12('rupnath-edict-dissemination'),sas=a12('sasaram-carved-proclamation');
 assert.match(queen.summary,/文本无纪年/);assert.match(queen.summary,/比较.*代表约年/);assert.match(queen.locationNote,/具体地点未/);
 assert.match(bhabru.summary,/该铭没有纪年/);assert.match(bhabru.summary,/检索对照/);assert.match(rup.summary,/巡行夜数/);assert.match(sas.summary,/巡行256夜/);
 assert.match(a12('topra-seven-pillar-edicts').summary,/第二十六年.*第二十七年/);
});
test('original inscription locations remain distinct from transported columns and museum custody',()=>{
 for(const [key,id,region]of [['topra-seven-pillar-edicts','in-topra-kalan','10'],['meerut-pillar-edicts','in-meerut','36'],['sopara-major-edict-fragments','in-sopara','16'],['champaran-pillar-series','in-lauriya-nandangarh','34'],['kirari-wooden-official-list','in-bilaspur-chhattisgarh','37']]){
  const e=a12(key);assert.equal(e.placeId,id);assert.equal(places.get(id).regionCode,'IN-GEO-'+region);
 }
 assert.match(a12('topra-seven-pillar-edicts').locationNote,/原地区.*迁到德里/);assert.match(a12('sopara-major-edict-fragments').locationNote,/原来.*移入孟买/);
 assert.equal(places.get('in-bilaspur-chhattisgarh').lat,22.08005);assert.equal(places.get('in-guwahati').regionCode,'IN-GEO-03');
});
test('Indian ancient regional copies and associated images form one substantive record each',()=>{
 for(const key of ['brahmagiri-isila-officials','champaran-pillar-series','sannati-separate-edicts','durjanpur-ramagupta-jain-images','ghosundi-hathibada-enclosure'])assert.equal(ancient12.filter(e=>e.id.endsWith(key)).length,1);
 assert.match(a12('brahmagiri-isila-officials').summary,/合并/);assert.match(a12('champaran-pillar-series').summary,/合并/);assert.match(a12('durjanpur-ramagupta-jain-images').summary,/合并/);assert.match(a12('sannati-separate-edicts').summary,/另一时期的再利用/);
});
test('land grants distinguish issuing centres, beneficiaries, findspots and limited immunities',()=>{
 const h=a12('hirahadagalli-garden-immunities'),p=a12('pikira-village-grant'),g=a12('bendiganahalli-ganga-land-gift');
 assert.equal(h.placeId,'in-kanchipuram');assert.match(h.summary,/24名婆罗门/);assert.match(h.locationNote,/发现地在卡纳塔克邦/);assert.match(h.summary,/不能.*全国废税/);
 assert.equal(p.placeId,'in-guntur');assert.match(p.summary,/排除原有供神田/);assert.match(p.locationNote,/供应人的居住地不等于出土地/);assert.match(p.summary,/只属于该项赠地/);
 assert.equal(g.placeId,'in-hoskote');assert.match(g.summary,/400至450年/);assert.match(g.locationNote,/发文营地、受赠村/);
});
test('Indian relic and cave inscriptions retain era disputes and avoid unproved political identities',()=>{
 const d=a12('devnimori-stupa-reliquary'),u=a12('umachal-balabhadra-cave');assert.equal(d.year,376);assert.match(d.summary,/376.*205/);assert.match(d.summary,/争议/);assert.match(d.locationNote,/不据此认定.*直接统治/);
 assert.equal(u.year,450);assert.match(u.summary,/是否同一人的假说未能证实/);assert.match(u.locationNote,/1955年.*不作古代/);
 assert.match(a12('kumrahar-mauryan-pillared-hall').summary,/具体用途.*争论/);assert.match(a12('kumrahar-mauryan-pillared-hall').locationNote,/发掘年份.*不是/);
});


const regional13=records.filter(e=>e.id.startsWith('in-regional13-'));
const r13=key=>byId.get('in-regional13-'+key);
test('India regional expansion keeps 33 independent actions and explicit comparison years',()=>{
 assert.equal(regional13.length,33);assert.equal(new Set(regional13.map(e=>e.id)).size,33);assert.equal(regional13.filter(e=>e.approximate).length,32);
 for(const e of regional13){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);if(e.approximate)assert.ok(e.title.endsWith('（约）'));const p=places.get(e.placeId);assert.equal(p.countryCode,'IN');assert.equal(periodForEvent(e,'IN')?.id,e.periodId);assert.equal(eventMatches(e,{countryCode:'IN',region:p.regionCode,city:p.id,scope:'year',year:e.year},places),true,e.id);assert.equal(eventMatches(e,{countryCode:'IN',city:p.id,scope:'year',year:e.year+1},places),false,e.id);}
 assert.equal(r13('sisupalgarh-earliest-occupation').year,-649);assert.equal(r13('sisupalgarh-brick-pottery-shift').year,-349);assert.equal(regional13.filter(e=>e.periodId==='in-northeast').length,17);assert.equal(regional13.filter(e=>e.periodId==='in-early-medieval').length,13);
});
test('Charaideo capital correction removes false continuous visibility from 1200 to 1299',()=>{
 const e=byId.get('in-1200-ahom-charaideo-capital');assert.equal(e.year,1253);assert.equal(e.date,null);assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);assert.equal(e.periodId,'in-northeast');assert.equal(e.placeId,'in-sibsagar');assert.match(e.sourceUrl,/archaeology\.assam\.gov\.in/);assert.ok(e.sources.some(s=>s.url==='https://whc.unesco.org/en/list/1711/'));
 for(const y of [1200,1228,1252,1254,1299])assert.equal(eventMatches(e,{countryCode:'IN',year:y,scope:'year'},places),false);assert.equal(eventMatches(e,{countryCode:'IN',year:1253,scope:'year'},places),true);
});
test('Northeast charters distinguish issuing region, discovery place and missing beneficiary data',()=>{
 const n=r13('nidhanpur-charter-renewal');assert.equal(n.placeId,'in-baharampur');assert.equal(places.get(n.placeId).regionCode,'IN-GEO-28');assert.match(n.locationNote,/发文地区/);assert.match(n.locationNote,/孟加拉国/);assert.match(n.summary,/重颁.*初授|确认.*初授/);
 assert.match(r13('dubi-royal-charter').summary,/末版失佚/);assert.match(r13('dubi-royal-charter').summary,/不将.*追述/);assert.match(r13('hayunthal-royal-genealogy').summary,/第一和第三版散失/);assert.match(r13('gachtal-gopala-plot-charter').summary,/受赠者.*不详/);assert.match(r13('gachtal-gopala-plot-charter').summary,/不直接解释为低劣农田/);
});
test('Vanamala and Balavarman separate different charters instead of copying one grant',()=>{
 const first=r13('vanamala-tezpur-village'),second=r13('vanamala-parvatiya-haposagrama');assert.match(first.summary,/第十九年/);assert.doesNotMatch(first.summary,/在位第九年/);assert.match(first.summary,/因多卡/);assert.match(second.summary,/珠宝摩尼/);assert.notEqual(first.id,second.id);assert.match(second.summary,/受赠人和土地不同/);
 assert.match(r13('balavarman-nowgong-student-land').summary,/第八年/);assert.match(r13('balavarman-howraghat-grant').summary,/第五年/);assert.match(r13('balavarman-nowgong-student-land').summary,/约990年/);
});
test('Regnal years and damaged numbers never become fabricated exact dates',()=>{
 const one=r13('indrapala-gauhati-rights'),two=r13('indrapala-guakuchi-land');assert.match(one.summary,/第八年/);assert.match(two.summary,/第二十一年/);assert.match(two.summary,/约1060年.*不能把两个王年/);
 const k=r13('dharmapala-khonamukh-merupataka');assert.match(k.summary,/两处产稻数额不一致/);assert.match(r13('dharmapala-subhankara-brothers').locationNote,/发现地点不明/);assert.match(r13('dharmapala-puspabhadra-endowment').summary,/没有在位年份/);
 const rock=r13('kanaibarasi-yavana-memorial');assert.equal(rock.year,1206);assert.equal(rock.approximate,undefined);assert.match(rock.summary,/零幸存者/);assert.match(r13('tezpur-river-order').summary,/829至830年/);
});
test('Kosala charters preserve reissued records and separate original gifts from confirmation',()=>{
 const leaf=r13('kurud-narendra-burnt-leaf'),confirm=r13('sirpur-sudeva-charter-confirmation');assert.match(leaf.summary,/棕榈叶/);assert.match(leaf.summary,/火灾烧毁/);assert.match(leaf.summary,/调查/);assert.match(confirm.summary,/先前赠给书吏/);assert.match(confirm.locationNote,/不能.*迁都/);
 assert.match(r13('malhar-jayaraja-officer-petition').summary,/留白或未刻/);assert.match(r13('malhar-jayaraja-officer-petition').summary,/擦除旧字/);assert.match(r13('malhar-jayaraja-eclipse-grant').summary,/不凭月食/);
});
test('Religious and educational endowments retain distinct recipients and limited fiscal rights',()=>{
 const students=r13('shivagupta-bardula-students'),monks=r13('shivagupta-alaka-buddhist-support');assert.match(students.summary,/十二名/);assert.equal(students.category,'文化');assert.match(monks.summary,/四方僧团/);assert.match(monks.summary,/本版没有直接刻王年/);assert.match(monks.locationNote,/营建先于本次授地/);
 assert.match(r13('shivagupta-lodhia-music-charity').summary,/乐舞祭祀/);assert.match(r13('shivagupta-junwani-land-exchange').summary,/置换/);assert.match(r13('shivagupta-kapalesvara-repairs').summary,/没有最后的王年日期段/);assert.match(r13('arang-sudeva-multiple-shares').summary,/一份半、一份和半份/);
});
test('Early urban archaeological records use ancient phases rather than excavation years or precise population estimates',()=>{
 const occupation=r13('sisupalgarh-earliest-occupation'),material=r13('sisupalgarh-brick-pottery-shift');assert.match(occupation.summary,/公元前七世纪/);assert.match(occupation.summary,/不是.*单一创建年/);assert.match(material.summary,/公元前四至三世纪/);assert.match(material.summary,/不是.*|不把.*|不据/);for(const e of [occupation,material]){assert.equal(e.approximate,true);assert.equal(e.periodId,'in-early-states');assert.equal(e.placeId,'in-bhubaneswar');assert.match(e.locationNote,/精确坐标|采样点/);}
});
