import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HISTORY_PERIODS,eventMatchesPeriod,periodForEvent,periodBounds} from '../public/history-navigation.js';
import {eventMatches,yearLabel} from '../public/domain.js';
const data=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
const places=new Map(data.places.map(p=>[p.id,p]));
const early=data.events.filter(e=>['cn-prehistory','xia-shang','western-zhou'].includes(e.periodId));
test('Chinese early corpus adds distinct archaeological and documentary milestones without invented civil dates',()=>{
 assert.equal(early.length,213);
 for(const [id,count]of [['cn-prehistory',115],['xia-shang',41],['western-zhou',57]])assert.equal(early.filter(e=>e.periodId===id).length,count,id);
 const sources=new Set();
 for(const e of early){
  assert.equal(e.date,null,e.id);assert.equal(e.precision,'year',e.id);
  assert.ok(e.summary.length>=60&&e.locationNote,e.id);assert.ok(places.has(e.placeId),e.id);
  assert.equal(places.get(e.placeId).countryCode,'CN',e.id);
  assert.equal(periodForEvent(e,'CN')?.id,e.periodId,e.id);
  assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1,e.id);
  if(e.year<-840)assert.match(e.title,/（约）$/,e.id);
  assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle));sources.add(e.sourceUrl);
  const f={countryCode:'CN',period:e.periodId,city:e.placeId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,f,places),true,e.id);
  for(const year of [e.year-1,e.year+1])assert.equal(eventMatches(e,{...f,year},places),false,e.id);
 }
 assert.ok(sources.size>=70);
 assert.equal(yearLabel(data.events.find(e=>e.id==='cn-bce9000-shangshan-rice-settlement').year),'公元前 9000 年');
 assert.match(data.events.find(e=>e.id==='cn-bce6000-kuahuqiao-canoe').summary,/2002.*发现/);
 assert.match(data.events.find(e=>e.id==='cn-bce6400-jiahu-incised-tortoise').summary,/不能直接称为.*成熟/);
 assert.match(data.events.find(e=>e.id==='cn-bce8000-cishan-millet-storage').summary,/后续研究.*讨论/);
});
test('Western to Eastern Zhou navigation splits 771 and 770 BCE and keeps archaeological ownership explicit',()=>{
 const end=data.events.find(e=>e.id==='cn-bce771-western-zhou-royal-crisis'),start=data.events.find(e=>e.id==='spring-autumn-warring-bce770-eastward');
 assert.equal(end.year,-770);assert.equal(start.year,-769);
 assert.equal(eventMatchesPeriod(end,'western-zhou'),true);assert.equal(eventMatchesPeriod(end,'spring-autumn-warring'),false);
 assert.equal(eventMatchesPeriod(start,'western-zhou'),false);assert.equal(eventMatchesPeriod(start,'spring-autumn-warring'),true);
 assert.deepEqual(periodBounds('all',2026,'CN'),[-17999,2026]);
 const conquest=data.events.find(e=>e.id==='cn-bce1046-muye-wuwang-conquest');
 assert.equal(eventMatchesPeriod(conquest,'western-zhou'),true);assert.equal(eventMatchesPeriod(conquest,'xia-shang'),false);
});
test('new archaeological map references retain published precision and distinguish findspots from narrated locations',()=>{
 const n=places.get('niuheliang-site'),s=places.get('sanxingdui-site'),c=places.get('cishan-site');
 assert.ok(Math.abs(n.lat-(41+16/60+15/3600))<1e-6);assert.ok(Math.abs(n.lon-(119+27/60+9/3600))<1e-6);
 assert.ok(Math.abs(s.lat-(30+59/60+38/3600))<1e-6);assert.ok(Math.abs(c.lon-(114+6/60+43/3600))<1e-6);
 for(const id of ['aohan-banner','lixian-hunan','tianmen','xiangfen','xinmi'])assert.match(places.get(id).description,/范围.*近似中部/);
 assert.match(places.get('karuo-site').description,/小数一位/);
 const he=data.events.find(e=>e.id==='cn-bce1038-hezun-chengzhou');
 assert.equal(he.placeId,'luoyang');assert.match(he.locationNote,/出土于宝鸡/);
 const g=data.events.find(e=>e.id==='cn-bce816-guojizi-bai-bronze-pan');assert.match(g.locationNote,/出土区域.*战场.*未.*复原/);
});

test('shared archaeological labels respect each country date range while known civil transitions still resolve',()=>{
 const ambiguous={year:-100,era:'史前与早期'};
 assert.equal(periodForEvent(ambiguous,'CN'),null);
 assert.equal(periodForEvent(ambiguous,'KR')?.id,'kr-early');
 assert.equal(periodForEvent(ambiguous,'JP')?.id,'jp-early');
 assert.equal(periodForEvent({year:-5000,era:'史前与早期'},'CN')?.id,'cn-prehistory');
 assert.equal(periodForEvent({year:1949,date:'1949-09-29',era:'中华人民共和国'},'CN')?.id,'republic');
 assert.equal(periodForEvent({year:1949,date:'1949-10-01',era:'中华民国'},'CN')?.id,'prc');
});

test('expanded archaeological records preserve calibrated ages, phase ranges and uncertain interpretations',()=>{
 const e=id=>data.events.find(e=>e.id===id);
 const nan=e('cn-bce9500-nanzhuangtou-plant-processing');
 assert.equal(yearLabel(nan.year),'公元前 9500 年');assert.equal(nan.year,-9499);
 assert.match(nan.summary,/11500至11000.*校正/);assert.match(nan.summary,/1950/);assert.match(nan.summary,/不能.*完全驯化/);
 assert.match(e('cn-bce4300-keqiutou-coastal-settlement').summary,/单个遗址.*6500至6000/);
 assert.match(e('cn-bce7000-jiahu-fermented-beverages').summary,/化学研究.*可能/);
 assert.match(e('cn-bce2200-dinggong-inscribed-sherd').summary,/成熟文字仍有争论/);
 assert.match(e('cn-bce1400-huanbei-shang-moat').summary,/城壕.*不能.*夯土外郭墙/);
 assert.match(e('cn-bce1100-sanxingdui-ritual-pit-deposits').summary,/1131至.*1012/);
 assert.match(e('cn-bce1030-kanghou-gui-early-zhou-grant').summary,/成王.*叛乱/);
 assert.match(e('cn-bce900-dake-ding-royal-appointment').summary,/不将大盂鼎.*误配/);
 assert.match(e('cn-bce2000-wadian-moated-center').summary,/不能.*夏禹都城/);
 const g=e('cn-bce816-guojizi-bai-bronze-pan');
 assert.equal(g.year,-815);assert.match(g.title,/（约）$/);assert.equal(g.sources.length,2);
 assert.match(e('cn-bce4500-jiangzhai-planned-village').sources[1].title,/戴向明/);
 assert.match(g.summary,/传统.*前816年/);assert.match(g.summary,/携王十二年/);assert.match(g.summary,/学术分歧/);
});
test('expanded county references distinguish like named places and do not fabricate site coordinates',()=>{
 const ids=['rizhao','linqu','guanghe','datong-qinghai','tongde','minhou','shaoguan','shifang','wushan','xingan-jiangxi','yuanqu','ningxiang','huixian'];
 for(const id of ids){const p=places.get(id);assert.ok(p?.sources?.length,id);assert.equal(p.countryCode,'CN',id);assert.match(p.description,/参考点/,id);}
 assert.equal(data.events.find(e=>e.id==='cn-bce2200-xizhufeng-elite-tombs').placeId,'linqu');
 assert.equal(data.events.find(e=>e.id==='cn-bce3000-shangsunjiazhai-dance-basin').placeId,'datong-qinghai');
 assert.equal(data.events.find(e=>e.id==='cn-bce1030-kanghou-gui-early-zhou-grant').placeId,'huixian');
 assert.match(places.get('huixian').description,/辉县与.*卫辉.*不同/);
 assert.match(places.get('datong-qinghai').description,/山西大同/);
 assert.match(places.get('tongde').description,/不是县城中心或宗日遗址/);
 assert.ok(Math.abs(places.get('rizhao').lon-(119+27/60+13/3600))<1e-6);
});

test('early pottery uses calibrated BP conversion and navigates before existing archaeological records',()=>{
 const e=data.events.find(e=>e.id==='cn-bce18000-xianrendong-early-pottery');
 assert.equal(e.year,-17999);assert.equal(yearLabel(e.year),'公元前 18000 年');
 assert.equal(e.date,null);assert.equal(e.approximate,true);assert.match(e.title,/（约）$/);
 assert.match(e.summary,/20000至19000.*校正/);assert.match(e.summary,/1950/);assert.match(e.summary,/18050至.*17050/);
 assert.equal(periodForEvent(e,'CN')?.id,'cn-prehistory');assert.deepEqual(periodBounds('all',2026,'CN'),[-17999,2026]);
 assert.equal(eventMatches(e,{countryCode:'CN',period:'cn-prehistory',city:'wannian',scope:'year',year:-17999},places),true);
 assert.equal(eventMatches(e,{countryCode:'CN',period:'cn-prehistory',city:'wannian',scope:'year',year:-15999},places),false);
 const publication=data.events.find(e=>e.id==='prc-2012-wannian-xianrendong-pottery-dating');
 assert.equal(publication.year,2012);assert.equal(periodForEvent(publication,'CN')?.id,'prc');
 const y=data.events.find(e=>e.id==='cn-bce16000-yuchanyan-early-pottery');
 assert.equal(y.year,-15999);assert.match(y.summary,/18300至15430/);assert.match(y.summary,/1950/);
 const cn=data.events.filter(record=>periodForEvent(record,'CN'));const cnCoverage=[Math.min(...cn.map(record=>record.year)),Math.max(...cn.map(record=>record.endYear??record.year))];
 assert.deepEqual(cnCoverage,[-17999,2026]);assert.ok(data.meta.coverage[0]<=cnCoverage[0]&&data.meta.coverage[1]>=cnCoverage[1]);
});
test('county craft stages retain distinct periods and documentary dating stays within source precision',()=>{
 const find=id=>data.events.find(e=>e.id===id);
 const before=find('cn-bce800-guanzhuang-early-bronze-workshop'),coins=find('cn-bce600-guanzhuang-standard-spade-coins');
 assert.equal(before.placeId,'xingyang');assert.equal(coins.placeId,before.placeId);
 assert.equal(periodForEvent(before,'CN')?.id,'western-zhou');assert.equal(periodForEvent(coins,'CN')?.id,'spring-autumn-warring');
 assert.match(before.summary,/814至.*750/);assert.match(before.summary,/跨越西周与春秋/);assert.match(coins.summary,/640至.*550/);
 for(const e of [before,coins]){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.approximate,true);}
 const tally=find('cn-bce323-ejun-qi-transit-tallies');assert.equal(tally.year,-322);assert.equal(tally.date,null);assert.equal(tally.approximate,undefined);assert.match(tally.summary,/怀王六年.*323/);
 const campaign=find('cn-bce846-jinhou-su-eastern-campaign');assert.equal(campaign.date,null);assert.equal(campaign.approximate,true);assert.match(campaign.summary,/史记/);assert.match(campaign.summary,/不把.*公历/);
 const surname=find('cn-bce3300-wanggou-carbonised-silk');assert.equal(surname.placeId,'xingyang');
 const core=[['daoxian',25.49603,111.55146,'CN-43','1813777'],['yongkang',28.88162,120.03308,'CN-33','1809412'],['funan',32.63678,115.61494,'CN-34','1788005'],['kazuo',41.12333,119.74167,'CN-21','2038013']];
 for(const [id,lat,lon,region,gid]of core){const p=places.get(id);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.regionCode,region);assert.equal(p.countryCode,'CN');assert.equal(p.adminLevel,'county');assert.ok(p.parentCity);assert.equal(p.sources[0].url,'https://www.geonames.org/'+gid);assert.match(p.description,/参考点/);}
 assert.match(places.get('kazuo').description,/内蒙古、北京.*区分/);
});

test('regional archaeological records use chronological groups without importing unrelated political ownership',()=>{
 const earlyMilk=data.events.find(e=>e.id==='cn-bce1900-xiaohe-early-dairy-consumption'),cheese=data.events.find(e=>e.id==='cn-bce1600-xiaohe-cheese-fermentation'),cattle=data.events.find(e=>e.id==='cn-bce550-bangga-cattle-yak-hybrids');
 assert.equal(earlyMilk.placeId,'ruoqiang');assert.equal(cheese.placeId,earlyMilk.placeId);
 assert.equal(periodForEvent(earlyMilk,'CN')?.id,'cn-prehistory');assert.equal(periodForEvent(cheese,'CN')?.id,'xia-shang');assert.equal(periodForEvent(cattle,'CN')?.id,'spring-autumn-warring');
 assert.match(cheese.locationNote,/不表示商王朝管辖/);assert.match(cattle.summary,/不证明中原诸侯统治/);
 for(const e of [earlyMilk,cheese,cattle]){
  assert.equal(e.date,null);assert.equal(e.approximate,true);assert.equal(e.endYear,undefined);
  assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1,e.id);
  for(const country of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN'])assert.equal(periodForEvent(e,country),null);
  const filter={countryCode:'CN',period:e.periodId,city:e.placeId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,filter,places),true);assert.equal(eventMatches(e,{...filter,year:e.year-1},places),false);assert.equal(eventMatches(e,{...filter,year:e.year+1},places),false);
 }
});
test('calibrated BP ranges are converted from 1950 and distinct agricultural phases stay separately searchable',()=>{
 const cases=[['cn-bce6000-jingtoushan-natural-lacquer',7800,8300],['cn-bce4700-shiao-early-strip-paddies',6300,6700],['cn-bce2800-shiao-liangzhu-grid-paddies',4500,4900],['cn-bce2800-sidun-stone-construction',4526,4828],['cn-bce550-bangga-cattle-yak-hybrids',2360,2670],['cn-bce2000-xichengyi-metallurgy-peak',3700,4000]];
 for(const [id,low,high]of cases){const e=data.events.find(e=>e.id===id);const bce=1-e.year;assert.ok(bce>=low-1950&&bce<=high-1950,id);assert.match(e.summary,new RegExp(String(low)));assert.match(e.summary,new RegExp(String(high)));assert.equal(e.date,null);assert.equal(e.approximate,true);}
 const first=data.events.find(e=>e.id==='cn-bce4700-shiao-early-strip-paddies'),later=data.events.find(e=>e.id==='cn-bce2800-shiao-liangzhu-grid-paddies');
 assert.equal(first.placeId,later.placeId);assert.notEqual(first.year,later.year);
 assert.match(first.title,/条带/);assert.match(later.title,/井字/);assert.match(later.summary,/区别较早条带/);
 assert.equal(eventMatches(later,{countryCode:'CN',period:'cn-prehistory',city:'yuyao',scope:'year',year:first.year},places),false);
 const disaster=data.events.find(e=>e.id==='cn-bce1920-lajia-settlement-catastrophe');
 assert.equal(disaster.sources.length,2);assert.match(disaster.summary,/不同研究/);assert.match(disaster.summary,/不能.*证明大禹/);assert.ok(disaster.sources.some(s=>s.url.includes('S034181622600069X')));
});
test('new regional map references distinguish county seats, cities and the published Bangga site coordinate',()=>{
 for(const [id,lat,lon,province,gid,admin]of [['jimunai',47.43403,85.87113,'CN-65','1538336','county'],['minle',38.42457,100.7926,'CN-62','1800465','county'],['qingchuan',32.59026,105.23343,'CN-51','1798105','county'],['pingdingshan',33.73091,113.31554,'CN-41','1798827','city']]){
  const p=places.get(id);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.countryCode,'CN');assert.equal(p.regionCode,province);assert.equal(p.adminLevel,admin);assert.ok(p.parentCity);assert.equal(p.sources[0].url,'https://www.geonames.org/'+gid);assert.match(p.description,/参考点/);
 }
 assert.match(places.get('jimunai').description,/托普铁热克.*区分边境吉木乃镇/);assert.match(places.get('qingchuan').description,/区分辽宁/);assert.match(places.get('pingdingshan').description,/区分辽宁/);
 const b=places.get('bangga-site');assert.equal(b.adminLevel,'site');assert.equal(b.regionCode,'CN-54');assert.equal(b.parentCity,'山南市');
 assert.ok(Math.abs(b.lat-(29+5/60+13.66/3600))<1e-10);assert.ok(Math.abs(b.lon-(91+43/60+15.36/3600))<1e-10);assert.match(b.description,/琼结县下水乡/);
 assert.ok(b.sources.some(s=>s.url==='https://pmc.ncbi.nlm.nih.gov/articles/PMC10848728/'));
});
test('Qin and Han documentary years remain separate from manufacture, burial and modern publication dates',()=>{
 const find=id=>data.events.find(e=>e.id===id);
 for(const [id,bce,period]of [['cn-bce384-qin-xiangong-end-retainer-sacrifice',384,'spring-autumn-warring'],['cn-bce383-qin-xiangong-yueyang-construction',383,'spring-autumn-warring'],['cn-bce309-qingchuan-revised-field-law',309,'spring-autumn-warring'],['cn-bce12-yinwan-yuanyan-calendar',12,'western-han'],['cn-bce11-yinwan-shirao-work-diary',11,'western-han'],['cn-bce61-xuanquan-changluohou-reception',61,'western-han'],['cn-bce60-xuanquan-rizhu-king-rations',60,'western-han'],['cn-bce39-xuanquan-kangju-envoy-complaint',39,'western-han']]){
  const e=find(id);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.approximate,undefined);assert.equal(periodForEvent(e,'CN')?.id,period);
 }
 assert.match(find('cn-bce61-xuanquan-changluohou-reception').summary,/神爵元年/);assert.match(find('cn-bce61-xuanquan-changluohou-reception').summary,/不另造正式元康五年/);
 assert.match(find('cn-bce309-qingchuan-revised-field-law').summary,/抄写和入墓时间可以不同/);
 for(const id of ['cn-bce190-zhangjiashan-reckoning-manuscript','cn-bce186-zhangjiashan-ernian-statutes','cn-bce168-mawangdui-topographic-garrison-maps','cn-bce168-mawangdui-medical-manuscripts','cn-bce122-nanyue-zhaomo-xianggang-burial','cn-bce113-mancheng-liusheng-rock-cut-tomb','cn-bce59-haihun-confucius-screen-manuscript']){
  const e=find(id);assert.equal(e.approximate,true);assert.match(e.title,/（约）$/);assert.equal(e.date,null);assert.equal(periodForEvent(e,'CN')?.id,'western-han');
 }
 assert.equal(find('cn-bce190-zhangjiashan-reckoning-manuscript').placeId,'jingzhou');
 assert.equal(places.get('jingzhou').countryCode,'CN');assert.match(find('cn-bce12-yinwan-yuanyan-calendar').locationNote,/不把.*县城.*郡治/);
 for(const id of ['cn-prehistory','xia-shang','western-zhou','spring-autumn-warring','western-han'])assert.equal(data.meta.collections.find(c=>c.id===id).events,data.events.filter(e=>e.periodId===id).length);
});

