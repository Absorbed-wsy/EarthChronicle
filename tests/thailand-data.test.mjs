import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATEGORIES,eventMatches} from '../public/domain.js';
import {THAILAND_PERIODS,periodsForCountry,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p])),thailand=data.events.filter(e=>e.periodId?.startsWith('th-')),byId=new Map(thailand.map(e=>[e.id,e]));
test('Thailand has independent regional and national periods, sourced coordinates and date precision',()=>{
 assert.equal(periodsForCountry('TH'),THAILAND_PERIODS);assert.ok(thailand.length>=466);assert.deepEqual(periodBounds('all',2026,'TH'),[-19999,2026]);assert.ok(Object.isFrozen(THAILAND_PERIODS));
 const specific=THAILAND_PERIODS.filter(p=>!p.navigationOnly);assert.equal(specific.length,8);
 for(const p of THAILAND_PERIODS){assert.ok(Object.isFrozen(p));assert.equal(new URL(p.sourceURL).protocol,'https:');if(!p.navigationOnly)assert.ok(thailand.some(e=>e.periodId===p.id),p.id);}
 const ids=new Set(),titles=new Set(),sources=new Set(),regions=new Set();
 for(const e of thailand){
  assert.ok(!ids.has(e.id)&&!titles.has(e.title),e.id);ids.add(e.id);titles.add(e.title);sources.add(e.sourceUrl);
  assert.ok(CATEGORIES.includes(e.category)&&e.summary.length>=45&&e.locationNote,e.id);assert.equal(periodForEvent(e,'TH')?.id,e.periodId,e.id);assert.equal(specific.filter(p=>eventMatchesPeriod(e,p.id,'TH')).length,1,e.id);
  for(const c of ['CN','JP','KR','KP','MN','VN','LA','KH'])assert.equal(periodForEvent(e,c),null,e.id);
  const p=places.get(e.placeId);assert.equal(p?.countryCode,'TH',e.id);assert.ok(p.regionName&&p.regionCode&&p.lon>=97&&p.lon<=106&&p.lat>=5&&p.lat<=21);regions.add(p.regionCode);
  assert.equal(new URL(e.sourceUrl).protocol,'https:');assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle));
  if(e.date){const full=e.date.length===7?e.date+'-01':e.date;assert.equal(new Date(full).toISOString().slice(0,10),full);assert.equal(Number(full.slice(0,4)),e.year);assert.equal(e.precision,e.date.length===7?'month':'day');assert.ok(e.date<=data.meta.reviewedThrough);}else assert.equal(e.precision,'year');
 }
 assert.ok(sources.size>=40);assert.ok(regions.size>=14);
 for(const category of ['政治','战争','外交','经济','社会','科技','文化','灾害'])assert.ok(thailand.some(e=>e.category===category),category);
 assert.equal(data.meta.collections.filter(p=>p.countryCode==='TH').reduce((n,p)=>n+p.events,0),thailand.length);
});
test('Thailand constitutional transition uses civil dates and parallel ancient polities require declared ownership',()=>{
 for(const [date,id]of [['1932-06-23','th-rattanakosin'],['1932-06-24','th-constitutional']]){
  const e={year:1932,date};assert.equal(periodForEvent(e,'TH')?.id,id);assert.deepEqual(THAILAND_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'TH')).map(p=>p.id),[id]);
 }
 for(const year of [1350,1767,1782,1932])assert.equal(periodForEvent({year},'TH'),null);
 const founded=byId.get('th-1782-chakri-dynasty-founded');assert.equal(founded.date,'1782-04-06');assert.equal(eventMatchesPeriod(founded,'th-thonburi','TH'),false);
 const prior={year:1782,date:'1782-04-05',periodId:'th-thonburi'};assert.equal(periodForEvent(prior,'TH')?.id,'th-thonburi');
 const contradictory={...prior,date:'1782-04-06'};assert.notEqual(periodForEvent(contradictory,'TH')?.id,'th-thonburi');
 assert.equal(byId.get('th-1450-nan-lanna-conquest').periodId,'th-lanna');assert.equal(eventMatchesPeriod(byId.get('th-1450-nan-lanna-conquest'),'th-ayutthaya','TH'),false);
 assert.equal(byId.get('th-1250-phimai-city-walls').periodId,'th-early');assert.equal(eventMatchesPeriod(byId.get('th-1250-phimai-city-walls'),'th-sukhothai','TH'),false);
});
test('Thailand annual, place and region filters show only events active in the selected year',()=>{
 for(const e of thailand){const p=places.get(e.placeId),f={countryCode:'TH',region:p.regionCode,city:p.id,period:e.periodId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,f,places),true,e.id);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);assert.equal(eventMatches(e,{...f,year:(e.endYear??e.year)+1},places),false);
  assert.equal(eventMatches(e,{...f,query:p.name},places),true);assert.equal(eventMatches(e,{...f,countryCode:'KH',period:'all'},places),false);
 }
 const excavation=byId.get('th-1974-ban-chiang-joint-excavations');assert.equal(excavation.endYear,1975);assert.equal(eventMatches(excavation,{countryCode:'TH',scope:'year',year:1975},places),true);assert.equal(eventMatches(excavation,{countryCode:'TH',scope:'year',year:1976},places),false);
 assert.match(excavation.locationNote,/农汉县/);assert.match(places.get('th-pak-chong').description,/县域/);assert.notEqual(places.get('th-si-thep').lat,places.get('th-phimai').lat);
});
test('Thailand ancient chronologies, old calendar dates and ceremony dates retain their limits',()=>{
 const ancient=byId.get('th--1049-ban-non-wat-copper-metallurgy');assert.equal(ancient.date,null);assert.equal(ancient.endYear,undefined);assert.match(ancient.locationNote,/模型/);
 assert.match(byId.get('th-1292-ram-khamhaeng-inscription').summary,/争论/);assert.match(byId.get('th-1350-ayutthaya-capital-founded').locationNote,/1351/);assert.match(byId.get('th-1767-thonburi-capital-reconstruction').locationNote,/争论/);
 assert.equal(byId.get('th-1917-chulalongkorn-university').date,'1917-03-26');assert.match(byId.get('th-1917-chulalongkorn-university').locationNote,/1916/);
 assert.equal(byId.get('th-1934-thammasat-founding-act').date,'1934-03-17');assert.equal(byId.get('th-1934-thammasat-official-opening').date,'1934-06-27');
 assert.equal(byId.get('th-1940-national-banking-bureau-operation').date,'1940-05-13');assert.equal(byId.get('th-1942-central-bank-operation').date,'1942-12-11');assert.equal(byId.get('th-1964-chiang-mai-first-term').date,'1964-06-18');assert.equal(byId.get('th-1965-chiang-mai-royal-opening').date,'1965-01-24');
 assert.equal(byId.get('th-1946-un-membership').date,'1946-12-16');assert.equal(byId.get('th-2003-imf-early-repayment').date,'2003-07-31');assert.equal(byId.get('th-2025-marriage-equality-effective').date,'2025-01-23');
 assert.equal(byId.get('th-2011-chao-phraya-floods').year,2011);assert.equal(byId.get('th-2011-chao-phraya-floods').endYear,undefined);assert.equal(byId.get('th-2018-tham-luang-rescue-completed').date,'2018-07-10');assert.match(byId.get('th-2018-tham-luang-rescue-completed').locationNote,/湄赛/);
});

