import { bars } from '../progress'

export function log(...args: unknown[]) {
  if (args.length) {
    const toLog = [new Date().toLocaleTimeString('ru'), ...args].join(' ')

    bars.log(toLog.endsWith('\n') ? toLog : `${toLog}\n`)
  } else {
    bars.log('\n')
  }
}
