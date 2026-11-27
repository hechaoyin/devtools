import { describe, expect, it } from 'vitest'
import { idleDrag, LONG_PRESS_SLOP, pressDown, pressHold, pressMove, pressUp } from './longPressDrag'

describe('组内应用长按拖拽', () => {
  it('短按且几乎没移动时，松手仍作为点击', () => {
    const state = pressMove(pressDown('json', 10, 20), 12, 22, 'xml')
    expect(state.phase).toBe('pending')
    expect(pressUp(state)).toEqual({ suppressClick: false, reorder: null })
  })

  it('位移刚好在阈值内仍可进入拖拽', () => {
    const state = pressHold(pressMove(pressDown('json', 0, 0), LONG_PRESS_SLOP, 0, 'xml'))
    expect(state.phase).toBe('dragging')
  })

  it('按住前移动超过阈值则取消，松手不打开应用', () => {
    const state = pressMove(pressDown('json', 0, 0), LONG_PRESS_SLOP + 1, 0, 'xml')
    expect(state.phase).toBe('cancelled')
    expect(pressHold(state).phase).toBe('cancelled')
    expect(pressUp(state)).toEqual({ suppressClick: true, reorder: null })
  })

  it('长按后拖到其他应用上，松手给出排序目标', () => {
    let state = pressHold(pressDown('json', 0, 0))
    state = pressMove(state, 4, 4, 'json')
    expect(state.overId).toBeNull()
    state = pressMove(state, 80, 10, 'hash')
    expect(state.overId).toBe('hash')
    expect(pressUp(state)).toEqual({ suppressClick: true, reorder: { appId: 'json', overId: 'hash' } })
  })

  it('长按后在空白处松手不改变顺序', () => {
    const state = pressMove(pressHold(pressDown('json', 0, 0)), 30, 30, null)
    expect(pressUp(state)).toEqual({ suppressClick: true, reorder: null })
  })

  it('空闲状态忽略后续移动', () => {
    expect(pressMove(idleDrag(), 10, 10, 'json')).toEqual(idleDrag())
    expect(pressHold(idleDrag()).phase).toBe('idle')
  })
})
