import array
import copy
import importlib.util
from pathlib import Path
import random
import unittest

module_path = Path(__file__).with_name('verify-production.py')
spec = importlib.util.spec_from_file_location('production', module_path)
production = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)


class AudioAlignmentTests(unittest.TestCase):
    def source(self):
        rng = random.Random(123)
        return array.array('f', (rng.uniform(-.3, .3) for _ in range(32000 * 2)))

    def test_zero_and_shifted_waveforms_have_distinct_alignment(self):
        source = self.source()
        self.assertEqual(production.alignment(source, source, 6000, 1600)['bestLagSamples'], 0)
        for delay in [17, 1024]:
            shifted = array.array('f', [0] * (delay * 2)) + source
            self.assertEqual(production.alignment(source, shifted, 6000, 1600)['bestLagSamples'], delay)

    def test_silent_windows_cannot_claim_alignment(self):
        silence = array.array('f', [0] * 64000)
        with self.assertRaisesRegex(ValueError, 'audible'):
            production.alignment(silence, silence, 6000, 1600)


class ShoreCompatibilityTests(unittest.TestCase):
    def record(self):
        return {'kind': 'shore-empty-mask-painted-projection-compatibility',
            'status': 'typed-tree-and-native-pixel-equivalent',
            'oldProgramDigest': 'old', 'currentReviewProgramDigest': 'new',
            'changedSources': [{'path': 'examples/showcase/returning-shore/render.ts'}],
            'frames': [{'variant': v, 'frame': f, 'inactiveRemovedNodes': 2 if f < 250 else 0,
                        'normalizedOldTreeSha256': 'same', 'currentTreeSha256': 'same'}
                       for v in ['default', 'teaching'] for f in range(720)],
            'nativePixelProof': [{'variant': v, 'frame': f, 'dimensions': [3840, 2160],
                         'beforeSha256': 'pixels', 'afterSha256': 'pixels', 'pngBytesIdentical': True}
                        for v in ['default', 'teaching'] for f in [0, 150, 465, 690]]}

    def test_complete_evidence_accepts_only_bound_identities(self):
        record = self.record()
        production.validate_shore_compatibility(record, 'old', 'new')
        with self.assertRaisesRegex(ValueError, 'identity'):
            production.validate_shore_compatibility(record, 'other', 'new')

    def test_missing_frame_or_changed_active_pose_cannot_waive_export(self):
        record = self.record()
        missing = copy.deepcopy(record); missing['frames'].pop()
        with self.assertRaisesRegex(ValueError, '1440'):
            production.validate_shore_compatibility(missing, 'old', 'new')
        changed = copy.deepcopy(record); changed['frames'][300]['currentTreeSha256'] = 'moved'
        with self.assertRaisesRegex(ValueError, 'typed-tree parity'):
            production.validate_shore_compatibility(changed, 'old', 'new')

    def test_changed_pixels_or_second_source_cannot_waive_export(self):
        record = self.record(); record['nativePixelProof'][0]['afterSha256'] = 'changed'
        with self.assertRaisesRegex(ValueError, 'native-pixel parity'):
            production.validate_shore_compatibility(record, 'old', 'new')
        record = self.record(); record['changedSources'].append({'path': 'model.ts'})
        with self.assertRaisesRegex(ValueError, 'only'):
            production.validate_shore_compatibility(record, 'old', 'new')


if __name__ == '__main__':
    unittest.main()
