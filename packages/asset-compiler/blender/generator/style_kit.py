"""Deterministic Chibi style-kit configuration for Blender assembly.

This module intentionally contains no bpy dependency so the style configuration
contract can be validated in fast CI before Blender runs. The TypeScript
model-type registry is the product-facing source of truth; these compiler-side
constants mirror the exact v1 contract consumed by the Blender worker.
"""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from typing import Any

from .character_dna import LittleGuyDNA


STYLE_CONFIGURATION_SCHEMA = "character-style-configuration/v1"
STYLE_KIT_ID = "humanoid/chibi/style-kit"
STYLE_KIT_VERSION = "1.0.0"
MODEL_TYPE_ID = "humanoid/chibi-v1"
RIG_ID = "humanoid-basic-v1"

SLOT_VARIANTS: dict[str, dict[str, str]] = {
    "body-shape": {
        "gold-standard": "chibi/body/gold-standard-v1",
    },
    "head-shape": {
        "soft-round": "chibi/head/soft-round-v1",
        "broad-cheek": "chibi/head/broad-cheek-v1",
        "tapered": "chibi/head/tapered-v1",
    },
    "eyes": {
        "vertical-oval": "chibi/eyes/vertical-oval-v1",
        "round": "chibi/eyes/round-v1",
        "narrow": "chibi/eyes/narrow-v1",
    },
    "nose": {
        "minimal": "chibi/nose/minimal-v1",
    },
    "mouth": {
        "simple-line": "chibi/mouth/simple-line-v1",
        "soft-smile": "chibi/mouth/soft-smile-v1",
    },
    "ears": {
        "rounded": "chibi/ears/rounded-v1",
    },
    "hair": {
        "faceted-cap": "chibi/hair/faceted-cap-v1",
        "side-swept": "chibi/hair/side-swept-v1",
    },
    "torso-clothing": {
        "a-frame-briefs": "chibi/clothing/a-frame-briefs-v1",
        "tee-shorts": "chibi/clothing/tee-shorts-v1",
    },
    "hands": {
        "oversized-simple": "chibi/hands/oversized-simple-v1",
    },
    "feet": {
        "bare-oversized": "chibi/feet/bare-oversized-v1",
    },
}

CONTROL_RANGES: dict[str, tuple[float, float]] = {
    "heads-tall": (2.6, 2.8),
    "head-width": (0.88, 1.14),
    "head-depth": (0.78, 1.10),
    "eye-spacing": (0.28, 0.52),
    "eye-height": (0.24, 0.32),
    "shoulder-width": (0.62, 0.82),
    "waist-width": (0.42, 0.60),
    "arm-length": (0.23, 0.31),
    "leg-width": (0.24, 0.32),
    "foot-length": (0.25, 0.35),
    "cheek-fullness": (0.95, 1.15),
    "cranium-roundness": (0.96, 1.12),
}

DEFAULT_SELECTIONS = {
    "body-shape": "gold-standard",
    "head-shape": "soft-round",
    "eyes": "vertical-oval",
    "nose": "minimal",
    "mouth": "simple-line",
    "ears": "rounded",
    "hair": "faceted-cap",
    "torso-clothing": "a-frame-briefs",
    "hands": "oversized-simple",
    "feet": "bare-oversized",
}

DEFAULT_PARAMETERS = {
    "heads-tall": 2.7,
    "head-width": 1.02,
    "head-depth": 0.95,
    "eye-spacing": 0.38,
    "eye-height": 0.28,
    "shoulder-width": 0.72,
    "waist-width": 0.50,
    "arm-length": 0.27,
    "leg-width": 0.28,
    "foot-length": 0.30,
    "cheek-fullness": 1.08,
    "cranium-roundness": 1.06,
}


def default_style_configuration() -> dict[str, Any]:
    return {
        "schema": STYLE_CONFIGURATION_SCHEMA,
        "styleKitId": STYLE_KIT_ID,
        "styleKitVersion": STYLE_KIT_VERSION,
        "modelTypeId": MODEL_TYPE_ID,
        "source": "preset",
        "selections": dict(DEFAULT_SELECTIONS),
        "parameters": dict(DEFAULT_PARAMETERS),
    }


def _require_exact_keys(document: dict[str, Any], expected: set[str], label: str) -> None:
    actual = set(document)
    missing = sorted(expected - actual)
    unknown = sorted(actual - expected)
    if missing:
        raise ValueError(f"{label} is missing required keys: {', '.join(missing)}")
    if unknown:
        raise ValueError(f"{label} contains unknown keys: {', '.join(unknown)}")


