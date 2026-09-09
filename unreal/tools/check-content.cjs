const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../WildDrift/Content/PortData');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const catalog=read('catalog.json');
function nodes(root){return [root,...root.children.flatMap(nodes)];}
assert.equal(catalog.vehicles.length,24);assert.equal(catalog.drivers.length,8);
for(let i=1;i<=4;i++)assert(fs.statSync(path.join(root,'icons',i+'.png')).size>1000);
for(const m of catalog.materials)if(m.detail){const t=catalog.textures[m.detail];assert(t&&t.width===512&&t.height===512&&fs.existsSync(path.join(root,t.file)));}

for(const vehicle of catalog.vehicles){
 const parts=nodes(read(vehicle.file)),names=parts.map(p=>p.name);
 assert(!names.some(n=>/^(cape|tail|flame|item-boost|item-shield)$/.test(n)),vehicle.file);
 assert.equal(names.filter(n=>n.startsWith('eye-')).length,vehicle.hero===6?1:2);
 assert.equal(names.filter(n=>n.startsWith('wheel-')).length,vehicle.hero===6||vehicle.skin===2?6:4);
 assert(names.filter(n=>n==='arched-fender').length===(vehicle.hero===6||vehicle.skin===2?6:4));
 assert(parts.filter(p=>p.geometry&&catalog.materials[p.material].detail).length>5,'PBR material coverage');
 assert(names.includes('racing-suit')&&names.includes('steeringPivot')&&names.includes('cockpit-details'));
 const outlets=parts.filter(p=>p.name.startsWith('exhaust-flame-'));
 assert(outlets.length>=2&&outlets.every(p=>!p.visible&&p.position[0]<-180));
 assert(vehicle.collision.hull.length>=4&&vehicle.collision.hull.length<=24);
 assert(vehicle.collision.halfWidth>1.2&&vehicle.collision.front>1.7&&vehicle.collision.rear>1.5);
}
const signatures=new Set();
for(const course of catalog.courses){
 const parts=nodes(read(course.file)),names=parts.map(p=>p.name);
 assert(!names.some(n=>['gothic-city','distant-background','background-liquid'].includes(n)));
 assert(!names.includes('edge-bracket')&&names.filter(n=>n==='roadside-hills').length===2);
 assert(course.camber.length===course.points.length&&course.camber.some(n=>n>.05)&&course.camber.some(n=>n<-.05));
 assert.equal(names.filter(n=>n==='finish-marking').length,60);
 assert.equal(names.filter(n=>n==='boost-pad').length,course.pads.length);
 assert.equal(names.filter(n=>n==='boost-chevron').length,course.pads.length*48);
 for(let i=0,d=0;i<course.points.length;i++){const a=course.points[i],b=course.points[(i+1)%course.points.length];const turn=course.turns.find(t=>((d-t.start+course.length)%course.length)<=t.end-t.start);if(Math.abs(course.camber[i])>1e-6)assert(turn&&Math.abs(turn.angle)>Math.PI/6,'Small bend must be flat');if(turn&&!course.gaps.some(g=>d>=g.start&&d<g.end))for(const side of [-1,1])assert(course.fences.some(f=>f.side===side&&d>=f.start-1e-6&&d<=f.end+1e-6),'Unfenced bend');d+=Math.hypot(a.x-b.x,a.z-b.z);}
 signatures.add(course.subtitle);assert(names.includes('theme-scenery'));
}
assert.equal(signatures.size,5);
console.log('Content: 24 cars, 8 fantasy racers, wheel spacing, exhaust sockets, no cloaks/tails/passive hand items, terrain, fences on every bend, banking only above 30 degrees and 5 distinct courses passed.');
// Every marking must sit above the actual rendered road triangles, including banked bends.
const zlib=require('node:zlib');
function vertices(node){const raw=zlib.inflateSync(fs.readFileSync(path.join(root,catalog.geometry[node.geometry].file))),count=raw.readUInt32LE(8),result=[];assert(node.position.every(v=>v===0));for(let i=0;i<count;i++){const at=16+i*48;result.push([raw.readFloatLE(at),raw.readFloatLE(at+4),raw.readFloatLE(at+8)]);}const indices=[];for(let at=16+count*48;at<raw.length;at+=4)indices.push(raw.readUInt32LE(at));return {result,indices};}
for(const course of catalog.courses){
 const parts=nodes(read(course.file)),road=parts.filter(p=>p.name==='track-strip')[1],grid=new Map(),{result:v,indices}=vertices(road),cell=500;
 for(let i=0;i<indices.length;i+=3){const triangle=indices.slice(i,i+3).map(j=>v[j]),xs=triangle.map(p=>p[0]),ys=triangle.map(p=>p[1]);for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++){const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(triangle);}}
 let checked=0;for(const part of parts.filter(p=>['finish-marking','boost-pad','boost-chevron'].includes(p.name)))for(const p of vertices(part).result){let clearance=Infinity;for(const [a,b,c] of grid.get(Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell))||[]){const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den,w=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den;if(u<-.0001||w<-.0001||u+w>1.0001)continue;const d=p[2]-u*a[2]-w*b[2]-(1-u-w)*c[2];if(Math.abs(d)<Math.abs(clearance))clearance=d;}
  assert(clearance>3&&clearance<22,`${course.id} ${part.name} road clearance ${clearance} cm`);checked++;}
 console.log(`${course.id}: ${checked} road-marking vertices above the rendered road`);
}
// The bonnet and cockpit must clear the tire tread at full steering lock.
for(const vehicle of catalog.vehicles){
 const parts=nodes(read(vehicle.file)),frame=parts.find(p=>p.name==='frame'),wheels=parts.filter(p=>/^(front|rear)-pivot-/.test(p.name));
 const body=nodes(frame).filter(p=>p.geometry).flatMap(p=>vertices(p).result);
 for(const wheel of wheels)for(const angle of wheel.name.startsWith('front')?[-.38,0,.38]:[0])for(const v of body){
  const x=(v[0]-wheel.position[0])/100,y=(v[1]-wheel.position[1])/100,z=(v[2]-wheel.position[2])/100,along=x*Math.cos(angle)+y*Math.sin(angle),axial=-x*Math.sin(angle)+y*Math.cos(angle),radius=Math.hypot(along,z);
  assert(!(Math.abs(axial)<.225&&radius>.32&&radius<.52),`${vehicle.file}: coachwork inside ${wheel.name} tire at ${angle}`);
 }
}
console.log('All 24 coachworks clear the tire tread at both steering locks.');
