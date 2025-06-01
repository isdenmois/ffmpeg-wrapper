import os from 'node:os'

let getId = 0n

interface Context<T, K> {
  id: bigint
  value: T
  onResult(id: bigint, value: K): void
  onError(error: unknown): void
}

export class PromisePool<T, K> {
  private current = new Set<bigint>()
  private data: Context<T, K>[] = []

  constructor(
    private producer: (value: T) => Promise<K>,
    private maxThreads = os.cpus().length,
  ) {}

  setMaxThreads(maxThreads: number) {
    if (maxThreads === 0) {
      this.maxThreads = os.cpus().length
    } else {
      this.maxThreads = maxThreads
    }
  }

  async run(data: T[]): Promise<K[]> {
    const result = new Map<bigint, K>()

    return new Promise((resolve, reject) => {
      const onResult = (id: bigint, value: K) => {
        result.set(id, value)

        if (result.size === data.length) {
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          resolve(mapping.map(m => result.get(m.id)!))
        }
      }
      const onError = (error: string) => {
        this.removeData(mapping.map(m => m.id))
        reject(error)
      }
      const mapping: Context<T, K>[] = data.map(value => ({ value, id: getId++, onResult, onError }))

      this.data.push(...mapping)
      this.checkAndExecute()
    })
  }

  async execute(item: Context<T, K>) {
    this.current.add(item.id)

    try {
      const value = await this.producer(item.value)

      item.onResult(item.id, value)
    } catch (error: unknown) {
      item.onError(error)
    } finally {
      this.current.delete(item.id)
    }

    this.checkAndExecute()
  }

  async checkAndExecute() {
    while (this.current.size < this.maxThreads && this.data.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      this.execute(this.data.shift()!)
    }
  }

  removeData(id: bigint | bigint[]) {
    if (Array.isArray(id)) {
      const ids = new Set(id)
      this.data = this.data.filter(value => !ids.has(value.id))
    } else {
      this.data = this.data.filter(value => value.id !== id)
    }
  }
}
