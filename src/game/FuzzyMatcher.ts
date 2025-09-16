export class FuzzyMatcher {
  constructor(private readonly toleranceRatio = 0.3) {}

  isMatch(guess: string, expected: string): boolean {
    const sanitizedGuess = this.sanitize(guess);
    const sanitizedExpected = this.sanitize(expected);

    if (!sanitizedGuess || !sanitizedExpected) {
      return false;
    }

    if (sanitizedGuess === sanitizedExpected) {
      return true;
    }

    if (sanitizedExpected.includes(sanitizedGuess)) {
      return true;
    }

    const distance = this.distance(sanitizedGuess, sanitizedExpected);
    const maxLength = Math.max(sanitizedGuess.length, sanitizedExpected.length);
    const threshold = Math.max(1, Math.floor(maxLength * this.toleranceRatio));
    return distance <= threshold;
  }

  private sanitize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private distance(a: string, b: string): number {
    if (a === b) {
      return 0;
    }
    if (a.length === 0) {
      return b.length;
    }
    if (b.length === 0) {
      return a.length;
    }

    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix: number[][] = Array.from({ length: rows }, () => new Array<number>(cols));

    for (let i = 0; i < rows; i += 1) {
      matrix[i][0] = i;
    }
    for (let j = 0; j < cols; j += 1) {
      matrix[0][j] = j;
    }

    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[rows - 1][cols - 1];
  }
}