test('Western Han annal years include 1 BCE and retain year-only filtering across era changes',()=>{
 const rows=data.events.filter(e=>/^cn-bce\d+-han-/.test(e.id));
 assert.equal(rows.length,61);
 for(const [key,bce]of [['kunming-pool',120],['bai-canal-proposal',95],['suwu-return',81],['salt-iron-restored',41],['no-new-mausoleum-town',40],['pingdi-wangmang-transition',1]]){
  const e=rows.find(e=>e.id==='cn-bce'+bce+'-han-'+key);assert.ok(e);
  assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.approximate,undefined);assert.equal(e.endYear,undefined);
  assert.equal(periodForEvent(e,'CN')?.id,'western-han');
  const f={countryCode:'CN',period:'western-han',city:e.placeId,scope:'year',year:e.year};
  assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);assert.equal(eventMatches(e,{...f,year:e.year+1},places),false);
 }
 assert.equal(rows.find(e=>e.id==='cn-bce1-han-pingdi-wangmang-transition').year,0);
 for(const e of rows){assert.equal(e.date,null);assert.ok(e.sources.every(s=>s.title&&s.url.startsWith('https://')));assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1,e.id);for(const c of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP'])assert.equal(periodForEvent(e,c),null,e.id);}
 assert.equal(data.meta.collections.find(c=>c.id==='western-han').events,795);
});
test('Han fiscal records preserve tax kind, reduction amount, unimplemented proposals and retained ritual musicians',()=>{
 const get=(bce,key)=>data.events.find(e=>e.id==='cn-bce'+bce+'-han-'+key);
 const child=get(74,'koufu-thirty-percent'),adult=get(52,'suanfu-thirty-cash-reduction'),proposal=get(7,'land-slave-limit-proposal'),music=get(7,'music-office-reduction');
 assert.match(child.title,/口赋/);assert.match(child.summary,/减少三成/);assert.match(adult.title,/算赋.*三十钱/);assert.match(adult.summary,/原定成年人口税额的减收/);
 assert.match(proposal.title,/未实行/);assert.match(proposal.summary,/最终搁置未行/);assert.match(music.summary,/三百八十八人留属太乐/);
 const reward=get(67,'jiaodong-wangcheng-reward');assert.match(reward.summary,/虚增质疑/);assert.ok(reward.sources.some(s=>s.url.endsWith('/卷089')));
 const kin=get(66,'kin-concealment-rule');assert.match(kin.summary,/死罪.*上请廷尉/);
});
test('Han map references distinguish migrated passes, similarly named counties and regions from exact ancient sites',()=>{
 for(const [id,bce,key,province,parent]of [['xin-an-henan',114,'hangu-pass-relocation','CN-41','洛阳市'],['juye',14,'shanyang-suling','CN-37','菏泽市']]){
  const p=places.get(id),e=data.events.find(e=>e.id==='cn-bce'+bce+'-han-'+key);assert.ok(p&&e);assert.equal(e.placeId,id);assert.equal(p.countryCode,'CN');assert.equal(p.regionCode,province);assert.equal(p.parentCity,parent);assert.equal(p.adminLevel,'county');assert.match(e.locationNote,/参考/);
  assert.equal(eventMatches(e,{countryCode:'CN',period:'western-han',city:id,scope:'year',year:e.year},places),true);
 }
 assert.match(places.get('xin-an-henan').description,/灵宝/);assert.match(places.get('juye').description,/潍坊昌邑/);
 const quake=data.events.find(e=>e.id==='cn-bce47-han-longxi-earthquake');assert.equal(quake.date,null);assert.match(quake.locationNote,/县城坐标不等于古城或古地震震中/);
 const start=data.events.find(e=>e.id==='cn-bce20-han-changling-work-start'),end=data.events.find(e=>e.id==='cn-bce16-han-changling-abandoned');
 assert.match(start.summary,/迁五千富户的安排见于次年/);assert.match(end.summary,/停止/);assert.equal(start.placeId,end.placeId);assert.notEqual(start.year,end.year);
});

test('Shang and Zhou regional records retain approximate dates and single-case inscriptions',()=>{
 const newer=data.events.filter(e=>/-early06-/.test(e.id));
 assert.equal(newer.length,43);assert.equal(newer.filter(e=>e.approximate).length,29);
 assert.equal(new Set(newer.map(e=>e.title)).size,43);
 assert.deepEqual(Object.fromEntries(['xia-shang','western-zhou','spring-autumn-warring'].map(id=>[id,newer.filter(e=>e.periodId===id).length])),{'xia-shang':3,'western-zhou':16,'spring-autumn-warring':24});
 for(const e of newer){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.title.includes('（约）'),!!e.approximate);assert.equal(periodForEvent(e,'CN')?.id,e.periodId);}
 const li=data.events.find(e=>e.id==='cn-bce950-early06-li-military-appointment');assert.match(li.summary,/两个同铭器合记/);
 const ba=data.events.find(e=>e.id==='cn-bce940-early06-baji-legal-oath');assert.match(ba.summary,/合记同案/);assert.match(ba.summary,/不将穆公强认作周穆王/);
 const fortyThree=data.events.find(e=>e.id==='cn-bce800-early06-lai-year43-appointment');assert.ok(fortyThree.approximate);assert.match(fortyThree.summary,/王名及历谱换算仍须考证/);
 const tomb=data.events.find(e=>e.id==='cn-bce900-early06-hengshui-peng');assert.match(tomb.summary,/独立方国与晋附属/);assert.match(tomb.locationNote,/县城点不等于/);
 const eCountry=data.events.find(e=>e.id==='cn-bce1000-early06-e-overseer');assert.equal(eCountry.placeId,'suizhou');assert.match(eCountry.locationNote,/非现代鄂州市/);
});
test('Spring and Autumn chronicle regnal years convert without a BCE year zero error',()=>{
 const dated=[
 ['lu-flood',687,'莊公','七年'],['song-flood',683,'莊公','十一年'],['song-meteorites',644,'僖公','十六年'],
 ['lu-qiujia',590,'成公','元年'],['lu-new-palace-fire',588,'成公','三年'],['song-fire-zihan',564,'襄公','九年'],
 ['chu-land-military-register',548,'襄公','二十五年'],['song-fire-boji',543,'襄公','三十年'],['zichan-village-school',542,'襄公','三十一年'],
 ['zichan-qiu-tax',538,'昭公','四年'],['zichan-gong-tribute',529,'昭公','十三年'],['tanzi-bird-offices',525,'昭公','十七年'],
 ['zheng-fire-relief',524,'昭公','十八年'],['sui-protects-chu',506,'定公','四年']];
 const firstYears={'莊公':693,'僖公':659,'成公':590,'襄公':572,'昭公':541,'定公':509};
 const n={'元年':1,'三年':3,'四年':4,'七年':7,'九年':9,'十一年':11,'十三年':13,'十六年':16,'十七年':17,'十八年':18,'二十五年':25,'三十年':30,'三十一年':31};
 for(const [key,bce,duke,regnal]of dated){assert.equal(firstYears[duke]-n[regnal]+1,bce);const e=data.events.find(e=>e.id==='cn-bce'+bce+'-early06-'+key);assert.ok(e);assert.equal(e.year,1-bce);assert.equal(e.approximate,undefined);assert.equal(e.date,null);assert.match(e.sources[0].title,new RegExp(duke+'(?:'+regnal+'|'+n[regnal]+'年)'));assert.equal(e.periodId,'spring-autumn-warring');}
 const fire=data.events.find(e=>e.id==='cn-bce524-early06-zheng-fire-relief');assert.equal(fire.placeId,'xinzheng');assert.match(fire.summary,/不重复拆成四条/);
 const flood=data.events.find(e=>e.id==='cn-bce683-early06-song-flood');assert.equal(flood.placeId,'shangqiu');assert.notEqual(flood.id,data.events.find(e=>e.id==='cn-bce687-early06-lu-flood').id);
});
test('New Chinese county references use verified GeoNames towns and preserve city search',()=>{
 for(const [id,name,region,lat,lon,gid]of [
 ['jiangxian-shanxi','绛县','CN-14',35.49399,111.55334,1806233],['zaoyang-hubei','枣阳市','CN-42',32.12722,112.75417,1785462],
 ['chengcheng-shaanxi','澄城县','CN-61',35.18778,109.92472,1815301],['zhangjiachuan-gansu','张家川回族自治县','CN-62',34.98756,106.20902,1785212]]){
 const p=data.places.find(p=>p.id===id);assert.ok(p);assert.equal(p.name,name);assert.equal(p.countryCode,'CN');assert.equal(p.regionCode,region);assert.equal(p.adminLevel,'county');assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.match(p.sources[0].url,new RegExp('/'+gid+'$'));assert.ok(data.events.some(e=>e.placeId===id));}
 assert.equal(data.meta.collections.find(c=>c.id==='xia-shang').events,41);
 assert.equal(data.meta.collections.find(c=>c.id==='western-zhou').events,57);
 assert.equal(data.meta.collections.find(c=>c.id==='spring-autumn-warring').events,1003);
});


const addedEarly07=data.events.filter(e=>/-early07-/.test(e.id));
const early07=key=>{const e=addedEarly07.find(e=>e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Western Zhou and Spring Autumn local records keep approximate stages separate from documented years',()=>{
 assert.equal(addedEarly07.length,54);
 assert.equal(addedEarly07.filter(e=>e.approximate).length,6);
 assert.equal(addedEarly07.filter(e=>e.periodId==='western-zhou').length,4);
 for(const e of addedEarly07){assert.equal(e.date,null,e.id);assert.equal(e.endYear,undefined,e.id);assert.equal(periodForEvent(e,'CN')?.id,e.periodId,e.id);assert.equal(periodForEvent(e,'KR'),null,e.id);assert.equal(periodForEvent(e,'IN'),null,e.id);}
 for(const key of ['chenzhuang-fortified-settlement','chenzhuang-crop-fodder','chenzhuang-function-change','chenzhuang-yin-gui-command','maojiaping-ziche-command','dongheigou-iron-forging']){const e=early07(key);assert.equal(e.approximate,true);assert.match(e.title,/（约）$/);}
});
test('Lu regnal years map to BCE labels without shifting at duke transitions',()=>{
 for(const [key,bce,book,regnal]of [
 ['lu-li-battle',659,'僖公','元年'],['xia-yang-capture',658,'僖公','二年'],['yanggu-planning',657,'僖公','三年'],
 ['xinmi-siege',654,'僖公','六年'],['tao-royal-succession',652,'僖公','八年'],
 ['chu-shangchen-succession',626,'文公','元年'],['qin-wangguan-campaign',624,'文公','三年'],
 ['zhao-dun-laws',621,'文公','六年'],['daji-battle',607,'宣公','二年'],['ruoao-clan-conflict',605,'宣公','四年'],
 ['jin-jiashi-liuxu-conquests',593,'宣公','十六年'],['duandao-qi-envoys',592,'宣公','十七年']]){
  const e=early07(key);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');assert.ok(e.sourceTitle.includes(book+regnal));assert.equal(e.approximate,undefined);
 }
});
test('Related campaigns and repeated city captures remain in their own recorded year',()=>{
 const pairs=[['xia-yang-capture','spring-autumn-warring-bce655-history500-11',658,655],['lu-xuju-second-capture','spring-autumn-warring-bce638-history500c-30',620,638],['jin-three-lines','cn-bce629-early07-jin-five-armies',632,629],['diquan-alliance','spring-autumn-warring-bce632-history500b-13',631,632]];
 for(const [key,otherId,bce,otherBce]of pairs){const e=early07(key),other=data.events.find(x=>x.id===otherId);assert.ok(other,otherId);assert.equal(e.year,1-bce);assert.equal(other.year,1-otherBce);const f={scope:'year',year:e.year,countryCode:'CN',city:'all',period:'spring-autumn-warring'};assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(other,f,places),false);}
});
test('Chenzhuang same inscription vessels are one command and do not invent a royal year',()=>{
 const e=early07('chenzhuang-yin-gui-command');assert.match(e.title,/引簋/);assert.match(e.summary,/没有王年/);assert.match(e.summary,/书面传递/);assert.match(e.locationNote,/两件同铭器合为一条/);assert.equal(addedEarly07.filter(x=>/引簋/.test(x.title)).length,1);assert.equal(e.placeId,'gaoqing');
 const change=early07('chenzhuang-function-change');assert.match(change.summary,/相对阶段/);assert.match(change.summary,/不是.*毁城之年/);
});
test('Iron old wood and Qin early county interpretations retain their archaeological limitations',()=>{
 const iron=early07('dongheigou-iron-forging'),mao=early07('maojiaping-ziche-command');
 assert.equal(iron.year,-299);assert.match(iron.summary,/人骨/);assert.match(iron.summary,/老木效应/);assert.match(iron.summary,/不能据成品证明.*炼铁炉/);
 assert.equal(mao.year,-609);assert.match(mao.summary,/穆公晚年至康、共公/);assert.match(mao.summary,/不等同于.*郡县制/);assert.match(mao.locationNote,/墓主不能直接认作.*三良/);
});
test('Chinese Chu capitals and Wen place references never use Korean Gangneung or Gansu homonyms',()=>{
 for(const key of ['chu-shangchen-succession','chu-zhuang-abduction','ruoao-clan-conflict']){const e=early07(key);assert.equal(e.placeId,'jingzhou');assert.equal(places.get(e.placeId).countryCode,'CN');assert.notEqual(e.placeId,'kr-gangneung');}
 const wen=places.get('wenxian-henan');assert.equal(wen.regionCode,'CN-41');assert.equal(wen.lat,34.94083);assert.equal(wen.lon,113.07187);
 assert.equal(early07('wen-di-conquest').placeId,wen.id);assert.equal(early07('duandao-qi-envoys').placeId,wen.id);
});
test('Liu and Liao conquests and sparse earthquake notices do not gain unsupported locations or dates',()=>{
 const e=early07('chu-liu-liao-conquests'),later=data.events.find(e=>e.id==='spring-autumn-warring-bce601-history500c-39');
 assert.equal(e.year,-621);assert.equal(later.year,-600);assert.match(e.summary,/不把此蓼直接等同.*舒蓼/);
 const quake=early07('lu-earthquake-record');assert.equal(quake.year,-617);assert.equal(quake.date,null);assert.match(quake.summary,/没有震级、震中/);assert.match(quake.locationNote,/不是.*震中/);
 for(const id of ['gaoqing','barkol','yanggu','wenxian-henan','jiyuan','yutai','guangshan','zhengyang','sihong']){const p=places.get(id);assert.ok(p,id);assert.equal(p.countryCode,'CN');assert.equal(p.adminLevel,'county');assert.ok(addedEarly07.some(e=>e.placeId===id),id);assert.ok(p.sources.some(s=>/geonames\.org/.test(s.url)),id);}
});

