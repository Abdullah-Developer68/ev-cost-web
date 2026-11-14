/** Rounds the axis to 1 / 2 / 2.5 / 5 x 10^n steps so ticks read as clean numbers. */
export function niceScale(maxValue: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: 1, ticks: [0, 1] }
  const rough = maxValue / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough) ?? 10) * magnitude
  const max = Math.ceil(maxValue / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= max + step / 1e6; t += step) ticks.push(Number(t.toFixed(6)))
  return { max, ticks }
}