test('Thailand added campaigns use separate fall dates and keep contested battlefield traditions explicit',()=>{
 const war=byId.get('th-1563-bayinnaung-white-elephant-war');assert.equal(war.endYear,1564);
 assert.equal(eventMatches(war,{countryCode:'TH',scope:'year',year:1564},places),true);assert.equal(eventMatches(war,{countryCode:'TH',scope:'year',year:1565},places),false);
 const fall=byId.get('th-1569-ayutthaya-first-burmese-capture');assert.equal(fall.date,null);assert.match(fall.locationNote,/1568/);assert.notEqual(fall.id,byId.get('th-1767-ayutthaya-war-destruction').id);
 const battle=byId.get('th-1593-nong-sarai-battle');assert.match(battle.summary,/说法不一/);assert.match(battle.locationNote,/纪念日/);assert.equal(battle.date,null);assert.equal(places.get(battle.placeId).regionName,'素攀武里府');
 const expedition=byId.get('th-1599-naresuan-toungoo-expedition');assert.equal(expedition.endYear,1600);assert.match(expedition.locationNote,/实际作战地区位于今缅甸/);
 const eclipse=byId.get('th-1688-narai-solar-eclipse');assert.equal(eclipse.date,'1688-04-30');assert.match(eclipse.sourceTitle,/1688/);assert.match(eclipse.locationNote,/1686并非/);
 assert.equal(byId.get('th-1685-narai-lunar-eclipse').date,'1685-12-11');assert.equal(eclipse.placeId,'th-lop-buri');assert.equal(byId.get('th-1688-phetracha-seizes-authority').date,null);
});
test('Thailand preserves school and construction stages, calendar conversions and actual inscription provenance',()=>{
 assert.equal(byId.get('th-1964-khon-kaen-first-cohort').date,null);assert.equal(byId.get('th-1966-khon-kaen-act-published').date,'1966-01-25');assert.equal(byId.get('th-1967-khon-kaen-royal-inauguration').date,'1967-12-20');
 assert.equal(byId.get('th-1897-state-rail-ayutthaya-opening').date,'1897-03-26');assert.match(byId.get('th-1897-state-rail-ayutthaya-opening').locationNote,/2439/);assert.equal(byId.get('th-1922-northern-rail-chiang-mai').year,1922);
 assert.equal(byId.get('th-1957-bhumibol-dam-construction').endYear,1964);assert.equal(byId.get('th-1964-bhumibol-dam-first-power').date,'1964-05-17');assert.equal(byId.get('th-1995-lower-mae-ping-dam-opened').date,'1995-12-28');
 const dam=byId.get('th-1966-ubol-dam-inauguration');assert.equal(dam.date,'1966-03-14');assert.equal(places.get(dam.placeId).regionName,'孔敬府');assert.match(dam.locationNote,/乌汶府不同/);
 const inscription=byId.get('th-1357-inscription-three-inheritance');assert.equal(inscription.placeId,'th-kamphaeng-phet');assert.equal(inscription.periodId,'th-sukhothai');assert.equal(inscription.sources.length,2);assert.match(inscription.sourceUrl,/detail\/183/);
 assert.match(byId.get('th-1292-xian-gold-missive').locationNote,/未能精确定位/);assert.equal(byId.get('th-1349-xian-lohu-chronicle-merger').periodId,'th-early');
 assert.equal(eventMatchesPeriod(byId.get('th-1349-xian-lohu-chronicle-merger'),'th-sukhothai','TH'),false);
 assert.equal(byId.get('th-1351-daoyi-sumenbang-trade').endYear,undefined);assert.match(byId.get('th-1351-daoyi-sumenbang-trade').locationNote,/成书年/);
});

