// 10 distinct gradient pairs for anonymous avatars
const AVATAR_GRADIENTS: [string, string][] = [
  ['#7C3AED', '#9333EA'], // violet
  ['#22C55E', '#16A34A'], // green
  ['#F59E0B', '#D97706'], // amber
  ['#EC4899', '#DB2777'], // pink
  ['#3B82F6', '#2563EB'], // blue
  ['#14B8A6', '#0D9488'], // teal
  ['#F97316', '#EA580C'], // coral
  ['#8B5CF6', '#7C3AED'], // purple
  ['#06B6D4', '#0891B2'], // cyan
  ['#A855F7', '#9333EA'], // magenta
]

// djb2 hash function
function djb2Hash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash)
}

/**
 * Returns a deterministic gradient index from an anonymous name using djb2 hash.
 * @param name - The anonymous name to hash
 * @returns Index into the AVATAR_GRADIENTS array
 */
export function getAvatarGradientIndex(name: string): number {
  const hash = djb2Hash(name)
  return hash % AVATAR_GRADIENTS.length
}

/**
 * Returns a deterministic gradient CSS string from an anonymous name.
 * @param name - The anonymous name to hash
 * @returns A linear-gradient CSS string
 */
export function getAvatarGradient(name: string): string {
  const [c1, c2] = AVATAR_GRADIENTS[getAvatarGradientIndex(name)]
  return `linear-gradient(135deg, ${c1}, ${c2})`
}

/**
 * Returns a deterministic solid color from an anonymous name (for backward compatibility).
 * @param name - The anonymous name to hash
 * @returns A hex color string
 */
export function getAvatarColor(name: string): string {
  return AVATAR_GRADIENTS[getAvatarGradientIndex(name)][0]
}

/**
 * Returns a lighter variant of the avatar color for backgrounds
 */
export function getAvatarBgColor(name: string): string {
  return `${getAvatarColor(name)}20`
}

export { AVATAR_GRADIENTS }
