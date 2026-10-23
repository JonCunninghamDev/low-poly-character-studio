export type ArtifactKind =
  | "reference-set"
  | "input-assessment"
  | "subject-isolation"
  | "orientation-assessment"
  | "body-plan-assessment"
  | "observed-features"
  | "functional-hypotheses"
  | "model-type-recommendation"
  | "classification"
  | "view-analysis"
  | "expected-part-observations"
  | "semantic-part-graph"
  | "style-dna"
  | "model-plan"
  | "rig-plan"
  | "animation-plan"
  | "build-manifest"
  | "validation-report";

export type EvidenceOrigin =
  | "measured"
  | "inferred"
  | "mirrored"
  | "defaulted"
  | "user-provided"
  | "user-confirmed"
  | "user-overridden"
  | "unavailable";

export type RubricLevel = 0 | 1 | 2 | 3 | 4;

export interface RubricCriterionResult {
  criterionId: string;
  level: RubricLevel;
  confidence: number | null;
  sourceArtifactIds?: readonly string[];
  note?: string;
}

export interface ArtifactHeader<K extends ArtifactKind = ArtifactKind> {
  kind: K;
  schemaVersion: "1.0.0";
  artifactId: string;
  jobId: string;
  createdAt: string;
  producer: { id: string; version: string };
}

export interface Evidence<T> {
  value: T | null;
  origin: EvidenceOrigin;
  confidence: number | null;
  confirmed: boolean;
  sourceArtifactIds?: readonly string[];
  note?: string;
}

export interface ReferenceRecord {
  id: string;
  slot: string;
  uri: string;
  sha256: string;
  mediaType: string;
  width?: number;
  height?: number;
}

export interface ReferenceSetArtifact extends ArtifactHeader<"reference-set"> {
  modelTypeHint?: string;
  userDescription?: string;
  references: readonly ReferenceRecord[];
}

export interface InputAssessmentArtifact extends ArtifactHeader<"input-assessment"> {
  referenceId: string;
  usability: Evidence<"usable" | "limited" | "unusable">;
  subjectVisibility: Evidence<number>;
  backgroundSeparation: Evidence<number>;
  needsMoreViews: Evidence<boolean>;
  rubric: readonly RubricCriterionResult[];
}

export interface NormalizedBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface SubjectIsolationArtifact extends ArtifactHeader<"subject-isolation"> {
  referenceId: string;
  bounds: Evidence<NormalizedBounds>;
  center: Evidence<NormalizedPoint>;
  coverage: Evidence<number>;
  silhouette: Evidence<"clear" | "partial" | "ambiguous" | "unavailable">;
  rubric: readonly RubricCriterionResult[];
}

export interface OrientationAssessmentArtifact extends ArtifactHeader<"orientation-assessment"> {
  referenceId: string;
  facing: Evidence<"front" | "side" | "back" | "unknown">;
  imageUp: Evidence<"up" | "down" | "unknown">;
  yawDegrees: Evidence<number>;
  pitchDegrees: Evidence<number>;
  rollDegrees: Evidence<number>;
  groundDirection: Evidence<"bottom" | "top" | "left" | "right" | "unknown">;
  rubric: readonly RubricCriterionResult[];
}

export type BodyPlanId =
  | "articulated/humanoid-bipedal"
  | "articulated/quadrupedal"
  | "articulated/multi-limbed"
  | "compact/blob-amorphous"
  | "compact/head-dominant"
  | "elongated/serpentine"
  | "radial/other"
  | "unknown";

export interface BodyPlanHypothesis {
  bodyPlanId: BodyPlanId;
  confidence: number;
  rubricLevel: RubricLevel;
  sourceArtifactIds?: readonly string[];
  note?: string;
}

export interface BodyPlanAssessmentArtifact extends ArtifactHeader<"body-plan-assessment"> {
  referenceId: string;
  hypotheses: readonly BodyPlanHypothesis[];
  selected: Evidence<BodyPlanId>;
  rubric: readonly RubricCriterionResult[];
}

export type ObservedFeatureId =
  | "body-core"
  | "face"
  | "eye"
  | "mouth"
  | "head-region"
  | "limb"
  | "appendage"
  | "hand-grasper"
  | "foot-support"
  | "tail"
  | "wing"
  | "horn"
  | "clothing"
  | "other";

export type FeatureObservationState = "observed" | "inferred" | "absent" | "ambiguous" | "unavailable";

