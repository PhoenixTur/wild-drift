using UnrealBuildTool;
public class WildDrift : ModuleRules {
 public WildDrift(ReadOnlyTargetRules Target) : base(Target) {
  PCHUsage=PCHUsageMode.UseExplicitOrSharedPCHs;
  PublicDependencyModuleNames.AddRange(new[]{"Core","CoreUObject","Engine","InputCore", "ApplicationCore","ProceduralMeshComponent","Json","JsonUtilities","Slate","SlateCore","ImageWrapper","RenderCore","RHI"});
 }
}
