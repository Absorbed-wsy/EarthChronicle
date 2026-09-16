using System;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

namespace EarthChronicle {
 internal static class NativeRegressionTests {
  private static int Main() {
   try {
    OriginBoundaries();
    CredentialsDoNotFollowRedirects().GetAwaiter().GetResult();
    Console.WriteLine("PASS native origin boundaries and real HTTP redirect isolation");return 0;
   }catch(Exception error){Console.Error.WriteLine(error);return 1;}
  }
  private static void Check(bool condition,string message){if(!condition)throw new InvalidOperationException(message);}
  private static void OriginBoundaries() {
   const string origin="http://127.0.0.1:8765";
   foreach(string address in new[]{origin+"/",origin+"/api/session",origin+"/api/events?x=1"})Check(NativeTransport.IsOrigin(address,origin),"Rejected local origin: "+address);
   foreach(string address in new[]{"https://127.0.0.1:8765/","http://127.0.0.1:8766/","http://127.0.0.1.example:8765/","http://user@127.0.0.1:8765/","http://example.com/","file:///C:/test.html","javascript:alert(1)","not a URL",null})Check(!NativeTransport.IsOrigin(address,origin),"Accepted foreign origin: "+address);
  }
  private static async Task<string> ServeOne(TcpListener listener,string response) {
   try {
    using(var connection=await listener.AcceptTcpClientAsync())using(var stream=connection.GetStream()) {
     var request=new StringBuilder();byte[] buffer=new byte[1024];
     while(request.ToString().IndexOf("\r\n\r\n",StringComparison.Ordinal)<0) {
      int count=await stream.ReadAsync(buffer,0,buffer.Length);if(count==0)break;
      request.Append(Encoding.ASCII.GetString(buffer,0,count));if(request.Length>32768)throw new InvalidOperationException("Unexpected request size");
     }
     byte[] reply=Encoding.ASCII.GetBytes(response);await stream.WriteAsync(reply,0,reply.Length);return request.ToString();
    }
   }catch(SocketException){return null;}catch(ObjectDisposedException){return null;}
  }
  private static async Task CredentialsDoNotFollowRedirects() {
   var source=new TcpListener(IPAddress.Loopback,0);var target=new TcpListener(IPAddress.Loopback,0);
   Task<string> sourceRequest=null,targetRequest=null;
   try {
    source.Start();target.Start();
    string sourceUrl="http://127.0.0.1:"+((IPEndPoint)source.LocalEndpoint).Port+"/api/session";
    string targetUrl="http://127.0.0.1:"+((IPEndPoint)target.LocalEndpoint).Port+"/capture";
    sourceRequest=ServeOne(source,"HTTP/1.1 302 Found\r\nLocation: "+targetUrl+"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    targetRequest=ServeOne(target,"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}");
    using(var client=NativeTransport.CreateClient(new string('a',64))) {
     client.Timeout=TimeSpan.FromSeconds(3);client.DefaultRequestHeaders.Add("X-Edit-Token","native-regression-token");
     using(var response=await client.GetAsync(sourceUrl))Check(response.StatusCode==HttpStatusCode.Found,"Native control client followed a redirect");
    }
    string received=await sourceRequest;
    Check(received!=null&&received.IndexOf("X-Desktop-Key:",StringComparison.OrdinalIgnoreCase)>=0,"The initial local request lacked its desktop credential");
    Check(received.IndexOf("X-Edit-Token:",StringComparison.OrdinalIgnoreCase)>=0,"The initial local request lacked its edit token");
    await Task.Delay(100);Check(!targetRequest.IsCompleted,"Credentials were sent to the redirect destination");
   }finally {
    source.Stop();target.Stop();
    if(sourceRequest!=null)sourceRequest.GetAwaiter().GetResult();
    if(targetRequest!=null)targetRequest.GetAwaiter().GetResult();
   }
  }
 }
}