test('Thailand archaeological dates keep calibrated age uncertainty and modern regional references',()=>{
 const cliff=byId.get('th--9499-steep-cliff-foragers');assert.equal(cliff.date,null);assert.match(cliff.locationNote,/11609至11260 cal BP/);assert.match(cliff.summary,/研究假说/);
 const spirit=byId.get('th--7999-spirit-cave-early-holocene');assert.match(spirit.locationNote,/GaK-1846木炭/);assert.match(spirit.summary,/库效应/);
 const ceramic=byId.get('th--6389-steep-cliff-pottery-date');assert.match(ceramic.locationNote,/6390±670/);assert.equal(ceramic.endYear,undefined);
 const banyan=byId.get('th--2349-banyan-valley-later-pottery');assert.match(banyan.locationNote,/2350±230/);assert.equal(places.get(banyan.placeId).regionName,'夜丰颂府');
 const mine=byId.get('th--999-phu-lon-copper-mine');assert.equal(places.get(mine.placeId).regionName,'廊开府');assert.match(mine.summary,/不能将矿址直接等同/);
 const port=byId.get('th--99-phu-khao-thong-western-port');assert.match(port.locationNote,/公元前200年至公元20年/);assert.equal(places.get(port.placeId).regionName,'拉廊府');
 for(const id of ['th--299-khao-sam-kaeo-port-crafts','th--299-khao-sam-kaeo-crop-economy'])assert.equal(byId.get(id).periodId,'th-prehistory');
});
test('Thailand distinguishes event dates, effective laws, time zones and campus geography',()=>{
 const capture=byId.get('th-1775-chiang-mai-captured-by-allies');assert.equal(capture.date,'1775-01-15');assert.match(capture.locationNote,/1774为出征/);assert.equal(capture.periodId,'th-lanna');
 assert.equal(byId.get('th-1796-kawila-chiang-mai-resettlement').periodId,'th-rattanakosin');assert.match(byId.get('th-1796-kawila-chiang-mai-resettlement').summary,/强制迁民/);
 const law=byId.get('th-1905-debt-slavery-reform-issued');assert.equal(law.date,'1905-03-31');assert.match(law.locationNote,/四月一日起施行/);assert.match(law.summary,/地区例外/);
 const sat=byId.get('th-1993-thaicom-one-launched');assert.equal(sat.date,'1993-12-18');assert.match(sat.locationNote,/01:27 UTC/);assert.match(sat.locationNote,/实际发射地在南美洲/);
 assert.equal(byId.get('th-1968-prince-songkla-founding-act').date,'1968-03-13');assert.equal(byId.get('th-1968-pattani-campus-arrival').date,'1968-11-09');assert.equal(byId.get('th-1968-prince-songkla-founding-act').placeId,'th-pattani');
 const airport=byId.get('th-2006-suvarnabhumi-airport-open');assert.equal(airport.date,'2006-09-28');assert.equal(places.get(airport.placeId).regionName,'北榄府');
 assert.equal(byId.get('th-1992-crc-accession').date,'1992-03-27');assert.equal(byId.get('th-2024-disappearance-convention-ratification').date,'2024-05-14');
 assert.equal(byId.get('th-1941-january-new-year-effective').date,'1941-01-01');assert.equal(byId.get('th-1999-bts-commercial-open').date,'1999-12-05');
});

