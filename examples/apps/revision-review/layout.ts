export interface Bounds { x: number; y: number; width: number; height: number }

/** The same geometry feeds rendering and authored observations. */
export function launchLayout(width: number, height: number) {
  const square = width === height;
  return {
    square,
    product: square
      ? { x: 72, y: 270, width: width - 144, height: 174 }
      : { x: Math.round(width * 0.56), y: 112, width: width - Math.round(width * 0.56) - 72, height: 326 },
    title: square
      ? { x: 54, y: 90, width: 432, height: 130 }
      : { x: 72, y: 104, width: 390, height: 200 },
  };
}

export function layoutProduct(width: number, height: number): Bounds {
  return launchLayout(width, height).product;
}
