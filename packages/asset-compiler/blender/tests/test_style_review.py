"""Fast regression checks for resolved rig inputs and portable review evidence."""
import copy
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "packages/asset-compiler/blender"))
from chibi_style_review import inspect_glb, review_configurations, run_review
from generator.character_dna import LittleGuyDNA
from generator.style_dna import dna_from_generation_metadata, generation_metadata
from generator.style_kit import apply_style_configuration


class ResolvedRigInputTests(unittest.TestCase):
    def setUp(self):
        self.dna = apply_style_configuration(LittleGuyDNA(), review_configurations()["broad-cheek"])
        self.metadata = generation_metadata(self.dna, None)

    def test_style_override_reaches_identical_rig_proportions(self):
        restored = dna_from_generation_metadata(json.loads(json.dumps(self.metadata)))
        self.assertEqual(restored, self.dna)
        self.assertEqual(restored.shoulder_width_ratio, .8)
        self.assertAlmostEqual(restored.H / restored.head_height, 2.6)

    def test_reject_invalid_serialized_parameters(self):
        for key, value in [("H", float("nan")), ("H", True), ("arm_length_ratio", -1), ("low_poly_segments", 4.5), ("low_poly_segments", 100), ("waist_from_top_ratio", .99)]:
            with self.subTest(key=key, value=value):
                doc = copy.deepcopy(self.metadata)
                doc["resolvedDna"][key] = value
                with self.assertRaises(ValueError):
                    dna_from_generation_metadata(doc)

    def test_reject_wrong_or_incomplete_metadata(self):
        for change in [{"schema": "wrong"}, {"modelTypeId": "other"}, {"resolvedDna": {}}, {"resolvedDna": {**self.metadata["resolvedDna"], "unknown": 1}}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                dna_from_generation_metadata({**self.metadata, **change})


class ReviewEvidenceTests(unittest.TestCase):
    def write_glb(self, folder, mutate=None):
        doc = {"asset": {"version": "2.0"}, "skins": [{}], "meshes": [{"primitives": [{"indices": 0}]}], "accessors": [{"count": 6}], "animations": [{"name": n, "channels": [{}]} for n in ["a-pose", "idle", "walk", "wave"]]}
        if mutate:
            mutate(doc)
        payload = json.dumps(doc).encode()
        payload += b" " * (-len(payload) % 4)
        path = Path(folder) / "sample.glb"
        path.write_bytes(struct.pack("<4sIIII", b"glTF", 2, 20 + len(payload), len(payload), 0x4E4F534A) + payload)
        return path

    def test_portable_rig_structure(self):
        with tempfile.TemporaryDirectory() as folder:
            report = inspect_glb(self.write_glb(folder))
            self.assertEqual(report["triangles"], 2)
            self.assertEqual(len(report["clips"]), 4)

    def test_missing_skin_clips_and_external_resources_fail(self):
        for mutation in [lambda d: d.update(skins=[]), lambda d: d.update(animations=[]), lambda d: d.update(images=[{"uri": "texture.png"}])]:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as folder:
                with self.assertRaises(ValueError):
                    inspect_glb(self.write_glb(folder, mutation))

    def test_truncated_glb_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "broken.glb"
            path.write_bytes(b"glTF")
            with self.assertRaisesRegex(ValueError, "Truncated"):
                inspect_glb(path)

    def test_runs_never_overwrite_existing_outputs(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(FileExistsError):
                run_review(Path(folder), "unused", ["gold-standard"])

    def test_failed_worker_retains_failure_and_log_hashes(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "new-run"
            with patch("chibi_style_review.subprocess.check_output", side_effect=lambda *a, **kw: "fixture\n" if kw.get("text") else b"fixture\n"), patch("chibi_style_review.subprocess.run") as worker:
                worker.return_value.returncode = 7
                with self.assertRaisesRegex(RuntimeError, "failed"):
                    run_review(output, "blender", ["gold-standard"])
            manifest = json.loads((output / "review-run.json").read_text())
            self.assertEqual(manifest["status"], "failed")
            self.assertEqual(manifest["fixtures"]["gold-standard"]["steps"][0]["exitCode"], 7)
            self.assertIn("gold-standard/model.log", manifest["outputs"])


if __name__ == "__main__":
    unittest.main()
