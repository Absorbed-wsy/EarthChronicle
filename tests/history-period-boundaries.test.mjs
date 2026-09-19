import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HISTORY_PERIODS,periodBounds,periodForEvent,eventMatchesPeriod} from '../public/history-navigation.js';
import {eventMatches} from '../public/domain.js';
import {eventYearGroups} from '../public/history-index.js';

const record=(id,year,extra={})=>({id,year,title:id,summary:'',category:'社会',placeId:'beijing',...extra});
const places=new Map([['beijing',{id:'beijing',countryCode:'CN'}],['paris',{id:'paris',countryCode:'FR'}]]);
const filters=(period,extra={})=>({period,countryCode:'CN',scope:'all',year:1949,...extra});
const matching=(events,criteria)=>events.filter(event=>eventMatches(event,criteria,places));

test('1949 foundation day belongs only to the new period and precise dates override conflicting era labels',()=>{
  const before=record('before',1949,{date:'1949-09-30',precision:'day',era:'中华人民共和国',periodId:'prc'});
  const foundation=record('foundation',1949,{date:'1949-10-01',precision:'day',era:'中华民国',periodId:'republic'});
  const later=record('later',1949,{date:'1949-11-01',precision:'day'});
  for(const [event,expected] of [[before,'republic'],[foundation,'prc'],[later,'prc']]){
    assert.equal(periodForEvent(event)?.id,expected,event.id);
    assert.equal(eventMatchesPeriod(event,'republic'),expected==='republic',event.id);
    assert.equal(eventMatchesPeriod(event,'prc'),expected==='prc',event.id);
  }
});

test('month precision identifies either side of the October 1949 boundary without inventing a day',()=>{
  const september=record('september',1949,{date:'1949-09',precision:'month',era:'中华人民共和国'});
  const october=record('october',1949,{date:'1949-10',precision:'month',era:'中华民国'});
  const snapshot=structuredClone([september,october]);
  assert.equal(periodForEvent(september)?.id,'republic');
  assert.equal(periodForEvent(october)?.id,'prc');
  assert.deepEqual([september,october],snapshot);
});

test('an unqualified personal record in a transition year stays visible broadly without guessing its period',()=>{
  const event=record('personal',1949,{userCreated:true,origin:'user'});
  const snapshot=structuredClone(event);
  assert.equal(periodForEvent(event),null);
  for(const period of ['republic','prc']){
    assert.equal(eventMatchesPeriod(event,period),false);
    assert.deepEqual(matching([event],filters(period)),[]);
  }
  for(const period of ['all','modern']){
    assert.equal(eventMatchesPeriod(event,period),true);
    assert.deepEqual(matching([event],filters(period,{scope:'year'})).map(item=>item.id),['personal']);
  }
  assert.deepEqual(event,snapshot);
});

test('explicit period evidence can resolve year-only records but cannot contradict a later precise date',()=>{
  for(const [period,era] of [['republic','中华民国'],['prc','中华人民共和国']]){
    const event=record(period,1949,{precision:'year',era});
    assert.equal(periodForEvent(event)?.id,period);
    assert.equal(eventMatchesPeriod(event,period),true);
    assert.equal(eventMatchesPeriod(event,period==='prc'?'republic':'prc'),false);
    assert.equal(Object.hasOwn(event,'date'),false);
  }
  assert.equal(periodForEvent(record('identified',1949,{periodId:'republic'}))?.id,'republic');
  assert.equal(periodForEvent(record('dated',1949,{periodId:'prc',era:'中华人民共和国',date:'1949-09-21'}))?.id,'republic');
});

test('multi-year events keep their starting period while endYear still controls annual visibility',()=>{
  const event=record('spanning',1948,{endYear:1951});
  const uncertain=record('uncertain-spanning',1949,{endYear:1951,userCreated:true});
  assert.equal(periodForEvent(event)?.id,'republic');
  assert.equal(eventMatchesPeriod(event,'prc'),false);
  assert.equal(eventMatchesPeriod(event,'republic'),true);
  assert.deepEqual(matching([event],filters('prc',{year:1950,scope:'year',min:1949,max:2026})),[]);
  assert.deepEqual(matching([event],filters('all',{year:1950,scope:'year'})).map(item=>item.id),['spanning']);
  assert.deepEqual(matching([event],filters('all',{year:1952,scope:'year'})),[]);
  assert.equal(periodForEvent(uncertain),null);
  assert.equal(eventMatchesPeriod(uncertain,'prc'),false);
  assert.equal(eventMatchesPeriod(uncertain,'republic'),false);
});

