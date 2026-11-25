# Countdown Timer Example

A mechanical split-flap board counting down to a moment. Night station wall, bone
glyphs on ink cards, one vermillion signal for the landing.

## Usage

```bash
npx superimg check examples/marketing/countdown/countdown.media.ts --pretty
npx superimg export examples/marketing/countdown/countdown.media.ts --for tiktok
npx superimg dev examples/marketing/countdown/countdown.media.ts
```

## Features

- Split-flap flip built from two half-cards driven by `scaleY`, not CSS keyframes
- One flap per second, each with a flip tail and a read hold
- The final flap settles on `moment` and lights the signal underline
- Progress rail marks how many flaps have fallen
- Portrait format optimized for social media

## Sample fields

| Field | Meaning |
|---|---|
| `eyebrow` | Small line above the board — what we are counting toward |
| `steps` | How many flaps fall before the moment lands (1–9) |
| `moment` | The word the last flap settles on |

## Configuration

- **Resolution**: 1080x1920 (portrait)
- **Duration**: 6 seconds
- **FPS**: 30
