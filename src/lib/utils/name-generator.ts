// 200+ unique name combinations for anonymous identities
const ADJECTIVES = [
  'Sleepy', 'Ninja', 'Cosmic', 'Brave', 'Clever', 'Mighty', 'Gentle', 'Swift',
  'Lucky', 'Wild', 'Quiet', 'Bold', 'Fancy', 'Jolly', 'Merry', 'Silly',
  'Zippy', 'Breezy', 'Chilly', 'Dizzy', 'Fuzzy', 'Goofy', 'Happy', 'Icy',
  'Jazzy', 'Kind', 'Lively', 'Magic', 'Noble', 'Odd', 'Peppy', 'Quick',
  'Royal', 'Shiny', 'Tiny', 'Unique', 'Vivid', 'Warm', 'Xenial', 'Yummy',
  'Zesty', 'Amber', 'Blissful', 'Crisp', 'Dapper', 'Eager', 'Fluffy', 'Gleaming',
  'Humble', 'Infinite', 'Jubilant', 'Keen', 'Luminous', 'Mellow', 'Nimble',
  'Opulent', 'Peaceful', 'Radiant', 'Sparkly', 'Tranquil', 'Upbeat', 'Valiant',
  'Whimsical', 'Adept', 'Bouncy', 'Calm', 'Dreamy', 'Elastic', 'Frosty',
  'Glowing', 'Hoppy', 'Indigo', 'Jumpy', 'Kooky', 'Lush', 'Misty', 'Neon',
  'Pearly', 'Rustic', 'Silky', 'Twirly', 'Velvet', 'Witty', 'Azure', 'Coral',
  'Dewy', 'Ebony', 'Fizzy', 'Ghostly', 'Hazy', 'Ivory', 'Jade', 'Lavender',
  'Mauve', 'Night', 'Onyx', 'Plum', 'Rose', 'Steel', 'Teal', 'Umbra',
]

const ANIMALS = [
  'Otter', 'Raccoon', 'Penguin', 'Fox', 'Wolf', 'Bear', 'Hawk', 'Lynx',
  'Falcon', 'Owl', 'Dolphin', 'Eagle', 'Panda', 'Tiger', 'Lion', 'Deer',
  'Swan', 'Robin', 'Salmon', 'Crow', 'Elk', 'Hare', 'Kite', 'Mole',
  'Newt', 'Oryx', 'Puma', 'Seal', 'Toad', 'Urchin', 'Viper', 'Wren',
  'Yak', 'Zebra', 'Badger', 'Coyote', 'Dove', 'Finch', 'Gecko', 'Heron',
  'Ibex', 'Jaguar', 'Koala', 'Lemur', 'Moth', 'Narwhal', 'Ocelot', 'Pony',
  'Quail', 'Raven', 'Skunk', 'Turtle', 'Umbrellabird', 'Vole', 'Weasel',
  'Xerus', 'Chinchilla', 'Dragonfly', 'Echidna', 'Flamingo', 'Gazelle',
  'Hedgehog', 'Iguana', 'Jackal', 'Kiwi', 'Lobster', 'Mongoose', 'Numbat',
  'Octopus', 'Pelican', 'Rhinoceros', 'Squirrel', 'Tapir', 'Uakari',
  'Vulture', 'Wallaby', 'Yak', 'Axolotl', 'Beetle', 'Caterpillar', 'Dingo',
  'Emperor', 'Frog', 'Gorilla', 'Hamster', 'Impala', 'Jellyfish', 'Kangaroo',
  'Lizard', 'Meerkat', 'Nightingale', 'Orangutan', 'Parrot', 'Quokka',
  'Rattlesnake', 'Starfish', 'Toucan', 'Unicorn', 'Vicuna', 'Wombat',
]

/**
 * Generates a random anonymous name (adjective + animal)
 */
export function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `${adj} ${animal}`
}

/**
 * Generates N unique anonymous name suggestions
 */
export function generateNameSuggestions(count: number = 3): string[] {
  const suggestions = new Set<string>()
  let attempts = 0
  while (suggestions.size < count && attempts < 100) {
    suggestions.add(generateName())
    attempts++
  }
  return Array.from(suggestions)
}

/**
 * Checks if a name is in the valid format (Adjective Animal)
 */
export function isValidName(name: string): boolean {
  const parts = name.trim().split(/\s+/)
  if (parts.length !== 2) return false
  const [adj, animal] = parts
  return (
    ADJECTIVES.some((a) => a.toLowerCase() === adj.toLowerCase()) &&
    ANIMALS.some((a) => a.toLowerCase() === animal.toLowerCase())
  )
}

export { ADJECTIVES, ANIMALS }
