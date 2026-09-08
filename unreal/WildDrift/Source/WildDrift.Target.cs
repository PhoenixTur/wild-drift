using UnrealBuildTool;
public class WildDriftTarget : TargetRules {
 public WildDriftTarget(TargetInfo Target) : base(Target) { Type=TargetType.Game; DefaultBuildSettings=BuildSettingsVersion.V7; IncludeOrderVersion=EngineIncludeOrderVersion.Unreal5_8; ExtraModuleNames.Add("WildDrift"); }
}
