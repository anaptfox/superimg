# Vumbnail Explainer

An explainer video template for [Vumbnail.com](https://vumbnail.com) - a video thumbnail service.

## Scenes

1. **Logo & Tagline** (0-3s) - Brand introduction with fade-in animation
2. **URL Demo** (3-7s) - Typewriter effect showing the simple URL structure
3. **Thumbnail Sizes** (7-10s) - Animated grid showing small/medium/large options
4. **Platform Support** (10-12s) - YouTube and Vimeo badge animations

## Features Demonstrated

- Phase-based animation timing
- Typewriter text effect
- Staggered element animations with `easeOutBack`
- SVG icon integration
- Gradient backgrounds
- Code block styling

## Usage

```bash
superimg render examples/templates/vumbnail-explainer/vumbnail-explainer.video.ts -o vumbnail.mp4
```

## Customization

```typescript
defaults: {
  brandColor: "#6366f1",   // Primary brand color
  accentColor: "#22d3ee",  // Accent for highlights
  videoId: "148751763",    // Example video ID shown
}
```
