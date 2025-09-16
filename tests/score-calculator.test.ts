import { describe, it, expect } from 'vitest';
import { ScoreCalculator } from '../src/game/ScoreCalculator';

describe('ScoreCalculator', () => {
  it('rewards faster responses with higher scores', () => {
    // Arrange
    const calculator = new ScoreCalculator();
    const roundLengthSeconds = 15;

    // Act
    const fastScore = calculator.score(2000, roundLengthSeconds, true);
    const slowScore = calculator.score(12000, roundLengthSeconds, true);

    // Assert
    expect(fastScore).toBeGreaterThan(slowScore);
  });
});
