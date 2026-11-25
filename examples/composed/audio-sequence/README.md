# Audio Sequence

This composition contains two 2-second children at 30 fps, so the root schedule is 4 seconds (120 frames): `warm` spans frames `[0, 60)` and `cool` spans `[60, 120)`.

Each child owns a looping 0.5-second mono PCM WAV tone, generated as a deterministic data URL: 440 Hz for `warm` and 660 Hz for `cool`. The retained projection lifts them into root audio clips at their occurrence starts.

Child audio sources must be portable: use `data:`, HTTP(S), `file:`, or an absolute file path. Relative paths are rejected because the root composition may be compiled without the child module's directory.
