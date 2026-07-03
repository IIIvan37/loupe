import { i18n } from '@lingui/core'
import { messages } from '../locales/fr/messages.po'

// Single locale for now: the French source catalog, compiled on import by
// @lingui/vite-plugin, loaded eagerly at startup. Adding a locale means
// adding it to lingui.config.ts and loading its catalog here.
i18n.load('fr', messages)
i18n.activate('fr')

export { i18n }
