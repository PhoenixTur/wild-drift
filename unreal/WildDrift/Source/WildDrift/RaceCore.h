#pragma once
// Native simulation in metres. Engine rendering converts to centimetres at its boundary.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <limits>
#include <string>
#include <vector>
namespace drift {
constexpr double pi=3.14159265358979323846,inf=std::numeric_limits<double>::infinity(),nan=std::numeric_limits<double>::quiet_NaN();
inline double clamp(double x,double a,double b){return std::max(a,std::min(b,x));}
inline double wrap(double x,double n){return std::fmod(std::fmod(x,n)+n,n);}
inline double angle(double x){return std::atan2(std::sin(x),std::cos(x));}
inline double length(double x,double z){return std::hypot(x,z);}
struct Point {double x=0,y=0,z=0;};
struct Span {double start=0,end=0;int side=0;};
struct Surface:Point {double tx=0,tz=1,d=0,lane=0,slope=0,crossSlope=0,distance=0;bool ground=true;};
struct Segment {Point a,b;double d=0,len=0,tx=0,tz=1;};
struct Track {
 std::string id;std::vector<Point> points;std::vector<Segment> segments;std::vector<Span> gaps,fences,banks;std::vector<double> pads,pickups,camber;double total=0,width=10.6,fenceLane=10.75;
 void build(){segments.clear();total=0;for(size_t i=0;i<points.size();i++){const auto a=points[i],b=points[(i+1)%points.size()];double len=length(b.x-a.x,b.z-a.z);if(len<.0001)continue;segments.push_back({a,b,total,len,(b.x-a.x)/len,(b.z-a.z)/len});total+=len;}}
 int index(double d)const{d=wrap(d,total);auto it=std::upper_bound(segments.begin(),segments.end(),d,[](double v,const Segment& s){return v<s.d;});return std::max(0,int(it-segments.begin())-1);}
 const Span* gapAt(double d)const{d=wrap(d,total);for(const auto& g:gaps)if(d>=g.start&&d<g.end)return &g;return nullptr;}
 bool bridgeAt(double d)const{d=wrap(d,total);for(const auto& g:gaps)if(d>=g.start-25&&d<=g.end+25)return true;return false;}
 bool fenceAt(double d,int side)const{d=wrap(d,total);for(const auto& f:fences)if(f.side==side&&d>=f.start&&d<=f.end)return true;return false;}
 Surface sample(double d,double lane=0)const{
  d=wrap(d,total);const auto& s=segments[index(d)];double t=(d-s.d)/s.len;Surface p;p.x=s.a.x+(s.b.x-s.a.x)*t-s.tz*lane;p.z=s.a.z+(s.b.z-s.a.z)*t+s.tx*lane;p.y=s.a.y+(s.b.y-s.a.y)*t;p.slope=(s.b.y-s.a.y)/s.len;p.tx=s.tx;p.tz=s.tz;p.d=d;p.lane=lane;p.ground=!gapAt(d);
  for(const auto& g:gaps){if(d>=g.start-22&&d<g.start){p.y+=5.8*(d-g.start+22)/22;p.slope+=5.8/22;}else if(d>=g.start&&d<g.end)p.y+=5.8;else if(d>=g.end&&d<g.end+24){p.y+=5.8*(1-(d-g.end)/24);p.slope-=5.8/24;}}
  if(!bridgeAt(d))for(const auto& b:banks){double t0=(d-b.start)/(b.end-b.start);if(t0<=0||t0>=1)continue;double edge=std::max(0.,b.side*lane-3),fade=std::pow(std::sin(pi*t0),2);p.y+=edge*edge*.052*fade;p.crossSlope+=b.side*edge*.104*fade;p.slope+=edge*edge*.052*pi*std::sin(2*pi*t0)/(b.end-b.start);}
  if(camber.size()==segments.size()){int i=index(d),j=(i+1)%camber.size();double rate=(camber[j]-camber[i])/s.len,bank=camber[i]+rate*(d-s.d);p.y+=bank*lane;p.crossSlope+=bank;p.slope+=rate*lane;}
  return p;
 }
 Surface nearest(double x,double z,double hint=nan,double y=nan)const{
  Surface best;double score=inf;bool local=std::isfinite(hint);int center=local?index(hint):0,span=local?50:int(segments.size());
  for(int k=local?-span:0;k<span;k++){const auto& s=segments[int(wrap(center+k,segments.size()))];double t=clamp(((x-s.a.x)*s.tx+(z-s.a.z)*s.tz)/s.len,0,1),px=s.a.x+s.tx*t*s.len,pz=s.a.z+s.tz*t*s.len,dist=(x-px)*(x-px)+(z-pz)*(z-pz),vertical=std::isfinite(y)?y-(s.a.y+(s.b.y-s.a.y)*t):0,current=dist+vertical*vertical;if(current<score){score=current;best=sample(s.d+t*s.len,(x-px)*-s.tz+(z-pz)*s.tx);best.distance=std::sqrt(dist);}}
  return best;
 }
};
struct Stats {double speed=46,handling=1,boost=1,acceleration=25,braking=45,aero=1,response=13,driftGain=1,armor=1,landingBoost=0,xpBonus=1,offroadSpeed=24,collisionRetention=.8,shieldDuration=7;};
inline Stats stats(int hero,const std::array<int,5>& upgrades={}){
 static const double speeds[]={46,45,48,46,47,46,44,47},handling[]={1.08,1,.95,1.03,.98,1.05,.97,1};Stats s;s.speed=speeds[hero];s.handling=handling[hero];if(hero==0)s.driftGain=1.3;if(hero==1)s.armor=.65;if(hero==2)s.landingBoost=1.2;if(hero==3)s.xpBonus=1.25;if(hero==4)s.boost=1.3;if(hero==5)s.offroadSpeed=30;if(hero==6)s.collisionRetention=.9;if(hero==7)s.shieldDuration=9.8;
 std::array<int,5> u;for(int i=0;i<5;i++)u[i]=std::max(0,std::min(5,upgrades[i]));s.speed*=1+u[0]*.035;s.handling*=(1+u[1]*.045)*(1+u[4]*.018);s.acceleration*= (1+u[2]*.075)*(1+u[4]*.03);s.braking*=1+u[3]*.085;s.aero=1+u[4]*.05;s.response=13+u[1]*.7+u[4]*.3;return s;
}
struct HeroProgress {int xp=0;std::array<int,5> upgrades{};std::array<bool,3> skins{true,false,false};int skin=0;};
struct Profile {
 int points=220;std::array<HeroProgress,8> heroes{};std::array<double,5> records{inf,inf,inf,inf,inf};
 int skillPoints(int hero)const{const auto& h=heroes[hero];int n=3+h.xp/150;for(int u:h.upgrades)n-=u;return n;}
 bool upgrade(int hero,int stat){if(hero<0||hero>=8||stat<0||stat>=5||skillPoints(hero)<1||heroes[hero].upgrades[stat]>=5)return false;heroes[hero].upgrades[stat]++;return true;}
 bool chooseSkin(int hero,int skin){if(hero<0||hero>=8||skin<0||skin>=3)return false;auto& h=heroes[hero];constexpr int prices[]={0,180,320};if(!h.skins[skin]){if(points<prices[skin])return false;points-=prices[skin];h.skins[skin]=true;}h.skin=skin;return true;}
 bool valid()const{if(points<0||points>100000000)return false;for(int i=0;i<8;i++){const auto& h=heroes[i];if(h.xp<0||h.xp>1000000||h.skin<0||h.skin>=3||!h.skins[0]||!h.skins[h.skin]||skillPoints(i)<0)return false;for(int u:h.upgrades)if(u<0||u>5)return false;}for(double r:records)if(std::isnan(r)||r<=0)return false;return true;}
};
enum class Item {None,Soul,Bomb,Boost,Shield};
enum class Phase {Driving,Falling,Respawning};
struct Input {bool throttle=false,brake=false,drift=false;double steer=0;};
struct Shape {double halfWidth=1.55,front=2.45,rear=1.95;};
struct Racer:Point {
 Shape shape;
 int id=0,hero=0,checkpoint=1,falls=0;Stats cfg;Surface surface;double yaw=0,vx=0,vz=0,vy=0,yawRate=0,steering=0,speed=0,d=0,lane=0,nearD=0,lastSafeD=0,boost=0,shield=0,stun=0,contact=0,wallContact=0,drift=0,slip=0,itemAge=0,throwAnim=0,hitAnim=0,finishTime=inf,phaseTime=0,airTime=0,jumpOrigin=nan,landing=0,respawnD=0;bool drifting=false,grounded=true;Phase phase=Phase::Driving;Item item=Item::None;
};
// The pose follows the road gradient in the CAR frame; airborne pitch follows velocity.
struct Attitude {
 double pitch=0,roll=0;bool ready=false;
 void update(const Racer& r,const Track& t,double dt){
  double forward=0,right=0;
  if(r.grounded){double grade=(t.sample(r.nearD+2,r.lane).y-t.sample(r.nearD-2,r.lane).y)/4;
   double bank=(t.sample(r.nearD,r.lane+.5).y-t.sample(r.nearD,r.lane-.5).y);
   double along=std::sin(r.yaw)*r.surface.tx+std::cos(r.yaw)*r.surface.tz;
   double across=-std::sin(r.yaw)*r.surface.tz+std::cos(r.yaw)*r.surface.tx;
   forward=std::atan(grade*along+bank*across);right=std::atan(grade*across-bank*along);
  }else forward=clamp(std::atan2(r.vy,std::max(8.,r.speed)),-.65,.65);
  // roll stores the height gradient toward the car's left in JS / right in UE.
  right=-right;
  if(!ready||r.phase==Phase::Respawning){pitch=forward;roll=right;ready=true;return;}
  auto smooth=[dt](double value,double target){return value+clamp((target-value)*(1-std::exp(-7*dt)),-1.15*dt,1.15*dt);};
  pitch=smooth(pitch,forward);roll=smooth(roll,r.grounded?right:0);
 }
};
struct Contact {double nx=0,nz=0,depth=0;};
inline Contact overlap(const Racer& a,const Racer& b){
 double verticalReach=1.15;for(const auto* r:{&a,&b})verticalReach+=std::min(2.,std::abs(r->surface.slope)*(r->shape.front+r->shape.rear)*.5+std::abs(r->surface.crossSlope)*r->shape.halfWidth);
 if(std::abs(a.y-b.y)>verticalReach)return {};
 const double afx=std::sin(a.yaw),afz=std::cos(a.yaw),arx=-afz,arz=afx;
 const double bfx=std::sin(b.yaw),bfz=std::cos(b.yaw),brx=-bfz,brz=bfx;
 const double ah=(a.shape.front+a.shape.rear)/2,bh=(b.shape.front+b.shape.rear)/2;
 double dx=a.x+afx*(a.shape.front-a.shape.rear)/2-b.x-bfx*(b.shape.front-b.shape.rear)/2;
 double dz=a.z+afz*(a.shape.front-a.shape.rear)/2-b.z-bfz*(b.shape.front-b.shape.rear)/2;
 Contact c;c.depth=inf;const double axes[][2]={{afx,afz},{arx,arz},{bfx,bfz},{brx,brz}};
 for(const auto& axis:axes){double nx=axis[0],nz=axis[1],projection=dx*nx+dz*nz;
  double radius=ah*std::abs(afx*nx+afz*nz)+a.shape.halfWidth*std::abs(arx*nx+arz*nz)+bh*std::abs(bfx*nx+bfz*nz)+b.shape.halfWidth*std::abs(brx*nx+brz*nz);
  double depth=radius-std::abs(projection);if(depth<=0)return {};if(depth<c.depth){double sign=projection<0?-1:1;c={nx*sign,nz*sign,depth};}
 }return c;
}
struct Projectile:Point {int id=0,owner=0,target=-1,miss=-1;Item type=Item::Soul;double vx=0,vy=0,vz=0,age=0,life=4,nearD=0;};
struct Effect:Point {double life=0,maxLife=0;int type=0;};
struct Pickup {double d=0,cooldown=0;};
struct Reward {int xp=0,points=0,levelUps=0;};
struct Race {
 const Track* track=nullptr;int driver=0,rank=6,nextProjectile=0;double time=0,finishTime=0,lastLap=0,driftSeconds=0;int jumps=0,hits=0;bool finished=false,rewardClaimed=false;uint32_t rng=48329;std::array<Racer,6> racers;std::vector<Pickup> pickups;std::vector<Projectile> projectiles;std::vector<Effect> effects;std::vector<double> lapTimes;std::string notice;
 void reset(const Track& t,int hero=0,const std::array<int,5>& upgrades={}){*this=Race{};track=&t;driver=hero;for(int i=0;i<6;i++){auto& r=racers[i];r.id=i;r.hero=i==0?hero:(hero+i)%8;r.cfg=stats(r.hero,i==0?upgrades:std::array<int,5>{});double d=i==0?0:8+(5-i)*5,lane=i==0?-2.5:(i%2?2.5:-2.5);place(r,d,0,lane);}for(double d:t.pickups)pickups.push_back({d,0});}
 void place(Racer& r,double d,double speed=0,double lane=0){auto p=track->sample(d,lane);r.x=p.x;r.y=p.y;r.z=p.z;r.yaw=std::atan2(p.tx,p.tz);r.vx=p.tx*speed;r.vz=p.tz*speed;r.vy=0;r.speed=speed;r.d=d;r.lane=lane;r.nearD=p.d;r.surface=p;r.lastSafeD=d;r.grounded=true;r.phase=Phase::Driving;r.phaseTime=0;r.yawRate=r.steering=0;r.jumpOrigin=nan;}
 double random(){rng=rng*1664525u+1013904223u;return double(rng)/4294967296.;}
 void fall(Racer& r){if(r.phase!=Phase::Driving)return;r.phase=Phase::Falling;r.phaseTime=.8;r.falls++;r.grounded=false;r.vy=std::min(r.vy,-3.);r.boost=r.drift=0;r.drifting=false;r.respawnD=std::isfinite(r.jumpOrigin)?r.jumpOrigin:r.lastSafeD;r.item=Item::None;if(r.id==0)notice="ВЫЛЕТ · ВОЗВРАЩАЕМ НА ТРАССУ";}
 bool recovery(Racer& r,double dt){if(r.phase==Phase::Driving)return false;r.phaseTime-=dt;if(r.phase==Phase::Falling){r.vy-=22*dt;r.y+=r.vy*dt;r.x+=r.vx*dt;r.z+=r.vz*dt;if(r.phaseTime<=0){double d=r.respawnD;place(r,d,2);r.phase=Phase::Respawning;r.phaseTime=1.05;r.shield=2.8;r.stun=r.slip=0;}}else if(r.phaseTime<=0){r.phase=Phase::Driving;r.grounded=true;r.airTime=0;}return true;}
 int aim(int owner=0)const{const auto& r=racers[owner];if((r.item!=Item::Soul&&r.item!=Item::Bomb)||r.phase!=Phase::Driving)return -1;int best=-1;double score=inf,fx=std::sin(r.yaw),fz=std::cos(r.yaw);for(const auto& e:racers){if(e.id==owner||e.phase!=Phase::Driving||std::isfinite(e.finishTime))continue;double dx=e.x-r.x,dz=e.z-r.z,dist=length(dx,dz),dot=(dx*fx+dz*fz)/std::max(dist,.001);if(dist>3&&dist<125&&dot>.68&&std::abs(e.y-r.y)<40){double n=dist+(1-dot)*55;if(n<score){best=e.id;score=n;}}}return best;}
 bool useItem(int owner=0){auto& r=racers[owner];Item item=r.item;if(item==Item::None||finished||r.phase!=Phase::Driving)return false;int target=aim(owner);bool guided=target>=0&&random()<.7;r.item=Item::None;r.itemAge=0;r.throwAnim=(item==Item::Soul||item==Item::Bomb)?.4:0;
  if(item==Item::Boost){r.boost=3.2*r.cfg.boost;if(owner==0)notice="ЭФИРНОЕ ПЛАМЯ";}else if(item==Item::Shield){r.shield=r.cfg.shieldDuration;if(owner==0)notice="РУННЫЙ ЩИТ";}else{double yaw=r.yaw;if(target>=0&&!guided)yaw=std::atan2(racers[target].x-r.x,racers[target].z-r.z)+.35;double fx=std::sin(yaw),fz=std::cos(yaw),speed=target>=0?100:r.speed+30;Projectile b;b.id=nextProjectile++;b.type=item;b.owner=owner;b.target=guided?target:-1;b.miss=target>=0&&!guided?target:-1;b.x=r.x+fx*2.7;b.y=r.y+2.3;b.z=r.z+fz*2.7;b.vx=fx*speed;b.vz=fz*speed;b.vy=item==Item::Bomb?7:3.5;b.life=guided?5:4;b.nearD=r.nearD;projectiles.push_back(b);if(owner==0)notice=guided?"ДУША ЗАХВАЧЕНА!":"МАГИЧЕСКИЙ БРОСОК";}return true;}
 void hit(Racer& r,double duration){if(r.phase!=Phase::Driving)return;if(r.shield>0){if(r.id==0)notice="ЩИТ ОТРАЗИЛ УДАР";return;}r.stun=duration*r.cfg.armor;r.vx*=.42;r.vz*=.42;r.hitAnim=.7;r.drift=r.boost=0;if(r.id==0)notice="ПОПАДАНИЕ · СКОРОСТЬ СНИЖЕНА";}
 void effect(const Point& p,double life,int type){Effect e;e.x=p.x;e.y=p.y;e.z=p.z;e.life=e.maxLife=life;e.type=type;effects.push_back(e);}
 void explode(const Projectile& b){effect(b,.65,1);for(auto& r:racers)if(r.id!=b.owner&&r.id!=b.miss&&std::hypot(r.x-b.x,r.z-b.z,r.y+1-b.y)<8)hit(r,3.7);}
 void tickProjectiles(double dt){for(auto& b:projectiles){Point old{b.x,b.y,b.z};b.age+=dt;b.life-=dt;if(b.target>=0&&racers[b.target].phase==Phase::Driving&&!std::isfinite(racers[b.target].finishTime)){const auto& r=racers[b.target];double dx=r.x-b.x,dy=r.y+1-b.y,dz=r.z-b.z,dist=std::max(.001,std::hypot(dx,dy,dz)),speed=std::max(100.,r.speed+45);b.vx=dx/dist*speed;b.vy=dy/dist*speed;b.vz=dz/dist*speed;}else{b.target=-1;b.vy-=14*dt;}b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;
   for(auto& r:racers){if(r.id==b.owner||r.id==b.miss||r.phase!=Phase::Driving)continue;double dx=b.x-old.x,dy=b.y-old.y,dz=b.z-old.z,den=dx*dx+dy*dy+dz*dz,t=clamp(((r.x-old.x)*dx+(r.y+1-old.y)*dy+(r.z-old.z)*dz)/std::max(den,.000001),0,1);if(std::hypot(r.x-old.x-dx*t,r.y+1-old.y-dy*t,r.z-old.z-dz*t)<1.9){if(b.type==Item::Bomb)explode(b);else{hit(r,3);effect(b,.4,0);}if(b.owner==0&&r.shield<=0)hits++;if(b.owner==0)notice=r.shield>0?"СОПЕРНИК ПОД ЩИТОМ":"ЕСТЬ ПОПАДАНИЕ!";b.life=0;break;}}
   if(b.life<=0)continue;auto surface=track->nearest(b.x,b.z,b.nearD);b.nearD=surface.d;if(b.target<0&&surface.ground&&std::abs(surface.lane)<track->width&&b.y<surface.y+.45){if(b.type==Item::Bomb){explode(b);b.life=0;}else{b.y=surface.y+.45;b.vy=std::max(1.4,-b.vy*.4);b.vx*=.92;b.vz*=.92;}}if(b.y<-6)b.life=0;
  }projectiles.erase(std::remove_if(projectiles.begin(),projectiles.end(),[](const auto& b){return b.life<=0;}),projectiles.end());for(auto& e:effects)e.life-=dt;effects.erase(std::remove_if(effects.begin(),effects.end(),[](const auto& e){return e.life<=0;}),effects.end());}
 Input botInput(const Racer& r)const{auto look=track->sample(r.d+11+r.speed*.38,std::sin(time*.2+r.id)*1.8),future=track->sample(r.d+28);double error=angle(std::atan2(look.x-r.x,look.z-r.z)-r.yaw),bend=std::abs(angle(std::atan2(future.tx,future.tz)-std::atan2(r.surface.tx,r.surface.tz))),target=clamp(43-r.id*.45-bend*23,26,42);return {r.speed<target+1,r.speed>target+3,false,clamp(-error*2.9,-1,1)};}
 void collideFence(Racer& r){auto& p=r.surface;int side=r.lane>0?1:-1;double forward=-std::sin(r.yaw)*p.tz+std::cos(r.yaw)*p.tx,right=std::cos(r.yaw)*p.tz+std::sin(r.yaw)*p.tx;double radius=std::abs(forward)*(r.shape.front+r.shape.rear)*.5+std::abs(right)*r.shape.halfWidth+forward*side*(r.shape.front-r.shape.rear)*.5;double limit=track->fenceLane-radius;if(!p.ground||r.y>p.y+1.8||r.y<p.y-1||std::abs(r.lane)<=limit||!track->fenceAt(r.nearD,side))return;double nx=-p.tz*side,nz=p.tx*side,penetration=std::abs(r.lane)-limit,outward=std::max(0.,r.vx*nx+r.vz*nz);r.x-=nx*penetration;r.z-=nz*penetration;r.lane=p.lane=side*limit;r.vx-=nx*outward*1.12;r.vz-=nz*outward*1.12;if(outward>1.5&&r.wallContact<=0){r.vx*=.8;r.vz*=.8;r.wallContact=.45;r.boost=r.drift=0;effect({r.x+nx,p.y+.7,r.z+nz},.3,2);if(r.id==0)notice="ОГРАЖДЕНИЕ · СКОРОСТЬ СНИЖЕНА";}r.speed=length(r.vx,r.vz);}
 void drive(Racer& r,Input input,double dt){if(recovery(r,dt)||std::isfinite(r.finishTime))return;const auto cfg=r.cfg;double speed=length(r.vx,r.vz);bool wasGrounded=r.grounded,wantsDrift=input.drift&&speed>15&&r.grounded;auto previous=r.surface;r.steering+=(clamp(input.steer,-1,1)-r.steering)*(1-std::exp(-cfg.response*dt));double yawTarget=-r.steering*1.8*cfg.handling*clamp(speed/10,0,1)*(wantsDrift?1.2:1)*(r.grounded?1:.13);r.yawRate+=(yawTarget-r.yawRate)*(1-std::exp(-12*dt));r.yaw=angle(r.yaw+r.yawRate*dt);double fx=std::sin(r.yaw),fz=std::cos(r.yaw),rx=-fz,rz=fx;
  if(r.grounded){double forward=r.vx*fx+r.vz*fz,lateral=r.vx*rx+r.vz*rz;bool offroad=std::abs(r.lane)>9.2;double grip=offroad?3.5:wantsDrift?1.65:10,accel=input.brake?-cfg.braking:input.throttle?cfg.acceleration:-5;forward=std::max(0.,forward+(accel-previous.slope*10-forward*forward*.0007/cfg.aero)*dt);lateral*=std::exp(-grip*dt);double max=offroad?cfg.offroadSpeed:cfg.speed+(r.boost>0?19:0);if(forward>max)forward=std::max(max,forward-(std::max(0.,accel)+25)*dt);if(r.stun>0)forward=std::min(forward,17.);r.vx=fx*forward+rx*lateral+previous.tz*previous.crossSlope*18*dt;r.vz=fz*forward+rz*lateral-previous.tx*previous.crossSlope*18*dt;}
  r.speed=length(r.vx,r.vz);r.slip=r.speed>3?angle(std::atan2(r.vx,r.vz)-r.yaw):0;bool drifting=wantsDrift&&std::abs(r.slip)>.13;if(drifting&&r.id==0)driftSeconds+=dt;if(drifting)r.drift=std::min(2.5,r.drift+dt*std::min(1.6,std::abs(r.slip)*2.2)*cfg.driftGain);if(!input.drift&&r.drifting&&r.grounded){if(r.drift>.55){r.boost=(1.1+r.drift*.5)*cfg.boost;if(r.id==0)notice=r.drift>1.7?"СУПЕРДРИФТ!":"ДРИФТ · ТУРБО!";}r.drift=0;}if(!wantsDrift&&!r.drifting)r.drift=0;r.drifting=wantsDrift;r.x+=r.vx*dt;r.z+=r.vz*dt;
  auto surface=track->nearest(r.x,r.z,r.nearD);r.d+=angle((surface.d-r.nearD)/track->total*pi*2)*track->total/(pi*2);r.nearD=surface.d;r.surface=surface;r.lane=surface.lane;collideFence(r);if(std::abs(r.lane)>track->width+.6){fall(r);return;}if(wasGrounded&&!surface.ground){r.grounded=false;r.vy=std::max(0.,(r.vx*previous.tx+r.vz*previous.tz)*previous.slope);r.airTime=0;const auto* gap=track->gapAt(surface.d);r.jumpOrigin=gap?r.d-(surface.d-(gap->start-62)):r.lastSafeD;if(r.id==0)notice="ПОЛЁТ!";}
  if(!r.grounded){r.airTime+=dt;r.vy-=22*dt;r.y+=r.vy*dt;if(surface.ground&&r.vy<=0&&r.y<=surface.y+.12&&r.y>=surface.y-1.5){r.y=surface.y;r.vy=0;r.grounded=true;r.landing=.4;r.jumpOrigin=nan;if(r.airTime>.25){if(cfg.landingBoost>0)r.boost=std::max(r.boost,cfg.landingBoost);if(r.id==0){jumps++;notice=cfg.landingBoost>0?"ЛУННЫЙ ПРЫЖОК · ТУРБО!":"ЧИСТОЕ ПРИЗЕМЛЕНИЕ!";}}r.airTime=0;}else if(r.y<surface.y-3.5||r.airTime>3){fall(r);return;}}else{r.y=surface.y;r.vy=0;r.lastSafeD=r.d;}if(r.grounded&&r.d>=r.checkpoint*track->total/12)r.checkpoint++;if(r.d>=track->total*3&&r.checkpoint>=36)r.finishTime=time;
 }
 void step(Input input,double dt){if(finished||!track)return;dt=clamp(dt,0,.05);time+=dt;auto& p=racers[0];for(auto& r:racers){for(double* timer:{&r.boost,&r.shield,&r.stun,&r.contact,&r.wallContact,&r.throwAnim,&r.hitAnim,&r.landing})*timer=std::max(0.,*timer-dt);r.itemAge+=dt;drive(r,r.id==0?input:botInput(r),dt);if(r.id>0&&r.item!=Item::None&&r.itemAge>2.8&&r.phase==Phase::Driving)useItem(r.id);}
  for(auto& box:pickups){box.cooldown=std::max(0.,box.cooldown-dt);if(box.cooldown>0)continue;for(auto& r:racers){if(r.item!=Item::None||!r.grounded||r.phase!=Phase::Driving)continue;double delta=wrap(r.nearD-box.d+track->total/2,track->total)-track->total/2;if(std::abs(delta)<2.1&&std::min({std::abs(r.lane+5),std::abs(r.lane),std::abs(r.lane-5)})<1.9){r.item=Item(1+int(random()*4));r.itemAge=0;box.cooldown=1.8;if(r.id==0)notice=(r.item==Item::Soul||r.item==Item::Bomb)?"БРОСОК · SHIFT":"БОНУС ГОТОВ · SHIFT";break;}}}
  for(auto& r:racers)if(r.grounded&&r.phase==Phase::Driving&&std::abs(r.lane)<5)for(double d:track->pads)if(std::abs(wrap(r.nearD-d+track->total/2,track->total)-track->total/2)<2)r.boost=std::max(r.boost,1.6*r.cfg.boost);
  // Separation is solved every step, including during the impact feedback cooldown.
  for(int pass=0;pass<4;pass++)for(int i=0;i<6;i++)for(int j=i+1;j<6;j++){
   auto& a=racers[i];auto& b=racers[j];if(a.phase!=Phase::Driving||b.phase!=Phase::Driving)continue;
   auto c=overlap(a,b);if(c.depth<=0)continue;double push=(c.depth+.002)*.5;
   a.x+=c.nx*push;a.z+=c.nz*push;b.x-=c.nx*push;b.z-=c.nz*push;
   double closing=(a.vx-b.vx)*c.nx+(a.vz-b.vz)*c.nz;
   if(closing<0){double impulse=-closing*.52;a.vx+=c.nx*impulse;a.vz+=c.nz*impulse;b.vx-=c.nx*impulse;b.vz-=c.nz*impulse;}
   if(a.contact<=0&&b.contact<=0){for(auto* r:{&a,&b}){if(r->shield<=0){r->vx*=r->cfg.collisionRetention;r->vz*=r->cfg.collisionRetention;}r->contact=.3;r->hitAnim=.14;}}
   for(auto* r:{&a,&b}){r->speed=length(r->vx,r->vz);r->surface=track->nearest(r->x,r->z,r->nearD);r->lane=r->surface.lane;if(r->grounded)r->y=r->surface.y;}
  }
  tickProjectiles(dt);int laps=std::min(3,int(std::floor(std::max(0.,p.d)/track->total)));if(laps>int(lapTimes.size())&&p.checkpoint>=laps*12){lapTimes.push_back(time-lastLap);lastLap=time;if(laps<3)notice=laps==2?"ПОСЛЕДНИЙ КРУГ!":"КРУГ 2";}rank=1;for(int i=1;i<6;i++)if(racers[i].d>p.d||std::isfinite(racers[i].finishTime))rank++;if(std::isfinite(p.finishTime)){finished=true;finishTime=p.finishTime;rank=1;for(int i=1;i<6;i++)if(racers[i].finishTime<finishTime)rank++;}
 }
 Reward award(Profile& profile,int course){if(!finished||rewardClaimed)return {};auto& h=profile.heroes[driver];Reward r;int old=h.xp/150;r.xp=int(std::round((140+(6-rank)*28+std::min(50.,driftSeconds)+jumps*8+hits*12)*stats(driver).xpBonus));r.points=100+(6-rank)*25+hits*10;h.xp=std::min(1000000,h.xp+r.xp);profile.points=std::min(100000000,profile.points+r.points);r.levelUps=h.xp/150-old;profile.records[course]=std::min(profile.records[course],finishTime);rewardClaimed=true;return r;}
};
}
