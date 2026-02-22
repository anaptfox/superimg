# Assets Folder

Place your assets here to test the full asset API:

## Supported Assets

### Background Music (music.mp3)
- Recommended: MP3 or AAC format
- Duration: Should match or exceed video length (loops automatically)
- Volume: Controlled via audio options

### Background Images (background.jpg)
- Format: JPG, PNG, or WebP
- Size: Match video resolution (1920x1080) for best quality
- Used as scene background

### Background Videos (background.mp4)
- Format: MP4 (H.264)
- Resolution: Match video output (1920x1080)
- Loops automatically

## Example Usage

Once you have assets, uncomment the relevant lines in `render.ts`:

```typescript
// Audio with options
audio: {
  src: "./assets/music.mp3",
  loop: true,
  volume: 0.5,
  fadeIn: 1,
  fadeOut: 2,
},

// Per-scene background image
Scene(template, {
  duration: 5,
  background: "./assets/background.jpg",
})

// Per-scene background video
Scene(template, {
  duration: 5,
  background: {
    src: "./assets/background.mp4",
    fit: "cover",
    loop: true,
  },
})
```
