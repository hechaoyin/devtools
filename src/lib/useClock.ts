import { useIntervalFn, useNow } from '@vueuse/core'

/** 每秒更新一次的当前时间 */
export const useClock = () => useNow({ scheduler: (cb) => useIntervalFn(cb, 1000) })