test('Thailand separates inscription dates, retrospective accounts and similarly named sites',()=>{
 const memory=byId.get('th-1350-sichum-dynastic-memory');assert.equal(memory.periodId,'th-sukhothai');assert.match(memory.locationNote,/1341至1367/);
 const mango=byId.get('th-1361-mango-monastic-ordination-record');assert.equal(mango.date,null);assert.match(mango.locationNote,/1905/);
 const yuen=byId.get('th-1369-sumana-at-lamphun');assert.equal(places.get(yuen.placeId).regionName,'南奔府');assert.equal(yuen.periodId,'th-lanna');
 assert.match(byId.get('th-1384-chang-lom-donor-inscription').locationNote,/不是西萨查纳莱/);
 const build=byId.get('th-1412-sor-sak-temple-construction');assert.equal(build.endYear,1417);assert.equal(build.periodId,'th-sukhothai');
 const red=byId.get('th-1406-red-forest-historical-inscription');assert.match(red.locationNote,/实际汇编可能稍后/);assert.match(red.summary,/原始出土地不明/);
 assert.match(byId.get('th-1471-chiang-man-laterite-rebuild').summary,/1581年寺碑/);
 const letter=byId.get('th-1680-singora-siege-dutch-letter');assert.equal(letter.date,'1680-03');assert.equal(letter.precision,'month');assert.match(letter.locationNote,/未经解决/);
 assert.match(byId.get('th-1511-patani-after-melaka-fall').locationNote,/今马来西亚/);
 assert.match(byId.get('th-1956-ratchaburana-crypt-excavation').locationNote,/1957/);
});
test('Thailand wartime railway, water works and ports preserve geographic and chronological distinctions',()=>{
 const transfer=byId.get('th-1943-f-force-ban-pong-transfer');assert.equal(transfer.date,'1943-04');assert.equal(places.get(transfer.placeId).regionName,'叻丕府');
 const join=byId.get('th-1943-railway-sections-joined');assert.equal(join.date,'1943-10');assert.equal(join.precision,'month');assert.equal(join.placeId,'th-sangkhla-buri');assert.match(join.locationNote,/十六、十七/);
 assert.equal(byId.get('th-1957-nam-tok-railway-reopening').placeId,'th-sai-yok');assert.match(byId.get('th-1957-nam-tok-railway-reopening').summary,/没有因此重新贯通/);
 const dam=byId.get('th-1979-khao-laem-dam-construction');assert.equal(dam.endYear,1984);assert.match(dam.locationNote,/不是Mekong/);assert.equal(places.get(dam.placeId).regionName,'北碧府');
 assert.equal(byId.get('th-1986-khao-laem-dam-inauguration').date,'1986-01-09');assert.equal(byId.get('th-1998-hellfire-memorial-centre-open').date,'1998-04-24');
 assert.equal(byId.get('th-1951-port-authority-established').date,'1951-05');assert.equal(byId.get('th-1947-bangkok-port-postwar-operation').date,null);
 const u=byId.get('th-2001-universal-coverage-scheme-launch');assert.match(u.summary,/逐步推进/);assert.equal(u.periodId,'th-constitutional');
 for(const id of ['th-lamphun','th-kanchanaburi','th-sangkhla-buri','th-ban-pong','th-sai-yok','th-thong-pha-phum'])assert.equal(places.get(id).countryCode,'TH');
});

test('Thailand finance and administrative records distinguish institutional origins, laws and operation',()=>{
 assert.equal(byId.get('th-1962-private-stock-market-launch').date,'1962-07');assert.equal(byId.get('th-1974-securities-exchange-act').date,'1974-05');assert.equal(byId.get('th-1975-set-first-trading-day').date,'1975-04-30');
 assert.equal(byId.get('th-1913-savings-office-established').periodId,'th-rattanakosin');assert.equal(byId.get('th-1947-government-savings-bank-operation').date,'1947-04-01');assert.equal(byId.get('th-1966-baac-official-open').date,'1966-11-01');
 assert.equal(byId.get('th-1993-exim-founding-law-effective').date,'1993-09-07');assert.equal(byId.get('th-1994-exim-starts-business').date,'1994-02-17');
 for(const [id,end]of [['th-1977-integrated-agricultural-credit',1986],['th-1987-farm-marketing-cooperatives-stage',1996],['th-1961-first-economic-development-plan',1966]])assert.equal(byId.get(id).endYear,end);
 assert.equal(byId.get('th-1993-labour-ministry-established').date,'1993-09-23');assert.equal(byId.get('th-1997-baht-managed-float').date,'1997-07-02');assert.equal(byId.get('th-2000-inflation-targeting-adopted').date,'2000-05-23');
 const takeover=byId.get('th-1947-postwar-military-coup');assert.equal(takeover.precision,'month');assert.equal(takeover.date,'1947-11');assert.equal(byId.get('th-1948-phibun-postwar-premiership').date,'1948-04-08');
 assert.match(byId.get('th-1950-indochina-government-recognition').summary,/越南国/);assert.equal(byId.get('th-1951-quiet-coup-constitution-abrogation').date,'1951-11-29');
});
test('Thailand regional health and industry records preserve study designs, intervals and geography',()=>{
 const follow=byId.get('th-2000-lampang-hiv-followup-cohort');assert.equal(follow.date,'2000-07-06');assert.match(follow.summary,/不能称作随机试验/);assert.equal(follow.placeId,'th-lampang');
 const pilot=byId.get('th-2002-lampang-gpo-vir-pilot');assert.equal(pilot.date,'2002-04');assert.equal(pilot.precision,'month');
 assert.equal(byId.get('th-2006-public-use-hiv-medicine-licensing').endYear,2007);
 const port=byId.get('th-1991-laem-chabang-port-opening');assert.equal(port.date,'1991-01-21');assert.equal(places.get(port.placeId).regionName,'春武里府');assert.match(byId.get('th-1997-laem-chabang-million-containers').locationNote,/不等于实际自然箱/);
 const power=byId.get('th-1977-bang-pakong-power-construction');assert.equal(power.endYear,1981);assert.equal(places.get(power.placeId).regionName,'北柳府');assert.equal(byId.get('th-1985-bang-pakong-power-inauguration').date,'1985-01-08');
 assert.equal(byId.get('th-1960-tourist-organisation-open').date,'1960-03-18');assert.equal(byId.get('th-1979-tourism-authority-act-published').date,'1979-05-04');assert.equal(byId.get('th-1985-pttep-established').date,'1985-06-20');
});

