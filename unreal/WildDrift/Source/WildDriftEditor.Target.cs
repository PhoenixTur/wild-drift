using UnrealBuildTool;
public class WildDriftEditorTarget : TargetRules {
 public WildDriftEditorTarget(TargetInfo Target) : base(Target) { Type=TargetType.Editor; DefaultBuildSettings=BuildSettingsVersion.V7; IncludeOrderVersion=EngineIncludeOrderVersion.Unreal5_8; ExtraModuleNames.Add("WildDrift"); }
}
