/* Дикий дрифт — all assets and code run directly from disk. */
(function(){
'use strict';
const $=id=>document.getElementById(id),C=window.RaceCore;
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:$('game'),antialias:true,powerPreference:'high-performance'});}catch(error){$('error').classList.remove('hidden');$('menu').classList.add('hidden');return;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb6dee1);scene.fog=new THREE.Fog(0xc4e1df,220,950);
const camera=new THREE.PerspectiveCamera(57,innerWidth/innerHeight,.15,1200);
scene.add(new THREE.HemisphereLight(0xfff3dc,0x629e98,2.5));
const sun=new THREE.DirectionalLight(0xffe5c9,2.8);sun.position.set(-70,140,45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:320});sun.shadow.bias=-.0008;sun.shadow.normalBias=.08;scene.add(sun);scene.add(sun.target);
const mats={};function mat(color,extra={}){const key=String(color)+JSON.stringify(extra);return mats[key]||(mats[key]=new THREE.MeshStandardMaterial({color,roughness:.78,...extra}));}
function mesh(geo,color,x=0,y=0,z=0,parent=scene,shadow=false){const m=new THREE.Mesh(geo,typeof color==='number'?mat(color):color);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;}
const unitBox=new THREE.BoxGeometry(1,1,1),unitSphere=new THREE.SphereGeometry(1,12,9);
function box(w,h,d,color,x,y,z,parent=scene,shadow=false){const m=mesh(unitBox,color,x,y,z,parent,shadow);m.scale.set(w,h,d);return m;}
function ellipsoid(x,y,z,sx,sy,sz,color,parent=scene,shadow=false){const m=mesh(unitSphere,color,x,y,z,parent,shadow);m.scale.set(sx,sy,sz);return m;}
const roundedGeometries={};
function softBox(w,h,d,color,x,y,z,parent,shadow){const key=[w,h,d].join(',');if(!roundedGeometries[key]){const r=Math.min(.14,h/3),shape=new THREE.Shape();shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const geo=new THREE.ExtrudeGeometry(shape,{depth:d-.16,bevelEnabled:true,bevelThickness:.08,bevelSize:.06,bevelSegments:2,steps:1,curveSegments:4});geo.translate(0,0,-d/2+.08);roundedGeometries[key]=geo;}return mesh(roundedGeometries[key],color,x,y,z,parent,shadow);}
const track=window.RaceTrack,length=track.length,up=new THREE.Vector3(0,1,0);
function sample(d,lane=0){const s=track.sample(d,lane);return {p:new THREE.Vector3(s.x,s.y,s.z),t:new THREE.Vector3(s.tx,s.slope,s.tz).normalize(),right:new THREE.Vector3(-s.tz,0,s.tx),...s};}
const distances=[...Array.from({length:1501},(_,i)=>i/1500*length),...track.gaps.flatMap(g=>[g.start-22,g.start,g.end,g.end+24])].sort((a,b)=>a-b);
const samples=distances.map(d=>sample(d)),N=samples.length-1;
function strip(lo,hi,lift,colors,land=false){const verts=[],cols=[];for(let i=0;i<N;i++){const a=samples[i],b=samples[i+1],mid=(distances[i]+distances[i+1])/2;if(track.gapAt(mid)||(land&&track.bridgeAt(mid)))continue;const color=new THREE.Color(colors[Math.floor(distances[i]/4)%colors.length]);const points=[[a,lo],[b,lo],[a,hi],[a,hi],[b,lo],[b,hi]];for(const [s,w] of points){verts.push(s.p.x+s.right.x*w,s.p.y+lift,s.p.z+s.right.z*w);cols.push(color.r,color.g,color.b);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,side:THREE.DoubleSide}));m.receiveShadow=true;m.name='track-strip';scene.add(m);return m;}
const water=mesh(new THREE.PlaneGeometry(2800,2800,1,1),mat(0x36b7c4,{roughness:.3,metalness:.25}),0,-3,0);water.rotation.x=-Math.PI/2;
strip(-11.25,11.25,-.12,[0xd7cdad],true);strip(-10.6,10.6,-.055,[0x93bd87],true);strip(-9.45,9.45,0,[0x667c81,0x677d82,0x657a80]);strip(-9.95,-9.35,.025,[0xfff1d8,0xf18368]);strip(9.35,9.95,.025,[0xfff1d8,0xf18368]);strip(-.065,.065,.018,[0xb9c8bf,0x677c81,0x677c81,0x677c81]);
// Sandstone ledges taper down to the water; drawbridge openings have no hidden floor.
for(const side of [-1,1]){const verts=[],colors=[];for(let i=0;i<N;i++){const mid=(distances[i]+distances[i+1])/2;if(track.bridgeAt(mid))continue;const a=samples[i],b=samples[i+1],shade=new THREE.Color(i%13<6?0xddb49b:0xe9c4a3);const top=s=>[s.p.x+s.right.x*side*11.25,s.p.y-.12,s.p.z+s.right.z*side*11.25],bottom=s=>[s.p.x+s.right.x*side*16,-3,s.p.z+s.right.z*side*16];for(const p of [top(a),bottom(a),top(b),top(b),bottom(a),bottom(b)]){verts.push(...p);colors.push(shade.r,shade.g,shade.b);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}));}
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}const random=rng(4825);
function palm(x,y,z,size=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(size);scene.add(g);const trunk=mesh(new THREE.CylinderGeometry(.28,.55,7,8),0xc39a75,.4,3.5,0,g,true);trunk.rotation.z=-.12;for(let j=0;j<7;j++){const leaf=ellipsoid(0,6.8,0,3.4,.22,.72,j%2?0x54a58b:0x83c397,g);const a=j/7*Math.PI*2;leaf.position.x=Math.cos(a)*1.65;leaf.position.z=Math.sin(a)*1.65;leaf.rotation.y=-a;leaf.rotation.z=Math.cos(a)*-.14;}ellipsoid(.75,6.4,0,.5,.55,.5,0xab7d4d,g);}
for(let i=0;i<54;i++){const d=i/54*length;if(track.bridgeAt(d))continue;const side=i%2?1:-1,s=sample(d,side*12.8);ellipsoid(s.p.x,s.p.y-1.8,s.p.z,5,2.1,5,0xaccb96);palm(s.p.x,s.p.y-.1,s.p.z,.9+random()*.9);}
for(let i=0;i<17;i++){const a=i*2.39,r=35+random()*65,x=Math.cos(a)*r,z=Math.sin(a)*r;ellipsoid(x,-12,z,30+random()*20,16+random()*21,29+random()*15,0xdab698);ellipsoid(x,2,z,23+random()*11,13+random()*14,20+random()*16,0x86b79d);}
for(let i=0;i<7;i++){const angle=i*1.8;ellipsoid(Math.cos(angle)*540,-20,Math.sin(angle)*540,60+i*4,50,48,0xa7b8a3);ellipsoid(Math.cos(angle)*540,2,Math.sin(angle)*540,45+i*3,34,37,0x87aaa0);}
for(let i=0;i<18;i++){const g=new THREE.Group();g.position.set((random()-.5)*1300,125+random()*60,(random()-.5)*1300);scene.add(g);for(let j=0;j<4;j++)ellipsoid(j*12,random()*3,0,16,6+random()*5,9,0xfff4e4,g);}
ellipsoid(-350,210,-500,32,32,32,new THREE.MeshBasicMaterial({color:0xffe0ad}));
// Low edge reflectors leave the edge physically open.
for(let i=0;i<110;i++){const d=i/110*length;if(track.bridgeAt(d))continue;for(const side of [-1,1]){const s=sample(d,side*10.5);box(.22,.58,.22,0xfff1d6,s.p.x,s.p.y+.25,s.p.z);}}
for(const gap of track.gaps){
 for(const d of [gap.start-25,gap.end+25]){const s=sample(d),g=new THREE.Group();g.position.copy(s.p);g.rotation.y=Math.atan2(s.tx,s.tz);scene.add(g);for(const x of [-10.8,10.8]){box(.7,12,.7,0x4a9894,x,5,0,g,true);box(1.4,.4,1.4,0xffd696,x,11,0,g);}box(23,.35,.7,0xffe7c3,0,11,0,g);if(d<gap.start)box(8,1.7,.22,label('JUMP  '+Math.round(gap.end-gap.start)+'m','#4a9894','#fff1cf'),0,9.7,0,g);}
 for(const d of [gap.start,gap.end]){const s=sample(d),g=new THREE.Group();g.position.copy(s.p);g.rotation.y=Math.atan2(s.tx,s.tz);scene.add(g);box(20,.38,.4,0xffc068,0,-.16,0,g);for(const x of [-10.6,10.6]){box(.18,3,.18,0xfff1d4,x,1.5,0,g);box(1.1,.7,.04,0xf78b6b,x+.4,2.6,0,g);}}
}
function label(text,bg,fg,w=1024,h=256){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.fillStyle=fg;ctx.font=`900 italic ${h*.51}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h*.54);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});}
// Advance turn signs describe the road without steering the kart.
for(let d=190;d<length;d+=95){if(track.bridgeAt(d))continue;const a=sample(d),b=sample(d+32),turn=C.angle(Math.atan2(b.tx,b.tz)-Math.atan2(a.tx,a.tz));if(Math.abs(turn)<.24)continue;const s=sample(d,Math.sign(turn)*12),sign=new THREE.Group();sign.position.copy(s.p);sign.rotation.y=Math.atan2(a.tx,a.tz);scene.add(sign);box(.18,2.3,.18,0xe3d3b6,0,1,0,sign);box(3.5,1.1,.1,label(turn>0?'‹ ‹ ‹':'› › ›','#ffe2ac','#715c46',512,128),0,2.25,0,sign);}
const start=sample(0),arch=new THREE.Group();arch.position.copy(start.p);arch.rotation.y=Math.atan2(start.t.x,start.t.z);scene.add(arch);box(.75,10,.75,0xff7250,-9,4.5,0,arch,true);box(.75,10,.75,0xff7250,9,4.5,0,arch,true);box(20,2.5,1.1,0xff7250,0,9,0,arch,true);box(18,1.6,1.12,label('WILD DRIFT','#ff7250','#fff6db'),0,9,0,arch);
for(let j=0;j<16;j++)for(let k=0;k<3;k++)box(.9,.03,.8,(j+k)%2?0xfff5dd:0x334b50,(j-7.5)*.9,.08,k*.8-1,arch);
const padMeshes=[];for(const d of track.pads){const s=sample(d),g=new THREE.Group();g.position.copy(s.p);g.rotation.set(-Math.atan(s.slope),Math.atan2(s.tx,s.tz),0,'YXZ');scene.add(g);box(9,.045,5,0xe2aa50,0,.09,0,g);for(let k=0;k<3;k++){const a=box(2.2,.03,.32,0xfff6a4,-.75,.125,-1.3+k*1.3,g);a.rotation.y=-.55;const b=box(2.2,.03,.32,0xfff6a4,.75,.125,-1.3+k*1.3,g);b.rotation.y=.55;}padMeshes.push(g);}
// Original toy-like animal karts. Local geometry keeps the race independent of downloads.
const wheels=[];
function kart(type,color){const g=new THREE.Group(),body=new THREE.Group();g.add(body);const paint=mat(color,{roughness:.42});softBox(1.8,.5,2.65,paint,0,.7,0,body,true);ellipsoid(0,.9,.72,.88,.3,.82,paint,body,true);box(1.75,.3,.3,0xffebca,0,.65,1.42,body);softBox(1.8,.16,.58,paint,0,1.12,-1.25,body,true);box(.15,.65,.15,0x244047,-.64,.85,-1.2,body);box(.15,.65,.15,0x244047,.64,.85,-1.2,body);const ws=[];for(const x of [-1.04,1.04])for(const z of [-.88,.86]){const pivot=new THREE.Group();pivot.position.set(x,.48,z);body.add(pivot);const wheel=mesh(new THREE.CylinderGeometry(.46,.46,.4,16),0x293e45,0,0,0,pivot,true);wheel.rotation.z=Math.PI/2;const hub=mesh(new THREE.CylinderGeometry(.24,.24,.42,12),0xece4cd,0,0,0,pivot);hub.rotation.z=Math.PI/2;ws.push(wheel);}
box(.95,.65,.75,0x254047,0,1,-.3,body);const fur=type===0?0xe99b4b:type===1?0x909ea4:0xe8d8d5;
ellipsoid(0,1.45,-.13,.49,.6,.4,fur,body,true);ellipsoid(0,2.1,-.08,.67,.59,.52,fur,body,true);
if(type===0){for(const x of [-.43,.43]){const ear=mesh(new THREE.ConeGeometry(.28,.7,4),0xe99b4b,x,2.72,-.08,body,true);ear.rotation.z=x*.3;mesh(new THREE.ConeGeometry(.16,.37,4),0x644843,x,2.77,.025,body);}ellipsoid(0,1.98,.36,.47,.29,.28,0xffedce,body);const tail=ellipsoid(.22,1.1,-.88,.32,.35,.8,0xe99b4b,body);tail.rotation.x=-.45;ellipsoid(.23,1.35,-1.3,.26,.25,.3,0xffedce,body);
}else if(type===1){for(const x of [-.46,.46]){ellipsoid(x,2.61,-.1,.24,.26,.16,fur,body);ellipsoid(x,2.64,.015,.13,.15,.06,0x38444e,body);}ellipsoid(0,2.12,.38,.57,.22,.14,0x364853,body);ellipsoid(0,1.92,.43,.35,.21,.2,0xdddcc9,body);for(let i=0;i<5;i++)ellipsoid(.2,1.0+i*.04,-.62-i*.19,.27,.22,.19,i%2?0x38444e:fur,body);
}else{for(const x of [-.28,.28]){const ear=ellipsoid(x,2.93,-.14,.2,.64,.16,fur,body);ear.rotation.z=-x*.4;const inner=ellipsoid(x,2.97,.006,.1,.43,.055,0xd79d9b,body);inner.rotation.z=-x*.4;}ellipsoid(0,1.97,.39,.36,.23,.22,0xfff0df,body);ellipsoid(0,1.2,-.74,.3,.3,.3,0xfff0df,body);}
for(const x of [-.23,.23]){ellipsoid(x,2.15,.44,.11,.13,.07,0xfffae6,body);ellipsoid(x,2.14,.502,.06,.085,.04,0x20363f,body);ellipsoid(x-.016,2.17,.53,.02,.026,.015,0xffffff,body);}ellipsoid(0,2.0,.615,.10,.07,.055,0x30434b,body);ellipsoid(.5,1.27,.45,.2,.19,.26,fur,body);const hand=ellipsoid(-.6,1.27,.45,.2,.19,.26,fur,body);
const steering=mesh(new THREE.TorusGeometry(.3,.055,6,16),0x26383f,0,1.3,.64,body);steering.rotation.x=-.5;
const shield=mesh(new THREE.SphereGeometry(1.75,20,14),mat(0x9bf4f3,{transparent:true,opacity:.17,metalness:.2,roughness:.1}),0,1.4,0,g);shield.visible=false;
const flame=ellipsoid(0,.7,-1.72,.35,.32,.9,mat(0xffd471,{emissive:0xff9b31,emissiveIntensity:2}),g);flame.visible=false;
const held=new THREE.Group();body.add(held);const items={};for(const type of Object.keys(C.ITEMS)){const item=new THREE.Group();held.add(item);items[type]=item;item.visible=false;if(type==='coconut'){ellipsoid(0,0,0,.36,.36,.36,0xaf865c,item);const stripe=mesh(new THREE.TorusGeometry(.32,.035,5,12),0xf0d4a0,0,0,0,item);stripe.rotation.x=.7;}else if(type==='bomb'){for(const [x,y,z] of [[0,0,0],[-.2,.1,0],[.2,.1,0],[0,.22,.12]])ellipsoid(x,y,z,.24,.24,.24,0xad84d6,item);mesh(new THREE.ConeGeometry(.12,.25,5),0x94c696,0,.47,0,item);}else if(type==='boost'){const bottle=mesh(new THREE.CylinderGeometry(.18,.23,.58,10),0xffc75f,0,0,0,item);mesh(new THREE.CylinderGeometry(.13,.13,.12,8),0xfff4d7,0,.34,0,item);}else{ellipsoid(0,0,0,.36,.36,.36,mat(0x94e3df,{metalness:.25,roughness:.25}),item);}}
const respawnRing=mesh(new THREE.TorusGeometry(1.65,.06,6,36),mat(0x9ef3df,{emissive:0x77dcca,emissiveIntensity:2}),0,.1,0,g);respawnRing.rotation.x=Math.PI/2;respawnRing.visible=false;
scene.add(g);return {g,body,ws,shield,flame,hand,held,items,respawnRing};}
let selected=0,models=[],modelSelected=-1;function buildKarts(){if(modelSelected===selected)return;modelSelected=selected;for(const k of models)scene.remove(k.g);models=[kart(selected,C.DRIVERS[selected].color),...Array.from({length:5},(_,i)=>kart((i+1)%3,[0x6cbfb4,0xb5a0ec,0xffc660,0x749ed8,0xf296af][i]))];}buildKarts();
const boxMat=label('?','#fff0b3','#b88150',128,128),pickupMeshes=[];for(const d of track.pickups){const row=[];for(const lane of [-5,0,5]){const s=sample(d,lane),m=mesh(new THREE.BoxGeometry(1.5,1.5,1.5),boxMat,s.p.x,s.p.y+1.6,s.p.z);m.name='pickup';row.push(m);}pickupMeshes.push(row);}
const particles=[];for(let i=0;i<60;i++){const m=mesh(new THREE.SphereGeometry(.12,4,3),mat(0xffd46a,{emissive:0xff9d39,emissiveIntensity:1.4}));m.visible=false;particles.push({m,life:0,v:new THREE.Vector3()});}let particleIndex=0;
function spark(pos,right){const p=particles[particleIndex++%particles.length];p.m.position.copy(pos).addScaledVector(right,(Math.random()>.5?1:-1)*1.1);p.m.position.y+=.3;p.v.set((Math.random()-.5)*4,1+Math.random()*2,(Math.random()-.5)*4);p.life=.3+Math.random()*.25;p.m.visible=true;}
const projectileViews=Array.from({length:18},()=>{const g=new THREE.Group();scene.add(g);const coconut=ellipsoid(0,0,0,.5,.5,.5,0xab8359,g,true),bomb=ellipsoid(0,0,0,.6,.6,.6,0xa67ed8,g,true);const band=mesh(new THREE.TorusGeometry(.45,.055,5,12),0xf4d095,0,0,0,g);g.visible=false;return {g,coconut,bomb,band};});
const blastViews=Array.from({length:10},()=>{const m=mesh(new THREE.SphereGeometry(1,14,10),new THREE.MeshBasicMaterial({color:0xffc7aa,transparent:true,opacity:.3,depthWrite:false}));m.visible=false;return m;});
const skidPositions=new Float32Array(1200*3),skidGeometry=new THREE.BufferGeometry();skidGeometry.setAttribute('position',new THREE.BufferAttribute(skidPositions,3));skidGeometry.setDrawRange(0,0);const skidMesh=new THREE.LineSegments(skidGeometry,new THREE.LineBasicMaterial({color:0x344b50,transparent:true,opacity:.32}));skidMesh.frustumCulled=false;scene.add(skidMesh);let skidIndex=0,skidCount=0;
function leaveSkid(r){for(const side of [-1,1]){const x=r.x-Math.cos(r.yaw)*side,z=r.z+Math.sin(r.yaw)*side;for(const point of [[x,r.y+.035,z],[x-r.vx*.035,r.y+.04,z-r.vz*.035]]){const offset=skidIndex*3;skidPositions.set(point,offset);skidIndex=(skidIndex+1)%1200;skidCount=Math.min(1200,skidCount+1);}}skidGeometry.attributes.position.needsUpdate=true;skidGeometry.setDrawRange(0,skidCount);}
function updateEffects(){
 projectileViews.forEach((view,i)=>{const b=state.projectiles[i];view.g.visible=!!b;if(!b)return;view.g.position.set(b.x,b.y,b.z);view.g.rotation.set(elapsed*8,elapsed*3,0);view.coconut.visible=b.type==='coconut';view.band.visible=b.type==='coconut';view.bomb.visible=b.type==='bomb';});
 blastViews.forEach((view,i)=>{const e=state.effects[i];view.visible=!!e;if(!e)return;view.position.set(e.x,e.y,e.z);const t=1-e.life/e.maxLife;view.scale.setScalar((e.type==='blast'?7:2)*t+.3);view.material.opacity=(1-t)*.4;});
}
let simulationDebt=0;let mode='menu',state=C.createRace(track),keys={},countdown=3.5,last=performance.now(),elapsed=0,noticeUntil=0,uiClock=0,previousCount=4;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const menuBestKey='wild-drift-coast-v2';function readBest(){try{const n=Number(localStorage.getItem(menuBestKey));return Number.isFinite(n)&&n>0?n:null;}catch{return null;}}function showBest(){const best=readBest();$('menuBest').textContent=best?'ТВОЙ РЕКОРД  '+C.formatTime(best):'ПОЙМАЙ СВОЙ ПЕРВЫЙ РЕКОРД';}showBest();
$('keyArt').style.backgroundImage='url("assets/racing-art.png")';
let soundOn=false,audio=null,engine=null,engineGain=null;
function initAudio(){if(!audio){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;audio=new AudioContext();engine=audio.createOscillator();engine.type='sawtooth';const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=330;engineGain=audio.createGain();engineGain.gain.value=0;engine.connect(filter);filter.connect(engineGain);engineGain.connect(audio.destination);engine.start();}if(audio.state==='suspended')audio.resume().catch(()=>{});}
function beep(freq=600,duration=.15){if(!soundOn||!audio)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(.12,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}
function showNotice(text){$('notice').textContent=text;noticeUntil=elapsed+2.3;beep(text.includes('КРУГ')?880:580,.13);}
function hideOverlays(){for(const id of ['menu','pause','finish'])$(id).classList.add('hidden');}
function startRace(){initAudio();keys={};state=C.createRace(track,selected);simulationDebt=0;skidIndex=skidCount=0;skidGeometry.setDrawRange(0,0);countdown=3.5;previousCount=4;mode='countdown';noticeUntil=0;$('notice').textContent='';$('countdown').textContent='3';hideOverlays();$('hud').classList.remove('hidden');$('pauseButton').classList.remove('hidden');document.body.classList.add('racing');buildKarts();placeKarts(0);updateCamera(1,true);updateHUD();$('start').blur();}
function pauseRace(){if(mode!=='race'&&mode!=='countdown')return;mode=mode==='race'?'paused':'paused-countdown';keys={};$('pause').classList.remove('hidden');$('resume').focus();}
function resumeRace(){if(mode!=='paused'&&mode!=='paused-countdown')return;mode=mode==='paused'?'race':'countdown';$('pause').classList.add('hidden');keys={};}
function menu(){mode='menu';keys={};hideOverlays();$('menu').classList.remove('hidden');$('hud').classList.add('hidden');$('pauseButton').classList.add('hidden');document.body.classList.remove('racing');showBest();$('start').focus();}
function finishRace(){mode='finish';$('hud').classList.add('hidden');$('pauseButton').classList.add('hidden');$('finish').classList.remove('hidden');$('finishRank').innerHTML=state.rank+'<span>МЕСТО</span>';$('finishTitle').textContent=state.rank===1?'Остров твой!':state.rank<=3?'Красиво залетели!':'Ещё поворот — и реванш!';$('finishTime').textContent=C.formatTime(state.finishTime);$('bestLap').textContent=C.formatTime(Math.min(...state.lapTimes));const best=readBest(),record=!best||state.finishTime<best;$('record').textContent=record?'Новый личный рекорд ✦':'Твой рекорд: '+C.formatTime(best);if(record){try{localStorage.setItem(menuBestKey,String(state.finishTime));}catch{$('record').textContent='Отличный заезд! Сохранение рекорда недоступно.';}}beep(880,.5);$('again').focus();}
for(const id of ['start','restart','again'])$(id).addEventListener('click',startRace);$('resume').addEventListener('click',resumeRace);for(const id of ['back','garage'])$(id).addEventListener('click',menu);$('pauseButton').addEventListener('click',pauseRace);document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();if(mode==='menu')return;pauseRace();});
document.querySelectorAll('[data-driver]').forEach(button=>button.addEventListener('click',()=>{selected=Number(button.dataset.driver);document.querySelectorAll('[data-driver]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});document.querySelector('.selection-number').textContent=`0${selected+1} — 03`;buildKarts();}));
$('sound').addEventListener('click',()=>{soundOn=!soundOn;initAudio();$('sound').querySelector('.slash').classList.toggle('hidden',soundOn);$('sound').setAttribute('aria-label',soundOn?'Выключить звук':'Включить звук');beep();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else showNotice('Используй полноэкранный режим браузера');}catch{showNotice('Используй полноэкранный режим браузера');}});
function activateItem(){if(mode==='race'&&C.useItem(state))beep(700,.2);}$('item').addEventListener('click',activateItem);
const controlCodes=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'];
window.addEventListener('keydown',e=>{if(controlCodes.includes(e.code)&&(mode==='race'||mode==='countdown'))e.preventDefault();keys[e.code]=true;if(e.repeat)return;if(e.code==='Escape'){if(mode.startsWith('paused'))resumeRace();else pauseRace();}if(e.code.startsWith('Shift'))activateItem();if(e.code==='KeyR'&&mode==='race')C.recover(state);});window.addEventListener('keyup',e=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{keys={};pauseRace();});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys={};pauseRace();}});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{keys[b.dataset.key]=false;});});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));});
function getInput(){return {throttle:!!(keys.KeyW||keys.ArrowUp),brake:!!(keys.KeyS||keys.ArrowDown),steer:Number(!!(keys.KeyD||keys.ArrowRight))-Number(!!(keys.KeyA||keys.ArrowLeft)),drift:!!keys.Space};}
function placeKarts(dt){
 for(let i=0;i<models.length;i++){
  const r=state.racers[i],k=models[i];k.g.position.set(r.x,r.y,r.z);
  const pitch=r.grounded?Math.atan(r.surface.slope)*(Math.cos(r.yaw)*r.surface.tz+Math.sin(r.yaw)*r.surface.tx):Math.atan2(r.vy,Math.max(r.speed,1));
  k.g.rotation.set(-pitch,r.yaw,0,'YXZ');
  k.body.rotation.z=THREE.MathUtils.damp(k.body.rotation.z,r.steering*(r.drifting?.1:.055),10,dt);
  k.body.rotation.y=r.hitAnim>0?Math.sin(r.hitAnim*19)*.45:0;
  k.body.position.y=(r.speed>1&&r.grounded?Math.sin(elapsed*20+i)*.018:0)-(r.landing>0?Math.sin(r.landing/.4*Math.PI)*.16:0);
  k.g.visible=true;k.g.scale.setScalar(1);k.respawnRing.visible=false;
  if(r.phase==='falling'){k.body.rotation.z+=Math.sin(elapsed*4)*.2;k.g.scale.setScalar(Math.max(.3,r.phaseTime/.8));}
  if(r.phase==='respawning'){const t=1-r.phaseTime/1.05;k.g.position.y+=7*(1-t)**3;k.g.scale.setScalar(.7+.3*t);k.g.visible=Math.floor(r.phaseTime*18)%3!==0;k.respawnRing.visible=true;k.respawnRing.scale.setScalar(1.8-.8*t);}
  for(let j=0;j<k.ws.length;j++){const wheel=k.ws[j];wheel.rotation.x+=r.speed*dt*2;if(wheel.parent!==k.body)wheel.parent.rotation.y=j%2===1?-r.steering*.38:0;}
  k.shield.visible=r.shield>0&&r.phase!=='falling';k.flame.visible=r.boost>0&&r.phase==='driving';k.flame.scale.z=.65+Math.sin(elapsed*50)*.15;
  k.hand.position.set(r.item?-.85:-.6,r.item?1.92:1.27,r.item?-.12:.45);k.hand.rotation.z=r.item?-.4:0;
  if(r.throwAnim>0){k.hand.position.y=1.6+Math.sin(r.throwAnim/.4*Math.PI)*.65;k.hand.position.z=.3+Math.sin(r.throwAnim/.4*Math.PI)*.8;}
  k.held.position.copy(k.hand.position);k.held.position.y+=.3;k.held.rotation.y=elapsed*.7;
  for(const [type,object] of Object.entries(k.items))object.visible=r.item===type;
  if(i===0&&r.grounded&&r.drifting&&Math.abs(r.slip)>.13&&Math.random()>.25){spark(new THREE.Vector3(r.x,r.y,r.z),new THREE.Vector3(-Math.cos(r.yaw),0,Math.sin(r.yaw)));leaveSkid(r);}
 }
}
const cameraTarget=new THREE.Vector3();let cameraYaw=0;
function updateCamera(dt,snap=false){
 if(mode==='menu'){const a=reducedMotion?.7:elapsed*.017+.7;camera.position.set(Math.sin(a)*370,185,Math.cos(a)*370);camera.lookAt(0,15,0);return;}
 const p=state.racers[0],travel=p.speed>5?Math.atan2(p.vx,p.vz):p.yaw,targetYaw=p.yaw+C.angle(travel-p.yaw)*.65;
 cameraYaw+=C.angle(targetYaw-cameraYaw)*(snap?1:1-Math.exp(-4.5*dt));const heading=new THREE.Vector3(Math.sin(cameraYaw),0,Math.cos(cameraYaw)),position=new THREE.Vector3(p.x,p.y,p.z);
 if(p.phase==='respawning')position.y+=7*(p.phaseTime/1.05)**3;
 const desired=position.clone().addScaledVector(heading,-12.5-(p.boost>0?1.4:0));desired.y+=6;
 const under=track.nearest(desired.x,desired.z,p.nearD);if(under.ground&&Math.abs(under.lane)<14)desired.y=Math.max(desired.y,under.y+3);
 const factor=snap?1:1-Math.exp(-9*dt);camera.position.lerp(desired,factor);cameraTarget.copy(position).addScaledVector(heading,7);cameraTarget.y+=1.4;camera.lookAt(cameraTarget);
 const fov=58+(p.boost>0&&!reducedMotion?8:0);camera.fov+=(fov-camera.fov)*factor;camera.updateProjectionMatrix();
 sun.position.set(p.x-60,p.y+100,p.z+45);sun.target.position.set(p.x,p.y,p.z);
}
const map=$('minimap').getContext('2d');
function drawMap(){
 map.clearRect(0,0,220,180);const point=s=>[(s.p.x+325)*.31+9,(s.p.z+330)*.285+6];map.lineCap='round';
 for(const [width,color] of [[9,'#183f4866'],[3,'#fff6df']]){map.strokeStyle=color;map.lineWidth=width;map.beginPath();for(let i=0;i<=N;i+=3){const [x,y]=point(samples[i]);if(i===0||track.gapAt(distances[i]))map.moveTo(x,y);else map.lineTo(x,y);}map.stroke();}
 for(const gap of track.gaps){const [x,y]=point(sample((gap.start+gap.end)/2));map.fillStyle='#ffbb71';map.fillRect(x-3,y-3,6,6);}
 for(let i=5;i>=0;i--){const r=state.racers[i],[x,y]=point({p:r});map.beginPath();map.arc(x,y,i===0?5:2.8,0,Math.PI*2);map.fillStyle=i===0?'#ff865e':'#fffae4';map.fill();if(i===0){map.strokeStyle='#fffbe7';map.lineWidth=2;map.stroke();}}
}
function updateHUD(){
 const p=state.racers[0];$('speed').textContent=Math.round(p.speed*3.1);$('position').textContent=state.rank;$('lap').textContent=Math.min(3,Math.floor(Math.max(0,p.d)/length)+1);$('timer').textContent=C.formatTime(state.time);$('speedBar').style.width=Math.min(100,p.speed/65*100)+'%';$('driftBar').style.width=p.drift/2.5*100+'%';$('driftLabel').textContent=p.drift>.55?'ОТПУСТИ ПРОБЕЛ → ТУРБО':p.drifting?'ДЕРЖИ ЗАНОС':'ПРОБЕЛ + ПОВОРОТ';
 const info=C.ITEMS[p.item];$('item').classList.toggle('ready',!!info);$('itemIcon').textContent=info?info.icon:'?';$('itemName').textContent=info?info.name:'ПОЙМАЙ БОНУС';$('item').setAttribute('aria-label',info?'Использовать: '+info.name:'Бонус пока не получен');
 const nextGap=track.gaps.map(g=>({g,delta:C.wrap(g.start-p.nearD,length)})).sort((a,b)=>a.delta-b.delta)[0];
 $('jumpCue').classList.toggle('hidden',!(nextGap.delta<100||!p.grounded)&&p.phase==='driving');
 if(p.phase!=='driving'){$('jumpCue').textContent='↟ ВОЗВРАЩЕНИЕ НА ТРАССУ';}
 else if(!p.grounded){$('jumpCue').textContent='↗ В ПОЛЁТЕ';}
 else{$('jumpCue').textContent='↗ РАЗРЫВ '+Math.round(nextGap.g.end-nextGap.g.start)+' М · ЧЕРЕЗ '+Math.round(nextGap.delta)+' М';}
 $('elevation').textContent=Math.round(p.y)+' м';drawMap();
}
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;if(mode==='menu'||mode.startsWith('paused'))return;const running=mode==='race'||mode==='countdown';if(mode==='countdown'){countdown-=dt;const n=Math.ceil(countdown);if(n!==previousCount&&n>0){previousCount=n;beep(n===1?900:500,.15);}$('countdown').textContent=countdown>0?Math.min(3,Math.ceil(countdown)):'СТАРТ!';if(countdown<=0){mode='race';noticeUntil=elapsed+1.1;$('notice').textContent='W / ↑ — ГАЗ · ПРОБЕЛ — ДРИФТ';}}
if(mode==='race'){simulationDebt+=dt;while(simulationDebt>=1/120&&!state.finished){C.step(state,getInput(),1/120);simulationDebt-=1/120;}if(state.events.length){showNotice(state.events[state.events.length-1]);state.events.length=0;}if(state.time>1)$('countdown').textContent='';if(state.finished)finishRace();}
if(running||mode==='menu'){placeKarts(dt);for(let i=0;i<pickupMeshes.length;i++)for(let j=0;j<3;j++){const m=pickupMeshes[i][j];m.visible=state.pickups[i].cooldown===0;m.rotation.set(.15,elapsed*1.3+j,.12);m.position.y=sample(state.pickups[i].d).p.y+1.6+Math.sin(elapsed*2+j)*.2;}for(const p of particles){if(p.life>0){p.life-=dt;p.m.position.addScaledVector(p.v,dt);p.v.y-=7*dt;p.m.visible=p.life>0;}}}
updateEffects();if(mode==='menu'||running||mode==='finish')updateCamera(dt);if(elapsed>noticeUntil)$('notice').textContent='';if(engineGain){engineGain.gain.setTargetAtTime(soundOn&&mode==='race'?.026:0,audio.currentTime,.08);engine.frequency.setTargetAtTime(45+state.racers[0].speed*2.2,audio.currentTime,.06);}uiClock+=dt;if(uiClock>.05&&running){updateHUD();uiClock=0;}renderer.render(scene,camera);}
placeKarts(0);updateCamera(1);renderer.render(scene,camera);requestAnimationFrame(animate);
})();
