import type { ChildState, ChoreState, StatePayload } from "../types/State"

export type ChoreHandler = (childId: string, choreId: string) => void
export type RedeemHandler = (childId: string) => void
export type PinKeyHandler = (key: "back" | "ok" | string) => void
export type CancelHandler = () => void

export function renderWrapper(_state: StatePayload | null, _onChoreClick: ChoreHandler, _onRedeem: RedeemHandler): HTMLElement {
  throw new Error("not implemented")
}

export function renderChildSection(_child: ChildState, _onChoreClick: ChoreHandler, _onRedeem: RedeemHandler): HTMLElement {
  throw new Error("not implemented")
}

export function renderChoreButton(_childId: string, _chore: ChoreState, _onClick: ChoreHandler): HTMLElement {
  throw new Error("not implemented")
}

export function renderPinModal(
  _childName: string,
  _pinInput: string,
  _onKey: PinKeyHandler,
  _onCancel: CancelHandler
): HTMLElement {
  throw new Error("not implemented")
}
