/* Independent world-space driving. Track coordinates measure progress, never steer the player. */
(function(root){
'use strict';
const DRIVERS=[
 {name:'Веспер',kind:'Лис-пеплоносец',color:0xb86a39,glow:0xffb44d,speed:46,handling:1.08,boost:1,trait:'Пепельный след',description:'На 30% быстрее заряжает турбо в заносе.',driftGain:1.3},
 {name:'Морг',kind:'Енот-страж',color:0x647c6b,glow:0x96dca8,speed:45,handling:1,boost:1,trait:'Костяная броня',description:'Замедление от попаданий на 35% короче.',armor:.65},
 {name:'Селена',kind:'Лунная ведьма',color:0x9494bc,glow:0xbfbaff,speed:48,handling:.95,boost:1,trait:'Лунный прыжок',description:'Чистое приземление даёт 1,2 секунды турбо.',landingBoost:1.2},
 {name:'Каэль',kind:'Ворон-чернокнижник',color:0x5e608c,glow:0xb291ed,speed:46,handling:1.03,boost:1,trait:'Жнец душ',description:'Получает на 25% больше опыта за заезд.',xpBonus:1.25},
 {name:'Грим',kind:'Волк-руноход',color:0x779298,glow:0x87dce1,speed:47,handling:.98,boost:1.3,trait:'Рунный двигатель',description:'Ускорения длятся на 30% дольше.'}
];
const ITEMS={boost:{name:'ЭФИРНОЕ ПЛАМЯ',icon:'ϟ'},shield:{name:'РУННЫЙ ЩИТ',icon:'◈'},coconut:{name:'СФЕРА ДУШ',icon:'◉'},bomb:{name:'ПЕПЕЛЬНАЯ БОМБА',icon:'✹'}};
const STAT_KEYS=['speed','handling','acceleration','braking','aero'];
function newProfile(){return {version:1,heroes:DRIVERS.map(()=>({xp:0,upgrades:Object.fromEntries(STAT_KEYS.map(k=>[k,0]))})),records:{}};}
function parseProfile(raw){if(raw===null)return newProfile();const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.heroes)||data.heroes.length!==DRIVERS.length)throw new Error('Unsupported save');const result=newProfile();
 data.heroes.forEach((h,i)=>{if(!h||!Number.isInteger(h.xp)||h.xp<0||h.xp>1000000)throw new Error('Invalid XP');const dest=result.heroes[i];dest.xp=h.xp;for(const k of STAT_KEYS){const n=h.upgrades?.[k];if(!Number.isInteger(n)||n<0||n>5)throw new Error('Invalid upgrade');dest.upgrades[k]=n;}if(skillPoints(dest)<0)throw new Error('Overspent points');});
 for(const id of ['ash','thorn','frost']){const n=data.records?.[id];if(n!==undefined){if(typeof n!=='number'||!Number.isFinite(n)||n<=0)throw new Error('Invalid record');result.records[id]=n;}}return result;}
function skillPoints(hero){return 3+Math.floor(hero.xp/150)-STAT_KEYS.reduce((sum,k)=>sum+hero.upgrades[k],0);}
function upgrade(profile,driver,key){const h=profile.heroes[driver];if(!h||!STAT_KEYS.includes(key)||skillPoints(h)<1||h.upgrades[key]>=5)return false;h.upgrades[key]++;return true;}
function stats(driver,levels={}){const base=DRIVERS[driver],u=Object.fromEntries(STAT_KEYS.map(k=>[k,Math.max(0,Math.min(5,Math.floor(Number(levels[k])||0)))])),aero=1+u.aero*.05;
 return {...base,speed:base.speed*(1+u.speed*.035),handling:base.handling*(1+u.handling*.045)*(1+u.aero*.018),acceleration:25*(1+u.acceleration*.075)*(1+u.aero*.03),braking:45*(1+u.braking*.085),aero,response:13+u.handling*.7+u.aero*.3};}