def validate_style_configuration(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise ValueError("Style configuration must be a JSON object")
    if document.get("schema") != STYLE_CONFIGURATION_SCHEMA:
        raise ValueError(f"Style configuration schema must be {STYLE_CONFIGURATION_SCHEMA}")
    if document.get("styleKitId") != STYLE_KIT_ID:
        raise ValueError(f"Style configuration styleKitId must be {STYLE_KIT_ID}")
    if document.get("styleKitVersion") != STYLE_KIT_VERSION:
        raise ValueError(f"Style configuration styleKitVersion must be {STYLE_KIT_VERSION}")
    if document.get("modelTypeId") != MODEL_TYPE_ID:
        raise ValueError(f"Style configuration modelTypeId must be {MODEL_TYPE_ID}")
    if document.get("source") not in ("preset", "reference-analysis", "user"):
        raise ValueError("Style configuration source must be preset, reference-analysis, or user")

    selections = document.get("selections")
    if not isinstance(selections, dict):
        raise ValueError("Style configuration selections must be an object")
    _require_exact_keys(selections, set(SLOT_VARIANTS), "Style configuration selections")
    normalized_selections: dict[str, str] = {}
    for slot_id, variants in SLOT_VARIANTS.items():
        variant_id = selections.get(slot_id)
        if not isinstance(variant_id, str) or variant_id not in variants:
            choices = ", ".join(sorted(variants))
            raise ValueError(
                f"Unknown variant {variant_id!r} for style slot {slot_id!r}; choose one of: {choices}"
            )
        normalized_selections[slot_id] = str(variant_id)

    parameters = document.get("parameters")
    if not isinstance(parameters, dict):
        raise ValueError("Style configuration parameters must be an object")
    _require_exact_keys(parameters, set(CONTROL_RANGES), "Style configuration parameters")
    normalized_parameters: dict[str, float] = {}
    for control_id, (minimum, maximum) in CONTROL_RANGES.items():
        value = parameters.get(control_id)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"Style parameter {control_id!r} must be a finite number")
        number = float(value)
        if not minimum <= number <= maximum:
            raise ValueError(
                f"Style parameter {control_id!r} must be between {minimum} and {maximum}; got {number}"
            )
        normalized_parameters[control_id] = number

    return {
        "schema": STYLE_CONFIGURATION_SCHEMA,
        "styleKitId": STYLE_KIT_ID,
        "styleKitVersion": STYLE_KIT_VERSION,
        "modelTypeId": MODEL_TYPE_ID,
        "source": document["source"],
        "selections": normalized_selections,
        "parameters": normalized_parameters,
    }


def load_style_configuration(path: str | Path) -> dict[str, Any]:
    document = json.loads(Path(path).read_text(encoding="utf-8"))
    return validate_style_configuration(document)


def apply_style_configuration(dna: LittleGuyDNA, document: dict[str, Any]) -> LittleGuyDNA:
    """Apply user-facing bounded controls to the compiler DNA deterministically."""
    validated = validate_style_configuration(document)
    values = validated["parameters"]
    head_height_ratio = 1.0 / values["heads-tall"]
    leg_width = values["leg-width"]
    return replace(
        dna,
        head_height_ratio=head_height_ratio,
        head_width_as_head_height=values["head-width"],
        head_depth_ratio=values["head-depth"] * head_height_ratio,
        eye_spacing_ratio=values["eye-spacing"],
        eye_center_from_top_ratio=values["eye-height"],
        shoulder_width_ratio=values["shoulder-width"],
        waist_width_ratio=values["waist-width"],
        arm_length_ratio=values["arm-length"],
        thigh_width_ratio=leg_width,
        calf_width_ratio=leg_width * (0.24 / 0.28),
        foot_length_ratio=values["foot-length"],
        cheek_fullness=values["cheek-fullness"],
        cranium_roundness=values["cranium-roundness"],
    )


def resolved_source_parts(document: dict[str, Any]) -> dict[str, str]:
    validated = validate_style_configuration(document)
    return {
        slot_id: SLOT_VARIANTS[slot_id][variant_id]
        for slot_id, variant_id in validated["selections"].items()
    }


def assembly_metadata(document: dict[str, Any]) -> dict[str, Any]:
    validated = validate_style_configuration(document)
    return {
        "schema": "chibi-style-assembly/v1",
        "styleKitId": STYLE_KIT_ID,
        "styleKitVersion": STYLE_KIT_VERSION,
        "modelTypeId": MODEL_TYPE_ID,
        "rigId": RIG_ID,
        "source": validated["source"],
        "selections": dict(validated["selections"]),
        "parameters": dict(validated["parameters"]),
        "resolvedSourceParts": resolved_source_parts(validated),
    }
