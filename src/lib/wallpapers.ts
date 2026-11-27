export interface Wallpaper {
  id: string
  name: string
  light: string
  dark: string
}

const grad = (...layers: string[]) => layers.join(', ')

export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'bigsur',
    name: '海湾',
    light: grad(
      'radial-gradient(ellipse 80% 60% at 15% 100%, #ff7eb3 0%, transparent 60%)',
      'radial-gradient(ellipse 70% 55% at 85% 95%, #ffb86b 0%, transparent 60%)',
      'radial-gradient(ellipse 90% 70% at 50% 0%, #6aa7ff 0%, transparent 70%)',
      'linear-gradient(180deg, #8ab4ff 0%, #b69cff 55%, #ff9fc2 100%)',
    ),
    dark: grad(
      'radial-gradient(ellipse 80% 60% at 15% 100%, #7a1f5c 0%, transparent 60%)',
      'radial-gradient(ellipse 70% 55% at 85% 95%, #7a3b16 0%, transparent 60%)',
      'radial-gradient(ellipse 90% 70% at 50% 0%, #1b3a7a 0%, transparent 70%)',
      'linear-gradient(180deg, #101a3a 0%, #261b4d 55%, #3a1a3a 100%)',
    ),
  },
  {
    id: 'aurora',
    name: '极光',
    light: grad(
      'radial-gradient(ellipse 60% 50% at 20% 20%, #7ef3c7 0%, transparent 65%)',
      'radial-gradient(ellipse 60% 60% at 80% 30%, #7aa8ff 0%, transparent 65%)',
      'radial-gradient(ellipse 80% 50% at 50% 100%, #c58bff 0%, transparent 70%)',
      'linear-gradient(160deg, #d6f5ff 0%, #c9d4ff 100%)',
    ),
    dark: grad(
      'radial-gradient(ellipse 60% 50% at 20% 20%, #0f6b55 0%, transparent 65%)',
      'radial-gradient(ellipse 60% 60% at 80% 30%, #1d3f94 0%, transparent 65%)',
      'radial-gradient(ellipse 80% 50% at 50% 100%, #50208a 0%, transparent 70%)',
      'linear-gradient(160deg, #06121f 0%, #0c1030 100%)',
    ),
  },
  {
    id: 'sunset',
    name: '日落',
    light: grad(
      'radial-gradient(ellipse 100% 60% at 50% 110%, #ff5e62 0%, transparent 70%)',
      'radial-gradient(ellipse 80% 50% at 80% 0%, #ffd06b 0%, transparent 70%)',
      'linear-gradient(180deg, #ffb27a 0%, #ff7b8a 60%, #b34dc9 100%)',
    ),
    dark: grad(
      'radial-gradient(ellipse 100% 60% at 50% 110%, #8a1f2b 0%, transparent 70%)',
      'radial-gradient(ellipse 80% 50% at 80% 0%, #7a5410 0%, transparent 70%)',
      'linear-gradient(180deg, #3a1b24 0%, #3d1530 60%, #251040 100%)',
    ),
  },
  {
    id: 'forest',
    name: '森林',
    light: grad(
      'radial-gradient(ellipse 70% 60% at 10% 90%, #a8e063 0%, transparent 65%)',
      'radial-gradient(ellipse 70% 60% at 90% 10%, #56ccf2 0%, transparent 65%)',
      'linear-gradient(135deg, #7fd8a6 0%, #3aa5a0 100%)',
    ),
    dark: grad(
      'radial-gradient(ellipse 70% 60% at 10% 90%, #1d4d20 0%, transparent 65%)',
      'radial-gradient(ellipse 70% 60% at 90% 10%, #0c3b52 0%, transparent 65%)',
      'linear-gradient(135deg, #0a2a22 0%, #0b2630 100%)',
    ),
  },
  {
    id: 'graphite',
    name: '石墨',
    light: 'linear-gradient(135deg, #e9ecf2 0%, #c4cad6 100%)',
    dark: 'linear-gradient(135deg, #23262d 0%, #0f1013 100%)',
  },
]

export const DEFAULT_WALLPAPER = WALLPAPERS[0].id
export const getWallpaper = (id: string) => WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0]
