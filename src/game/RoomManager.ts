import { randomInt } from 'node:crypto';
import { FlagData, GameSettings, PlayerSummary, RoomSnapshot } from '../shared/types';
import { FlagRepository } from './FlagRepository';
import { FuzzyMatcher } from './FuzzyMatcher';
import { Room } from './Room';
import { ScoreCalculator } from './ScoreCalculator';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const MIN_ROUND_TIME = 5;
const MAX_ROUND_TIME = 60;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 20;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  private readonly playerRoom = new Map<string, string>();

  constructor(
    private readonly flags: FlagRepository,
    private readonly calculator = new ScoreCalculator(),
    private readonly matcher = new FuzzyMatcher()
  ) {}

  createRoom(hostId: string, nickname: string, settings: GameSettings): Room {
    const sanitized = this.sanitizeSettings(settings);
    const roomCode = this.generateRoomCode();
    const room = new Room(roomCode, hostId, sanitized, this.calculator, this.matcher);
    room.addPlayer(hostId, nickname || 'Host');
    this.rooms.set(roomCode, room);
    this.playerRoom.set(hostId, roomCode);
    return room;
  }

  joinRoom(
    roomCode: string,
    playerId: string,
    nickname: string
  ): { room: Room; player: PlayerSummary } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room does not exist');
    }
    if (room.getPhase() !== 'lobby') {
      throw new Error('Game already started');
    }
    if (room.hasPlayer(playerId)) {
      return {
        room,
        player: room.activePlayers().find((player) => player.id === playerId) ?? {
          id: playerId,
          nickname,
          score: 0
        }
      };
    }
    if (room.playerCount() >= 2) {
      throw new Error('Room already has two players');
    }
    const player = room.addPlayer(playerId, nickname || 'Challenger');
    this.playerRoom.set(playerId, roomCode);
    return {
      room,
      player: {
        id: player.id,
        nickname: player.nickname,
        score: player.score
      }
    };
  }

  leaveRoom(playerId: string): void {
    const roomCode = this.playerRoom.get(playerId);
    if (!roomCode) {
      return;
    }
    const room = this.rooms.get(roomCode);
    this.playerRoom.delete(playerId);
    if (!room) {
      return;
    }
    room.removePlayer(playerId);
    if (room.isEmpty()) {
      this.rooms.delete(roomCode);
    }
  }

  disconnectPlayer(playerId: string): Room | undefined {
    const room = this.getRoomByPlayer(playerId);
    if (!room) {
      return undefined;
    }
    room.markDisconnected(playerId);
    return room;
  }

  reconnectPlayer(playerId: string): Room | undefined {
    const room = this.getRoomByPlayer(playerId);
    if (!room) {
      return undefined;
    }
    room.markReconnected(playerId);
    return room;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  getRoomByPlayer(playerId: string): Room | undefined {
    const roomCode = this.playerRoom.get(playerId);
    if (!roomCode) {
      return undefined;
    }
    return this.rooms.get(roomCode);
  }

  snapshot(roomCode: string): RoomSnapshot | undefined {
    const room = this.rooms.get(roomCode);
    return room?.snapshot();
  }

  drawRounds(settings: GameSettings): FlagData[] {
    return this.flags.randomSelection(settings.totalRounds);
  }

  private sanitizeSettings(settings: GameSettings): GameSettings {
    const totalRounds = this.clamp(Math.round(settings.totalRounds), MIN_ROUNDS, MAX_ROUNDS);
    const roundTimeSeconds = this.clamp(
      Math.round(settings.roundTimeSeconds),
      MIN_ROUND_TIME,
      MAX_ROUND_TIME
    );
    return { totalRounds, roundTimeSeconds };
  }

  private generateRoomCode(): string {
    let attempt = '';
    do {
      attempt = Array.from({ length: ROOM_CODE_LENGTH }, () => {
        const index = randomInt(0, ROOM_CODE_ALPHABET.length);
        return ROOM_CODE_ALPHABET[index];
      }).join('');
    } while (this.rooms.has(attempt));
    return attempt;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