const addedEarly08=data.events.filter(e=>/-early08-/.test(e.id));
const early08=key=>{const e=addedEarly08.find(e=>e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Cheng and Xiang regnal transitions preserve independently checked BCE years',()=>{
 assert.equal(addedEarly08.length,64);
 for(const [key,bce,book,year]of [
 ['royal-maorong-defeat',590,'成公','元年'],['song-wengong-funeral',588,'成公','三年'],
 ['shu-alliance',589,'成公','二年'],['lu-deer-park',573,'成公','十八年'],
 ['pengcheng-recovery',572,'襄公','元年'],['hulao-fortification',571,'襄公','二年'],
 ['weijiang-peace-rong',569,'襄公','四年'],['xingqiu-court-quotas',565,'襄公','八年'],
 ['zheng-west-palace-revolt',563,'襄公','十年'],['qi-fortifies-zhou-jia',549,'襄公','二十四年'],
 ['zichan-guest-house-walls',542,'襄公','三十一年']]){
  const e=early08(key);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');assert.ok(e.sourceTitle.includes(book+year),e.id);assert.equal(e.date,null);assert.equal(e.approximate,undefined);
 }
});
test('Song death and burial and delayed defeat reports are not assigned to the reporting year',()=>{
 const funeral=early08('song-wengong-funeral');
 assert.equal(funeral.year,-587);assert.match(funeral.summary,/前589年去世/);assert.match(funeral.summary,/次年前588年/);
 assert.match(funeral.sourceTitle,/成公三年/);assert.ok(funeral.sources.some(s=>/成公二年.*厚葬/.test(s.title)));
 assert.match(funeral.summary,/不能用作中国人殉起源/);
 const royal=early08('royal-maorong-defeat');assert.equal(royal.year,-589);assert.match(royal.summary,/实际交战.*春三月/);assert.match(royal.summary,/秋季收到/);
});
test('Repeated captures, land returns and truces remain separate year map nodes',()=>{
 for(const [key,oldId,bce,oldBce]of [
 ['pengcheng-recovery','spring-autumn-warring-bce573-history500b-22',572,573],
 ['xiaoyu-settlement','spring-autumn-warring-bce564-history500c-43',562,564],
 ['wenyang-return-qi','spring-autumn-warring-bce589-history200-7',583,589],
 ['zhanban-battle','spring-autumn-warring-bce555-history500b-24',557,555]]){
  const e=early08(key),other=data.events.find(x=>x.id===oldId);assert.ok(other,oldId);assert.equal(e.year,1-bce);assert.equal(other.year,1-oldBce);
  const f={scope:'year',year:e.year,countryCode:'CN',city:'all',period:'spring-autumn-warring'};
  assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(other,f,places),false);
 }
 for(const [first,later,bce,laterBce]of [['chu-shuyong-conquest','chu-shujiu-conquest',574,548],['wei-xiangong-exile','wei-xiangong-return',559,547]]){
  const a=early08(first),b=early08(later);assert.equal(a.year,1-bce);assert.equal(b.year,1-laterBce);
  const f={scope:'year',year:a.year,countryCode:'CN',city:a.placeId,period:'spring-autumn-warring'};
  assert.equal(eventMatches(a,f,places),true);assert.equal(eventMatches(b,f,places),false);
 }
});
test('Zheng successive crises and office appointment differ from later government leadership',()=>{
 assert.equal(early08('zheng-xigong-regicide').year,-565);
 assert.equal(early08('zheng-west-palace-revolt').year,-562);
 const appointed=early08('zheng-zikong-removed'),governed=data.events.find(e=>e.id==='spring-autumn-warring-bce543-history500-28');
 assert.ok(governed);assert.equal(appointed.year,-553);assert.equal(governed.year,-542);assert.match(appointed.summary,/任卿不同于前543年/);
 assert.equal(early08('zichan-court-burdens').year,-550);
 const army=early08('mianshang-army-offices');assert.equal(army.year,-559);assert.match(army.summary,/暂附下军/);assert.match(army.summary,/次年前559年.*舍新军/);
});
test('Ancient homonyms use qualified modern references in the right Chinese region',()=>{
 for(const [key,id,region]of [
 ['jize-alliance','yongnian-hebei','CN-13'],['lu-cheng-outer-wall','ningyang-shandong','CN-37'],
 ['qi-gaotang-rebellion','yucheng-shandong','CN-37'],['fei-fortification','feixian-shandong','CN-37'],
 ['ju-zeng-conquest','lanling-shandong','CN-37']]){
  const e=early08(key),p=places.get(id);assert.equal(e.placeId,id);assert.ok(p,id);assert.equal(p.countryCode,'CN');assert.equal(p.regionCode,region);assert.equal(p.adminLevel,'county');assert.ok(p.parentCity&&p.sources.some(s=>/geonames\.org/.test(s.url)));
 }
 assert.match(early08('jize-alliance').locationNote,/不能直接等同今天鸡泽县/);
 assert.match(early08('qi-gaotang-rebellion').locationNote,/不直接等同今天高唐县/);
 assert.notEqual(early08('fei-fortification').placeId,'feicheng');
 assert.equal(places.get('lanling-shandong').lat,34.84861);assert.equal(places.get('lanling-shandong').lon,118.04472);
 assert.ok(places.get('lanling-shandong').aliases.includes('苍山县'));assert.match(places.get('lanling-shandong').description,/与兰陵镇及古鄫城位置不同/);
 assert.equal(early08('qin-jin-li-battle').placeId,'yongji');assert.match(early08('qin-jin-li-battle').locationNote,/不.*栎阳/);
 assert.equal(early08('qi-fortifies-zhou-jia').placeId,'luoyang');assert.match(early08('qi-fortifies-zhou-jia').locationNote,/非河南郏县/);
 assert.equal(early08('lu-fang-farming-season').placeId,'feixian-shandong');
});
test('A punished charioteer and an invited absent delegation are not replaced by the named prince or state',()=>{
 const discipline=early08('weijiang-military-discipline');assert.match(discipline.summary,/杀其车御/);assert.match(discipline.summary,/车御而非扬干/);
 const meeting=early08('jize-alliance');assert.match(meeting.summary,/吴未至/);
 assert.match(early08('pu-alliance').summary,/吴未至/);
 assert.match(early08('qixi-recommends-successors').summary,/解狐去世后又荐祁午/);
});
test('Labour and military proposals preserve rejection or adoption instead of inventing implementation',()=>{
 assert.match(early08('song-tower-farm-labour').summary,/未获君主采纳/);
 assert.match(early08('lu-fang-farming-season').summary,/冬季才城防/);
 assert.match(early08('jin-song-campaign-trust').summary,/未实行的袭卫方案/);
 assert.match(early08('qi-cao-duke-detention').summary,/辞让并奔宋/);
 const loans=early08('jin-stock-grain-loans');assert.match(loans.summary,/行之期年/);assert.equal(loans.date,null);
});
test('Sparse Lu weather and earthquake notices and ancient medicine keep evidential precision',()=>{
 for(const [key,bce]of [['lu-flood-cheng5',586],['lu-drought-xiang5',568],['lu-tree-ice',575],['lu-earthquake-xiang16',557]]){
  const e=early08(key);assert.equal(e.year,1-bce);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.match(e.locationNote,/不.*(观测位置|震中|灾边界|受灾中心)/);
 }
 assert.match(early08('lu-earthquake-xiang16').summary,/没有震级、震中/);
 assert.match(early08('lu-tree-ice').summary,/不据一句话判定现代冻雨分类/);
 const medicine=early08('qin-physician-huan');assert.equal(medicine.year,-580);assert.match(medicine.summary,/现代病名/);
});
test('New local records follow country, period, city and selected year intersection',()=>{
 for(const e of addedEarly08){
  assert.equal(periodForEvent(e,'CN')?.id,'spring-autumn-warring');
  for(const country of ['JP','KR','IN','NP'])assert.equal(periodForEvent(e,country),null,e.id);
  const f={scope:'year',year:e.year,countryCode:'CN',city:e.placeId,period:'spring-autumn-warring'};
  assert.equal(eventMatches(e,f,places),true,e.id);assert.equal(eventMatches(e,{...f,year:e.year+1},places),false,e.id);assert.equal(eventMatches(e,{...f,city:'tokyo'},places),false,e.id);
  assert.ok(e.sources.every(s=>new URL(s.url).protocol==='https:'));
 }
});

const addedEarly09=data.events.filter(e=>/-early09-/.test(e.id));
const early09=key=>{const e=addedEarly09.find(e=>e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Zhao regnal year conversion is correct across the BCE interval',()=>{
 assert.equal(addedEarly09.length,103);
 for(const [key,bce,regnal]of [['qin-physician-he',541,'元年'],['hanxuanzi-lu-archives',540,'二年'],['jin-conquers-fei',530,'十二年'],['jin-gu-siege',527,'十五年'],['xu-moves-baiyu',524,'十八年'],['jingwang-enters-chengzhou',516,'二十六年'],['jin-ten-counties',514,'二十八年'],['lu-zhaogong-death-ganhou',510,'三十二年']]){
  const e=early09(key);assert.equal(e.year,1-bce);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');assert.match(e.sourceTitle,new RegExp('昭公'+regnal));
 }
 for(const e of addedEarly09){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);assert.equal(periodForEvent(e,'CN')?.id,'spring-autumn-warring');}
});
test('Gu initial surrender and later recapture occur in separate year map nodes',()=>{
 const a=early09('jin-gu-siege'),b=early09('jin-conquers-gu-again');
 assert.equal(a.year,-526);assert.equal(b.year,-519);assert.equal(a.placeId,'jinzhou-hebei');assert.equal(b.placeId,a.placeId);
 const f={scope:'year',year:a.year,countryCode:'CN',city:a.placeId,period:'spring-autumn-warring'};
 assert.equal(eventMatches(a,f,places),true);assert.equal(eventMatches(b,f,places),false);
 f.year=b.year;assert.equal(eventMatches(a,f,places),false);assert.equal(eventMatches(b,f,places),true);
});
test('Chen annexation, restoration and separate fires keep their dated stages',()=>{
 for(const[key,bce]of [['chen-succession-crisis',534],['chu-annexes-chen',534],['chen-fire-zhao9',533],['chen-cai-restoration',529],['chen-fire-zhao18',524]])assert.equal(early09(key).year,1-bce);
 const f={scope:'year',year:-532,countryCode:'CN',city:'huaiyang',period:'spring-autumn-warring'};
 assert.equal(eventMatches(early09('chen-fire-zhao9'),f,places),true);
 for(const key of ['chu-annexes-chen','chen-cai-restoration','chen-fire-zhao18'])assert.equal(eventMatches(early09(key),f,places),false);
});
test('Royal plans, return to Chengzhou and subsequent city construction are not conflated',()=>{
 const plan=early09('huangfu-royal-support-alliance'),returned=early09('jingwang-enters-chengzhou');
 const built=data.events.find(e=>e.id==='spring-autumn-warring-bce510-history500-108');assert.ok(built);
 assert.equal(plan.year,-516);assert.equal(returned.year,-515);assert.equal(built.year,-509);
 assert.match(plan.summary,/谋划次年纳王/);assert.match(early09('royal-wushe-bell-debate').summary,/将铸/);
 assert.match(early09('hu-conference-lu-restoration').summary,/未能实现/);
 assert.match(early09('lu-jin-restoration-failure').summary,/未实现/);
});
test('Homonymous ancient cities have correct modern country and province references',()=>{
 for(const[id,country,region]of [['gaocheng-hebei','CN','CN-13'],['jinzhou-hebei','CN','CN-13'],['tangxian-hebei','CN','CN-13'],['xixia-henan','CN','CN-41'],['chengan-hebei','CN','CN-13'],['huoshan-anhui','CN','CN-34'],['yuncheng-shandong','CN','CN-37']]){
  const p=places.get(id);assert.ok(p,id);assert.equal(p.countryCode,country);assert.equal(p.regionCode,region);assert.equal(p.adminLevel,'county');
 }
 assert.equal(early09('xu-moves-chengfu').placeId,'bozhou');assert.equal(early09('xu-moves-baiyu').placeId,'xixia-henan');
 assert.match(early09('chu-qin-marriage-crown-prince').summary,/颍川父城/);
 assert.equal(early09('chu-annexes-cai').placeId,'shangcai');assert.equal(early09('cai-duke-dongguo-installed').placeId,'xincai');
 assert.equal(early09('hu-conference-lu-restoration').placeId,'yuanyang');
 assert.equal(early09('lu-yun-collapse').year,-512);assert.match(early09('lu-yun-collapse').locationNote,/山东郓城/);
});
test('Same year disasters in separate states are found only under their own city',()=>{
 const cases=[['song-fire-zhao18','shangqiu'],['wei-fire-zhao18','puyang-county'],['chen-fire-zhao18','huaiyang']];
 const zheng=data.events.find(e=>e.id==='cn-bce524-early06-zheng-fire-relief');assert.ok(zheng);
 for(const[key,city]of cases){
  const e=early09(key),f={scope:'year',year:-523,countryCode:'CN',city,period:'spring-autumn-warring'};
  assert.equal(e.placeId,city);assert.equal(e.year,-523);assert.equal(eventMatches(e,f,places),true);
  assert.equal(eventMatches(zheng,f,places),false);
  for(const[other]of cases.filter(x=>x[0]!==key))assert.equal(eventMatches(early09(other),f,places),false);
 }
});
test('Retrospective traditions and medical blame are not promoted to new dated laws or proof',()=>{
 assert.match(early09('yanying-shuxiang-fiscal-discussion').summary,/已有做法/);
 assert.match(early09('mengxizi-ritual-study').summary,/时间在以后/);
 assert.match(early09('zichan-protects-merchant-jade').summary,/已有安排/);
 assert.match(early09('qiji-envoy-restraints').summary,/尚是楚公子/);assert.equal(early09('qiji-envoy-restraints').year,-535);
 assert.match(early09('xu-duke-medicine-death').summary,/不断言.*蓄意投毒/);
 assert.match(early09('zheng-flood-zhao19').summary,/传闻/);
 assert.match(early09('lu-geng-captives-ritual').summary,/不是中国人殉.*起源/);
 assert.match(early09('jin-pinggong-death').summary,/鲁卿及诸侯代表/);
});
test('Multiple years of Fei rebellion and Lu exile remain independently searchable',()=>{
 for(const[key,bce]of [['nankuai-fei-rebellion',530],['lu-fei-pacification',529],['fei-returns-lu',528],['lu-duke-exile',517],['lu-qi-cheng-siege',516],['lu-jin-restoration-failure',511],['lu-zhaogong-death-ganhou',510]])assert.equal(early09(key).year,1-bce);
 const f={scope:'year',year:-527,countryCode:'CN',city:'feixian-shandong',period:'spring-autumn-warring'};
 assert.equal(eventMatches(early09('fei-returns-lu'),f,places),true);assert.equal(eventMatches(early09('nankuai-fei-rebellion'),f,places),false);
 const death=early09('lu-zhaogong-death-ganhou');assert.equal(death.placeId,'chengan-hebei');assert.match(death.summary,/灵柩返鲁和定公即位属于次年/);
});

