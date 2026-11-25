# Stats Card Example

An animated stock card: the price counts from the first observation to the close, a sparkline draws with a marker on the same curve, and the day-range rail locates the close between the low and high.

The sample is illustrative. It makes no live market requests.

- `ctx.director()` orders the landing, price count, tape, hold, and exit.
- `t.motion()` and `t.tween()` give the card and its values stable motion identities.
- `std.svg.bezier.pointAt()` keeps the marker and reveal clipped to the same path.
- `Frame`, `Stack`, `Text`, and a local `Surface` recipe own layout; boxed `Html` contains the SVG tape and rail.

## Run

```bash
just cli check examples/data/stats-card/stats-card.media.ts --pretty
just cli inspect examples/data/stats-card/stats-card.media.ts --at 73% --png
just cli export examples/data/stats-card/stats-card.media.ts --for youtube
```

## Customize

Edit the sample, or supply these fields to the Player:

```ts
sample: {
  symbol: "ACME",
  companyName: "Acme Inc.",
  price: 104.5,
  change: 3.5,
  changePercent: 3.47,
  high: 105,
  low: 100,
  sparkline: [101, 102, 101.5, 103, 104.5],
  upColor: "#3DDC97",
  downColor: "#FF5C7A",
}
```

Supply observations in chronological order. The card is authored for landscape delivery.
