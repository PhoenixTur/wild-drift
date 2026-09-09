// Export the existing authored geometry, including all 24 body variants. No browser or engine is required.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'unreal/WildDrift/Content/PortData');
const canvasPath=process.env.CANVAS_MODULE||path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const {createCanvas}=require(canvasPath),THREE=require(path.join(root,'vendor/three.min.js'));
fs.mkdirSync(path.join(out,'geometry'),{recursive:true});fs.mkdirSync(path.join(out,'textures'),{recursive:true});
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,24);
function element(){return {style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return true;}},addEventListener(){},setAttribute(){},focus(){},blur(){},querySelector:element,getContext:()=>createCanvas(600,300).getContext('2d')};}
class Renderer{constructor(){this.shadowMap={};}setPixelRatio(){}setSize(){}render(s){s.updateMatrixWorld(true);}}
const context={console,THREE:{...THREE,WebGLRenderer:Renderer},innerWidth:1440,innerHeight:900,devicePixelRatio:1,performance:{now:()=>0},requestAnimationFrame(){},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},document:{getElementById:element,querySelector:element,querySelectorAll:()=>[],createElement:tag=>tag==='canvas'?createCanvas(256,256):element(),body:element(),documentElement:element(),addEventListener(){}}};context.window=context;vm.createContext(context);vm.runInContext(read('race-core.js'),context);vm.runInContext(read('track.js'),context);
let source=read('game.js');
function replaceSource(oldText,newText){assert(source.includes(oldText),'Authored source changed: '+oldText.slice(0,65));source=source.replace(oldText,newText);}
replaceSource("[-1.27,-.35,1.04]","[-1.6,0,1.6]");
replaceSource("tube([[side*.6,.75,-.65],[side*.78,.68,-1.05],[side*.78,.92,-1.54]],.085,steel,frame);mesh(new THREE.TorusGeometry(.09,.02,5,12),gold,side*.78,.94,-1.54,frame).rotation.x=Math.PI/2;","");
replaceSource("const stack=mesh(new THREE.CylinderGeometry(.14,.14,1.02,20),steel,side*.72,1.39,-1.1,frame);mesh(new THREE.TorusGeometry(.15,.035,8,24),gold,side*.72,1.93,-1.1,frame).rotation.x=Math.PI/2;","");
replaceSource("liquid.rotation.x=-Math.PI/2;ambience.liquid=liquid;","liquid.name='background-liquid';liquid.rotation.x=-Math.PI/2;ambience.liquid=liquid;");
replaceSource("ellipsoid(Math.cos(a)*490,-20,Math.sin(a)*490,70,80+rand()*65,70,theme.stone);","ellipsoid(Math.cos(a)*490,-20,Math.sin(a)*490,70,80+rand()*65,70,theme.stone).name='distant-background';");
replaceSource("for(const gap of track.gaps)for(const d", "moon.name='distant-background';for(const gap of track.gaps)for(const d");
replaceSource("(19+rand()*7)","(12.8+rand()*.6)");
replaceSource("15.2:-15.2","12.9:-12.9");replaceSource("15.8:-15.8","12.8:-12.8");
replaceSource("mesh(new THREE.CylinderGeometry(1.25,2,p.y+64,12),masonry,0,-(p.y+64)/2-.3,0,g,true);","");
replaceSource("(track.width+radius+1)**2","(9.45+radius+.1)**2");
replaceSource("clearOfRoad(s.x,s.z,4,s.y-5,s.y+30)","clearOfRoad(s.x,s.z,1.9,s.y-5,s.y+30)");
replaceSource("ellipsoid(s.p.x,s.p.y-2,s.p.z,4,2.6,4,theme.stone);","");
replaceSource("i%2?12.4:-12.4","i%2?11.05:-11.05");
// Native road markings are tessellated against the same banked surface as the road.
for(const prefix of [" for(let j=0;j<20;j++)for(let k=0;k<3;k++)box", " for(const d of track.pads){"]){const line=source.split('\n').find(l=>l.startsWith(prefix));assert(line);replaceSource(line,'');}
replaceSource('g.start-22,g.start,g.end,g.end+24','g.start-36,g.start,g.end,g.end+42');
const end=source.lastIndexOf('})();');source=source.slice(0,end)+'globalThis.port={kart,disposeGroup,buildWorld,placeKarts,updateAtmosphere,mesh,ellipsoid,softBox,tube,strut,mat,bakeStatic,label,sculptedShell,get state(){return state;},get world(){return world;},get ambience(){return ambience;}};\n'+source.slice(end);vm.runInContext(source,context);
const surface=require('./native-materials.cjs')(THREE,createCanvas,out);
const art=require('./native-art.cjs')(THREE,context.port,context.RaceCore,surface);context.RaceTracks.forEach(art.bankTrack);
const geometry={},textures={},materials=[],materialKeys=new Map();
function texture(t){if(!t?.image?.toBuffer)return null;const png=t.image.toBuffer('image/png'),id=hash(png);if(!textures[id]){fs.writeFileSync(path.join(out,'textures',id+'.png'),png);textures[id]={file:'textures/'+id+'.png',width:t.image.width,height:t.image.height};}return id;}
function material(m){const data={color:m.color?.toArray()||[1,1,1],emissive:m.emissive?.toArray()||[0,0,0],emissiveIntensity:m.emissiveIntensity||0,metalness:m.metalness||0,roughness:m.roughness??.7,opacity:m.opacity??1,transparent:!!m.transparent,twoSided:m.side===THREE.DoubleSide,unlit:!!m.isMeshBasicMaterial,texture:texture(m.map),detail:texture(m.userData.detailMap),repeat:m.map?.repeat?.toArray()||[1,1],vertexColors:!!m.vertexColors};const key=JSON.stringify(data);if(!materialKeys.has(key)){materialKeys.set(key,materials.length);materials.push(data);}return materialKeys.get(key);}
function geo(g){const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,c=g.attributes.color,indices=g.index?.array||Uint32Array.from({length:p.count},(_,i)=>i);const raw=Buffer.alloc(16+p.count*48+indices.length*4);raw.write('WDGE');raw.writeUInt32LE(1,4);raw.writeUInt32LE(p.count,8);raw.writeUInt32LE(indices.length,12);let cursor=16;
 for(let i=0;i<p.count;i++){const values=[p.getZ(i)*100,-p.getX(i)*100,p.getY(i)*100,n?.getZ(i)||0,-(n?.getX(i)||0),n?.getY(i)||0,uv?.getX(i)||0,uv?.getY(i)||0,c?.getX(i)??1,c?.getY(i)??1,c?.getZ(i)??1,1];for(const v of values){assert(Number.isFinite(v));raw.writeFloatLE(v,cursor);cursor+=4;}}
 for(let i=0;i<indices.length;i+=3)for(const j of [0,1,2]){assert(indices[i+j]<p.count);raw.writeUInt32LE(indices[i+j],cursor);cursor+=4;}
 const id=hash(raw);if(!geometry[id]){fs.writeFileSync(path.join(out,'geometry',id+'.wdmesh'),zlib.deflateSync(raw,{level:9}));geometry[id]={file:'geometry/'+id+'.wdmesh',bytes:raw.length,vertices:p.count,indices:indices.length};}return id;
}
const pos=v=>[v.z*100,-v.x*100,v.y*100];
function node(o){if(o.isPoints||o.isLight||o.isCamera)return null;const q=o.quaternion,result={name:o.name||'',position:pos(o.position),rotation:[-q.z,q.x,-q.y,q.w],scale:[o.scale.z,o.scale.x,o.scale.y],visible:o.visible,children:[]};
 if(o.isMesh){result.geometry=geo(o.geometry);result.material=material(o.material);result.shadow=o.castShadow;}if(o.isSprite){result.sprite=true;result.material=material(o.material);result.scale=[o.scale.x*100,o.scale.y*100,1];}
 for(const child of o.children){const data=node(child);if(data)result.children.push(data);}return result;
}
function nameKart(k){for(const key of ['body','frame','head','cape','tail','steeringPivot','shield','flame','held','respawnRing'])if(k[key]?.parent)k[key].name=key;k.ws.forEach((o,i)=>{o.name='wheel-'+i;o.parent.name=o.parent.userData.front?'front-pivot-'+i:'rear-pivot-'+i;});k.eyes.forEach((o,i)=>o.name='eye-'+i);k.arms.forEach((a,i)=>{a.hand.name='hand-'+i;a.upper.name='upper-arm-'+i;a.lower.name='lower-arm-'+i;});for(const [type,o]of Object.entries(k.items))o.name='item-'+type;}
const vehicles=[];for(let hero=0;hero<8;hero++)for(let skin=0;skin<3;skin++){const k=art.reviseKart(context.port.kart(hero,skin),hero,skin);nameKart(k);k.g.updateMatrixWorld(true);const name=`hero-${hero}-skin-${skin}.json`;fs.writeFileSync(path.join(out,name),JSON.stringify(node(k.g)));vehicles.push({hero,skin,file:name,collision:k.collision});context.port.disposeGroup(k.g);console.log('Exported',name);}
const courses=[];for(let i=0;i<5;i++){context.port.buildWorld(i);const t=context.RaceTracks[i],file=`world-${t.id}.json`;art.reviseWorld(context.port.world,t,i);fs.writeFileSync(path.join(out,file),JSON.stringify(node(context.port.world)));courses.push({id:t.id,name:t.name,subtitle:t.meta.subtitle,length:t.length,width:t.width,fenceLane:t.fenceLane,points:t.segments.map(s=>s.a),gaps:t.gaps,fences:t.fences,banks:t.banks,camber:t.camber,turns:t.turns,pads:t.pads,pickups:t.pickups,overpasses:t.overpasses,bounds:t.bounds,theme:t.meta,file});console.log('Exported',file);}
fs.copyFileSync(path.join(root,'assets/fantasy-art.png'),path.join(out,'cover.png'));
const data={schema:1,source:crypto.createHash('sha256').update(read('game.js')+read('track.js')+read('race-core.js')+fs.readFileSync(__filename,'utf8')+read('unreal/tools/native-art.cjs')+read('unreal/tools/native-materials.cjs')).digest('hex'),drivers:art.drivers,skins:context.RaceCore.SKINS,courses,vehicles,geometry,textures,materials};fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(data));
// Engine-independent native fixtures use the same baked centreline and jump/fence/bank intervals.
const number=x=>Number.isInteger(Number(x))?String(x):Number(x).toPrecision(15),array=rows=>'{'+rows.map(r=>'{'+r.map(number).join(',')+'}').join(',')+'}';
let header='// Generated by export-content.cjs; do not edit.\n#pragma once\n#include "RaceCore.h"\nnamespace drift { inline std::vector<Track> authoredTracks(){std::vector<Track> out;\n';
for(const t of courses){header+='out.emplace_back();{auto& t=out.back();t.id="'+t.id+'";t.points='+array(t.points.map(p=>[p.x,p.y,p.z]))+';t.gaps='+array(t.gaps.map(g=>[g.start,g.end,0]))+';t.fences='+array(t.fences.map(g=>[g.start,g.end,g.side]))+';t.banks='+array(t.banks.map(g=>[g.start,g.end,g.side]))+';t.camber={'+t.camber.map(number).join(',')+'};t.pads={'+t.pads.map(number).join(',')+'};t.pickups={'+t.pickups.map(number).join(',')+'};t.build();}\n';}header+='return out;} inline Shape authoredShape(int hero,int skin){static const Shape shapes[8][3]={'+Array.from({length:8},(_,hero)=>'{'+vehicles.filter(v=>v.hero===hero).map(v=>'{'+[v.collision.halfWidth,v.collision.front,v.collision.rear].map(number).join(',')+','+array(v.collision.hull.map(p=>[p.x,0,p.z]))+'}').join(',')+'}').join(',')+'};return shapes[hero][skin];} }\n';fs.writeFileSync(path.join(root,'unreal/WildDrift/Source/WildDrift/AuthoredTracks.h'),header);
for(const file of fs.readdirSync(path.join(out,'geometry')))if(/^[a-f0-9]{24}\.wdmesh$/.test(file)&&!geometry[file.slice(0,24)])fs.unlinkSync(path.join(out,'geometry',file));
console.log(`Exported ${vehicles.length} vehicles, ${courses.length} worlds, ${Object.keys(geometry).length} shared meshes, ${Object.keys(textures).length} textures.`);
