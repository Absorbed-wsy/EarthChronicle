export const CATEGORIES = ['建都','营建','制度','文化','航海','战争'];
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
export function eventMatches(event, {year,scope,city,category,query}, places) {
  if(city !== 'all' && event.placeId !== city) return false;
  if(category !== 'all' && event.category !== category) return false;
  const span=scope==='nearby'?5:0;
  if(scope !== 'all' && ((event.endYear ?? event.year)<year-span || event.year>year+span)) return false;
  const place=places.find(p=>p.id===event.placeId);
  const text=[event.title,event.summary,event.era,eraForYear(event.year),event.year,place?.name,place?.historicalName,...(place?.aliases||[])].join(' ').toLowerCase();
  return !query || text.includes(query.trim().toLowerCase());
}
export function escapeHtml(value) {return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function safeSourceUrl(value) {try {const u=new URL(value); return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
