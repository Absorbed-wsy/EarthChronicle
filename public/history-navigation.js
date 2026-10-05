// Navigation periods, not assertions of historical borders or exclusive rule.
// Year ranges can overlap, but an event has at most one specific period.
// Verified civil-date transitions use an inclusive start and exclusive end.
// Dates before CE use astronomical years:
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
  founding: 'https://www.mod.gov.cn/gfbw/qwfb/4851535.html',
};

// Prehistoric bounds index selected archaeological records, not the origin of
// human settlement. Xia/Shang and Western Zhou bounds follow conventional
// museum chronology; before 841 BCE, event details preserve approximate dates.
// Archaeological cultures can overlap; explicit ownership prevents duplication.
// "Western Han" follows the Met's 206 BCE convention (Liu Bang as King of Han),
// rather than 202 BCE (emperor). Qin's 206 BCE end follows the National Museum.
// Qing starts with the 1636 dynastic name and ends with the 1912 abdication,
// rather than the 1644–1911 palace/art-history convention.
// Republic's endpoint refers specifically to the mainland navigation period.
// Navigation cuts at establishment dates, not claims about when every earlier
// institution ceased to exist. Ancient civil dates require a verified calendar
// conversion; year-only metadata must not fabricate a January 1 transition.
// Broad period labels (e.g. Tang) do not imply uninterrupted dynastic rule.
export const HISTORY_PERIODS = Object.freeze([
  { id: 'all', name: '全部', start: -17999, end: null, navigationOnly: true, sourceURL: sources.preQin },
  { id: 'modern', name: '近现代', start: 1840, end: null, navigationOnly: true, sourceURL: sources.modern },
  { id: 'prc', name: '中华人民共和国', start: 1949, end: null, startDate: '1949-10-01', sourceURL: sources.founding },
  { id: 'republic', name: '中华民国', start: 1912, end: 1949, startDate: '1912-01-01', endBefore: '1949-10-01', sourceURL: sources.republic, endSourceURL: sources.founding },
  { id: 'qing', name: '清', start: 1636, end: 1912, endBefore: '1912-01-01', sourceURL: sources.qing, endSourceURL: sources.abdication, transitionSourceURL: sources.republic },
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
  { id: 'western-zhou', name: '西周', start: -1045, end: -770, sourceURL: 'https://www.chnmus.net/ch/exhibitions/permanent/huaxia/index.html' },
  { id: 'xia-shang', name: '夏商', start: -2069, end: -1046, sourceURL: 'https://www.chnmus.net/ch/exhibitions/permanent/huaxia/index.html' },
  { id: 'cn-prehistory', name: '史前与早期', start: -17999, end: -1899, sourceURL: 'https://www.chnmuseum.cn/portals/0/web/zt/gudai/en/detail1.html' },
].map(period => Object.freeze(period)));

// Japanese chronology is independent of Chinese dynasty navigation. Ancient
// transition years can contain both periods; explicit event ownership resolves
// that uncertainty. Modern era changes use verified Gregorian effective dates.
const japanSources = {
  early: 'https://www.metmuseum.org/toah/ht/06/eaj.html',
  middle: 'https://www.metmuseum.org/toah/ht/07/eaj.html',
  late: 'https://www.metmuseum.org/toah/ht/08/eaj.html',
  edo: 'https://www.oml.city.osaka.lg.jp/page/1148.html',
  modern: 'https://www.ndl.go.jp/modern/e/cha1/',
  imperial: 'https://www.kunaicho.go.jp/kunaicho/kunaicho/kunaicho-nenpyo.html',
};
export const JAPAN_PERIODS = Object.freeze([
  { id: 'all', name: '全部', start: -6999, end: null, navigationOnly: true, sourceURL: japanSources.early },
  { id: 'jp-reiwa', name: '令和', start: 2019, end: null, startDate: '2019-05-01', sourceURL: japanSources.imperial },
  { id: 'jp-heisei', name: '平成', start: 1989, end: 2019, startDate: '1989-01-08', endBefore: '2019-05-01', sourceURL: japanSources.imperial },
  { id: 'jp-showa', name: '昭和', start: 1926, end: 1989, startDate: '1926-12-25', endBefore: '1989-01-08', sourceURL: japanSources.imperial },
  { id: 'jp-taisho', name: '大正', start: 1912, end: 1926, startDate: '1912-07-30', endBefore: '1926-12-25', sourceURL: japanSources.imperial },
  { id: 'jp-meiji', name: '明治', start: 1868, end: 1912, endBefore: '1912-07-30', sourceURL: japanSources.modern, endSourceURL: japanSources.imperial },
  { id: 'jp-edo', name: '江户', start: 1603, end: 1868, sourceURL: japanSources.edo },
  { id: 'jp-momoyama', name: '安土桃山', start: 1573, end: 1603, sourceURL: japanSources.late, endSourceURL: japanSources.edo },
  { id: 'jp-muromachi', name: '室町', start: 1336, end: 1573, sourceURL: japanSources.middle, endSourceURL: japanSources.late },
  { id: 'jp-kenmu', name: '建武新政', start: 1333, end: 1336, sourceURL: japanSources.middle },
  { id: 'jp-kamakura', name: '镰仓', start: 1185, end: 1333, sourceURL: japanSources.middle },
  { id: 'jp-heian', name: '平安', start: 794, end: 1185, sourceURL: japanSources.early, endSourceURL: japanSources.middle },
  { id: 'jp-nara', name: '奈良', start: 710, end: 794, sourceURL: japanSources.early },
  { id: 'jp-asuka', name: '飞鸟', start: 538, end: 710, sourceURL: japanSources.early },
  // The lower bound is the earliest recorded site, not the beginning of Jomon culture.
  { id: 'jp-early', name: '史前与早期', start: -6999, end: 538, sourceURL: 'https://jomon-japan.jp/en/learn/jomon-sites/kakinoshima' },
].map(period => Object.freeze(period)));

