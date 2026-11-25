# Keep SuperImg DisplayList & Artifact Serialization Models
-keepattributes *Annotation*,InnerClasses
-keepclassmembers class dev.superimg.** {
    @kotlinx.serialization.* <fields>;
}
-keep,includedescriptorclasses class dev.superimg.DisplayListFrame** { *; }
-keep,includedescriptorclasses class dev.superimg.DisplayOp** { *; }
-keep,includedescriptorclasses class dev.superimg.DisplayPaint** { *; }
-keep,includedescriptorclasses class dev.superimg.ArtifactManifest** { *; }
-keep,includedescriptorclasses class dev.superimg.MediaIrDocument** { *; }
-keep,includedescriptorclasses class dev.superimg.MediaJob** { *; }
