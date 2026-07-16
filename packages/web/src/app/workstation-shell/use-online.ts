import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Whether the browser sees a network, live across online/offline events —
 * the M1.4 signal that blocks the OFFLOADED analyses (everything local keeps
 * working without the network). `navigator.onLine` is optimistic (a captive
 * portal still reads as online) — fine here: a false "online" fails at click
 * time with the typed `network` copy, the belt to this suspender.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  )
}
