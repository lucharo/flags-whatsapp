import { describe, it, expect } from 'vitest';
import { FlagRepository } from '../src/game/FlagRepository';
import { RoomManager } from '../src/game/RoomManager';

describe('RoomManager', () => {
  it('clamps total rounds to the maximum allowed limit', () => {
    // Arrange
    const manager = new RoomManager(new FlagRepository());

    // Act
    const room = manager.createRoom('host-a', 'Host', { totalRounds: 99, roundTimeSeconds: 15 });
    const settings = room.currentSettings();

    // Assert
    expect(settings.totalRounds).toBe(20);
  });

  it('raises the round duration to the minimum supported seconds', () => {
    // Arrange
    const manager = new RoomManager(new FlagRepository());

    // Act
    const room = manager.createRoom('host-b', 'Host', { totalRounds: 3, roundTimeSeconds: 1 });
    const settings = room.currentSettings();

    // Assert
    expect(settings.roundTimeSeconds).toBe(5);
  });
});
