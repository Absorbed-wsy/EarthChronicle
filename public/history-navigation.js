// Navigation periods, not assertions of historical borders or exclusive rule.
// Bounds are inclusive and may overlap. Dates before CE use astronomical years:
// 0 = 1 BCE; -1 = 2 BCE. No displayed historical year is called "0 年".
const sources = {
  preQin: 'https://www.chnmuseum.cn/portals/0/web/zt/gudai/detail3.html',
  qinHan: 'https://www.chnmuseum.cn/portals/0/web/zt/gudai/detail4.html',
  han: 'https://www.metmuseum.org/TOAH/hd/hand/hd_hand.htm',
  xin: 'https://www.clevelandart.org/art/1969.129',
  sixDynasties: 'https://resources.metmuseum.org/resources/metpublications/pdf/Cultural_Convergence_in_the_Northern_Qi_Period_A_Flamboyant_Chinese_Ceramic_Container_a_research.pdf',
  chronology: 'https://resources.metmuseum.org/resources/metpublications/pdf/Chinese_Decorative_Arts_The_Metropolitan_Museum_of_Art_Bulletin_v_55_no_1_Summer_1997.pdf',
  silkMuseum: 'https://iidos.cn/ListOfCollections/list.aspx',
  xixia: 'https://www.chnmuseum.cn/zp/zpml/kgfjp/index_5.shtml',
  yuan: 'https://en.chnmuseum.cn/collections_577/collection_highlights_608/ancient_currencies_613/201911/t20191121_172484.html',
  ming: 'https://www.dpm.org.cn/court/lineages.html',
  qing: 'https://www.dpm.org.cn/court/lineage/226246.html',
  abdication: 'https://www.cppcc.gov.cn/zxww/xinhai100/shouye/index.shtml',
  modern: 'https://www.chnmuseum.cn/yj/xscg/xslw/201812/t20181224_36419.shtml',
  republic: 'https://www.beijing.gov.cn/renwen/pjsx/201902/t20190201_1874837.html',
};

// Earlier Xia/Shang/Western Zhou dates are intentionally not given exact-year
// presets. The first navigation period begins with the Eastern Zhou migration.
// "Western Han" follows the Met's 206 BCE convention (Liu Bang as King of Han),
// rather than 202 BCE (emperor). Qin's 206 BCE end follows the National Museum.
// Qing starts with the 1636 dynastic name and ends with the 1912 abdication,
// rather than the 1644–1911 palace/art-history convention.
// Republic's 1949 endpoint refers specifically to the mainland history period.
// Broad period labels (e.g. Tang) do not imply uninterrupted dynastic rule.
export const HISTORY_PERIODS = Object.freeze([
  { id: 'all', name: '全部', start: -769, end: null, navigationOnly: true, sourceURL: sources.preQin },
  { id: 'modern', name: '近现代', start: 1840, end: null, navigationOnly: true, sourceURL: sources.modern },
  { id: 'prc', name: '中华人民共和国', start: 1949, end: null, sourceURL: sources.modern },
  { id: 'republic', name: '中华民国', start: 1912, end: 1949, sourceURL: sources.republic, endSourceURL: sources.silkMuseum },
  { id: 'qing', name: '清', start: 1636, end: 1912, sourceURL: sources.qing, endSourceURL: sources.abdication },
  { id: 'ming', name: '明', start: 1368, end: 1644, sourceURL: sources.ming },
  { id: 'yuan', name: '元', start: 1271, end: 1368, sourceURL: sources.yuan },
  { id: 'jin', name: '金', start: 1115, end: 1234, sourceURL: sources.chronology },
  { id: 'xixia', name: '西夏', start: 1038, end: 1227, sourceURL: sources.xixia },
  { id: 'song', name: '宋', start: 960, end: 1279, sourceURL: sources.chronology },
  { id: 'liao', name: '辽', start: 916, end: 1125, sourceURL: sources.chronology },
  { id: 'five-dynasties', name: '五代', start: 907, end: 960, sourceURL: sources.chronology },
  { id: 'tang', name: '唐', start: 618, end: 907, sourceURL: sources.chronology },
  { id: 'sui', name: '隋', start: 581, end: 618, sourceURL: sources.chronology },
  { id: 'northern-southern', name: '南北朝', start: 420, end: 589, sourceURL: sources.silkMuseum },
  { id: 'two-jin', name: '两晋', start: 265, end: 420, sourceURL: sources.sixDynasties },
  { id: 'three-kingdoms', name: '三国', start: 220, end: 280, sourceURL: sources.sixDynasties },
  { id: 'eastern-han', name: '东汉', start: 25, end: 220, sourceURL: sources.han },
  { id: 'xin', name: '新', start: 9, end: 23, sourceURL: sources.xin },
  { id: 'western-han', name: '西汉', start: -205, end: 9, sourceURL: sources.han },
  { id: 'qin', name: '秦', start: -220, end: -205, sourceURL: sources.qinHan },
  { id: 'spring-autumn-warring', name: '春秋战国', start: -769, end: -220, sourceURL: sources.preQin },
].map(period => Object.freeze(period)));

// This is a neutral navigation fallback, not a beginning of world history.
// The caller extends it to include earlier records in the selected geography.
const WORLD_PERIODS = Object.freeze([
  Object.freeze({ id: 'all', name: '全部', start: 1, end: null, navigationOnly: true }),
]);

/** Only offer period metadata associated with the selected country. */
export function periodsForCountry(countryCode = 'CN') {
  return countryCode === 'CN' ? HISTORY_PERIODS : WORLD_PERIODS;
}

function validCurrentYear(currentYear) {
  return Number.isInteger(currentYear) ? currentYear : new Date().getFullYear();
}

/** Return inclusive slider bounds; open-ended periods always end this year. */
export function periodBounds(id, currentYear = new Date().getFullYear(), countryCode = 'CN') {
  const periods = periodsForCountry(countryCode);
  const period = periods.find(item => item.id === id) || periods[0];
  const end = Math.min(period.end ?? validCurrentYear(currentYear), validCurrentYear(currentYear));
  return [Math.min(period.start, end), end];
}

/** Preserve contemporary periods instead of assigning a year to one dynasty. */
export function periodsForYear(year, currentYear = new Date().getFullYear(), countryCode = 'CN') {
  if (!Number.isInteger(year) || year > validCurrentYear(currentYear)) return [];
  return periodsForCountry(countryCode).filter(period => !period.navigationOnly
    && year >= period.start && year <= (period.end ?? validCurrentYear(currentYear)));
}

/** Compact axis label; year 0 is displayed as the historical year 1 BCE. */
export function yearTickLabel(year) {
  if (!Number.isInteger(year)) return '';
  return year <= 0 ? `前${1 - year}` : String(year);
}