test('Thailand public services preserve provincial locations and distinct law, operation and merger dates',()=>{
 assert.equal(byId.get('th-1914-bangkok-water-service').date,'1914-11-14');assert.equal(byId.get('th-1967-metropolitan-waterworks-established').date,'1967-08-16');
 for(const [id,region]of [['th-1960-nonthaburi-water-service','暖武里府'],['th-1957-chao-phraya-barrage','猜纳府'],['th-1979-kamphaeng-saen-campus','佛统府'],['th-1987-ratchaprapha-dam-inauguration','素叻府']])assert.equal(places.get(byId.get(id).placeId).regionName,region);
 assert.equal(byId.get('th-1975-agricultural-land-reform-law').date,'1975-03-05');assert.equal(byId.get('th-1975-agricultural-land-reform-office').date,'1975-03-06');
 assert.equal(byId.get('th-1990-ubon-independent-university').date,'1990-07-30');assert.match(byId.get('th-1988-ubon-first-programmes').locationNote,/孔敬/);
 assert.equal(byId.get('th-1977-sirikit-dam-inauguration').date,'1977-03-04');assert.equal(byId.get('th-1972-sirikit-dam-completion').year,1972);
 assert.match(byId.get('th-1975-thailand-china-diplomatic-relations').locationNote,/北京/);
});
test('Thailand archaeological craft, mobility and excavation records preserve estimated eras and evidence limits',()=>{
 const port=byId.get('th--299-khao-sek-port-settlement');assert.equal(port.endYear,-199);assert.equal(port.placeId,'th-lang-suan');assert.equal(port.precision,'year');
 const glass=byId.get('th--399-khao-sek-glass-working');assert.equal(glass.endYear,-300);assert.match(glass.summary,/加工不等同于/);
 const iron=byId.get('th--299-khao-sek-iron-workshop');assert.match(iron.summary,/锻造/);assert.match(iron.summary,/不能/);
 const migration=byId.get('th--1999-khok-phanom-di-mobility-shift');assert.match(migration.summary,/假说/);assert.match(migration.sourceTitle,/CC BY 4.0/);
 const wealth=byId.get('th--1699-khok-phanom-di-wealthy-burial');assert.match(wealth.summary,/未经证明/);assert.equal(places.get(wealth.placeId).regionName,'春武里府');
 assert.equal(byId.get('th-2013-khao-sek-excavation').endYear,2014);assert.equal(byId.get('th-2009-nakhon-pathom-roof-tiles').endYear,2010);
});

