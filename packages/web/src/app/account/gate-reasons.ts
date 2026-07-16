import type { MintFailureReason } from '../../auth/auth-port.ts'

/** One gate reason per analysis flow — the account slot opens per flow, so
 * two flows blocked for the same reason each pop the menu (M1.1). Its own
 * module (not `account-menu-slot.tsx`): a non-component export in a component
 * file would break Fast Refresh. */
export function gateReasonsOf(
  ...flows: readonly { gateReason: MintFailureReason | undefined }[]
): readonly (MintFailureReason | undefined)[] {
  return flows.map((flow) => flow.gateReason)
}