export interface ObservedFeature {
  featureId: ObservedFeatureId;
  state: FeatureObservationState;
  count: Evidence<number>;
  note?: string;
}

export interface ObservedFeaturesArtifact extends ArtifactHeader<"observed-features"> {
  referenceId: string;
  features: readonly ObservedFeature[];
  rubric: readonly RubricCriterionResult[];
}

export type FunctionalRoleHypothesis =
  | "root-core"
  | "support-contact"
  | "locomotor"
  | "manipulator"
  | "sensor-orientation"
  | "articulator"
  | "deformation-region";

export interface FunctionalHypothesis {
  role: FunctionalRoleHypothesis;
  featureIds: readonly ObservedFeatureId[];
  evidence: Evidence<string>;
}

export interface FunctionalHypothesesArtifact extends ArtifactHeader<"functional-hypotheses"> {
  referenceId: string;
  hypotheses: readonly FunctionalHypothesis[];
  rubric: readonly RubricCriterionResult[];
}

export interface ModelTypeCandidate {
  modelTypeId: string;
  confidence: number;
  evidenceSatisfied: readonly string[];
  evidenceContradicted: readonly string[];
  assumptionsRequired: readonly string[];
}

export interface ModelTypeRecommendationArtifact extends ArtifactHeader<"model-type-recommendation"> {
  outcome: "recommended" | "unresolved" | "unsupported";
  selected: Evidence<string>;
  candidates: readonly ModelTypeCandidate[];
  bodyPlanArtifactId: string;
  observedFeaturesArtifactId: string;
  functionalHypothesesArtifactId: string;
  userDescription?: Evidence<string>;
  rubric: readonly RubricCriterionResult[];
}

export interface ClassificationArtifact extends ArtifactHeader<"classification"> {
  recommendation: Evidence<string>;
  alternatives: readonly { modelTypeId: string; confidence: number }[];
  confirmationState: "pending" | "confirmed" | "overridden";
}

export interface ViewAnalysisArtifact extends ArtifactHeader<"view-analysis"> {
  referenceId: string;
  role: Evidence<"front" | "side" | "back" | "detail" | "unknown">;
  yawDegrees: Evidence<number>;
  pitchDegrees: Evidence<number>;
  pose: Evidence<string>;
  visibleSide: Evidence<"left" | "right" | "both" | "unknown">;
  groundLine: Evidence<number>;
  occlusions: readonly Evidence<string>[];
}

export type PartObservationState =
  | "observed"
  | "inferred"
  | "occluded"
  | "absent"
  | "unknown"
  | "unsupported";

export interface ExpectedPartObservation {
  partId: string;
  state: PartObservationState;
  evidence: Evidence<string>;
}

export interface ExpectedPartObservationsArtifact
  extends ArtifactHeader<"expected-part-observations"> {
  modelTypeId: string;
  observations: readonly ExpectedPartObservation[];
}

export interface SemanticPartNode {
  id: string;
  expectedPartId: string;
  label: string;
  parentId: string | null;
  attachmentRole: "root" | "attached" | "surface";
  deformationRole: "rigid" | "skinned" | "presentation";
  state: PartObservationState;
}

export interface SemanticPartGraphArtifact extends ArtifactHeader<"semantic-part-graph"> {
  modelTypeId: string;
  nodes: readonly SemanticPartNode[];
}

export interface StyleDnaArtifact extends ArtifactHeader<"style-dna"> {
  modelTypeId: string;
  modelTypeVersion: string;
  values: Readonly<Record<string, Evidence<unknown>>>;
}

export interface ModelPlanArtifact extends ArtifactHeader<"model-plan"> {
  modelTypeId: string;
  implementationId: string;
  styleDnaArtifactId: string;
  expectedParts: readonly string[];
  generationSettings: Readonly<Record<string, unknown>>;
}

export interface RigPlanArtifact extends ArtifactHeader<"rig-plan"> {
  rigId: string;
  implementationId: string;
  modelPlanArtifactId: string;
  requiredJoints: readonly string[];
}

export interface AnimationPlanArtifact extends ArtifactHeader<"animation-plan"> {
  packId: string;
  implementationId: string;
  rigPlanArtifactId: string;
  requestedClips: readonly string[];
  frameRate: number;
  rootMotion: "in-place" | "authored";
}