test('Thailand court and local records distinguish archival dates, travel dates and modern references',()=>{
 const received=byId.get('th-1735-sappan-payment-letter');assert.equal(received.date,'1735-03-22');assert.match(received.locationNote,/收到/);assert.match(received.summary,/虫损/);
 const pilgrimage=byId.get('th-1737-buddha-footprint-pilgrimage');assert.equal(pilgrimage.date,'1737-03-06');assert.equal(places.get(pilgrimage.placeId).regionName,'沙拉武里府');assert.match(pilgrimage.locationNote,/不是到达/);
 assert.equal(byId.get('th-1738-aphainuchit-funeral').date,'1738-01-29');assert.match(byId.get('th-1703-sua-succession').summary,/记载不一/);
 const mon=byId.get('th-1774-mon-refugee-thonburi-wave');assert.equal(mon.endYear,1775);assert.equal(mon.periodId,'th-thonburi');
 assert.equal(places.get(byId.get('th-1663-sam-khok-mon-refugees').placeId).regionName,'巴吞他尼府');assert.equal(places.get(byId.get('th-1917-mae-suai-district-officer').placeId).regionName,'清莱府');
 assert.match(byId.get('th-1918-siamese-art-cagliari-museum').locationNote,/意大利卡利亚里/);assert.match(byId.get('th-1892-military-college-buildings-documented').summary,/见报日/);
});
test('Thailand census and constitutional records preserve scope and distinct contemporary events',()=>{
 const partial=byId.get('th-1904-inner-monthon-census');assert.equal(partial.date,'1904-01');assert.equal(partial.precision,'month');assert.match(partial.summary,/未包括曼谷/);
 const nationwide=byId.get('th-1909-first-national-census');assert.equal(nationwide.endYear,1910);assert.match(nationwide.summary,/修订/);
 assert.equal(byId.get('th-1959-interim-charter-1959').date,'1959-01-28');assert.equal(byId.get('th-1968-constitution-1968').date,'1968-06-20');assert.equal(byId.get('th-1997-constitution-1997').date,'1997-10-11');
 assert.equal(byId.get('th-1951-manhattan-rebellion').date,'1951-06-29');assert.equal(byId.get('th-1951-quiet-coup-constitution-abrogation').date,'1951-11-29');assert.match(byId.get('th-1951-manhattan-rebellion').locationNote,/同一艘船/);
 assert.equal(byId.get('th-1950-us-economic-assistance-agreement').date,'1950-09-19');assert.equal(byId.get('th-1950-us-military-assistance-agreement').date,'1950-10-17');
 const trials=byId.get('th-1946-war-criminals-act-retroactivity');assert.equal(trials.date,'1946-03-23');assert.match(trials.summary,/国际司法免责/);
 assert.equal(byId.get('th-1935-japanese-secret-alliance-denial').date,'1935-05-04');assert.match(byId.get('th-1935-prajadhipok-abdication').locationNote,/海外/);
});

test('Thailand epigraphy distinguishes inscription dates, royal retrospection and uncertain provenances',()=>{
 const early=byId.get('th-600-si-thep-ye-dhamma');assert.equal(early.date,null);assert.match(early.locationNote,/约年/);assert.equal(places.get(early.placeId).id,'th-si-thep');
 const sema=byId.get('th-775-srivijaya-sema-muang-shrines');assert.match(sema.summary,/原始位置仍有争议/);assert.match(sema.locationNote,/原始刻立地未定/);
 const ika=byId.get('th-868-bo-ika-linga-dedication');assert.match(ika.summary,/不能因此认定两面/);assert.equal(ika.placeId,'th-sung-noen');
 assert.match(byId.get('th-1055-phanom-wan-assets-record').summary,/不是早已去世/);assert.equal(byId.get('th-989-phanom-rung-land-dedication').periodId,'th-early');
 const border=byId.get('th-1560-si-song-rak-alliance-oath');assert.equal(border.placeId,'th-dan-sai');assert.equal(border.periodId,'th-ayutthaya');assert.match(border.locationNote,/不表示当时/);
 assert.match(byId.get('th-1695-that-phanom-silver-appointment').locationNote,/澜沧王廷/);
});
test('Thailand archaeology keeps discovery, transfer, repair and exhibition dates distinct',()=>{
 assert.equal(byId.get('th-1957-u-thong-copper-museum-transfer').date,'1957-09-20');assert.match(byId.get('th-1957-u-thong-copper-museum-transfer').summary,/不是古代刻写年/);
 assert.equal(byId.get('th-1979-chong-khoi-rock-inscription-discovery').date,'1979-09-10');
 const restore=byId.get('th-1971-phanom-rung-restoration-start');assert.equal(restore.endYear,1988);assert.equal(byId.get('th-1988-phanom-rung-historical-park-opening').date,'1988-05-21');
 assert.equal(byId.get('th-1975-that-phanom-stupa-collapse').date,'1975-08-11');
 const find=byId.get('th-2019-wat-phra-ngam-inscription-discovery'),display=byId.get('th-2020-wat-phra-ngam-conservation-display');assert.equal(find.date,'2019-10');assert.equal(display.date,'2020-08-19');assert.equal(find.placeId,'th-nakhon-pathom');assert.equal(display.placeId,'th-bangkok');
 assert.match(byId.get('th-2019-muang-tam-new-inscription-survey').summary,/仍待释读/);
});