const early10=key=>{const e=data.events.find(e=>e.id.includes('-early10-')&&e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Ding and Ai chronology crosses 495 BCE without a year zero or invented month',()=>{
 for(const[key,bce,book,regnal]of [['chengzhou-finished',509,'定公','元年'],['hu-destruction',495,'定公','十五年'],['chu-cai-siege',494,'哀公','元年'],['lu-field-levy',483,'哀公','十二年'],['pingyang-boundary',468,'哀公','二十七年']]){
  const e=early10(key);assert.equal(e.year,1-bce);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');assert.equal(e.date,null);assert.equal(e.precision,'year');assert.match(e.sourceTitle,new RegExp(book+regnal));
 }
 assert.equal(early10('chu-ruo-court').year,-503);assert.equal(early10('qiyang-wall').year,-491);
});
test('Planned building and completed building are visible at separate map years',()=>{
 const plan=data.events.find(e=>e.id==='spring-autumn-warring-bce510-history500-108'),built=early10('chengzhou-finished');assert.ok(plan);
 const f={scope:'year',year:-509,countryCode:'CN',city:'luoyang',period:'spring-autumn-warring'};
 assert.equal(eventMatches(plan,f,places),true);assert.equal(eventMatches(built,f,places),false);
 f.year=-508;assert.equal(eventMatches(built,f,places),true);assert.equal(eventMatches(plan,f,places),false);
 const requested=early10('chu-cai-siege'),moved=early10('cai-zhoulai');assert.equal(requested.year,-493);assert.equal(moved.year,-492);assert.equal(requested.placeId,'xincai');assert.equal(moved.placeId,'fengtai');
});
test('Homonymous ancient places use the correct modern district for map and city search',()=>{
 const cases=[['dun-destruction','xiangcheng-henan','项城市','CN-41'],['chu-zhao-death','baofeng-henan','宝丰县','CN-41'],['wu-wucheng','pingyi-shandong','平邑县','CN-37'],['yun-wei-release','rugao-jiangsu','如皋市','CN-32'],['gaotang-wall-fall','yucheng-shandong','禹城市','CN-37'],['zhao-chaoge','qixian-henan','淇县','CN-41'],['yongqiu-capture','qixian-kaifeng','杞县','CN-41'],['pingyang-boundary','xintai','新泰市','CN-37']];
 for(const[key,id,name,region]of cases){const e=early10(key),p=places.get(id);assert.ok(p);assert.equal(e.placeId,id);assert.equal(p.name,name);assert.equal(p.countryCode,'CN');assert.equal(p.regionCode,region);const f={scope:'year',year:e.year,countryCode:'CN',city:id,period:'spring-autumn-warring'};assert.equal(eventMatches(e,f,places),true);f.city=id=== 'qixian-henan'?'qixian-kaifeng':'qufu';assert.equal(eventMatches(e,f,places),false);}
 assert.match(early10('xu-rongcheng').locationNote,/迁出地参考/);assert.match(early10('leqi-remains').locationNote,/不是停放地/);
});
test('Cross-year Wei coup, field levy and appended chronicles are kept explicitly distinct',()=>{
 const recognition=early10('wei-coup-recognition');assert.equal(recognition.year,-478);assert.match(recognition.summary,/上一年闰月/);assert.match(recognition.summary,/跨年叙述差异/);
 const levy=early10('lu-field-levy');assert.equal(levy.year,-482);assert.match(levy.summary,/此前一年/);
 const relief=early10('qi-zheng-relief');assert.equal(relief.year,-467);assert.match(relief.summary,/悼公四年.*后年/);
 assert.match(early10('yue-zhu-replacement').summary,/属于鲁国事务/);
 assert.match(early10('wu-siege-jin-envoy').summary,/赵无恤/);
});
test('Destroyed and restored small states retain separate year and locality filters',()=>{
 const fall=early10('song-destroys-cao'),rebellion=early10('xiang-rebellion-cao');assert.equal(fall.year,-486);assert.equal(rebellion.year,-480);assert.match(rebellion.summary,/宋国内/);
 const f={scope:'year',year:fall.year,countryCode:'CN',city:'dingtao',period:'spring-autumn-warring'};assert.equal(eventMatches(fall,f,places),true);assert.equal(eventMatches(rebellion,f,places),false);f.year=rebellion.year;assert.equal(eventMatches(rebellion,f,places),true);assert.equal(eventMatches(fall,f,places),false);
 assert.equal(early10('wu-deposes-zhu').year,-486);assert.equal(early10('yue-zhu-restoration').year,-472);assert.equal(early10('yue-zhu-replacement').year,-470);assert.match(early10('zheng-xu-defeat').summary,/后续/);
});
test('Civilization histories retain their assigned country after adding late Spring and Autumn records',()=>{
 for(const e of data.events.filter(e=>e.id.includes('-early10-'))){assert.equal(periodForEvent(e,'CN')?.id,'spring-autumn-warring');for(const code of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,code),null);}
});

const early11=key=>{const e=data.events.find(e=>e.id.includes('-early11-')&&e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Warring States year indexing never invents civil days or a year zero',()=>{
 for(const[key,bce]of [['jin-chu-qin-gifts',463],['pinyang-county',456],['qin-grain-tax',408],['zhou-east-west-divide',367],['qin-dual-chancellors',309],['shu-hui-revolt',301]]){
  const e=early11(key);assert.equal(e.year,1-bce);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);
 }
});
test('Building, revolt, siege, capture and return remain separate map years',()=>{
 for(const[first,second,year1,year2]of [['nanzheng-wall','nanzheng-revolt',-450,-440],['yiyang-siege','yiyang-falls',-307,-306],['puban-captured','puban-returned',-302,-301],['han-drought-high-gate','han-high-gate-complete',-333,-332],['shu-chancellor-kills-marquis','shu-chancellor-punished',-310,-309]]){
  const a=early11(first),b=early11(second);assert.equal(a.year,year1);assert.equal(b.year,year2);
  const f={countryCode:'CN',period:'spring-autumn-warring',city:a.placeId,scope:'year',year:year1};
  assert.equal(eventMatches(a,f,places),true);assert.equal(eventMatches(b,f,places),false);f.year=year2;assert.equal(eventMatches(a,f,places),false);assert.equal(eventMatches(b,f,places),true);
 }
 const built=data.events.find(e=>e.title==='秦献公营建栎阳'),county=early11('qin-yueyang-county');assert.ok(built);assert.equal(built.year,-382);assert.equal(county.year,-373);assert.match(county.summary,/不同年份/);
});
test('Ancient homonyms preserve county search and map reference distinctions',()=>{
 for(const[key,id,name,region]of [['lu-pinglu-victory','wenshang','汶上县','CN-37'],['qin-yinjing-attack','huayin-shaanxi','华阴市','CN-61'],['wei-luyang-capture','lushan-henan','鲁山县','CN-41'],['shangyang-anyi-surrender','xiaxian-shanxi','夏县','CN-14'],['shangyang-fief','danfeng-shaanxi','丹凤县','CN-61'],['pinyang-county','fuping-shaanxi','富平县','CN-61'],['qin-zheng-defeat','huazhou-shaanxi','华州区','CN-61'],['qi-guanjin-capture','wuyi-hebei','武邑县','CN-13'],['wei-zhao-hao-meeting','baixiang','柏乡县','CN-13']]){
  const e=early11(key),p=places.get(id);assert.equal(e.placeId,id);assert.equal(p.name,name);assert.equal(p.regionCode,region);
  const f={countryCode:'CN',period:'spring-autumn-warring',city:id,scope:'year',year:e.year};assert.equal(eventMatches(e,f,places),true);f.city='qufu';assert.equal(eventMatches(e,f,places),false);
 }
 assert.equal(early11('han-pengcheng-capture').placeId,'xuzhou');assert.equal(early11('chu-qi-xuzhou-siege').placeId,'tengzhou');assert.match(early11('qin-wei-linjin-meeting').locationNote,/区别山西临猗/);assert.match(early11('nanzheng-wall').locationNote,/不是本条古城/);
});
test('Recognition and final partition, accession and later royal title stay distinct',()=>{
 const recognized=data.events.find(e=>e.title==='周王正式承认韩、赵、魏为诸侯'),partition=early11('jin-final-partition');assert.ok(recognized);assert.equal(recognized.year,-402);assert.equal(partition.year,-375);
 const seizure=early11('song-yan-usurpation'),royal=data.events.find(e=>e.title==='宋君偃自立为王');assert.ok(royal);assert.equal(seizure.year,-328);assert.equal(royal.year,-317);
 const f={countryCode:'CN',city:'shangqiu',period:'spring-autumn-warring',scope:'year',year:seizure.year};assert.equal(eventMatches(seizure,f,places),true);assert.equal(eventMatches(royal,f,places),false);
 const move=data.events.find(e=>e.title==='赵国迁都邯郸'),raid=early11('zhao-prince-counterattack');assert.equal(move.year,raid.year);assert.notEqual(move.id,raid.id);assert.match(raid.summary,/姓名异文/);
});
test('Chronicle variants and retrospective narratives remain visible without duplicate dated episodes',()=>{
 assert.match(early11('qin-shan-capture').summary,/编年差异/);assert.match(early11('han-yan-kings').summary,/诸书纪年存在差异/);assert.match(early11('qin-xiuyu-victory').summary,/不另在前318年重复/);assert.match(early11('song-yan-usurpation').summary,/前328年/);
 assert.match(early11('yan-ping-enthroned').summary,/次年才列昭王元年/);assert.match(early11('yan-ping-enthroned').summary,/未全部移入/);
 assert.match(early11('qin-huai-coup').summary,/自杀.*杀怀公/);assert.match(early11('shu-hui-revolt').summary,/称谓差异/);
 assert.match(early11('qin-summer-snow').summary,/不直接换算成公历六月/);assert.match(early11('qin-epidemic').summary,/日食与疫病.*不构成/);
});
test('New Warring States records keep one Chinese period and cannot leak into other national timelines',()=>{
 const batch=data.events.filter(e=>e.id.includes('-early11-'));assert.equal(batch.length,93);
 for(const e of batch){assert.equal(periodForEvent(e,'CN')?.id,'spring-autumn-warring');assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1);for(const code of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,code),null,e.id+':'+code);assert.equal(eventMatches(e,{countryCode:'CN',period:'western-zhou',scope:'year',year:e.year},places),false);}
 assert.match(early11('zhou-east-west-divide').summary,/公国.*不能与中国史分期/);
});
test('Regional reference markers disclose uncertainty and never fabricate boundaries or modern city counts',()=>{
 assert.match(early11('qin-luoyin-victory').locationNote,/并非古洛阴战场/);assert.match(early11('wei-song-yitai').locationNote,/不表示仪台故城/);assert.match(early11('qin-shangjun-cession').locationNote,/不是上郡郡治/);
 assert.match(early11('zhao-wei-settlements').summary,/不能.*现代七十三座城市或县/);assert.match(early11('qin-yiyang-six-towns').summary,/名称未逐一列明/);assert.match(early11('qi-kang-exile').locationNote,/不表示.*海滨居所/);
 for(const e of data.events.filter(e=>e.id.includes('-early11-'))){const f={countryCode:'CN',city:e.placeId,period:e.periodId,scope:'year',year:e.year};assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);assert.equal(eventMatches(e,{...f,year:e.year+1},places),false);}
});

const early12=key=>{const e=data.events.find(e=>e.id.includes('-early12-')&&e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Late Warring States migrations preserve Chen, Juyang and Shouchun as different years and references',()=>{
 for(const[key,bce,id]of [['chu-capital-chen',278,'huaiyang'],['chu-juyang-capital',253,'taihe-anhui'],['chu-shouchun-capital',241,'shouxian']]){
  const e=early12(key);assert.equal(e.year,1-bce);assert.equal(e.placeId,id);
  assert.equal(eventMatches(e,{countryCode:'CN',period:'spring-autumn-warring',city:id,scope:'year',year:e.year},places),true);
 }
 assert.match(early12('chu-juyang-capital').locationNote,/对应仍需考证/);assert.match(early12('chu-shouchun-capital').summary,/前278年.*不能因相同都名/);assert.ok(!early12('chu-shouchun-capital').summary.includes('离开陈地'));
 assert.match(early12('chunshen-wu-fief').summary,/不是楚国王都/);
});
test('Qin succession, appointment and changes of local control use the event year rather than a later regnal first year',()=>{
 for(const[key,bce]of [['huangxie-chancellor',263],['xiaowen-brief-reign',250],['lvbuwei-chancellor',249],['jinyang-revolt',247],['jinyang-suppression',246],['lianpo-fanyang',245],['male-age-register',231]]){
  const e=early12(key);assert.equal(e.year,1-bce);assert.equal(e.date,null);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');
 }
 assert.match(early12('huangxie-chancellor').summary,/次年的正式元年/);
 const a=early12('jinyang-revolt'),b=early12('jinyang-suppression'),f={countryCode:'CN',period:'spring-autumn-warring',city:'taiyuan',scope:'year',year:a.year};assert.equal(eventMatches(a,f,places),true);assert.equal(eventMatches(b,f,places),false);
});
test('Chronicle disagreement does not duplicate Eyu, conflate modern Nanyang or invent six allies',()=>{
 const e=early12('eyu-relief');assert.equal(e.year,-269);assert.match(e.summary,/前269年.*不能确认/);assert.equal(e.placeId,'wuan-hebei');assert.ok(!data.events.some(e=>e.id.includes('-early12-')&&e.id.endsWith('-eyu-qin-retry')));assert.match(e.locationNote,/阏与战场另有考证争议/);
 for(const key of ['qin-taihang-cut','wei-xiuwu-cession','han-nanyang-transfer'])assert.match(early12(key).summary,/南阳.*(?:不同|不是|不能)/);
 assert.equal(early12('han-wan-fall').placeId,'nanyang');assert.match(early12('han-wan-fall').summary,/记述口径并不完全相同/);
 assert.match(early12('five-states-qin-hangu').summary,/作燕.*列卫.*名单有异/);assert.match(early12('dongjun-establishment').summary,/二十城.*三十城误数/);
});
test('Henei references distinguish Huai, Yewang, Xingqiu and Warring States Fanyang homonyms',()=>{
 for(const[key,id,name,region,lon,lat]of [['huai-to-qin','wuzhi-henan','武陟县','CN-41',113.40025,35.09727],['yewang-cut','qinyang-henan','沁阳市','CN-41',112.92805,35.09061],['lianpo-fanyang','neihuang-henan','内黄县','CN-41',114.89689,35.95321],['chengjiao-tunliu','tunliu-shanxi','屯留区','CN-14',112.88194,36.3275],['mianchi-meeting','mianchi-henan','渑池县','CN-41',111.75871,34.76727],['wei-xiuwu-cession','xiuwu-henan','修武县','CN-41',113.44041,35.22946],['dai-prince-jia','yuxian-hebei','蔚县','CN-13',114.57594,39.83246],['chu-juyang-capital','taihe-anhui','太和县','CN-34',115.64886,33.16552],['eyu-relief','wuan-hebei','武安市','CN-13',114.19132,36.69668]]){
  const e=early12(key),p=places.get(id);assert.equal(e.placeId,id);assert.equal(p.name,name);assert.equal(p.regionCode,region);assert.equal(p.lon,lon);assert.equal(p.lat,lat);assert.equal(p.adminLevel,'county');
  const f={countryCode:'CN',period:'spring-autumn-warring',city:id,scope:'year',year:e.year};assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,city:'nanyang'},places),false);
 }
 assert.equal(early12('xingqiu-capture').placeId,'wenxian-henan');assert.match(early12('xingqiu-capture').summary,/不.*现代河北邢台/);assert.match(early12('lianpo-fanyang').summary,/临颍/);assert.match(places.get('yuxian-hebei').description,/区别山西盂县及河南禹州/);
});
test('Handan aid, Qin resignations and coercive resettlement distinguish policy and outcome years',()=>{
 for(const[a,b,year1,year2]of [['wei-ye-standby','xinling-handan-relief',-257,-256],['lvbuwei-dismissal','lvbuwei-death',-236,-234],['qin-taihang-cut','yewang-cut',-262,-261]]){
  const x=early12(a),y=early12(b);assert.equal(x.year,year1);assert.equal(y.year,year2);
  const f={countryCode:'CN',period:'spring-autumn-warring',scope:'year',year:year1};assert.equal(eventMatches(x,f,places),true);assert.equal(eventMatches(y,f,places),false);
 }
 assert.match(early12('anyi-resettlement').summary,/授爵.*赦罪/);assert.match(early12('rang-amnesty-resettle').summary,/赦免与强制迁居/);assert.match(early12('lvbuwei-death').summary,/不将拟议迁蜀.*已经/);
});
test('Late Zhou principalities and final Qin provincial consolidation do not leak into the Western Zhou or Qin dynasty filters',()=>{
 for(const key of ['westzhou-submit','eastzhou-annexation','kuaiji-commandery']){
  const e=early12(key);assert.equal(periodForEvent(e,'CN')?.id,'spring-autumn-warring');assert.equal(eventMatchesPeriod(e,'western-zhou','CN'),false);assert.equal(eventMatchesPeriod(e,'qin','CN'),false);
 }
 assert.equal(early12('kuaiji-commandery').year,-221);assert.equal(early12('kuaiji-commandery').placeId,'suzhou-jiangsu');assert.match(early12('kuaiji-commandery').summary,/早期范围和后世.*不同/);
 assert.match(early12('westzhou-submit').summary,/不是.*整个西周王朝/);assert.match(early12('wei-yewang-migration').summary,/未把后来卫君角的继位提前/);
});
test('Ancient disaster and territory descriptions never fabricate modern epicentres, bridge sites or world climate coverage',()=>{
 assert.match(early12('dai-earthquake').summary,/不据此制造现代震级、震中/);assert.match(early12('dai-earthquake').locationNote,/不表示.*震中/);
 assert.match(early12('qin-cold-disaster').summary,/不直接换作公历四月/);assert.match(early12('qin-drought').summary,/不.*全球干旱/);assert.match(early12('ningxinzhong-anyang').summary,/未明确桥址/);
 assert.match(early12('hanfei-qin-death').locationNote,/死云阳.*不能/);assert.match(early12('qianzhong-commandery').locationNote,/不断言.*郡治/);assert.match(early12('wei-hedong-cession').locationNote,/不能.*现代半径/);
});
test('All hundred late Warring States milestones display only their indexed year and one national period',()=>{
 const batch=data.events.filter(e=>e.id.includes('-early12-'));assert.equal(batch.length,100);assert.equal(new Set(batch.map(e=>e.id)).size,100);
 for(const e of batch){
  assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1);
  assert.equal(periodForEvent(e,'CN')?.id,'spring-autumn-warring');
  for(const country of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,country),null,e.id+':'+country);
  const f={countryCode:'CN',period:'spring-autumn-warring',city:e.placeId,scope:'year',year:e.year};assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);assert.equal(eventMatches(e,{...f,year:e.year+1},places),false);
 }
});

