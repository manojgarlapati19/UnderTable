// 10 distinct colors for anonymous avatars
const AVATAR_COLORS = [
  '#7C3AED', // violet
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#8B5CF6', // purple
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
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
 * Returns a deterministic color from an anonymous name using djb2 hash.
 * @param name - The anonymous name to hash
 * @returns A hex color string
 */
export function getAvatarColor(name: string): string {
  const hash = djb2Hash(name)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/**
 * Returns a lighter variant of the avatar color for backgrounds
 */
export function getAvatarBgColor(name: string): string {
  const color = getAvatarColor(name)
  return `${color}20` // 12.5% opacity
}

export { AVATAR_COLORS }