// Korean groups describe the chronology of records at Korean geographic points.
// They do not project today's borders or government back onto ancient kingdoms.
const koreaSources = {
  early: 'https://encykorea.aks.ac.kr/Article/E0016571',
  silla: 'https://encykorea.aks.ac.kr/Article/E0032800',
  later: 'https://encykorea.aks.ac.kr/Article/E0065738',
  goryeo: 'https://encykorea.aks.ac.kr/Article/E0003424',
  joseon: 'https://encykorea.aks.ac.kr/Article/E0051904',
  empire: 'https://encykorea.aks.ac.kr/Article/E0015187',
  annexation: 'https://encykorea.aks.ac.kr/Article/E0061925',
  liberation: 'https://encykorea.aks.ac.kr/Article/E0059769',
  republic: 'https://encykorea.aks.ac.kr/Article/E0015002',
};
export const KOREA_PERIODS = Object.freeze([
  { id: 'all', name: '全部', start: -5999, end: null, navigationOnly: true, sourceURL: koreaSources.early },
  { id: 'kr-republic', name: '大韩民国', start: 1948, end: null, startDate: '1948-08-15', sourceURL: koreaSources.republic },
  { id: 'kr-liberation', name: '解放与分治', start: 1945, end: 1948, startDate: '1945-08-15', endBefore: '1948-08-15', sourceURL: koreaSources.liberation, endSourceURL: koreaSources.republic },
  { id: 'kr-colonial', name: '日据时期', start: 1910, end: 1945, startDate: '1910-08-29', endBefore: '1945-08-15', sourceURL: koreaSources.annexation, endSourceURL: koreaSources.liberation },
  { id: 'kr-empire', name: '大韩帝国', start: 1897, end: 1910, startDate: '1897-10-12', endBefore: '1910-08-29', sourceURL: koreaSources.empire, endSourceURL: koreaSources.annexation },
  { id: 'kr-joseon', name: '朝鲜王朝', start: 1392, end: 1897, endBefore: '1897-10-12', sourceURL: koreaSources.joseon, endSourceURL: koreaSources.empire },
  { id: 'kr-goryeo', name: '高丽', start: 918, end: 1392, sourceURL: koreaSources.goryeo },
  { id: 'kr-later-three-kingdoms', name: '后三国', start: 892, end: 936, sourceURL: koreaSources.later },
  { id: 'kr-unified-silla', name: '统一新罗', start: 668, end: 935, sourceURL: koreaSources.silla },
  { id: 'kr-three-kingdoms', name: '三国与伽倻', start: -56, end: 668, sourceURL: koreaSources.silla },
  // The lower bound is the earliest selected archaeological representative date.
  { id: 'kr-early', name: '史前与早期', start: -5999, end: -56, sourceURL: koreaSources.early },
].map(period => Object.freeze(period)));

// Periods are geographic navigation references, not reconstructed state borders.
const northKoreaSources = {
  early: 'https://encykorea.aks.ac.kr/Article/E0056772',
  goguryeo: 'https://encykorea.aks.ac.kr/Article/E0003323',
  balhae: 'https://encykorea.aks.ac.kr/Article/E0021626',
  later: 'https://encykorea.aks.ac.kr/Article/E0079670',
  goryeo: 'https://encykorea.aks.ac.kr/Article/E0003424',
  joseon: 'https://encykorea.aks.ac.kr/Article/E0051904',
  empire: 'https://encykorea.aks.ac.kr/Article/E0015187',
  annexation: 'https://encykorea.aks.ac.kr/Article/E0061925',
  liberation: 'https://encykorea.aks.ac.kr/Article/E0059769',
  dprk: 'https://encykorea.aks.ac.kr/Article/E0024785',
};
export const NORTH_KOREA_PERIODS = Object.freeze([
  { id: 'all', name: '全部', start: -2499, end: null, navigationOnly: true, sourceURL: northKoreaSources.early },
  { id: 'kp-dprk', name: '朝鲜民主主义人民共和国', start: 1948, end: null, startDate: '1948-09-09', sourceURL: northKoreaSources.dprk },
  { id: 'kp-liberation', name: '解放与分治', start: 1945, end: 1948, startDate: '1945-08-15', endBefore: '1948-09-09', sourceURL: northKoreaSources.liberation, endSourceURL: northKoreaSources.dprk },
  { id: 'kp-colonial', name: '日据时期', start: 1910, end: 1945, startDate: '1910-08-29', endBefore: '1945-08-15', sourceURL: northKoreaSources.annexation, endSourceURL: northKoreaSources.liberation },
  { id: 'kp-empire', name: '大韩帝国', start: 1897, end: 1910, startDate: '1897-10-12', endBefore: '1910-08-29', sourceURL: northKoreaSources.empire, endSourceURL: northKoreaSources.annexation },
  { id: 'kp-joseon', name: '朝鲜王朝', start: 1392, end: 1897, endBefore: '1897-10-12', sourceURL: northKoreaSources.joseon, endSourceURL: northKoreaSources.empire },
  { id: 'kp-goryeo', name: '高丽', start: 918, end: 1392, sourceURL: northKoreaSources.goryeo },
  { id: 'kp-later-three-kingdoms', name: '后三国', start: 892, end: 936, sourceURL: northKoreaSources.later },
  { id: 'kp-balhae', name: '渤海与南北国', start: 668, end: 926, sourceURL: northKoreaSources.balhae },
  { id: 'kp-goguryeo', name: '高句丽', start: -36, end: 668, sourceURL: northKoreaSources.goguryeo },
  // The lower bound is the earliest selected archaeological representative date.
  { id: 'kp-early', name: '史前与早期', start: -2499, end: 313, sourceURL: northKoreaSources.early },
].map(period => Object.freeze(period)));


// Geographic chronology: labels do not assert exclusive sovereignty or borders.
const mongoliaSources = {
  early: 'https://mongoltoli.mn/history/h/267',
  turkic: 'https://turkdunyasiansiklopedisi.gov.tr/detay/5098/Tonyukuk-',
  steppe: 'https://whc.unesco.org/uploads/nominations/1081rev.pdf',
  empire: 'https://whc.unesco.org/uploads/nominations/1440.pdf',
  later: 'https://tile.loc.gov/storage-services/master/frd/frdcstdy/mo/mongoliacountrys00word_0/mongoliacountrys00word_0.pdf',
  bogd: 'https://president.mn/en/2018/12/29/presidents-address-on-the-occasion-on-the-107th-anniversary-of-the-restoration-of-national-freedom-and-independence/',
  republic: 'https://www.parliament.mn/nn/13466/',
  modern: 'https://www.parliament.mn/nn/4967/',
};
export const MONGOLIA_PERIODS = Object.freeze([
  { id: 'all', name: '全部', start: -4799, end: null, navigationOnly: true, sourceURL: mongoliaSources.early },
  { id: 'mn-modern', name: '蒙古国', start: 1992, end: null, startDate: '1992-02-12', sourceURL: mongoliaSources.modern },
  { id: 'mn-mpr', name: '蒙古人民共和国', start: 1924, end: 1992, startDate: '1924-11-26', endBefore: '1992-02-12', sourceURL: mongoliaSources.republic, endSourceURL: mongoliaSources.modern },
  { id: 'mn-bogd', name: '博克多汗国', start: 1911, end: 1924, startDate: '1911-12-29', endBefore: '1924-11-26', sourceURL: mongoliaSources.bogd, endSourceURL: mongoliaSources.republic },
  // 1691 is the Khalkha submission reference; it is not every region's transition.
  { id: 'mn-qing', name: '清代', start: 1691, end: 1911, endBefore: '1911-12-29', sourceURL: mongoliaSources.later, endSourceURL: mongoliaSources.bogd },
  { id: 'mn-postimperial', name: '北元与草原诸部', start: 1368, end: 1691, sourceURL: mongoliaSources.later },
  { id: 'mn-empire', name: '蒙古帝国', start: 1206, end: 1368, sourceURL: mongoliaSources.empire },
  { id: 'mn-steppe', name: '草原诸部', start: 840, end: 1206, sourceURL: mongoliaSources.steppe },
  { id: 'mn-turkic', name: '突厥与回鹘', start: 552, end: 840, sourceURL: mongoliaSources.turkic },
  { id: 'mn-early', name: '史前与早期', start: -4799, end: 552, sourceURL: mongoliaSources.early },
].map(period => Object.freeze(period)));

