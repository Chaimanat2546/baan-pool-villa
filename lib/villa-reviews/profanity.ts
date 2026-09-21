// Import only the synchronous matcher and dictionaries. The package root also
// loads CLD3, whose runtime Wasm compilation is unsupported by Workers.
import { AhoCorasick } from "bad-words-thai/dist/AhoCorasickNode";
import { ignoreList, profanityList } from "bad-words-thai/dist/dictionaries";
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from "obscenity";

const thaiMatcher = new AhoCorasick();
thaiMatcher.buildTrie(profanityList);
const englishMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

function thaiMatches(source: string): string[] {
  // Blank ignored phrases instead of deleting them so positions still refer to
  // the original comment. Keep the existing dictionary's allowlist semantics.
  let text = source.replace(/[^\u0E00-\u0E7F\s]/g, " ");
  for (const phrase of ignoreList) text = text.replaceAll(phrase, " ".repeat(phrase.length));
  const positions: number[] = [];
  let cleaned = "";
  for (let index = 0; index < text.length; index++) {
    if (/[ก-๙]/.test(text[index])) {
      cleaned += text[index];
      positions.push(index);
    }
  }
  let matches = thaiMatcher.search(cleaned);
  if (matches.length === 0) {
    // Preserve the package's fallback for vowel/tone/repetition evasion, while
    // updating the position map when characters are removed.
    let normalized = "";
    const normalizedPositions: number[] = [];
    for (let index = 0; index < cleaned.length; index++) {
      const char = cleaned[index];
      if (/[ุิี่้๊๋ๆ์]/.test(char)) continue;
      if (/[โใไ]/.test(char) && normalized.endsWith(char)) continue;
      normalized += char;
      normalizedPositions.push(positions[index]);
    }
    matches = thaiMatcher.search(normalized);
    positions.splice(0, positions.length, ...normalizedPositions);
  }
  matches.sort((a, b) => a.position - b.position || b.length - a.length);
  let end = -1;
  return matches.flatMap((match) => {
    if (match.position < end) return [];
    end = match.position + match.length;
    return [source.slice(positions[match.position], positions[end - 1] + 1)];
  });
}

export function detectProhibitedWords(comment: string): string[] {
  const englishText = comment.replace(/[^\x00-\x7F]/g, " ");
  const english = englishMatcher.getAllMatches(englishText).map((match) =>
    comment.slice(match.startIndex, match.endIndex + 1),
  );
  return [...new Set([...thaiMatches(comment), ...english])];
}
