# Interactive Scenes

Semantic scenes, guides, actions, hit targets, and scene navigation live in `@foxworth/superimg/interactive/define`.

```ts
import { defineInteractive } from "@foxworth/superimg/interactive/define";

export default defineInteractive<Lesson>({
  guide: lessonGuide,
  render(ctx) {
    return renderLesson(ctx.data);
  },
});
```

The host supplies live data to one interactive experience. Offline export may use explicit sample/default data. Interactive definitions do not participate in collection planning.

## Persistent host commands

The controller returned by `createInteractivePlayer()` exposes `scene.set()`,
`scene.show()`, `scene.hide()`, `scene.apply()`, `scene.use()` and `scene.camera()`.
Each command requests a render. Node overrides persist across guide steps and
live data updates until `scene.reset()` clears the overrides, selected state and
camera. A failed render retains the attempted input for the next render.

```ts
await controller.scene.set("world/actor", {
  transform: { x: 24 },
  properties: { selected: true },
});
await controller.scene.use("overview"); // x and selected remain overridden
await controller.scene.reset(); // authored scene and guide values apply again
```

Commands capture their values when called, including nested property values,
animation options, and camera fit/follow targets. Changing a supplied object later
does not change an earlier command. Repeated updates retain only the latest
assigned fields for each target, so a long session does not replay its entire
command history. Untouched fields continue to come from the current authored
scene and guide state.

`set()` merges transform and property fields shallowly; a new nested property
value replaces the old value. Animation replaces the previous animation, and
`animation: null` clears it. Top-level `undefined` fields in `set()` do nothing;
an explicitly present `undefined` transform field replaces that transform field.
`show()` and `hide()` change visibility only. `fadeIn` makes the target visible,
sets opacity to its progress (or 1), and replaces its animation; `pulse` replaces
only its animation. Even an empty patch validates that the target exists.

## Migration: send another command after changing a value

Earlier controllers retained command object references. Code that changed an
already submitted patch, animation options or camera object and then relied on a
later render to observe that mutation must now call `set()`, `apply()` or
`camera()` again with the new value. The authored `ctx.scene` API and low-level
`SceneRuntimeInput.operations` arrays keep their existing reference behavior;
this capture contract applies to imperative controller commands.
