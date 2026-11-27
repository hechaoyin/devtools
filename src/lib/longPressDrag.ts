/** 组内图标：短按打开，按住后拖到另一枚图标上松手则排序。 */

export const LONG_PRESS_MS = 450
export const LONG_PRESS_SLOP = 8

export type DragPhase = 'idle' | 'pending' | 'dragging' | 'cancelled'

export interface DragState {
  phase: DragPhase
  appId: string | null
  originX: number
  originY: number
  x: number
  y: number
  overId: string | null
}

export interface ReorderRequest {
  appId: string
  overId: string
}

export function idleDrag(): DragState {
  return { phase: 'idle', appId: null, originX: 0, originY: 0, x: 0, y: 0, overId: null }
}

export function pressDown(appId: string, x: number, y: number): DragState {
  return { phase: 'pending', appId, originX: x, originY: y, x, y, overId: null }
}

export function pressMove(state: DragState, x: number, y: number, hitId: string | null): DragState {
  if (state.phase === 'idle') return state
  if (state.phase === 'cancelled') return { ...state, x, y }
  if (state.phase === 'pending') {
    if (Math.hypot(x - state.originX, y - state.originY) > LONG_PRESS_SLOP) {
      return { ...state, phase: 'cancelled', x, y, overId: null }
    }
    return { ...state, x, y }
  }
  return { ...state, x, y, overId: hitId && hitId !== state.appId ? hitId : null }
}

/** 长按计时结束。移动超过阈值后不会进入拖拽。 */
export function pressHold(state: DragState): DragState {
  if (state.phase !== 'pending') return state
  return { ...state, phase: 'dragging', overId: null }
}

export function pressUp(state: DragState): { suppressClick: boolean; reorder: ReorderRequest | null } {
  if (state.phase === 'dragging' && state.appId && state.overId) {
    return { suppressClick: true, reorder: { appId: state.appId, overId: state.overId } }
  }
  if (state.phase === 'dragging' || state.phase === 'cancelled') {
    return { suppressClick: true, reorder: null }
  }
  return { suppressClick: false, reorder: null }
}