// Geographic navigation includes contemporary regional polities; it does not
// reconstruct borders or assert continuous exclusive rule. Ancient transition
// years stay imprecise unless a verified civil date is available.
const vietnamSources = {
  early:'https://baotanglichsu.vn/en/Articles/4119/neolithic-period',
  northern:'https://www.baotanglichsutphcm.com.vn/phong-3-thoi-ngo-dinh-tien-le-939-1009',
  ly:'https://vanmieu.gov.vn/vi/site-history',
  tran:'https://scov.gov.vn/dat-nuoc-con-nguoi/viet-nam-su-luoc/tu-chu-thoi-dai-chuong-vi.-nha-tran-thoi-ky-thu-nhat-.html',
  ho:'https://vietnamtourism.vn/index.php/about/items/1960',
  ming:'https://vietnamtourism.vn/index.php/about/items/1962',
  le:'https://baotanglichsu.vn/VI/Articles/3091/55804/le-ky-niem-600-nam-khoi-nghia-lam-son-va-590-nam-djuc-vua-le-thai-to-djang-quang.html',
  mac:'https://vietnamtourism.vn/index.php/about/items/1963',
  restored:'https://scov.gov.vn/dat-nuoc-con-nguoi/viet-nam-su-luoc/quyen-iv.-tu-chu-thoi-dai-nha-hau-le.-chuong-i.-lich-trieu-luoc-ky.html',
  tayson:'https://www.baotanglichsutphcm.com.vn/phong-10-thoi-tay-son-1771-1802',
  nguyen:'https://www.baotanglichsutphcm.com.vn/phong-12-thoi-nguyen-1802-1945',
  colonial:'https://baotanglichsuquocgia.vn/vi/Articles/2002/67936/ngay-1-9-1858-lien-quan-phap-tay-ban-nha-no-sung-vao-thanh-dja-nang.html',
  independence:'https://baotanglichsuquocgia.vn/vi/Articles/3097/16905/nhung-ngay-chuan-bi-cho-le-djoc-lap-2-9-1945.html',
  abdication:'https://baotanglichsu.vn/VI/Articles/3096/7443/ve-tuyen-cao-thoai-vi-cua-hoang-dje-viet-nam-ngay-24-thang-8-nam-1945.html',
  modern:'https://vbpl.vn/TW/Pages/vbpqen-toanvan.aspx?ItemID=10461',
  funan:'https://baotanglichsu.vn/en/Articles/4214/oc-eo-phu-nam-cultures-1st-7th-centuries-ad',
  champa:'https://baotanglichsu.vn/en/Articles/3174/19646/more-architecture-relics-unearthed-in-cha-citadel.html',
};
export const VIETNAM_PERIODS = Object.freeze([
  // The lower bound is the earliest selected archaeological estimate.
  {id:'all',name:'全部',start:-15999,end:null,navigationOnly:true,sourceURL:vietnamSources.early},
  {id:'vn-modern',name:'越南社会主义共和国',start:1976,end:null,startDate:'1976-07-02',sourceURL:vietnamSources.modern},
  {id:'vn-divided',name:'独立与南北分治',start:1945,end:1976,startDate:'1945-09-02',endBefore:'1976-07-02',sourceURL:vietnamSources.independence,endSourceURL:vietnamSources.modern},
  {id:'vn-colonial',name:'殖民时期',start:1858,end:1945,startDate:'1858-09-01',endBefore:'1945-09-02',sourceURL:vietnamSources.colonial,endSourceURL:vietnamSources.independence},
  {id:'vn-nguyen',name:'阮朝',start:1802,end:1945,endBefore:'1945-08-30',sourceURL:vietnamSources.nguyen,endSourceURL:vietnamSources.abdication},
  // 1771 begins the uprising; it is not the imperial accession of every leader.
  {id:'vn-tayson',name:'西山',start:1771,end:1802,sourceURL:vietnamSources.tayson},
  {id:'vn-restored-le',name:'后黎复兴',start:1533,end:1789,sourceURL:vietnamSources.restored},
  {id:'vn-mac',name:'莫朝',start:1527,end:1677,sourceURL:vietnamSources.mac},
  {id:'vn-early-le',name:'后黎初期',start:1428,end:1527,sourceURL:vietnamSources.le,endSourceURL:vietnamSources.mac},
  {id:'vn-ming',name:'明属时期',start:1407,end:1428,sourceURL:vietnamSources.ming,endSourceURL:vietnamSources.le},
  {id:'vn-ho',name:'胡朝',start:1400,end:1407,sourceURL:vietnamSources.ho},
  {id:'vn-tran',name:'陈朝',start:1225,end:1400,sourceURL:vietnamSources.tran},
  {id:'vn-ly',name:'李朝',start:1009,end:1225,sourceURL:vietnamSources.ly},
  {id:'vn-ngo-dinh-earlyle',name:'吴丁前黎',start:939,end:1009,sourceURL:vietnamSources.northern},
  {id:'vn-northern',name:'北属与早期自主',start:-110,end:939,sourceURL:vietnamSources.northern},
  {id:'vn-early',name:'史前与早期',start:-15999,end:-110,sourceURL:vietnamSources.early},
  {id:'vn-funan',name:'扶南与南部早期',start:1,end:700,sourceURL:vietnamSources.funan},
  {id:'vn-champa',name:'占婆',start:192,end:1832,sourceURL:vietnamSources.champa},
].map(period=>Object.freeze(period)));

