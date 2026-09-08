#include "WildDriftGameMode.h"
#include "AuthoredTracks.h"
#include "Camera/CameraComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/PostProcessVolume.h"
#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "GameFramework/PlayerController.h"
#include "ProceduralMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "HAL/PlatformFileManager.h"
#include "HAL/PlatformMisc.h"
#include "HighResScreenshot.h"
#include "Sound/SoundWaveProcedural.h"
#include "Components/AudioComponent.h"
static FVector Position(const drift::Point& P){return FVector(P.z*100,-P.x*100,P.y*100);}
static FLinearColor Hex(int32 V){return FLinearColor(FColor((V>>16)&255,(V>>8)&255,V&255));}
AWildDriftGameMode::AWildDriftGameMode(){PrimaryActorTick.bCanEverTick=true;DefaultPawnClass=nullptr;HUDClass=AWildDriftHUD::StaticClass();}
FString AWildDriftGameMode::DriverField(int I,const TCHAR* F)const{return Catalog->GetArrayField(TEXT("drivers"))[I]->AsObject()->GetStringField(F);}
FString AWildDriftGameMode::CourseField(int I,const TCHAR* F)const{return Catalog->GetArrayField(TEXT("courses"))[I]->AsObject()->GetStringField(F);}
void AWildDriftGameMode::BeginPlay(){
 Super::BeginPlay();Catalog=ReadJson(TEXT("catalog.json"));if(!Catalog||Catalog->GetIntegerField(TEXT("schema"))!=1){Fail(TEXT("Missing PortData/catalog.json"));return;}Gallery=FParse::Param(FCommandLine::Get(),TEXT("WildDriftGallery"));Verify=FParse::Param(FCommandLine::Get(),TEXT("WildDriftVerify"));Tracks=drift::authoredTracks();LoadMaterials();if(!Error.IsEmpty())return;LoadProfile();CameraActor=GetWorld()->SpawnActor<AActor>();Camera=NewObject<UCameraComponent>(CameraActor);CameraActor->SetRootComponent(Camera);Camera->RegisterComponent();Camera->SetFieldOfView(64);Camera->PostProcessSettings.bOverride_MotionBlurAmount=true;Camera->PostProcessSettings.MotionBlurAmount=0;
 MotorSound=NewObject<USoundWaveProcedural>(this);MotorSound->SetSampleRate(22050);MotorSound->NumChannels=1;MotorSound->Duration=INDEFINITELY_LOOPING_DURATION;MotorAudio=NewObject<UAudioComponent>(this);AddInstanceComponent(MotorAudio);MotorAudio->bIsUISound=true;MotorAudio->RegisterComponent();MotorAudio->SetSound(MotorSound);UpdateAudio();MotorAudio->Play();
 GetWorld()->GetFirstPlayerController()->SetViewTarget(CameraActor);SmokeSuite=FParse::Param(FCommandLine::Get(),TEXT("WildDriftSuite"));SmokeTest=SmokeSuite||FParse::Param(FCommandLine::Get(),TEXT("WildDriftSmoke"));AutoDrive=SmokeTest||FParse::Param(FCommandLine::Get(),TEXT("WildDriftAutoDrive"));FParse::Value(FCommandLine::Get(),TEXT("WildDriftCourse="),Course);Course=FMath::Clamp(Course,0,4);LoadCourse();if(Verify){Profile={};Profile.chooseSkin(Hero,1);Profile.upgrade(Hero,0);SaveProfile();Profile={};LoadProfile();if(Profile.points!=40||Profile.heroes[Hero].skin!=1||Profile.heroes[Hero].upgrades[0]!=1){Fail(TEXT("Verification: profile round-trip failed"));FPlatformMisc::RequestExitWithStatus(false,1);return;}}if(SmokeTest||AutoDrive||Verify)StartRace();else if(!Gallery)ShowMenu();
}
void AWildDriftGameMode::EndPlay(const EEndPlayReason::Type Reason){HideMenu();Super::EndPlay(Reason);}
void AWildDriftGameMode::LoadCourse(){
 for(auto K:Karts)if(K)K->Destroy();Karts.Empty();for(auto* List:{&Snow,&Smoke,&Marks,&Shots}){for(auto P:*List)if(P)P->DestroyComponent();List->Empty();}SnowOffsets.Empty();SmokeAge.Empty();MarkAge.Empty();
 if(WorldModel){TArray<AActor*> Children;WorldModel->GetAttachedActors(Children);for(auto* A:Children)A->Destroy();WorldModel->Destroy();}WorldModel=LoadModel(CourseField(Course,TEXT("file")));if(!WorldModel)return;
 const auto Theme=Catalog->GetArrayField(TEXT("courses"))[Course]->AsObject()->GetObjectField(TEXT("theme"));
 auto* Sun=GetWorld()->SpawnActor<ADirectionalLight>();Sun->AttachToActor(WorldModel,FAttachmentTransformRules::KeepWorldTransform);Sun->GetLightComponent()->SetMobility(EComponentMobility::Movable);Sun->SetActorRotation(FRotator(-35,-48,0));Sun->GetLightComponent()->SetIntensity(Course==2?5:3.5);Sun->GetLightComponent()->SetLightColor(Hex(Theme->GetIntegerField(TEXT("light"))));Sun->GetLightComponent()->SetCastShadows(true);
 WeatherSun=Cast<UDirectionalLightComponent>(Sun->GetLightComponent());
 auto* Sky=GetWorld()->SpawnActor<ASkyLight>();Sky->AttachToActor(WorldModel,FAttachmentTransformRules::KeepWorldTransform);Sky->GetLightComponent()->SetMobility(EComponentMobility::Movable);Sky->GetLightComponent()->SetIntensity(1.1);Sky->GetLightComponent()->SetRealTimeCaptureEnabled(true);
 auto* Atmos=GetWorld()->SpawnActor<ASkyAtmosphere>();Atmos->AttachToActor(WorldModel,FAttachmentTransformRules::KeepWorldTransform);
 auto* Fog=GetWorld()->SpawnActor<AExponentialHeightFog>();Fog->AttachToActor(WorldModel,FAttachmentTransformRules::KeepWorldTransform);Fog->SetActorLocation(FVector(0,0,100));auto* FC=Fog->GetComponent();FC->SetFogDensity(Course==2?.013:.009);FC->SetFogInscatteringColor(Hex(Theme->GetIntegerField(TEXT("fog"))));FC->SetVolumetricFog(true);FC->SetVolumetricFogDistance(45000);FC->SetVolumetricFogEmissive(Hex(Theme->GetIntegerField(TEXT("fog")))*.12);WeatherFog=FC;
 auto* PP=GetWorld()->SpawnActor<APostProcessVolume>();PP->AttachToActor(WorldModel,FAttachmentTransformRules::KeepWorldTransform);PP->bUnbound=true;auto& S=PP->Settings;S.bOverride_AutoExposureMinBrightness=S.bOverride_AutoExposureMaxBrightness=true;S.AutoExposureMinBrightness=S.AutoExposureMaxBrightness=1;S.bOverride_AutoExposureBias=true;S.AutoExposureBias=.6;S.bOverride_BloomIntensity=true;S.BloomIntensity=.4;S.bOverride_VignetteIntensity=true;S.VignetteIntensity=.25;
 int LightCount=0;for(const auto& Part:WorldModel->Parts)if(Part.Name==TEXT("sprite:torch-flame")&&LightCount++%5==0){auto* L=NewObject<UPointLightComponent>(WorldModel);WorldModel->AddInstanceComponent(L);L->SetupAttachment(Part.Component);L->SetIntensity(3500);L->SetAttenuationRadius(1500);L->SetLightColor(Hex(Theme->GetIntegerField(TEXT("accent"))));L->SetCastShadows(false);L->RegisterComponent();}
 CreateKarts();BuildWeather();CameraReady=false;Clock=0;
}
void AWildDriftGameMode::CreateKarts(){for(auto K:Karts)if(K)K->Destroy();Karts.Empty();Race.reset(Tracks[Course],Hero,Profile.heroes[Hero].upgrades);Previous=Race.racers;
 for(int I=0;I<6;I++){int H=Race.racers[I].hero;Race.racers[I].shape=drift::authoredShape(H,Profile.heroes[H].skin);auto* K=LoadModel(FString::Printf(TEXT("hero-%d-skin-%d.json"),H,Profile.heroes[H].skin));Karts.Add(K);if(K)K->SetActorHiddenInGame(!Racing&&I>0);}
 if(Karts[0]){CarLight=NewObject<UPointLightComponent>(Karts[0]);Karts[0]->AddInstanceComponent(CarLight);CarLight->SetupAttachment(Karts[0]->GetRootComponent());CarLight->SetRelativeLocation(FVector(100,0,120));CarLight->SetIntensity(1600);CarLight->SetAttenuationRadius(1300);CarLight->SetLightColor(FLinearColor(.55,.7,1));CarLight->SetCastShadows(false);CarLight->RegisterComponent();}Accumulator=0;CameraReady=false;
}
void AWildDriftGameMode::StartRace(){Racing=true;Paused=false;CreateKarts();Countdown=AutoDrive||Verify?0:3;Reward={};NoticeAge=0;HideMenu();auto* PC=GetWorld()->GetFirstPlayerController();PC->SetInputMode(FInputModeGameOnly());PC->bShowMouseCursor=false;UE_LOG(LogTemp,Display,TEXT("WildDrift: started course %d with hero %d"),Course,Hero);}
void AWildDriftGameMode::TogglePause(){if(!Racing)return;Paused=!Paused;if(Paused)ShowMenu();else{HideMenu();auto* PC=GetWorld()->GetFirstPlayerController();PC->SetInputMode(FInputModeGameOnly());PC->bShowMouseCursor=false;}}
void AWildDriftGameMode::Tick(float Delta){
 Super::Tick(Delta);if(!Error.IsEmpty()||!Camera||Karts.Num()!=6)return;double Dt=FMath::Min(double(Delta),.1);Clock+=Dt;if(Verify)VerifyInput();auto* PC=GetWorld()->GetFirstPlayerController();if(PC->WasInputKeyJustPressed(EKeys::M))AudioMuted=!AudioMuted;UpdateAudio();if(PC->WasInputKeyJustPressed(EKeys::Escape)&&Racing&&!Race.finished)TogglePause();
 if(Racing&&!Paused&&!Race.finished){Countdown=FMath::Max(0.,Countdown-Dt);if(Countdown==0){if(PC->WasInputKeyJustPressed(EKeys::LeftShift)||PC->WasInputKeyJustPressed(EKeys::RightShift))Race.useItem();if(PC->WasInputKeyJustPressed(EKeys::R))Race.fall(Race.racers[0]);drift::Input Input{PC->IsInputKeyDown(EKeys::W)||PC->IsInputKeyDown(EKeys::Up),PC->IsInputKeyDown(EKeys::S)||PC->IsInputKeyDown(EKeys::Down),PC->IsInputKeyDown(EKeys::SpaceBar),double(PC->IsInputKeyDown(EKeys::D)||PC->IsInputKeyDown(EKeys::Right))-double(PC->IsInputKeyDown(EKeys::A)||PC->IsInputKeyDown(EKeys::Left))};Accumulator+=Dt;
  // Keep simulation independent of render cadence. The bounded accumulator avoids long catch-up stalls.
  while(Accumulator>=1./120){Previous=Race.racers;Race.step(AutoDrive?Race.botInput(Race.racers[0]):Input,1./120);Accumulator-=1./120;if(Race.finished)break;}
  if(Race.finished){Reward=Race.award(Profile,Course);if(!SmokeTest)SaveProfile();ShowMenu();UE_LOG(LogTemp,Display,TEXT("WildDrift: finish %.3fs, rank %d, jumps %d"),Race.finishTime,Race.rank,Race.jumps);}
 }}
 if(PreviousNotice!=UTF8_TO_TCHAR(Race.notice.c_str())){PreviousNotice=UTF8_TO_TCHAR(Race.notice.c_str());NoticeAge=3;}NoticeAge=FMath::Max(0.,NoticeAge-Dt);UpdateScene(Dt);UpdateCamera(Dt);
 if(Gallery){
  if(!SmokeFinished&&Clock>2.5){SmokeFinished=true;FScreenshotRequest::RequestScreenshot(FPaths::ProjectSavedDir()/TEXT("Screenshots")/FString::Printf(TEXT("Gallery-%02d.png"),GalleryStage),true,false);}
  if(Clock>3.5){GalleryStage++;if(GalleryStage>=16){UE_LOG(LogTemp,Display,TEXT("WILDDRIFT_GALLERY_OK eight racers, front and rear views"));FPlatformMisc::RequestExit(false);}else{Hero=GalleryStage/2;int Skin=Hero%3;Profile.heroes[Hero].skins[Skin]=true;Profile.heroes[Hero].skin=Skin;CreateKarts();SmokeFinished=false;Clock=0;}}
 }
 if(SmokeTest&&!SmokeSuite&&!SmokeFinished&&Clock>14){SmokeFinished=true;FScreenshotRequest::RequestScreenshot(FPaths::ProjectSavedDir()/TEXT("Screenshots/NativeRace.png"),true,false);UE_LOG(LogTemp,Display,TEXT("WILDDRIFT_SMOKE_OK meshes=%d materials=%d karts=%d time=%.2f speed=%.2f"),Meshes.Num(),Materials.Num(),Karts.Num(),Race.time,Race.racers[0].speed);}
 if(SmokeTest&&!SmokeSuite&&Clock>17)FPlatformMisc::RequestExit(false);
 if(SmokeSuite){double CaptureAt=SmokeStage==1?3:10,NextAt=SmokeStage==1?5:13;
  if(!SmokeFinished&&Clock>CaptureAt){SmokeFinished=true;FString Name=SmokeStage==1?TEXT("NativeMenu"):FString::Printf(TEXT("NativeCourse%d"),Course);FScreenshotRequest::RequestScreenshot(FPaths::ProjectSavedDir()/TEXT("Screenshots")/(Name+TEXT(".png")),true,false);UE_LOG(LogTemp,Display,TEXT("WILDDRIFT_SUITE_FRAME %s meshes=%d speed=%.1f"),*Name,Meshes.Num(),Race.racers[0].speed);}
  if(Clock>NextAt){if(SmokeStage==0){Racing=false;CreateKarts();ShowMenu();Clock=0;SmokeStage=1;SmokeFinished=false;}else if(Course<4){Course++;Hero=(Course*2+1)%8;int Skin=Course%3;Profile.heroes[Hero].skins[Skin]=true;Profile.heroes[Hero].skin=Skin;LoadCourse();StartRace();SmokeStage=Course+1;SmokeFinished=false;}else{UE_LOG(LogTemp,Display,TEXT("WILDDRIFT_SUITE_OK five courses, menu and variants rendered"));FPlatformMisc::RequestExit(false);}}}

}
UProceduralMeshComponent* AWildDriftGameMode::Particle(const FLinearColor& Color,bool Flat){
 auto* P=NewObject<UProceduralMeshComponent>(WorldModel);WorldModel->AddInstanceComponent(P);P->SetupAttachment(WorldModel->GetRootComponent());P->SetCollisionEnabled(ECollisionEnabled::NoCollision);P->SetCastShadow(false);TArray<FVector> V={{-50,-50,0},{50,-50,0},{50,50,0},{-50,50,0}};TArray<FVector> N;N.Init(FVector::ZAxisVector,4);TArray<FLinearColor> C;C.Init(FLinearColor::White,4);P->CreateMeshSection_LinearColor(0,V,{0,2,1,0,3,2},N,{{0,1},{1,1},{1,0},{0,0}},C,TArray<FProcMeshTangent>(),false);
 auto* Base=LoadObject<UMaterialInterface>(nullptr,Flat?TEXT("/Game/Materials/M_Mark.M_Mark"):TEXT("/Game/Materials/M_Particle.M_Particle"));auto* M=UMaterialInstanceDynamic::Create(Base,this);M->SetVectorParameterValue(TEXT("Tint"),Color);P->SetMaterial(0,M);P->RegisterComponent();P->SetVisibility(false);return P;
}
void AWildDriftGameMode::BuildWeather(){
 FRandomStream Random(135+Course);const int Counts[]={260,420,650,240,460};
 const FLinearColor Colors[]={FLinearColor(.7,.59,.43),FLinearColor(.53,.72,.81),FLinearColor(.85,.93,1),FLinearColor(3,.4,.04),FLinearColor(.57,.75,.94)};
 for(int I=0;I<Counts[Course];I++){Snow.Add(Particle(Colors[Course]));SnowOffsets.Add(FVector(Random.FRandRange(-2500,2500),Random.FRandRange(-2500,2500),Random.FRandRange(0,2800)));}
 for(int I=0;I<70;I++){Smoke.Add(Particle(FLinearColor(.22,.25,.3)));SmokeAge.Add(0);}for(int I=0;I<220;I++){Marks.Add(Particle(FLinearColor(.015,.02,.025),true));MarkAge.Add(0);}for(int I=0;I<24;I++)Shots.Add(Particle(FLinearColor(1,.45,3)));NextSmoke=NextMark=0;
}
void AWildDriftGameMode::UpdateScene(double Dt){
 double Alpha=Racing?Accumulator*120:1;for(int I=0;I<6;I++){if(!Karts[I])continue;const auto& R=Race.racers[I];const auto& Old=Previous[I];FVector Pos=FMath::Lerp(Position(Old),Position(R),Alpha);double Yaw=Old.yaw+drift::angle(R.yaw-Old.yaw)*Alpha;auto& Pose=Karts[I]->Attitude;Pose.update(R,Tracks[Course],Paused?0:Dt);
  const double Front=FMath::Tan(Pose.pitch),Right=FMath::Tan(Pose.roll),CY=FMath::Cos(Yaw),SY=FMath::Sin(Yaw);
  const FVector Forward(CY,-SY,Front),Normal(-CY*Front-SY*Right,SY*Front-CY*Right,1);
  Karts[I]->SetActorLocation(Pos);Karts[I]->SetActorRotation(FRotationMatrix::MakeFromXZ(Forward.GetSafeNormal(),Normal.GetSafeNormal()).ToQuat());double Scale=R.phase==drift::Phase::Respawning?FMath::Clamp((1.05-R.phaseTime)*4.,.03,1.):1;Karts[I]->SetActorScale3D(FVector(Scale));Karts[I]->Pose(R,Clock,Paused?0:Dt);}
 const FVector Player=Karts[0]->GetActorLocation();const FQuat Billboard=FRotationMatrix::MakeFromXY(Camera->GetRightVector(),Camera->GetUpVector()).ToQuat();int PIx=0;for(auto& P:WorldModel->Parts){if(P.Name.StartsWith(TEXT("sprite:"))){auto Pos=P.Rest.GetLocation();if(P.Name==TEXT("sprite:road-mist")){Pos.Y+=FMath::Sin(Clock*.14+PIx)*320;P.Component->SetRelativeLocation(Pos);}if(P.Name==TEXT("sprite:torch-flame"))P.Component->SetRelativeScale3D(P.Rest.GetScale3D()*FVector(1+.09*FMath::Sin(Clock*13+PIx),1+.17*FMath::Sin(Clock*17+PIx),1));P.Component->SetWorldRotation(Billboard);}
  else if(P.Name==TEXT("pickup")){P.Component->SetRelativeRotation(FRotator(0,Clock*70+PIx*12,0));P.Component->SetRelativeLocation(P.Rest.GetLocation()+FVector(0,0,FMath::Sin(Clock*2.3+PIx)*15));int Index=PIx/3;if(Race.pickups.size()>0){auto W=P.Rest.GetLocation();auto Near=Tracks[Course].nearest(-W.Y/100,W.X/100,drift::nan,W.Z/100);double Best=1e9;Index=0;for(int J=0;J<int(Race.pickups.size());J++){double Dist=FMath::Abs(Near.d-Race.pickups[J].d);if(Dist<Best){Best=Dist;Index=J;}}P.Component->SetVisibility(Race.pickups[Index].cooldown<=0,true);}}
  else if(P.Name==TEXT("wind-banner")&&P.Mesh){auto V=P.Mesh->Vertices;for(auto& A:V)A.X+=FMath::Sin(Clock*2.1-A.Z*.012+PIx)*FMath::Max(0.,-A.Z)*.12;Cast<UProceduralMeshComponent>(P.Component)->UpdateMeshSection_LinearColor(0,V,P.Mesh->Normals,P.Mesh->UVs,P.Mesh->Colors,TArray<FProcMeshTangent>());}
  else if(P.Name==TEXT("forge-gear")||P.Name==TEXT("oracle-ring")){P.Component->SetRelativeRotation((P.Rest.GetRotation()*FQuat(FVector::XAxisVector,Clock*(P.Name==TEXT("forge-gear")?.3:.17))).Rotator());}
  else if(P.Name==TEXT("raven")){auto Pos=P.Rest.GetLocation();Pos.X+=FMath::Sin(Clock*.3+PIx)*900;Pos.Y+=FMath::Cos(Clock*.3+PIx)*900;Pos.Z+=FMath::Sin(Clock*.8+PIx)*150;P.Component->SetRelativeLocation(Pos);P.Component->SetRelativeRotation(FRotator(0,Clock*17+PIx*30,FMath::Sin(Clock*5+PIx)*10));}PIx++;}
 const double Gust=.7+.3*FMath::Sin(Clock*.31);const bool Rain=Course==1||Course==4;
 const double FlashTime=drift::wrap(Clock,19),Flash=Course==4&&((FlashTime>8&&FlashTime<8.11)||(FlashTime>8.27&&FlashTime<8.39))?1:0;
 if(WeatherSun)WeatherSun->SetIntensity((Course==2?5:Course==1?2.6:3.5)*(1+.04*FMath::Sin(Clock*.08))+Flash*12);
 if(WeatherFog)WeatherFog->SetFogDensity((Course==2?.016:Course==1?.012:Course==3?.008:.009)*(1+.18*FMath::Sin(Clock*.11)));
 for(int I=0;I<Snow.Num();I++){
  auto O=SnowOffsets[I];double Vertical=Rain?-2200:Course==2?-230:Course==3?240:-90;
  O.X=-2500+drift::wrap(O.X+Clock*(Course==2?200:80),5000);O.Y+=FMath::Sin(Clock*.7+I)*90*Gust;
  O.Z=-450+drift::wrap(O.Z+Clock*Vertical,2800);auto* P=Snow[I].Get();P->SetWorldLocation(Player+O);P->SetWorldRotation(Billboard);
  P->SetWorldScale3D(Rain?FVector(.024,.9+Gust*.45,1):FVector(Course==2?.10+.06*Gust:Course==0?.07:.045));P->SetVisibility(true);
 }
 SmokeClock+=Dt;const auto& R=Race.racers[0];if(Racing&&!Paused&&R.grounded&&R.speed>10&&(R.drifting||R.boost>0)&&SmokeClock>.045){SmokeClock=0;for(int Side:{-1,1}){double Fx=FMath::Sin(R.yaw),Fz=FMath::Cos(R.yaw);drift::Point P{R.x-Fx*.7-Fz*Side*.9,R.y+.12,R.z-Fz*.7+Fx*Side*.9};Smoke[NextSmoke]->SetWorldLocation(Position(P));SmokeAge[NextSmoke]=1.2;NextSmoke=(NextSmoke+1)%Smoke.Num();if(R.drifting){auto* M=Marks[NextMark].Get();M->SetWorldLocation(Position(P));M->SetWorldRotation(FRotator(0,-FMath::RadiansToDegrees(R.yaw),0));M->SetWorldScale3D(FVector(.7,.19,1));MarkAge[NextMark]=22;NextMark=(NextMark+1)%Marks.Num();}}}
 for(int I=0;I<Smoke.Num();I++){SmokeAge[I]=FMath::Max(0.,SmokeAge[I]-Dt);auto* P=Smoke[I].Get();P->SetVisibility(SmokeAge[I]>0);if(SmokeAge[I]>0){P->AddWorldOffset(FVector(0,0,Dt*70));P->SetWorldScale3D(FVector(.4+(1.2-SmokeAge[I])*1.6));P->SetWorldRotation(Billboard);Cast<UMaterialInstanceDynamic>(P->GetMaterial(0))->SetScalarParameterValue(TEXT("Opacity"),SmokeAge[I]*.28);}}
 for(int I=0;I<Marks.Num();I++){MarkAge[I]=FMath::Max(0.,MarkAge[I]-Dt);Marks[I]->SetVisibility(MarkAge[I]>0);}
 for(int I=0;I<Shots.Num();I++){bool Has=I<int(Race.projectiles.size());int Effect=I-int(Race.projectiles.size());bool Burst=!Has&&Effect<int(Race.effects.size());auto* P=Shots[I].Get();P->SetVisibility(Has||Burst);if(Has||Burst){auto* Mat=Cast<UMaterialInstanceDynamic>(P->GetMaterial(0));P->SetWorldRotation(Billboard);if(Has){P->SetWorldLocation(Position(Race.projectiles[I]));P->SetWorldScale3D(FVector(.9));Mat->SetScalarParameterValue(TEXT("Opacity"),1);}else{const auto& E=Race.effects[Effect];P->SetWorldLocation(Position(E));P->SetWorldScale3D(FVector(.3+(1-E.life/E.maxLife)*(E.type==1?10:3)));Mat->SetScalarParameterValue(TEXT("Opacity"),E.life/E.maxLife);}}}
}
void AWildDriftGameMode::UpdateCamera(double Dt){const auto& P=Race.racers[0];FVector Target=Karts[0]->GetActorLocation();if(!Racing){double Orbit=-P.yaw+(Gallery?(GalleryStage%2?2.55:-.6):-.65+Clock*.07),Distance=Gallery?740:1100;FVector Offset(Distance*FMath::Cos(Orbit),Distance*FMath::Sin(Orbit),Gallery?330:450);Camera->SetFieldOfView(64);CameraActor->SetActorLocation(Target+Offset);CameraActor->SetActorRotation((Target+FVector(0,0,125)-CameraActor->GetActorLocation()).Rotation());return;}
 const double Grade=P.grounded?FMath::Clamp((Tracks[Course].sample(P.nearD+6,P.lane).y-Tracks[Course].sample(P.nearD-6,P.lane).y)/12,-.65,.65)*(FMath::Sin(CameraYaw)*P.surface.tx+FMath::Cos(CameraYaw)*P.surface.tz):0;double Travel=P.speed>5?FMath::Atan2(P.vx,P.vz):P.yaw,TargetYaw=P.yaw+drift::angle(Travel-P.yaw)*.65;
 if(!CameraReady||FVector::Dist(CameraAnchor,Target)>10000){CameraAnchor=Target;CameraYaw=P.yaw;CameraY=Target.Z;CameraGrade=Grade;CameraReady=true;}CameraAnchor=FMath::Lerp(CameraAnchor,Target,1-FMath::Exp(-12*Dt));CameraYaw+=drift::angle(TargetYaw-CameraYaw)*(1-FMath::Exp(-4.5*Dt));CameraY=FMath::Lerp(CameraY,Target.Z,1-FMath::Exp(-6*Dt));CameraGrade=FMath::Lerp(CameraGrade,Grade,1-FMath::Exp(-4*Dt));
 bool Rear=GetWorld()->GetFirstPlayerController()->IsInputKeyDown(EKeys::C);double Yaw=CameraYaw+(Rear?PI:0),Back=1080+(P.boost>0?120:0);FVector Forward(FMath::Cos(Yaw),-FMath::Sin(Yaw),0);FVector CamPos=CameraAnchor-Forward*Back;CamPos.Z=CameraY+540-Back*CameraGrade*(Rear?-1:1);auto Under=Tracks[Course].nearest(-CamPos.Y/100,CamPos.X/100,P.nearD);if(Under.ground&&FMath::Abs(Under.lane)<12.2)CamPos.Z=FMath::Max(CamPos.Z,Under.y*100+200);FVector Look=CameraAnchor+Forward*470;Look.Z=CameraY+155+470*CameraGrade*(Rear?-1:1);CameraActor->SetActorLocation(CamPos);CameraActor->SetActorRotation((Look-CamPos).Rotation());int32 Width,Height;GetWorld()->GetFirstPlayerController()->GetViewportSize(Width,Height);double Vertical=58+(P.boost>0?8:0),Horizontal=FMath::RadiansToDegrees(2*FMath::Atan(FMath::Tan(FMath::DegreesToRadians(Vertical*.5))*Width/FMath::Max(1,Height)));Camera->SetFieldOfView(FMath::FInterpTo(Camera->FieldOfView,Horizontal,Dt,3));}
