#include "WildDriftGameMode.h"
#include "GameFramework/PlayerController.h"
#include "InputKeyEventArgs.h"
#include "GenericPlatform/GenericPlatformInputDeviceMapper.h"
#include "HighResScreenshot.h"
#include "Components/SceneComponent.h"
#include "Misc/Paths.h"
#include "HAL/PlatformMisc.h"
// This integration check drives the real PlayerController input path and the real JSON save/load code.
// Its progress file is separate from the player's profile.
void AWildDriftGameMode::VerifyInput(){
 auto* PC=GetWorld()->GetFirstPlayerController();auto& P=Race.racers[0];const double T=Clock;
 const FKey Keys[]={EKeys::W,EKeys::D,EKeys::SpaceBar,EKeys::R,EKeys::C,EKeys::Escape,EKeys::LeftShift};
 const bool Down[]={T<1.9,T>1.15&&T<1.37,T>1.15&&T<1.37,T>2.1&&T<2.3,T>3.3&&T<3.8,(T>4.5&&T<4.7)||(T>5.1&&T<5.3),T>6.3&&T<6.5};
 for(int I=0;I<7;I++)if(Down[I]!=VerifyKeys[I]){PC->InputKey(FInputKeyEventArgs(nullptr,IPlatformInputDeviceMapper::Get().GetDefaultInputDevice(),Keys[I],Down[I]?IE_Pressed:IE_Released,Down[I]?1.f:0.f,false,FPlatformTime::Cycles64()));VerifyKeys[I]=Down[I];}
 auto Require=[this](bool OK,const TCHAR* Message){if(!OK){Fail(FString(TEXT("Verification: "))+Message);FPlatformMisc::RequestExitWithStatus(false,1);}return OK;};
 auto Capture=[this](const TCHAR* Name){FScreenshotRequest::RequestScreenshot(FPaths::ProjectSavedDir()/TEXT("Screenshots")/(FString(Name)+TEXT(".png")),true,false);};
 if(VerifyStage==0&&T>1.05){if(!Require(P.speed>15,TEXT("W did not accelerate")))return;VerifyYaw=P.yaw;VerifyStage++;}
 if(VerifyStage==1&&T>1.85){if(!Require(FMath::Abs(drift::angle(P.yaw-VerifyYaw))>.1,TEXT("D did not steer")))return;VerifyStage++;}
 if(VerifyStage==2&&T>3.15){if(!Require(P.falls>0&&P.phase==drift::Phase::Respawning&&P.speed<2.1&&FMath::Abs(P.lane)<.01,TEXT("R did not respawn at road centre with reduced speed")))return;VerifyStage++;}
 if(VerifyStage==3&&T>3.6){if(!Require(PC->IsInputKeyDown(EKeys::C),TEXT("C was not held")))return;Capture(TEXT("NativeRearView"));VerifyStage++;}
 if(VerifyStage==4&&T>4.85){if(!Require(Paused,TEXT("Escape did not pause")))return;VerifyStage++;}
 if(VerifyStage==5&&T>5.5){if(!Require(!Paused,TEXT("Escape did not resume")))return;for(auto& Pickup:Race.pickups)Pickup.cooldown=1000;Race.place(P,60,0);Race.place(Race.racers[1],90,0);P.item=drift::Item::Soul;VerifyStage++;}
 if(VerifyStage==6&&T>6){if(!Require(Race.aim()>=0,TEXT("target reticle did not acquire a rival")))return;if(!Require(Cast<AWildDriftHUD>(PC->GetHUD())->TargetVisible,TEXT("acquired target is not drawn")))return;VerifyProjectile=Race.nextProjectile;Capture(TEXT("NativeHeldItem"));VerifyStage++;}
 if(VerifyStage==7&&T>6.6){if(!Require(P.item==drift::Item::None&&Race.nextProjectile>VerifyProjectile&&P.phase==drift::Phase::Driving,TEXT("Shift did not throw")))return;VerifyStage++;}
 if(VerifyStage==8&&T>7.2){P.item=drift::Item::Boost;P.boost=3.2;VerifyStage++;}
 if(VerifyStage==9&&T>7.8){if(!Require(!Karts[0]->Find(TEXT("held"))->IsVisible(),TEXT("boost incorrectly shown in hand")))return;bool Flame=false;for(const auto& Part:Karts[0]->Parts)if(Part.Name.StartsWith(TEXT("exhaust-flame-")))Flame|=Part.Component->IsVisible();if(!Require(Flame,TEXT("exhaust flames not visible during boost")))return;Capture(TEXT("NativeExhaust"));VerifyStage++;}
 if(VerifyStage==10&&T>8.4){P.item=drift::Item::Shield;P.boost=0;P.shield=3;VerifyStage++;}
 if(VerifyStage==11&&T>9){if(!Require(!Karts[0]->Find(TEXT("held"))->IsVisible(),TEXT("shield incorrectly shown in hand")))return;Capture(TEXT("NativeShield"));VerifyStage++;}
 if(VerifyStage==12&&T>9.6){P.item=drift::Item::None;P.shield=0;Race.place(P,Tracks[Course].gaps[0].start-9,46);Previous=Race.racers;VerifyStage++;}
 if(VerifyStage==13&&T>10.1){if(!Require(!P.grounded,TEXT("ramp did not launch the car")))return;Capture(TEXT("NativeFlight"));VerifyStage++;}
 if(VerifyStage==14&&T>11.6){if(!Require(P.grounded&&P.phase==drift::Phase::Driving,TEXT("jump did not land")))return;Capture(TEXT("NativeLanding"));VerifyStage++;}
 if(VerifyStage==15&&T>12.6){for(auto& R:Race.racers)if(R.id>0)Race.place(R,Tracks[Course].total*.5+R.id*10,0);P.item=drift::Item::Soul;Race.place(P,0,0);Previous=Race.racers;VerifyStage++;}
 if(VerifyStage==16&&T>13.2){if(!Require(Race.aim()==-1&&!Cast<AWildDriftHUD>(PC->GetHUD())->TargetVisible,TEXT("reticle shown without a target")))return;Capture(TEXT("NativeNoTarget"));VerifyStage++;}
 if(VerifyStage==17&&T>14){Laps=10;Opponents=8;StartRace();if(!Require(Race.lapCount==10&&Karts.Num()==9,TEXT("maximum race settings failed")))return;VerifyStage++;return;}
 if(VerifyStage==18&&T>14.7){Capture(TEXT("NativeNineRacers"));VerifyStage++;}
 if(VerifyStage==19&&T>15.4){Laps=1;Opponents=0;StartRace();if(!Require(Race.lapCount==1&&Karts.Num()==1,TEXT("solo race settings failed")))return;Race.racers[0].item=drift::Item::Bomb;VerifyStage++;return;}
 if(VerifyStage==20&&T>16){if(!Require(Race.aim()==-1&&!Cast<AWildDriftHUD>(PC->GetHUD())->TargetVisible,TEXT("solo race acquired a phantom target")))return;Capture(TEXT("NativeSolo"));VerifyStage++;}
 if(VerifyStage==21&&T>16.7){Racing=false;ShowMenu();VerifyStage++;}
 if(VerifyStage==22&&T>17.3){Capture(TEXT("NativeRaceSettings"));VerifyStage++;}
 if(VerifyStage==23&&T>18){UE_LOG(LogTemp,Display,TEXT("WILDDRIFT_INPUT_OK controls, targeting, no-target HUD, bonus panel, solo/9-racer races, 1/10 laps, jump, landing and persistence"));FPlatformMisc::RequestExit(false);}
}
