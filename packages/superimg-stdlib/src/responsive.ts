/**
 * Responsive layout utilities for SuperImg templates
 *
 * Provides helpers for aspect-ratio-based layout branching.
 * Templates render at a fixed canvas size, so no scaling utilities are needed.
 *
 * @example
 * ```ts
 * // Single value
 * const direction = responsive({ portrait: 'column', landscape: 'row' }, ctx);
 *
 * // Factory pattern for many values (recommended)
 * const r = createResponsive(ctx);
 * const hookSize = r({ portrait: 68, square: 32, default: 48 });
 * const titleSize = r({ portrait: 44, square: 22, default: 32 });
 * ```
 */

export interface RenderContext {
  isPortrait: boolean;
  isLandscape: boolean;
  isSquare: boolean;
}

export interface ResponsiveOptions<T> {
  portrait?: T;
  landscape?: T;
  square?: T;
  default?: T;
}

/**
 * Choose a value based on the current canvas aspect ratio orientation
 *
 * Selects the appropriate value from options based on whether the
 * canvas is portrait, landscape, or square. Falls back to default
 * or the first available option.
 *
 * @param options - Object with portrait, landscape, square, default keys
 * @param ctx - Render context with isPortrait, isLandscape, isSquare
 * @returns The value for the current orientation
 *
 * @example
 * const direction = responsive({
 *   portrait: 'column',
 *   landscape: 'row',
 *   square: 'row',
 *   default: 'row'
 * }, ctx);
 */
export function responsive<T>(
  options: ResponsiveOptions<T>,
  ctx: RenderContext
): T | undefined {
  if (ctx.isSquare && options.square !== undefined) {
    return options.square;
  }
  if (ctx.isPortrait && options.portrait !== undefined) {
    return options.portrait;
  }
  if (ctx.isLandscape && options.landscape !== undefined) {
    return options.landscape;
  }
  return options.default ?? options.landscape ?? options.portrait;
}

/**
 * Create a responsive selector function bound to a render context.
 *
 * This factory pattern eliminates the need to pass ctx to every call,
 * making it ergonomic to use for many responsive values.
 *
 * @param ctx - Render context with isPortrait, isLandscape, isSquare
 * @returns Function that selects values based on orientation
 *
 * @example
 * ```ts
 * const r = createResponsive(ctx);
 *
 * // Now use r() for all responsive values
 * const hookSize = r({ portrait: 68, square: 32, default: 48 });
 * const titleSize = r({ portrait: 44, square: 22, default: 32 });
 * const padding = r({ portrait: [64, 48], square: [28, 28], default: [44, 44] });
 * ```
 */
export function createResponsive(
  ctx: RenderContext
): <T>(options: ResponsiveOptions<T>) => T | undefined {
  return <T>(options: ResponsiveOptions<T>) => responsive(options, ctx);
}
