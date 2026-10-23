import json
import sys
from pathlib import Path


BLENDER_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BLENDER_DIR))

from generator.character_dna import LittleGuyDNA
from generator.style_kit import (
    STYLE_KIT_ID,
    STYLE_KIT_VERSION,
    apply_style_configuration,
    assembly_metadata,
    default_style_configuration,
    validate_style_configuration,
)


def assert_raises(message_fragment, fn):
    try:
        fn()
    except ValueError as error:
        assert message_fragment in str(error), str(error)
    else:
        raise AssertionError(f"Expected ValueError containing {message_fragment!r}")


def main():
    default = default_style_configuration()
    validated = validate_style_configuration(default)
    assert validated["styleKitId"] == STYLE_KIT_ID
    assert validated["styleKitVersion"] == STYLE_KIT_VERSION
    assert validated["selections"]["head-shape"] == "soft-round"
    assert validated["selections"]["eyes"] == "vertical-oval"

    custom = json.loads(json.dumps(default))
    custom["source"] = "user"
    custom["selections"].update(
        {
            "head-shape": "broad-cheek",
            "eyes": "round",
            "mouth": "soft-smile",
            "hair": "side-swept",
            "torso-clothing": "tee-shorts",
        }
    )
    custom["parameters"].update(
        {
            "heads-tall": 2.62,
            "head-width": 1.12,
            "eye-spacing": 0.46,
            "shoulder-width": 0.80,
            "arm-length": 0.30,
        }
    )

    dna = apply_style_configuration(LittleGuyDNA(), custom)
    assert abs(dna.head_height_ratio - (1 / 2.62)) < 1e-9
    assert dna.head_width_as_head_height == 1.12
    assert dna.eye_spacing_ratio == 0.46
    assert dna.shoulder_width_ratio == 0.80
    assert dna.arm_length_ratio == 0.30

    metadata = assembly_metadata(custom)
    assert metadata["schema"] == "chibi-style-assembly/v1"
    assert metadata["selections"]["hair"] == "side-swept"
    assert metadata["resolvedSourceParts"]["hair"] == "chibi/hair/side-swept-v1"
    assert metadata["resolvedSourceParts"]["torso-clothing"] == "chibi/clothing/tee-shorts-v1"
    assert assembly_metadata(custom) == assembly_metadata(json.loads(json.dumps(custom)))

    bad_variant = json.loads(json.dumps(default))
    bad_variant["selections"]["eyes"] = "laser"
    assert_raises("Unknown variant", lambda: validate_style_configuration(bad_variant))
    bad_variant["selections"]["eyes"] = ["round"]
    assert_raises("Unknown variant", lambda: validate_style_configuration(bad_variant))
    bad_source = json.loads(json.dumps(default))
    bad_source["source"] = {}
    assert_raises("source must be", lambda: validate_style_configuration(bad_source))

    bad_range = json.loads(json.dumps(default))
    bad_range["parameters"]["head-width"] = 2.0
    assert_raises("must be between", lambda: validate_style_configuration(bad_range))

    missing_slot = json.loads(json.dumps(default))
    del missing_slot["selections"]["hair"]
    assert_raises("missing required keys", lambda: validate_style_configuration(missing_slot))

    unknown_parameter = json.loads(json.dumps(default))
    unknown_parameter["parameters"]["jaw-teleport"] = 1.0
    assert_raises("unknown keys", lambda: validate_style_configuration(unknown_parameter))

    print("Chibi style-kit contract tests passed")


if __name__ == "__main__":
    main()
