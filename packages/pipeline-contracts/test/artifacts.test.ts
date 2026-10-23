import assert from "node:assert/strict";
import test from "node:test";
import {
  assertArtifactHeader,
  invalidatesAfter,
  type AnimationPlanArtifact,
  type BodyPlanAssessmentArtifact,
  type BuildManifestArtifact,
  type ClassificationArtifact,
  type InputAssessmentArtifact,
  type ModelPlanArtifact,
  type ModelTypeRecommendationArtifact,
  type ObservedFeaturesArtifact,
  type ReferenceSetArtifact,
  type RigPlanArtifact,
  type StyleDnaArtifact,
  type SubjectIsolationArtifact,
} from "../src/artifacts";

const base = {
  schemaVersion: "1.0.0" as const,
  jobId: "job-gold-standard-front",
  createdAt: "2026-07-24T00:00:00.000Z",
  producer: { id: "fixture-planner", version: "1.0.0" },
};

const references: ReferenceSetArtifact = {
  ...base,
  kind: "reference-set",
  artifactId: "reference-set-1",
  userDescription: "A compact smiling character.",
  references: [{
    id: "front-reference",
    slot: "front",
    uri: "docs/reference/gold-standard-humanoid-chibi.png",
    sha256: "synthetic-fixture-hash",
    mediaType: "image/png",
  }],
};

const inputAssessment: InputAssessmentArtifact = {
  ...base,
  kind: "input-assessment",
  artifactId: "input-assessment-1",
  referenceId: "front-reference",
  usability: { value: "usable", origin: "measured", confidence: 0.9, confirmed: false },
  subjectVisibility: { value: 0.74, origin: "measured", confidence: 0.92, confirmed: false },
  backgroundSeparation: { value: 82, origin: "measured", confidence: 0.86, confirmed: false },
  needsMoreViews: { value: false, origin: "inferred", confidence: 0.65, confirmed: false },
  rubric: [{ criterionId: "input.subject-visibility", level: 3, confidence: 0.92 }],
};

const subjectIsolation: SubjectIsolationArtifact = {
  ...base,
  kind: "subject-isolation",
  artifactId: "subject-isolation-1",
  referenceId: "front-reference",
  bounds: { value: { left: 0.1, top: 0.1, right: 0.9, bottom: 0.95 }, origin: "measured", confidence: 0.9, confirmed: false },
  center: { value: { x: 0.5, y: 0.53 }, origin: "measured", confidence: 0.95, confirmed: false },
  coverage: { value: 0.61, origin: "measured", confidence: 0.9, confirmed: false },
  silhouette: { value: "clear", origin: "inferred", confidence: 0.86, confirmed: false },
  rubric: [{ criterionId: "subject.silhouette", level: 3, confidence: 0.86 }],
};

const bodyPlan: BodyPlanAssessmentArtifact = {
  ...base,
  kind: "body-plan-assessment",
  artifactId: "body-plan-1",
  referenceId: "front-reference",
  hypotheses: [
    { bodyPlanId: "compact/blob-amorphous", confidence: 0.82, rubricLevel: 3, sourceArtifactIds: [subjectIsolation.artifactId] },
    { bodyPlanId: "articulated/humanoid-bipedal", confidence: 0.22, rubricLevel: 1, sourceArtifactIds: [subjectIsolation.artifactId] },
  ],
  selected: { value: "compact/blob-amorphous", origin: "inferred", confidence: 0.82, confirmed: false, sourceArtifactIds: [subjectIsolation.artifactId] },
  rubric: [{ criterionId: "morphology.body-plan", level: 3, confidence: 0.82 }],
};

const observedFeatures: ObservedFeaturesArtifact = {
  ...base,
  kind: "observed-features",
  artifactId: "observed-features-1",
  referenceId: "front-reference",
  features: [
    { featureId: "body-core", state: "observed", count: { value: 1, origin: "measured", confidence: 0.95, confirmed: false } },
    { featureId: "eye", state: "observed", count: { value: 2, origin: "inferred", confidence: 0.8, confirmed: false } },
  ],
  rubric: [{ criterionId: "features.visible", level: 3, confidence: 0.8 }],
};

const modelTypeRecommendation: ModelTypeRecommendationArtifact = {
  ...base,
  kind: "model-type-recommendation",
  artifactId: "model-type-recommendation-1",
  outcome: "unsupported",
  selected: { value: null, origin: "unavailable", confidence: null, confirmed: false, sourceArtifactIds: [bodyPlan.artifactId] },
  candidates: [],
  bodyPlanArtifactId: bodyPlan.artifactId,
  observedFeaturesArtifactId: observedFeatures.artifactId,
  functionalHypothesesArtifactId: "functional-hypotheses-1",
  userDescription: { value: references.userDescription ?? null, origin: "user-provided", confidence: null, confirmed: false, sourceArtifactIds: [references.artifactId] },
  rubric: [{ criterionId: "model-fit.visual-evidence", level: 1, confidence: 0.3 }],
};

