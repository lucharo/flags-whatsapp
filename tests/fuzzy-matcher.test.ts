import { describe, it, expect } from 'vitest';
import { FuzzyMatcher } from '../src/game/FuzzyMatcher';

describe('FuzzyMatcher', () => {
  it('matches strings with minor spelling variations for country names', () => {
    // Arrange
    const matcher = new FuzzyMatcher();
    const guess = 'Argentin';
    const expected = 'Argentina';

    // Act
    const result = matcher.isMatch(guess, expected);

    // Assert
    expect(result).toBe(true);
  });

  it('rejects guesses that differ significantly from the expected country', () => {
    // Arrange
    const matcher = new FuzzyMatcher();
    const guess = 'Brazil';
    const expected = 'France';

    // Act
    const result = matcher.isMatch(guess, expected);

    // Assert
    expect(result).toBe(false);
  });
});
