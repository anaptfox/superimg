# SuperImg React

React bindings for SuperImg.

## Overview

Seamlessly integrate SuperImg into your React applications. This package provides hooks and components to render and control SuperImg templates within your React component tree.

## Installation

```bash
npm install superimg-react
```

## Usage

```jsx
import { Player } from 'superimg-react';
import myTemplate from './my-template';

function App() {
  return (
    <Player
      template={myTemplate}
      width={1280}
      height={720}
      playbackMode="loop"
    />
  );
}
```

For more details, check the [documentation](../../docs/).
