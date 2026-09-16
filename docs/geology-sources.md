# 地质演示资料

模型：MULLER2019（Müller et al., 2019），时间范围0—250 Ma，默认anchor plate ID 0。

参考文献：Müller, R. D. et al. (2019). A global plate model including lithospheric deformation along major rifts and orogens since the Triassic. Tectonics. https://doi.org/10.1029/2018TC005462

模型说明：https://gwsdoc.gplates.org/models/#muller2019

接口说明：https://gwsdoc.gplates.org/reconstruction/reconstruct-coastlines/

本地0、66、120、200 Ma切片来自 GPlates Web Service 的 reconstruct/coastlines 接口，显式指定 model=MULLER2019 与 time，对返回的GeoJSON保留原坐标。获取日期2026-09-16。下载请求形如：https://gws.gplates.org/reconstruct/coastlines/?model=MULLER2019&time=66 。

这些是板块模型重建的陆块轮廓，不是古海岸线随海平面变化的完整复原，也没有古地形高度。界面隐藏现代地表影像及现代城市，避免把现代地貌误当成古地貌。陆块仅作统一色填充。切片之间没有伪造数据或形状插值。

模型许可来源文件随数据保留为 License.source.txt；地图、CesiumJS组件与模型各自署名。打算公开发行或在其他用途重用时应核对所选模型分发包版本与完整条款。此版为用户本地原型。

此外已下载现代板块边界文件0-boundaries.geojson作为后续研究资料，本版界面不显示该文件，不冒充已实现逐年代的板块边界层。