const early13=key=>{const e=data.events.find(e=>e.id.includes('-early13-')&&e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Qin forced migrations preserve separate years and uncertain northern county totals',()=>{
 for(const[key,bce,id]of [['xianyang-rich-resettlement',221,'xianyang'],['liyi-yunyang-resettlement',212,'lintong-shaanxi'],['beihe-yuzhong-resettlement',211,'baotou'],['north-river-county-resettlement',214,'baotou']]){const e=early13(key);assert.equal(e.year,1-bce);assert.equal(e.placeId,id);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');}
 const north=early13('north-river-county-resettlement');assert.match(north.summary,/三十四.*四十四/);assert.match(north.locationNote,/不能等同于今甘肃榆中县/);
 assert.match(early13('liyi-yunyang-resettlement').summary,/不能解释为现代重庆云阳县/);assert.match(early13('water-virtue-calendar').summary,/不据此断言十月岁首.*首次出现/);
});
test('Qin and early Han references distinguish Xindu, old Dong-e, Linxiang and the terracotta museum',()=>{
 for(const[key,id]of [['zhaoxie-xindu','xingtai'],['donge-relief','pingyin'],['wurui-changsha','changsha'],['wuguan-capture','danfeng-shaanxi'],['puyang-chu-victory','puyang-county'],['baima-grain-raids','huaxian-henan']])assert.equal(early13(key).placeId,id);
 assert.match(early13('zhaoxie-xindu').locationNote,/区别于今衡水冀州/);assert.match(early13('donge-relief').locationNote,/区别于现代聊城东阿县城/);assert.match(early13('wurui-changsha').summary,/不能误用现代.*临湘市/);
 const l=places.get('lintong-shaanxi'),c=places.get('chenzhou-hunan');assert.equal(l.regionCode,'CN-61');assert.equal(l.lon,109.20892);assert.equal(l.lat,34.37803);assert.equal(l.adminLevel,'county');assert.equal(c.regionCode,'CN-43');assert.equal(c.lon,113.03333);assert.equal(c.lat,25.8);assert.equal(c.adminLevel,'city');assert.match(c.description,/区别湘西辰州/);
 for(const key of ['first-emperor-burial','lishan-prisoner-army','zhouwen-at-xi']){assert.equal(early13(key).placeId,'lintong-shaanxi');assert.notEqual(early13(key).placeId,'qin-terracotta-site');}
});
test('Rebel regional governments and southern entry route remain in Qin rather than Western Han filters',()=>{
 for(const[key,bce]of [['tiandan-di-qi',209],['hanguang-yan',209],['zhaoxie-xindu',208],['hancheng-restoration',208],['huaiwang-to-pengcheng',208],['chenliu-grain-access',207],['wan-surrender',207],['zhanghan-yinxu-surrender',207],['wuguan-capture',207],['lantian-qin-defeat',207]]){const e=early13(key);assert.equal(e.year,1-bce);assert.equal(periodForEvent(e,'CN')?.id,'qin');assert.equal(eventMatchesPeriod(e,'western-han','CN'),false);}
 assert.equal(periodForEvent(early13('yidi-to-chen'),'CN')?.id,'western-han');assert.equal(early13('yidi-to-chen').year,-205);assert.equal(early13('yidi-to-chen').placeId,'chenzhou-hunan');
 assert.equal(early13('hancheng-deposed-killed').year,-205);assert.match(early13('hancheng-restoration').summary,/不是同一人/);
});
test('Chuhan supply, city losses and recovery stages display only the selected event year',()=>{
 for(const[key,bce]of [['jingsuo-aocang-corridor',205],['feiqiu-fall',205],['guanzhong-famine-relocation',205],['xiuwu-zhao-army',204],['xingyang-chenggao-loss',204],['pengyue-liang-cities',204],['lishiqi-qi-agreement',204],['yingbu-huainan-king',203],['changle-palace-work',202]]){const e=early13(key),f={countryCode:'CN',period:'western-han',city:e.placeId,scope:'year',year:1-bce};assert.equal(e.year,1-bce);assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);assert.equal(eventMatches(e,{...f,year:e.year+1},places),false);}
 assert.match(early13('feiqiu-fall').summary,/不能将废丘陷落提前/);assert.match(early13('pengyue-liang-cities').summary,/未按未知名单拆造十七个节点/);assert.match(early13('changle-palace-work').summary,/后九月为古历闰月/);
});
test('Ancient winter year conversion is not overwritten by chronicle chapter labels and zero-numeral years stay distinct',()=>{
 const j=data.events.find(e=>e.id==='western-han-bce205-history500-39'),w=data.events.find(e=>e.id==='western-han-bce204-history500-40');assert.ok(j&&w);assert.equal(j.year,-204);assert.equal(w.year,-203);assert.match(j.summary,/汉三年十月折算/);assert.match(w.summary,/汉四年冬季/);
 const drought=early13('huidi-fifth-year-drought');assert.equal(drought.year,-189);assert.equal(yearLabel(drought.year),'公元前 190 年');assert.match(drought.sourceTitle,/前190年/);assert.equal(early13('palace-fires-fourth-year').year,-190);assert.equal(early13('filial-farming-service-exemption').year,-190);
});
test('Han social rules, palace fires and regional disasters preserve the limits of their source evidence',()=>{
 assert.match(early13('demobilization-households').summary,/免役条件依身份有别/);assert.match(early13('filial-farming-service-exemption').summary,/不直接等于全户永免/);assert.match(early13('fallen-soldiers-home').summary,/未据此断言所有阵亡遗体/);
 assert.match(early13('longxi-earthquake').locationNote,/不表示.*震中/);assert.match(early13('huidi-fifth-year-drought').summary,/不能推导.*全球气候变化/);assert.match(early13('palace-fires-fourth-year').summary,/合并同年.*不按三座建筑/);
 assert.equal(early13('zhangliang-death').year,-188);assert.match(early13('zhangliang-death').locationNote,/不表示墓址/);assert.match(early13('lujia-nanyue-envoy').summary,/后段回叙.*不一并归入此年/);
});
test('Seventy-two Qin and early Han records have original sources, year precision and one Chinese period each',()=>{
 const batch=data.events.filter(e=>e.id.includes('-early13-'));assert.equal(batch.length,72);assert.equal(batch.filter(e=>e.periodId==='qin').length,31);assert.equal(batch.filter(e=>e.periodId==='western-han').length,41);
 assert.equal(data.meta.collections.find(c=>c.id==='qin').events,66);assert.equal(data.meta.collections.find(c=>c.id==='western-han').events,795);
 for(const e of batch){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);assert.match(e.sourceUrl,/zh\.wikisource\.org\/zh-hans\/(史記|資治通鑑)/);assert.equal(e.sources[0].url,e.sourceUrl);assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1);for(const country of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,country),null,e.id+':'+country);}
});

