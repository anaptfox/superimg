/**
 * Responsive layout utilities for SuperImg templates
 *
 * Provides a simple helper for aspect-ratio-based layout branching.
 * Templates render at a fixed canvas size, so no scaling utilities are needed.
 *
 * @example
 * import { responsive } from '@superimg/stdlib/responsive';
 * const direction = responsive({ portrait: 'column', landscape: 'row' }, ctx);
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