const classification: ClassificationArtifact = {
  ...base,
  kind: "classification",
  artifactId: "classification-1",
  recommendation: {
    value: "humanoid/chibi-v1",
    origin: "user-confirmed",
    confidence: 0.98,
    confirmed: true,
    sourceArtifactIds: [references.artifactId],
  },
  alternatives: [],
  confirmationState: "confirmed",
};

const styleDna: StyleDnaArtifact = {
  ...base,
  kind: "style-dna",
  artifactId: "style-dna-1",
  modelTypeId: "humanoid/chibi-v1",
  modelTypeVersion: "1.0.0",
  values: {
    headsTall: { value: 2.7, origin: "measured", confidence: 0.9, confirmed: false },
    shoulderWidth: { value: "narrow", origin: "inferred", confidence: 0.8, confirmed: false },
  },
};

const modelPlan: ModelPlanArtifact = {
  ...base,
  kind: "model-plan",
  artifactId: "model-plan-1",
  modelTypeId: "humanoid/chibi-v1",
  implementationId: "humanoid-chibi-generator-v1",
  styleDnaArtifactId: styleDna.artifactId,
  expectedParts: ["body", "head", "hair", "shirt", "briefs"],
  generationSettings: { deterministicSeed: 1 },
};

const rigPlan: RigPlanArtifact = {
  ...base,
  kind: "rig-plan",
  artifactId: "rig-plan-1",
  rigId: "humanoid-basic-v1",
  implementationId: "humanoid-basic-rig-v1",
  modelPlanArtifactId: modelPlan.artifactId,
  requiredJoints: ["root", "hips", "spine", "head", "upper_arm.L", "upper_arm.R"],
};

const animationPlan: AnimationPlanArtifact = {
  ...base,
  kind: "animation-plan",
  artifactId: "animation-plan-1",
  packId: "humanoid-basic-v1/default-v1",
  implementationId: "humanoid-animation-pack-v1",
  rigPlanArtifactId: rigPlan.artifactId,
  requestedClips: ["a-pose", "idle", "walk", "wave"],
  frameRate: 24,
  rootMotion: "in-place",
};

const manifest: BuildManifestArtifact = {
  ...base,
  kind: "build-manifest",
  artifactId: "build-manifest-1",
  pipelineVersion: "1.0.0",
  modelType: { id: "humanoid/chibi-v1", version: "1.0.0" },
  requestedClips: animationPlan.requestedClips,
  artifacts: {
    "reference-set": references.artifactId,
    "input-assessment": inputAssessment.artifactId,
    "subject-isolation": subjectIsolation.artifactId,
    "body-plan-assessment": bodyPlan.artifactId,
    "observed-features": observedFeatures.artifactId,
    "model-type-recommendation": modelTypeRecommendation.artifactId,
    classification: classification.artifactId,
    "style-dna": styleDna.artifactId,
    "model-plan": modelPlan.artifactId,
    "rig-plan": rigPlan.artifactId,
    "animation-plan": animationPlan.artifactId,
  },
  stages: [],
  outputs: [],
  validationReportIds: [],
};

test("modular assessment artifacts coexist with versioned model, rig, and animation plans", () => {
  for (const artifact of [references, inputAssessment, subjectIsolation, bodyPlan, observedFeatures, modelTypeRecommendation, classification, styleDna, modelPlan, rigPlan, animationPlan, manifest]) {
    assert.doesNotThrow(() => assertArtifactHeader(artifact));
    assert.equal(artifact.jobId, manifest.jobId);
  }
  assert.equal(bodyPlan.selected.value, "compact/blob-amorphous");
  assert.equal(modelTypeRecommendation.selected.value, null);
  assert.equal(classification.recommendation.value, "humanoid/chibi-v1");
  assert.equal(manifest.artifacts["body-plan-assessment"], bodyPlan.artifactId);
});

test("rubric level and machine confidence remain separate concepts", () => {
  assert.equal(bodyPlan.hypotheses[0]?.rubricLevel, 3);
  assert.equal(bodyPlan.hypotheses[0]?.confidence, 0.82);
  assert.notEqual(bodyPlan.hypotheses[0]?.rubricLevel, bodyPlan.hypotheses[0]?.confidence);
});

test("user-provided direction has explicit provenance", () => {
  assert.equal(modelTypeRecommendation.userDescription?.origin, "user-provided");
  assert.equal(modelTypeRecommendation.userDescription?.confirmed, false);
});

test("upstream assessment changes invalidate only affected downstream stages", () => {
  assert.ok(invalidatesAfter.ingest.includes("assess-input"));
  assert.ok(invalidatesAfter["assess-orientation"].includes("recommend-model-type"));
  assert.ok(invalidatesAfter["assess-orientation"].includes("export"));
  assert.equal(invalidatesAfter["assess-orientation"].includes("ingest"), false);
  assert.equal(invalidatesAfter["assess-orientation"].includes("isolate-subject"), false);
  assert.ok(invalidatesAfter["derive-style-dna"].includes("model"));
  assert.deepEqual(invalidatesAfter.export, []);
});
