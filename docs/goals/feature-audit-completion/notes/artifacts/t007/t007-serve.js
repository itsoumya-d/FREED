const http=require("http"),fs=require("node:fs"),path=require("node:path");
const root=process.argv[2]||"/tmp/t007-web", port=Number(process.argv[3]||41738);
const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".ico":"image/x-icon",".woff2":"font/woff2",".map":"application/json"};
http.createServer((req,res)=>{
  const url=new URL(req.url,"http://x"); let p=path.join(root, decodeURIComponent(url.pathname));
  if(!p.startsWith(root)) {res.writeHead(403);return res.end("403");}
  if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){ p=path.join(root,"index.html"); }
  try{const b=fs.readFileSync(p);res.writeHead(200,{"content-type":types[path.extname(p)]||"application/octet-stream"});res.end(b);}catch(e){res.writeHead(404);res.end("404");}
}).listen(port,()=>console.log("serving "+root+" on "+port));
