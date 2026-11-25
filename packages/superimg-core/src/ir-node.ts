//! Node-only Media IR artifact IO.

export {
  compileMediaArtifact,
  compileMediaArtifactFromBundle,
  readMediaArtifact,
  loadArtifactProgram,
  templateFromArtifact,
  artifactAudioKey,
  assertIrMatchesRuntime,
  type CompileMediaArtifactOptions,
} from "./ir/artifact.js";