void AWildDriftGameMode::LoadProfile(){
 FString Path=ProfilePath(),Text;if(!FPaths::FileExists(Path))return;TSharedPtr<FJsonObject> J;drift::Profile P;bool OK=FFileHelper::LoadFileToString(Text,*Path)&&FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text),J);if(OK){double Points;const TArray<TSharedPtr<FJsonValue>>* Heroes=nullptr;OK=J->TryGetNumberField(TEXT("points"),Points)&&J->TryGetArrayField(TEXT("heroes"),Heroes)&&Heroes->Num()==8&&Points>=0&&Points<=100000000&&FMath::FloorToDouble(Points)==Points;if(OK){P.points=Points;for(int I=0;I<8&&OK;I++){auto H=(*Heroes)[I]->AsObject();double XP,Skin;const TArray<TSharedPtr<FJsonValue>> *U=nullptr,*Skins=nullptr;OK=H&&H->TryGetNumberField(TEXT("xp"),XP)&&H->TryGetNumberField(TEXT("skin"),Skin)&&H->TryGetArrayField(TEXT("upgrades"),U)&&U->Num()==5&&H->TryGetArrayField(TEXT("skins"),Skins)&&Skins->Num()==3&&XP>=0&&XP<=1000000&&FMath::FloorToDouble(XP)==XP&&Skin>=0&&Skin<3&&FMath::FloorToDouble(Skin)==Skin;if(!OK)break;P.heroes[I].xp=XP;P.heroes[I].skin=Skin;for(int K=0;K<5;K++){double V;OK=OK&&(*U)[K]->TryGetNumber(V)&&V>=0&&V<=5&&FMath::FloorToDouble(V)==V;if(OK)P.heroes[I].upgrades[K]=V;}for(int K=0;K<3;K++){bool V;OK=OK&&(*Skins)[K]->TryGetBool(V);if(OK)P.heroes[I].skins[K]=V;}}const TArray<TSharedPtr<FJsonValue>>* Records=nullptr;if(J->TryGetArrayField(TEXT("records"),Records)&&Records->Num()==5)for(int I=0;I<5;I++){double V;if((*Records)[I]->TryGetNumber(V))P.records[I]=V;}}}if(OK&&P.valid())Profile=P;else{UE_LOG(LogTemp,Warning,TEXT("WildDrift: invalid profile preserved at %s"),*Path);IFileManager::Get().Copy(*(Path+TEXT(".invalid")),*Path);}}
