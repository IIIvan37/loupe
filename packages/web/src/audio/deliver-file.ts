import { isTauriShell } from '../auth/tauri-env.ts'
import { downloadBlob } from './download-blob.ts'

/**
 * Deliver an export to the user. In the browser this is the classic anchor
 * download (fire-and-forget: the browser owns the save UI, so it counts as
 * delivered). In the desktop shell the anchor is a silent no-op (AH.1), so
 * the delivery is native and in TWO steps, dialog first: `pick_export_path`
 * (tiny payload — the save panel opens instantly, the chosen path stays in
 * Rust behind an opaque token) then `write_export` (the bytes cross the
 * IPC at ~8 MB/s in the bundled webview — which is exactly why the dialog
 * must never wait behind them — and Rust writes them out). The webview
 * keeps no write access outside app-data. Returns `false` when the user
 * cancelled or the write failed: the caller must NOT confirm anything.
 */
export async function deliverFile(
  filename: string,
  blob: Blob
): Promise<boolean> {
  if (!isTauriShell()) {
    downloadBlob(filename, blob)
    return true
  }
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    const token = await invoke<string | null>('pick_export_path', {
      name: filename
    })
    if (token === null) {
      return false
    }
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // The token rides a header: a raw-body invoke carries no JSON args.
    await invoke('write_export', bytes, {
      headers: { 'x-export-token': token }
    })
    return true
  } catch (e) {
    // A failed export must never look like a success (no toast) nor vanish
    // into an unhandled rejection — that reads as « nothing happens ».
    console.error('loupe: export failed', e)
    return false
  }
}
