#!/usr/bin/env python3
"""Freeze a delivery mux without touching a SuperImg bundle; verify actual encoded bytes.

This example-local adapter is shared after Cleft and Borrowed Shapes demonstrated
the same frozen-WAV mux and audio-delay checks. It does not modify the renderer.
"""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import time
import wave

ROOT = Path(__file__).resolve().parents[4]
FFMPEG = shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
FFPROBE = shutil.which('ffprobe') or '/opt/homebrew/bin/ffprobe'
SPECS = {
    'sandglass': {
        'duration': 40, 'logical': 1152, 'full': 1152, 'reduced': 1152,
        'alignmentSample': 168000,
        'frames': [('supply', 30), ('service', 150), ('comparison', 480),
                   ('fast-finish', 830), ('draining', 930), ('pile', 1080), ('settled', 1170)],
        'crops': [('service', (885, 950, 570, 520)), ('pile', (725, 1350, 980, 370))],
        'reviewCropIds': {'service': 'first-service', 'pile': 'completed-macro'},
        'soundEnvelope': None,
    },
    'returning-shore': {
        'duration': 24, 'logical': 18000, 'full': 18000, 'reduced': 9545,
        'alignmentSample': 408000,
        'frames': [('painting', 150), ('macro', 249), ('disturbance', 315),
                   ('repair', 405), ('restored', 465), ('panel', 690)],
        'crops': [('macro', (1100, 700, 1200, 720)), ('disturbance', (1100, 700, 1200, 720))],
        'reviewCropIds': {'macro': 'macro', 'disturbance': 'macro'},
        'soundEnvelope': [
            {'kind': 'continuous bristle friction', 'rangeSeconds': [0, 2.5], 'gain': 0.14},
            {'kind': 'continuous bristle friction', 'rangeSeconds': [8.5, 11.5], 'gain': 0.34},
            {'kind': 'continuous bristle friction', 'rangeSeconds': [11.5, 15.5], 'gain': 0.10},
        ],
    },
}


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def relative(path):
    return str(Path(path).resolve().relative_to(ROOT))


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')


def run(argv):
    subprocess.run(argv, check=True, stdout=subprocess.DEVNULL)


def probe(path):
    return json.loads(subprocess.check_output([
        FFPROBE, '-v', 'error', '-count_frames', '-show_entries',
        'stream=index,codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,time_base,duration_ts,duration,nb_read_frames,sample_rate,channels',
        '-show_entries', 'format=duration,size', '-of', 'json', str(path),
    ]))


def video_hash(path):
    process = subprocess.Popen([FFMPEG, '-nostdin', '-v', 'error', '-i', str(path),
                                '-map', '0:v:0', '-c:v', 'copy', '-f', 'h264', '-'], stdout=subprocess.PIPE)
    h = hashlib.sha256()
    for block in iter(lambda: process.stdout.read(1024 * 1024), b''):
        h.update(block)
    if process.wait() != 0:
        raise RuntimeError(f'Cannot extract video packets from {path}')
    return h.hexdigest()


def decoded_audio(path):
    pcm = subprocess.check_output([FFMPEG, '-nostdin', '-v', 'error', '-i', str(path),
                                   '-map', '0:a:0', '-f', 'f32le', '-acodec', 'pcm_f32le', '-'])
    values = array.array('f')
    values.frombytes(pcm)
    return values, hashlib.sha256(pcm).hexdigest()


