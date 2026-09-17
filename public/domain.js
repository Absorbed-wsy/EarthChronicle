export const CATEGORIES = ['政治','军事','外交','经济','社会','科技','文化','灾害','建都','营建','制度','航海','战争'];
export function chineseNumber(n) {
  const digits = '零一二三四五六七八九';
  if(n === 1) return '元';
  if(n < 10) return digits[n];
  if(n < 20) return '十' + (n % 10 ? digits[n % 10] : '');
  if(n < 100) return digits[Math.floor(n/10)] + '十' + (n % 10 ? digits[n % 10] : '');
  return String(n);
}
export function eraForYear(year) {
  if(year >= 1368 && year <= 1398) return `明 · 洪武${chineseNumber(year-1367)}年`;
  if(year >= 1399 && year <= 1402) return `明 · 建文${chineseNumber(year-1398)}年`;
  if(year >= 1403 && year <= 1424) return `明 · 永乐${chineseNumber(year-1402)}年`;
  return year <= 0 ? '公元前纪年' : '公元纪年';
}
export function yearLabel(year) {return year <= 0 ? `公元前 ${1-year} 年` : `${year} 年`;}
export function eventIsActive(event,year) {return event.year<=year && (event.endYear??event.year)>=year;}
export function eventMatches(event, {year,scope='year',city='all',category='all',query='',countryCode,region='all',min,max}, places) {
  const place=places instanceof Map?places.get(event.placeId):places.find(p=>p.id===event.placeId);
  const cityId=place?.isCustom===true?place.cityId:event.placeId;
  if(city !== 'all' && cityId !== city) return false;
  if(category==='custom') {
    if(event.userCreated!==true && event.origin!=='user')return false;
  }else if(category !== 'all' && event.category !== category) return false;
  if(countryCode && countryCode!=='all' && place?.countryCode!==countryCode) return false;
  if(region!=='all' && place?.regionCode!==region) return false;
  if(Number.isFinite(min) && (event.endYear??event.year)<min) return false;
  if(Number.isFinite(max) && event.year>max) return false;
  const span=scope==='nearby'?5:0;
  if(scope !== 'all' && ((event.endYear ?? event.year)<year-span || event.year>year+span)) return false;
  const search=(query||'').trim().toLowerCase();
  if(!search) return true;
  const inferredEra=!place?.countryCode || place.countryCode==='CN'?eraForYear(event.year):'';
  const text=[event.title,event.summary,event.era,inferredEra,yearLabel(event.year),event.category,place?.regionName,place?.cityName,place?.name,place?.historicalName,...(place?.aliases||[])].join(' ').toLowerCase();
  return text.includes(search);
}
export function escapeHtml(value) {return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function safeSourceUrl(value) {try {const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
