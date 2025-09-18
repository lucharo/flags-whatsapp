export interface GameSettings {
  totalRounds: number;
  roundTimeSeconds: number;
}

export interface FlagData {
  code: string;
  name: string;
  emoji: string;
}

export interface PlayerSummary {
  id: string;
  nickname: string;
  score: number;
}

export interface RoundResultPayload {
  playerId: string;
  nickname: string;
  guess: string;
  isCorrect: boolean;
  elapsedMs: number;
  pointsAwarded: number;
}

export type RoomPhase = 'lobby' | 'countdown' | 'inRound' | 'complete';

export interface RoomSnapshot {
  roomCode: string;
  players: PlayerSummary[];
  settings: GameSettings;
  phase: RoomPhase;
  hostId: string;
}

export interface ErrorPayload {
  message: string;
}

export interface CreateRoomRequest {
  nickname: string;
  settings: GameSettings;
}

export interface JoinRoomRequest {
  roomCode: string;
  nickname: string;
}

export interface SubmitGuessRequest {
  guess: string;
}

export interface CreateRoomResponse {
  ok: boolean;
  roomCode?: string;
  snapshot?: RoomSnapshot;
  message?: string;
}

export interface JoinRoomResponse {
  ok: boolean;
  snapshot?: RoomSnapshot;
  message?: string;
}

export interface StartGameResponse {
  ok: boolean;
  message?: string;
}

export interface SubmitGuessResponse {
  ok: boolean;
  message?: string;
}

export interface ServerToClientEvents {
  'room:created': (payload: RoomSnapshot) => void;
  'room:state': (payload: RoomSnapshot) => void;
  'room:error': (payload: ErrorPayload) => void;
  'room:closed': (payload: ErrorPayload) => void;
  'player:joined': (payload: PlayerSummary) => void;
  'player:left': (payload: { playerId: string }) => void;
  'game:starting': (payload: { countdownSeconds: number }) => void;
  'round:started': (payload: {
    roundNumber: number;
    totalRounds: number;
    flag: { emoji: string };
    roundEndsAt: number;
  }) => void;
  'round:ended': (payload: {
    roundNumber: number;
    correctAnswer: string;
    results: RoundResultPayload[];
  }) => void;
  'game:finished': (payload: { finalScores: PlayerSummary[] }) => void;
}

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomRequest, callback: (response: CreateRoomResponse) => void) => void;
  'room:join': (payload: JoinRoomRequest, callback: (response: JoinRoomResponse) => void) => void;
  'game:start': (callback: (response: StartGameResponse) => void) => void;
  'round:submitGuess': (payload: SubmitGuessRequest, callback: (response: SubmitGuessResponse) => void) => void;
}
