import { describe, it, expect } from 'vitest';
import { FlagRepository } from '../src/game/FlagRepository';

const repository = new FlagRepository();

describe('FlagRepository', () => {
  it('returns a unique set of flags for a requested round size', () => {
    // Arrange
    const requestedFlags = 5;

    // Act
    const selection = repository.randomSelection(requestedFlags);

    // Assert
    expect(new Set(selection.map((flag) => flag.code)).size).toBe(requestedFlags);
  });
});