const early14=key=>{const e=data.events.find(e=>e.id.includes('-early14-')&&e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Luhou and Wendi currency measures and recurring rent changes retain separate policy years',()=>{
 for(const[key,bce]of [['eight-zhu-coins',186],['five-fen-money',182],['four-zhu-open-minting',175],['first-half-land-rent',178],['second-half-land-rent',168]]){const e=early14(key);assert.equal(e.year,1-bce);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');const f={countryCode:'CN',period:'western-han',scope:'year',year:e.year};assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:e.year+1},places),false);}
 assert.match(early14('five-fen-money').summary,/不把古五分解释为现代/);assert.match(early14('four-zhu-open-minting').summary,/撤除盗铸钱令/);
 assert.ok(data.events.some(e=>e.id==='western-han-bce167-supplement-14'&&e.year===-166));assert.ok(data.events.some(e=>e.id==='western-han-bce156-supplement-15'&&e.year===-155));
});
test('Han social and mourning rules preserve who benefited and distinguish public mourning from private ceremonies',()=>{
 for(const[key,bce]of [['elderly-poor-relief-rules',179],['huidi-palace-women-released',168],['official-slaves-commoners',160],['wendi-shortened-mourning',157],['voluntary-land-migration',156]])assert.equal(early14(key).year,1-bce);
 assert.match(early14('elderly-poor-relief-rules').summary,/刑罪身份的适用限制/);assert.match(early14('official-slaves-commoners').summary,/不将它等同于.*全部私人奴隶制度/);assert.match(early14('wendi-shortened-mourning').summary,/吏民.*三日.*私人丧礼/);
 assert.match(early14('voluntary-land-migration').summary,/有迁居意愿.*不把它说成.*强制移民/);
});
test('Seven Kingdoms local stages can be retrieved separately by city in the same year',()=>{
 for(const[key,id]of [['linzi-siege-relief','linzi'],['wu-king-dantu-death','zhenjiang']]){const e=early14(key),f={countryCode:'CN',period:'western-han',city:id,scope:'year',year:-153};assert.equal(e.placeId,id);assert.equal(e.year,-153);assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,city:id==='linzi'?'zhenjiang':'linzi'},places),false);}
 assert.equal(early14('rebel-coerced-amnesty').year,-153);assert.match(early14('rebel-coerced-amnesty').summary,/受胁|被胁/);assert.match(early14('wu-king-dantu-death').locationNote,/不将旧丹徒城.*现代丹徒新区/);
 for(const[key,bce]of [['yanmen-shangjun-raids',144],['fengjing-yanmen-death',142]]){const e=early14(key);assert.equal(e.year,1-bce);assert.equal(e.placeId,'daixian');}
});
test('Early Han sites avoid modern namesakes and annotations identify horses as the confiscated property',()=>{
 for(const key of ['changling-city-work','yangling-town-resettlement','deyang-palace-work','yangling-convict-sentence-adjustment'])assert.equal(early14(key).placeId,'xianyang');
 assert.match(early14('yangling-town-resettlement').summary,/不能把古阳陵邑套成今天的杨陵区/);assert.match(early14('deyang-palace-work').summary,/不把它误认为东汉洛阳/);assert.match(early14('deyang-palace-work').locationNote,/不指四川德阳市/);
 const feed=early14('grain-horse-feed-ban');assert.match(feed.summary,/没收相关马匹/);assert.doesNotMatch(feed.summary,/没收相关用粮/);assert.ok(feed.sources.some(s=>s.url.includes('漢書顏師古註/卷005')));
 assert.match(early14('compulsory-precious-mining-ban').summary,/出资雇工/);assert.match(early14('horse-export-restriction').summary,/高大且齿未平/);
});
test('Jingdi judicial reporting stages and travel-permit reversals remain independent in the timeline',()=>{
 for(const[key,bce]of [['doubtful-case-reporting',145],['doubtful-case-review-levels',143],['passes-without-permits',168],['travel-permits-restored',153]])assert.equal(early14(key).year,1-bce);
 assert.match(early14('doubtful-case-review-levels').summary,/先报有司.*移廷尉/);assert.match(early14('dismemberment-execution-change').summary,/不把取消.*全面废除死刑/);
 assert.equal(early14('grand-commandant-abolished').year,-149);assert.match(early14('clan-and-speech-penalties').summary,/不据此断言.*永久消失/);assert.match(early14('zhouyafu-prison-death').summary,/不将原典指控.*谋反事实已经证实/);
});
test('Luhou and Wendi disasters distinguish repeated years and regional markers from epicenters',()=>{
 for(const[key,bce,id]of [['qiangdao-wudu-earthquake',186,'longnan'],['jiang-han-flood',185,'wuhan'],['yi-luo-ru-flood',185,'luoyang'],['jiang-han-renewed-flood',180,'wuhan'],['qi-chu-earthquake',179,'linzi']]){const e=early14(key);assert.equal(e.year,1-bce);assert.equal(e.placeId,id);}
 assert.match(early14('qiangdao-wudu-earthquake').locationNote,/不表示震中/);assert.match(early14('yi-luo-ru-flood').locationNote,/汝水流域.*其他地区/);assert.match(early14('food-shortage-policy-inquiry').summary,/不把回顾的多年灾情.*本年新发生/);
 const expedition=early14('zhouzao-nanyue-expedition');assert.equal(expedition.year,-180);assert.ok(expedition.sources.some(s=>/回叙.*不是将派兵改记前179年/.test(s.title)));assert.match(expedition.summary,/不把后续病疫、撤军/);
});
test('Seventy-five Han annual entries keep original calendar precision and unambiguous Chinese ownership',()=>{
 const batch=data.events.filter(e=>e.id.includes('-early14-'));assert.equal(batch.length,75);assert.equal(data.meta.collections.find(c=>c.id==='western-han').events,795);
 assert.equal(new Set(batch.map(e=>e.placeId)).size,15);
 for(const e of batch){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);assert.match(e.sourceUrl,/zh\.wikisource\.org\/zh-hans\/(漢書|資治通鑑)\/卷\d{3}#/);assert.equal(e.sources[0].url,e.sourceUrl);assert.match(e.locationNote,/纪年按.*年级索引/);assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1);for(const c of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,c),null,e.id+':'+c);}
});

const early15=key=>{const e=data.events.find(e=>e.id.includes('-early15-')&&e.id.endsWith('-'+key));assert.ok(e,key);return e;};
test('Wudi coin reversals, estate subsidies and forced relocation preserve policy sequence',()=>{
 for(const[key,bce]of [['three-zhu-coin',140],['half-liang-restoration',136],['maoling-settlement-founded',139],['maoling-migrant-incentive',138],['wealthy-migration-to-maoling',127]]){const e=early15(key);assert.equal(e.year,1-bce);assert.equal(yearLabel(e.year),'公元前 '+bce+' 年');const f={countryCode:'CN',period:'western-han',scope:'year',year:e.year};assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:e.year+1},places),false);}
 assert.match(early15('maoling-migrant-incentive').summary,/每户获钱二十万、田二顷/);assert.match(early15('wealthy-migration-to-maoling').summary,/迁徙郡国豪杰/);
});
test('Wudi welfare and duty relief retain target populations and local distribution',()=>{
 assert.match(early15('elder-family-duty-relief').summary,/子或孙免役/);assert.match(early15('elders-vulnerable-gifts-inspection').summary,/县乡就地发放/);
 assert.match(early15('guard-reduction-pasture-opening').summary,/放牧、采樵/);assert.match(early15('seven-state-confiscated-families-release').summary,/官奴婢/);
 assert.equal(early15('three-border-garrisons-reduced').year,-119);assert.match(early15('three-border-garrisons-reduced').summary,/不将三郡.*全国/);
 assert.equal(early15('six-doctors-local-inspection').year,-116);assert.equal(early15('poor-cloth-grant').year,-104);
});
test('Local Han disasters and works are searchable without confusing ancient and modern namesakes',()=>{
 const flood=early15('pingyuan-flood-famine');assert.equal(flood.placeId,'pingyuan-shandong');assert.equal(flood.year,-137);const p=places.get(flood.placeId);assert.equal(p.regionCode,'CN-37');assert.match(flood.locationNote,/张官店/);
 const huojia=early15('huojia-county-name');assert.equal(huojia.placeId,'xinxiang-county');assert.equal(huojia.year,-110);assert.match(huojia.locationNote,/与今获嘉县城不同/);assert.match(places.get(huojia.placeId).description,/不是汉代新中乡/);
 assert.equal(eventMatches(huojia,{countryCode:'CN',period:'western-han',city:'xinxiang-county',scope:'year',year:-110},places),true);
 assert.equal(early15('mingguang-palace-built').placeId,'xian');assert.match(early15('mingguang-palace-built').summary,/误配.*安徽/);
 assert.equal(early15('juyan-frontier-work').placeId,'ejina');assert.equal(early15('wuyuan-frontier-forts').placeId,'wuyuan-inner-mongolia');
});
test('Wudi floods, rescue logistics and partial forced migration retain geographic limits',()=>{
 assert.equal(early15('yellow-river-course-breach').placeId,'puyang-county');assert.equal(early15('yellow-river-course-breach').year,-131);
 assert.equal(early15('jiangnan-bashu-grain-relief').placeId,'jingzhou');assert.match(early15('jiangnan-bashu-grain-relief').summary,/巴蜀粮食运抵江陵/);
 assert.equal(early15('liaodong-gaomiao-fire').placeId,'liaoyang');assert.equal(early15('gaoyuan-side-hall-fire').placeId,'xianyang');
 assert.match(early15('wudu-di-partial-migration').summary,/并非全部迁走/);assert.equal(early15('wudu-di-partial-migration').placeId,'jiuquan');
 assert.equal(early15('locusts-reach-dunhuang').year,-103);assert.equal(early15('locusts-reach-dunhuang').placeId,'dunhuang');
});
test('Late-Han old-calendar winter entries are not invented from chapter years',()=>{
 assert.equal(early15('yunzhong-yanmen-garrisons-ended').year,-133);assert.match(early15('yunzhong-yanmen-garrisons-ended').locationNote,/六月罢屯/);
 const gate=early15('wuguan-commandery-duty-tax');assert.equal(gate.year,-100);assert.equal(gate.placeId,'danfeng-shaanxi');assert.match(gate.locationNote,/太初改历后.*正月.*冬段/);
 assert.equal(data.events.filter(e=>e.id.includes('-early15-')&&/白金|皮币|张汤.*自杀|初算商车|公孙弘.*拜相|闻喜.*置/.test(e.title)).length,0);
 for(const key of ['yan-yi-fu-fei-case','zhao-ponu-expedition-lost','li-cai-mausoleum-land-case'])assert.equal(early15(key).precision,'year');
});
test('Jingdi second beating reform is corrected to middle sixth year without changing stable ID',()=>{
 const id='western-han-bce142-history500c-77',e=data.events.find(e=>e.id===id);assert.ok(e);assert.equal(e.year,-143);assert.equal(yearLabel(e.year),'公元前 144 年');assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.periodId,'western-han');
 assert.match(e.title,/再次减笞.*棰令/);assert.match(e.summary,/三百、二百.*二百、一百/);assert.ok(e.sources.some(s=>s.url.includes('漢書/卷023')));assert.ok(e.sources.some(s=>s.url.includes('資治通鑑/卷016')));
 assert.equal(data.events.filter(x=>x.periodId==='western-han'&&/减笞|減笞/.test(x.title)).length,1);
 const f={countryCode:'CN',period:'western-han',scope:'year',year:-143};assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:-141},places),false);
});
test('Wudi legal and culture entries distinguish retrospective context and separate performances',()=>{
 assert.equal(early15('jian-zhi-law-compilation').year,-129);assert.match(early15('jian-zhi-law-compilation').summary,/张汤、赵禹/);
 assert.equal(early15('yan-yi-fu-fei-case').year,-116);assert.match(early15('yan-yi-fu-fei-case').summary,/此前币制讨论/);
 assert.equal(early15('jiaodi-performance').year,-107);assert.equal(early15('pingle-jiaodi-show').year,-104);assert.match(early15('pingle-jiaodi-show').summary,/明确场馆和年度/);
 assert.equal(early15('lv-jia-nanyue-coup').year,-111);assert.equal(early15('lv-jia-nanyue-coup').placeId,'guangzhou');
});
test('Eighty-three Han annual entries preserve evidence precision and Chinese period ownership',()=>{
 const batch=data.events.filter(e=>e.id.includes('-early15-'));assert.equal(batch.length,83);assert.equal(new Set(batch.map(e=>e.placeId)).size,19);assert.equal(data.meta.collections.find(c=>c.id==='western-han').events,795);
 for(const e of batch){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);assert.match(e.sourceUrl,/zh\.wikisource\.org\/zh-hans\/(漢書|資治通鑑)\/卷\d{3}#/);assert.equal(e.sources[0].url,e.sourceUrl);assert.match(e.locationNote,/纪年按.*年级索引/);assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1);for(const c of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,c),null,e.id+':'+c);}
});

const early16=key=>data.events.find(e=>e.id.endsWith('-early16-'+key));
test('Late Han additions retain year precision and a single geographic period selection',()=>{
 const batch=data.events.filter(e=>e.id.includes('-early16-'));assert.equal(batch.length,60);assert.equal(new Set(batch.map(e=>e.placeId)).size,22);assert.equal(batch.filter(e=>e.approximate).length,3);assert.equal(data.meta.collections.find(c=>c.id==='western-han').events,795);
 for(const e of batch){assert.ok(e.year>=-99&&e.year<=-86);assert.equal(e.date,null);assert.equal(e.endYear,undefined);assert.equal(e.precision,'year');assert.equal(e.sources[0].url,e.sourceUrl);assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1);for(const c of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,c),null,e.id+':'+c);}
});
test('Su Wu departure and later return remain independent historical nodes',()=>{
 const e=early16('suwu-embassy-departure'),r=data.events.find(e=>e.id==='cn-bce81-han-suwu-return');assert.equal(e.year,-99);assert.equal(r.year,-80);assert.equal(e.placeId,'xian');assert.match(e.summary,/不把其后十九年/);assert.equal(eventMatches(e,{countryCode:'CN',period:'western-han',scope:'year',year:r.year},places),false);
});
test('Li Guangli campaigns and Li Ling family punishment use their distinct years',()=>{
 const a=early16('li-guangli-jiuquan-campaign'),b=early16('li-guangli-wuyuan-last-campaign'),c=early16('liling-family-punished');assert.equal(a.year,-98);assert.equal(a.placeId,'jiuquan');assert.equal(b.year,-89);assert.equal(b.placeId,'wuyuan-inner-mongolia');assert.equal(c.year,-96);assert.match(c.summary,/李绪/);assert.equal(data.events.find(e=>e.id==='western-han-bce99-history500c-87').year,-98);assert.equal(eventMatches(b,{countryCode:'CN',period:'western-han',scope:'year',year:a.year},places),false);
});
test('Cheshi retreat and later successful siege are separated rather than duplicated',()=>{
 const a=early16('cheshi-campaign-retreat'),b=early16('cheshi-six-state-siege');assert.equal(a.placeId,'turpan');assert.equal(b.placeId,'turpan');assert.equal(a.year,-98);assert.equal(b.year,-89);assert.match(a.summary,/不.*已经征服/);const f={countryCode:'CN',period:'western-han',city:'turpan',scope:'year',year:b.year};assert.equal(eventMatches(b,f,places),true);assert.equal(eventMatches(a,f,places),false);
});
test('Wine monopoly, gold shapes and criminal redemption preserve policy distinctions',()=>{
 assert.equal(early16('wine-monopoly-start').year,-97);assert.equal(early16('linzhi-niaoti-gold').year,-94);assert.match(early16('linzhi-niaoti-gold').summary,/铜钱面值/);assert.equal(early16('death-sentence-redemption').year,-96);assert.match(early16('death-sentence-redemption').summary,/减死一等/);assert.match(early16('seven-class-recruitment').summary,/七类/);
});
test('Modern Rongcheng and Chunhua references distinguish settlements from ancient sites',()=>{
 const r=places.get('rongcheng-shandong'),c=places.get('chunhua-shaanxi');assert.equal(r.lon,122.43762);assert.equal(r.lat,37.1566);assert.equal(r.regionCode,'CN-37');assert.equal(c.lon,108.575);assert.equal(c.lat,34.79889);assert.equal(c.regionCode,'CN-61');assert.equal(r.adminLevel,'county');assert.equal(c.adminLevel,'county');assert.match(r.description,/不是成山头/);assert.match(c.description,/不是古云阳/);assert.equal(early16('chengshan-coastal-ritual').placeId,r.id);assert.equal(early16('foreign-guests-ganquan').placeId,c.id);assert.equal(early16('changyi-liubo-death').placeId,'juye');
});
test('Witchcraft main event remains intact while institutional changes are separate',()=>{
 const main=data.events.find(e=>e.id==='western-han-bce91-witchcraft-crisis');assert.equal(main.year,-90);assert.equal(data.events.filter(e=>e.title==='巫蛊之祸与太子刘据败亡').length,1);assert.match(early16('envoy-yellow-banner-change').summary,/黄旄/);assert.match(early16('changan-gates-garrison').summary,/太子仍在外/);assert.equal(early16('gongsun-jingsheng-northern-army-funds').year,-91);assert.equal(early16('gongsun-he-death-chancellor-change').year,-90);
});
test('Retrospective passages explicitly use approximate reference years',()=>{
 for(const key of ['witchcraft-later-accountability','hu-wangsi-terrace','imperial-seal-official-refusal']){const e=early16(key),f={countryCode:'CN',period:'western-han',city:e.placeId,scope:'year',year:e.year};assert.equal(e.approximate,true);assert.match(e.title,/（约）$/);assert.match(e.locationNote,/约年/);assert.equal(eventMatches(e,f,places),true);assert.equal(eventMatches(e,{...f,year:e.year+1},places),false);assert.equal(eventMatches(e,{...f,year:e.year-1},places),false);}
});
test('Yunyang textual variants do not invent a Yunling foundation before Zhao',()=>{
 const a=early16('maoling-yunyang-resettlement'),b=early16('zhao-taihou-yunling-established');assert.equal(a.year,-95);assert.equal(b.year,-86);assert.match(a.summary,/颜师古认为应作云阳/);assert.match(a.summary,/尚未设/);assert.match(b.sourceTitle,/昭帝纪/);assert.match(b.summary,/次年再起园庙/);assert.match(a.locationNote,/太初改历后以正月/);
});
test('Wu burial and Zhao care remain separate from the existing accession record',()=>{
 const main=data.events.find(e=>e.id==='western-han-bce87-history500b-69'),burial=early16('wudi-maoling-burial');assert.equal(main.placeId,'zhouzhi');assert.equal(burial.placeId,'xingping');assert.equal(burial.year,main.year);assert.match(burial.summary,/三月/);assert.match(early16('eyichang-princess-care').summary,/不.*现代湖北鄂州/);const f={countryCode:'CN',period:'western-han',city:'xingping',scope:'year',year:-86};assert.equal(eventMatches(burial,f,places),true);assert.equal(eventMatches(main,f,places),false);
});

