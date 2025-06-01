import { convert } from './lib/convert'
import { ensureFolder } from './lib/convert/ensure-folder'
import { parseOptions, selectOptions } from './lib/option-parse'
import { parseInput } from './lib/parse-input'
import { bars } from './lib/progress'
import { syncSubs } from './lib/subs'

const { from, to, options } = await parseOptions()

let inputs = parseInput(from, options.start)

if (options.first) {
  inputs = inputs.slice(0, 1)
}

await selectOptions(inputs, options)

ensureFolder(to)

if (!options.subsonly) {
  await convert(inputs, options, to)
}

if (!options.vmaf && !options.t) {
  await syncSubs(inputs, to)
}

bars.stop()
