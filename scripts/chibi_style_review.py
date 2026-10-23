#!/usr/bin/env python3
"""Build reproducible Chibi style configurations through the existing worker stages.

No Blender dependency at import time. References are hashed evidence only; preset
geometry comes from the versioned style configuration, not image reconstruction.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BLENDER_DIR = ROOT / "packages/asset-compiler/blender"
sys.path.insert(0, str(BLENDER_DIR))
from generator.style_kit import default_style_configuration, validate_style_configuration

WORKERS = BLENDER_DIR / "scripts"
CLIPS = ["a-pose", "idle", "walk", "wave"]


def review_configurations():
    default = default_style_configuration()
    alternate = default_style_configuration()
    alternate["source"] = "user"
    alternate["selections"].update({"head-shape": "broad-cheek", "eyes": "round", "hair": "side-swept", "mouth": "soft-smile", "torso-clothing": "tee-shorts"})
    alternate["parameters"].update({"heads-tall": 2.6, "head-width": 1.12, "shoulder-width": .8, "arm-length": .30})
    tapered = default_style_configuration()
    tapered["source"] = "user"
    tapered["selections"].update({"head-shape": "tapered", "eyes": "narrow"})
    tapered["parameters"].update({"heads-tall": 2.8, "head-width": .90, "shoulder-width": .64})
    return {name: validate_style_configuration(config) for name, config in [("gold-standard", default), ("broad-cheek", alternate), ("tapered", tapered)]}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_glb(path):
    """Check portable rig/clip structure; this is not a full glTF validator."""
    raw = path.read_bytes()
    if len(raw) < 20:
        raise ValueError("Truncated GLB header")
    magic, version, length = struct.unpack_from("<4sII", raw)
    if (magic, version, length) != (b"glTF", 2, len(raw)):
        raise ValueError("Invalid GLB header or length")
    size, kind = struct.unpack_from("<II", raw, 12)
    if kind != 0x4E4F534A or 20 + size > len(raw):
        raise ValueError("Missing or truncated GLB JSON chunk")
    doc = json.loads(raw[20:20 + size])
    if not doc.get("skins") or not doc.get("meshes"):
        raise ValueError("GLB must contain meshes and a skin")
    for key in ("images", "buffers"):
        if any("uri" in item and not item["uri"].startswith("data:") for item in doc.get(key, [])):
            raise ValueError("GLB has an external resource")
    clips = [a.get("name") for a in doc.get("animations", [])]
    if clips != CLIPS or any(not a.get("channels") for a in doc["animations"]):
        raise ValueError(f"Expected populated animation clips {CLIPS}; got {clips}")
    triangles = sum(doc["accessors"][p["indices"]]["count"] // 3 for m in doc["meshes"] for p in m["primitives"] if p.get("mode", 4) == 4 and "indices" in p)
    return {"skins": len(doc["skins"]), "meshes": len(doc["meshes"]), "clips": clips, "triangles": triangles, "validationScope": "GLB header, mesh/skin/clip presence, embedded resources; not full glTF conformance or visual acceptance"}


def git_output(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()


def run_review(output, blender, fixtures, reference_dir=None):
    configs = review_configurations()
    output = output.resolve()
    # Never destroy or overwrite a previous experiment, including partial failures.
    output.mkdir(parents=True, exist_ok=False)
    manifest = {
        "schema": "chibi-style-review/v1",
        "status": "running",
        "gitHead": git_output("rev-parse", "HEAD"),
        "workingTreeStatus": git_output("status", "--porcelain"),
        "trackedDiffSha256": hashlib.sha256(
            subprocess.check_output(["git", "-C", str(ROOT), "diff", "HEAD"])
        ).hexdigest(),
        "blenderVersion": subprocess.check_output(
            [blender, "--version"], text=True
        ).splitlines()[0],
        "platform": json.loads((ROOT / "engineering-policy.json").read_text())["platform"],
        "references": {},
        "fixtures": {},
        "visualAcceptance": "pending",
        "limitations": [
            "Preset assembly, not automatic reconstruction from supplied references",
            "Prototype part variants require visual review before acceptance",
            "No uniforms or role equipment in this milestone",
        ],
    }
    manifest["sourceHashes"] = {
        str(p.relative_to(ROOT)): sha256(p)
        for p in sorted(BLENDER_DIR.rglob("*.py"))
    }
    manifest["sourceHashes"][str(Path(__file__).relative_to(ROOT))] = sha256(Path(__file__))

    def checkpoint():
        (output / "review-run.json").write_text(json.dumps(manifest, indent=2) + "\n")

    checkpoint()
    try:
        if reference_dir:
            for view in ("front", "side", "back"):
                path = reference_dir / f"gold-standard-{view}.png"
                manifest["references"][view] = {"name": path.name, "sha256": sha256(path)}
        for label in fixtures:
            fixture = output / label
            fixture.mkdir()
            config = fixture / "style-configuration.json"
            config.write_text(json.dumps(configs[label], indent=2) + "\n")
            entry = {"status": "running", "configurationSha256": sha256(config), "steps": []}
            manifest["fixtures"][label] = entry
            model, rig, animate = (fixture / name for name in ("model", "rig", "animate"))
            steps = [
                ("model", "build_humanoid_job.py", ["--preset", "little-guy", "--style-config", str(config), "--output-dir", str(model), "--job-id", label]),
                ("rig", "build_humanoid_rig_job.py", ["--input-blend", str(model / "humanoid.blend"), "--generation-metadata", str(model / "generation-metadata.json"), "--output-dir", str(rig), "--job-id", label]),
                ("animate", "build_humanoid_animation_job.py", ["--input-blend", str(rig / "humanoid-rigged.blend"), "--output-dir", str(animate), "--job-id", label]),
                ("rig-review", "render_rig_review.py", ["--input-blend", str(rig / "humanoid-rigged.blend"), "--output-dir", str(fixture / "rig-review"), "--label", label]),
                ("animation-review", "render_animation_review.py", ["--input-blend", str(animate / "humanoid-animated.blend"), "--metadata", str(animate / "animation-metadata.json"), "--output-dir", str(fixture / "animation-review"), "--label", label]),
            ]
            for name, script, args in steps:
                print(f"{label}: {name}", flush=True)
                command = [blender, "--background", "--factory-startup", "--threads", "2", "--python-exit-code", "1", "--python", str(WORKERS / script), "--", *args]
                with (fixture / f"{name}.log").open("w") as log:
                    try:
                        process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=600)
                    except subprocess.TimeoutExpired:
                        entry["steps"].append({"stage": name, "command": command, "exitCode": None, "timedOut": True})
                        raise
                entry["steps"].append({"stage": name, "command": command, "exitCode": process.returncode})
                checkpoint()
                if process.returncode:
                    raise RuntimeError(f"{label}/{name} failed ({process.returncode}); inspect {fixture / (name + '.log')}")
            entry["structure"] = inspect_glb(animate / "humanoid-animated.glb")
            for directory in ("rig-review", "animation-review"):
                review = json.loads((fixture / directory / "review-manifest.json").read_text())
                images = review.get("images", review.get("renders", []))
                if not images or any(not (fixture / directory / n).is_file() for n in images):
                    raise ValueError(f"Incomplete {directory} images")
            entry["status"] = "completed"
        manifest["status"] = "completed"
    except Exception as error:
        manifest["status"] = "failed"
        manifest["error"] = str(error)
        raise
    finally:
        manifest["outputs"] = {str(p.relative_to(output)): sha256(p) for p in sorted(output.rglob("*")) if p.is_file() and p.name != "review-run.json"}
        (output / "review-run.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Review evidence: {output / 'review-run.json'}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True, help="New directory; existing runs are never overwritten")
    parser.add_argument("--blender", default=os.environ.get("BLENDER_COMMAND", str(ROOT / ".tools/blender/current/blender") if (ROOT / ".tools/blender/current/blender").exists() else "blender"))
    parser.add_argument("--fixture", action="append", choices=list(review_configurations()), help="Repeat to select fixtures; default builds all three")
    parser.add_argument("--reference-dir", type=Path, help="Optional local gold-standard images; record hashes without copying")
    args = parser.parse_args()
    blender = shutil.which(args.blender)
    if not blender:
        parser.error(f"Blender executable unavailable: {args.blender}")
    run_review(args.output_dir, blender, args.fixture or list(review_configurations()), args.reference_dir)


if __name__ == "__main__":
    main()