export type PipelineStage =
  | "ingest"
  | "assess-input"
  | "isolate-subject"
  | "assess-orientation"
  | "assess-body-plan"
  | "observe-features"
  | "infer-functions"
  | "recommend-model-type"
  | "map-model-parts"
  | "classify"
  | "analyze-view"
  | "observe-parts"
  | "build-part-graph"
  | "derive-style-dna"
  | "plan-model"
  | "plan-rig"
  | "plan-animation"
  | "model"
  | "rig"
  | "animate"
  | "validate"
  | "export";

export interface StageRecord {
  stage: PipelineStage;
  status: "pending" | "running" | "completed" | "failed" | "invalidated";
  inputArtifactIds: readonly string[];
  outputArtifactIds: readonly string[];
  error?: { code: string; message: string };
}

export interface BuildManifestArtifact extends ArtifactHeader<"build-manifest"> {
  pipelineVersion: string;
  modelType: { id: string; version: string };
  requestedClips: readonly string[];
  artifacts: Readonly<Partial<Record<ArtifactKind, string>>>;
  stages: readonly StageRecord[];
  outputs: readonly { kind: string; uri: string; sha256?: string }[];
  validationReportIds: readonly string[];
}

export interface ValidationFinding {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  artifactId?: string;
  path?: string;
}

export interface ValidationReportArtifact extends ArtifactHeader<"validation-report"> {
  targetArtifactId: string;
  validator: { id: string; version: string };
  passed: boolean;
  findings: readonly ValidationFinding[];
}

export type PipelineArtifact =
  | ReferenceSetArtifact
  | InputAssessmentArtifact
  | SubjectIsolationArtifact
  | OrientationAssessmentArtifact
  | BodyPlanAssessmentArtifact
  | ObservedFeaturesArtifact
  | FunctionalHypothesesArtifact
  | ModelTypeRecommendationArtifact
  | ClassificationArtifact
  | ViewAnalysisArtifact
  | ExpectedPartObservationsArtifact
  | SemanticPartGraphArtifact
  | StyleDnaArtifact
  | ModelPlanArtifact
  | RigPlanArtifact
  | AnimationPlanArtifact
  | BuildManifestArtifact
  | ValidationReportArtifact;

const allAfterAssessment = [
  "map-model-parts", "classify", "analyze-view", "observe-parts", "build-part-graph", "derive-style-dna",
  "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export",
] as const;

export const invalidatesAfter: Readonly<Record<PipelineStage, readonly PipelineStage[]>> = {
  ingest: ["assess-input", "isolate-subject", "assess-orientation", "assess-body-plan", "observe-features", "infer-functions", "recommend-model-type", ...allAfterAssessment],
  "assess-input": ["isolate-subject", "assess-orientation", "assess-body-plan", "observe-features", "infer-functions", "recommend-model-type", ...allAfterAssessment],
  "isolate-subject": ["assess-orientation", "assess-body-plan", "observe-features", "infer-functions", "recommend-model-type", ...allAfterAssessment],
  "assess-orientation": ["assess-body-plan", "observe-features", "infer-functions", "recommend-model-type", ...allAfterAssessment],
  "assess-body-plan": ["infer-functions", "recommend-model-type", ...allAfterAssessment],
  "observe-features": ["infer-functions", "recommend-model-type", ...allAfterAssessment],
  "infer-functions": ["recommend-model-type", ...allAfterAssessment],
  "recommend-model-type": [...allAfterAssessment],
  "map-model-parts": ["observe-parts", "build-part-graph", "derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  classify: ["observe-parts", "build-part-graph", "derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "analyze-view": ["observe-parts", "build-part-graph", "derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "observe-parts": ["build-part-graph", "derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "build-part-graph": ["derive-style-dna", "plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "derive-style-dna": ["plan-model", "plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "plan-model": ["plan-rig", "plan-animation", "model", "rig", "animate", "validate", "export"],
  "plan-rig": ["plan-animation", "rig", "animate", "validate", "export"],
  "plan-animation": ["animate", "validate", "export"],
  model: ["rig", "animate", "validate", "export"],
  rig: ["animate", "validate", "export"],
  animate: ["validate", "export"],
  validate: ["export"],
  export: [],
};

export function assertArtifactHeader(artifact: PipelineArtifact): void {
  if (artifact.schemaVersion !== "1.0.0") throw new Error(`Unsupported schema version: ${artifact.schemaVersion}`);
  if (!artifact.artifactId || !artifact.jobId) throw new Error("artifactId and jobId are required");
}