export const LAOS_PERIODS = Object.freeze([
  {
    "id": "all",
    "name": "全部",
    "start": -9299,
    "end": null,
    "navigationOnly": true,
    "sourceURL": "https://www.cambridge.org/core/services/aop-cambridge-core/content/view/8E36EB4AA9F341F89B84C99283DD5891/S2978855200904281a.pdf/archaeological-investigations-in-northern-laos-new-contributions-to-southeast-asian-prehistory.pdf"
  },
  {
    "id": "la-modern",
    "name": "老挝人民民主共和国",
    "start": 1975,
    "end": null,
    "startDate": "1975-12-02",
    "sourceURL": "https://na.gov.la/history-of-the-national-assembly/?lang=en"
  },
  {
    "id": "la-royal",
    "name": "老挝王国",
    "start": 1953,
    "end": 1975,
    "startDate": "1953-10-22",
    "endBefore": "1975-12-02",
    "sourceURL": "https://history.state.gov/historicaldocuments/frus1952-54v13p1/d433",
    "endSourceURL": "https://na.gov.la/history-of-the-national-assembly/?lang=en"
  },
  {
    "id": "la-colonial",
    "name": "法国殖民与独立运动",
    "start": 1893,
    "end": 1953,
    "startDate": "1893-10-03",
    "endBefore": "1953-10-22",
    "sourceURL": "https://whc.unesco.org/archive/advisory_body_evaluation/479.pdf",
    "endSourceURL": "https://history.state.gov/historicaldocuments/frus1952-54v13p1/d433"
  },
  {
    "id": "la-divided",
    "name": "诸王国时期",
    "start": 1707,
    "end": 1893,
    "endBefore": "1893-10-03",
    "sourceURL": "https://thesiamsociety.org/wp-content/uploads/1964/03/JSS_052_1d_Archaimbault_ReligiousStructuresInLaos.pdf"
  },
  {
    "id": "la-lanxang",
    "name": "澜沧王国",
    "start": 1353,
    "end": 1707,
    "sourceURL": "https://www.tourismlaos.org/2024/12/30/luang-prabang-celebrates-29-years-as-unesco-world-heritage-site/"
  },
  {
    "id": "la-early",
    "name": "史前与早期",
    "start": -9299,
    "end": 1353,
    "sourceURL": "https://www.cambridge.org/core/services/aop-cambridge-core/content/view/8E36EB4AA9F341F89B84C99283DD5891/S2978855200904281a.pdf/archaeological-investigations-in-northern-laos-new-contributions-to-southeast-asian-prehistory.pdf"
  }
].map(period=>Object.freeze(period)));

export const CAMBODIA_PERIODS = Object.freeze([
  {
    "id": "all",
    "name": "全部",
    "start": -11999,
    "end": null,
    "navigationOnly": true,
    "sourceURL": "https://www.inalco.fr/en/events/history-cambodian-prehistory-through-excavations-laang-spean-cave-1960s"
  },
  {
    "id": "kh-modern",
    "name": "恢复王国时期",
    "start": 1993,
    "end": null,
    "startDate": "1993-09-24",
    "sourceURL": "https://main.un.org/securitycouncil/sites/default/files/en/sc/repertoire/93-95/Chapter%208/ASIA/93-95_8-14-CAMBODIA.pdf"
  },
  {
    "id": "kh-transition",
    "name": "柬埔寨国与和平过渡",
    "start": 1989,
    "end": 1993,
    "startDate": "1989-04-30",
    "endBefore": "1993-09-24",
    "sourceURL": "https://data.opendevelopmentcambodia.net/en/laws_record/constitutions-of-cambodia-3",
    "endSourceURL": "https://main.un.org/securitycouncil/sites/default/files/en/sc/repertoire/93-95/Chapter%208/ASIA/93-95_8-14-CAMBODIA.pdf"
  },
  {
    "id": "kh-prk",
    "name": "柬埔寨人民共和国",
    "start": 1979,
    "end": 1989,
    "startDate": "1979-01-08",
    "endBefore": "1989-04-30",
    "sourceURL": "https://pressocm.gov.kh/en/archives/1057",
    "endSourceURL": "https://data.opendevelopmentcambodia.net/en/laws_record/constitutions-of-cambodia-3"
  },
  {
    "id": "kh-rouge",
    "name": "红色高棉统治",
    "start": 1975,
    "end": 1979,
    "startDate": "1975-04-17",
    "endBefore": "1979-01-08",
    "sourceURL": "https://timeline.eccc.gov.kh/en/section/the-democratic-kampuchea-regime",
    "endSourceURL": "https://pressocm.gov.kh/en/archives/1057"
  },
  {
    "id": "kh-republic",
    "name": "高棉共和国",
    "start": 1970,
    "end": 1975,
    "startDate": "1970-10-09",
    "endBefore": "1975-04-17",
    "sourceURL": "https://www.loc.gov/item/89600150/",
    "endSourceURL": "https://timeline.eccc.gov.kh/en/section/the-democratic-kampuchea-regime"
  },
  {
    "id": "kh-kingdom",
    "name": "独立王国时期",
    "start": 1953,
    "end": 1970,
    "startDate": "1953-11-09",
    "endBefore": "1970-10-09",
    "sourceURL": "https://timeline.eccc.gov.kh/en/section/who-were-the-khmer-rouge",
    "endSourceURL": "https://www.loc.gov/item/89600150/"
  },
  {
    "id": "kh-colonial",
    "name": "法国保护国时期",
    "start": 1863,
    "end": 1953,
    "startDate": "1863-08-11",
    "endBefore": "1953-11-09",
    "sourceURL": "https://mjp.univ-perp.fr/constit/kh1863.htm",
    "endSourceURL": "https://timeline.eccc.gov.kh/en/section/who-were-the-khmer-rouge"
  },
  {
    "id": "kh-post",
    "name": "后吴哥时期",
    "start": 1431,
    "end": 1863,
    "endBefore": "1863-08-11",
    "sourceURL": "https://www.efeo.fr/articles-FR-1444.html",
    "endSourceURL": "https://mjp.univ-perp.fr/constit/kh1863.htm"
  },
  {
    "id": "kh-angkor",
    "name": "吴哥时期",
    "start": 802,
    "end": 1430,
    "sourceURL": "https://www.persee.fr/doc/ephe_0000-0001_1987_num_5_1_7221?pageId=T2_151",
    "endSourceURL": "https://www.efeo.fr/articles-FR-1444.html"
  },
  {
    "id": "kh-early",
    "name": "扶南与真腊",
    "start": 1,
    "end": 801,
    "sourceURL": "https://www.loc.gov/item/89600150/"
  },
  {
    "id": "kh-prehistory",
    "name": "史前时期",
    "start": -11999,
    "end": 0,
    "sourceURL": "https://www.inalco.fr/en/events/history-cambodian-prehistory-through-excavations-laang-spean-cave-1960s"
  }
].map(period=>Object.freeze(period)));

