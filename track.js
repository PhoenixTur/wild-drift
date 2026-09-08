/* Distinct physical layouts share the same surface and jump rules. */
(function(root){
const T=root.THREE,C=root.RaceCore;
const courses=[
 {id:'ash',name:'Врата пепла',subtitle:'Крепость над огненной бездной',sigil:'Ⅰ',sky:0x263039,fog:0x56686e,road:0x50595d,stone:0x3e484d,accent:0xe7a455,liquid:0x1c2d35,light:0xdce5df,
 points:[[0,8,220],[80,8,220],[150,12,220],[220,28,190],[285,50,130],[300,65,40],[275,58,-50],[225,40,-100],[160,25,-115],[150,12,-180],[205,12,-230],[190,15,-280],[90,20,-300],[-20,30,-280],[-100,46,-270],[-200,50,-220],[-270,38,-140],[-280,24,-30],[-250,15,50],[-185,10,90],[-160,7,160],[-100,8,220]],gaps:[[111,221,22],[30,-291,26]]},
 {id:'thorn',name:'Терновый предел',subtitle:'Затопленный лес и древние руины',sigil:'Ⅱ',sky:0x172d31,fog:0x385452,road:0x465b57,stone:0x374a46,accent:0x98cdb4,liquid:0x203e3d,light:0xcce9c7,
 points:[[0,12,240],[80,12,240],[150,12,240],[225,24,215],[270,44,150],[225,64,90],[290,76,10],[300,64,-95],[220,38,-170],[115,18,-195],[55,12,-255],[-25,12,-280],[-130,20,-260],[-225,35,-195],[-300,55,-120],[-320,66,-25],[-255,52,55],[-160,26,80],[-145,15,175],[-80,12,240]],gaps:[[110,240,20],[-55,-278,22]]},
 {id:'frost',name:'Ледяной собор',subtitle:'Лунные мосты на вершине мира',sigil:'Ⅲ',sky:0x222b42,fog:0x58677f,road:0x647082,stone:0x586274,accent:0xb6d9ff,liquid:0x243448,light:0xd3e7ff,
 points:[[0,22,250],[90,22,250],[175,24,250],[265,46,205],[330,76,115],[325,90,15],[255,80,-55],[270,60,-140],[195,40,-230],[100,25,-280],[0,22,-280],[-100,22,-280],[-205,42,-230],[-280,64,-150],[-295,88,-40],[-250,75,45],[-295,53,135],[-215,30,210],[-110,22,250]],gaps:[[120,251,24],[-42,-280,24]]}
];
root.RaceTracks=courses.map((course,index)=>{
 const curve=new T.CatmullRomCurve3(course.points.map(p=>new T.Vector3(...p)),true,'catmullrom',.38);curve.arcLengthDivisions=3000;curve.updateArcLengths();
 const points=Array.from({length:1500},(_,i)=>{const p=curve.getPointAt(i/1500);return {x:p.x,y:p.y,z:p.z};}),track=C.makeTrack(points);
 Object.assign(track,{id:course.id,name:course.name,meta:course,courseIndex:index});for(const [x,z,span] of course.gaps){const d=track.nearest(x,z).d;track.gaps.push({start:d-span/2,end:d+span/2});}
 track.pads=[...track.gaps.map(g=>g.start-44),track.length*.32,track.length*.82];track.pickups=Array.from({length:12},(_,i)=>(i+.4)*track.length/12).filter(d=>!track.bridgeAt(d));
 track.bounds={minX:Math.min(...points.map(p=>p.x))-25,maxX:Math.max(...points.map(p=>p.x))+25,minZ:Math.min(...points.map(p=>p.z))-25,maxZ:Math.max(...points.map(p=>p.z))+25};return track;
});
root.RaceTrack=root.RaceTracks[0];
})(typeof globalThis!=='undefined'?globalThis:this);
