export const ICON_COLORS: Record<string, string> = {
  blue: 'linear-gradient(145deg, #5eb0ff 0%, #2f6bff 100%)',
  indigo: 'linear-gradient(145deg, #8f8bff 0%, #5a4bd8 100%)',
  purple: 'linear-gradient(145deg, #d58bff 0%, #8e44e6 100%)',
  pink: 'linear-gradient(145deg, #ff8fb5 0%, #f0457d 100%)',
  red: 'linear-gradient(145deg, #ff8a7a 0%, #e5382f 100%)',
  orange: 'linear-gradient(145deg, #ffb35c 0%, #ff7a1a 100%)',
  yellow: 'linear-gradient(145deg, #ffe066 0%, #f5a900 100%)',
  green: 'linear-gradient(145deg, #7be08a 0%, #25a244 100%)',
  teal: 'linear-gradient(145deg, #62e0d4 0%, #12958b 100%)',
  graphite: 'linear-gradient(145deg, #8e9099 0%, #3d3f47 100%)',
}

export const COLOR_IDS = Object.keys(ICON_COLORS)

export function resolveColor(id: string): string {
  return ICON_COLORS[id] ?? ICON_COLORS.blue
}
