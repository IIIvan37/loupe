import {
  deleteLoop,
  emptyLoopLibrary,
  type LoopLibrary,
  type LoopRegion,
  type LoopStore,
  loadLoops,
  type NamedLoop,
  saveLoop
} from '@app/core'
import { useEffect, useMemo, useState } from 'react'
import { createLocalStorageLoopStore } from '../../audio/local-storage-loop-store.ts'

export interface Loops {
  readonly library: LoopLibrary
  readonly save: (name: string, region: LoopRegion) => void
  readonly remove: (id: string) => void
}

/**
 * Smart hook for the saved-loop library: loads it on mount and runs the loop
 * use-cases (which persist through the `LoopStore` port). The store defaults to
 * the localStorage adapter and is injected in tests.
 */
export function useLoops(store?: LoopStore): Loops {
  const loopStore = useMemo(
    () => store ?? createLocalStorageLoopStore(),
    [store]
  )
  const [library, setLibrary] = useState<LoopLibrary>(emptyLoopLibrary)

  useEffect(() => {
    let active = true
    void loadLoops({ store: loopStore }).then((loaded) => {
      if (active) {
        setLibrary(loaded)
      }
    })
    return () => {
      active = false
    }
  }, [loopStore])

  function save(name: string, region: LoopRegion): void {
    const loop: NamedLoop = { id: crypto.randomUUID(), name, region }
    void saveLoop({ library, loop }, { store: loopStore }).then(setLibrary)
  }

  function remove(id: string): void {
    void deleteLoop({ library, id }, { store: loopStore }).then(setLibrary)
  }

  return { library, save, remove }
}