export const THAILAND_PERIODS = Object.freeze([
  {
    "id": "all",
    "name": "全部",
    "start": -19999,
    "end": null,
    "navigationOnly": true,
    "sourceURL": "https://www.cambridge.org/core/journals/antiquity/article/aggrandisers-and-the-first-copperbase-metallurgy-in-southeast-asia/3CA067E2AE69A168495A411FD8A67184"
  },
  {
    "id": "th-constitutional",
    "name": "宪政时期",
    "start": 1932,
    "end": null,
    "startDate": "1932-06-24",
    "sourceURL": "https://www.loc.gov/item/today-in-history/june-24/"
  },
  {
    "id": "th-rattanakosin",
    "name": "曼谷王朝前期",
    "start": 1782,
    "end": 1932,
    "startDate": "1782-04-06",
    "endBefore": "1932-06-24",
    "sourceURL": "https://www.slam.org/collection/constituents/26849/",
    "endSourceURL": "https://www.loc.gov/item/today-in-history/june-24/"
  },
  {
    "id": "th-thonburi",
    "name": "吞武里与战后重建",
    "start": 1767,
    "end": 1782,
    "endBefore": "1782-04-06",
    "sourceURL": "https://www.unesco.org/en/articles/thailands-forgotten-palace?hub=387",
    "endSourceURL": "https://www.slam.org/collection/constituents/26849/"
  },
  {
    "id": "th-ayutthaya",
    "name": "大城时期",
    "start": 1350,
    "end": 1767,
    "sourceURL": "https://whc.unesco.org/en/list/576/"
  },
  {
    "id": "th-lanna",
    "name": "兰纳与缅属北部",
    "start": 1296,
    "end": 1783,
    "sourceURL": "https://cmocity.com/lanna-timeline/",
    "endSourceURL": "https://sure.su.ac.th/xmlui/handle/123456789/25949"
  },
  {
    "id": "th-sukhothai",
    "name": "素可泰时期",
    "start": 1238,
    "end": 1438,
    "sourceURL": "https://thailandfoundation.or.th/wp-content/uploads/2025/05/2-Thailands-History.pdf",
    "endSourceURL": "https://www.finearts.go.th/storage/contents/2020/07/file/FR7ToNxSVUev0w3977ptoUJXfCRpj4cffZxqfDGq.pdf"
  },
  {
    "id": "th-early",
    "name": "早期城邦与吴哥遗存",
    "start": 500,
    "end": 1349,
    "sourceURL": "https://whc.unesco.org/en/list/1662/",
    "endSourceURL": "https://thesiamsociety.org/wp-content/uploads/2004/03/JSS_092_0d_Ishii_ExploringNewApproachToEarlyThaiHistory.pdf"
  },
  {
    "id": "th-prehistory",
    "name": "史前与早期聚落",
    "start": -19999,
    "end": 499,
    "sourceURL": "https://www.cambridge.org/core/journals/antiquity/article/aggrandisers-and-the-first-copperbase-metallurgy-in-southeast-asia/3CA067E2AE69A168495A411FD8A67184"
  }
].map(period=>Object.freeze(period)));

export const MYANMAR_PERIODS = Object.freeze([
  {
    "id": "all",
    "name": "全部",
    "start": -19999,
    "end": null,
    "navigationOnly": true
  },
  {
    "id": "mm-contemporary",
    "name": "当代冲突时期",
    "start": 2021,
    "startDate": "2021-02-01",
    "end": null,
    "sourceURL": "https://bangkok.ohchr.org/5902-2"
  },
  {
    "id": "mm-reform",
    "name": "改革与民选政府时期",
    "start": 2011,
    "startDate": "2011-03-30",
    "end": 2021,
    "endBefore": "2021-02-01",
    "sourceURL": "https://www.un.org/sg/en/content/former-secretary-general/statement/2011-03-30/statement-attributable-the-spokesperson-for-the-secretary-general-myanmar",
    "endSourceURL": "https://bangkok.ohchr.org/5902-2"
  },
  {
    "id": "mm-military",
    "name": "军方统治时期",
    "start": 1962,
    "startDate": "1962-03-02",
    "end": 2011,
    "endBefore": "2011-03-30",
    "sourceURL": "https://history.state.gov/historicaldocuments/frus1961-63v23/d49",
    "endSourceURL": "https://www.un.org/sg/en/content/former-secretary-general/statement/2011-03-30/statement-attributable-the-spokesperson-for-the-secretary-general-myanmar"
  },
  {
    "id": "mm-union",
    "name": "独立联邦时期",
    "start": 1948,
    "startDate": "1948-01-04",
    "end": 1962,
    "endBefore": "1962-03-02",
    "sourceURL": "https://treaties.un.org/doc/Publication/UNTS/Volume%2070/v70.pdf",
    "endSourceURL": "https://history.state.gov/historicaldocuments/frus1961-63v23/d49"
  },
  {
    "id": "mm-colonial",
    "name": "殖民统治与独立运动",
    "start": 1824,
    "end": 1948,
    "endBefore": "1948-01-04",
    "sourceURL": "https://www.nam.ac.uk/explore/timeline-burma-army",
    "endSourceURL": "https://treaties.un.org/doc/Publication/UNTS/Volume%2070/v70.pdf"
  },
  {
    "id": "mm-konbaung",
    "name": "贡榜王朝",
    "start": 1752,
    "end": 1885,
    "sourceURL": "https://media.unesco.org/sites/default/files/webform/mow001/germany_uk_germany_golden_letter_eng.pdf",
    "endSourceURL": "https://www.nam.ac.uk/explore/timeline-burma-army"
  },
  {
    "id": "mm-restored-hanthawaddy",
    "name": "勃固复兴王国",
    "start": 1740,
    "end": 1757,
    "endBefore": "1757-05-12",
    "sourceURL": "https://www.cambridge.org/core/journals/modern-asian-studies/article/ethnic-politics-in-eighteenthcentury-burma/12E8ED2301647C4579789B1F5A601322",
    "endSourceURL": "https://myanmar-law-library.org/IMG/pdf/than_tun-1985-royal_orders_of_burma-03-bu_en-red.pdf"
  },
  {
    "id": "mm-nyaungyan",
    "name": "良渊王朝",
    "start": 1600,
    "end": 1752,
    "sourceURL": "https://www.myanmar.gov.mm/en/web/guest/history"
  },
  {
    "id": "mm-toungoo",
    "name": "东吁王朝",
    "start": 1510,
    "end": 1599,
    "sourceURL": "https://maas.edu.mm/Research/Admin/pdf/5.%20Dr%20Tin%20Tin%20Win%2859-74%29.pdf",
    "endSourceURL": "https://meral.edu.mm/record/10898/files/Tin%20Tin%20Win%20(History).pdf"
  },
  {
    "id": "mm-mrauku",
    "name": "若开与妙乌王国",
    "start": 1430,
    "end": 1785,
    "sourceURL": "https://journal.kci.go.kr/svn/archive/articlePdf?artiId=ART002533202"
  },
  {
    "id": "mm-hanthawaddy",
    "name": "勃固孟族王国",
    "start": 1287,
    "end": 1539,
    "sourceURL": "https://meral.edu.mm/record/10898/files/Tin%20Tin%20Win%20(History).pdf"
  },
  {
    "id": "mm-ava",
    "name": "阿瓦与上缅诸政权",
    "start": 1312,
    "end": 1555,
    "sourceURL": "https://www.myanmar.gov.mm/en/web/guest/history"
  },
  {
    "id": "mm-bagan",
    "name": "蒲甘时期",
    "start": 849,
    "end": 1368,
    "sourceURL": "https://www.myanmar.gov.mm/en/web/guest/history"
  },
  {
    "id": "mm-pyu",
    "name": "骠国城邦时期",
    "start": -199,
    "end": 900,
    "sourceURL": "https://whc.unesco.org/document/152694"
  },
  {
    "id": "mm-prehistory",
    "name": "史前与早期聚落",
    "start": -19999,
    "end": -200,
    "sourceURL": "https://www.cambridge.org/core/journals/antiquity/article/first-absolute-chronology-for-late-neolithic-to-early-bronze-age-myanmar-new-ams-14c-dates-from-nyaunggan-and-oakaie/B07D5550EA305C72B89A52D4DFBB108C"
  }
].map(period=>Object.freeze(period)));