test('Thailand regional texts use the correct chronology and keep provenance distinct',()=>{
 const phrae=byId.get('th-1359-lithai-phrae-expedition');assert.equal(phrae.endYear,1360);assert.equal(phrae.placeId,'th-phrae');assert.match(phrae.locationNote,/汇编/);
 const khema=byId.get('th-1536-khema-prince-ordination');assert.equal(khema.periodId,'th-ayutthaya');assert.match(khema.summary,/受损/);
 const lamp=byId.get('th-1796-kawila-lampang-luang-patronage');assert.equal(lamp.year,1796);assert.equal(lamp.periodId,'th-rattanakosin');assert.match(lamp.summary,/1158/);assert.equal(lamp.placeId,'th-ko-kha');
 assert.equal(byId.get('th-1503-lampang-luang-viharn-costs').year,1503);assert.match(byId.get('th-1496-si-bun-ruang-land-and-labour').locationNote,/原寺址未定/);
 assert.match(byId.get('th-1557-saen-luang-temple-service-decree').summary,/不能把1558年/);
});
test('Thonburi manuscripts preserve attribution uncertainty and medical chronology stays separate',()=>{
 const manual=byId.get('th-1775-thonburi-meditation-manual');assert.equal(manual.periodId,'th-thonburi');assert.match(manual.summary,/不能据此确认/);
 assert.match(byId.get('th-1776-lakkhana-bun-manuscript').summary,/不能认定/);
 assert.equal(byId.get('th-1769-nakhon-si-thammarat-conquest').placeId,'th-nakhon-si-thammarat');assert.equal(byId.get('th-1776-nu-restored-nakhon-rule').year,1776);
 assert.equal(byId.get('th-1890-siriraj-medical-classes-start').date,'1890-09-05');assert.equal(byId.get('th-1893-siriraj-first-medical-graduates').date,'1893-05-01');
 assert.equal(byId.has('th-1896-siriraj-midwifery-nursing-school'),false);assert.equal(thailand.filter(e=>e.id==='th-1896-nursing-midwifery-school').length,1);assert.equal(byId.get('th-1968-phayathai-dental-faculty-founded').date,'1968-06-07');
 assert.equal(byId.get('th-1965-national-theatre-opening').date,'1965-12-23');
});

test('Thailand election stages, women representation and constitutional dates stay distinct',()=>{
 assert.equal(byId.get('th-1933-parliament-closed-by-decree').date,'1933-04-01');
 assert.equal(byId.get('th-1933-pahol-premier-appointed').date,'1933-06-21');
 assert.equal(byId.get('th-1933-first-indirect-election').date,'1933-11-15');assert.match(byId.get('th-1933-first-indirect-election').summary,/间接/);
 assert.equal(byId.get('th-1937-first-direct-election').date,'1937-11-07');assert.match(byId.get('th-1937-first-direct-election').summary,/直接/);
 const woman=byId.get('th-1949-first-woman-mp-elected');assert.equal(woman.date,'1949-06-05');assert.equal(woman.placeId,'th-ubon-ratchathani');assert.match(woman.summary,/此前已享有选举资格/);
 assert.equal(byId.get('th-2007-constitution-referendum-2007').date,'2007-08-19');assert.equal(byId.get('th-2007-constitution-2007-enacted').date,'2007-08-24');
});
test('Thailand astronomy and medical records retain separate locations and uncertain time precision',()=>{
 assert.equal(byId.get('th-1868-wagor-total-eclipse').placeId,'th-prachuap-khiri-khan');
 const coast=byId.get('th-1875-laem-chao-lai-total-eclipse');assert.equal(coast.date,'1875-04-06');assert.equal(coast.placeId,'th-phetchaburi');assert.match(coast.summary,/另在曼谷/);
 const rehab=byId.get('th-1985-mckean-integrated-rehabilitation');assert.equal(rehab.approximate,true);assert.equal(rehab.precision,'year');
 const returned=byId.get('th-1945-nakhon-pathom-hospital-postwar-return');assert.equal(returned.precision,'month');assert.equal(returned.date,'1945-11');
 const control=byId.get('th-1942-mccormick-wartime-state-control');assert.equal(control.endYear,1946);assert.match(control.locationNote,/结束年份仍为1945/);
 assert.equal(byId.get('th-1974-payap-college-authorised').date,'1974-03-21');assert.equal(byId.get('th-1984-payap-university-status').date,'1984-07-25');
});