function awardRace(profile,s){if(!s.finished||s.rewardClaimed)return null;const h=profile.heroes[s.driver],oldLevel=Math.floor(h.xp/150),xp=Math.round((140+(6-s.rank)*28+Math.min(50,s.metrics.driftSeconds)+s.metrics.jumps*8+s.metrics.hits*12)*(DRIVERS[s.driver].xpBonus||1));h.xp=Math.min(1000000,h.xp+xp);const id=s.track.id||'ash';profile.records[id]=Math.min(profile.records[id]||Infinity,s.finishTime);s.rewardClaimed=true;return {xp,levelUps:Math.floor(h.xp/150)-oldLevel};}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=(x,n)=>((x%n)+n)%n;
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const formatTime=s=>{const cs=Math.floor(Math.max(0,s)*100);return `${String(Math.floor(cs/6000)).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;};
function makeTrack(points,gaps=[]){
 const segments=[];let length=0;
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.0001)continue;segments.push({a,b,d:length,len,tx:dx/len,tz:dz/len});length+=len;}
 const track={length,segments,gaps,width:10.6,pads:[],pickups:[],fences:[],fenceLane:10.75};
 track.index=d=>{d=wrap(d,length);let lo=0,hi=segments.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(segments[m].d>d)hi=m-1;else lo=m;}return lo;};
 track.fenceAt=(d,side)=>track.fences.find(f=>f.side===side&&wrap(d,length)>=f.start&&wrap(d,length)<=f.end);
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
function createRace(track,driver=0,levels={}){
 const racers=Array.from({length:6},(_,i)=>{const d=i===0?0:8+(5-i)*5,lane=i===0?-2.5:(i%2?2.5:-2.5),p=track.sample(d,lane);return {id:i,hero:i===0?driver:(driver+i)%DRIVERS.length,cfg:stats(i===0?driver:(driver+i)%DRIVERS.length,i===0?levels:{}),x:p.x,y:p.y,z:p.z,yaw:Math.atan2(p.tx,p.tz),vx:0,vz:0,vy:0,yawRate:0,steering:0,speed:0,d,lane,nearD:p.d,surface:p,lastSafeD:d,checkpoint:1,boost:0,shield:0,stun:0,contact:0,wallContact:0,drift:0,slip:0,drifting:false,item:null,itemAge:0,throwAnim:0,hitAnim:0,finishTime:null,phase:'driving',phaseTime:0,grounded:true,airTime:0,jumpOrigin:null,landing:0,falls:0};});
 return {track,length:track.length,driver,rewardClaimed:false,metrics:{driftSeconds:0,jumps:0,hits:0},time:0,finished:false,finishTime:null,rank:6,lapTimes:[],lastLap:0,events:[],racers,projectiles:[],effects:[],nextProjectile:0,rng:48329,pickups:track.pickups.map(d=>({d,cooldown:0})),padCooldown:0};
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
function aimTarget(s,owner=0){const r=s.racers[owner];if(!r||!['coconut','bomb'].includes(r.item)||r.phase!=='driving')return null;const fx=Math.sin(r.yaw),fz=Math.cos(r.yaw);let best=null,score=Infinity;for(const enemy of s.racers){if(enemy.id===owner||enemy.phase!=='driving'||enemy.finishTime!==null)continue;const dx=enemy.x-r.x,dz=enemy.z-r.z,dist=Math.hypot(dx,dz),dot=(dx*fx+dz*fz)/(dist||1);if(dist>3&&dist<125&&dot>.68&&Math.abs(enemy.y-r.y)<40){const n=dist+(1-dot)*55;if(n<score){best=enemy;score=n;}}}return best;}
function useItem(s,owner=0){
 const r=s.racers[owner],item=r.item;if(!item||s.finished||r.phase!=='driving')return false;
 const target=aimTarget(s,owner),guided=!!target&&random(s)<.7;r.item=null;r.itemAge=0;r.throwAnim=.4;
 if(item==='boost'){r.boost=3.2*r.cfg.boost;if(owner===0)s.events.push('ТУРБО!');}
 else if(item==='shield'){r.shield=7;if(owner===0)s.events.push('ЩИТ · 7 СЕКУНД');}
 else{const f={x:Math.sin(r.yaw),z:Math.cos(r.yaw)},speed=target?100:r.speed+30;if(target&&!guided){const missYaw=Math.atan2(target.x-r.x,target.z-r.z)+.35;f.x=Math.sin(missYaw);f.z=Math.cos(missYaw);}s.projectiles.push({id:s.nextProjectile++,type:item,owner,targetId:guided?target.id:null,missTargetId:target&&!guided?target.id:null,x:r.x+f.x*2.7,y:r.y+2.3,z:r.z+f.z*2.7,vx:f.x*speed,vz:f.z*speed,vy:item==='bomb'?7:3.5,age:0,life:guided?5:4,nearD:r.nearD});if(owner===0)s.events.push(guided?'ДУША ЗАХВАЧЕНА!':item==='bomb'?'ПЕПЕЛЬНАЯ БОМБА!':'СФЕРА ДУШ!');}
 return true;
}
function hit(s,r,duration){if(r.phase!=='driving')return;if(r.shield>0){if(r.id===0)s.events.push('ЩИТ ОТРАЗИЛ УДАР');return;}r.stun=duration*(r.cfg?.armor||1);r.vx*=.42;r.vz*=.42;r.hitAnim=.7;r.drift=0;r.boost=0;if(r.id===0)s.events.push('ПОПАДАНИЕ · СКОРОСТЬ СНИЖЕНА');}
function explode(s,b){s.effects.push({x:b.x,y:b.y,z:b.z,life:.65,maxLife:.65,type:'blast'});for(const r of s.racers)if(r.id!==b.owner&&r.id!==b.missTargetId&&Math.hypot(r.x-b.x,r.z-b.z,r.y+1-b.y)<8)hit(s,r,3.7);}
function tickProjectiles(s,dt){
 for(const b of s.projectiles){const ox=b.x,oy=b.y,oz=b.z;b.age+=dt;b.life-=dt;const target=b.targetId===null||b.targetId===undefined?null:s.racers[b.targetId];if(target&&target.phase==='driving'&&target.finishTime===null){const dx=target.x-b.x,dy=target.y+1-b.y,dz=target.z-b.z,dist=Math.hypot(dx,dy,dz)||1;const speed=Math.max(100,target.speed+45);b.vx=dx/dist*speed;b.vy=dy/dist*speed;b.vz=dz/dist*speed;}else{b.targetId=null;b.vy-=14*dt;}b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;
  for(const r of s.racers){if(r.id===b.owner||r.id===b.missTargetId||r.phase!=='driving')continue;const dx=b.x-ox,dy=b.y-oy,dz=b.z-oz,den=dx*dx+dy*dy+dz*dz,t=clamp(((r.x-ox)*dx+(r.y+1-oy)*dy+(r.z-oz)*dz)/(den||1),0,1);if(Math.hypot(r.x-ox-dx*t,r.y+1-oy-dy*t,r.z-oz-dz*t)<1.9){if(b.type==='bomb')explode(s,b);else{hit(s,r,3);s.effects.push({x:b.x,y:b.y,z:b.z,life:.4,maxLife:.4,type:'hit'});}if(b.owner===0&&r.shield<=0)s.metrics.hits++;if(b.owner===0)s.events.push(r.shield>0?'СОПЕРНИК ПОД ЩИТОМ':'ЕСТЬ ПОПАДАНИЕ!');b.life=0;break;}}
  if(b.life<=0)continue;const surface=s.track.nearest(b.x,b.z,b.nearD);b.nearD=surface.d;
  if(b.targetId===null&&surface.ground&&Math.abs(surface.lane)<s.track.width&&b.y<surface.y+.45){if(b.type==='bomb'){explode(s,b);b.life=0;}else{b.y=surface.y+.45;b.vy=Math.max(1.4,-b.vy*.4);b.vx*=.92;b.vz*=.92;}}
  if(b.y< -6)b.life=0;
 }
 s.projectiles=s.projectiles.filter(b=>b.life>0);for(const e of s.effects)e.life-=dt;s.effects=s.effects.filter(e=>e.life>0);
}
function botInput(s,r){
 const look=s.track.sample(r.d+11+r.speed*.38,Math.sin(s.time*.2+r.id)*1.8),error=angle(Math.atan2(look.x-r.x,look.z-r.z)-r.yaw),future=s.track.sample(r.d+28),bend=Math.abs(angle(Math.atan2(future.tx,future.tz)-Math.atan2(r.surface.tx,r.surface.tz))),target=clamp(43-r.id*.45-bend*23,26,42);
 return {throttle:r.speed<target+1,brake:r.speed>target+3,steer:clamp(-error*2.9,-1,1),drift:false};
}
function collideFence(s,r){
 const surface=r.surface,side=Math.sign(r.lane),limit=s.track.fenceLane-1.3;
 if(!surface.ground||r.y>surface.y+1.8||r.y<surface.y-1||Math.abs(r.lane)<=limit||!s.track.fenceAt(r.nearD,side))return;
 const nx=-surface.tz*side,nz=surface.tx*side,penetration=Math.abs(r.lane)-limit,outward=Math.max(0,r.vx*nx+r.vz*nz);
 r.x-=nx*penetration;r.z-=nz*penetration;r.lane=surface.lane=side*limit;
 r.vx-=nx*outward*1.12;r.vz-=nz*outward*1.12;
 if(outward>1.5&&r.wallContact<=0){r.vx*=.8;r.vz*=.8;r.wallContact=.45;r.boost=0;r.drift=0;s.effects.push({x:r.x+nx,y:surface.y+.7,z:r.z+nz,life:.3,maxLife:.3,type:'scrape'});if(r.id===0)s.events.push('ОГРАЖДЕНИЕ · СКОРОСТЬ СНИЖЕНА');}
 r.speed=Math.hypot(r.vx,r.vz);
}
function drive(s,r,input,dt){
 if(tickRecovery(s,r,dt)||r.finishTime!==null)return;
 const cfg=r.cfg,speed=Math.hypot(r.vx,r.vz),wasGrounded=r.grounded,previousSurface=r.surface;
 const wantsDrift=!!input.drift&&speed>15&&r.grounded;
 r.steering+=(clamp(input.steer||0,-1,1)-r.steering)*(1-Math.exp(-cfg.response*dt));
 const yawTarget=-r.steering*1.8*cfg.handling*clamp(speed/10,0,1)*(wantsDrift?1.2:1)*(r.grounded?1:.13);
 r.yawRate+=(yawTarget-r.yawRate)*(1-Math.exp(-12*dt));r.yaw=angle(r.yaw+r.yawRate*dt);
 const fx=Math.sin(r.yaw),fz=Math.cos(r.yaw),rx=-fz,rz=fx;
 if(r.grounded){let forward=r.vx*fx+r.vz*fz,lateral=r.vx*rx+r.vz*rz;
  const offroad=Math.abs(r.lane)>9.2,grip=offroad?3.5:wantsDrift?1.65:10;
  const accel=input.brake?-cfg.braking:input.throttle?cfg.acceleration:-5;
  forward=Math.max(0,forward+(accel-previousSurface.slope*10-(forward*forward*.0007)/cfg.aero)*dt);lateral*=Math.exp(-grip*dt);
  const max=offroad?24:cfg.speed+(r.boost>0?19:0);if(forward>max)forward=Math.max(max,forward-25*dt);if(r.stun>0)forward=Math.min(forward,17);
  r.vx=fx*forward+rx*lateral;r.vz=fz*forward+rz*lateral;
 }
 r.speed=Math.hypot(r.vx,r.vz);r.slip=r.speed>3?angle(Math.atan2(r.vx,r.vz)-r.yaw):0;
 const drifting=wantsDrift&&Math.abs(r.slip)>.13;
 if(drifting&&r.id===0)s.metrics.driftSeconds+=dt;if(drifting)r.drift=Math.min(2.5,r.drift+dt*Math.min(1.6,Math.abs(r.slip)*2.2)*(cfg.driftGain||1));
 if(!input.drift&&r.drifting&&r.grounded){if(r.drift>.55){r.boost=(1.1+r.drift*.5)*cfg.boost;if(r.id===0)s.events.push(r.drift>1.7?'СУПЕРДРИФТ!':'ДРИФТ · ТУРБО!');}r.drift=0;}
 if(!wantsDrift&&!r.drifting)r.drift=0;r.drifting=wantsDrift;
 r.x+=r.vx*dt;r.z+=r.vz*dt;
 const surface=s.track.nearest(r.x,r.z,r.nearD),delta=angle((surface.d-r.nearD)/s.length*Math.PI*2)*s.length/(Math.PI*2);
 r.d+=delta;r.nearD=surface.d;r.surface=surface;r.lane=surface.lane;collideFence(s,r);
 if(Math.abs(r.lane)>s.track.width+.6){fall(s,r);return;}
 if(wasGrounded&&!surface.ground){r.grounded=false;r.vy=Math.max(0,(r.vx*previousSurface.tx+r.vz*previousSurface.tz)*previousSurface.slope);r.airTime=0;const gap=s.track.gapAt(surface.d);r.jumpOrigin=gap?r.d-(surface.d-(gap.start-62)):r.lastSafeD;if(r.id===0)s.events.push('ПОЛЁТ!');}
 if(!r.grounded){r.airTime+=dt;r.vy-=22*dt;r.y+=r.vy*dt;
  if(surface.ground&&r.vy<=0&&r.y<=surface.y+.12&&r.y>=surface.y-1.5){r.y=surface.y;r.vy=0;r.grounded=true;r.landing=.4;r.jumpOrigin=null;if(r.airTime>.25){if(cfg.landingBoost)r.boost=Math.max(r.boost,cfg.landingBoost);if(r.id===0){s.metrics.jumps++;s.events.push(cfg.landingBoost?'ЛУННЫЙ ПРЫЖОК · ТУРБО!':'ЧИСТОЕ ПРИЗЕМЛЕНИЕ!');}}r.airTime=0;}
  else if(r.y<surface.y-3.5||r.airTime>3){fall(s,r);return;}
 }else{r.y=surface.y;r.vy=0;r.lastSafeD=r.d;}
 if(r.grounded&&r.d>=r.checkpoint*s.length/12){r.checkpoint++;}
 if(r.d>=s.length*3&&r.checkpoint>=36)r.finishTime=s.time;
}
function step(s,input,dt){
 if(s.finished)return;dt=clamp(dt,0,.05);s.time+=dt;s.padCooldown=Math.max(0,s.padCooldown-dt);
 const p=s.racers[0];
 for(const r of s.racers){for(const key of ['boost','shield','stun','contact','wallContact','throwAnim','hitAnim','landing'])r[key]=Math.max(0,r[key]-dt);r.itemAge+=dt;drive(s,r,r.id===0?input:botInput(s,r),dt);if(r.id>0&&r.item&&r.itemAge>2.8&&r.phase==='driving')useItem(s,r.id);}
 for(const box of s.pickups){box.cooldown=Math.max(0,box.cooldown-dt);if(box.cooldown>0)continue;for(const r of s.racers){if(r.item||!r.grounded||r.phase!=='driving')continue;const delta=wrap(r.nearD-box.d+s.length/2,s.length)-s.length/2;if(Math.abs(delta)<2.1&&Math.min(...[-5,0,5].map(l=>Math.abs(r.lane-l)))<1.9){r.item=['coconut','bomb','boost','shield'][Math.floor(random(s)*4)];r.itemAge=0;box.cooldown=1.8;if(r.id===0)s.events.push('ПРЕДМЕТ В РУКЕ · SHIFT — ИСПОЛЬЗОВАТЬ');break;}}}
 for(const r of s.racers)if(r.grounded&&r.phase==='driving'&&Math.abs(r.lane)<5)for(const d of s.track.pads){const delta=wrap(r.nearD-d+s.length/2,s.length)-s.length/2;if(Math.abs(delta)<2){r.boost=Math.max(r.boost,1.6*r.cfg.boost);}}
 for(let i=0;i<s.racers.length;i++)for(let j=i+1;j<s.racers.length;j++){const a=s.racers[i],b=s.racers[j];if(a.phase!=='driving'||b.phase!=='driving'||a.contact||b.contact||Math.abs(a.y-b.y)>2)continue;const dx=a.x-b.x,dz=a.z-b.z,dist=Math.hypot(dx,dz);if(dist<2.1&&dist>.001){const nx=dx/dist,nz=dz/dist,push=(2.1-dist)*.5;a.x+=nx*push;a.z+=nz*push;b.x-=nx*push;b.z-=nz*push;if(!a.shield){a.vx*=.8;a.vz*=.8;}if(!b.shield){b.vx*=.8;b.vz*=.8;}a.contact=b.contact=.6;}}
 tickProjectiles(s,dt);
 const laps=Math.min(3,Math.floor(Math.max(0,p.d)/s.length));if(laps>s.lapTimes.length&&p.checkpoint>=laps*12){s.lapTimes.push(s.time-s.lastLap);s.lastLap=s.time;if(laps<3)s.events.push(laps===2?'ПОСЛЕДНИЙ КРУГ!':'КРУГ 2 · ТАК ДЕРЖАТЬ!');}
 s.rank=1+s.racers.slice(1).filter(r=>r.d>p.d||r.finishTime!==null).length;
 if(p.finishTime!==null){s.finished=true;s.finishTime=p.finishTime;s.rank=1+s.racers.slice(1).filter(r=>r.finishTime!==null&&r.finishTime<s.finishTime).length;}
}
const api={DRIVERS,ITEMS,STAT_KEYS,newProfile,parseProfile,skillPoints,upgrade,stats,awardRace,aimTarget,clamp,wrap,angle,formatTime,makeTrack,createRace,useItem,recover,botInput,step};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RaceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
