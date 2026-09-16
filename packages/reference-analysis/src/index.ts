import {
  type BodyPlanAssessmentArtifact,
  type BodyPlanId,
  type ClassificationArtifact,
  type Evidence,
  type ExpectedPartObservationsArtifact,
  type FunctionalHypothesesArtifact,
  type InputAssessmentArtifact,
  type ModelTypeRecommendationArtifact,
  type ObservedFeaturesArtifact,
  type OrientationAssessmentArtifact,
  type ReferenceSetArtifact,
  type SemanticPartGraphArtifact,
  type StyleDnaArtifact,
  type SubjectIsolationArtifact,
  type ViewAnalysisArtifact,
} from "../../pipeline-contracts/src/artifacts";
import { modelTypeRegistry } from "../../model-types/src/registry";

export interface AnalysisContext {
  jobId: string;
  createdAt: string;
  producerVersion?: string;
}

export interface AnalysisArtifacts {
  inputAssessment: InputAssessmentArtifact;
  subjectIsolation: SubjectIsolationArtifact;
  orientationAssessment: OrientationAssessmentArtifact;
  bodyPlanAssessment: BodyPlanAssessmentArtifact;
  observedFeatures: ObservedFeaturesArtifact;
  functionalHypotheses: FunctionalHypothesesArtifact;
  modelTypeRecommendation: ModelTypeRecommendationArtifact;
  classification: ClassificationArtifact;
  viewAnalysis: ViewAnalysisArtifact;
  expectedParts?: ExpectedPartObservationsArtifact;
  partGraph?: SemanticPartGraphArtifact;
  styleDna?: StyleDnaArtifact;
}

export interface ReferenceAnalysisProvider {
  readonly id: string;
  readonly version: string;
  analyze(referenceSet: ReferenceSetArtifact, context: AnalysisContext): AnalysisArtifacts;
}

export interface ModelTypeDecision {
  modelTypeId: string;
  state: "confirmed" | "overridden";
  note?: string;
}

function artifactId(jobId: string, suffix: string): string {
  return `${jobId}:${suffix}:v1`;
}

function evidence<T>(
  value: T | null,
  origin: Evidence<T>["origin"],
  confidence: number | null,
  confirmed = false,
  sourceArtifactIds?: readonly string[],
  note?: string,
): Evidence<T> {
  return { value, origin, confidence, confirmed, sourceArtifactIds, note };
}

function descriptionBodyPlan(description?: string): BodyPlanId | null {
  const text = description?.trim().toLowerCase();
  if (!text) return null;
  if (/\b(blob|slime|amorphous|goo|jelly)\b/.test(text)) return "compact/blob-amorphous";
  if (/\b(human|humanoid|person|biped|two[- ]legged)\b/.test(text)) return "articulated/humanoid-bipedal";
  if (/\b(quadruped|four[- ]legged|dog|cat|horse|wolf)\b/.test(text)) return "articulated/quadrupedal";
  if (/\b(snake|serpent|worm|eel)\b/.test(text)) return "elongated/serpentine";
  return null;
}

function recommendationFromGenericEvidence(
  referenceSet: ReferenceSetArtifact,
  bodyPlan: BodyPlanAssessmentArtifact,
): {
  outcome: ModelTypeRecommendationArtifact["outcome"];
  selected: Evidence<string>;
  candidates: ModelTypeRecommendationArtifact["candidates"];
} {
  const sourceArtifactIds = [bodyPlan.artifactId];
  if (referenceSet.modelTypeHint && modelTypeRegistry.get(referenceSet.modelTypeHint)) {
    return {
      outcome: "recommended",
      selected: evidence(
        referenceSet.modelTypeHint,
        "user-provided",
        0.65,
        false,
        sourceArtifactIds,
        "The supplied model-type hint is a directional prior. Visual assessment must still confirm compatibility.",
      ),
      candidates: [{
        modelTypeId: referenceSet.modelTypeHint,
        confidence: 0.65,
        evidenceSatisfied: ["explicit model-type hint"],
        evidenceContradicted: [],
        assumptionsRequired: ["visual morphology compatibility has not yet been measured"],
      }],
    };
  }

  const bodyPlanId = bodyPlan.selected.value;
  if (bodyPlanId === "articulated/humanoid-bipedal") {
    return {
      outcome: "unresolved",
      selected: evidence(
        null,
        "unavailable",
        null,
        false,
        sourceArtifactIds,
        "A user-description prior is not enough to choose the humanoid generator without visual morphology evidence.",
      ),
      candidates: [{
        modelTypeId: "humanoid/chibi-v1",
        confidence: 0.4,
        evidenceSatisfied: ["description is compatible with a humanoid/bipedal body plan"],
        evidenceContradicted: [],
        assumptionsRequired: ["silhouette articulation", "limb layout", "face/orientation", "proportion fit"],
      }],
    };
  }

  if (bodyPlanId && bodyPlanId !== "unknown") {
    return {
      outcome: "unsupported",
      selected: evidence(
        null,
        "unavailable",
        null,
        false,
        sourceArtifactIds,
        `No available registered generator is confirmed for generic body plan '${bodyPlanId}'.`,
      ),
      candidates: [],
    };
  }

  return {
    outcome: "unresolved",
    selected: evidence(
      null,
      "unavailable",
      null,
      false,
      sourceArtifactIds,
      "No model type is selected until generic image evidence supports a compatible body plan.",
    ),
    candidates: [],
  };
}