void AWildDriftGameMode::SaveProfile(){if(!Profile.valid()){Fail(TEXT("Profile validation failed; save was not overwritten."));return;}auto J=MakeShared<FJsonObject>();J->SetNumberField(TEXT("version"),2);J->SetNumberField(TEXT("points"),Profile.points);TArray<TSharedPtr<FJsonValue>> Heroes,Records;for(const auto& H:Profile.heroes){auto O=MakeShared<FJsonObject>();O->SetNumberField(TEXT("xp"),H.xp);O->SetNumberField(TEXT("skin"),H.skin);TArray<TSharedPtr<FJsonValue>> U,Skins;for(int V:H.upgrades)U.Add(MakeShared<FJsonValueNumber>(V));for(bool V:H.skins)Skins.Add(MakeShared<FJsonValueBoolean>(V));O->SetArrayField(TEXT("upgrades"),U);O->SetArrayField(TEXT("skins"),Skins);Heroes.Add(MakeShared<FJsonValueObject>(O));}for(double V:Profile.records)Records.Add(std::isfinite(V)?TSharedPtr<FJsonValue>(MakeShared<FJsonValueNumber>(V)):TSharedPtr<FJsonValue>(MakeShared<FJsonValueNull>()));J->SetArrayField(TEXT("heroes"),Heroes);J->SetArrayField(TEXT("records"),Records);FString Text;FJsonSerializer::Serialize(J,TJsonWriterFactory<>::Create(&Text));FString Path=ProfilePath();IFileManager::Get().MakeDirectory(*FPaths::ProjectSavedDir(),true);if(!FFileHelper::SaveStringToFile(Text,*(Path+TEXT(".tmp")))||!IFileManager::Get().Move(*Path,*(Path+TEXT(".tmp")),true,true))Fail(TEXT("Unable to save progress."));}