export const INDIA_PERIODS = Object.freeze([{"id":"all","name":"全部","start":-19999,"end":null,"navigationOnly":true,"sourceURL":"https://whc.unesco.org/document/154601"},{"id":"in-republic","name":"印度共和国","start":1950,"end":null,"startDate":"1950-01-26","sourceURL":"https://www.legislative.gov.in/static/uploads/2025/07/359f70a69695affb9d72f8393102bd2e.pdf"},{"id":"in-dominion","name":"印度自治领","start":1947,"end":1950,"startDate":"1947-08-15","endBefore":"1950-01-26","sourceURL":"https://www.legislation.gov.uk/ukpga/Geo6/10-11/30","endSourceURL":"https://www.legislative.gov.in/static/uploads/2025/07/359f70a69695affb9d72f8393102bd2e.pdf"},{"id":"in-british","name":"英属印度","start":1858,"end":1947,"startDate":"1858-09-02","endBefore":"1947-08-15","sourceURL":"https://www.legislation.gov.uk/ukpga/Vict/21-22/106/pdfs/ukpga_18580106_en.pdf","endSourceURL":"https://www.legislation.gov.uk/ukpga/Geo6/10-11/30"},{"id":"in-company","name":"殖民据点与公司统治","start":1498,"end":1858,"endBefore":"1858-09-02","sourceURL":"https://www.metmuseum.org/toah/ht/08/ssa.html","endSourceURL":"https://www.legislation.gov.uk/ukpga/Vict/21-22/106/pdfs/ukpga_18580106_en.pdf"},{"id":"in-regional","name":"区域王国与马拉塔","start":1400,"end":1858,"sourceURL":"https://www.metmuseum.org/toah/ht/08/ssa.html"},{"id":"in-mughal","name":"莫卧儿","start":1526,"end":1858,"sourceURL":"https://www.metmuseum.org/toah/ht/08/ssa.html"},{"id":"in-sur","name":"苏尔王朝","start":1540,"end":1555,"sourceURL":"https://www.metmuseum.org/toah/ht/08/ssa.html"},{"id":"in-sultanate","name":"德里苏丹国与北部诸国","start":1206,"end":1526,"sourceURL":"https://www.metmuseum.org/toah/ht/07/ssn.html"},{"id":"in-northeast","name":"东北与喜马拉雅诸国","start":600,"end":1947,"sourceURL":"https://whc.unesco.org/en/list/1711/"},{"id":"in-south","name":"南部王国与德干","start":500,"end":1800,"sourceURL":"https://www.metmuseum.org/toah/ht/06/sss.html"},{"id":"in-early-medieval","name":"中古早期诸国","start":500,"end":1205,"sourceURL":"https://www.metmuseum.org/toah/ht/06/ssn.html"},{"id":"in-gupta","name":"笈多时期","start":320,"end":550,"sourceURL":"https://www.metmuseum.org/toah/ht/05/ssa.html"},{"id":"in-early-south","name":"早期南部诸国","start":-599,"end":499,"sourceURL":"https://www.tnarch.gov.in/keeladi"},{"id":"in-post-maurya","name":"孔雀之后诸国","start":-184,"end":319,"sourceURL":"https://www.metmuseum.org/toah/ht/05/ssa.html"},{"id":"in-maurya","name":"孔雀王朝","start":-322,"end":-184,"sourceURL":"https://www.metmuseum.org/toah/ht/04/ssa.html"},{"id":"in-early-states","name":"列国与摩揭陀","start":-799,"end":-320,"sourceURL":"https://www.metmuseum.org/toah/ht/04/ssa.html"},{"id":"in-vedic","name":"吠陀时期","start":-1499,"end":-499,"sourceURL":"https://www.metmuseum.org/toah/ht/04/ssa.html"},{"id":"in-harappan","name":"哈拉帕文明","start":-2999,"end":-1299,"sourceURL":"https://whc.unesco.org/en/list/1645/"},{"id":"in-prehistory","name":"史前与早期聚落","start":-19999,"end":-599,"sourceURL":"https://whc.unesco.org/document/154601"}].map(period=>Object.freeze(period)));

// Nepal groups regional coexistence, not historical borders. Shah begins with
// the Gorkha kingdom (1559); it does not mean the valley was unified then.
// Rana begins at the Kot political turning point, not abolition of Shah kingship.
export const NEPAL_PERIODS = Object.freeze([{"id":"all","name":"全部","start":-1493,"end":null,"navigationOnly":true,"sourceURL":"https://www.nature.com/articles/s41467-022-28827-2"},{"id":"np-republic","name":"联邦民主共和国","start":2008,"end":null,"startDate":"2008-05-28","sourceURL":"https://digitallibrary.un.org/record/631478/files/S_2008_454-EN.pdf"},{"id":"np-monarchy","name":"君主制与民主转型","start":1951,"end":2008,"startDate":"1951-02-18","endBefore":"2008-05-28","sourceURL":"https://radionepalonline.com/en/2025/02/09/401561.html","endSourceURL":"https://digitallibrary.un.org/record/631478/files/S_2008_454-EN.pdf"},{"id":"np-rana","name":"拉纳时期","start":1846,"end":1951,"startDate":"1846-09-14","endBefore":"1951-02-18","sourceURL":"https://nepalica.hadw-bw.de/nepal/editions/show/2170","endSourceURL":"https://radionepalonline.com/en/2025/02/09/401561.html"},{"id":"np-shah","name":"沙阿王朝与统一","start":1559,"end":1846,"endBefore":"1846-09-14","sourceURL":"https://trade.ntb.gov.np/know-nepal/nepals-history/","endSourceURL":"https://nepalica.hadw-bw.de/nepal/editions/show/2170"},{"id":"np-malla","name":"马拉与区域王国","start":1200,"end":1769,"sourceURL":"https://whc.unesco.org/en/tentativelists/5263"},{"id":"np-medieval","name":"中古早期","start":750,"end":1199,"sourceURL":"https://tile.loc.gov/storage-services/master/gdc/gdcebookspublic/20/20/71/53/45/2020715345/2020715345.pdf"},{"id":"np-licchavi","name":"李查维时期","start":400,"end":749,"sourceURL":"https://siddham.network/object/ob02001a/?section=metadata"},{"id":"np-early","name":"史前与早期","start":-1493,"end":399,"sourceURL":"https://www.nature.com/articles/s41467-022-28827-2"}].map(period=>Object.freeze(period)));

