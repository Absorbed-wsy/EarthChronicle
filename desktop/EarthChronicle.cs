using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: System.Reflection.AssemblyTitle("地球史书")]
[assembly: System.Reflection.AssemblyProduct("EarthChronicle")]
[assembly: System.Reflection.AssemblyVersion("0.1.11.0")]
[assembly: System.Reflection.AssemblyFileVersion("0.1.11.0")]

namespace EarthChronicle {
 internal static class NativeTransport {
  internal static HttpClient CreateClient(string key) {
   // Custom authentication headers survive HttpClient's automatic redirects.
   // Control requests never need redirects, so do not forward credentials.
   var client=new HttpClient(new HttpClientHandler { UseProxy=false,AllowAutoRedirect=false });
   client.Timeout=TimeSpan.FromSeconds(15);client.DefaultRequestHeaders.Add("X-Desktop-Key",key);return client;
  }
  internal static bool IsOrigin(string address,string origin) {
   Uri uri;return Uri.TryCreate(address,UriKind.Absolute,out uri)&&uri.GetLeftPart(UriPartial.Authority)==origin;
  }
 }
 internal static class Program {
  internal static string Root = AppDomain.CurrentDomain.BaseDirectory;
  internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
  internal static readonly object LogLock = new object();
  internal static void Log(string value) { try { lock (LogLock) File.AppendAllText(Path.Combine(Root,"data","desktop.log"), DateTime.Now.ToString("s")+" "+value+Environment.NewLine,Encoding.UTF8); } catch {} }
  [STAThread] private static void Main(string[] args) {
   try { Run(args); }
   catch(Exception error) { Log(error.ToString());MessageBox.Show("无法启动地球史书："+error.Message,"地球史书",MessageBoxButtons.OK,MessageBoxIcon.Error);Environment.ExitCode=1; }
  }
  private static void Run(string[] args) {
   Directory.CreateDirectory(Path.Combine(Root,"data"));
   Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
   string identity;
   using(var sha=SHA256.Create()) identity=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Root.ToLowerInvariant()))).Replace("-","").Substring(0,24);
   string name="Local\\EarthChronicle-"+identity;
   bool first;
   using(var mutex=new Mutex(true,name,out first)) {
    bool quit=args.Contains("--quit"), share=args.Contains("--share");
    if(!first) {
     string command=quit?"quit":share?"share":"show";
     for(int i=0;i<40;i++) { try { using(var signal=EventWaitHandle.OpenExisting(name+"-"+command)) signal.Set(); return; } catch(WaitHandleCannotBeOpenedException) { Thread.Sleep(100); } }
     MessageBox.Show("地球史书正在启动，请稍后再试。","地球史书"); return;
    }
    if(quit) { mutex.ReleaseMutex(); return; }
    using(var showSignal=new EventWaitHandle(false,EventResetMode.AutoReset,name+"-show"))
    using(var quitSignal=new EventWaitHandle(false,EventResetMode.AutoReset,name+"-quit"))
    using(var shareSignal=new EventWaitHandle(false,EventResetMode.AutoReset,name+"-share"))
    using(var form=new ChronicleWindow(showSignal,quitSignal,shareSignal,share,args.Contains("--background"),args.Contains("--local-test"))) {
     Application.Run(form);
    }
    mutex.ReleaseMutex();
   }
  }
 }

 internal sealed class ChronicleWindow : Form {
  private readonly NotifyIcon tray;
  private readonly Icon globeIcon;
  private readonly Label startup;
  private readonly EventWaitHandle showSignal,quitSignal,shareSignal;
  private readonly System.Windows.Forms.Timer signals=new System.Windows.Forms.Timer();
  private readonly string key,origin;
  private readonly HttpClient http;
  private readonly int port;
  private readonly bool startHidden,localTest;
  private bool sharePending,ready,exiting,shutdownStarted,hiddenToTray,trayHideQueued,sharingInProgress,backendLost;
  private string token;
  private int browserPid,hideRequestVersion,closeRequestCount,trayHideCount,hostHandleCreatedCount,hostHandleDestroyedCount,webViewHandleCreatedCount,webViewHandleDestroyedCount;
  private long lastHostHandle,lastWebViewHandle;
  private Process backend;
  private WebView2 view;
  private FormWindowState restoreState=FormWindowState.Normal;

  internal ChronicleWindow(EventWaitHandle show,EventWaitHandle quit,EventWaitHandle share,bool enableShare,bool hidden,bool localOnly) {
   showSignal=show;quitSignal=quit;shareSignal=share;sharePending=enableShare;startHidden=hidden;localTest=localOnly;
#if LOCAL_TEST
   localTest=true;
#endif
   byte[] bytes=new byte[32];using(var random=RandomNumberGenerator.Create()) random.GetBytes(bytes);key=BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant();
   port=ChoosePort();origin="http://127.0.0.1:"+port;
   http=NativeTransport.CreateClient(key);
   Text="地球史书";StartPosition=FormStartPosition.CenterScreen;MinimumSize=new Size(960,640);Size=new Size(1440,940);WindowState=FormWindowState.Maximized;BackColor=Color.FromArgb(246,248,250);
   restoreState=WindowState;
   globeIcon=LoadApplicationIcon();Icon=globeIcon;
   startup=new Label { Text="正在打开地球史书…",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleCenter,Font=new Font("Microsoft YaHei UI",12) };Controls.Add(startup);
   var menu=new ContextMenuStrip();menu.Items.Add("打开地球史书",null,(s,e)=>RestoreWindow());menu.Items.Add(new ToolStripSeparator());menu.Items.Add("退出软件",null,async(s,e)=>await ExitApplication());
   tray=new NotifyIcon { Icon=globeIcon,Text="地球史书",ContextMenuStrip=menu,Visible=false };tray.DoubleClick+=(s,e)=>RestoreWindow();
   Resize+=(s,e)=>{
    if(exiting||hiddenToTray||trayHideQueued)return;
    // Standard minimization keeps the taskbar button. Only closing the window
    // (or an explicit background launch) transfers it to the notification area.
    if(WindowState!=FormWindowState.Minimized)restoreState=WindowState;
    tray.Visible=false;WriteState(CurrentWindowStatus());
   };
   FormClosing+=(s,e)=>{
    if(exiting)return;
    if(e.CloseReason==CloseReason.UserClosing){
     e.Cancel=true;closeRequestCount++;Program.Log("close requested "+closeRequestCount);
     QueueHideToTray();
    }else {exiting=true;signals.Stop();hideRequestVersion++;trayHideQueued=false;StopBackendImmediately();}
   };
   signals.Interval=200;signals.Tick+=async(s,e)=>{
    if(quitSignal.WaitOne(0)){await ExitApplication();return;}
    if(showSignal.WaitOne(0))RestoreWindow();
    if(shareSignal.WaitOne(0)){RestoreWindow();if(ready)await EnableSharing();else sharePending=true;}
   };signals.Start();
   Shown+=async(s,e)=>{if(startHidden)HideToTray();await Initialize();};
  }

  private static int ChoosePort() {
   TcpListener listener=null;
   try {listener=new TcpListener(IPAddress.Loopback,8765);listener.Start();return 8765;}
   catch(SocketException) {if(listener!=null)listener.Stop();listener=new TcpListener(IPAddress.Loopback,0);listener.Start();return ((IPEndPoint)listener.LocalEndpoint).Port;}
   finally {if(listener!=null)listener.Stop();}
  }
  private static Icon LoadApplicationIcon() {
   // The exact same multi-resolution asset supplies the EXE, window and tray.
   // Clone before closing the resource stream so the icon owns its lifetime.
   using(var stream=typeof(ChronicleWindow).Assembly.GetManifestResourceStream("EarthChronicle.Icon")) {
    if(stream==null)throw new IOException("缺少软件图标资源，请重新构建地球史书。");
    using(var source=new Icon(stream))return (Icon)source.Clone();
   }
  }
  private async Task Initialize() {
   try {
    string node=Path.Combine(Program.Root,"runtime","node.exe"),server=Path.Combine(Program.Root,"server.mjs");
    if(!File.Exists(node)||!File.Exists(server))throw new IOException("缺少运行文件，请保留完整的软件文件夹。");
    var info=new ProcessStartInfo(node,"--no-warnings \""+server+"\" --port "+port+(localTest?" --content-local-only":"")) { WorkingDirectory=Program.Root,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8 };
    backend=new Process { StartInfo=info,EnableRaisingEvents=true };backend.Exited+=OnBackendExited;backend.OutputDataReceived+=(s,e)=>{if(e.Data!=null)Program.Log("server: "+e.Data);};backend.ErrorDataReceived+=(s,e)=>{if(e.Data!=null)Program.Log("server: "+e.Data);};
    if(exiting)return;
    // Inherit the environment directly: .NET Framework's copied dictionary can
    // reject a host environment containing both PATH and Path. Private values
    // exist only for child creation and never reach the WebView profile.
    Environment.SetEnvironmentVariable("EARTH_CHRONICLE_DESKTOP_KEY",key);
    Environment.SetEnvironmentVariable("EARTH_CHRONICLE_PARENT_PID",Process.GetCurrentProcess().Id.ToString());
    try{backend.Start();}finally{Environment.SetEnvironmentVariable("EARTH_CHRONICLE_DESKTOP_KEY",null);Environment.SetEnvironmentVariable("EARTH_CHRONICLE_PARENT_PID",null);}
    backend.BeginOutputReadLine();backend.BeginErrorReadLine();WriteState(CurrentWindowStatus());
    Dictionary<string,object> session=null;
    for(int i=0;i<80&&!exiting;i++) {
     if(backend.HasExited)throw new IOException("后台服务启动失败，请查看 data\\desktop.log。");
     try{session=await Request("GET","/api/session",null);if(Convert.ToBoolean(session["canEdit"]))break;}catch(HttpRequestException){}catch(TaskCanceledException){}
     await Task.Delay(200);
    }
    if(exiting)return;
    if(session==null||!Convert.ToBoolean(session["canEdit"]))throw new IOException("后台服务暂时没有响应，请重新启动。");
    token=(string)session["token"];http.DefaultRequestHeaders.Add("X-Edit-Token",token);
    var environment=await CoreWebView2Environment.CreateAsync(null,Path.Combine(Program.Root,"data","webview2"));
    if(exiting)return;
    view=new WebView2 { Dock=DockStyle.Fill,DefaultBackgroundColor=BackColor };
    view.HandleCreated+=(s,e)=>{webViewHandleCreatedCount++;lastWebViewHandle=((Control)s).Handle.ToInt64();Program.Log("webview handle created "+webViewHandleCreatedCount+": "+lastWebViewHandle);};
    view.HandleDestroyed+=(s,e)=>{webViewHandleDestroyedCount++;Program.Log("webview handle destroyed "+webViewHandleDestroyedCount+": "+lastWebViewHandle);};
    Controls.Add(view);view.BringToFront();
    await view.EnsureCoreWebView2Async(environment);
    if(exiting)return;
    if(!BackendIsRunning())throw new IOException("后台服务已停止，请重新启动地球史书。");
    browserPid=(int)view.CoreWebView2.BrowserProcessId;
    view.CoreWebView2.AddWebResourceRequestedFilter(origin+"/*",CoreWebView2WebResourceContext.All);
    view.CoreWebView2.WebResourceRequested+=(s,e)=>{
     if(!NativeTransport.IsOrigin(e.Request.Uri,origin))return;
     // Preserve the page if the server dies, but never send credentials to a
     // different process that later acquires the vacated loopback port.
     if(!BackendIsRunning()){
      e.Response=environment.CreateWebResourceResponse(new MemoryStream(Encoding.UTF8.GetBytes("{\"error\":\"后台服务已停止，请退出软件后重新启动。\"}")),503,"Service Unavailable","Content-Type: application/json; charset=utf-8\r\nCache-Control: no-store");return;
     }
     e.Request.Headers.SetHeader("X-Desktop-Key",key);
    };
    view.CoreWebView2.Settings.IsStatusBarEnabled=false;
    view.CoreWebView2.NavigationStarting+=(s,e)=>{if(!NativeTransport.IsOrigin(e.Uri,origin)){e.Cancel=true;OpenExternal(e.Uri);}};
    view.CoreWebView2.NewWindowRequested+=(s,e)=>{e.Handled=true;OpenExternal(e.Uri);};
    view.CoreWebView2.ProcessFailed+=(s,e)=>Program.Log("webview: "+e.ProcessFailedKind);
    view.CoreWebView2.Navigate(origin+"/");startup.Visible=false;ready=true;WriteState(CurrentWindowStatus());Program.Log("ready on "+port);
    if(sharePending){sharePending=false;await EnableSharing();}
   } catch(Exception error) {
    if(exiting)return;Program.Log(error.ToString());
    string message=error is WebView2RuntimeNotFoundException?"需要 Microsoft Edge WebView2 运行时。请安装运行时后再打开地球史书。":error.Message;
    MessageBox.Show(this,message,"地球史书无法启动",MessageBoxButtons.OK,MessageBoxIcon.Error);
   }
   if(!ready&&!exiting)await ExitApplication();
  }
  private static void OpenExternal(string address) {
   Uri uri;if(Uri.TryCreate(address,UriKind.Absolute,out uri)&&(uri.Scheme=="http"||uri.Scheme=="https"))try{Process.Start(new ProcessStartInfo(address){UseShellExecute=true});}catch(Exception error){Program.Log(error.Message);}
  }
  private async Task<Dictionary<string,object>> Request(string method,string route,object body) {return await Request(method,route,body,CancellationToken.None);}
  private async Task<Dictionary<string,object>> Request(string method,string route,object body,CancellationToken cancellation) {
   if(!BackendIsRunning())throw new HttpRequestException("后台服务已停止，请退出软件后重新启动。");
   using(var request=new HttpRequestMessage(new HttpMethod(method),origin+route)) {
    if(body!=null)request.Content=new StringContent(Program.Json.Serialize(body),Encoding.UTF8,"application/json");
    using(var response=await http.SendAsync(request,cancellation)) {
     string content=await response.Content.ReadAsStringAsync();
     if(!response.IsSuccessStatusCode)throw new HttpRequestException("操作失败（"+(int)response.StatusCode+"）："+content);
     return Program.Json.Deserialize<Dictionary<string,object>>(content);
    }
   }
  }
  private bool BackendIsRunning(){try{return backend!=null&&!backend.HasExited;}catch(InvalidOperationException){return false;}}
  private void OnBackendExited(object sender,EventArgs e) {
   try {
    BeginInvoke(new Action(()=>{
     if(exiting||IsDisposed||Disposing||!ready||backendLost)return;
     backendLost=true;Text="地球史书 · 服务已停止";tray.Text="地球史书 · 服务已停止";
     // Keep the WebView and any unsaved form fields available to the user.
     startup.Text="后台服务已停止，请退出软件后重新启动。";startup.Dock=DockStyle.Bottom;startup.Height=42;startup.Visible=true;startup.BringToFront();
     WriteState(CurrentWindowStatus());Program.Log("backend stopped unexpectedly");
     if(hiddenToTray)tray.ShowBalloonTip(6000,"地球史书","内容服务器已停止，请退出软件后重新启动。",ToolTipIcon.Warning);
    }));
   }catch(InvalidOperationException){}
  }
  private async Task EnableSharing() {
   if(exiting||sharingInProgress)return;
   sharingInProgress=true;
   try {
    var settings=await Request("GET","/api/settings",null);if(exiting)return;var config=(Dictionary<string,object>)settings["contentServer"];
    await Request("PUT","/api/content-server",new { enabled=true,port=Convert.ToInt32(config["port"]) });
    if(exiting)return;
    // Settings refresh when opened. Reloading here would discard a personal
    // event the user is still writing when a second --share command arrives.
    Program.Log("content server enabled");
   }catch(Exception error){if(!exiting){Program.Log(error.Message);MessageBox.Show(this,"内容服务器未能开启。请在设置中检查端口。","地球史书",MessageBoxButtons.OK,MessageBoxIcon.Warning);}}
   finally{sharingInProgress=false;}
  }
  private string CurrentWindowStatus(){return hiddenToTray?"tray":WindowState==FormWindowState.Minimized?"minimized":backendLost?"service-stopped":ready?"ready":"starting";}
  private void QueueHideToTray(){
   if(exiting||IsDisposed||Disposing||hiddenToTray||trayHideQueued)return;
   trayHideQueued=true;int request=++hideRequestVersion;
   // Finish cancelling WM_CLOSE before changing visibility. Never toggle
   // ShowInTaskbar here: its setter recreates the HWND hosting WebView2.
   try{
    BeginInvoke(new Action(()=>{
     if(request!=hideRequestVersion)return;
     trayHideQueued=false;
     if(!exiting&&!IsDisposed&&!Disposing)HideToTray();
    }));
   }catch(InvalidOperationException){
    trayHideQueued=false;
    if(!exiting&&!IsDisposed&&!Disposing)HideToTray();
   }
  }
  private void HideToTray(){
   if(exiting||IsDisposed||Disposing||hiddenToTray)return;
   if(WindowState!=FormWindowState.Minimized)restoreState=WindowState;
   hiddenToTray=true;tray.Visible=true;
   // Hide removes the taskbar button without rebuilding the form or browser.
   // ShowInTaskbar stays at its default true for later normal minimization.
   Hide();trayHideCount++;WriteState("tray");Program.Log("hidden to tray "+trayHideCount+"; host="+lastHostHandle+"; webview="+lastWebViewHandle);
  }
  private void RestoreWindow(){
   if(exiting||IsDisposed||Disposing)return;
   // A restore request supersedes any close-to-tray delegate still in the queue.
   hideRequestVersion++;trayHideQueued=false;
   var targetState=restoreState==FormWindowState.Minimized?FormWindowState.Normal:restoreState;
   hiddenToTray=false;tray.Visible=false;WindowState=targetState;Show();Activate();
   WriteState(CurrentWindowStatus());Program.Log("restored");
  }
  protected override void OnHandleCreated(EventArgs e){
   base.OnHandleCreated(e);hostHandleCreatedCount++;lastHostHandle=Handle.ToInt64();Program.Log("host handle created "+hostHandleCreatedCount+": "+lastHostHandle);
  }
  protected override void OnHandleDestroyed(EventArgs e){
   hostHandleDestroyedCount++;Program.Log("host handle destroyed "+hostHandleDestroyedCount+": "+lastHostHandle);base.OnHandleDestroyed(e);
  }
  private void WriteState(string state){
   try{
    int backendId=0;try{if(backend!=null)backendId=backend.Id;}catch(InvalidOperationException){}
    File.WriteAllText(Path.Combine(Program.Root,"data","desktop-state.json"),Program.Json.Serialize(new {pid=Process.GetCurrentProcess().Id,backendPid=backendId,browserPid=browserPid,port=port,state=state,windowState=WindowState.ToString().ToLowerInvariant(),windowVisible=Visible,showInTaskbar=ShowInTaskbar,taskbarEligible=Visible&&ShowInTaskbar,trayVisible=tray.Visible,hiddenToTray=hiddenToTray,trayHideQueued=trayHideQueued,closeRequestCount=closeRequestCount,trayHideCount=trayHideCount,hostHandle=IsHandleCreated?lastHostHandle:0,webViewHandle=view!=null&&view.IsHandleCreated?lastWebViewHandle:0,hostHandleCreatedCount=hostHandleCreatedCount,hostHandleDestroyedCount=hostHandleDestroyedCount,webViewHandleCreatedCount=webViewHandleCreatedCount,webViewHandleDestroyedCount=webViewHandleDestroyedCount,ready=ready,backendLost=backendLost,restoreState=restoreState.ToString().ToLowerInvariant(),updatedAt=DateTime.UtcNow.ToString("o"),version="0.1.11"}),Encoding.UTF8);
   }catch{}
  }
  private async Task ExitApplication() {
   if(shutdownStarted)return;shutdownStarted=true;exiting=true;hiddenToTray=false;hideRequestVersion++;trayHideQueued=false;signals.Stop();Hide();tray.Visible=false;Program.Log("exiting");
   if(view!=null){view.Dispose();view=null;}
   try {using(var cancellation=new CancellationTokenSource(2000)){if(token!=null)await Request("POST","/api/shutdown",new {},cancellation.Token);}}catch(Exception error){Program.Log("shutdown: "+error.Message);}
   if(backend!=null){await Task.Run(()=>{try{if(!backend.WaitForExit(4000))backend.Kill();}catch{}});}
   WriteState("stopped");Close();
  }
  private void StopBackendImmediately(){try{if(backend!=null&&!backend.HasExited)backend.Kill();}catch{}WriteState("stopped");}
  protected override void Dispose(bool disposing) {
   if(disposing){exiting=true;signals.Dispose();tray.Visible=false;tray.Dispose();if(view!=null)view.Dispose();http.Dispose();StopBackendImmediately();if(backend!=null)backend.Dispose();globeIcon.Dispose();}
   base.Dispose(disposing);
  }
 }
}