void AWildDriftGameMode::UpdateAudio(){
 if(!MotorSound||MotorSound->GetAvailableAudioByteCount()>4400)return;TArray<int16> PCM;PCM.SetNumUninitialized(2205);const auto& P=Race.racers[0];double Speed=Racing&&!Paused?P.speed:0,Frequency=44+Speed*5.5;
 for(auto& Sample:PCM){MotorPhase=drift::wrap(MotorPhase+2*PI*Frequency/22050,2*PI);SoundClock+=1./22050;double Engine=(FMath::Sin(MotorPhase)+.4*FMath::Sin(2*MotorPhase)+.16*FMath::Sin(4*MotorPhase))*(Racing&&!Paused?.045:0);double Ambience=(FMath::Sin(SoundClock*2*PI*55)+.4*FMath::Sin(SoundClock*2*PI*82.41))*.012;double Tire=P.drifting&&!Paused?(FMath::FRand()-.5)*.055:0;Sample=AudioMuted?0:int16(FMath::Clamp(Engine+Ambience+Tire,-1.,1.)*32767);}
 MotorSound->QueueAudio(reinterpret_cast<const uint8*>(PCM.GetData()),PCM.Num()*sizeof(int16));
}

FString AWildDriftGameMode::ProfilePath()const{return FPaths::ProjectSavedDir()/(Verify?TEXT("verification-profile.json"):TEXT("profile.json"));}