// Sri Lankan coastal administrations and inland kingdoms coexisted.
// These are navigation groups, not assertions that one polity ruled the island.
// Civil-date transitions distinguish takeover, dominion and the republics.
export const SRI_LANKA_PERIODS = Object.freeze([{"id":"all","name":"全部","start":-46049,"end":null,"navigationOnly":true,"sourceURL":"https://www.nature.com/articles/s41467-019-08623-1"},{"id":"lk-second-republic","name":"第二共和国","start":1978,"end":null,"startDate":"1978-09-07","sourceURL":"https://www.parliament.lk/files/pdf/1978constitutionwithoutamendments.pdf"},{"id":"lk-first-republic","name":"第一共和国","start":1972,"end":1978,"startDate":"1972-05-22","endBefore":"1978-09-07","sourceURL":"https://www.mfa.gov.lk/en/about-us/history/milestone-list","endSourceURL":"https://www.parliament.lk/files/pdf/1978constitutionwithoutamendments.pdf"},{"id":"lk-dominion","name":"锡兰自治领","start":1948,"end":1972,"startDate":"1948-02-04","endBefore":"1972-05-22","sourceURL":"https://www.mfa.gov.lk/en/about-us/history/milestone-list","endSourceURL":"https://www.mfa.gov.lk/en/about-us/history/milestone-list"},{"id":"lk-british","name":"英国殖民时期","start":1796,"end":1948,"startDate":"1796-02-16","endBefore":"1948-02-04","sourceURL":"https://www.mq.edu.au/macquarie-archive/under/documents/1796/welsh.html","endSourceURL":"https://www.mfa.gov.lk/en/about-us/history/milestone-list"},{"id":"lk-dutch","name":"荷兰沿海统治","start":1638,"end":1796,"endBefore":"1796-02-16","sourceURL":"https://www.cbsl.gov.lk/en/node/235","endSourceURL":"https://www.mq.edu.au/macquarie-archive/under/documents/1796/welsh.html"},{"id":"lk-portuguese","name":"葡萄牙沿海扩张","start":1505,"end":1658,"sourceURL":"https://www.cbsl.gov.lk/en/node/235"},{"id":"lk-kandy","name":"康提王国","start":1469,"end":1815,"endBefore":"1815-03-02","sourceURL":"https://siddham.network/inscription/in03154/","endSourceURL":"https://www.lawnet.gov.lk/wp-content/uploads/2016/11/078-NLR-NLR-V-09-FERNANDO-v.-THE-MUNICIPAL-COUNCIL-OF-KANDY.pdf"},{"id":"lk-regional","name":"区域王国","start":1220,"end":1597,"sourceURL":"https://ccf.gov.lk/heritage-sites/dambadeniya/","endSourceURL":"https://www.kotte.mc.gov.lk/index.php?Itemid=176&id=26&lang=en&option=com_content&view=article"},{"id":"lk-polonnaruwa","name":"波隆纳鲁沃与朱罗时期","start":993,"end":1232,"sourceURL":"https://whc.unesco.org/en/list/201/","endSourceURL":"https://www.cbsl.gov.lk/en/node/235"},{"id":"lk-anuradhapura","name":"阿努拉德普勒时期","start":-399,"end":1017,"sourceURL":"https://www.cambridge.org/core/journals/cambridge-archaeological-journal/article/abs/passage-to-india-anuradhapura-and-the-early-use-of-the-brahmi-script/DAAA2514FB08E1DDE3FAFF2171AB097B","endSourceURL":"https://www.cbsl.gov.lk/en/node/235"},{"id":"lk-early","name":"史前与早期","start":-46049,"end":-400,"sourceURL":"https://www.nature.com/articles/s41467-019-08623-1"}].map(period=>Object.freeze(period)));

// Bangladesh groups are chronological navigation, not reconstructed borders.
// Partition and independence use exact civil dates; year-only records at a
// transition need evidence of their period rather than an invented January date.
export const BANGLADESH_PERIODS = Object.freeze([{"id":"all","name":"全部","start":-399,"end":null,"navigationOnly":true,"sourceURL":"https://archeologie.culture.gouv.fr/fr/mahasthan"},{"id":"bd-modern","name":"近现代","start":1947,"end":null,"navigationOnly":true,"startDate":"1947-08-15","sourceURL":"https://www.legislation.gov.uk/ukpga/1947/30/pdfs/ukpga_19470030_en.pdf"},{"id":"bd-independent","name":"独立孟加拉国","start":1971,"end":null,"startDate":"1971-03-26","sourceURL":"https://bdlaws.minlaw.gov.bd/act-367.html"},{"id":"bd-eastpakistan","name":"东孟加拉与东巴基斯坦","start":1947,"end":1971,"startDate":"1947-08-15","endBefore":"1971-03-26","sourceURL":"https://www.legislation.gov.uk/ukpga/1947/30/pdfs/ukpga_19470030_en.pdf","endSourceURL":"https://bdlaws.minlaw.gov.bd/act-367.html"},{"id":"bd-british","name":"公司与殖民时期","start":1757,"end":1947,"endBefore":"1947-08-15","sourceURL":"https://upload.wikimedia.org/wikipedia/commons/3/3a/A_Statistical_Account_of_Bengal_Vol_5_GoogleBooksID_RncDAAAAYAAJ.pdf","endSourceURL":"https://www.legislation.gov.uk/ukpga/1947/30/pdfs/ukpga_19470030_en.pdf"},{"id":"bd-mughal","name":"莫卧儿与纳瓦卜时期","start":1576,"end":1756,"sourceURL":"https://www.bmri.org.uk/articles/Muslim-Coins-Bengal.pdf"},{"id":"bd-sultanate","name":"苏丹国与区域政权","start":1204,"end":1575,"sourceURL":"https://www.bmri.org.uk/articles/Muslim-Coins-Bengal.pdf"},{"id":"bd-pala-sena","name":"波罗与塞纳时期","start":750,"end":1203,"sourceURL":"https://pjhc.nihcr.edu.pk/wp-content/uploads/2020/08/2-Bengal-under-the-Palas-and-Senas750-1204Syed-Umar-Hayat.pdf"},{"id":"bd-ancient","name":"早期古代","start":-399,"end":749,"sourceURL":"https://archeologie.culture.gouv.fr/fr/mahasthan"}].map(period=>Object.freeze(period)));