test('the 1912 navigation boundary uses the republic foundation rather than the later Qing abdication',()=>{
  assert.equal(HISTORY_PERIODS.find(period=>period.id==='qing').end,1912);
  assert.deepEqual(periodBounds('qing',2026),[1636,1911]);
  assert.deepEqual(periodBounds('republic',2026),[1912,1949]);
  const last=record('qing-last',1911,{date:'1911-12-31',precision:'day'});
  const first=record('republic-first',1912,{date:'1912-01-01',precision:'day',era:'清'});
  const abdication=record('abdication',1912,{date:'1912-02-12',precision:'day',era:'清'});
  assert.equal(periodForEvent(last)?.id,'qing');
  for(const event of [first,abdication]){
    assert.equal(periodForEvent(event)?.id,'republic');
    assert.equal(eventMatchesPeriod(event,'qing'),false);
    assert.equal(eventMatchesPeriod(event,'republic'),true);
  }
});

test('coexisting historical regimes require explicit affiliation rather than whichever period is listed first',()=>{
  assert.equal(periodForEvent(record('unidentified',1100)),null);
  assert.equal(periodForEvent(record('song',1100,{era:'宋'}))?.id,'song');
  assert.equal(periodForEvent(record('liao',1100,{periodId:'liao'}))?.id,'liao');
  assert.equal(periodForEvent(record('xixia',1100,{era:'西夏'}))?.id,'xixia');
  const ming=record('ming-foundation',1368,{precision:'year',era:'明 · 洪武元年'});
  assert.equal(periodForEvent(ming)?.id,'ming');
  assert.equal(eventMatchesPeriod(ming,'ming'),true);
  assert.equal(eventMatchesPeriod(ming,'yuan'),false);
});

test('foreign records do not acquire Chinese eras and unavailable period filters retain all-period fallback',()=>{
  const foreign=record('foreign',1949,{placeId:'paris',date:'1949-10-01',era:'中华人民共和国'});
  for(const countryCode of ['FR','all'])assert.equal(periodForEvent(foreign,countryCode),null);
  assert.equal(eventMatchesPeriod(foreign,'prc','FR'),true);
  assert.equal(eventMatchesPeriod(foreign,'missing','FR'),true);
  assert.equal(eventMatchesPeriod(record('cn',1949),'missing','CN'),true);
  assert.deepEqual(matching([foreign],filters('prc',{countryCode:'FR'})).map(item=>item.id),['foreign']);
});

test('lists, year groups and annual map filters share the same period membership',()=>{
  const events=[
    record('september',1949,{date:'1949-09-29',era:'中华人民共和国'}),
    record('october',1949,{date:'1949-10-01',era:'中华民国'}),
    record('personal',1949,{userCreated:true}),
    record('future',1950),
  ];
  const republic=matching(events,filters('republic',{min:1912,max:1949}));
  const prc=matching(events,filters('prc',{min:1949,max:2026}));
  assert.deepEqual(republic.map(event=>event.id),['september']);
  assert.deepEqual(prc.map(event=>event.id),['october','future']);
  assert.deepEqual(eventYearGroups(republic,1912,1949),[{year:1949,count:1}]);
  assert.deepEqual(eventYearGroups(prc,1949,2026),[{year:1950,count:1},{year:1949,count:1}]);
  assert.deepEqual(matching(events,filters('republic',{scope:'year',min:1912,max:1949})).map(event=>event.id),['september']);
  assert.deepEqual(matching(events,filters('prc',{scope:'year',min:1949,max:2026})).map(event=>event.id),['october']);
  assert.deepEqual(matching(events,filters('prc',{scope:'nearby',min:1949,max:2026})).map(event=>event.id),['october','future']);
});

test('the shipped 1949 corpus partitions at October 1 without duplicate period membership',async()=>{
  const history=JSON.parse(await readFile(new URL('../public/data/history.json',import.meta.url),'utf8'));
  const records=history.events.filter(event=>event.year===1949);
  const ids=period=>records.filter(event=>eventMatchesPeriod(event,period)).map(event=>event.id).sort();
  const republic=ids('republic'),prc=ids('prc');
  for(const id of ['prc-1949-common-programme','prc-1949-cppcc-first-session','prc-1949-national-flag'])assert.ok(republic.includes(id),id);
  assert.deepEqual(republic,records.filter(event=>event.date<'1949-10-01').map(event=>event.id).sort());
  assert.deepEqual(prc,[
    'prc-1949-air-force-founded','prc-1949-chinese-academy-sciences','prc-1949-founding-ceremony',
  ]);
  assert.equal(republic.some(id=>prc.includes(id)),false);
  assert.equal(new Set([...republic,...prc]).size,records.length);
});
