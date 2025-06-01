import { MultiBar, Presets } from 'cli-progress'

export const bars = new MultiBar(
  {
    hideCursor: true,
    clearOnComplete: true,
    emptyOnZero: true,
    barsize: 60,
    format: ' {name} \t | {bar} | {percentage}%\t | {duration_formatted}\t | ETA: {eta_formatted}',
  },
  Presets.shades_classic,
)

process.on('exit', () => {
  bars.stop()
})