const PERIOD_COUNTRIES = new Map([
  ...HISTORY_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'CN']),
  ...JAPAN_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'JP']),
  ...KOREA_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'KR']),
  ...NORTH_KOREA_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'KP']),
  ...MONGOLIA_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'MN']),
  ...VIETNAM_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'VN']),
  ...LAOS_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'LA']),
  ...CAMBODIA_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'KH']),
  ...THAILAND_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'TH']),
  ...MYANMAR_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'MM']),
  ...INDIA_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'IN']),
  ...NEPAL_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'NP']),
  ...SRI_LANKA_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'LK']),
  ...BANGLADESH_PERIODS.filter(p => !p.navigationOnly).map(p => [p.id, 'BD']),
]);
const ERA_COUNTRIES = [...HISTORY_PERIODS, ...JAPAN_PERIODS, ...KOREA_PERIODS, ...NORTH_KOREA_PERIODS, ...MONGOLIA_PERIODS, ...VIETNAM_PERIODS, ...LAOS_PERIODS, ...CAMBODIA_PERIODS, ...THAILAND_PERIODS, ...MYANMAR_PERIODS, ...INDIA_PERIODS, ...NEPAL_PERIODS, ...SRI_LANKA_PERIODS, ...BANGLADESH_PERIODS].filter(p => !p.navigationOnly);

// This is a neutral navigation fallback, not a beginning of world history.
// The caller extends it to include earlier records in the selected geography.
const WORLD_PERIODS = Object.freeze([
  Object.freeze({ id: 'all', name: '全部', start: 1, end: null, navigationOnly: true }),
]);

/** Only offer period metadata associated with the selected country. */
export function periodsForCountry(countryCode = 'CN') {
  return countryCode === 'CN' ? HISTORY_PERIODS : countryCode === 'JP' ? JAPAN_PERIODS : countryCode === 'KR' ? KOREA_PERIODS : countryCode === 'KP' ? NORTH_KOREA_PERIODS : countryCode === 'MN' ? MONGOLIA_PERIODS : countryCode === 'VN' ? VIETNAM_PERIODS : countryCode === 'LA' ? LAOS_PERIODS : countryCode === 'KH' ? CAMBODIA_PERIODS : countryCode === 'TH' ? THAILAND_PERIODS : countryCode === 'MM' ? MYANMAR_PERIODS : countryCode === 'IN' ? INDIA_PERIODS : countryCode === 'NP' ? NEPAL_PERIODS : countryCode === 'LK' ? SRI_LANKA_PERIODS : countryCode === 'BD' ? BANGLADESH_PERIODS : WORLD_PERIODS;
}

function validCurrentYear(currentYear) {
  return Number.isInteger(currentYear) ? currentYear : new Date().getFullYear();
}

/** Return inclusive slider bounds; open-ended periods always end this year. */
export function periodBounds(id, currentYear = new Date().getFullYear(), countryCode = 'CN') {
  const periods = periodsForCountry(countryCode);
  const period = periods.find(item => item.id === id) || periods[0];
  const transitionEnd = period.endBefore ? Number(period.endBefore.slice(0,4)) - (period.endBefore.endsWith('-01-01') ? 1 : 0) : period.end;
  const end = Math.min(transitionEnd ?? validCurrentYear(currentYear), validCurrentYear(currentYear));
  return [Math.min(period.start, end), end];
}

/** Preserve contemporary periods instead of assigning a year to one dynasty. */
export function periodsForYear(year, currentYear = new Date().getFullYear(), countryCode = 'CN') {
  if (!Number.isInteger(year) || year > validCurrentYear(currentYear)) return [];
  return periodsForCountry(countryCode).filter(period => !period.navigationOnly
    && year >= periodBounds(period.id,currentYear,countryCode)[0] && year <= periodBounds(period.id,currentYear,countryCode)[1]);
}

// Numeric civil-date keys avoid timezone shifts and JavaScript's special handling
// of years 0–99. A missing day/month is a range of uncertainty, not an invented day.
const dateKey = (year,month=1,day=1) => year*10000+month*100+day;
const daysInMonth = (year,month) => [31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
function eventStartRange(event) {
  if(!Number.isInteger(event.year))return null;
  if(!event.date)return [dateKey(event.year),dateKey(event.year,12,31)];
  const match=/^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(event.date);
  if(!match)return null;
  const [,yearText,monthText,dayText]=match,year=Number(yearText),month=Number(monthText),day=Number(dayText);
  if(year!==event.year||month<1||month>12||dayText&&(day<1||day>daysInMonth(year,month)))return null;
  return dayText?[dateKey(year,month,day),dateKey(year,month,day)]:[dateKey(year,month),dateKey(year,month,daysInMonth(year,month))];
}
const civilKey = date => dateKey(...date.split('-').map(Number));
function dateBounds(period) {
  return [period.startDate?civilKey(period.startDate):dateKey(period.start),
    period.endBefore?civilKey(period.endBefore):period.end===null?Infinity:dateKey(period.end+1)];
}

/** Resolve one period from the start date; a duration never duplicates ownership.
 * Contemporary regimes and uncertain boundary years need an explicit assignment.
 * Contradictory labels cannot override a known day outside the period's bounds.
 */
export function periodForEvent(event,countryCode='CN') {
  // A Chinese-history record abroad keeps its subject attribution. Likewise,
  // Japanese records must never be inferred as Chinese dynasties by year alone.
  const declaredCountry=PERIOD_COUNTRIES.get(event.periodId);
  if(declaredCountry&&declaredCountry!==countryCode)return null;
  const range=eventStartRange(event);
  if(!range)return null;
  const eraPeriods=ERA_COUNTRIES.filter(p=>event.era===p.name||event.era?.startsWith(p.name+' · '));
  const eraCountries=new Set(eraPeriods.map(p=>PERIOD_COUNTRIES.get(p.id)));
  // Shared labels cannot imply ownership by array order or fall through to an
  // unrelated local era when their date fits only another country's chronology.
  if(!declaredCountry&&eraCountries.size&&!eraCountries.has(countryCode))return null;
  if(!declaredCountry&&eraCountries.size>1&&!eraPeriods.some(p=>{
    const [start,end]=dateBounds(p);
    return PERIOD_COUNTRIES.get(p.id)===countryCode&&range[1]>=start&&range[0]<end;
  }))return null;
  const candidates=periodsForCountry(countryCode).filter(period=>{
    if(period.navigationOnly)return false;
    const [start,end]=dateBounds(period);return range[1]>=start&&range[0]<end;
  });
  const declared=candidates.filter(period=>event.periodId===period.id||event.era===period.name||event.era?.startsWith(period.name+' · '));
  if(declared.length===1)return declared[0];
  if(candidates.length!==1)return null;
  const [start,end]=dateBounds(candidates[0]);
  return range[0]>=start&&range[1]<end?candidates[0]:null;
}

/** Broad navigation scopes retain interval overlap; specific periods are unique. */
export function eventMatchesPeriod(event,id='all',countryCode='CN') {
  const period=periodsForCountry(countryCode).find(item=>item.id===id);
  if(!period||period.id==='all')return true;
  if(period.navigationOnly)return (event.endYear??event.year)>=period.start&&(period.end===null||event.year<=period.end);
  return periodForEvent(event,countryCode)?.id===period.id;
}

/** Compact axis label; year 0 is displayed as the historical year 1 BCE. */
export function yearTickLabel(year) {
  if (!Number.isInteger(year)) return '';
  return year <= 0 ? `前${1 - year}` : String(year);
}
