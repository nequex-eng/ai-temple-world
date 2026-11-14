import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root=path.resolve("dist");
const headerText=await readFile(path.join(root,"_headers"),"utf8");
const globalBlock=headerText.split(/\n\s*\n/,1)[0];
const responseHeaders={};
for(const line of globalBlock.split("\n").slice(1)){
  const match=line.trim().match(/^([^:]+):\s*(.*)$/);
  if(match)responseHeaders[match[1].trim()]=match[2].trim();
}
const mime={
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".ico":"image/x-icon",
  ".woff2":"font/woff2"
};
const server=http.createServer(async(req,res)=>{
  try{
    const rawPath=new URL(req.url||"/","http://localhost").pathname;
    const decoded=decodeURIComponent(rawPath);
    let filePath=path.resolve(root,"."+decoded);
    if(!filePath.startsWith(root+path.sep)&&filePath!==root){
      res.writeHead(403);res.end("Forbidden");return;
    }
    if(decoded==="/"||decoded.endsWith("/"))filePath=path.join(filePath,"index.html");
    try{
      const info=await stat(filePath);
      if(info.isDirectory())filePath=path.join(filePath,"index.html");
    }catch{
      filePath=path.join(root,"index.html");
    }
    const body=await readFile(filePath);
    res.writeHead(200,{
      ...responseHeaders,
      "Content-Type":mime[path.extname(filePath)]||"application/octet-stream",
      "Cache-Control":filePath.endsWith("index.html")?"no-cache":"public, max-age=60"
    });
    res.end(body);
  }catch(error){
    res.writeHead(500,{"Content-Type":"text/plain; charset=utf-8"});
    res.end(String(error));
  }
});
const port=Number(process.env.PORT||4173);
server.listen(port,"0.0.0.0",()=>process.stdout.write("Pages preview listening on "+port+"\n"));