def alignment(source, decoded, at, window=12000):
    # Inspect an active onset on channel zero, keeping AAC quantization visible.
    points = list(range(at, min(at + window, len(source) // 2), 8))
    if not points or max(abs(source[i * 2]) for i in points) < 1e-5:
        raise ValueError('Alignment window must contain audible source material')

    def mse(lag):
        return sum((source[i * 2] - decoded[(i + lag) * 2]) ** 2 for i in points) / len(points)

    lag = min(range(-2048, 2049), key=mse)
    return {'bestLagSamples': lag, 'bestLagMilliseconds': lag / 48,
            'bestLagMse': mse(lag), 'zeroLagMse': mse(0),
            'sourceWindow': [at, at + window], 'channel': 0, 'stride': 8,
            'scope': 'Waveform MSE around one authored active onset; AAC remains lossy. This is timing evidence, not a listening review.'}


def current_sources(study):
    paths = sorted((ROOT / f'examples/showcase/{study}').glob('*.ts'))
    paths += [ROOT / 'examples/showcase/_material/resources.ts', ROOT / 'examples/showcase/_material/font-data.ts',
              ROOT / 'examples/showcase/_material/synthesize.ts']
    return {relative(path): digest(path) for path in paths}


def validate_shore_compatibility(record, old_program, new_program):
    """Accept only the demonstrated empty-alpha-mask correction, never a generic waiver."""
    if (record.get('kind') != 'shore-empty-mask-painted-projection-compatibility'
            or record.get('status') != 'typed-tree-and-native-pixel-equivalent'
            or record.get('oldProgramDigest') != old_program
            or record.get('currentReviewProgramDigest') != new_program):
        raise ValueError('Shore compatibility identity or completed evidence differs')
    changes = record.get('changedSources', [])
    if len(changes) != 1 or changes[0]['path'] != 'examples/showcase/returning-shore/render.ts':
        raise ValueError('Shore compatibility permits only the demonstrated render correction')
    frames = record.get('frames', [])
    expected = {(variant, frame) for variant in ['default', 'teaching'] for frame in range(720)}
    if len(frames) != 1440 or {(f['variant'], f['frame']) for f in frames} != expected:
        raise ValueError('Shore compatibility requires all 1440 cut/frame comparisons')
    if any(f['inactiveRemovedNodes'] not in [0, 2]
           or f['normalizedOldTreeSha256'] != f['currentTreeSha256'] for f in frames):
        raise ValueError('Shore typed-tree parity differs')
    pixels = record.get('nativePixelProof', [])
    pixel_expected = {(v, f) for v in ['default', 'teaching'] for f in [0, 150, 465, 690]}
    if len(pixels) != 8 or {(p['variant'], p['frame']) for p in pixels} != pixel_expected:
        raise ValueError('Shore compatibility requires native parity for both cuts')
    if any(p['dimensions'] != [3840, 2160] or p['beforeSha256'] != p['afterSha256']
           or p.get('pngBytesIdentical') is not True for p in pixels):
        raise ValueError('Shore native-pixel parity differs')


def verify(study, receipt_path, review_path, check_path, measurement_path=None, compatibility_path=None):
    started = time.monotonic()
    spec = SPECS[study]
    receipt = json.loads(receipt_path.read_text())
    review = json.loads(review_path.read_text())
    check = json.loads(check_path.read_text())
    if check.get('ok') is not True or review['technical']['status'] != 'pass' or review['authored']['status'] != 'pass':
        raise ValueError('Production requires a green check and authored review')
    raw_program = receipt['manifest']['runtime']['programDigest']
    current_program = review['sourceIdentity']['valueDigest']
    compatibility = json.loads(compatibility_path.read_text()) if compatibility_path else None
    if compatibility is not None:
        if study != 'returning-shore':
            raise ValueError('The demonstrated mask compatibility applies only to Returning Shore')
        validate_shore_compatibility(compatibility, raw_program, current_program)
        change = compatibility['changedSources'][0]
        if (digest(ROOT / change['path']) != change['newSha256']
                or digest(ROOT / compatibility['oldRenderBackup']) != change['oldSha256']):
            raise ValueError('Shore render bytes differ from the compatibility comparison')
        for path, sha in compatibility['unchangedSourceHashes'].items():
            if digest(ROOT / path) != sha:
                raise ValueError(f'Shore unchanged source differs: {path}')
        for proof in compatibility['nativePixelProof']:
            if (digest(ROOT / proof['beforePath']) != proof['beforeSha256']
                    or digest(ROOT / proof['afterPath']) != proof['afterSha256']):
                raise ValueError('Shore native pixel proof bytes changed')
    if current_program != raw_program and compatibility is None:
        raise ValueError('The accepted review and raw export refer to different media values')
    # Camera polish can move the intended detail. Use the accepted plan's authored
    # crop, at native DPR1, rather than a historical physical capture rectangle.
    crops = []
    for label, fallback in spec['crops']:
        beat = next((beat for beat in review['beats'] if beat['id'] == spec['reviewCropIds'][label]), None)
        evidence = next((e for e in beat['evidence'] if e['kind'] == 'crop' and e.get('crop', {}).get('authored')), None) if beat else None
        rectangle = evidence['crop']['authored'] if evidence else dict(zip(['x', 'y', 'width', 'height'], fallback))
        rect = tuple(rectangle[key] for key in ['x', 'y', 'width', 'height'])
        if not all(isinstance(value, int) for value in rect) or rect[0] < 0 or rect[1] < 0 or rect[2] <= 0 or rect[3] <= 0 or rect[0] + rect[2] > 3840 or rect[1] + rect[3] > 2160:
            raise ValueError('Accepted native crop is outside the 4K canvas')
        crops.append((label, rect))
    before = current_sources(study)
    export_measurement = json.loads(measurement_path.read_text()) if measurement_path else None
    if export_measurement is not None:
        if export_measurement.get('study') != study or export_measurement.get('exitCode') != 0 or export_measurement.get('sourceStable') is not True:
            raise ValueError('Original export measurement does not establish a successful stable source')
        if export_measurement['sourceHashesBefore'] != export_measurement['sourceHashesAfter']:
            raise ValueError('Original export measurement source hashes differ')
        for path, sha in export_measurement['sourceHashesAfter'].items():
            if digest(ROOT / path) != sha:
                permitted = compatibility['changedSources'][0] if compatibility else None
                if not permitted or permitted['path'] != path or permitted['oldSha256'] != sha:
                    raise ValueError(f'Source changed after monitored export: {path}')
    publication_bundle = ROOT / f'output/examples/showcase/{study}/{study}.export'
    score = ROOT / f'examples/showcase/{study}/assets/score.wav'
    cue_path = score.with_suffix('.audio.json')
    cue = json.loads(cue_path.read_text())
    wav_sha, cue_sha = digest(score), digest(cue_path)
    assets = {asset['name']: asset for asset in receipt['manifest']['runtime']['assets']}
    if assets['score.wav']['sha256'] != wav_sha or assets['score.audio.json']['sha256'] != cue_sha or cue['sha256'] != wav_sha:
        raise ValueError('Frozen audio bytes differ from the raw export resources')
    with wave.open(str(score)) as wav:
        metadata = {'sampleRate': wav.getframerate(), 'channels': wav.getnchannels(), 'bitDepth': wav.getsampwidth() * 8, 'samplesPerChannel': wav.getnframes()}
        source_int = array.array('h'); source_int.frombytes(wav.readframes(wav.getnframes()))
    intended_samples = spec['duration'] * 48000
    if metadata != {'sampleRate': 48000, 'channels': 2, 'bitDepth': 16, 'samplesPerChannel': intended_samples}:
        raise ValueError('Frozen WAV does not satisfy the 48 kHz stereo PCM16 film contract')
    for event in cue['cues']:
        if event['sample'] != round(event['seconds'] * 48000):
            raise ValueError(f"Cue sample offset differs from model time: {event['id']}")
    source_float = array.array('f', (value / 32768 for value in source_int))
    target = ROOT / f'output/material-studies/films/{study}'
    acceptance = ROOT / f'output/material-studies/acceptance/{study}'
    frames_dir = acceptance / 'native4k'
    target.mkdir(parents=True, exist_ok=True); frames_dir.mkdir(parents=True, exist_ok=True)
    bundle = acceptance / 'raw-bundles' / receipt['manifestDigest'][:16]
    if not bundle.exists():
        bundle.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(publication_bundle, bundle)
    shutil.copy2(receipt_path, acceptance / 'raw-export-receipt.json')
    shutil.copy2(review_path, acceptance / 'authored-review.json')
    shutil.copy2(check_path, acceptance / 'technical-check.json')
    if measurement_path:
        shutil.copy2(measurement_path, acceptance / 'export-measurements.json')
    if compatibility_path:
        shutil.copy2(compatibility_path, acceptance / 'painted-projection-compatibility.json')
    cuts, audio_records, stream_identity = [], [], []
    for rendition in receipt['manifest']['renditions']:
        variant = rendition['coordinates']['variantId']
        if variant not in ['default', 'teaching'] or rendition['coordinates']['renditionId'] != '3840x2160.mp4':
            continue
        raw = bundle / rendition['path']
        if digest(raw) != rendition['sha256']:
            raise ValueError(f'Raw bundle bytes changed: {raw}')
        final = target / f"{study}{'-teaching' if variant == 'teaching' else ''}-4k.mp4"
        argv = [FFMPEG, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(raw), '-i', str(score),
                '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
                '-ar', '48000', '-ac', '2', '-t', str(spec['duration']), '-movflags', '+faststart', str(final)]
        print(f'{study}/{variant}: copy video and mux frozen WAV', flush=True)
        mux_start = time.monotonic(); run(argv); mux_seconds = time.monotonic() - mux_start
        final_probe, raw_probe = probe(final), probe(raw)
        v = next(stream for stream in final_probe['streams'] if stream['codec_type'] == 'video')
        a = next(stream for stream in final_probe['streams'] if stream['codec_type'] == 'audio')
        if not (v['width'] == 3840 and v['height'] == 2160 and v['r_frame_rate'] == '30/1'
                and int(v['nb_read_frames']) == spec['duration'] * 30 and float(v['duration']) == spec['duration']
                and a['sample_rate'] == '48000' and a['channels'] == 2 and int(a['duration_ts']) == intended_samples
                and a['time_base'] == '1/48000' and float(final_probe['format']['duration']) == spec['duration']):
            raise ValueError(f'{study}/{variant}: final stream contract failed')
        raw_video, final_video = video_hash(raw), video_hash(final)
        if raw_video != final_video:
            raise ValueError('Video packets changed during audio mux')
        final_audio, final_audio_hash = decoded_audio(final)
        raw_audio, raw_audio_hash = decoded_audio(raw)
        final_alignment = alignment(source_float, final_audio, spec['alignmentSample'])
        raw_alignment = alignment(source_float, raw_audio, spec['alignmentSample'])
        if len(final_audio) // 2 != intended_samples or final_alignment['bestLagSamples'] != 0:
            raise ValueError(f'{study}/{variant}: decoded final PCM extent or alignment failed')
        audio_records.append({'variant': variant, 'intendedSamplesPerChannel': intended_samples,
            'rawDecodedSamplesPerChannel': len(raw_audio) // 2, 'rawDecodedSha256': raw_audio_hash,
            'rawAlignment': raw_alignment, 'finalDecodedSamplesPerChannel': len(final_audio) // 2,
            'finalDecodedSha256': final_audio_hash, 'finalAlignment': final_alignment})
        stream_identity.append({'variant': variant, 'rawVideoElementarySha256': raw_video,
            'finalVideoElementarySha256': final_video, 'videoPacketsIdentical': True})
        save(acceptance / f'{variant}-final-ffprobe.json', final_probe)
        save(acceptance / f'{variant}-raw-ffprobe.json', raw_probe)
        cuts.append({'variant': variant, 'rawExport': relative(raw), 'rawExportSha256': rendition['sha256'],
            'finalMaster': relative(final), 'finalMasterSha256': digest(final), 'bytes': final.stat().st_size,
            'streamContractPassed': True, 'finalProbe': relative(acceptance / f'{variant}-final-ffprobe.json'),
            'mux': {'argv': argv, 'wallSeconds': mux_seconds, 'peakMemoryBytes': None},
            'rawHashUnchangedAfterFinalization': digest(raw) == rendition['sha256']})
        if variant == 'default':
            selection = '+'.join(f'eq(n\\,{frame})' for _, frame in spec['frames'])
            run([FFMPEG, '-nostdin', '-v', 'error', '-y', '-i', str(final), '-vf', f'select={selection}',
                 '-fps_mode', 'vfr', '-frames:v', str(len(spec['frames'])), str(frames_dir / 'decoded-%02d.png')])
            for index, (label, frame) in enumerate(spec['frames'], 1):
                decoded = frames_dir / f'decoded-{index:02d}.png'
                png = frames_dir / f'{label}-f{frame}.png'; decoded.replace(png)
                if struct.unpack('>II', png.read_bytes()[16:24]) != (3840, 2160):
                    raise ValueError('Native frame resolution changed')
            for label, (x, y, width, height) in crops:
                frame = dict(spec['frames'])[label]
                run([FFMPEG, '-nostdin', '-v', 'error', '-y', '-i', str(frames_dir / f'{label}-f{frame}.png'),
                     '-vf', f'crop={width}:{height}:{x}:{y}', '-frames:v', '1', str(frames_dir / f'{label}-detail.png')])
        print(f'{study}/{variant}: stream, packet-copy and zero-lag audio checks passed', flush=True)
    if {cut['variant'] for cut in cuts} != {'default', 'teaching'}:
        raise ValueError('Both clean and teaching 4K cuts are required')
    identical_audio = audio_records[0]['finalDecodedSha256'] == audio_records[1]['finalDecodedSha256']
    if not identical_audio:
        raise ValueError('Clean and teaching soundtracks differ')
    save(acceptance / 'audio-alignment.json', {'sourceWavSha256': wav_sha, 'cuts': audio_records, 'decodedCutsIdentical': identical_audio})
    save(acceptance / 'video-copy.json', stream_identity)
    after = current_sources(study)
    if before != after:
        raise ValueError('Source changed during finalization')
    checks = review['authored']['checks']
    manifest = {'schemaVersion': 1, 'kind': 'material-studies/production-acceptance', 'study': study,
        'status': 'encoded-contract-verified-visual-and-listening-review-pending',
        'source': {'media': f'examples/showcase/{study}/{study}.media.ts', 'currentFileHashes': before,
            'compiledReviewIdentity': review['sourceIdentity'], 'rawExportProgramDigest': receipt['manifest']['runtime']['programDigest'],
            'reviewMatchesExportProgram': current_program == raw_program,
            'paintedProjectionCompatibility': relative(acceptance / 'painted-projection-compatibility.json') if compatibility else None,
            'stableDuringFinalization': True,
            'stableDuringOriginalExport': export_measurement['sourceStable'] if export_measurement else None},
        'population': {'logical': spec['logical'], 'fullDrawingPool': spec['full'], 'reducedDrawingPool': spec['reduced'],
            'scope': 'Canonical population and drawing-pool counts; these do not measure projected in-view pixel coverage.'},
        'technicalCheck': {'path': relative(acceptance / 'technical-check.json'), 'ok': True,
            'warnings': [issue for issue in check['issues'] if issue.get('severity') == 'warning']},
        'authoredReview': {'path': relative(acceptance / 'authored-review.json'), 'passed': sum(c['status'] == 'pass' for c in checks), 'total': len(checks),
            'scope': 'Author-reported model facts; encoded-frame visual review is separate.'},
        'fonts': receipt['manifest']['runtime']['fonts'], 'cuts': cuts,
        'sound': {'frozenWav': relative(score), 'wavSha256': wav_sha, 'cueTable': relative(cue_path), 'cueTableSha256': cue_sha,
            'metadata': metadata, 'samplesPerFrame': 1600, 'cueCount': len(cue['cues']), 'continuousEnvelope': spec['soundEnvelope'],
            'decodedAudioEvidence': relative(acceptance / 'audio-alignment.json'), 'listening': 'unreviewed'},
        'mux': {'method': 'Copy authored H264 video packets unchanged; encode frozen WAV as AAC320k with exact authored extent.',
            'rawImmutableBundle': relative(bundle), 'rawPublicationBundle': relative(publication_bundle),
            'receipt': relative(acceptance / 'raw-export-receipt.json'),
            'videoCopyEvidence': relative(acceptance / 'video-copy.json')},
        'nativeDecodedFrames': [{'label': label, 'frame': frame, 'encodedSeconds': frame / 30,
            'path': relative(frames_dir / f'{label}-f{frame}.png'), 'sha256': digest(frames_dir / f'{label}-f{frame}.png'),
            'dimensions': [3840, 2160]} for label, frame in spec['frames']],
        'nativeCrops': [{'label': label, 'authoredAndPixelRect': dict(zip(['x', 'y', 'width', 'height'], rect)),
            'path': relative(frames_dir / f'{label}-detail.png'), 'sha256': digest(frames_dir / f'{label}-detail.png')}
            for label, rect in crops],
        'visualReview': {'status': 'unreviewed', 'observations': []},
        'measurements': {'originalExportWallSeconds': export_measurement['wallSeconds'] if export_measurement else None,
            'originalExportPeakMemoryBytes': None,
            'originalExportSampledPeakProcessFamilyRssBytes': export_measurement['sampledPeakProcessFamilyRssKiB'] * 1024 if export_measurement else None,
            'originalExportEvidence': relative(acceptance / 'export-measurements.json') if export_measurement else None,
            'originalExportContext': export_measurement['productionContext'] if export_measurement else None,
            'originalExportRssDefinition': export_measurement['rssDefinition'] if export_measurement else None,
            'originalExportSampling': {'targetSeconds': export_measurement['samplingTargetSeconds'], 'samples': export_measurement['sampleCount'],
                'intervalMinSeconds': export_measurement['actualIntervalMinSeconds'], 'intervalMaxSeconds': export_measurement['actualIntervalMaxSeconds']} if export_measurement else None,
            'finalizationWallSeconds': time.monotonic() - started, 'finalizationPeakMemoryBytes': None,
            'scope': 'Mux wall times are measured. A supplied original-export monitor records combined-cut wall time and one-second sampled process-family RSS sum, including possible double-counted shared pages. That sampled maximum is not an exact instantaneous or unique-memory peak. Unmeasured fields remain null.'},
        'limits': ['Human listening and physical playback acceptance remain unreviewed.',
            'Live Full/Reduced budgets require the gallery benchmark; film exports do not qualify a preview.',
            'IR embedded-font portability warnings remain distinct from the frozen export font bytes.']}
    save(acceptance / 'manifest.json', manifest)
    print(json.dumps({'study': study, 'manifest': relative(acceptance / 'manifest.json'), 'masters': [cut['finalMaster'] for cut in cuts]}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--study', required=True, choices=SPECS)
    parser.add_argument('--receipt', required=True, type=Path)
    parser.add_argument('--review', required=True, type=Path)
    parser.add_argument('--check', required=True, type=Path)
    parser.add_argument('--export-measurements', type=Path)
    parser.add_argument('--shore-mask-compatibility', type=Path)
    args = parser.parse_args()
    verify(args.study, args.receipt, args.review, args.check, args.export_measurements, args.shore_mask_compatibility)
