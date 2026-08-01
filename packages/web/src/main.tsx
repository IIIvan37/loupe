import { I18nProvider } from '@lingui/react'
import { Provider as AtomStoreProvider } from 'jotai'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/space-grotesk/500.css'
import './styles/petaluma-script.css'
import './styles/tokens.css'
import './styles/global.css'
import { AudioSessionProvider } from './app/audio-session/audio-session-provider.tsx'
import { WorkstationShell } from './app/workstation-shell/workstation-shell.tsx'
import { i18n } from './i18n/i18n.ts'
import { startPresenceHeartbeat } from './lib/presence-heartbeat.ts'
import { isServerShell } from './lib/server-shell.ts'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root is missing from index.html')
}

// Served by the local binary, the page keeps it alive; when every tab is
// gone the beats stop and the server exits after its grace (never in dev —
// Vite's shell must not pin a backend). Lives for the whole page: no stop.
if (isServerShell()) {
  startPresenceHeartbeat(window.location.origin)
}

createRoot(container).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      {/* The app's one atom store, explicit rather than Jotai's implicit
          default — the boundary tests recreate per case (ADR 0010). */}
      <AtomStoreProvider>
        {/* The audio ports' one injection point (ADR 0011). Production
            injects nothing: every consumer falls back to its real adapter. */}
        <AudioSessionProvider value={{}}>
          <WorkstationShell />
        </AudioSessionProvider>
      </AtomStoreProvider>
    </I18nProvider>
  </StrictMode>
)
