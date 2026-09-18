# 第三方组件与资料声明

## 软件组件

- **MapLibre GL JS 6.10.0**：采用 BSD-3-Clause 及其附属第三方许可。准备依赖后，完整声明位于 `public/vendor/maplibre/LICENSE.txt`，源代码见 [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)。
- **Node.js 24.19.0**：Windows 运行环境；完整许可见 [runtime/LICENSE.txt](runtime/LICENSE.txt)。
- **Microsoft WebView2 SDK 1.0.4191.47**：托管组件与 WebView2Loader 来自 [Microsoft 官方 NuGet 包](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4191.47)，许可见 [LICENSE](licenses/WebView2/LICENSE.txt) 和 [NOTICE](licenses/WebView2/NOTICE.txt)。WebView2 Evergreen Runtime 使用系统安装的共享运行环境，分发说明见 [Microsoft 文档](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)。
- **.NET Framework 4.8 / Windows Forms**：使用 Windows 上安装的 Microsoft 运行环境。

## 现代地图与高程

- **OpenFreeMap / OpenStreetMap / OpenMapTiles**：在线矢量地图来自 [OpenFreeMap](https://openfreemap.org/)，数据为 © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，采用 ODbL，使用 OpenMapTiles 数据模式。应用按当前视野请求在线细节，不提供地区地图包下载。界面保留地图数据署名；公共服务不保证可用性。OpenFreeMap 项目与派生资料许可见 [OpenFreeMap-LICENSE.md](licenses/maps/OpenFreeMap-LICENSE.md)。
- **Noto 地名字形**：`public/maps/fonts/noto-sans/` 随附来自 OpenFreeMap 的 Noto Sans Regular 预制字形，包含基本多文种平面内的 47,586 个字形，采用 SIL Open Font License 1.1。软件从本地读取字形；文件来源及 SHA-256 见该目录的校验清单。字体许可及原始版权见 [Noto-OFL.txt](licenses/maps/Noto-OFL.txt)、[NotoCJK-OFL.txt](licenses/maps/NotoCJK-OFL.txt) 和 [Noto-NOTICE.txt](licenses/maps/Noto-NOTICE.txt)。
- **Liberty 地图样式**：`public/maps/liberty.json` 来自 OpenFreeMap 的 Liberty 样式，派生自 [OSM Liberty](https://github.com/maputnik/osm-liberty)、OSM Bright 和 Mapbox Open Styles。样式代码采用 BSD-3-Clause，设计采用 CC BY 4.0，许可见 [OSM-Liberty-LICENSE.md](licenses/maps/OSM-Liberty-LICENSE.md)。本软件运行时调整地名语言、字体、基础图层和点击交互。随附 sprite 图标来自同一服务，其中 Maki 图标采用 CC0 1.0，见 [Maki-LICENSE.txt](licenses/maps/Maki-LICENSE.txt)。
- **Mapzen Terrain Tiles / Tilezen**：公开的 [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) 高程数据，使用 Terrarium PNG。数据融合来源包括 NASA / NGA / USGS SRTM、USGS 3DEP / GMTED2010、NOAA ETOPO1 及各地区开放数据；各地完整版权和许可按 [官方署名清单](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) 保留，界面提供可见的 Mapzen 与来源链接。格式和精度见 [格式说明](https://github.com/tilezen/joerd/blob/master/docs/formats.md) 与 [数据来源](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md)。地形网格间距不等于原始测量精度。
- **Natural Earth**：随附的全球基础地图用于离线概览，数据属于公有领域，使用条款见 [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)。陆地和国家边界采用 1:110m 数据，主要城市采用 1:50m Populated Places；数据来自 [Natural Earth 官方数据仓库](https://github.com/nvkelso/natural-earth-vector/tree/master/geojson)，保留源数据几何和地名，移除未使用的属性以减小体积。

## 历史资料

事件摘要由本项目整理，保留明初资料并扩充中华人民共和国时期史料。来源包括档案、地方志与县市政府资料、国家机关、科研院所、国际组织、博物馆及可靠新闻资料；不同来源的表述与统计口径可能不同。每条事件的主要出处保存在 [history.json](public/data/history.json) 的 `sourceTitle`、`sourceUrl` 字段，补充出处保存在 `sources` 中，并在软件详情中展示。摘要采用重新组织的事实叙述，不复制完整原文。

时间轴按年组织，已核实的日期另以 `date` 和 `precision` 记录；来源只能支持年份时不补造月日。地点采用现代城市、县城或场址的参考坐标，县域资料同时保留所属地级市与历史名称以便检索；全国性政策标记发布或决策地点，跨地区事件用代表性地点并附说明，不等同于历史行政边界或事件影响范围。
