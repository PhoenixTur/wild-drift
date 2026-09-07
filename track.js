/* One shared course definition for geometry, physics and checks. Distances are metres. */
(function(root){
const T=root.THREE,C=root.RaceCore;
const curve=new T.CatmullRomCurve3([[0,8,220],[80,8,220],[150,12,220],[220,28,190],[285,50,130],[300,65,40],[275,58,-50],[225,40,-100],[160,25,-115],[150,12,-180],[205,12,-230],[190,15,-280],[90,20,-300],[-20,30,-280],[-100,46,-270],[-200,50,-220],[-270,38,-140],[-280,24,-30],[-250,15,50],[-185,10,90],[-160,7,160],[-100,8,220]].map(p=>new T.Vector3(...p)),true,'catmullrom',.38);
curve.arcLengthDivisions=3000;curve.updateArcLengths();
const points=Array.from({length:1500},(_,i)=>{const p=curve.getPointAt(i/1500);return {x:p.x,y:p.y,z:p.z};});
const track=C.makeTrack(points);
for(const [x,z,span] of [[111,221,22],[30,-291,26]]){const d=track.nearest(x,z).d;track.gaps.push({start:d-span/2,end:d+span/2});}
track.pads=[...track.gaps.map(g=>g.start-44),track.length*.32,track.length*.82];
track.pickups=Array.from({length:12},(_,i)=>(i+.4)*track.length/12).filter(d=>!track.bridgeAt(d));
root.RaceTrack=track;
})(typeof globalThis!=='undefined'?globalThis:this);
