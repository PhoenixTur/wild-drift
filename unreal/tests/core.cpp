#include "AuthoredTracks.h"
#include <cassert>
#include <iostream>
int main(){auto tracks=drift::authoredTracks();assert(tracks.size()==5);drift::Input gas{true,false,false,0};constexpr double dt=1./120;
 for(auto& t:tracks){drift::Race s;s.reset(t,4);s.pickups.clear();for(int id=1;id<6;id++){s.racers[id].finishTime=0;s.racers[id].x=9000;}for(int i=0;i<60000&&!s.finished;i++)s.step(s.botInput(s.racers[0]),dt);assert(s.finished&&s.lapTimes.size()==3&&s.jumps>=6&&s.racers[0].falls==0);std::cout<<t.id<<": three laps in "<<s.time<<" s; jumps "<<s.jumps<<"\n";auto& p=s.racers[0];s.reset(t);s.place(p,20,30);double yaw=p.yaw;for(int i=0;i<50;i++)s.step(gas,dt);assert(std::abs(drift::angle(p.yaw-yaw))<1e-12);}
 auto& t=tracks[0];drift::Race grip,slip;grip.reset(t);slip.reset(t);grip.place(grip.racers[0],15,32);slip.place(slip.racers[0],15,32);for(int i=0;i<70;i++){grip.step({true,false,false,.65},dt);slip.step({true,false,true,.65},dt);}assert(std::abs(slip.racers[0].slip)>std::abs(grip.racers[0].slip)*2);
 drift::Race s;s.reset(t);for(auto& e:s.racers){e.x=9000+e.id*20;e.z=9000;}s.place(s.racers[0],20,0);s.place(s.racers[1],50,0);int guided=0;for(int i=0;i<10000;i++){s.racers[0].item=drift::Item::Soul;s.projectiles.clear();assert(s.useItem());if(s.projectiles[0].target==1)guided++;}assert(std::abs(guided/10000.-.7)<.015);
 // Impact against a fence changes velocity, never the player's steering heading.
 drift::Race fence;fence.reset(t);const auto f=t.fences[0];auto& r=fence.racers[0];fence.place(r,(f.start+f.end)*.5,0,f.side*(t.fenceLane-.6));double y=r.yaw;r.vx=-r.surface.tz*f.side*10;r.vz=r.surface.tx*f.side*10;fence.step({},dt);assert(std::abs(r.lane)<=t.fenceLane-1.29&&r.yaw==y&&r.wallContact>0);
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
 std::cout<<"Native core: manual steering, real drift, five circuits, failed jumps, respawn, 70% guidance, RPG, car-space slope orientation, smooth flight, continuous body collisions and banked bends passed.\n";
}
