#include "WildDriftGameMode.h"
#include "Engine/Canvas.h"
#include "CanvasItem.h"
#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "Engine/Font.h"
#include "GameFramework/PlayerController.h"
#include "Widgets/SOverlay.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScaleBox.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Text/STextBlock.h"
#include "Styling/CoreStyle.h"
#include "Dom/JsonObject.h"
static FText T(const FString& S){return FText::FromString(S);}
static FSlateFontInfo Font(int Size){return FCoreStyle::GetDefaultFontStyle("Regular",FMath::RoundToInt(Size*.75));}
static const FLinearColor Gold(.83,.65,.36),Muted(.5,.57,.65),Panel(.025,.034,.052,.96);
static TSharedRef<STextBlock> Label(const FString& S,int Size=14,FLinearColor C=FLinearColor::White){return SNew(STextBlock).Text(T(S)).Font(Font(Size)).ColorAndOpacity(C).AutoWrapText(true);}
static TSharedRef<SButton> Button(const FString& S,TFunction<void()> Action,bool Selected=false){return SNew(SButton).ContentPadding(FMargin(14,8)).ButtonColorAndOpacity(Selected?FLinearColor(.3,.22,.12):FLinearColor(.07,.085,.11)).OnClicked_Lambda([Action](){Action();return FReply::Handled();})[Label(S,14,Selected?Gold:FLinearColor(.8,.85,.9))];}
void AWildDriftGameMode::HideMenu(){if(Menu.IsValid()&&GEngine&&GEngine->GameViewport)GEngine->GameViewport->RemoveViewportWidgetContent(Menu.ToSharedRef());Menu.Reset();}
void AWildDriftGameMode::ShowMenu(){
 HideMenu();if(!GEngine||!GEngine->GameViewport)return;auto* PC=GetWorld()->GetFirstPlayerController();PC->bShowMouseCursor=true;PC->SetInputMode(FInputModeGameAndUI().SetHideCursorDuringCapture(false));
 if(Racing){auto Box=SNew(SVerticalBox);Box->AddSlot().AutoHeight().Padding(0,0,0,16)[Label(Race.finished?TEXT("ЗАЕЗД ЗАВЕРШЁН"):TEXT("ПАУЗА"),32,Gold)];if(Race.finished){Box->AddSlot().AutoHeight().Padding(0,0,0,20)[Label(FString::Printf(TEXT("Место %d / %d  ·  %d:%05.2f\n+%d опыта   +%d душ"),Race.rank,int(Race.racers.size()),int(Race.finishTime)/60,FMath::Fmod(Race.finishTime,60),Reward.xp,Reward.points),20)];}else Box->AddSlot().AutoHeight().Padding(0,4)[Button(TEXT("Продолжить  ·  Esc"),[this](){TogglePause();})];Box->AddSlot().AutoHeight().Padding(0,4)[Button(TEXT("Новый заезд"),[this](){StartRace();})];Box->AddSlot().AutoHeight().Padding(0,4)[Button(TEXT("Выбор героя и трассы"),[this](){Racing=false;Paused=false;CreateKarts();ShowMenu();})];Menu=SNew(SOverlay)+SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Center)[SNew(SBox).WidthOverride(430)[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Panel).Padding(30)[Box]]];
 }else{
  auto Heroes=SNew(SVerticalBox);Heroes->AddSlot().AutoHeight().Padding(0,0,0,12)[Label(TEXT("ВЫБЕРИ СВОЮ КЛЯТВУ"),12,Gold)];for(int I=0;I<8;I++)Heroes->AddSlot().AutoHeight().Padding(0,3)[Button(DriverField(I,TEXT("name"))+TEXT("  ·  ")+DriverField(I,TEXT("kind")),[this,I](){Hero=I;CreateKarts();ShowMenu();},Hero==I)];Heroes->AddSlot().AutoHeight().Padding(0,12,0,3)[Label(DriverField(Hero,TEXT("trait")),20,Gold)];Heroes->AddSlot().AutoHeight()[Label(DriverField(Hero,TEXT("description")),14,Muted)];
  auto Courses=SNew(SVerticalBox);Courses->AddSlot().AutoHeight().Padding(0,0,0,12)[Label(TEXT("ЗЕМЛИ ЗА ПРЕДЕЛАМИ СВЕТА"),12,Gold)];for(int I=0;I<5;I++){auto C=SNew(SVerticalBox);C->AddSlot().AutoHeight()[Label(CourseField(I,TEXT("name")),18,Course==I?Gold:FLinearColor::White)];C->AddSlot().AutoHeight().Padding(0,4)[Label(CourseField(I,TEXT("subtitle")),12,Muted)];C->AddSlot().AutoHeight()[Label(FString::Printf(TEXT("%.2f км"),Tracks[I].total/1000),12)];Courses->AddSlot().AutoHeight().Padding(0,3)[SNew(SButton).ContentPadding(10).ButtonColorAndOpacity(Course==I?FLinearColor(.27,.19,.1):FLinearColor(.055,.07,.09)).OnClicked_Lambda([this,I](){Course=I;LoadCourse();ShowMenu();return FReply::Handled();})[C]];}
  auto Settings=SNew(SHorizontalBox);
  auto Counter=[&](const FString& Caption,int Value,int Min,int Max,TFunction<void(int)> Change){auto ValueLabel=Label(FString::Printf(TEXT("%s: %d"),*Caption,Value),17,Gold);ValueLabel->SetAutoWrapText(false);auto Row=SNew(SHorizontalBox);Row->AddSlot().AutoWidth()[Button(TEXT("−"),[=](){Change(FMath::Max(Min,Value-1));})];Row->AddSlot().FillWidth(1).HAlign(HAlign_Center).VAlign(VAlign_Center)[ValueLabel];Row->AddSlot().AutoWidth()[Button(TEXT("+"),[=](){Change(FMath::Min(Max,Value+1));})];return Row;};
  Settings->AddSlot().FillWidth(1).Padding(4)[Counter(TEXT("Круги"),Laps,1,10,[this](int V){Laps=V;ShowMenu();})];
  Settings->AddSlot().FillWidth(1).Padding(4)[Counter(TEXT("Соперники"),Opponents,0,drift::heroCount,[this](int V){Opponents=V;ShowMenu();})];
  auto Garage=SNew(SHorizontalBox);const TCHAR* Names[]={TEXT("Скорость"),TEXT("Управление"),TEXT("Разгон"),TEXT("Торможение"),TEXT("Аэродинамика")};for(int I=0;I<5;I++){Garage->AddSlot().FillWidth(1).Padding(4)[Button(FString::Printf(TEXT("%s  %d / 5  +"),Names[I],Profile.heroes[Hero].upgrades[I]),[this,I](){if(Profile.upgrade(Hero,I)){SaveProfile();CreateKarts();ShowMenu();}})];}
  auto Skins=SNew(SHorizontalBox);for(int I=0;I<3;I++){auto J=Catalog->GetArrayField(TEXT("skins"))[I]->AsObject();FString Caption=J->GetStringField(TEXT("name"));if(!Profile.heroes[Hero].skins[I])Caption+=FString::Printf(TEXT("  ·  %d душ"),J->GetIntegerField(TEXT("price")));Skins->AddSlot().FillWidth(1).Padding(4)[Button(Caption,[this,I](){if(Profile.chooseSkin(Hero,I)){SaveProfile();CreateKarts();ShowMenu();}},Profile.heroes[Hero].skin==I)];}
  auto Bottom=SNew(SVerticalBox);Bottom->AddSlot().AutoHeight().Padding(8,4)[Label(FString::Printf(TEXT("КУЗНИЦА   ·   %d душ   ·   Уровень %d   ·   Очки развития: %d"),Profile.points,1+Profile.heroes[Hero].xp/150,Profile.skillPoints(Hero)),14,Gold)];Bottom->AddSlot().AutoHeight()[Garage];Bottom->AddSlot().AutoHeight()[Skins];
  Menu=SNew(SOverlay)
   +SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(35,92)[SNew(STextBlock).Text(T(TEXT("WASD / стрелки — руль и газ   ·   Пробел — дрифт   ·   Shift — предмет   ·   C — вид назад   ·   R — возврат   ·   Esc — пауза   ·   M — звук"))).Font(Font(12)).ColorAndOpacity(Muted)]
   +SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(35,22)[SNew(SBox).WidthOverride(500)[SNew(SVerticalBox)+SVerticalBox::Slot().AutoHeight()[Label(TEXT("WILD DRIFT"),40,Gold)]+SVerticalBox::Slot().AutoHeight()[Label(TEXT("THE ASHEN COVENANT"),12,Muted)]]]
   +SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(35,120,0,195)[SNew(SBox).WidthOverride(315)[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Panel).Padding(20)[Heroes]]]
   +SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Top).Padding(0,120,35,195)[SNew(SBox).WidthOverride(325)[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Panel).Padding(20)[Courses]]]
   +SOverlay::Slot().VAlign(VAlign_Bottom).Padding(35,0,35,28)[SNew(SVerticalBox)+SVerticalBox::Slot().AutoHeight().Padding(0,0,0,10)[SNew(SHorizontalBox)+SHorizontalBox::Slot().FillWidth(1).VAlign(VAlign_Center)[Settings]+SHorizontalBox::Slot().AutoWidth()[SNew(SBox).WidthOverride(280).HeightOverride(52)[Button(TEXT("НАЧАТЬ ЗАЕЗД  →"),[this](){StartRace();},true)]]]+SVerticalBox::Slot().AutoHeight()[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Panel).Padding(12)[Bottom]]];
 }
 Menu=SNew(SScaleBox).Stretch(EStretch::ScaleToFit)[SNew(SBox).WidthOverride(1440).HeightOverride(900)[Menu.ToSharedRef()]];
 GEngine->GameViewport->AddViewportWidgetContent(Menu.ToSharedRef(),10);
}
void AWildDriftHUD::DrawHUD(){Super::DrawHUD();auto* G=Cast<AWildDriftGameMode>(GetWorld()->GetAuthGameMode());if(!G||!Canvas)return;if(!G->Error.IsEmpty()){DrawText(G->Error,FLinearColor::Red,30,50,GEngine->GetMediumFont(),1.2);return;}TargetVisible=false;if(!G->Racing)return;if(!NativeFont){NativeFont=NewObject<UFont>(this);NativeFont->FontCacheType=EFontCacheType::Runtime;}auto DrawText=[&](const FString& V,FLinearColor C,float X,float Y,UFont* Legacy,float Scale=1.f,bool Center=false){int Size=FMath::RoundToInt((Legacy==GEngine->GetLargeFont()?22:Legacy==GEngine->GetSmallFont()?12:16)*Scale);FCanvasTextItem Item(FVector2D(X,Y),T(V),Font(FMath::RoundToInt(Size*.75)),C);Item.Font=NativeFont;Item.bCentreX=Center;Canvas->DrawItem(Item);};const float SX=Canvas->ClipX,SY=Canvas->ClipY,S=FMath::Clamp(SX/1440.f,.65f,1.5f);const auto& R=G->Race.racers[0];auto Text=[&](const FString& V,float X,float Y,float Size,FLinearColor C=FLinearColor::White){DrawText(V,C,X*S,Y*S,GEngine->GetMediumFont(),Size*S);};
 DrawRect(FLinearColor(.015,.024,.04,.85),24*S,24*S,255*S,115*S);Text(FString::Printf(TEXT("%d / %d"),G->Race.rank,int(G->Race.racers.size())),42,35,2.8,Gold);Text(FString::Printf(TEXT("КРУГ %d / %d"),FMath::Clamp(int(R.d/G->Tracks[G->Course].total)+1,1,G->Race.lapCount),G->Race.lapCount),42,87,1.1);Text(FString::Printf(TEXT("%02d:%05.2f"),int(G->Race.time)/60,FMath::Fmod(G->Race.time,60)),150,89,.95);
 const float BX=SX-280*S,BY=SY-145*S;DrawRect(FLinearColor(.015,.024,.04,.85),BX,BY,255*S,120*S);DrawText(FString::Printf(TEXT("%03d"),int(R.speed*3.6)),FLinearColor::White,BX+20*S,BY+12*S,GEngine->GetLargeFont(),2.8*S);DrawText(TEXT("км/ч"),Muted,BX+174*S,BY+53*S,GEngine->GetMediumFont(),S);DrawRect(FLinearColor(.12,.15,.2),BX+20*S,BY+95*S,215*S,5*S);DrawRect(R.drift>1.7?FLinearColor(.7,.2,1):Gold,BX+20*S,BY+95*S,215*S*R.drift/2.5,5*S);
 const TCHAR* Items[]={TEXT("НЕТ БОНУСА"),TEXT("СФЕРА ДУШ"),TEXT("ПЕПЕЛЬНАЯ БОМБА"),TEXT("ЭФИРНОЕ ПЛАМЯ"),TEXT("РУННЫЙ ЩИТ")};
 const FLinearColor ItemColors[]={Muted,FLinearColor(.55,.72,1),FLinearColor(1,.4,.22),FLinearColor(1,.7,.25),FLinearColor(.35,.92,.7)};
 const float IX=24*S,IY=SY-144*S;const int Item=int(R.item);const auto Accent=ItemColors[Item];
 DrawRect(FLinearColor(.015,.024,.04,.94),IX,IY,370*S,119*S);DrawRect(Accent,IX,IY,4*S,119*S);
 DrawText(TEXT("БОНУС"),Muted,IX+20*S,IY+13*S,GEngine->GetMediumFont(),S);
 DrawText(Items[Item],Accent,IX+20*S,IY+38*S,GEngine->GetMediumFont(),1.75*S);
 if(Item>0){DrawRect(FLinearColor(.18,.22,.28),IX+276*S,IY+12*S,75*S,26*S);DrawText(TEXT("SHIFT"),FLinearColor::White,IX+286*S,IY+16*S,GEngine->GetMediumFont(),S);}
 FString Active;if(R.shield>0)Active+=FString::Printf(TEXT("ЩИТ %.1f с"),R.shield);if(R.boost>0)Active+=(Active.IsEmpty()?TEXT(""):TEXT("   ·   "))+FString::Printf(TEXT("ТУРБО %.1f с"),R.boost);
 if(!Active.IsEmpty())DrawText(Active,Gold,IX+20*S,IY+83*S,GEngine->GetMediumFont(),1.15*S);
 if(G->Countdown>0){FString V=FString::FromInt(FMath::CeilToInt(G->Countdown));DrawText(V,Gold,SX*.5-25*S,SY*.35,GEngine->GetLargeFont(),5*S);}
 const bool Throwable=R.item==drift::Item::Soul||R.item==drift::Item::Bomb;
 if(Throwable&&!G->Paused&&!GetOwningPlayerController()->IsInputKeyDown(EKeys::C)){
  const int Target=G->Race.aim();FVector2D Screen(SX*.5,SY*.44);bool Locked=false;
  if(Target>=0&&G->Karts.IsValidIndex(Target)&&G->Karts[Target]){
   FVector2D Projected;if(GetOwningPlayerController()->ProjectWorldLocationToScreen(G->Karts[Target]->GetActorLocation()+FVector(0,0,105),Projected,true)){
    Screen=Projected;Locked=Screen.X>45*S&&Screen.X<SX-45*S&&Screen.Y>45*S&&Screen.Y<SY-45*S;
   }
  }
  if(Locked){TargetVisible=true;const FLinearColor Ink(.32,1,.7);const float D=42*S,Arm=15*S;
  for(int X:{-1,1})for(int Y:{-1,1}){
   DrawLine(Screen.X+X*D,Screen.Y+Y*D,Screen.X+X*(D-Arm),Screen.Y+Y*D,FLinearColor(.015,.02,.025,.8),5*S);
   DrawLine(Screen.X+X*D,Screen.Y+Y*D,Screen.X+X*D,Screen.Y+Y*(D-Arm),FLinearColor(.015,.02,.025,.8),5*S);
   DrawLine(Screen.X+X*D,Screen.Y+Y*D,Screen.X+X*(D-Arm),Screen.Y+Y*D,Ink,2.5*S);
   DrawLine(Screen.X+X*D,Screen.Y+Y*D,Screen.X+X*D,Screen.Y+Y*(D-Arm),Ink,2.5*S);
  }
  DrawLine(Screen.X-6*S,Screen.Y,Screen.X+6*S,Screen.Y,Ink,1.5*S);DrawLine(Screen.X,Screen.Y-6*S,Screen.X,Screen.Y+6*S,Ink,1.5*S);
  const FString Caption=G->DriverField(G->Race.racers[Target].hero,TEXT("name"))+TEXT("  ·  70%");
  DrawRect(FLinearColor(.015,.024,.04,.88),Screen.X-117*S,Screen.Y-D-29*S,234*S,24*S);
  DrawText(Caption,Ink,Screen.X,Screen.Y-D-24*S,GEngine->GetSmallFont(),1.15*S,true);
  }
 }
 // A route preview comes from the exact simulation centreline, including the overpasses.
 auto& Track=G->Tracks[G->Course];double MinX=1e9,MaxX=-1e9,MinZ=1e9,MaxZ=-1e9;for(const auto& P:Track.points){MinX=FMath::Min(MinX,P.x);MaxX=FMath::Max(MaxX,P.x);MinZ=FMath::Min(MinZ,P.z);MaxZ=FMath::Max(MaxZ,P.z);}double Scale=180*S/FMath::Max(MaxX-MinX,MaxZ-MinZ);auto Map=[&](const drift::Point& P){return FVector2D(SX-220*S+(P.x-MinX)*Scale,35*S+(P.z-MinZ)*Scale);};for(int I=0;I<int(Track.points.size());I+=6){auto A=Map(Track.points[I]),B=Map(Track.points[(I+6)%Track.points.size()]);DrawLine(A.X,A.Y,B.X,B.Y,FLinearColor(.55,.62,.7,.65),2*S);}for(int I=int(G->Race.racers.size())-1;I>=0;I--){auto P=Map(G->Race.racers[I]);DrawRect(I==0?Gold:FLinearColor(.65,.72,.8),P.X-3*S,P.Y-3*S,6*S,6*S);}
}
