// Bundle the game into one movable offline HTML and version browser assets by content.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const scripts=['vendor/three.min.js','race-core.js','track.js','game.js'];
let sourceHtml=read('index.html');
for(const name of ['style.css',...scripts]){
 const hash=createHash('sha256').update(read(name)).digest('hex').slice(0,10);
 sourceHtml=sourceHtml.replace(new RegExp('"'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\?v=[^" ]+)?"','g'),'"'+name+'?v='+hash+'"');
}
fs.writeFileSync(path.join(__dirname,'index.html'),sourceHtml);
const image='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'assets/fantasy-art.png')).toString('base64');
let html=sourceHtml.replace(/<link rel="stylesheet" href="style\.css\?v=[^"]+">/,()=>'<style>'+read('style.css')+'</style>');
html=html.replace('href="assets/favicon.svg"','href="data:image/svg+xml,'+encodeURIComponent(read('assets/favicon.svg'))+'"');
for(const name of scripts){
 let source=read(name);if(name==='game.js')source=source.replace('assets/fantasy-art.png',image);
 html=html.replace(new RegExp('<script src="'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?v=[^"]+"></script>'),()=>'<script>'+source.replace(/<\/script/gi,'<\\/script')+'</script>');
}
assert(!html.includes('<script src=')&&!html.includes('href="style.css'));
const output=path.join(__dirname,'Дикий дрифт.html');fs.writeFileSync(output,html);console.log('Built:',output);
