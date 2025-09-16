import { describe, it, expect } from 'vitest';
import { FuzzyMatcher } from '../src/game/FuzzyMatcher';
import { Room } from '../src/game/Room';
import { ScoreCalculator } from '../src/game/ScoreCalculator';

const createRoom = () =>
  new Room('ABC123', 'host', { totalRounds: 1, roundTimeSeconds: 15 }, new ScoreCalculator(), new FuzzyMatcher());

describe('Room', () => {
  it('awards positive points when a player answers correctly', () => {
    // Arrange
    const room = createRoom();
    room.addPlayer('host', 'Host');
    room.addPlayer('guest', 'Guest');
    room.startGame([{ code: 'AR', emoji: '🇦🇷', name: 'Argentina' }]);
    room.beginNextRound(0);

    // Act
    const result = room.recordGuess('guest', 'Argentina', 4000);

    // Assert
    expect(result?.pointsAwarded ?? 0).toBeGreaterThan(0);
  });

  it('assigns zero points to players without a guess when the round ends', () => {
    // Arrange
    const room = createRoom();
    room.addPlayer('host', 'Host');
    room.addPlayer('guest', 'Guest');
    room.startGame([{ code: 'BR', emoji: '🇧🇷', name: 'Brazil' }]);
    room.beginNextRound(0);
    room.recordGuess('host', 'Brazil', 2000);

    // Act
    const summary = room.completeRound(15000);
    const guestResult = summary.results.find((result) => result.playerId === 'guest');

    // Assert
    expect(guestResult?.pointsAwarded).toBe(0);
  });
});
