// Configurable list of bad words - can be expanded or loaded from external source
const BAD_WORDS = [
  // Common profanity
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'piss',
  // More bad words - add as needed
  'bastard', 'cunt', 'dick', 'cock', 'pussy', 'dumbass',
  'motherfucker', 'asshole', 'douche', 'twat', 'fucker',
  'bullshit', 'bull crap', 'jackass', 'dipshit', 'faggot',
  'nigger', 'chink', 'spic', 'gook', 'kike', 'wop', 'coon'
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
