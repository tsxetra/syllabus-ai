// Configurable list of bad words - can be expanded or loaded from external source
const BAD_WORDS = [
  // Core profanity
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'piss',
  'bastard', 'cunt', 'dick', 'cock', 'pussy', 'motherfucker', 'asshole', 'douche', 'twat', 'fucker',
  'bullshit', 'bull crap', 'jackass', 'dipshit', 'arse', 'bloody',
  // Variants of core profanity
  'fucking', 'fuckin', 'fucker', 'fuckface', 'fuckhead', 'fucks', 'fucked', 'motherfucking', 'motherfuckin',
  'shithead', 'shitty', 'shite', 'shits', 'shitfaced',
  'asshat', 'asswipe', 'assclown', 'asshats', 'asswipes', 'dumbasses', 'jackasses', 'dipshits',
  'bitchy', 'bitchin', 'bitches', 'bitching',
  'dickhead', 'dickwad', 'dickface', 'dicks',
  'cocksucker', 'cockhead', 'cockface', 'cocks',
  'pussies', 'pussycat', 'puss',
  'cunts', 'cunting', 'twats', 'bastards', 'douches',
  // Racial slurs and hate terms
  'nigger', 'nigga', 'spic', 'gook', 'slope', 'towelhead', 'chink', 'jap', 'kike',
  'wetback', 'yid', 'faggot', 'fags', 'homo', 'queer', 'pillow biter', 'fruit', 'cocksucker', 'sodomite',
  // Serious crimes and exploitation
  'rape', 'rapist', 'pedophile', 'child molester', 'kid fucker', 'pedophilia', 'incest', 'bestiality',
  // Violence terms
  'kill', 'murder', 'torture', 'slaughter'
];

export interface FilterResult {
  isBlocked: boolean;
  filteredContent: string;
  detectedWords: string[];
}

/**
 * Checks if content contains bad words and returns filtered result
 */
export function filterProfanity(content: string): FilterResult {
  const lowerContent = content.toLowerCase();
  const detectedWords: string[] = [];
  let filteredContent = content;

  // Check for bad words
  for (const badWord of BAD_WORDS) {
    const regex = new RegExp(`\\b${badWord}\\b`, 'gi');
    if (regex.test(lowerContent)) {
      detectedWords.push(badWord);
      // Replace bad word with asterisks
      filteredContent = filteredContent.replace(regex, '*'.repeat(badWord.length));
    }
  }

  const isBlocked = detectedWords.length > 0;

  return {
    isBlocked,
    filteredContent,
    detectedWords
  };
}

/**
 * Simple check if content contains bad words
 */
export function containsProfanity(content: string): boolean {
  return filterProfanity(content).isBlocked;
}
