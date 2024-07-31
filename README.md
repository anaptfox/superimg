# superimg

<p align="center">
  <img src="superimg-logo.webp" />
</p>

Generate static images from React components with ease.

## Description

superimg is a powerful and flexible tool that allows developers to create static images from React components. It leverages the power of React for composing complex layouts and designs, and combines it with server-side rendering capabilities to generate high-quality images. Whether you need to create social media cards, email headers, or any other type of static image content, superimg provides a familiar React-based workflow to streamline your image generation process.

## Use Cases

- Generate social media share images dynamically
- Create email headers and banners
- Produce static infographics from data
- Design and render custom Open Graph images for web pages
- Generate thumbnails for video content
- Create consistent branding assets across multiple platforms

## Getting Started

1. Install superimg using npm or yarn:

```bash
npm install superimg
```

2. Create a React component for your image:

```jsx
// images/social-card/SocialCard.tsx
import React from 'react';

export default function SocialCard({ title, author }) {
  return (
    <div style={{ width: 1200, height: 630, backgroundColor: '#f0f0f0', padding: 40 }}>
      <h1 style={{ fontSize: 60, color: '#333' }}>{title}</h1>
      <p style={{ fontSize: 30, color: '#666' }}>By {author}</p>
    </div>
  );
}

export const config = {
  output: {
    formats: ['png'],
    sizes: [{ width: 1200, height: 630, suffix: 'og' }],
  },
};
```

3. Run superimg to generate the image:

```bash
superimg build
```

## Configuration

superimg can be configured using a `superimg.config.js` file in your project root:

```javascript
module.exports = {
  inputDir: './images',
  outputDir: './public/generated-images',
  defaultFormat: 'png',
  defaultSize: { width: 1200, height: 630 },
};
```

## API

### CLI Commands

- `superimg build`: Generate images for all components in the input directory
- `superimg watch`: Watch for changes and regenerate images

### Component Configuration

Each component can export a `config` object to specify output options:

```javascript
export const config = {
  output: {
    formats: ['png', 'jpeg'],
    sizes: [
      { width: 1200, height: 630, suffix: 'og' },
      { width: 800, height: 418, suffix: 'twitter' },
    ],
  },
};
```

### Loader Function

Components can export a `loader` function to fetch dynamic data:

```javascript
export async function loader() {
  const response = await fetch('https://api.example.com/data');
  return response.json();
}
```

### Fonts

Custom fonts can be specified in the component file:

```javascript
export const fonts = [
  {
    name: 'Inter',
    data: './fonts/Inter-Regular.ttf',
    weight: 400,
    style: 'normal',
  },
];
```
