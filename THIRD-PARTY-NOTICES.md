# 第三方组件与资料

- CesiumJS 1.145.0：Apache-2.0 与所附第三方许可。完整说明见 public/vendor/cesium/LICENSE.md；Natural Earth II 低分辨率地图随 Cesium 分发，界面保留归属标识。
- Node.js 24.19.0：随包 runtime/node.exe 为 Windows 运行环境，完整第三方许可见 runtime/LICENSE.txt。无需安装系统服务。
- Microsoft.Web.WebView2 SDK 1.0.4191.47：Windows 原生窗口使用随包的托管组件与 WebView2Loader。许可与附属声明保存在 licenses/WebView2/LICENSE.txt 和 licenses/WebView2/NOTICE.txt；SDK 包来源见 [Microsoft 官方 NuGet 包](https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4191.47)。WebView2 Evergreen Runtime 使用系统已安装的共享运行环境，其分发方式与许可要求见 [Microsoft WebView2 分发文档](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)。本软件不将完整 Evergreen Runtime 作为自有组件分发。
- .NET Framework 4.8 / Windows Forms：使用 Windows 上安装的 Microsoft 运行环境，未将其系统运行库复制为本项目源码。
- MULLER2019 板块重建资料：由 GPlates Web Service 提供。保留模型作者署名、论文来源、接口说明及模型许可文件，见 docs/geology-sources.md 和 public/data/geology/License.source.txt。
- 历史事实：摘要由本项目整理，逐条附官方文献页面链接，来源与精度限制见 docs/history-sources.md。未复制完整书籍、网页正文或第三方图片。

Ancient Earth、Running Reality 和 GeaCron 是交互参考；本项目没有复制它们的源码、界面图片或品牌素材。
