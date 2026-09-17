# 地球史书 EarthChronicle

地球史书是按地点与时间浏览世界历史资料的 Windows 桌面软件，支持 3D 地球、平面地图和个人事件记录。可选的内容服务器提供局域网网页阅读。

世界历史默认选择中国，从本机当前年份向过去追溯，支持按国家、地区、城市、时期、年份、类型与关键词检索。地图仅标记所选年份发生或仍在持续的事件。本地软件可在地图上选点创建个人事件，并编辑、删除和迁移个人记录；网页端只读。

桌面程序使用 .NET Framework / WinForms 和 WebView2，地图使用 MapLibre GL JS，本地服务使用 Node.js，资料保存在 SQLite 数据库中。

软件附带全球基础地图，详细道路与地点按视野从 OpenFreeMap 加载矢量数据，真实地形使用 Mapzen Terrain Tiles。在线细节需要联网，无需服务密钥，也无需下载地区地图包。城市和地区在数据提供中文名称时显示中文与当地名称对照，点击城市名称可自动放大。地图以分级加载和有限缓存控制资源使用，数据来源和精度限制见使用说明。

## 从源码构建

环境要求：Windows 10/11 x64、.NET Framework 4.8、WebView2 Evergreen Runtime，以及 PowerShell、curl、tar。WebView2 Runtime 可从 [Microsoft 官方页面](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)获取。

获取仓库后，在项目根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/prepare.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/build.ps1
```

准备脚本下载并校验 Node.js 24.19.0、MapLibre GL JS 6.10.0 和 WebView2 SDK 1.0.4191.47，无需全局安装 Node.js 或包管理器。首次准备需要网络；可通过 `desktop/prepare.ps1 -CachePath <缓存目录>` 复用已下载的依赖。SDK 不包含 WebView2 Evergreen Runtime，请提前安装上述系统运行环境。

构建产物为项目根目录的 **EarthChronicle.exe**，双击即可运行。使用时保留同目录的组件、`runtime` 和 `public` 资源；仅复制 EXE 无法运行完整软件。构建脚本不生成安装包。

窗口、地图、个人记录、网页访问及数据库备份的操作方法见 [使用说明](docs/使用说明.md)。

## 基础资料与数据库

源码包含以下必要资料，下载整个仓库并完成构建后即可使用，无需从开发者电脑复制数据库或地图文件：

| 资源 | 随源码提供的内容 |
| --- | --- |
| `public/data/history.json` | 5 个地点、24 条中国明初历史事件及来源 |
| `public/maps/*.geojson` | 全球基础陆地、国家边界、国家名称及 1,251 个主要城市 |
| `public/maps/liberty.json`、`sprite*` | 地图样式及普通、高清图标图集 |
| `desktop/assets/`、`public/favicon.*` | 桌面程序与网页图标 |
| `licenses/`、`runtime/LICENSE.txt` | 随附资料与组件的许可声明 |

首次启动会自动创建 `data/chronicle.sqlite` 并导入基础历史资料。当前年份没有资料时，列表和地图事件标记为空，可选择“明”或有记录的年份浏览。其他国家的历史事件尚未收录，国家列表不代表资料覆盖范围。

基础地图及样式共约 1.2 MiB，构建完成后可离线显示。字体使用系统字体。在线道路、街区和高程按视野从网络加载；这些详细数据不随仓库分发，也不需要预先下载。

内置资料、个人事件、显示设置和内容服务器配置统一保存在该数据库中。内置资料只读，个人事件可在本地软件中编辑；网页端只读。本机数据库、备份、日志及浏览器缓存不提交到仓库。更新软件时保留原 `data` 文件夹，个人记录会保留。

兼容的旧数据库会自动迁移，保留个人记录与设置。通过本地设置导出、导入数据库，可迁移个人事件及其地图坐标；具体合并规则见使用说明。

## 测试

准备依赖后，在项目根目录运行：

```powershell
./runtime/node.exe --test tests/*.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/test.ps1
```

自动测试覆盖数据库迁移、自定义事件、网页只读权限、筛选与时间轴、地图资源完整性及更新工具。GitHub Actions 在 Windows 上从源码执行依赖准备、自动测试和 EXE 编译。

## 工程目录

| 路径 | 内容 |
| --- | --- |
| `desktop/` | Windows 窗口、依赖准备、构建及更新工具 |
| `public/` | 界面、地图及初始化资料 |
| `server.mjs`、`database.mjs` | 本地服务、访问控制与数据库 |
| `tests/` | 前端、服务、数据库、原生请求及更新工具测试 |
| `docs/` | 软件使用说明 |
| `licenses/`、`runtime/LICENSE.txt` | 第三方许可文件 |

## 许可证

软件代码采用 [GPL-3.0](LICENSE)。第三方组件和资料按各自许可和使用条件处理，来源见 [第三方组件与资料声明](THIRD-PARTY-NOTICES.md)。
