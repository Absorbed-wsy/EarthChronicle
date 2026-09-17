# 第三方组件与资料声明

## 软件组件

- **MapLibre GL JS 6.10.0**：采用 BSD-3-Clause 及其附属第三方许可。准备依赖后，完整声明位于 `public/vendor/maplibre/LICENSE.txt`，源代码见 [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)。
- **Node.js 24.19.0**：Windows 运行环境；完整许可见 [runtime/LICENSE.txt](runtime/LICENSE.txt)。
- **Microsoft WebView2 SDK 1.0.4191.47**：托管组件与 WebView2Loader 来自 [Microsoft 官方 NuGet 包](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4191.47)，许可见 [LICENSE](licenses/WebView2/LICENSE.txt) 和 [NOTICE](licenses/WebView2/NOTICE.txt)。WebView2 Evergreen Runtime 使用系统安装的共享运行环境，分发说明见 [Microsoft 文档](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)。
- **.NET Framework 4.8 / Windows Forms**：使用 Windows 上安装的 Microsoft 运行环境。

## 现代地图与高程

- **OpenFreeMap / OpenStreetMap / OpenMapTiles**：在线矢量地图来自 [OpenFreeMap](https://openfreemap.org/)，数据为 © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，采用 ODbL，使用 OpenMapTiles 数据模式。应用按当前视野请求在线细节，不提供地区地图包下载。界面保留地图数据署名；公共服务不保证可用性。OpenFreeMap 项目与派生资料许可见 [OpenFreeMap-LICENSE.md](licenses/maps/OpenFreeMap-LICENSE.md)。
- **Liberty 地图样式**：`public/maps/liberty.json` 来自 OpenFreeMap 的 Liberty 样式，派生自 [OSM Liberty](https://github.com/maputnik/osm-liberty)、OSM Bright 和 Mapbox Open Styles。样式代码采用 BSD-3-Clause，设计采用 CC BY 4.0，许可见 [OSM-Liberty-LICENSE.md](licenses/maps/OSM-Liberty-LICENSE.md)。本软件运行时调整地名语言、字体、基础图层和点击交互。随附 sprite 图标来自同一服务，其中 Maki 图标采用 CC0 1.0，见 [Maki-LICENSE.txt](licenses/maps/Maki-LICENSE.txt)。
- **Mapzen Terrain Tiles / Tilezen**：公开的 [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) 高程数据，使用 Terrarium PNG。数据融合来源包括 NASA / NGA / USGS SRTM、USGS 3DEP / GMTED2010、NOAA ETOPO1 及各地区开放数据；各地完整版权和许可按 [官方署名清单](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) 保留，界面提供可见的 Mapzen 与来源链接。格式和精度见 [格式说明](https://github.com/tilezen/joerd/blob/master/docs/formats.md) 与 [数据来源](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md)。地形网格间距不等于原始测量精度。
- **Natural Earth**：随附的全球基础地图用于离线概览，数据属于公有领域，使用条款见 [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)。陆地和国家边界采用 1:110m 数据，主要城市采用 1:50m Populated Places；数据来自 [Natural Earth 官方数据仓库](https://github.com/nvkelso/natural-earth-vector/tree/master/geojson)，保留源数据几何和地名，移除未使用的属性以减小体积。

## 历史资料

事件摘要由本项目整理，来源包括故宫博物院、国家图书馆及地方文旅机构。每条事件的来源名称与链接保存在 [history.json](public/data/history.json) 的 `sourceTitle` 和 `sourceUrl` 字段，并在软件详情中展示。

时间按年组织，界面的年号用于年度导航，不作日级历法换算。地点采用现代城市级参考坐标，表示事件关联地区，不等同于精确遗址位置或历史行政边界。摘要未复制完整文章、书籍或第三方图片。
