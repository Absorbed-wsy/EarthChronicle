# 地球史书 EarthChronicle · v0.3.3

在 Windows 本地阅读、整理按地点和年份组织的历史资料，也可开启内容服务器供网页阅读。

## 启动与退出

双击 **启动地球史书.cmd** 或 **EarthChronicle.exe** 打开软件。软件使用 Windows 原生窗口与 WebView2。

点击 **−** 正常最小化，窗口保留在任务栏；正常显示和最小化时不显示托盘图标。点击 **X** 隐藏到系统托盘，内容服务器继续运行。双击托盘图标重新打开；右键托盘图标选择 **退出软件**，或双击 **停止地球史书.cmd**，结束本地软件及内容服务器。使用 `EarthChronicle.exe --background` 可直接在托盘后台启动。

隐藏与恢复使用同一个窗口，不再重建窗口。

## 网页阅读

在本地 **设置 → 内容服务器** 中开启网页访问并选择端口，默认 8080。通过给出的地址打开网页。网页为只读，只能调整当前浏览器的外观与布局；端口、数据库管理及个人记录编辑仅在本地软件中提供。普通浏览器访问本机地址也不会获得管理权限。

**启动局域网共享.cmd** 可启动软件并开启保存的内容服务器端口。程序不会自动更改 Windows 防火墙规则。

## 资料与备份

运行资料统一保存在 **data/chronicle.sqlite**，包含内置历史、地点、地质切片、个人记录、本地显示偏好及内容服务器配置。内置历史与地质资料只读，个人记录可新增、编辑和删除。

在本地 **设置 → 数据库** 导出或导入 `.sqlite` 文件。导入合并个人记录并保留较新修改，恢复本地显示设置，保留当前机器的内容服务器开关和端口。

顶部 **文明历史 / 地球演化** 切换阅读内容。时间轴拖动上沿调整高度，侧栏拖动分隔线调整宽度；面板隐藏与恢复统一通过 **设置 → 外观与显示 → 显示选项** 控制。地图区域已移除收起列表、收起详情、现代地表参考、Müller2019 浮签及查看全部地点按钮，资料来源保留在详情和“关于资料”中。

需要查看全部地点时，在事件列表的地点筛选中选择 **全部**，时间范围选择 **整个篇章**，再点击地图的全景按钮。到达时间范围边界后，相应方向的跳转按钮禁用；重复跳转到当前年份不会改变选中事件或地图。详细操作、数据限制和故障排查见 **[v0.3.3 使用说明](docs/windows-v0.3.md)**。历史与地质来源分别见 [历史来源](docs/history-sources.md) 和 [地质来源](docs/geology-sources.md)。旧版文档只供版本参考。

## 开发

Windows 原生外壳使用 .NET Framework 4.8 WinForms 和 WebView2；随包提供 Node.js 24.19.0 与 CesiumJS。WebView2 使用系统已安装的 Evergreen Runtime。

仓库保留源码、固定示例资料、依赖锁定和许可证；运行数据库、备份、浏览器缓存及编译产物不提交。

在 Windows x64 上从源码准备并构建：

```powershell
powershell -NoProfile -File desktop/prepare.ps1
./runtime/node.exe --test tests/*.test.mjs
powershell -NoProfile -File desktop/test.ps1
powershell -NoProfile -File desktop/build.ps1
```

准备脚本从官方分发地址下载固定版本并核对摘要，无需全局安装 Node.js 或包管理器。构建后双击 `EarthChronicle.exe`；使用同目录资源，首次运行自动建立数据库。需要 Windows .NET Framework 4.8 和 WebView2 Evergreen Runtime。

`npm start` 启动原生软件；`npm run start:server` 仅启动开发用后端，不会赋予普通浏览器管理权限。详细步骤、离线准备和目录结构见 [开发与构建](docs/开发与构建.md)。[下一阶段设计目标](docs/下一阶段设计目标.md) 描述拟议的 v0.4 范围，尚未实现。

项目沿用仓库的 [GPL-3.0 许可证](LICENSE)，第三方组件及资料的许可见 [第三方说明](THIRD-PARTY-NOTICES.md)。
