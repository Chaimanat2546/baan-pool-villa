type RandomCrypto = Pick<Crypto, "getRandomValues">;

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
const PRINTABLE_NONSPACE_ASCII = `${LOWERCASE}${UPPERCASE}${DIGITS}${SYMBOLS}`;
const PASSWORD_LENGTH = 20;

function randomIndex(crypto: RandomCrypto, upperExclusive: number): number {
  const limit = 256 - (256 % upperExclusive);
  const bytes = new Uint8Array(1);

  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= limit);

  return bytes[0] % upperExclusive;
}

function randomCharacter(crypto: RandomCrypto, alphabet: string): string {
  return alphabet[randomIndex(crypto, alphabet.length)];
}

function resolveCrypto(injectedCrypto?: RandomCrypto): RandomCrypto {
  if (injectedCrypto) {
    return injectedCrypto;
  }

  if (!globalThis.crypto) {
    throw new Error("Web Crypto is required to generate a temporary password.");
  }

  return globalThis.crypto;
}

export function generateTemporaryPassword(injectedCrypto?: RandomCrypto): string {
  const crypto = resolveCrypto(injectedCrypto);
  const characters = [
    randomCharacter(crypto, LOWERCASE),
    randomCharacter(crypto, UPPERCASE),
    randomCharacter(crypto, DIGITS),
    randomCharacter(crypto, SYMBOLS),
  ];

  while (characters.length < PASSWORD_LENGTH) {
    characters.push(randomCharacter(crypto, PRINTABLE_NONSPACE_ASCII));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(crypto, index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}
