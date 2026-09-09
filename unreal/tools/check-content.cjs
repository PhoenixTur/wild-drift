const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../WildDrift/Content/PortData');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const catalog=read('catalog.json');
function nodes(root){return [root,...root.children.flatMap(nodes)];}
assert.equal(catalog.vehicles.length,24);assert.equal(catalog.drivers.length,8);
for(const vehicle of catalog.vehicles){
 const parts=nodes(read(vehicle.file)),names=parts.map(p=>p.name);
 assert(!names.some(n=>/^(cape|tail|flame|item-boost|item-shield)$/.test(n)),vehicle.file);
 assert.equal(names.filter(n=>n.startsWith('eye-')).length,vehicle.hero===6?1:2);
 assert.equal(names.filter(n=>n.startsWith('wheel-')).length,vehicle.hero===6||vehicle.skin===2?6:4);
 assert(names.includes('racing-suit')&&names.includes('steeringPivot')&&names.includes('cockpit-details'));
 const outlets=parts.filter(p=>p.name.startsWith('exhaust-flame-'));
 assert(outlets.length>=2&&outlets.every(p=>!p.visible&&p.position[0]<-180));
 assert(vehicle.collision.hull.length>=8&&vehicle.collision.hull.length<=24);
 assert(vehicle.collision.halfWidth>1.2&&vehicle.collision.front>1.7&&vehicle.collision.rear>1.5);
}
const signatures=new Set();
for(const course of catalog.courses){
 const parts=nodes(read(course.file)),names=parts.map(p=>p.name);
 assert(!names.some(n=>['gothic-city','distant-background','background-liquid'].includes(n)));
 assert(names.filter(n=>n==='edge-bracket').length>=names.filter(n=>n.startsWith('statue-')).length);
 assert(course.camber.length===course.points.length&&course.camber.some(n=>n>.05)&&course.camber.some(n=>n<-.05));
 assert.equal(names.filter(n=>n==='finish-marking').length,60);
 assert.equal(names.filter(n=>n==='boost-pad').length,course.pads.length);
 assert.equal(names.filter(n=>n==='boost-chevron').length,course.pads.length*48);
 signatures.add(course.subtitle);assert(names.includes('theme-scenery'));
}
assert.equal(signatures.size,5);
console.log('Content: 24 cars, 8 fantasy racers, wheel spacing, exhaust sockets, no cloaks/tails/passive hand items, attached scenery and 5 distinct courses passed.');
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
