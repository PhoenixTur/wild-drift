#include "AuthoredTracks.h"
#include <cassert>
#include <iostream>
int main(){auto tracks=drift::authoredTracks();assert(tracks.size()==5);drift::Input gas{true,false,false,0};constexpr double dt=1./120;
 for(auto& t:tracks){drift::Race s;s.reset(t,4);s.pickups.clear();for(int id=1;id<6;id++){s.racers[id].finishTime=0;s.racers[id].x=9000;}for(int i=0;i<60000&&!s.finished;i++)s.step(s.botInput(s.racers[0]),dt);assert(s.finished&&s.lapTimes.size()==3&&s.jumps>=6&&s.racers[0].falls==0);std::cout<<t.id<<": three laps in "<<s.time<<" s; jumps "<<s.jumps<<"\n";s.reset(t);auto& p=s.racers[0];s.place(p,20,30);double yaw=p.yaw;for(int i=0;i<50;i++)s.step(gas,dt);assert(std::abs(drift::angle(p.yaw-yaw))<1e-12);}
 auto& t=tracks[0];drift::Race grip,slip;grip.reset(t);slip.reset(t);grip.place(grip.racers[0],15,32);slip.place(slip.racers[0],15,32);for(int i=0;i<70;i++){grip.step({true,false,false,.65},dt);slip.step({true,false,true,.65},dt);}assert(std::abs(slip.racers[0].slip)>std::abs(grip.racers[0].slip)*2);
 drift::Race s;s.reset(t);for(auto& e:s.racers){e.x=9000+e.id*20;e.z=9000;}s.place(s.racers[0],20,0);s.place(s.racers[1],50,0);int guided=0;for(int i=0;i<10000;i++){s.racers[0].item=drift::Item::Soul;s.projectiles.clear();assert(s.useItem());if(s.projectiles[0].target==1)guided++;}assert(std::abs(guided/10000.-.7)<.015);
 // Impact against a fence changes velocity, never the player's steering heading.
 {drift::Race fence;fence.reset(t);const auto f=t.fences[0];auto& r=fence.racers[0];fence.place(r,(f.start+f.end)*.5,0,f.side*(t.fenceLane-.6));double y=r.yaw;r.vx=-r.surface.tz*f.side*10;r.vz=r.surface.tx*f.side*10;fence.step({},dt);assert(std::abs(r.lane)<=t.fenceLane-1.29&&r.yaw==y&&r.wallContact>0);}
 drift::Race completed;completed.reset(t,3);completed.finished=true;completed.finishTime=200;completed.rank=1;completed.jumps=6;drift::Profile earned;auto reward=completed.award(earned,0);int coins=earned.points,xp=earned.heroes[3].xp;assert(reward.xp>0&&earned.valid()&&earned.records[0]==200);assert(completed.award(earned,0).xp==0&&earned.points==coins&&earned.heroes[3].xp==xp);
 drift::Profile profile;assert(profile.valid()&&profile.chooseSkin(7,1)&&profile.points==40);assert(profile.chooseSkin(7,1)&&profile.points==40);assert(!profile.chooseSkin(1,2)&&!profile.chooseSkin(20,1));assert(profile.upgrade(0,0)&&profile.upgrade(0,1)&&profile.upgrade(0,4)&&!profile.upgrade(0,2));profile.heroes[0].upgrades[0]=5;assert(!profile.valid());
 for(auto& track:tracks)for(const auto& g:track.gaps){s.reset(track);s.place(s.racers[0],g.start-.3,10);for(int i=0;i<400;i++)s.step({},dt);assert(s.racers[0].falls>0);}
 s.reset(t,7);s.racers[0].item=drift::Item::Shield;s.useItem();assert(s.racers[0].shield==9.8);assert(drift::stats(5).offroadSpeed==30&&drift::stats(6).collisionRetention==.9);
 // Pitch reverses when driving backwards; a sideways car rolls with the same gradient.
 drift::Track ramp;ramp.points={{0,0,0},{0,20,100},{100,20,100},{100,0,0}};ramp.build();
 drift::Race poseRace;poseRace.reset(ramp);auto& tilted=poseRace.racers[0];poseRace.place(tilted,40,30);
 drift::Attitude uphill;uphill.update(tilted,ramp,dt);assert(uphill.pitch>.19&&std::abs(uphill.roll)<1e-9);
 tilted.yaw=drift::pi;drift::Attitude backwards;backwards.update(tilted,ramp,dt);assert(backwards.pitch<-.19);
 tilted.yaw=drift::pi/2;drift::Attitude sideways;sideways.update(tilted,ramp,dt);assert(std::abs(sideways.pitch)<1e-9&&sideways.roll>.19);
 tilted.grounded=false;tilted.vy=8;for(int i=0;i<180;i++){double before=uphill.pitch;tilted.vy-=22./60;tilted.surface.slope=i%2?1:-1;uphill.update(tilted,ramp,1./60);assert(std::abs(uphill.pitch-before)<=1.15/60+1e-12);}assert(uphill.pitch<-.6);
 // Body shapes cover the actual authored tires; cooldown never permits overlap.
 for(int h=0;h<8;h++)for(int skin=0;skin<3;skin++)for(double turn:{0.,.8,1.57079632679}){
  drift::Race contact;contact.reset(t);for(auto& e:contact.racers){e.phase=drift::Phase::Respawning;e.phaseTime=10000;}
  auto& a=contact.racers[0];auto& b=contact.racers[1];contact.place(a,30,0);contact.place(b,30,0,1.6);a.shape=drift::authoredShape(h,skin);b.shape=drift::authoredShape((h+3)%8,(skin+1)%3);b.yaw+=turn;a.contact=b.contact=.6;
  assert(a.shape.halfWidth>1.2&&a.shape.front>1.7&&drift::overlap(a,b).depth>0);contact.step({},dt);assert(drift::overlap(a,b).depth<.01);
  b.y=a.y+6;assert(drift::overlap(a,b).depth==0);
 }
 // Uphill bumpers still meet even though their chassis centres have different heights.
 {drift::Racer a,b;a.surface.slope=b.surface.slope=.45;b.z=3.4;b.y=1.53;assert(drift::overlap(a,b).depth>0);b.y=8;assert(drift::overlap(a,b).depth==0);}
 for(const auto& course:tracks){assert(course.camber.size()==course.segments.size());int bends=0;for(size_t i=0;i<course.camber.size();i++)if(std::abs(course.camber[i])>.025)bends++;assert(bends>200);}
 s.reset(t);for(auto item:{drift::Item::Boost,drift::Item::Shield}){s.racers[0].item=item;s.useItem();assert(s.racers[0].throwAnim==0);}
 // Race configuration uses active entrants everywhere, from targeting to finishing.
 for(int opponents=0;opponents<=drift::heroCount;opponents++)for(int laps:{1,10}){
  drift::Race config;config.reset(t,7,{},laps,opponents);assert(config.racers.size()==size_t(opponents+1)&&config.lapCount==laps);
  for(size_t i=0;i<config.racers.size();i++)assert(config.racers[i].id==int(i)&&config.racers[i].hero>=0&&config.racers[i].hero<8);
  config.racers[0].item=drift::Item::Soul;if(opponents==0)assert(config.aim()==-1);
  for(int lap=1;lap<=laps;lap++){auto& r=config.racers[0];config.place(r,t.total*lap+.1,0);r.checkpoint=lap*12;config.step({},dt);assert(config.finished==(lap==laps));}
  assert(config.lapTimes.size()==size_t(laps)&&config.rank>=1&&config.rank<=opponents+1);
 }
 s.reset(t,0,{},-5,-1);assert(s.lapCount==1&&s.racers.size()==1);s.reset(t,0,{},100,100);assert(s.lapCount==10&&s.racers.size()==9);
 for(const auto& course:tracks){drift::Race field;field.reset(course,0,{},1,8);for(auto& racer:field.racers)racer.shape=drift::authoredShape(racer.hero,racer.id%3);for(int tick=0;tick<84000&&!field.finished;tick++)field.step(field.botInput(field.racers[0]),dt);assert(field.finished&&field.lapTimes.size()==1&&field.rank>=1&&field.rank<=9);std::cout<<course.id<<": nine racers finished in "<<field.time<<" s\n";}
 // The banked road has a continuous edge frame and no inside-out hairpin strips.
 for(const auto& course:tracks){double maximumBank=0;
  for(size_t i=0;i<course.segments.size();i++){const auto& a=course.segments[i];const auto& b=course.segments[(i+1)%course.segments.size()];double curvature=std::abs(drift::angle(std::atan2(b.tx,b.tz)-std::atan2(a.tx,a.tz)))/((a.len+b.len)/2);assert(curvature<.056);maximumBank=std::max(maximumBank,std::abs(course.camber[i]));
   for(double lane:{-9.45,9.45}){auto l=course.sample(a.d-1e-5,lane),r=course.sample(a.d+1e-5,lane);assert(std::hypot(l.x-r.x,l.z-r.z,l.y-r.y)<.002);}
  }assert(maximumBank>.50&&maximumBank<=.581);
  for(const auto& g:course.gaps)for(double d:{g.start-36,g.end+42}){auto a=course.sample(d-1e-5),b=course.sample(d+1e-5);assert(std::abs(a.y-b.y)<.001&&std::abs(a.slope-b.slope)<.002);}
 }
 // A tapered nose can enter space that was empty inside the old bounding rectangle.
 {drift::Racer a,b;a.shape={1.5,3,2,{{-1.5,0,-2},{1.5,0,-2},{1.5,0,1},{.3,0,3},{-.3,0,3},{-1.5,0,1}}};b.shape={.3,.3,.3,{}};b.x=1.5;b.z=2.7;assert(drift::overlap(a,b).depth==0);b.x=0;assert(drift::overlap(a,b).depth>0);}
 drift::Track straight;straight.points={{0,0,0},{0,0,10000},{10000,0,10000},{10000,0,0}};straight.width=1000;straight.build();
 // Holding the throttle accelerates immediately after a hit, through the recovery period.
 s.reset(straight,0,{},3,0);s.place(s.racers[0],100,45);auto& hit=s.racers[0];s.hit(hit,3);double damaged=hit.speed,last=damaged;assert(damaged>18&&damaged<20);
 for(int i=0;i<330;i++){s.step(gas,dt);assert(hit.speed>=last-1e-9);last=hit.speed;}assert(hit.speed>40&&hit.stun>0);
 hit.shield=3;double protectedSpeed=hit.speed;s.hit(hit,3);assert(hit.speed==protectedSpeed);
 // Letting go of drift changes neither heading nor traction abruptly at high speed.
 for(double speed:{38.,58.}){drift::Race slide;slide.reset(straight,0,{},3,0);auto& r=slide.racers[0];slide.place(r,100,speed);for(int i=0;i<55;i++)slide.step({true,false,true,.65},dt);
  assert(r.driftBlend>.8&&std::abs(r.slip)>.1);double slipBefore=std::abs(r.slip),blend=r.driftBlend;
  for(int i=0;i<100;i++){double yaw=r.yaw,travel=std::atan2(r.vx,r.vz);slide.step(gas,dt);assert(std::abs(drift::angle(r.yaw-yaw))<.018);assert(std::abs(drift::angle(std::atan2(r.vx,r.vz)-travel))<.018);if(i==0)assert(r.driftBlend>blend*.97);}
  assert(std::abs(r.slip)<slipBefore*.65&&r.phase==drift::Phase::Driving);
 }
 std::cout<<"Native core: manual steering, real drift, five circuits, failed jumps, respawn, 70% guidance, RPG, car-space slope orientation, smooth flight, tight hull collisions, continuous road edges, smooth ramp joins, 1-10 laps, 0-8 opponents, progressive hit recovery and drift release passed.\n";
}