const early17=key=>data.events.find(e=>e.id.endsWith('-early17-'+key));
const f17=(e,year,extra={})=>eventMatches(e,{countryCode:'CN',period:'western-han',scope:'year',year,...extra},places);
test('Zhao and Xuan corpus retains geographic ownership and year-only indexing',()=>{
 const batch=data.events.filter(e=>e.id.includes('-early17-'));assert.equal(batch.length,121);assert.equal(new Set(batch.map(e=>e.placeId)).size,28);assert.equal(data.meta.collections.find(c=>c.id==='western-han').events,795);
 for(const e of batch){assert.ok(e.year>=-85&&e.year<=-48);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);assert.equal(e.sources[0].url,e.sourceUrl);assert.equal(f17(e,e.year),true);assert.equal(f17(e,e.year-1),false);assert.equal(f17(e,e.year+1),false);assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1);for(const c of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,c),null,e.id+':'+c);}
});
test('Yizhou expeditions and later reports do not appear together in a single year',()=>{
 const records=[early17('yizhou-levies'),early17('yizhou-new-commander'),early17('yizhou-campaign-report')];assert.deepEqual(records.map(e=>e.year),[-85,-82,-81]);for(const e of records)assert.equal(e.placeId,'jinning');for(const year of [-85,-82,-81])assert.equal(records.filter(e=>f17(e,year,{city:'jinning'})).length,1);assert.match(records[0].summary,/吕破胡.*吕辟胡/);
});
test('Yunling voluntary and selected household migrations preserve different stages',()=>{
 const records=[early17('yunling-garden-temple'),early17('yunling-voluntary-migration'),early17('yunling-wealthy-households')];assert.deepEqual(records.map(e=>e.year),[-85,-83,-82]);for(const e of records)assert.equal(e.placeId,'chunhua-shaanxi');for(const e of records)assert.equal(records.filter(r=>f17(r,e.year,{city:'chunhua-shaanxi'})).length,1);assert.match(records[2].summary,/按户赐钱十万/);
});
test('Pingling household recruitment precedes state-funded housing by one year',()=>{
 const recruit=early17('pingling-million-households'),build=early17('pingling-state-funded-housing');assert.equal(recruit.year,-72);assert.equal(build.year,-71);assert.equal(recruit.placeId,'xianyang');assert.equal(build.placeId,'xianyang');assert.equal(f17(build,recruit.year),false);assert.equal(f17(recruit,build.year),false);assert.match(recruit.summary,/资财标准/);assert.match(build.summary,/水衡钱/);
});
test('Existing Wusun battle identity migrates from mobilization year to actual expedition year',()=>{
 const mobilize=early17('wusun-mobilization'),battle=data.events.find(e=>e.id==='western-han-bce72-history500c-89');assert.equal(mobilize.year,-71);assert.equal(battle.year,-70);assert.equal(battle.placeId,'yining');assert.equal(battle.periodId,'western-han');assert.equal(yearLabel(battle.year),'公元前 71 年');assert.equal(f17(battle,-71),false);assert.equal(f17(battle,-70),true);assert.equal(f17(mobilize,-70),false);assert.match(battle.summary,/前一年征调/);assert.ok(battle.sources.some(s=>s.url.includes('漢書/卷008'))&&battle.sources.some(s=>s.url.includes('資治通鑑/卷024')));
});
test('The accession year and the first Benshi year remain separate in browsing',()=>{
 const empress=early17('xupingjun-enthroned'),guards=early17('changle-garrison'),migration=early17('pingling-million-households');assert.equal(empress.year,-73);assert.equal(guards.year,-73);assert.equal(migration.year,-72);assert.equal(f17(empress,migration.year),false);assert.equal(f17(migration,guards.year),false);assert.equal(yearLabel(empress.year),'公元前 74 年');
});
test('Yang Yun dismissal and capital punishment retain their separate chronicle years',()=>{
 const dismissed=early17('yang-yun-dismissal'),executed=early17('yang-yun-execution');assert.equal(dismissed.year,-55);assert.equal(executed.year,-53);assert.equal(f17(executed,dismissed.year),false);assert.equal(f17(dismissed,executed.year),false);assert.match(dismissed.summary,/没有在此时处死/);assert.match(executed.summary,/书信/);
});
test('Zhao Guanghan year follows the explicit chronological collation',()=>{
 const e=early17('zhao-guanghan-execution');assert.equal(e.year,-64);assert.equal(f17(e,-64),true);assert.equal(f17(e,-63),false);assert.ok(e.sources.some(s=>s.title.includes('考异')));assert.match(e.summary,/元康二年.*元康元年/);assert.equal(e.date,null);
});
test('Old-lawsuit cutoff and next-year audience exemption are not generalized two-year rules',()=>{
 const lawsuits=early17('old-lawsuits-cutoff'),audience=early17('next-year-audience-remission');assert.equal(lawsuits.year,-82);assert.match(lawsuits.summary,/武帝后元二年/);assert.equal(audience.year,-60);assert.match(audience.summary,/前61年的发布决定.*前60年/);assert.ok(lawsuits.sources.some(s=>s.url.includes('漢書顏師古註/卷007'))&&audience.sources.some(s=>s.url.includes('漢書顏師古註/卷008')));assert.equal(f17(audience,-59),false);
});
test('Fangling destinations use Hubei Fangxian and remain distinct from Shangyong',()=>{
 const county=places.get('fangxian-hubei');assert.equal(county.name,'房县');assert.equal(county.regionCode,'CN-42');assert.equal(county.adminLevel,'county');assert.equal(county.lat,32.055);assert.equal(county.lon,110.73417);assert.match(county.description,/江苏访仙/);const a=early17('qinghe-king-fangling'),b=early17('guangchuan-haiyang-fangling'),c=early17('guangchuan-upyong-exile');assert.equal(a.year,-65);assert.equal(b.year,-49);assert.equal(a.placeId,county.id);assert.equal(b.placeId,county.id);assert.equal(c.placeId,'zhushan');assert.equal(f17(a,b.year,{region:'CN-42',city:county.id}),false);assert.equal(f17(b,b.year,{region:'CN-42',city:county.id}),true);assert.match(c.summary,/途中自杀/);
});
test('Daner adjustment and Xincai relief support province and county filtering',()=>{
 const e=early17('daner-commandery-abolished'),r=early17('xincai-rent-rewards');assert.equal(e.year,-81);assert.equal(places.get(e.placeId).regionCode,'CN-46');assert.equal(f17(e,e.year,{region:'CN-46'}),true);assert.equal(f17(e,e.year,{region:'CN-42'}),false);assert.equal(r.placeId,'xincai');assert.equal(r.year,-50);assert.equal(f17(r,r.year,{city:'xincai',region:'CN-41',category:'社会'}),true);assert.equal(f17(r,r.year+1,{city:'xincai'}),false);
});
test('Salt-iron deliberation and wine implementation remain separate selectable events',()=>{
 const wine=early17('wine-monopoly-ended'),debate=data.events.find(e=>e.id==='western-han-bce81-salt-iron-debate');assert.equal(wine.year,debate.year);assert.notEqual(wine.id,debate.id);assert.equal(wine.category,'经济');assert.match(wine.summary,/每升四钱/);assert.match(wine.summary,/不把罢榷酤扩大为盐、铁全部专卖/);assert.equal(f17(wine,wine.year,{category:'经济'}),true);
});

const early18=key=>data.events.find(e=>e.id.endsWith('-early18-'+key));
const f18=(e,year,extra={})=>eventMatches(e,{countryCode:'CN',period:'western-han',scope:'year',year,...extra},places);
test('Yuan and Cheng corpus remains year-only and belongs to the Chinese Western Han period',()=>{
 const batch=data.events.filter(e=>e.id.includes('-early18-'));assert.equal(batch.length,103);assert.equal(data.meta.collections.find(c=>c.id==='western-han').events,795);
 for(const e of batch){assert.ok(e.year>=-47&&e.year<=-8);assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.endYear,undefined);assert.equal(e.approximate,undefined);assert.equal(e.sources[0].url,e.sourceUrl);assert.equal(f18(e,e.year),true);assert.equal(f18(e,e.year-1),false);assert.equal(f18(e,e.year+1),false);assert.equal(HISTORY_PERIODS.filter(p=>!p.navigationOnly&&eventMatchesPeriod(e,p.id,'CN')).length,1);for(const c of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK'])assert.equal(periodForEvent(e,c),null,e.id+':'+c);}
});
test('Doctoral disciple expansion and renewed quota remain separate in year browsing',()=>{
 const open=early18('unlimited-doctoral-disciples'),limit=early18('thousand-doctoral-disciples');assert.equal(open.year,-43);assert.equal(limit.year,-40);assert.equal(open.category,'文化');assert.equal(f18(open,limit.year),false);assert.equal(f18(limit,open.year),false);assert.match(open.summary,/不再设置固定员额/);assert.match(limit.summary,/千人/);
});
test('The forty-coin poll-tax reduction is not mistaken for a forty-coin total',()=>{
 const e=early18('poll-tax-forty-reduction');assert.equal(e.year,-30);assert.equal(yearLabel(e.year),'公元前 31 年');assert.match(e.summary,/一百二十.*减四十后为八十/);assert.ok(e.sources.some(s=>s.url.includes('漢書顏師古註/卷010')));assert.equal(f18(e,-30,{category:'经济'}),true);assert.equal(f18(e,-31,{category:'经济'}),false);
});
test('Temple closure and partial restorations appear in their respective years',()=>{
 const rows=[early18('ancestral-temple-reorganization'),early18('restore-mausoleum-temples'),early18('restore-supreme-emperor-temple')];assert.deepEqual(rows.map(e=>e.year),[-39,-33,-27]);for(const e of rows)assert.equal(rows.filter(r=>f18(r,e.year)).length,1);assert.match(rows[0].summary,/郡国/);assert.match(rows[1].summary,/郡国庙未一并恢复/);assert.match(rows[2].summary,/太上皇/);
});
test('Changling work, actual household movement, closure and later penalties do not collapse',()=>{
 const start=data.events.find(e=>e.id==='cn-bce20-han-changling-work-start'),move=early18('changling-five-thousand-households'),stop=data.events.find(e=>e.id==='cn-bce16-han-changling-abandoned'),penalty=early18('changling-builders-exile');const rows=[start,move,stop,penalty];assert.deepEqual(rows.map(e=>e.year),[-19,-18,-15,-14]);for(const e of rows)assert.equal(rows.filter(r=>f18(r,e.year)).length,1);assert.equal(move.placeId,'xianyang');assert.equal(penalty.placeId,'dunhuang');assert.match(move.summary,/五百万.*五千户/);assert.match(penalty.summary,/解万年、陈汤.*敦煌/);
});
test('Flood, first repair and later Pingyuan failure preserve different episodes',()=>{
 const flood=early18('jindi-breach-evacuation'),first=data.events.find(e=>e.id==='cn-bce28-han-jindi-wangyanshi-repair'),second=early18('pingyuan-second-repair');assert.deepEqual([flood.year,first.year,second.year],[-28,-27,-25]);assert.match(flood.summary,/四郡、三十二县/);assert.match(flood.summary,/九万七千/);assert.equal(second.placeId,'pingyuan-shandong');assert.equal(f18(second,first.year),false);assert.equal(f18(flood,flood.year,{city:'puyang-county'}),true);
});
test('New modern geographic references retain coordinate and province consistency',()=>{
 for(const[id,lat,lon,region,admin]of [['anshun-guizhou',26.25,105.93333,'CN-52','city'],['xichang-city',27.89642,102.26341,'CN-51','county'],['pishan-xinjiang',37.59929,78.27545,'CN-65','county']]){const p=places.get(id);assert.equal(p.countryCode,'CN');assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.regionCode,region);assert.equal(p.adminLevel,admin);assert.ok(p.sources.some(s=>s.url.includes('geonames.org')));assert.ok(data.events.some(e=>e.id.includes('-early18-')&&e.placeId===id));}
 const yelang=early18('chenli-yelang'),pishan=early18('pishan-mission-limit');assert.match(yelang.locationNote,/地望|争议/);assert.equal(f18(yelang,yelang.year,{region:'CN-52',city:'anshun-guizhou'}),true);assert.equal(f18(yelang,yelang.year,{region:'CN-51'}),false);assert.equal(f18(pishan,pishan.year,{region:'CN-65',city:'pishan-xinjiang'}),true);
});
test('Minshan blockage does not fabricate a measured earthquake or an exact mountain location',()=>{
 const e=early18('minshan-river-blockage');assert.equal(e.year,-9);assert.equal(e.placeId,'chengdu');assert.match(e.summary,/壅江三日/);assert.match(e.summary,/不能据山崩直接判定一定发生地震/);assert.match(e.locationNote,/山体及壅江河段未定/);assert.equal(e.date,null);
});
test('Hejian exile uses the Hubei Fangling destination rather than the original kingdom',()=>{
 const e=early18('hejianking-exile');assert.equal(e.year,-37);assert.equal(e.placeId,'fangxian-hubei');assert.equal(f18(e,-37,{region:'CN-42',city:'fangxian-hubei'}),true);assert.equal(f18(e,-37,{region:'CN-13'}),false);assert.match(e.summary,/迁往房陵/);
});
test('Dingtao succession discussion is indexed before the actual next-year crown-prince creation',()=>{
 const e=early18('dingtao-succession-discussion');assert.equal(e.year,-8);assert.equal(yearLabel(e.year),'公元前 9 年');assert.match(e.summary,/次年前8年/);assert.equal(f18(e,-8),true);assert.equal(f18(e,-7),false);assert.doesNotMatch(e.title,/立.*太子/);
});

const early19=key=>data.events.find(e=>e.id.endsWith('-early19-'+key));
const f19=(e,year,extra={})=>eventMatches(e,{countryCode:'CN',period:'western-han',scope:'year',year,...extra},places);
test('Late Western Han records preserve single-year navigation and national ownership',()=>{
 const rows=data.events.filter(e=>e.id.includes('-early19-'));assert.equal(rows.length,107);assert.equal(data.meta.collections.find(c=>c.id==='western-han').events,795);
 for(const e of rows){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.ok(e.year>=-7&&e.year<=8);assert.equal(f19(e,e.year),true);assert.equal(f19(e,e.year-1),false);assert.equal(f19(e,e.year+1),false);assert.equal(places.get(e.placeId).countryCode,'CN');for(const code of['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','LK','NP'])assert.equal(periodForEvent(e,code),null);}
});
test('One BCE is zero in navigation while Ruzi is appointed crown prince rather than emperor',()=>{
 const visit=early19('foreign-rulers-visit'),heir=early19('ruzi-crown-prince');assert.equal(visit.year,0);assert.equal(yearLabel(visit.year),'公元前 1 年');assert.equal(f19(visit,1),false);assert.equal(heir.year,6);assert.match(heir.summary,/皇太子.*并未即皇帝位/);assert.equal(eventMatchesPeriod(heir,'xin','CN'),false);
});
test('Repeated three-office reforms are indexed as distinct reversals',()=>{
 const rows=['san-gong','censor-restored','three-offices-reorganized'].map(early19);assert.deepEqual(rows.map(e=>e.year),[-7,-4,0]);assert.match(rows[0].summary,/御史大夫改为大司空/);assert.match(rows[1].summary,/恢复御史大夫/);assert.match(rows[2].summary,/大司徒/);for(const e of rows)assert.equal(rows.filter(r=>f19(r,e.year)).length,1);
});
test('Detention limits retain personal-offence and specifically named arrest exceptions',()=>{
 const e=early19('detention-family-limits');assert.equal(e.year,4);assert.match(e.summary,/妇女非本人犯法/);assert.match(e.summary,/八十以上、七岁以下/);assert.match(e.summary,/家非坐不道.*非诏书名捕/);assert.match(e.summary,/不得系/);assert.equal(f19(e,4,{category:'制度'}),true);
});
test('Retirement pay and disaster rent relief retain their rank and means conditions',()=>{
 const pay=early19('retirement-third'),relief=early19('qingzhou-drought-locust');assert.match(pay.summary,/比二千石以上.*一份/);assert.equal(pay.year,1);assert.match(relief.summary,/不满二万.*不满十万/);assert.equal(relief.year,2);assert.equal(relief.placeId,'linzi');assert.equal(f19(relief,2,{region:'CN-37'}),true);
});
test('Female convict return keeps the monthly charge and epidemic burial aid keeps three thresholds',()=>{
 const home=early19('female-convicts-gu-shan'),aid=early19('epidemic-medicine');assert.match(home.summary,/每月.*三百/);assert.match(home.summary,/并非无条件赦免/);assert.match(aid.summary,/六尸以上.*五千.*四尸以上.*三千.*二尸以上.*二千/);
});
test('Modern county points distinguish Qinghai Haiyan, Gansu Huating and Shaanxi Gaoling',()=>{
 for(const[id,region,lat,lon]of[['hepu-guangxi','CN-45',21.65921,109.20011],['huating-gansu','CN-62',35.2152,106.653],['gaoling-shaanxi','CN-61',34.53596,109.08508],['haiyan-qinghai','CN-63',36.89083,100.99972]]){const p=places.get(id);assert.equal(p.regionCode,region);assert.equal(p.countryCode,'CN');assert.equal(p.adminLevel,'county');assert.equal(p.lat,lat);assert.equal(p.lon,lon);}
 const settlement=early19('anding-anmin-settlement'),revolt=early19('renheng-yangling');assert.match(settlement.summary,/古注另有中山安定说/);assert.equal(f19(settlement,2,{region:'CN-62',city:'huating-gansu'}),true);assert.equal(f19(settlement,2,{region:'CN-64'}),false);assert.match(revolt.summary,/区别现代杨凌区/);assert.equal(f19(revolt,3,{city:'gaoling-shaanxi'}),true);
});
test('Flood and earthquake numbers remain attached to the right measures',()=>{
 const water=early19('henan-yingchuan-flood'),quake=early19('thirty-region-quake');assert.match(water.summary,/棺钱每人三千/);assert.match(water.summary,/十分之四.*不满十万/);assert.match(quake.summary,/压死四百余人/);assert.doesNotMatch(quake.summary,/城郭四百/);for(const key of['beidi-meteorites','yu-meteorites','julu-meteorites'])assert.match(early19(key).summary,/撞击坑/);
});
test('School rules and river proposals do not assert universal construction completion',()=>{
 const school=early19('local-schools'),river=early19('river-plans-unexecuted');assert.equal(school.year,3);assert.match(school.summary,/郡国称学.*乡称庠.*聚称序/);assert.match(school.summary,/不能.*均已竣工/);assert.equal(river.year,4);assert.match(river.summary,/没有施行/);assert.equal(river.category,'营建');
});
test('Western border and Guanzhong campaigns retain successive actual years',()=>{
 for(const keys of[['xihai-attack','xihai-suppression'],['zhaoming-huoluan','guanzhong-rebellion-end']]){const rows=keys.map(early19);assert.equal(rows[1].year,rows[0].year+1);for(const e of rows)assert.equal(rows.filter(r=>f19(r,e.year)).length,1);}
 const west=early19('xihai-attack');assert.equal(west.placeId,'haiyan-qinghai');assert.equal(f19(west,6,{region:'CN-63'}),true);assert.equal(f19(west,6,{region:'CN-33'}),false);
});
test('First currency changes keep concurrent Wuzhu and do not borrow Xin reform year',()=>{
 const e=early19('new-currencies');assert.equal(e.year,7);assert.match(e.summary,/五千、五百、五十.*与五铢钱并行/);assert.match(e.summary,/最终未给/);assert.equal(eventMatchesPeriod(e,'xin','CN'),false);assert.equal(f19(e,9),false);
});
test('Unsupported winter date candidates are not published as precise year-eight events',()=>{
 assert.equal(early19('chushi-title'),undefined);assert.equal(early19('changan-east-gate-wind'),undefined);const foundation=data.events.find(e=>e.id==='xin-9-foundation');assert.equal(foundation.year,9);assert.equal(eventMatchesPeriod(foundation,'xin','CN'),true);assert.match(foundation.summary,/已到9年/);
});

