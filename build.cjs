// Bundle the game into one movable, offline HTML file. No dependencies.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const image='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'assets/fantasy-art.png')).toString('base64');
let html=read('index.html').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+read('style.css')+'</style>');
html=html.replace('href="assets/favicon.svg"','href="data:image/svg+xml,'+encodeURIComponent(read('assets/favicon.svg'))+'"');
for(const name of ['vendor/three.min.js','race-core.js','track.js','game.js']){
 let source=read(name);if(name==='game.js')source=source.replace('assets/fantasy-art.png',image);
 html=html.replace(`<script src="${name}"></script>`,()=>'<script>'+source.replace(/<\/script/gi,'<\\/script')+'</script>');
}
assert(!html.includes('<script src=')&&!html.includes('href="style.css"'));
const output=path.join(__dirname,'Дикий дрифт.html');fs.writeFileSync(output,html);console.log('Built:',output);
