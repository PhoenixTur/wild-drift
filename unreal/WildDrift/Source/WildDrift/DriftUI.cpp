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
  auto Home=SNew(SVerticalBox);
  Home->AddSlot().AutoHeight().Padding(0,0,0,22)[Label(TEXT("ПОДГОТОВКА К ЗАЕЗДУ"),12,Gold)];
  const TCHAR* Pages[]={TEXT(""),TEXT("Выбор персонажа"),TEXT("Выбор трассы"),TEXT("Кузница · кузова"),TEXT("Улучшения автомобиля"),TEXT("Параметры заезда")};
  for(int I=1;I<=5;I++)Home->AddSlot().AutoHeight().Padding(0,5)[Button(Pages[I],[this,I](){MenuPage=I;ShowMenu();})];
  Home->AddSlot().AutoHeight().Padding(0,30,0,5)[Label(DriverField(Hero,TEXT("name"))+TEXT("  ·  ")+DriverField(Hero,TEXT("kind")),18,Gold)];
  Home->AddSlot().AutoHeight()[Label(DriverField(Hero,TEXT("trait")),14,Muted)];
  Home->AddSlot().AutoHeight().Padding(0,14,0,5)[Label(CourseField(Course,TEXT("name")),18)];
  Home->AddSlot().AutoHeight()[Label(FString::Printf(TEXT("%d круг.   ·   %d соперн."),Laps,Opponents),14,Muted)];
  auto Overlay=SNew(SOverlay)
   +SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(48,35)[SNew(SVerticalBox)+SVerticalBox::Slot().AutoHeight()[Label(TEXT("WILD DRIFT"),44,Gold)]+SVerticalBox::Slot().AutoHeight()[Label(TEXT("THE ASHEN COVENANT"),12,Muted)]]
   +SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Center).Padding(48,0)[SNew(SBox).WidthOverride(338)[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(FLinearColor(.012,.018,.026,.82)).Padding(20)[Home]]]
   +SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Bottom).Padding(0,0,48,100)[SNew(SBox).WidthOverride(300).HeightOverride(58)[Button(TEXT("НАЧАТЬ ЗАЕЗД  →"),[this](){MenuPage=0;StartRace();},true)]]
   +SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Bottom).Padding(30,0,30,22)[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(FLinearColor(.012,.018,.026,.85)).Padding(FMargin(18,10))[Label(TEXT("WASD / стрелки — руль и газ   ·   Пробел — дрифт   ·   Shift — предмет   ·   C — вид назад   ·   R — возврат   ·   Esc — пауза   ·   M — звук"),13,FLinearColor(.7,.75,.8))]];
  if(MenuPage>0){
   auto Content=SNew(SVerticalBox);Content->AddSlot().AutoHeight().Padding(0,0,0,20)[Label(Pages[MenuPage],26,Gold)];
   if(MenuPage==1){
    Content->AddSlot().AutoHeight().Padding(0,0,0,8)[Label(TEXT("Выбери свою клятву"),13,Muted)];
    for(int I=0;I<8;I++)Content->AddSlot().AutoHeight().Padding(0,3)[Button(DriverField(I,TEXT("name"))+TEXT("  ·  ")+DriverField(I,TEXT("kind")),[this,I](){Hero=I;CreateKarts();ShowMenu();},Hero==I)];
    Content->AddSlot().AutoHeight().Padding(0,16,0,6)[Label(DriverField(Hero,TEXT("trait")),18,Gold)];Content->AddSlot().AutoHeight()[Label(DriverField(Hero,TEXT("description")),14,Muted)];
   }else if(MenuPage==2){
    Content->AddSlot().AutoHeight().Padding(0,0,0,8)[Label(TEXT("Земли за пределами света"),13,Muted)];
    for(int I=0;I<5;I++)Content->AddSlot().AutoHeight().Padding(0,5)[Button(CourseField(I,TEXT("name"))+FString::Printf(TEXT("   ·   %.2f км\n"),Tracks[I].total/1000)+CourseField(I,TEXT("subtitle")),[this,I](){Course=I;LoadCourse();ShowMenu();},Course==I)];
   }else if(MenuPage==3){
    Content->AddSlot().AutoHeight().Padding(0,0,0,16)[Label(FString::Printf(TEXT("%s   ·   %d душ"),*DriverField(Hero,TEXT("name")),Profile.points),16,Muted)];
    for(int I=0;I<3;I++){auto J=Catalog->GetArrayField(TEXT("skins"))[I]->AsObject();FString Caption=J->GetStringField(TEXT("name"));Caption+=Profile.heroes[Hero].skins[I]?TEXT("   ·   В коллекции"):FString::Printf(TEXT("   ·   %d душ"),J->GetIntegerField(TEXT("price")));auto B=Button(Caption,[this,I](){if(Profile.chooseSkin(Hero,I)){SaveProfile();CreateKarts();ShowMenu();}},Profile.heroes[Hero].skin==I);B->SetEnabled(Profile.heroes[Hero].skins[I]||Profile.points>=J->GetIntegerField(TEXT("price")));Content->AddSlot().AutoHeight().Padding(0,8)[B];}
   }else if(MenuPage==4){
    Content->AddSlot().AutoHeight().Padding(0,0,0,16)[Label(FString::Printf(TEXT("%s   ·   Уровень %d   ·   Очки развития: %d"),*DriverField(Hero,TEXT("name")),1+Profile.heroes[Hero].xp/150,Profile.skillPoints(Hero)),16,Muted)];
    const TCHAR* Names[]={TEXT("Скорость"),TEXT("Управление"),TEXT("Разгон"),TEXT("Торможение"),TEXT("Аэродинамика")};
    for(int I=0;I<5;I++){auto B=Button(FString::Printf(TEXT("%s     %d / 5     +"),Names[I],Profile.heroes[Hero].upgrades[I]),[this,I](){if(Profile.upgrade(Hero,I)){SaveProfile();CreateKarts();ShowMenu();}});B->SetEnabled(Profile.skillPoints(Hero)>0&&Profile.heroes[Hero].upgrades[I]<5);Content->AddSlot().AutoHeight().Padding(0,6)[B];}
   }else if(MenuPage==5){
    auto Counter=[&](const FString& Caption,int Value,int Min,int Max,TFunction<void(int)> Change){auto V=Label(FString::Printf(TEXT("%s: %d"),*Caption,Value),20);V->SetAutoWrapText(false);auto Row=SNew(SHorizontalBox);auto Minus=Button(TEXT("−"),[=](){Change(Value-1);}),Plus=Button(TEXT("+"),[=](){Change(Value+1);});Minus->SetEnabled(Value>Min);Plus->SetEnabled(Value<Max);Row->AddSlot().AutoWidth()[Minus];Row->AddSlot().FillWidth(1).HAlign(HAlign_Center).VAlign(VAlign_Center)[V];Row->AddSlot().AutoWidth()[Plus];return Row;};
    Content->AddSlot().AutoHeight().Padding(0,10)[Counter(TEXT("Круги"),Laps,1,10,[this](int V){Laps=FMath::Clamp(V,1,10);ShowMenu();})];
    Content->AddSlot().AutoHeight().Padding(0,10)[Counter(TEXT("Соперники"),Opponents,0,drift::heroCount,[this](int V){Opponents=FMath::Clamp(V,0,drift::heroCount);ShowMenu();})];
   }
   Content->AddSlot().AutoHeight().Padding(0,22,0,0)[Button(TEXT("Готово  ·  Esc"),[this](){MenuPage=0;ShowMenu();},true)];
   Overlay->AddSlot()[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(FLinearColor(0,0,0,.6))];
   Overlay->AddSlot().HAlign(HAlign_Center).VAlign(VAlign_Center)[SNew(SBox).WidthOverride(580)[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(Panel).Padding(32)[Content]]];
  }
  Menu=Overlay;
 }
 Menu=SNew(SScaleBox).Stretch(EStretch::ScaleToFit)[SNew(SBox).WidthOverride(1440).HeightOverride(900)[Menu.ToSharedRef()]];
 GEngine->GameViewport->AddViewportWidgetContent(Menu.ToSharedRef(),10);
}
void AWildDriftHUD::DrawHUD(){Super::DrawHUD();auto* G=Cast<AWildDriftGameMode>(GetWorld()->GetAuthGameMode());if(!G||!Canvas)return;if(!G->Error.IsEmpty()){DrawText(G->Error,FLinearColor::Red,30,50,GEngine->GetMediumFont(),1.2);return;}TargetVisible=false;if(!G->Racing)return;if(!NativeFont){NativeFont=NewObject<UFont>(this);NativeFont->FontCacheType=EFontCacheType::Runtime;}auto DrawText=[&](const FString& V,FLinearColor C,float X,float Y,UFont* Legacy,float Scale=1.f,bool Center=false){int Size=FMath::RoundToInt((Legacy==GEngine->GetLargeFont()?22:Legacy==GEngine->GetSmallFont()?12:16)*Scale);FCanvasTextItem Item(FVector2D(X,Y),T(V),Font(FMath::RoundToInt(Size*.75)),C);Item.Font=NativeFont;Item.bCentreX=Center;Canvas->DrawItem(Item);return Item.DrawnSize;};const float SX=Canvas->ClipX,SY=Canvas->ClipY,S=FMath::Clamp(SX/1440.f,.65f,1.5f);const auto& R=G->Race.racers[0];auto Text=[&](const FString& V,float X,float Y,float Size,FLinearColor C=FLinearColor::White){DrawText(V,C,X*S,Y*S,GEngine->GetMediumFont(),Size*S);};
 DrawRect(FLinearColor(.015,.024,.04,.85),24*S,24*S,255*S,115*S);Text(FString::Printf(TEXT("%d / %d"),G->Race.rank,int(G->Race.racers.size())),42,35,2.8,Gold);Text(FString::Printf(TEXT("КРУГ %d / %d"),FMath::Clamp(int(R.d/G->Tracks[G->Course].total)+1,1,G->Race.lapCount),G->Race.lapCount),42,87,1.1);Text(FString::Printf(TEXT("%02d:%05.2f"),int(G->Race.time)/60,FMath::Fmod(G->Race.time,60)),150,89,.95);
 const float BX=SX-235*S,BY=SY-105*S;
 const FVector2D SpeedSize=DrawText(FString::FromInt(int(R.speed*3.6)),FLinearColor::White,BX,BY,GEngine->GetLargeFont(),2.8*S);
 DrawText(TEXT("км/ч"),Muted,BX+SpeedSize.X+10*S,BY+SpeedSize.Y-16*S,GEngine->GetMediumFont(),S);
 const TCHAR* Items[]={TEXT(""),TEXT("Сфера душ"),TEXT("Пепельная бомба"),TEXT("Эфирное пламя"),TEXT("Рунный щит")};
 const int Held=int(R.item),Item=Held?Held:R.shield>0?4:R.boost>0?3:0;
 if(Item>0){
  const float X=SX-126*S,Y=FMath::Lerp(235*S,BY,.52f);
  if(G->ItemIcons.IsValidIndex(Item-1)&&G->ItemIcons[Item-1])DrawTexture(G->ItemIcons[Item-1],X-42*S,Y-65*S,84*S,84*S,0,0,1,1);
  DrawText(Items[Item],Gold,X,Y+24*S,GEngine->GetMediumFont(),1.2*S,true);
 }
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

  }
 }
 // A route preview comes from the exact simulation centreline, including the overpasses.
 auto& Track=G->Tracks[G->Course];double MinX=1e9,MaxX=-1e9,MinZ=1e9,MaxZ=-1e9;for(const auto& P:Track.points){MinX=FMath::Min(MinX,P.x);MaxX=FMath::Max(MaxX,P.x);MinZ=FMath::Min(MinZ,P.z);MaxZ=FMath::Max(MaxZ,P.z);}double Scale=180*S/FMath::Max(MaxX-MinX,MaxZ-MinZ);auto Map=[&](const drift::Point& P){return FVector2D(SX-220*S+(P.x-MinX)*Scale,35*S+(P.z-MinZ)*Scale);};for(int I=0;I<int(Track.points.size());I+=6){auto A=Map(Track.points[I]),B=Map(Track.points[(I+6)%Track.points.size()]);DrawLine(A.X,A.Y,B.X,B.Y,FLinearColor(.55,.62,.7,.65),2*S);}for(int I=int(G->Race.racers.size())-1;I>=0;I--){auto P=Map(G->Race.racers[I]);DrawRect(I==0?Gold:FLinearColor(.65,.72,.8),P.X-3*S,P.Y-3*S,6*S,6*S);}
}