function applyDecision(
  recommendation: Evidence<string>,
  decision: ModelTypeDecision | undefined,
  referenceSetId: string,
): { selected: Evidence<string>; confirmationState: ClassificationArtifact["confirmationState"] } {
  if (!decision) return { selected: recommendation, confirmationState: "pending" };
  if (!modelTypeRegistry.get(decision.modelTypeId)) {
    throw new Error(`Unknown model type override '${decision.modelTypeId}'.`);
  }
  const overridden = recommendation.value !== decision.modelTypeId || decision.state === "overridden";
  return {
    selected: evidence(
      decision.modelTypeId,
      overridden ? "user-overridden" : "user-confirmed",
      overridden ? null : recommendation.confidence,
      true,
      [referenceSetId, ...(recommendation.sourceArtifactIds ?? [])],
      decision.note,
    ),
    confirmationState: overridden ? "overridden" : "confirmed",
  };
}

export class DeterministicReferenceAnalysisProvider implements ReferenceAnalysisProvider {
  readonly id = "deterministic-reference-analysis-v2";
  readonly version = "2.0.0";

  constructor(private readonly decision?: ModelTypeDecision) {}

  analyze(referenceSet: ReferenceSetArtifact, context: AnalysisContext): AnalysisArtifacts {
    if (referenceSet.references.length === 0) throw new Error("Reference set must contain at least one reference.");

    const primary = referenceSet.references.find((reference) => reference.slot === "front") ?? referenceSet.references[0];
    const producer = { id: this.id, version: context.producerVersion ?? this.version };
    const header = { schemaVersion: "1.0.0" as const, jobId: context.jobId, createdAt: context.createdAt, producer };
    const hasDimensions = typeof primary.width === "number" && typeof primary.height === "number";
    const imageMedia = primary.mediaType.startsWith("image/");

    const inputAssessment: InputAssessmentArtifact = {
      ...header,
      kind: "input-assessment",
      artifactId: artifactId(context.jobId, "input-assessment"),
      referenceId: primary.id,
      usability: evidence(
        imageMedia ? (hasDimensions ? "usable" : "limited") : "unusable",
        "measured",
        imageMedia ? (hasDimensions ? 0.8 : 0.55) : 1,
        false,
        [referenceSet.artifactId],
      ),
      subjectVisibility: evidence(null, "unavailable", null, false, [referenceSet.artifactId], "Pixel-level subject visibility has not been measured by this provider."),
      backgroundSeparation: evidence(null, "unavailable", null, false, [referenceSet.artifactId], "Pixel-level background separation has not been measured by this provider."),
      needsMoreViews: evidence(referenceSet.references.length < 2, "defaulted", 0.5, false, [referenceSet.artifactId]),
      rubric: [{ criterionId: "input.media-validity", level: imageMedia ? 4 : 0, confidence: 1, sourceArtifactIds: [referenceSet.artifactId] }],
    };

    const subjectIsolation: SubjectIsolationArtifact = {
      ...header,
      kind: "subject-isolation",
      artifactId: artifactId(context.jobId, "subject-isolation"),
      referenceId: primary.id,
      bounds: evidence(null, "unavailable", null, false, [inputAssessment.artifactId], "This metadata-only provider does not inspect pixels."),
      center: evidence(null, "unavailable", null, false, [inputAssessment.artifactId]),
      coverage: evidence(null, "unavailable", null, false, [inputAssessment.artifactId]),
      silhouette: evidence("unavailable", "unavailable", null, false, [inputAssessment.artifactId]),
      rubric: [{ criterionId: "subject.silhouette", level: 0, confidence: null, sourceArtifactIds: [inputAssessment.artifactId] }],
    };

    const slotFacing = primary.slot === "front" ? "front" : primary.slot === "side" ? "side" : primary.slot === "back" ? "back" : "unknown";
    const orientationAssessment: OrientationAssessmentArtifact = {
      ...header,
      kind: "orientation-assessment",
      artifactId: artifactId(context.jobId, "orientation-assessment"),
      referenceId: primary.id,
      facing: evidence(
        slotFacing,
        slotFacing === "unknown" ? "unavailable" : "user-provided",
        slotFacing === "unknown" ? null : 0.6,
        false,
        [referenceSet.artifactId],
        slotFacing === "unknown" ? undefined : "Reference-slot naming is directional user metadata, not visual orientation evidence.",
      ),
      imageUp: evidence("unknown", "unavailable", null, false, [subjectIsolation.artifactId]),
      yawDegrees: evidence(null, "unavailable", null, false, [subjectIsolation.artifactId]),
      pitchDegrees: evidence(null, "unavailable", null, false, [subjectIsolation.artifactId]),
      rollDegrees: evidence(null, "unavailable", null, false, [subjectIsolation.artifactId]),
      groundDirection: evidence("unknown", "unavailable", null, false, [subjectIsolation.artifactId]),
      rubric: [{ criterionId: "orientation.visual-facing", level: 0, confidence: null, sourceArtifactIds: [subjectIsolation.artifactId] }],
    };

    const descriptionPlan = descriptionBodyPlan(referenceSet.userDescription);
    const bodyPlanAssessment: BodyPlanAssessmentArtifact = {
      ...header,
      kind: "body-plan-assessment",
      artifactId: artifactId(context.jobId, "body-plan-assessment"),
      referenceId: primary.id,
      hypotheses: descriptionPlan
        ? [{
            bodyPlanId: descriptionPlan,
            confidence: 0.55,
            rubricLevel: 1,
            sourceArtifactIds: [referenceSet.artifactId],
            note: "Body-plan hypothesis comes from the user's description only; visual morphology has not yet been measured.",
          }]
        : [],
      selected: descriptionPlan
        ? evidence(descriptionPlan, "user-provided", 0.55, false, [referenceSet.artifactId], "Directional prior only; not ground truth.")
        : evidence("unknown", "unavailable", null, false, [subjectIsolation.artifactId], "No visual morphology evidence is available from this provider."),
      rubric: [{ criterionId: "morphology.visual-body-plan", level: 0, confidence: null, sourceArtifactIds: [subjectIsolation.artifactId] }],
    };

    const observedFeatures: ObservedFeaturesArtifact = {
      ...header,
      kind: "observed-features",
      artifactId: artifactId(context.jobId, "observed-features"),
      referenceId: primary.id,
      features: [],
      rubric: [{ criterionId: "features.visual-observation", level: 0, confidence: null, sourceArtifactIds: [subjectIsolation.artifactId], note: "No pixel-level feature provider ran." }],
    };

    const functionalHypotheses: FunctionalHypothesesArtifact = {
      ...header,
      kind: "functional-hypotheses",
      artifactId: artifactId(context.jobId, "functional-hypotheses"),
      referenceId: primary.id,
      hypotheses: [],
      rubric: [{ criterionId: "function.visual-support", level: 0, confidence: null, sourceArtifactIds: [observedFeatures.artifactId] }],
    };

    const genericRecommendation = recommendationFromGenericEvidence(referenceSet, bodyPlanAssessment);
    const modelTypeRecommendation: ModelTypeRecommendationArtifact = {
      ...header,
      kind: "model-type-recommendation",
      artifactId: artifactId(context.jobId, "model-type-recommendation"),
      ...genericRecommendation,
      bodyPlanArtifactId: bodyPlanAssessment.artifactId,
      observedFeaturesArtifactId: observedFeatures.artifactId,
      functionalHypothesesArtifactId: functionalHypotheses.artifactId,
      userDescription: referenceSet.userDescription
        ? evidence(referenceSet.userDescription, "user-provided", null, false, [referenceSet.artifactId], "User description is preserved as direction, not image evidence.")
        : undefined,
      rubric: [{ criterionId: "model-fit.visual-evidence", level: 0, confidence: null, sourceArtifactIds: [bodyPlanAssessment.artifactId, observedFeatures.artifactId] }],
    };

    const { selected, confirmationState } = applyDecision(modelTypeRecommendation.selected, this.decision, referenceSet.artifactId);
    const classification: ClassificationArtifact = {
      ...header,
      kind: "classification",
      artifactId: artifactId(context.jobId, "classification"),
      recommendation: selected,
      alternatives: modelTypeRecommendation.candidates
        .filter((candidate) => candidate.modelTypeId !== selected.value)
        .map((candidate) => ({ modelTypeId: candidate.modelTypeId, confidence: candidate.confidence })),
      confirmationState,
    };

    const viewAnalysis: ViewAnalysisArtifact = {
      ...header,
      kind: "view-analysis",
      artifactId: artifactId(context.jobId, "view-analysis"),
      referenceId: primary.id,
      role: evidence(slotFacing, slotFacing === "unknown" ? "unavailable" : "user-provided", slotFacing === "unknown" ? null : 0.6, false, [orientationAssessment.artifactId]),
      yawDegrees: evidence(null, "unavailable", null, false, [orientationAssessment.artifactId]),
      pitchDegrees: evidence(null, "unavailable", null, false, [orientationAssessment.artifactId]),
      pose: evidence(null, "unavailable", null, false, [orientationAssessment.artifactId]),
      visibleSide: evidence("unknown", "unavailable", null, false, [orientationAssessment.artifactId]),
      groundLine: evidence(null, "unavailable", null, false, [orientationAssessment.artifactId]),
      occlusions: [],
    };

    if (!selected.value || !selected.confirmed) {
      return {
        inputAssessment,
        subjectIsolation,
        orientationAssessment,
        bodyPlanAssessment,
        observedFeatures,
        functionalHypotheses,
        modelTypeRecommendation,
        classification,
        viewAnalysis,
      };
    }

    const modelTypeId = selected.value;
    const manifest = modelTypeRegistry.require(modelTypeId);
    const expectedParts: ExpectedPartObservationsArtifact = {
      ...header,
      kind: "expected-part-observations",
      artifactId: artifactId(context.jobId, "expected-parts"),
      modelTypeId,
      observations: (manifest.expectedParts ?? []).map((part) => ({
        partId: part.id,
        state: "unknown",
        evidence: evidence(
          null,
          "unavailable",
          null,
          false,
          [classification.artifactId, observedFeatures.artifactId],
          `${part.label} is expected by the confirmed model type, but has not yet been mapped to visual evidence.`,
        ),
      })),
    };

    const partGraph: SemanticPartGraphArtifact = {
      ...header,
      kind: "semantic-part-graph",
      artifactId: artifactId(context.jobId, "part-graph"),
      modelTypeId,
      nodes: (manifest.expectedParts ?? []).map((part) => ({
        id: `${context.jobId}:part:${part.id}`,
        expectedPartId: part.id,
        label: part.label,
        parentId: part.parentId ? `${context.jobId}:part:${part.parentId}` : null,
        attachmentRole: part.attachmentRole,
        deformationRole: part.deformationRole,
        state: "unknown",
      })),
    };

    const styleDna: StyleDnaArtifact = {
      ...header,
      kind: "style-dna",
      artifactId: artifactId(context.jobId, "style-dna"),
      modelTypeId,
      modelTypeVersion: manifest.version,
      values: {
        sourceViewRole: evidence(viewAnalysis.role.value, viewAnalysis.role.origin, viewAnalysis.role.confidence, viewAnalysis.role.confirmed, [viewAnalysis.artifactId]),
        headsTall: evidence(manifest.goldStandard?.headsTall.target ?? 2.7, "defaulted", 0.35, false, [classification.artifactId]),
        expectedPartCount: evidence(partGraph.nodes.length, "measured", 1, true, [partGraph.artifactId]),
      },
    };

    return {
      inputAssessment,
      subjectIsolation,
      orientationAssessment,
      bodyPlanAssessment,
      observedFeatures,
      functionalHypotheses,
      modelTypeRecommendation,
      classification,
      viewAnalysis,
      expectedParts,
      partGraph,
      styleDna,
    };
  }
}

export function analyzeReferenceSet(
  referenceSet: ReferenceSetArtifact,
  context: AnalysisContext,
  provider: ReferenceAnalysisProvider = new DeterministicReferenceAnalysisProvider(),
): AnalysisArtifacts {
  return provider.analyze(referenceSet, context);
}
