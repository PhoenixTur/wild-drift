/* Five hand-shaped routes; crossing decks are separated in world space. */
(function(root){
const T=root.THREE,C=root.RaceCore;
const courses=[
 {id:'ash',name:'Врата пепла',subtitle:'Восьмёрка крепости · высокий каменный виадук',sigil:'Ⅰ',sky:0x263039,fog:0x56686e,road:0x50595d,stone:0x3e484d,accent:0xe7a455,liquid:0x1c2d35,light:0xdce5df,
 points:[[0,12,240],[80,12,240],[160,12,240],[235,12,240],[300,24,170],[285,36,85],[190,50,20],[0,60,0],[-170,60,-30],[-275,45,-105],[-280,22,-220],[-245,12,-280],[-190,12,-280],[-100,12,-280],[-25,12,-230],[0,12,-130],[0,12,0],[0,12,105],[-110,12,155],[-190,12,230],[-90,12,250]],gaps:[[112,240,22],[-175,-280,22]],crossings:[[0,0]]},
 {id:'thorn',name:'Терновый предел',subtitle:'Речная змейка · три связки встречных поворотов',sigil:'Ⅱ',sky:0x172d31,fog:0x385452,road:0x465b57,stone:0x374a46,accent:0x98cdb4,liquid:0x203e3d,light:0xcce9c7,
 points:[[-100,14,250],[0,14,250],[90,14,250],[180,14,250],[265,23,200],[270,38,105],[230,46,20],[115,40,35],[50,26,-30],[125,18,-100],[250,18,-130],[300,24,-225],[200,18,-310],[120,18,-310],[35,18,-310],[-55,18,-310],[-200,33,-270],[-270,50,-170],[-220,44,-70],[-110,28,-75],[-70,18,10],[-150,12,85],[-260,18,110],[-290,20,210],[-210,14,260]],gaps:[[35,250,20],[40,-310,20]],crossings:[]},
 {id:'frost',name:'Ледяной собор',subtitle:'Альпийский серпантин · вершина на 125 метрах',sigil:'Ⅲ',sky:0x222b42,fog:0x58677f,road:0x647082,stone:0x586274,accent:0xb6d9ff,liquid:0x243448,light:0xd3e7ff,
 points:[[0,25,300],[90,25,300],[175,25,300],[250,25,300],[320,44,225],[300,70,150],[205,85,110],[110,95,165],[40,108,90],[90,120,0],[200,125,-40],[270,110,-140],[230,85,-260],[150,75,-300],[65,75,-300],[-20,75,-300],[-95,75,-300],[-185,92,-240],[-260,110,-135],[-240,120,-25],[-135,106,0],[-85,80,-80],[-130,60,-150],[-120,38,-220],[-40,25,-165],[-20,25,-40],[-65,25,75],[-170,25,165],[-195,25,260],[-100,25,300]],gaps:[[125,300,24],[0,-300,24]],crossings:[]},
 {id:'forge',name:'Кузня титанов',subtitle:'Узел над лавой · мост и нижний тоннель',sigil:'Ⅳ',sky:0x30272b,fog:0x745950,road:0x574b48,stone:0x3f383a,accent:0xffa15f,liquid:0x612d22,light:0xffd4b0,
 points:[[0,12,260],[90,12,260],[180,12,260],[250,12,260],[325,20,175],[345,30,70],[280,38,-20],[170,44,35],[70,52,0],[0,58,-100],[-100,58,-160],[-210,46,-100],[-235,34,20],[-330,20,45],[-390,12,-70],[-330,12,-230],[-190,12,-290],[-90,12,-290],[0,12,-290],[80,12,-250],[100,12,-160],[0,12,-100],[-100,12,-45],[-95,12,85],[-160,12,180],[-110,12,260]],gaps:[[125,260,22],[-140,-290,22]],crossings:[[0,-100]]},
 {id:'oracle',name:'Затонувший оракул',subtitle:'Приливные руины · скоростные дуги и шпилька',sigil:'Ⅴ',sky:0x17333f,fog:0x517e85,road:0x4a6970,stone:0x3d575e,accent:0x8fe5df,liquid:0x1d525c,light:0xcaefec,
 points:[[0,10,280],[90,10,280],[165,10,280],[240,10,280],[305,12,215],[350,22,100],[305,38,-20],[175,44,-30],[145,42,-145],[210,32,-230],[145,16,-320],[20,10,-350],[-60,10,-350],[-145,10,-350],[-220,10,-350],[-310,18,-285],[-345,32,-140],[-255,24,-45],[-145,12,-10],[-170,10,90],[-290,10,140],[-280,10,240],[-160,10,290]],gaps:[[125,280,22],[-120,-350,20]],crossings:[]}
];
root.RaceTracks=courses.map((course,index)=>{
 const curve=new T.CatmullRomCurve3(course.points.map(p=>new T.Vector3(...p)),true,'catmullrom',.32);curve.arcLengthDivisions=4000;curve.updateArcLengths();
 const points=Array.from({length:1800},(_,i)=>{const p=curve.getPointAt(i/1800);return {x:p.x,y:p.y,z:p.z};}),track=C.makeTrack(points);
 Object.assign(track,{id:course.id,recordKey:course.id+'-v2',name:course.name,meta:course,courseIndex:index});
 for(const [x,z,span] of course.gaps){const d=track.nearest(x,z).d;track.gaps.push({start:d-span/2,end:d+span/2});}
 // Bank the outside of broad bends; the smooth bowl adds gravity, never steering.
 for(let d=220;d<track.length-90;d+=110){const a=track.sample(d-28),b=track.sample(d+28),bend=C.angle(Math.atan2(b.tx,b.tz)-Math.atan2(a.tx,a.tz));if(Math.abs(bend)>.23&&!track.gaps.some(g=>d+65>g.start-30&&d-65<g.end+30))track.banks.push({start:d-62,end:d+62,side:Math.sign(bend)});}
 track.overpasses=course.crossings.map(([x,z])=>{const low=track.nearest(x,z,undefined,12),high=track.nearest(x,z,undefined,60);return {lower:low.d,upper:high.d,clearance:high.y-low.y};});
 track.pads=[...track.gaps.map(g=>g.start-44),track.length*.32,track.length*.82].filter(d=>!track.gapAt(d));track.pickups=Array.from({length:14},(_,i)=>(i+.4)*track.length/14).filter(d=>!track.bridgeAt(d));
 for(const [from,to,sides] of [[.006,.041,[-1,1]],[.2,.28,[-1]],[.38,.45,[1]],[.64,.71,[-1,1]],[.84,.9,[-1]]]){
  let spans=[[track.length*from,track.length*to]];for(const gap of track.gaps)spans=spans.flatMap(([a,b])=>{const lo=gap.start-29,hi=gap.end+29;if(b<lo||a>hi)return [[a,b]];return [[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([l,r])=>r-l>4);});
  for(const [start,end] of spans)for(const side of sides)track.fences.push({start,end,side});
 }
 track.bounds={minX:Math.min(...points.map(p=>p.x))-25,maxX:Math.max(...points.map(p=>p.x))+25,minZ:Math.min(...points.map(p=>p.z))-25,maxZ:Math.max(...points.map(p=>p.z))+25};return track;
});
root.RaceTrack=root.RaceTracks[0];
})(typeof globalThis!=='undefined'?globalThis:this);
