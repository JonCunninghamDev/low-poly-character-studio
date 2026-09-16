import assert from "node:assert/strict";
import test from "node:test";
import type { ReferenceSetArtifact } from "../../pipeline-contracts/src/artifacts";
import {
  DeterministicReferenceAnalysisProvider,
  analyzeReferenceSet,
  type ReferenceAnalysisProvider,
} from "../src/index";

const referenceSet: ReferenceSetArtifact = {
  kind: "reference-set",
  schemaVersion: "1.0.0",
  artifactId: "reference-set-1",
  jobId: "semantic-analysis-fixture",
  createdAt: "2026-07-24T00:00:00.000Z",
  producer: { id: "test", version: "1.0.0" },
  references: [{
    id: "front-1",
    slot: "front",
    uri: "docs/reference/gold-standard-humanoid-chibi.png",
    sha256: "synthetic-hash",
    mediaType: "image/png",
    width: 1024,
    height: 1024,
  }],
};

const context = {
  jobId: referenceSet.jobId,
  createdAt: "2026-07-24T00:00:01.000Z",
};

test("front slot no longer forces a humanoid model type", () => {
  const result = analyzeReferenceSet(referenceSet, context);
  assert.equal(result.inputAssessment.kind, "input-assessment");
  assert.equal(result.subjectIsolation.kind, "subject-isolation");
  assert.equal(result.orientationAssessment.kind, "orientation-assessment");
  assert.equal(result.bodyPlanAssessment.kind, "body-plan-assessment");
  assert.equal(result.observedFeatures.kind, "observed-features");
  assert.equal(result.functionalHypotheses.kind, "functional-hypotheses");
  assert.equal(result.modelTypeRecommendation.kind, "model-type-recommendation");
  assert.equal(result.classification.recommendation.value, null);
  assert.equal(result.modelTypeRecommendation.outcome, "unresolved");
  assert.equal(result.orientationAssessment.facing.value, "front");
  assert.equal(result.orientationAssessment.facing.origin, "user-provided");
  assert.equal(result.expectedParts, undefined);
  assert.equal(result.partGraph, undefined);
  assert.equal(result.styleDna, undefined);
});

test("user description is preserved as a prior without becoming visual ground truth", () => {
  const blobReference: ReferenceSetArtifact = {
    ...referenceSet,
    artifactId: "reference-set-blob",
    userDescription: "A smiling blob creature with no arms or legs that moves by bouncing.",
  };
  const result = analyzeReferenceSet(blobReference, { ...context, jobId: "blob-fixture" });
  assert.equal(result.bodyPlanAssessment.selected.value, "compact/blob-amorphous");
  assert.equal(result.bodyPlanAssessment.selected.origin, "user-provided");
  assert.equal(result.bodyPlanAssessment.hypotheses[0]?.rubricLevel, 1);
  assert.equal(result.modelTypeRecommendation.outcome, "unsupported");
  assert.equal(result.classification.recommendation.value, null);
  assert.match(result.modelTypeRecommendation.userDescription?.note ?? "", /direction/i);
});

test("model-specific mapping waits for explicit confirmation", () => {
  const pending = analyzeReferenceSet(
    { ...referenceSet, modelTypeHint: "humanoid/chibi-v1" },
    context,
  );
  assert.equal(pending.classification.recommendation.value, "humanoid/chibi-v1");
  assert.equal(pending.classification.confirmationState, "pending");
  assert.equal(pending.expectedParts, undefined);

  const confirmed = analyzeReferenceSet(
    { ...referenceSet, modelTypeHint: "humanoid/chibi-v1" },
    context,
    new DeterministicReferenceAnalysisProvider({ modelTypeId: "humanoid/chibi-v1", state: "confirmed" }),
  );
  assert.equal(confirmed.classification.confirmationState, "confirmed");
  assert.equal(confirmed.classification.recommendation.origin, "user-confirmed");
  assert.ok(confirmed.expectedParts);
  assert.ok(confirmed.partGraph);
  assert.ok(confirmed.styleDna);
  assert.ok(confirmed.expectedParts?.observations.every((part) => part.state === "unknown"));
});

test("user override remains explicit provenance and does not rewrite raw generic assessment", () => {
  const blobReference: ReferenceSetArtifact = {
    ...referenceSet,
    artifactId: "reference-set-blob-override",
    userDescription: "A blob with a face.",
  };
  const overridden = analyzeReferenceSet(
    blobReference,
    { ...context, jobId: "blob-override" },
    new DeterministicReferenceAnalysisProvider({ modelTypeId: "humanoid/chibi-v1", state: "overridden", note: "Force humanoid for experiment" }),
  );
  assert.equal(overridden.bodyPlanAssessment.selected.value, "compact/blob-amorphous");
  assert.equal(overridden.classification.confirmationState, "overridden");
  assert.equal(overridden.classification.recommendation.origin, "user-overridden");
  assert.equal(overridden.classification.recommendation.value, "humanoid/chibi-v1");
  assert.ok(overridden.expectedParts);
});

test("analysis provider is replaceable without changing the modular result contract", () => {
  const fallback = new DeterministicReferenceAnalysisProvider();
  const provider: ReferenceAnalysisProvider = {
    id: "fixture-provider",
    version: "9.0.0",
    analyze(input, providerContext) {
      const result = fallback.analyze(input, providerContext);
      return {
        ...result,
        inputAssessment: {
          ...result.inputAssessment,
          producer: { id: this.id, version: this.version },
        },
      };
    },
  };
  const result = analyzeReferenceSet(referenceSet, context, provider);
  assert.equal(result.inputAssessment.producer.id, "fixture-provider");
  assert.equal(result.inputAssessment.kind, "input-assessment");
});

test("unknown model-type overrides fail before model-specific artifacts", () => {
  assert.throws(
    () => analyzeReferenceSet(referenceSet, context, new DeterministicReferenceAnalysisProvider({ modelTypeId: "missing/type", state: "overridden" })),
    /Unknown model type override/,
  );
});
