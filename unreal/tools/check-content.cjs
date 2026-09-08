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
 assert(vehicle.collision.halfWidth>1.2&&vehicle.collision.front>1.7&&vehicle.collision.rear>1.5);
}
const signatures=new Set();
for(const course of catalog.courses){
 const parts=nodes(read(course.file)),names=parts.map(p=>p.name);
 assert(!names.some(n=>['gothic-city','distant-background','background-liquid'].includes(n)));
 assert(names.filter(n=>n==='edge-bracket').length>=names.filter(n=>n.startsWith('statue-')).length);
 assert(course.camber.length===course.points.length&&course.camber.some(n=>n>.05)&&course.camber.some(n=>n<-.05));
 signatures.add(course.subtitle);assert(names.includes('theme-scenery'));
}
assert.equal(signatures.size,5);
console.log('Content: 24 cars, 8 fantasy racers, wheel spacing, exhaust sockets, no cloaks/tails/passive hand items, attached scenery and 5 distinct courses passed.');
