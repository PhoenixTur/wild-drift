/* Independent world-space driving. Track coordinates measure progress, never steer the player. */
(function(root){
'use strict';
const DRIVERS=[{name:'Фокси',color:0xff7855,speed:46,handling:1.08,boost:1},{name:'Рокки',color:0x43cbbd,speed:45,handling:1,boost:1.25},{name:'Бонни',color:0xc0a4ef,speed:48,handling:.95,boost:1}];
const ITEMS={boost:{name:'ТУРБО',icon:'ϟ'},shield:{name:'ЩИТ',icon:'◈'},coconut:{name:'КОКОС',icon:'◉'},bomb:{name:'ЯГОДНАЯ БОМБА',icon:'✹'}};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=(x,n)=>((x%n)+n)%n;
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const formatTime=s=>{const cs=Math.floor(Math.max(0,s)*100);return `${String(Math.floor(cs/6000)).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;};
function makeTrack(points,gaps=[]){
 const segments=[];let length=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.0001)continue;segments.push({a,b,d:length,len,tx:dx/len,tz:dz/len});length+=len;}
 const track={length,segments,gaps,width:10.6,pads:[],pickups:[]};
 track.index=d=>{d=wrap(d,length);let lo=0,hi=segments.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(segments[m].d>d)hi=m-1;else lo=m;}return lo;};
 track.gapAt=d=>gaps.find(g=>wrap(d,length)>=g.start&&wrap(d,length)<g.end);
 track.bridgeAt=d=>gaps.find(g=>wrap(d,length)>=g.start-25&&wrap(d,length)<=g.end+25);
 function surface(d,base,slope){let lift=0;d=wrap(d,length);for(const g of gaps){if(d>=g.start-22&&d<g.start){lift=5.8*(d-g.start+22)/22;slope+=5.8/22;}else if(d>=g.start&&d<g.end){lift=5.8;}else if(d>=g.end&&d<g.end+24){lift=5.8*(1-(d-g.end)/24);slope-=5.8/24;}}return {y:base+lift,slope,ground:!track.gapAt(d)};}
 track.sample=(d,lane=0)=>{d=wrap(d,length);const seg=segments[track.index(d)],t=(d-seg.d)/seg.len;return {x:seg.a.x+(seg.b.x-seg.a.x)*t-seg.tz*lane,z:seg.a.z+(seg.b.z-seg.a.z)*t+seg.tx*lane,tx:seg.tx,tz:seg.tz,d,lane,...surface(d,seg.a.y+(seg.b.y-seg.a.y)*t,(seg.b.y-seg.a.y)/seg.len)};};
 track.nearest=(x,z,hint)=>{let best=null,bestDistance=Infinity;const center=Number.isFinite(hint)?track.index(hint):0,span=Number.isFinite(hint)?50:segments.length;
  for(let k=Number.isFinite(hint)?-span:0;k<span;k++){const seg=segments[wrap(center+k,segments.length)],t=clamp(((x-seg.a.x)*seg.tx+(z-seg.a.z)*seg.tz)/seg.len,0,1),px=seg.a.x+seg.tx*t*seg.len,pz=seg.a.z+seg.tz*t*seg.len,dist=(x-px)**2+(z-pz)**2;if(dist<bestDistance){bestDistance=dist;const d=seg.d+t*seg.len;best={...track.sample(d),lane:(x-px)*-seg.tz+(z-pz)*seg.tx,distance:Math.sqrt(dist)};}}
  return best;
 };
 return track;
}
function createRace(track,driver=0){
 const racers=Array.from({length:6},(_,i)=>{const d=i===0?0:8+(5-i)*5,lane=i===0?-2.5:(i%2?2.5:-2.5),p=track.sample(d,lane);return {id:i,x:p.x,y:p.y,z:p.z,yaw:Math.atan2(p.tx,p.tz),vx:0,vz:0,vy:0,yawRate:0,steering:0,speed:0,d,lane,nearD:p.d,surface:p,lastSafeD:d,checkpoint:1,boost:0,shield:0,stun:0,contact:0,drift:0,slip:0,drifting:false,item:null,itemAge:0,throwAnim:0,hitAnim:0,finishTime:null,phase:'driving',phaseTime:0,grounded:true,airTime:0,jumpOrigin:null,landing:0,falls:0};});
 return {track,length:track.length,driver,time:0,finished:false,finishTime:null,rank:6,lapTimes:[],lastLap:0,events:[],racers,projectiles:[],effects:[],nextProjectile:0,rng:48329,pickups:track.pickups.map(d=>({d,cooldown:0})),padCooldown:0};
}
function random(s){s.rng=(s.rng*1664525+1013904223)>>>0;return s.rng/4294967296;}
function fall(s,r){
 if(r.phase!=='driving')return;
 r.phase='falling';r.phaseTime=.8;r.falls++;r.grounded=false;r.vy=Math.min(r.vy,-3);r.boost=0;r.drift=0;r.drifting=false;r.respawnD=r.jumpOrigin===null?r.lastSafeD:r.jumpOrigin;r.item=null;
 if(r.id===0)s.events.push('ВЫЛЕТ · ВОЗВРАЩАЕМ НА ТРАССУ');
}
function recover(s,r=s.racers[0]){if(r.phase==='driving')fall(s,r);}
function tickRecovery(s,r,dt){
 if(r.phase==='driving')return false;
 r.phaseTime-=dt;
 if(r.phase==='falling'){r.vy-=22*dt;r.y+=r.vy*dt;r.x+=r.vx*dt;r.z+=r.vz*dt;if(r.phaseTime<=0){const p=s.track.sample(r.respawnD);r.d=r.respawnD;r.nearD=p.d;r.surface=p;r.x=p.x;r.z=p.z;r.y=p.y;r.lane=0;r.yaw=Math.atan2(p.tx,p.tz);r.yawRate=0;r.vx=p.tx*2;r.vz=p.tz*2;r.speed=2;r.vy=0;r.phase='respawning';r.phaseTime=1.05;r.shield=2.8;r.jumpOrigin=null;r.stun=0;r.slip=0;r.steering=0;}}
 else if(r.phaseTime<=0){r.phase='driving';r.grounded=true;r.airTime=0;}
 return true;
}
function useItem(s,owner=0){
 const r=s.racers[owner],item=r.item;if(!item||s.finished||r.phase!=='driving')return false;
 r.item=null;r.itemAge=0;r.throwAnim=.4;
 if(item==='boost'){r.boost=3.2*DRIVERS[owner===0?s.driver:owner%3].boost;if(owner===0)s.events.push('ТУРБО!');}
 else if(item==='shield'){r.shield=7;if(owner===0)s.events.push('ЩИТ · 7 СЕКУНД');}
 else{const f={x:Math.sin(r.yaw),z:Math.cos(r.yaw)},speed=r.speed+30;s.projectiles.push({id:s.nextProjectile++,type:item,owner,x:r.x+f.x*2.7,y:r.y+2.3,z:r.z+f.z*2.7,vx:f.x*speed,vz:f.z*speed,vy:item==='bomb'?7:3.5,age:0,life:4,nearD:r.nearD});if(owner===0)s.events.push(item==='bomb'?'ЯГОДНАЯ БОМБА!':'КОКОС ПОШЁЛ!');}
 return true;
}
function hit(s,r,duration){if(r.phase!=='driving')return;if(r.shield>0){if(r.id===0)s.events.push('ЩИТ ОТРАЗИЛ УДАР');return;}r.stun=duration;r.vx*=.42;r.vz*=.42;r.hitAnim=.7;r.drift=0;r.boost=0;if(r.id===0)s.events.push('ПОПАДАНИЕ · СКОРОСТЬ СНИЖЕНА');}
function explode(s,b){s.effects.push({x:b.x,y:b.y,z:b.z,life:.65,maxLife:.65,type:'blast'});for(const r of s.racers)if(r.id!==b.owner&&Math.hypot(r.x-b.x,r.z-b.z,r.y+1-b.y)<8)hit(s,r,3.7);}
function tickProjectiles(s,dt){
 for(const b of s.projectiles){const ox=b.x,oy=b.y,oz=b.z;b.age+=dt;b.life-=dt;b.vy-=14*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;
  for(const r of s.racers){if(r.id===b.owner||r.phase!=='driving')continue;const dx=b.x-ox,dy=b.y-oy,dz=b.z-oz,den=dx*dx+dy*dy+dz*dz,t=clamp(((r.x-ox)*dx+(r.y+1-oy)*dy+(r.z-oz)*dz)/(den||1),0,1);if(Math.hypot(r.x-ox-dx*t,r.y+1-oy-dy*t,r.z-oz-dz*t)<1.9){if(b.type==='bomb')explode(s,b);else{hit(s,r,3);s.effects.push({x:b.x,y:b.y,z:b.z,life:.4,maxLife:.4,type:'hit'});}if(b.owner===0)s.events.push(r.shield>0?'СОПЕРНИК ПОД ЩИТОМ':'ЕСТЬ ПОПАДАНИЕ!');b.life=0;break;}}
  if(b.life<=0)continue;const surface=s.track.nearest(b.x,b.z,b.nearD);b.nearD=surface.d;
  if(surface.ground&&Math.abs(surface.lane)<s.track.width&&b.y<surface.y+.45){if(b.type==='bomb'){explode(s,b);b.life=0;}else{b.y=surface.y+.45;b.vy=Math.max(1.4,-b.vy*.4);b.vx*=.92;b.vz*=.92;}}
  if(b.y< -6)b.life=0;
 }
 s.projectiles=s.projectiles.filter(b=>b.life>0);for(const e of s.effects)e.life-=dt;s.effects=s.effects.filter(e=>e.life>0);
}
function botInput(s,r){
 const look=s.track.sample(r.d+11+r.speed*.38,Math.sin(s.time*.2+r.id)*1.8),error=angle(Math.atan2(look.x-r.x,look.z-r.z)-r.yaw),future=s.track.sample(r.d+28),bend=Math.abs(angle(Math.atan2(future.tx,future.tz)-Math.atan2(r.surface.tx,r.surface.tz))),target=clamp(43-r.id*.45-bend*23,26,42);
 return {throttle:r.speed<target+1,brake:r.speed>target+3,steer:clamp(-error*2.9,-1,1),drift:false};
}
function drive(s,r,input,dt){
 if(tickRecovery(s,r,dt)||r.finishTime!==null)return;
 const cfg=DRIVERS[r.id===0?s.driver:r.id%3],speed=Math.hypot(r.vx,r.vz),wasGrounded=r.grounded,previousSurface=r.surface;
 const wantsDrift=!!input.drift&&speed>15&&r.grounded;
 r.steering+=(clamp(input.steer||0,-1,1)-r.steering)*(1-Math.exp(-13*dt));
 const yawTarget=-r.steering*1.8*cfg.handling*clamp(speed/10,0,1)*(wantsDrift?1.2:1)*(r.grounded?1:.13);
 r.yawRate+=(yawTarget-r.yawRate)*(1-Math.exp(-12*dt));r.yaw=angle(r.yaw+r.yawRate*dt);
 const fx=Math.sin(r.yaw),fz=Math.cos(r.yaw),rx=-fz,rz=fx;
 if(r.grounded){let forward=r.vx*fx+r.vz*fz,lateral=r.vx*rx+r.vz*rz;
  const offroad=Math.abs(r.lane)>9.2,grip=offroad?3.5:wantsDrift?1.65:10;
  const accel=input.brake?-45:input.throttle?25:-5;
  forward=Math.max(0,forward+(accel-previousSurface.slope*10)*dt);lateral*=Math.exp(-grip*dt);
  const max=offroad?24:cfg.speed+(r.boost>0?19:0);if(forward>max)forward=Math.max(max,forward-25*dt);if(r.stun>0)forward=Math.min(forward,17);
  r.vx=fx*forward+rx*lateral;r.vz=fz*forward+rz*lateral;
 }
 r.speed=Math.hypot(r.vx,r.vz);r.slip=r.speed>3?angle(Math.atan2(r.vx,r.vz)-r.yaw):0;
 const drifting=wantsDrift&&Math.abs(r.slip)>.13;
 if(drifting)r.drift=Math.min(2.5,r.drift+dt*Math.min(1.6,Math.abs(r.slip)*2.2));
 if(!input.drift&&r.drifting&&r.grounded){if(r.drift>.55){r.boost=(1.1+r.drift*.5)*cfg.boost;if(r.id===0)s.events.push(r.drift>1.7?'СУПЕРДРИФТ!':'ДРИФТ · ТУРБО!');}r.drift=0;}
 if(!wantsDrift&&!r.drifting)r.drift=0;r.drifting=wantsDrift;
 r.x+=r.vx*dt;r.z+=r.vz*dt;
 const surface=s.track.nearest(r.x,r.z,r.nearD),delta=angle((surface.d-r.nearD)/s.length*Math.PI*2)*s.length/(Math.PI*2);
 r.d+=delta;r.nearD=surface.d;r.surface=surface;r.lane=surface.lane;
 if(Math.abs(r.lane)>s.track.width+.6){fall(s,r);return;}
 if(wasGrounded&&!surface.ground){r.grounded=false;r.vy=Math.max(0,(r.vx*previousSurface.tx+r.vz*previousSurface.tz)*previousSurface.slope);r.airTime=0;const gap=s.track.gapAt(surface.d);r.jumpOrigin=gap?r.d-(surface.d-(gap.start-62)):r.lastSafeD;if(r.id===0)s.events.push('ПОЛЁТ!');}
 if(!r.grounded){r.airTime+=dt;r.vy-=22*dt;r.y+=r.vy*dt;
  if(surface.ground&&r.vy<=0&&r.y<=surface.y+.12&&r.y>=surface.y-1.5){r.y=surface.y;r.vy=0;r.grounded=true;r.landing=.4;r.jumpOrigin=null;if(r.id===0&&r.airTime>.25)s.events.push('ЧИСТОЕ ПРИЗЕМЛЕНИЕ!');r.airTime=0;}
  else if(r.y<surface.y-3.5||r.airTime>3){fall(s,r);return;}
 }else{r.y=surface.y;r.vy=0;r.lastSafeD=r.d;}
 if(r.grounded&&r.d>=r.checkpoint*s.length/12){r.checkpoint++;}
 if(r.d>=s.length*3&&r.checkpoint>=36)r.finishTime=s.time;
}
function step(s,input,dt){
 if(s.finished)return;dt=clamp(dt,0,.05);s.time+=dt;s.padCooldown=Math.max(0,s.padCooldown-dt);
 const p=s.racers[0];
 for(const r of s.racers){for(const key of ['boost','shield','stun','contact','throwAnim','hitAnim','landing'])r[key]=Math.max(0,r[key]-dt);r.itemAge+=dt;drive(s,r,r.id===0?input:botInput(s,r),dt);if(r.id>0&&r.item&&r.itemAge>2.8&&r.phase==='driving')useItem(s,r.id);}
 for(const box of s.pickups){box.cooldown=Math.max(0,box.cooldown-dt);if(box.cooldown>0)continue;for(const r of s.racers){if(r.item||!r.grounded||r.phase!=='driving')continue;const delta=wrap(r.nearD-box.d+s.length/2,s.length)-s.length/2;if(Math.abs(delta)<2.1&&Math.min(...[-5,0,5].map(l=>Math.abs(r.lane-l)))<1.9){r.item=['coconut','bomb','boost','shield'][Math.floor(random(s)*4)];r.itemAge=0;box.cooldown=1.8;if(r.id===0)s.events.push('ПРЕДМЕТ В РУКЕ · SHIFT — ИСПОЛЬЗОВАТЬ');break;}}}
 for(const r of s.racers)if(r.grounded&&r.phase==='driving'&&Math.abs(r.lane)<5)for(const d of s.track.pads){const delta=wrap(r.nearD-d+s.length/2,s.length)-s.length/2;if(Math.abs(delta)<2){r.boost=Math.max(r.boost,1.6);}}
 for(let i=0;i<s.racers.length;i++)for(let j=i+1;j<s.racers.length;j++){const a=s.racers[i],b=s.racers[j];if(a.phase!=='driving'||b.phase!=='driving'||a.contact||b.contact||Math.abs(a.y-b.y)>2)continue;const dx=a.x-b.x,dz=a.z-b.z,dist=Math.hypot(dx,dz);if(dist<2.1&&dist>.001){const nx=dx/dist,nz=dz/dist,push=(2.1-dist)*.5;a.x+=nx*push;a.z+=nz*push;b.x-=nx*push;b.z-=nz*push;if(!a.shield){a.vx*=.8;a.vz*=.8;}if(!b.shield){b.vx*=.8;b.vz*=.8;}a.contact=b.contact=.6;}}
 tickProjectiles(s,dt);
 const laps=Math.min(3,Math.floor(Math.max(0,p.d)/s.length));if(laps>s.lapTimes.length&&p.checkpoint>=laps*12){s.lapTimes.push(s.time-s.lastLap);s.lastLap=s.time;if(laps<3)s.events.push(laps===2?'ПОСЛЕДНИЙ КРУГ!':'КРУГ 2 · ТАК ДЕРЖАТЬ!');}
 s.rank=1+s.racers.slice(1).filter(r=>r.d>p.d||r.finishTime!==null).length;
 if(p.finishTime!==null){s.finished=true;s.finishTime=p.finishTime;s.rank=1+s.racers.slice(1).filter(r=>r.finishTime!==null&&r.finishTime<s.finishTime).length;}
}
const api={DRIVERS,ITEMS,clamp,wrap,angle,formatTime,makeTrack,createRace,useItem,recover,botInput,step};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RaceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
