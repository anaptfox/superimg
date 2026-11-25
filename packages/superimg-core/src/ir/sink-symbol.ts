//! Non-enumerable channel for IR instrumentation on RenderContext.

import type { IrInstrumentSink } from "./instrument.js";

export const IR_SINK = Symbol.for("superimg.ir.sink");

export function attachIrSink<T extends object>(ctx: T, sink: IrInstrumentSink | undefined): T {
  if (sink) {
    Object.defineProperty(ctx, IR_SINK, {
      value: sink,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return ctx;
}

export function getIrSink(ctx: object): IrInstrumentSink | undefined {
  return (ctx as Record<symbol, IrInstrumentSink | undefined>)[IR_SINK];
}