const early20=key=>data.events.find(e=>e.id.endsWith('-early20-'+key));
const f20=(e,year,extra={})=>eventMatches(e,{countryCode:'CN',period:'spring-autumn-warring',scope:'year',year,...extra},places);
test('Early Spring and Autumn additions retain annual chronology and exclusive modern-country navigation',()=>{
 const rows=data.events.filter(e=>e.id.includes('-early20-'));assert.equal(rows.length,136);assert.equal(data.meta.collections.find(c=>c.id==='spring-autumn-warring').events,1003);
 for(const e of rows){assert.equal(e.date,null);assert.equal(e.precision,'year');assert.equal(e.approximate,undefined);assert.ok(e.year>=-721&&e.year<=-659);assert.equal(f20(e,e.year),true);assert.equal(f20(e,e.year-1),false);assert.equal(f20(e,(e.endYear??e.year)+1),false);assert.equal(places.get(e.placeId).countryCode,'CN');for(const code of ['JP','KR','KP','MN','VN','LA','KH','TH','MM','IN','NP','LK','BD'])assert.equal(periodForEvent(e,code),null);assert.ok(e.sources.some(s=>s.url===e.sourceUrl&&s.title===e.sourceTitle));assert.match(e.locationNote,/古历月日.*不填为公历日/);}
 assert.equal(yearLabel(early20('lu-zhu-mie').year),'公元前 722 年');assert.equal(yearLabel(early20('zheng-gaoke-army-collapse').year),'公元前 660 年');
});
test('Campaigns and staged construction remain single records visible in both verified years',()=>{
 const keys=['song-changge-siege','wei-hui-restored','lu-huan-palace-decoration'];assert.deepEqual(keys.map(k=>[early20(k).year,early20(k).endYear]),[[-717,-716],[-688,-687],[-670,-669]]);
 for(const key of keys){const e=early20(key);assert.equal(f20(e,e.endYear),true);assert.equal(f20(e,e.endYear+1),false);assert.ok(e.sources.filter(s=>s.url.includes('春秋左氏傳')).length>=2);}
 const single=early20('ji-queen-arrives');assert.equal(single.year,-702);assert.equal(single.endYear,undefined);assert.equal(f20(single,-703),false);assert.match(single.summary,/前一年.*准备阶段/);assert.match(early20('wei-hui-restored').summary,/不把王室救援误写成支持惠公/);
});
test('New Chinese county points distinguish Shandong Sishui and Chengwu from homonyms',()=>{
 for(const [id,lat,lon,region,gn]of [['sishui-shandong',35.64889,117.27583,'CN-37',1794140],['chengwu-shandong',34.95407,115.88419,'CN-37',1815196],['xixian-henan',32.34838,114.74464,'CN-41',1788210]]){const p=places.get(id);assert.equal(p.lat,lat);assert.equal(p.lon,lon);assert.equal(p.regionCode,region);assert.equal(p.adminLevel,'county');assert.ok(p.sources.some(s=>s.url==='https://www.geonames.org/'+gn));assert.ok(p.sources.some(s=>s.url.includes('春秋地名攷畧')));}
 assert.equal(early20('lu-zhu-mie').placeId,'sishui-shandong');assert.match(early20('lu-zhu-mie').locationNote,/不是浙江/);assert.equal(early20('qi-song-liangqiu').placeId,'chengwu-shandong');assert.equal(early20('chu-xi-conquest').placeId,'xixian-henan');
});
test('Wenjiang is escorted at Huan rather than Lang and the old ID remains stable',()=>{
 const e=data.events.find(e=>e.id==='spring-autumn-warring-bce709-history500c-13');assert.equal(e.year,-708);assert.equal(e.title,'齐侯在讙地送文姜入鲁');assert.equal(e.placeId,'ningyang-shandong');assert.equal(f20(e,e.year,{city:'ningyang-shandong'}),true);assert.equal(f20(e,e.year,{city:'qufu'}),false);assert.match(decodeURIComponent(e.sourceUrl),/桓公三年$/);assert.ok(e.sources.some(s=>s.url.includes('春秋地名攷畧')));assert.match(e.locationNote,/讙与郎必须区别/);
});
test('Chu Ziyuan attacks the Zheng capital while the earlier Li campaign keeps Yuzhou',()=>{
 const corrected=data.events.find(e=>e.id==='spring-autumn-warring-bce666-history500c-25'),li=early20('chu-li-attack');assert.equal(corrected.year,-665);assert.match(corrected.title,/楚子元/);assert.equal(corrected.placeId,'xinzheng');assert.equal(li.year,-677);assert.equal(li.placeId,'yuzhou');assert.equal(f20(corrected,-665,{city:'yuzhou'}),false);assert.equal(f20(corrected,-665,{city:'xinzheng'}),true);assert.match(decodeURIComponent(corrected.sourceUrl),/莊公二十八年$/);
});
test('Ancient environmental observations preserve recorded names and do not invent measured modern effects',()=>{
 assert.equal(early20('lu-star-rain').year,-686);assert.match(early20('lu-star-rain').summary,/不指定现代流星雨名称/);assert.match(early20('lu-no-ice-huan14').summary,/不把古历正月当成公历一月/);assert.match(early20('lu-yu-disaster').summary,/不把蜮自动认定/);assert.match(early20('lu-fei-disaster').summary,/不能将隐公年间未成灾/);assert.equal(early20('lu-total-eclipse').year,-708);
 const floods=['lu-flood-huan','lu-flood-huan13','lu-flood-zhuang24','lu-flood-sacrifice25'].map(early20);assert.equal(new Set(floods.map(e=>e.year)).size,4);for(const e of floods)assert.equal(e.endYear,undefined);
});
test('Tributes and amnesties distinguish original annual actions from background narratives',()=>{
 assert.match(early20('zhou-funerary-gifts').summary,/不能把赠赗直接改写成仲子在本年去世/);assert.match(early20('lu-general-amnesty').summary,/没有列出逐项适用罪名/);assert.equal(early20('ji-queen-arrives').year,-702);assert.equal(early20('chen-queen-zhou').year,-675);assert.equal(early20('lu-zhuqiu-wall').year,-706);
});
test('County metadata remains consistent after annual expansions and location corrections',()=>{
 const ps=data.places.filter(p=>['county','site'].includes(p.adminLevel)),ids=new Set(ps.map(p=>p.id)),rows=data.events.filter(e=>ids.has(e.placeId));assert.equal(data.meta.countyCoverage.events,1724);assert.equal(data.meta.countyCoverage.places,560);assert.equal(rows.length,1724);assert.equal(ps.length,560);const freq=new Map();for(const e of rows)freq.set(e.placeId,(freq.get(e.placeId)??0)+1);assert.equal(data.meta.countyCoverage.placesWithMultipleEvents,256);assert.equal(ps.filter(p=>(freq.get(p.id)??0)>=2).length,256);
});

const early21=data.events.filter(e=>e.id.includes('-early21-'));
test('僖公逐年资料保留98条独立事件及原典年级精度',()=>{
  assert.equal(early21.length,98);
  assert.equal(Math.min(...early21.map(e=>e.year)),-658);
  assert.equal(Math.max(...early21.map(e=>e.year)),-626);
  for(const e of early21){assert.equal(e.periodId,'spring-autumn-warring');assert.equal(e.precision,'year');assert.equal(e.date,null);assert.equal(e.approximate,undefined);assert.ok(e.summary.length>=60);assert.ok(e.sourceUrl.startsWith('https://zh.wikisource.org/zh-hans/春秋左氏傳/僖公#'));}
});
test('连续不雨观测合并前658至前657且未改记为受害旱灾',()=>{
  const e=data.events.find(e=>e.id==='cn-bce658-early21-lu-long-no-rain');
  assert.equal(e.year,-657);assert.equal(e.endYear,-656);assert.equal(e.category,'科技');
  assert.match(e.summary,/未成为.*灾害/);assert.match(e.summary,/六月/);
  assert.equal(e.sources.filter(s=>s.title.includes('相关阶段')).length,1);
});
test('秦晋王城与采桑津采用对应地区且区别同名古地',()=>{
  const caisang=early21.find(e=>e.id.endsWith('-jin-caisang-battle')),wc=early21.find(e=>e.id.endsWith('-qin-jin-wangcheng-peace'));
  assert.equal(caisang.placeId,'jixian-shanxi');assert.equal(wc.placeId,'dali-shaanxi');assert.match(caisang.locationNote,/淮泗/);assert.match(wc.locationNote,/不是东周洛阳王城/);
  for(const id of ['shucheng-anhui','jixian-shanxi','jinxiang-shandong']){const p=data.places.find(p=>p.id===id);assert.equal(p.countryCode,'CN');assert.equal(p.adminLevel,'county');assert.ok(p.sources.some(s=>s.url.startsWith('https://www.geonames.org/')));}
});
test('前634年取谷更正主体与阶段并保留原编号日期地点',()=>{
  const e=data.events.find(e=>e.id==='spring-autumn-warring-bce634-history500c-33');
  assert.equal(e.title,'鲁僖公率楚军攻齐并取谷');assert.equal(e.year,-633);assert.equal(e.placeId,'pingyin');assert.match(e.summary,/安置齐桓公之子雍/);assert.ok(e.sources.some(s=>s.url.includes('jnepb.jinan.gov.cn')));
});
test('介葛卢两次访鲁及六鹢退飞补入旧记录，相关回顾不倒填年份',()=>{
  const visit=data.events.find(e=>e.id==='spring-autumn-warring-bce631-history500c-34'),meteor=data.events.find(e=>e.id==='cn-bce644-early06-song-meteorites');
  assert.equal(visit.year,-630);assert.match(visit.summary,/春季/);assert.match(visit.summary,/冬季/);assert.match(meteor.summary,/六鹢/);assert.equal(meteor.year,-643);
  const awards=early21.find(e=>e.id.endsWith('-jin-ji-battle-rewards'));assert.match(awards.summary,/早年追述/);assert.equal(awards.year,-626);
});
test('同地异年围缗分开，已有盟约与救许细节未另拆重复记录',()=>{
  const list=early21.filter(e=>e.placeId==='jinxiang-shandong');assert.deepEqual(list.map(e=>e.year).sort((a,b)=>a-b),[-636,-633]);
  assert.ok(list.some(e=>e.title.startsWith('齐军')));assert.ok(list.some(e=>e.title.startsWith('楚军')));
  assert.equal(early21.some(e=>e.id.endsWith('-jiyou-qi-compact')||e.id.endsWith('-chu-xu-siege-relief')),false);
});

const archaeological22=id=>data.events.find(e=>e.id===id);
test('Pipe installation and revised Qugong dates retain their own dated strata and unique periods',()=>{
 const pipe=archaeological22('cn-bce2050-pingliangtai-drainage'),qugong=archaeological22('cn-bce1350-qugong-settlement');
 assert.equal(pipe.year,-2049);assert.equal(pipe.periodId,'cn-prehistory');assert.match(pipe.summary,/4100—3900校正年前/);assert.match(pipe.summary,/多次修建/);
 assert.equal(eventMatchesPeriod(pipe,'xia-shang','CN'),false);
 assert.equal(qugong.year,-1349);assert.equal(qugong.periodId,'xia-shang');assert.match(qugong.summary,/1400—1300年/);assert.match(qugong.summary,/石室墓.*不能并入/);
 for(const e of [pipe,qugong]){assert.equal(e.approximate,true);assert.equal(e.date,null);assert.equal(e.endYear,undefined);}
});
test('Jirentaigoukou charcoal and coal occupations are separate calibrated phases',()=>{
 const wood=archaeological22('cn-bce2450-jirentaigoukou-charcoal'),coal=archaeological22('cn-bce1650-jirentaigoukou-coal');
 assert.equal(wood.placeId,coal.placeId);assert.equal(wood.periodId,'cn-prehistory');assert.equal(coal.periodId,'xia-shang');assert.ok(wood.year<coal.year);
 assert.match(wood.summary,/4500—4300/);assert.match(wood.summary,/尚无用煤证据/);assert.match(coal.summary,/3600—2900/);assert.match(coal.summary,/未将煤本身.*碳十四/);
 assert.equal(eventMatches(coal,{countryCode:'CN',scope:'year',year:wood.year},places),false);
});
test('Hamin evidence separates food production, tools and uncertain terminal catastrophe',()=>{
 const farm=archaeological22('cn-bce3400-hamin-farming'),tools=archaeological22('cn-bce3400-hamin-crafts'),abandon=archaeological22('cn-bce3300-hamin-abandonment');
 assert.equal(farm.placeId,tools.placeId);assert.equal(abandon.placeId,farm.placeId);
 assert.match(farm.summary,/87例人骨和18例动物骨/);assert.match(farm.summary,/粟黍/);assert.ok(farm.sources.some(s=>s.url.includes('id=2199')));
 assert.match(tools.summary,/骨柄/);assert.match(abandon.summary,/没有独立精确年值/);assert.match(abandon.summary,/尚不能确定病原体/);
 for(const e of [farm,tools,abandon])assert.equal(e.endYear,undefined);
});
test('Northeast, northwest and southern archaeological county references cannot resolve to similarly named foreign places',()=>{
 for(const [id,region,gn]of [['daan-jilin','CN-22',2037930],['horqin-left-middle','CN-15',2038452],['raohe-heilongjiang','CN-23',2035223],['heping-guangdong','CN-44',1787397],['pengyang-ningxia','CN-64',1798903],['nilka-xinjiang','CN-65',1529290],['xingxian-shanxi','CN-14',1788912],['qingjian-shaanxi','CN-61',1797878],['wenxi-shanxi','CN-14',1791409]]){
  const p=places.get(id);assert.equal(p.countryCode,'CN');assert.equal(p.regionCode,region);assert.equal(p.adminLevel,'county');assert.ok(p.sources.some(s=>s.url==='https://www.geonames.org/'+gn));assert.ok(data.events.some(e=>e.placeId===id));
 }
 assert.ok(places.get('heping-guangdong').lat>24&&places.get('heping-guangdong').lat<25);
 assert.ok(places.get('horqin-left-middle').lat>44);assert.ok(places.get('nilka-xinjiang').lon<83);
});
test('Bronze inscriptions use approximate period dates and their historical association instead of modern museum locations',()=>{
 for(const id of ['cn-bce900-shiqi-military-penalty','cn-bce800-shike-royal-guard']){
  const e=archaeological22(id);assert.equal(e.placeId,'xian');assert.equal(e.periodId,'western-zhou');assert.equal(e.date,null);assert.equal(e.approximate,true);assert.match(e.sourceUrl,/dpm\.org\.cn\/collection\/bronze/);assert.match(e.locationNote,/王畿/);
 }
 assert.match(archaeological22('cn-bce900-shiqi-military-penalty').summary,/三月丁卯.*不换算/);
 assert.match(archaeological22('cn-bce800-shike-royal-guard').summary,/不能.*补造具体王年/);
});
test('Regional farming evidence keeps mixed crops and local dated contexts instead of a single national transition',()=>{
 const yunnan=archaeological22('cn-bce2650-baiyangcun-mixed-farming'),coast=archaeological22('cn-bce2750-gancaoling-rice-millet'),zhou=archaeological22('cn-bce900-wanfunao-multi-cropping');
 assert.equal(yunnan.placeId,'binchuan-yunnan');assert.match(yunnan.summary,/2650.*2050/);assert.match(yunnan.summary,/大豆.*近野生型/);
 assert.match(coast.summary,/水稻与粟并存/);assert.match(coast.summary,/4800—4600校正年前/);
 assert.equal(zhou.periodId,'western-zhou');assert.match(zhou.summary,/小麦、大麦/);assert.match(zhou.summary,/不能.*推算.*产量/);
 for(const e of [yunnan,coast,zhou])assert.equal(e.endYear,undefined);
});
