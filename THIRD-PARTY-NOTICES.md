# 第三方组件与资料声明

## 软件组件

- **CesiumJS 1.145.0**：采用 Apache-2.0 及其附属第三方许可。准备依赖后，完整声明位于 `public/vendor/cesium/LICENSE.md`。Natural Earth II 地图随 Cesium 分发，界面保留相应署名。
- **Node.js 24.19.0**：Windows 运行环境；完整许可见 [runtime/LICENSE.txt](runtime/LICENSE.txt)。
- **Microsoft WebView2 SDK 1.0.4191.47**：托管组件与 WebView2Loader 来自 [Microsoft 官方 NuGet 包](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4191.47)，许可见 [LICENSE](licenses/WebView2/LICENSE.txt) 和 [NOTICE](licenses/WebView2/NOTICE.txt)。WebView2 Evergreen Runtime 使用系统安装的共享运行环境，分发说明见 [Microsoft 文档](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)。
- **.NET Framework 4.8 / Windows Forms**：使用 Windows 上安装的 Microsoft 运行环境。

## 板块重建资料

模型为 **MULLER2019**，作者 Müller et al.（2019）。参考文献：*A global plate model including lithospheric deformation along major rifts and orogens since the Triassic*，Tectonics，[DOI: 10.1029/2018TC005462](https://doi.org/10.1029/2018TC005462)。模型范围为 0—250 Ma，参考板块 ID 为 0。

随附的 0、66、120、200 Ma 切片于 2026-09-16 从 GPlates Web Service 的 `reconstruct/coastlines` 接口获取，指定 `model=MULLER2019` 与对应的 `time`，保留返回的 GeoJSON 坐标。详见 [模型说明](https://gwsdoc.gplates.org/models/#muller2019)和[接口说明](https://gwsdoc.gplates.org/reconstruction/reconstruct-coastlines/)。

模型随附许可为 Creative Commons Attribution 4.0 International，原文见 [License.source.txt](public/data/geology/License.source.txt)。模型资料与软件分别署名。

切片表示模型重建的陆块轮廓，不包含古地形高度或海平面变化下的精确古海岸线；切片之间没有进行形状插值。

## 历史资料

事件摘要由本项目整理，来源包括故宫博物院、国家图书馆及地方文旅机构。每条事件的来源名称与链接保存在 [history.json](public/data/history.json) 的 `sourceTitle` 和 `sourceUrl` 字段，并在软件详情中展示。

时间按年组织，界面的年号用于年度导航，不作日级历法换算。地点采用现代城市级参考坐标，表示事件关联地区，不等同于精确遗址位置或历史行政边界。摘要未复制完整文章、书籍或第三方图片。
