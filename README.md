# 地球史书 EarthChronicle

地球史书是按地点与时间浏览历史资料的 Windows 桌面软件，支持 3D 地球、平面地图、文明历史、地球演化和个人事件记录。可选的内容服务器提供局域网网页阅读。

桌面程序使用 .NET Framework / WinForms 和 WebView2，地图使用 CesiumJS，本地服务使用 Node.js，资料保存在 SQLite 数据库中。

## 从源码构建

环境要求：Windows 10/11 x64、.NET Framework 4.8、WebView2 Evergreen Runtime，以及 PowerShell、curl、tar。WebView2 Runtime 可从 [Microsoft 官方页面](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)获取。

获取仓库后，在项目根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/prepare.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/build.ps1
```

准备脚本下载并校验 Node.js 24.19.0、CesiumJS 1.145.0 和 WebView2 SDK 1.0.4191.47，无需全局安装 Node.js 或包管理器。首次准备需要网络；可通过 `desktop/prepare.ps1 -CachePath <缓存目录>` 复用已下载的依赖。

构建产物为项目根目录的 **EarthChronicle.exe**，双击即可运行。使用时保留同目录的组件、`runtime` 和 `public` 资源；仅复制 EXE 无法运行完整软件。构建脚本不生成安装包。

窗口、地图、个人记录、网页访问及数据库备份的操作方法见 [使用说明](docs/使用说明.md)。

## 基础资料与数据库

仓库中的 `public/data/` 包含 5 个地点、24 条明初历史事件和 4 个地质切片。首次启动会自动创建 `data/chronicle.sqlite` 并导入这些基础资料，无需手动下载或导入数据库。

运行时，内置资料、个人事件、显示设置和内容服务器配置统一保存在该数据库中。内置资料只读，个人事件可在本地软件中编辑；网页端只读。本机数据库、备份、日志及浏览器缓存不提交到仓库。

## 测试

准备依赖后，在项目根目录运行：

```powershell
./runtime/node.exe --test tests/*.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File desktop/test.ps1
```

GitHub Actions 在 Windows 上执行依赖准备、自动测试和 EXE 编译。

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

项目采用 [GPL-3.0](LICENSE)。第三方组件、地图模型与历史资料的来源见 [第三方组件与资料声明](THIRD-PARTY-NOTICES.md)。
