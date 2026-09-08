#include "WildDriftGameMode.h"
#include "ProceduralMeshComponent.h"
#include "Components/SceneComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/Texture2D.h"
#include "ImageUtils.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/Compression.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonObject.h"
static FVector Vector(const TArray<TSharedPtr<FJsonValue>>& A){return FVector(A[0]->AsNumber(),A[1]->AsNumber(),A[2]->AsNumber());}
static FLinearColor Color(const TArray<TSharedPtr<FJsonValue>>& A){return FLinearColor(A[0]->AsNumber(),A[1]->AsNumber(),A[2]->AsNumber());}
AWildDriftModel::AWildDriftModel(){RootComponent=CreateDefaultSubobject<USceneComponent>(TEXT("Root"));}
USceneComponent* AWildDriftModel::Find(const FString& Name)const{for(const auto& P:Parts)if(P.Name==Name)return P.Component;return nullptr;}
TSharedPtr<FJsonObject> AWildDriftGameMode::ReadJson(const FString& File) const {
 FString Text;TSharedPtr<FJsonObject> Json;if(!FFileHelper::LoadFileToString(Text,*(FPaths::ProjectContentDir()/TEXT("PortData")/File))||!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Text),Json))return nullptr;return Json;
}
void AWildDriftGameMode::Fail(const FString& Message){Error=Message;UE_LOG(LogTemp,Error,TEXT("WildDrift: %s"),*Message);}
void AWildDriftGameMode::LoadMaterials(){
 const auto& Data=Catalog->GetArrayField(TEXT("materials"));
 for(const auto& Value:Data){auto J=Value->AsObject();bool Transparent=J->GetBoolField(TEXT("transparent")),Unlit=J->GetBoolField(TEXT("unlit"));
  FString Path=Transparent?TEXT("/Game/Materials/M_Transparent.M_Transparent"):Unlit?TEXT("/Game/Materials/M_Unlit.M_Unlit"):TEXT("/Game/Materials/M_Surface.M_Surface");
  auto* Base=LoadObject<UMaterialInterface>(nullptr,*Path);if(!Base){Fail(TEXT("Missing native materials. Run tools/bootstrap.sh first."));return;}
  auto* Mat=UMaterialInstanceDynamic::Create(Base,this);Mat->SetVectorParameterValue(TEXT("Tint"),Color(J->GetArrayField(TEXT("color"))));Mat->SetVectorParameterValue(TEXT("Glow"),Color(J->GetArrayField(TEXT("emissive")))*J->GetNumberField(TEXT("emissiveIntensity")));
  Mat->SetScalarParameterValue(TEXT("Metallic"),J->GetNumberField(TEXT("metalness")));Mat->SetScalarParameterValue(TEXT("Roughness"),FMath::Max(.16,J->GetNumberField(TEXT("roughness"))));Mat->SetScalarParameterValue(TEXT("Opacity"),J->GetNumberField(TEXT("opacity")));
  auto Repeat=J->GetArrayField(TEXT("repeat"));Mat->SetVectorParameterValue(TEXT("Repeat"),FLinearColor(Repeat[0]->AsNumber(),Repeat[1]->AsNumber(),0,0));FString Tex;
  if(J->TryGetStringField(TEXT("texture"),Tex)&&!Tex.IsEmpty()){auto* Texture=FImageUtils::ImportFileAsTexture2D(FPaths::ProjectContentDir()/TEXT("PortData/textures")/(Tex+TEXT(".png")));if(Texture){Texture->AddressX=TA_Wrap;Texture->AddressY=TA_Wrap;Texture->UpdateResource();Textures.Add(Texture);Mat->SetTextureParameterValue(TEXT("Albedo"),Texture);Mat->SetScalarParameterValue(TEXT("UseTexture"),1);}}
  Materials.Add(Mat);
 }
}
TSharedPtr<FDriftMesh> AWildDriftGameMode::LoadMesh(const FString& Id){
 if(auto* Existing=Meshes.Find(Id))return *Existing;const TSharedPtr<FJsonObject>* Meta=nullptr;Catalog->GetObjectField(TEXT("geometry"))->TryGetObjectField(Id,Meta);if(!Meta){Fail(TEXT("Unknown geometry: ")+Id);return nullptr;}auto J=*Meta;int64 Bytes=J->GetNumberField(TEXT("bytes"));
 if(Bytes<16||Bytes>512*1024*1024){Fail(TEXT("Invalid geometry size"));return nullptr;}TArray<uint8> Compressed,Raw;Raw.SetNumUninitialized(Bytes);
 if(!FFileHelper::LoadFileToArray(Compressed,*(FPaths::ProjectContentDir()/TEXT("PortData")/J->GetStringField(TEXT("file"))))||!FCompression::UncompressMemory(NAME_Zlib,Raw.GetData(),Bytes,Compressed.GetData(),Compressed.Num())){Fail(TEXT("Unable to read geometry: ")+Id);return nullptr;}
 uint32 Header[4];FMemory::Memcpy(Header,Raw.GetData(),16);uint32 Count=Header[2],IndexCount=Header[3];if(FMemory::Memcmp(Raw.GetData(),"WDGE",4)||Header[1]!=1||IndexCount%3||uint64(16)+uint64(Count)*48+uint64(IndexCount)*4!=uint64(Bytes)){Fail(TEXT("Invalid geometry format"));return nullptr;}
 auto M=MakeShared<FDriftMesh>();M->Vertices.Reserve(Count);M->Normals.Reserve(Count);M->UVs.Reserve(Count);M->Colors.Reserve(Count);
 const uint8* Ptr=Raw.GetData()+16;for(uint32 I=0;I<Count;I++,Ptr+=48){float V[12];FMemory::Memcpy(V,Ptr,48);for(float F:V)if(!FMath::IsFinite(F)){Fail(TEXT("Invalid geometry number"));return nullptr;}M->Vertices.Add(FVector(V[0],V[1],V[2]));M->Normals.Add(FVector(V[3],V[4],V[5]));M->UVs.Add(FVector2D(V[6],1-V[7]));M->Colors.Add(FLinearColor(V[8],V[9],V[10],V[11]));}
 for(uint32 I=0;I<IndexCount;I++,Ptr+=4){uint32 V;FMemory::Memcpy(&V,Ptr,4);if(V>=Count){Fail(TEXT("Invalid geometry index"));return nullptr;}M->Indices.Add(V);}Meshes.Add(Id,M);return M;
}
USceneComponent* AWildDriftGameMode::LoadNode(AWildDriftModel* Owner,const TSharedPtr<FJsonObject>& J,USceneComponent* Parent){
 FString Id;bool Sprite=false;J->TryGetBoolField(TEXT("sprite"),Sprite);USceneComponent* C;TSharedPtr<FDriftMesh> M;
 if(J->TryGetStringField(TEXT("geometry"),Id)||Sprite){auto* Mesh=NewObject<UProceduralMeshComponent>(Owner);C=Mesh;Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);Mesh->bUseAsyncCooking=true;Mesh->SetCastShadow(!Sprite&&J->GetBoolField(TEXT("shadow")));if(Sprite){M=MakeShared<FDriftMesh>();M->Vertices={{-.5,-.5,0},{.5,-.5,0},{.5,.5,0},{-.5,.5,0}};M->Normals.Init(FVector(0,0,1),4);M->UVs={{0,1},{1,1},{1,0},{0,0}};M->Colors.Init(FLinearColor::White,4);M->Indices={0,2,1,0,3,2};Mesh->SetCastShadow(false);}else M=LoadMesh(Id);
  if(M)Mesh->CreateMeshSection_LinearColor(0,M->Vertices,M->Indices,M->Normals,M->UVs,M->Colors,TArray<FProcMeshTangent>(),false);
  int Index=J->GetIntegerField(TEXT("material"));if(Materials.IsValidIndex(Index))Mesh->SetMaterial(0,Materials[Index]);
 }else C=NewObject<USceneComponent>(Owner);
 Owner->AddInstanceComponent(C);C->SetupAttachment(Parent);C->SetMobility(EComponentMobility::Movable);const auto& Q=J->GetArrayField(TEXT("rotation"));FTransform Transform(FQuat(Q[0]->AsNumber(),Q[1]->AsNumber(),Q[2]->AsNumber(),Q[3]->AsNumber()),Vector(J->GetArrayField(TEXT("position"))),Vector(J->GetArrayField(TEXT("scale"))));C->SetRelativeTransform(Transform);C->SetVisibility(J->GetBoolField(TEXT("visible")));C->RegisterComponent();FString Name=J->GetStringField(TEXT("name"));if(Sprite)Name=TEXT("sprite:")+Name;Owner->Parts.Add({C,Transform,Name,M});for(const auto& Child:J->GetArrayField(TEXT("children")))LoadNode(Owner,Child->AsObject(),C);if(!J->GetBoolField(TEXT("visible")))C->SetVisibility(false,true);return C;
}
AWildDriftModel* AWildDriftGameMode::LoadModel(const FString& File){auto J=ReadJson(File);if(!J){Fail(TEXT("Unable to read ")+File);return nullptr;}auto* Model=GetWorld()->SpawnActor<AWildDriftModel>();LoadNode(Model,J,Model->GetRootComponent());return Model;}
void AWildDriftModel::Pose(const drift::Racer& R,double Time,double Dt){
 WheelAngle+=R.speed*Dt/.54;const bool Holding=R.item==drift::Item::Soul||R.item==drift::Item::Bomb;int Selected=int(R.item);const FString Items[]={TEXT(""),TEXT("item-coconut"),TEXT("item-bomb"),TEXT("item-boost"),TEXT("item-shield")};
 for(auto& P:Parts){auto* C=P.Component;const FString& N=P.Name;
  if(N==TEXT("body")){C->SetRelativeRotation(FRotator(0,-FMath::Sin(R.hitAnim*19)*R.hitAnim*20,0));C->SetRelativeLocation(P.Rest.GetLocation()+FVector(0,0,(R.speed>1&&R.grounded?FMath::Sin(Time*20+R.id)*1.8:0)-(R.landing>0?FMath::Sin(R.landing/.4*PI)*16:0)));}
  else if(N.StartsWith(TEXT("wheel-")))C->SetRelativeRotation((P.Rest.GetRotation()*FQuat(FVector::YAxisVector,WheelAngle)).Rotator());
  else if(N.StartsWith(TEXT("front-pivot")))C->SetRelativeRotation((P.Rest.GetRotation()*FQuat(FVector::ZAxisVector,R.steering*.38)).Rotator());
  else if(N==TEXT("head")){C->SetRelativeRotation((P.Rest.GetRotation()*FQuat(FVector::ZAxisVector,R.steering*.16)*FQuat(FVector::XAxisVector,R.steering*.08)).Rotator());C->SetRelativeLocation(P.Rest.GetLocation()+FVector(0,0,FMath::Sin(Time*2)*1.2));}
  else if(N==TEXT("steeringPivot"))C->SetRelativeRotation((P.Rest.GetRotation()*FQuat(FVector::XAxisVector,R.steering*.42)).Rotator());
  else if(N.StartsWith(TEXT("eye-"))){auto S=P.Rest.GetScale3D();if(drift::wrap(Time+R.id*1.13,4.3)<.13)S.Z*=.13;C->SetRelativeScale3D(S);}
  else if(N==TEXT("held")){C->SetVisibility(Holding,true);C->SetRelativeRotation(FRotator(0,0,FMath::Sin(Time*2)*4));}
  else if(N.StartsWith(TEXT("item-")))C->SetVisibility(Holding&&N==Items[Selected],true);
  else if(N==TEXT("shield")){C->SetVisibility(R.shield>0,true);C->SetRelativeRotation(FRotator(0,Time*40,0));}
  else if(N.StartsWith(TEXT("exhaust-flame-"))){C->SetVisibility(R.boost>0,true);C->SetRelativeScale3D(P.Rest.GetScale3D()*FVector(1.0+.22*FMath::Sin(Time*37+R.id),1,1));}
  else if(N==TEXT("respawnRing")){C->SetVisibility(R.phase==drift::Phase::Respawning,true);C->SetRelativeRotation(FRotator(0,Time*160,0));}

 }
 // The raised hand and articulated arm use the same attachment coordinates as the authored model.
 for(int I=0;I<2;I++){double Side=I==0?-1:1;FVector Shoulder(-35,-Side*42,180),Elbow(-4,-Side*55,143),Hand(35,-Side*31,136);if(I==0&&(Holding||R.throwAnim>0)){Hand=FVector(-2,67,195);if(R.throwAnim>0)Hand.X+=FMath::Sin((.4-R.throwAnim)/.4*PI)*110;Elbow=FVector(-15,65,165);}auto* H=Find(FString::Printf(TEXT("hand-%d"),I));if(H)H->SetRelativeLocation(Hand);if(I==0){auto* Held=Find(TEXT("held"));if(Held){Held->SetRelativeLocation(Hand+FVector(0,0,30));Held->SetRelativeRotation(FRotator(0,-Time*40,0));}}
  const FVector Ends[]={Shoulder,Elbow,Hand};for(int K=0;K<2;K++){auto* Arm=Find(FString::Printf(TEXT("%s-arm-%d"),K==0?TEXT("upper"):TEXT("lower"),I));if(Arm){FVector A=Ends[K],B=Ends[K+1],S=Arm->GetRelativeScale3D();S.Z=(B-A).Size()/100;Arm->SetRelativeLocation((A+B)*.5);Arm->SetRelativeRotation(FQuat::FindBetweenNormals(FVector::ZAxisVector,(B-A).GetSafeNormal()));Arm->SetRelativeScale3D(S);}}}
}
