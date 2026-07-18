import type {
  TauriDownloadBridge,
  TauriDownloadedTrack,
  TauriDownloadProgress
} from './tauri-track-source.ts'

/**
 * The humble Tauri binding of `TauriDownloadBridge`: `invoke` + a progress
 * `Channel` for the Rust `download_track` command, and the fs plugin for
 * reading the finished file back out of app-data. Modules are loaded lazily
 * so the web bundle never pulls them outside the shell (same pattern as
 * `tauri-fs.ts`). Only reachable inside the shell, verified there for real.
 */
export function createTauriDownloadBridge(): TauriDownloadBridge {
  return {
    async downloadTrack(url, onEvent) {
      const { invoke, Channel } = await import('@tauri-apps/api/core')
      const channel = new Channel<TauriDownloadProgress>()
      channel.onmessage = onEvent
      return invoke<TauriDownloadedTrack>('download_track', {
        url,
        onProgress: channel
      })
    },
    async cancelDownload() {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('cancel_download')
    },
    async readFile(relativePath) {
      const fs = await import('@tauri-apps/plugin-fs')
      return fs.readFile(relativePath, { baseDir: fs.BaseDirectory.AppData })
    },
    async removeDir(relativeDir) {
      const fs = await import('@tauri-apps/plugin-fs')
      await fs.remove(relativeDir, {
        baseDir: fs.BaseDirectory.AppData,
        recursive: true
      })
    }
  }
}
