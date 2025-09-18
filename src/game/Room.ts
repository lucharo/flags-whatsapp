import { FlagData, GameSettings, PlayerSummary, RoomPhase, RoundResultPayload } from '../shared/types';
import { FuzzyMatcher } from './FuzzyMatcher';
import { ScoreCalculator } from './ScoreCalculator';

interface PlayerState extends PlayerSummary {
  connected: boolean;
}

interface RoundResponseState {
  guess: string;
  isCorrect: boolean;
  elapsedMs: number;
  pointsAwarded: number;
}

export class Room {
  private phase: RoomPhase = 'lobby';

  private rounds: FlagData[] = [];

  private currentRoundIndex = -1;

  private currentRoundStartedAt = 0;

  private roundResponses = new Map<string, RoundResponseState>();

  private roundTimer?: NodeJS.Timeout;

  constructor(
    public readonly roomCode: string,
    private readonly hostId: string,
    private readonly settings: GameSettings,
    private readonly scoreCalculator: ScoreCalculator,
    private readonly matcher: FuzzyMatcher,
    private readonly players = new Map<string, PlayerState>()
  ) {}

  addPlayer(id: string, nickname: string): PlayerState {
    if (this.players.size >= 2) {
      throw new Error('Room is already full');
    }
    const player: PlayerState = { id, nickname, score: 0, connected: true };
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  markDisconnected(id: string): void {
    const player = this.players.get(id);
    if (player) {
      player.connected = false;
    }
  }

  markReconnected(id: string): void {
    const player = this.players.get(id);
    if (player) {
      player.connected = true;
    }
  }

  isHost(id: string): boolean {
    return this.hostId === id;
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  connectedPlayers(): PlayerState[] {
    return Array.from(this.players.values()).filter((player) => player.connected);
  }

  snapshot(): {
    roomCode: string;
    players: PlayerSummary[];
    settings: GameSettings;
    phase: RoomPhase;
    hostId: string;
  } {
    return {
      roomCode: this.roomCode,
      settings: { ...this.settings },
      phase: this.phase,
      hostId: this.hostId,
      players: Array.from(this.players.values()).map(({ id, nickname, score }) => ({
        id,
        nickname,
        score
      }))
    };
  }

  startGame(rounds: FlagData[]): void {
    if (rounds.length === 0) {
      throw new Error('Cannot start game without rounds');
    }
    this.rounds = rounds;
    this.phase = 'countdown';
    this.currentRoundIndex = -1;
    this.roundResponses.clear();
  }

  beginNextRound(startTimestamp: number): {
    roundNumber: number;
    totalRounds: number;
    flag: { emoji: string };
    roundEndsAt: number;
  } | null {
    if (this.rounds.length === 0) {
      return null;
    }
    if (this.currentRoundIndex + 1 >= this.rounds.length) {
      this.phase = 'complete';
      return null;
    }
    this.currentRoundIndex += 1;
    this.roundResponses = new Map();
    this.currentRoundStartedAt = startTimestamp;
    this.phase = 'inRound';
    const activeFlag = this.rounds[this.currentRoundIndex];
    const roundEndsAt = startTimestamp + this.settings.roundTimeSeconds * 1000;
    return {
      roundNumber: this.currentRoundIndex + 1,
      totalRounds: this.rounds.length,
      flag: { emoji: activeFlag.emoji },
      roundEndsAt
    };
  }

  completeRound(endTimestamp: number): {
    roundNumber: number;
    correctAnswer: string;
    results: RoundResultPayload[];
  } {
    const flag = this.rounds[this.currentRoundIndex];
    const results: RoundResultPayload[] = [];
    for (const player of this.players.values()) {
      const response = this.roundResponses.get(player.id);
      if (response) {
        results.push({
          playerId: player.id,
          nickname: player.nickname,
          guess: response.guess,
          isCorrect: response.isCorrect,
          elapsedMs: response.elapsedMs,
          pointsAwarded: response.pointsAwarded
        });
        continue;
      }
      results.push({
        playerId: player.id,
        nickname: player.nickname,
        guess: '',
        isCorrect: false,
        elapsedMs: Math.max(0, endTimestamp - this.currentRoundStartedAt),
        pointsAwarded: 0
      });
    }

    this.phase = this.currentRoundIndex + 1 >= this.rounds.length ? 'complete' : 'countdown';
    this.roundResponses.clear();
    this.clearTimer();
    return {
      roundNumber: this.currentRoundIndex + 1,
      correctAnswer: flag.name,
      results: results.sort((a, b) => b.pointsAwarded - a.pointsAwarded)
    };
  }

  recordGuess(playerId: string, guess: string, submittedAt: number): RoundResultPayload | undefined {
    if (this.phase !== 'inRound') {
      return undefined;
    }
    if (this.roundResponses.has(playerId)) {
      return undefined;
    }
    const player = this.players.get(playerId);
    if (!player) {
      return undefined;
    }
    const currentFlag = this.rounds[this.currentRoundIndex];
    const elapsedMs = submittedAt - this.currentRoundStartedAt;
    const isCorrect = this.matcher.isMatch(guess, currentFlag.name);
    const pointsAwarded = this.scoreCalculator.score(elapsedMs, this.settings.roundTimeSeconds, isCorrect);
    player.score += pointsAwarded;
    const response: RoundResponseState = {
      guess,
      isCorrect,
      elapsedMs,
      pointsAwarded
    };
    this.roundResponses.set(playerId, response);
    return {
      playerId,
      nickname: player.nickname,
      guess,
      isCorrect,
      elapsedMs,
      pointsAwarded
    };
  }

  everyoneAnswered(): boolean {
    return this.roundResponses.size === this.players.size;
  }

  activePlayers(): PlayerSummary[] {
    return Array.from(this.players.values()).map(({ id, nickname, score }) => ({
      id,
      nickname,
      score
    }));
  }

  playerCount(): number {
    return this.players.size;
  }

  currentSettings(): GameSettings {
    return { ...this.settings };
  }

  hasPlayer(id: string): boolean {
    return this.players.has(id);
  }

  getHostId(): string {
    return this.hostId;
  }

  getPhase(): RoomPhase {
    return this.phase;
  }

  setTimer(handle: NodeJS.Timeout): void {
    this.roundTimer = handle;
  }

  clearTimer(): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = undefined;
    }
  }
}
