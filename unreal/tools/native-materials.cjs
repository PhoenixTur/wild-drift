// Deterministic tiled PBR surfaces: color, tangent-space pores/scratches, and roughness.
module.exports=function(T,createCanvas,out){
 const maps={},cache=new Map();
 for(const kind of ['paint','steel','leather','skin','rubber','stone']){
  const n=512,canvas=createCanvas(n,n),ctx=canvas.getContext('2d'),detail=createCanvas(n,n),dc=detail.getContext('2d'),c=ctx.createImageData(n,n),d=dc.createImageData(n,n),heights=new Float32Array(n*n);let seed=1971;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)heights[y*n+x]=rand()*.35+(kind==='leather'?Math.sin(x*1.8)*Math.sin(y*1.8)*.15:kind==='steel'?Math.sin(y*2.7)*.14:0);
  const rough={paint:.33,steel:.42,leather:.78,skin:.65,rubber:.89,stone:.91}[kind],strength={paint:.08,steel:.16,leather:.48,skin:.22,rubber:.2,stone:.65}[kind];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,h=heights[i],dx=(heights[y*n+(x+1)%n]-heights[y*n+(x+n-1)%n])*strength,dy=(heights[((y+1)%n)*n+x]-heights[((y+n-1)%n)*n+x])*strength,len=Math.hypot(dx,dy,1),shade=kind==='skin'?227+h*46:kind==='steel'?205+h*85:222+h*65;
   c.data.set([shade,shade-(kind==='skin'?h*9:0),shade-(kind==='skin'?h*14:0),255],i*4);d.data.set([(dx/len*.5+.5)*255,(dy/len*.5+.5)*255,(1/len*.5+.5)*255,(rough+(h-.18)*.14)*255],i*4);
  }
  ctx.putImageData(c,0,0);dc.putImageData(d,0,0);
  if(kind==='paint'||kind==='steel'){ctx.strokeStyle='rgba(75,72,67,.2)';ctx.lineWidth=.5;for(let i=0;i<180;i++){const x=rand()*n,y=rand()*n;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*18,y+rand()*2);ctx.stroke();}}
  const tex=image=>{const t=new T.CanvasTexture(image);t.wrapS=t.wrapT=T.RepeatWrapping;return t;};maps[kind]={color:tex(canvas),detail:tex(detail)};
 }
 function surface(color,kind='paint'){
  const key=color+kind;if(cache.has(key))return cache.get(key);
  const m=new T.MeshStandardMaterial({color,map:maps[kind].color,metalness:kind==='steel'?.82:kind==='paint'?.45:0,roughness:.6});m.userData.detailMap=maps[kind].detail;cache.set(key,m);return m;
 }
 // Compact, transparent item portraits match the sphere, grenade, flame and rune shield.
 const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(path.join(out,'icons'),{recursive:true});
 for(let i=1;i<=4;i++){
  const c=createCanvas(256,256),g=c.getContext('2d');g.lineJoin='round';
  const sphere=(x,y,r,colors)=>{const gr=g.createRadialGradient(x-r*.3,y-r*.4,r*.05,x,y,r);colors.forEach((v,j)=>gr.addColorStop(j/(colors.length-1),v));g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
  if(i===1){sphere(128,133,77,['#e7faff','#7fd7e7','#416885','#162c41']);g.strokeStyle='#c2a778';g.lineWidth=9;g.beginPath();g.ellipse(128,133,85,25,-.65,0,Math.PI*2);g.stroke();g.lineWidth=4;g.beginPath();g.ellipse(128,133,81,31,.72,0,Math.PI*2);g.stroke();}
  if(i===2){g.strokeStyle='#b29871';g.lineWidth=10;g.beginPath();g.moveTo(132,71);g.bezierCurveTo(120,30,185,70,161,28);g.stroke();sphere(160,25,13,['#fff6b9','#e86225','#913329']);sphere(128,145,71,['#a49b8f','#4c4e54','#171c26']);g.strokeStyle='#a78554';g.lineWidth=8;g.beginPath();g.ellipse(128,145,72,26,-.6,0,Math.PI*2);g.stroke();g.fillStyle='#bc9860';g.fillRect(111,66,34,17);}
  if(i===3){const gr=g.createLinearGradient(0,30,0,225);gr.addColorStop(0,'#e8954f');gr.addColorStop(.55,'#ffb569');gr.addColorStop(1,'#5298c7');g.fillStyle=gr;g.beginPath();g.moveTo(128,18);g.bezierCurveTo(182,81,115,76,188,124);g.bezierCurveTo(230,203,126,249,81,205);g.bezierCurveTo(16,156,99,100,89,66);g.bezierCurveTo(110,93,119,109,128,18);g.fill();sphere(128,172,29,['#f4fffa','#baf2e9','#69b6bb']);}
  if(i===4){g.fillStyle='#758586';g.strokeStyle='#c6a972';g.lineWidth=9;g.beginPath();g.moveTo(128,27);g.lineTo(206,57);g.lineTo(194,156);g.quadraticCurveTo(180,198,128,228);g.quadraticCurveTo(76,198,62,156);g.lineTo(50,57);g.closePath();g.fill();g.stroke();g.fillStyle='#2e4948';g.beginPath();g.moveTo(128,45);g.lineTo(186,67);g.lineTo(177,147);g.lineTo(128,205);g.lineTo(79,147);g.lineTo(70,67);g.closePath();g.fill();g.strokeStyle='#9bddbf';g.lineWidth=7;g.beginPath();g.moveTo(128,72);g.lineTo(128,171);g.moveTo(103,98);g.lineTo(128,78);g.lineTo(153,98);g.moveTo(101,137);g.lineTo(128,157);g.lineTo(155,137);g.stroke();}
  fs.writeFileSync(path.join(out,'icons',i+'.png'),c.toBuffer('image/png'));
 }
 return surface;
};
