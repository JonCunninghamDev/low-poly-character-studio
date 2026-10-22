#!/usr/bin/env python3
"""Offline compatibility and integrity checks for the consumer-owned adoption."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import unittest
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / '.engineering-platform'
SPEC = importlib.util.spec_from_file_location('pinned_policy_validator', VENDOR / 'scripts/validate_engineering_policy.py')
VALIDATOR = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(VALIDATOR)


def validate():
    return VALIDATOR.validate_policy(ROOT / 'engineering-policy.json')


def verify_release_files(release, read):
    for name, expected in release['files'].items():
        if hashlib.sha256(read(name)).hexdigest() != expected:
            raise ValueError(f'Synchronized platform file differs from release: {name}')


class AdoptionTests(unittest.TestCase):
    def setUp(self):
        self.policy = json.loads((ROOT / 'engineering-policy.json').read_text())
        self.release = json.loads((VENDOR / 'release.json').read_text())
        self.schema = json.loads((VENDOR / 'schemas/engineering-policy-v1.schema.json').read_text())

    def test_released_policy_resolves_all_three_capabilities_offline(self):
        summary = validate()
        self.assertEqual(summary['platform_version'], 'v1.0.0')
        self.assertEqual(summary['capabilities']['toolchain'], ['runtime.blender', 'runtime.node', 'runtime.python'])
        self.assertEqual(summary['capabilities']['tests'], ['test.blender', 'test.node', 'test.python'])

    def test_pin_and_synchronized_files_match_verified_release(self):
        self.assertEqual(self.policy['platform'], {key: self.release[key] for key in ('repository', 'version', 'commit')})
        self.assertEqual(self.release['commit'], 'b107c9306161b395cbcaffebb55e47850b999560')
        verify_release_files(self.release, lambda name: (VENDOR / name).read_bytes())
        workflow = (ROOT / '.github/workflows/platform.yml').read_text()
        self.assertIn('reusable-consumer-ci.yml@' + self.release['commit'], workflow)
        self.assertNotIn('reusable-consumer-ci.yml@develop', workflow)

    def test_modified_shared_contract_is_rejected(self):
        name = 'agent/operating-contract-v1.md'
        with self.assertRaisesRegex(ValueError, 'differs from release'):
            verify_release_files(self.release, lambda path: b'changed authority' if path == name else (VENDOR / path).read_bytes())

    def test_unreleased_command_binding_is_not_silently_adopted(self):
        # v1.0.0 does not contain the newer execution command-binding surface.
        changed = deepcopy(self.policy)
        changed['validation']['stages'][0]['command'] = ['python3', 'test.py']
        self.assertTrue(VALIDATOR._schema_errors(changed, self.schema))

    def test_direct_release_writes_are_rejected_by_released_schema(self):
        changed = deepcopy(self.policy)
        changed['delivery']['direct_release_writes'] = True
        self.assertTrue(VALIDATOR._schema_errors(changed, self.schema))

    def test_local_gates_and_protected_authority_are_retained(self):
        gates = set(self.policy['review']['human_approval_for'])
        for override in self.policy['overrides']:
            gates.update(override['restrictions'].get('require_human_approval_for', []))
        self.assertTrue({'release', 'credentials', 'spending', 'public_deployment', 'destructive_operation', 'operating_authority'}.issubset(gates))
        self.assertFalse(self.policy['delivery']['direct_release_writes'])
        self.assertIn('engineering-policy.json', self.policy['protected_paths'])
        self.assertIn('.engineering-platform/**', self.policy['protected_paths'])
        self.assertNotIn('release.write', self.policy['permissions']['bounded_write']['actions'])

    def test_local_delivery_routes_still_pass(self):
        result = subprocess.run(['bash', 'scripts/test-delivery-route.sh'], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('passed', result.stdout.lower())


if __name__ == '__main__':
    unittest.main(verbosity=2)