test('Thailand older narratives preserve comparative chronologies and overlapping royal centres',()=>{
 const dual=byId.get('th-1463-trailok-phitsanulok-residence');assert.equal(dual.placeId,'th-phitsanulok');assert.match(dual.summary,/南北/);assert.equal(dual.periodId,'th-ayutthaya');
 assert.equal(byId.get('th-1590-naresuan-accession-chronology').periodId,'th-ayutthaya');
 assert.equal(byId.get('th-1477-lanna-scripture-revision-council').approximate,true);
 const siege=byId.get('th-1785-thalang-defense-against-burmese');assert.equal(siege.approximate,true);assert.equal(siege.endYear,1786);assert.equal(siege.placeId,'th-thalang');
 assert.match(byId.get('th-1777-thalang-thai-letter-to-light').summary,/尚未掌管槟城/);
 assert.equal(byId.get('th-1937-british-treaty-judicial-autonomy').date,'1937-11-23');assert.match(byId.get('th-1937-british-treaty-judicial-autonomy').locationNote,/1938年二月十九日/);
});
test('Thailand regional violence retains separate places and stages instead of merging casualties',()=>{
 const red=['ratchaprasong-dispersal','ubon-provincial-hall-violence','udon-thani-public-buildings-arson','khon-kaen-provincial-hall-arson'].map(id=>byId.get('th-2010-'+id));
 assert.equal(new Set(red.map(e=>e.placeId)).size,4);assert.ok(red.every(e=>e.date==='2010-05-19'));
 const tak=byId.get('th-2004-tak-bai-protest-detention-deaths');assert.equal(tak.placeId,'th-tak-bai');assert.match(tak.locationNote,/押运目的地在北大年/);
 const market=byId.get('th-2007-saba-yoi-market-bombing');assert.equal(market.date,'2007-05-28');assert.equal(market.placeId,'th-saba-yoi');
 assert.equal(byId.get('th-2004-krue-se-mosque-assault').placeId,'th-pattani');
});

test('Thailand media dates distinguish distribution, legal creation and public access',()=>{
 assert.equal(byId.get('th-1923-suwanna-thai-actor-feature').date,'1923-06-23');
 assert.match(byId.get('th-1923-suwanna-thai-actor-feature').summary,/二十二日/);
 assert.equal(byId.get('th-1927-chok-song-chan-release').date,'1927-07-30');
 assert.equal(byId.get('th-1952-thai-television-company-incorporation').date,'1952-11-10');
 assert.equal(byId.get('th-1977-mass-communication-organization-created').date,'1977-03-25');
 assert.equal(byId.get('th-1984-national-film-archive-approved').date,'1984-09-07');
 assert.equal(byId.get('th-1987-film-archive-public-services').year,1987);
 assert.equal(byId.get('th-1997-film-archive-salaya-relocation').placeId,'th-salaya');
});
test('Thailand temple and road evidence separates ancient estimates from modern interventions',()=>{
 for(const id of ['wat-kaew-mahayana-monument','chaiya-prathat-early-monument']){
  const e=byId.get('th-800-'+id);assert.equal(e.approximate,true);assert.equal(e.endYear,950);assert.equal(e.placeId,'th-chaiya');assert.equal(e.periodId,'th-early');
 }
 assert.equal(byId.get('th-1976-wat-kaew-excavation-campaign').endYear,1980);
 const repair=byId.get('th-1896-chaiya-prathat-community-restoration');assert.equal(repair.endYear,1910);assert.equal(repair.approximate,true);
 const road=byId.get('th-1934-doi-suthep-community-road');assert.equal(road.date,'1934-11-09');assert.equal(road.endYear,1935);
 assert.equal(byId.get('th-1928-4pj-broadcasting-trials').periodId,'th-rattanakosin');
});

test('Thailand disasters distinguish regional impacts, reference points and measured earthquake parameters',()=>{
 const quake=byId.get('th-2014-mae-lao-earthquake');assert.equal(quake.date,'2014-05-05');assert.equal(quake.placeId,'th-mae-lao');assert.match(quake.summary,/6.1/);assert.match(quake.summary,/模型预估/);assert.match(quake.locationNote,/19.66/);
 const surge=byId.get('th-1962-harriet-talumphuk-storm-surge');assert.equal(surge.date,'1962-10-25');assert.equal(surge.placeId,'th-pak-phanang');assert.match(surge.summary,/二十六日/);
 assert.equal(byId.get('th-1993-kader-toy-factory-fire').placeId,'th-sam-phran');assert.equal(byId.get('th-2000-hat-yai-songkhla-rain-flood').placeId,'th-hat-yai');
 assert.match(byId.get('th-1989-gay-gulf-peninsula-landfall').summary,/全程伤亡/);assert.match(byId.get('th-1997-linda-southern-wind-flood').summary,/不据.*登陆/);
});
test('Thailand public services separate proposal, network completion and warning institution establishment',()=>{
 assert.equal(byId.get('th-1934-provincial-hospital-plan-approved').date,'1934-07-20');assert.equal(byId.get('th-1946-postwar-provincial-hospital-revival').date,'1946-04-30');assert.equal(byId.get('th-1954-provincial-hospital-network-complete').year,1954);assert.match(byId.get('th-1954-provincial-hospital-network-complete').summary,/不等于全民/);
 assert.equal(byId.get('th-2002-disaster-prevention-department').precision,'year');assert.equal(byId.get('th-2005-national-disaster-warning-center').precision,'month');assert.equal(byId.get('th-2005-national-disaster-warning-center').date,'2005-05');
 assert.equal(byId.get('th-1518-luso-siamese-treaty').periodId,'th-ayutthaya');assert.equal(byId.get('th-1963-chiang-mai-wwssn-station').year,1963);
});
