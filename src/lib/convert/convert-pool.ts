import type { Input } from '../../types'
import type { Options } from '../option-parse'
import { PromisePool } from '../promise-pool'
import { convertFile } from './convert-file'

export function convertPoolItem({ to, i, options }: { to: string; i: Input; options: Options }) {
  return convertFile(to, i, options)
}

export const pool = new PromisePool(convertPoolItem)

export async function convertPoolItems(input: Input[], options: Options, to: string) {
  await pool.run(
    input.map(input => {
      return { to, i: input, options }
    }),
  )
}
