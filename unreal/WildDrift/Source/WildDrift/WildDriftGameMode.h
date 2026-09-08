#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/Actor.h"
#include "GameFramework/HUD.h"
#include "RaceCore.h"
#include "WildDriftGameMode.generated.h"
class UProceduralMeshComponent;
class UMaterialInstanceDynamic;
class UCameraComponent;
class UTexture2D;
class SWidget;
class FJsonObject;
struct FDriftMesh {
 TArray<FVector> Vertices, Normals; TArray<FVector2D> UVs; TArray<FLinearColor> Colors; TArray<int32> Indices;
};
struct FDriftPart {
 USceneComponent* Component=nullptr; FTransform Rest; FString Name; TSharedPtr<FDriftMesh> Mesh;
};
UCLASS()
class AWildDriftModel : public AActor {
 GENERATED_BODY()
public:
 AWildDriftModel(); TArray<FDriftPart> Parts;
 USceneComponent* Find(const FString& Name) const;
 void Pose(const drift::Racer& Racer,double Time,double Dt);
 double WheelAngle=0;
};
UCLASS()
class AWildDriftHUD : public AHUD {
 GENERATED_BODY()
public: virtual void DrawHUD() override;
 UPROPERTY() TObjectPtr<class UFont> NativeFont;
};
UCLASS()
class AWildDriftGameMode : public AGameModeBase {
 GENERATED_BODY()
public:
 AWildDriftGameMode(); virtual void BeginPlay() override; virtual void Tick(float Dt) override; virtual void EndPlay(const EEndPlayReason::Type Reason) override;
 drift::Race Race; drift::Profile Profile; std::vector<drift::Track> Tracks; drift::Reward Reward;
 TSharedPtr<FJsonObject> Catalog; TMap<FString,TSharedPtr<FDriftMesh>> Meshes;
 UPROPERTY() TArray<TObjectPtr<UMaterialInstanceDynamic>> Materials;
 UPROPERTY() TArray<TObjectPtr<UTexture2D>> Textures;
 UPROPERTY() TObjectPtr<AWildDriftModel> WorldModel;
 UPROPERTY() TArray<TObjectPtr<AWildDriftModel>> Karts;
 UPROPERTY() TObjectPtr<AActor> CameraActor;
 UPROPERTY() TObjectPtr<UCameraComponent> Camera;
 UPROPERTY() TArray<TObjectPtr<UProceduralMeshComponent>> Snow;
 UPROPERTY() TArray<TObjectPtr<UProceduralMeshComponent>> Smoke;
 UPROPERTY() TArray<TObjectPtr<UProceduralMeshComponent>> Marks;
 UPROPERTY() TArray<TObjectPtr<UProceduralMeshComponent>> Shots;
 UPROPERTY() TObjectPtr<class UPointLightComponent> CarLight;
 UPROPERTY() TObjectPtr<class USoundWaveProcedural> MotorSound;
 UPROPERTY() TObjectPtr<class UAudioComponent> MotorAudio;
 double MotorPhase=0,SoundClock=0; bool AudioMuted=false;
 TArray<FVector> SnowOffsets; TArray<double> SmokeAge, MarkAge; int NextSmoke=0,NextMark=0;
 std::array<drift::Racer,6> Previous; double Accumulator=0,Clock=0,Countdown=0,NoticeAge=0,SmokeClock=0;
 FString PreviousNotice,Error; FVector CameraAnchor; double CameraYaw=0,CameraY=0,CameraGrade=0;
 int Hero=0,Course=0,UIRevision=0; bool Verify=false; int VerifyStage=0; std::array<bool,7> VerifyKeys{}; double VerifyYaw=0;
 int SmokeStage=0; bool SmokeSuite=false; bool Racing=false,Paused=false,CameraReady=false,SmokeTest=false,AutoDrive=false,SmokeFinished=false;
 TSharedPtr<SWidget> Menu; TSharedPtr<struct FSlateBrush> CoverBrush;
 FString DriverField(int Index,const TCHAR* Field) const; FString CourseField(int Index,const TCHAR* Field) const;
 void LoadCourse(); void CreateKarts(); void StartRace(); void TogglePause(); void ShowMenu(); void HideMenu(); void SaveProfile(); void LoadProfile();
 TSharedPtr<FJsonObject> ReadJson(const FString& File) const; TSharedPtr<FDriftMesh> LoadMesh(const FString& Id);
 AWildDriftModel* LoadModel(const FString& File); USceneComponent* LoadNode(AWildDriftModel* Owner,const TSharedPtr<FJsonObject>& Node,USceneComponent* Parent);
 void LoadMaterials(); UProceduralMeshComponent* Particle(const FLinearColor& Color,bool Flat=false);
 void VerifyInput(); FString ProfilePath() const; void UpdateAudio(); void UpdateScene(double Dt); void BuildWeather(); void UpdateCamera(double Dt); void Fail(const FString& Message);
};
