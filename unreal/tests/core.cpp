#include "AuthoredTracks.h"
#include <cassert>
#include <iostream>
int main(){auto tracks=drift::authoredTracks();assert(tracks.size()==5);drift::Input gas{true,false,false,0};constexpr double dt=1./120;
 for(auto& t:tracks){drift::Race s;s.reset(t,4);for(int i=0;i<60000&&!s.finished;i++)s.step(s.botInput(s.racers[0]),dt);assert(s.finished&&s.lapTimes.size()==3&&s.jumps>=6&&s.racers[0].falls==0);std::cout<<t.id<<": three laps in "<<s.time<<" s; jumps "<<s.jumps<<"\n";auto& p=s.racers[0];s.reset(t);s.place(p,20,30);double yaw=p.yaw;for(int i=0;i<50;i++)s.step(gas,dt);assert(std::abs(drift::angle(p.yaw-yaw))<1e-12);}
 auto& t=tracks[0];drift::Race grip,slip;grip.reset(t);slip.reset(t);grip.place(grip.racers[0],15,32);slip.place(slip.racers[0],15,32);for(int i=0;i<70;i++){grip.step({true,false,false,.65},dt);slip.step({true,false,true,.65},dt);}assert(std::abs(slip.racers[0].slip)>std::abs(grip.racers[0].slip)*2);
 drift::Race s;s.reset(t);for(auto& e:s.racers){e.x=9000+e.id*20;e.z=9000;}s.place(s.racers[0],20,0);s.place(s.racers[1],50,0);int guided=0;for(int i=0;i<10000;i++){s.racers[0].item=drift::Item::Soul;s.projectiles.clear();assert(s.useItem());if(s.projectiles[0].target==1)guided++;}assert(std::abs(guided/10000.-.7)<.015);
 // Impact against a fence changes velocity, never the player's steering heading.
 drift::Race fence;fence.reset(t);const auto f=t.fences[0];auto& r=fence.racers[0];fence.place(r,(f.start+f.end)*.5,0,f.side*(t.fenceLane-.6));double y=r.yaw;r.vx=-r.surface.tz*f.side*10;r.vz=r.surface.tx*f.side*10;fence.step({},dt);assert(std::abs(r.lane)<=t.fenceLane-1.29&&r.yaw==y&&r.wallContact>0);
 drift::Race completed;completed.reset(t,3);completed.finished=true;completed.finishTime=200;completed.rank=1;completed.jumps=6;drift::Profile earned;auto reward=completed.award(earned,0);int coins=earned.points,xp=earned.heroes[3].xp;assert(reward.xp>0&&earned.valid()&&earned.records[0]==200);assert(completed.award(earned,0).xp==0&&earned.points==coins&&earned.heroes[3].xp==xp);
 drift::Profile profile;assert(profile.valid()&&profile.chooseSkin(7,1)&&profile.points==40);assert(profile.chooseSkin(7,1)&&profile.points==40);assert(!profile.chooseSkin(1,2)&&!profile.chooseSkin(20,1));assert(profile.upgrade(0,0)&&profile.upgrade(0,1)&&profile.upgrade(0,4)&&!profile.upgrade(0,2));profile.heroes[0].upgrades[0]=5;assert(!profile.valid());
 for(auto& track:tracks)for(const auto& g:track.gaps){s.reset(track);s.place(s.racers[0],g.start-.3,10);for(int i=0;i<400;i++)s.step({},dt);assert(s.racers[0].falls>0);}
 s.reset(t,7);s.racers[0].item=drift::Item::Shield;s.useItem();assert(s.racers[0].shield==9.8);assert(drift::stats(5).offroadSpeed==30&&drift::stats(6).collisionRetention==.9);
 std::cout<<"Native core: manual steering, real drift, five circuits, failed jumps, respawn, 70% guidance, RPG points and skins passed.\n";
}
