import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import {
  ClientToServerEvents,
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ServerToClientEvents,
  StartGameResponse,
  SubmitGuessRequest,
  SubmitGuessResponse
} from '../shared/types';
import { FlagRepository } from '../game/FlagRepository';
import { Room } from '../game/Room';
import { RoomManager } from '../game/RoomManager';

const PORT = Number(process.env.PORT ?? 3000);
const GAME_START_COUNTDOWN_SECONDS = 3;
const ROUND_TRANSITION_SECONDS = 2;

const app = express();
const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

const flagRepository = new FlagRepository();
const roomManager = new RoomManager(flagRepository);

const countdownTimers = new Map<string, NodeJS.Timeout>();

function sanitizeNickname(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : fallback;
}

function ensureSettings(request?: CreateRoomRequest['settings']): CreateRoomRequest['settings'] {
  if (!request) {
    return { totalRounds: 5, roundTimeSeconds: 15 };
  }
  const totalRounds = Number.isFinite(request.totalRounds) ? Number(request.totalRounds) : 5;
  const roundTimeSeconds = Number.isFinite(request.roundTimeSeconds)
    ? Number(request.roundTimeSeconds)
    : 15;
  return { totalRounds, roundTimeSeconds };
}

function emitRoomState(room: Room): void {
  io.to(room.roomCode).emit('room:state', room.snapshot());
}

function clearCountdown(roomCode: string): void {
  const handle = countdownTimers.get(roomCode);
  if (handle) {
    clearTimeout(handle);
    countdownTimers.delete(roomCode);
  }
}

function scheduleRound(room: Room, delaySeconds: number): void {
  clearCountdown(room.roomCode);
  const handle = setTimeout(() => startRound(room), delaySeconds * 1000);
  countdownTimers.set(room.roomCode, handle);
}

function startRound(room: Room): void {
  clearCountdown(room.roomCode);
  const round = room.beginNextRound(Date.now());
  if (!round) {
    io.to(room.roomCode).emit('game:finished', { finalScores: room.activePlayers() });
    emitRoomState(room);
    return;
  }
  io.to(room.roomCode).emit('round:started', round);
  emitRoomState(room);
  const timer = setTimeout(() => finishRound(room), room.currentSettings().roundTimeSeconds * 1000);
  room.setTimer(timer);
}

function finishRound(room: Room): void {
  if (room.getPhase() !== 'inRound') {
    return;
  }
  const summary = room.completeRound(Date.now());
  io.to(room.roomCode).emit('round:ended', summary);
  emitRoomState(room);
  if (room.getPhase() === 'countdown') {
    io.to(room.roomCode).emit('game:starting', { countdownSeconds: ROUND_TRANSITION_SECONDS });
    scheduleRound(room, ROUND_TRANSITION_SECONDS);
    return;
  }
  io.to(room.roomCode).emit('game:finished', { finalScores: room.activePlayers() });
}

function respondWithError<T extends { ok: boolean; message?: string }>(
  callback: (response: T) => void,
  message: string
): void {
  callback({ ok: false, message } as T);
}

io.on('connection', (socket) => {
  socket.on('room:create', (payload: CreateRoomRequest, callback: (response: CreateRoomResponse) => void) => {
    try {
      const settings = ensureSettings(payload?.settings);
      const nickname = sanitizeNickname(payload?.nickname, 'Host');
      const room = roomManager.createRoom(socket.id, nickname, settings);
      socket.join(room.roomCode);
      const snapshot = room.snapshot();
      callback({ ok: true, roomCode: room.roomCode, snapshot });
      socket.emit('room:created', snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create room';
      respondWithError(callback, message);
    }
  });

  socket.on('room:join', (payload: JoinRoomRequest, callback: (response: JoinRoomResponse) => void) => {
    try {
      const roomCode = payload?.roomCode?.trim().toUpperCase();
      if (!roomCode) {
        respondWithError(callback, 'Room code is required');
        return;
      }
      const nickname = sanitizeNickname(payload?.nickname, 'Guest');
      const { room, player } = roomManager.joinRoom(roomCode, socket.id, nickname);
      socket.join(room.roomCode);
      const snapshot = room.snapshot();
      callback({ ok: true, snapshot });
      io.to(room.roomCode).emit('player:joined', player);
      emitRoomState(room);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join room';
      respondWithError(callback, message);
    }
  });

  socket.on('game:start', (callback: (response: StartGameResponse) => void) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) {
      respondWithError(callback, 'You are not in a room');
      return;
    }
    if (!room.isHost(socket.id)) {
      respondWithError(callback, 'Only the host can start the game');
      return;
    }
    if (room.playerCount() < 2) {
      respondWithError(callback, 'Invite a friend before starting');
      return;
    }

    try {
      const rounds = roomManager.drawRounds(room.currentSettings());
      room.startGame(rounds);
      emitRoomState(room);
      io.to(room.roomCode).emit('game:starting', { countdownSeconds: GAME_START_COUNTDOWN_SECONDS });
      scheduleRound(room, GAME_START_COUNTDOWN_SECONDS);
      callback({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start game';
      respondWithError(callback, message);
    }
  });

  socket.on('round:submitGuess', (payload: SubmitGuessRequest, callback: (response: SubmitGuessResponse) => void) => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) {
      respondWithError(callback, 'No room associated with this player');
      return;
    }
    const guess = payload?.guess ?? '';
    const result = room.recordGuess(socket.id, guess, Date.now());
    if (!result) {
      respondWithError(callback, 'Unable to record guess');
      return;
    }
    if (room.everyoneAnswered()) {
      finishRound(room);
    }
    callback({ ok: true });
  });

  socket.on('disconnect', () => {
    const room = roomManager.getRoomByPlayer(socket.id);
    if (!room) {
      return;
    }
    const roomCode = room.roomCode;
    room.clearTimer();
    clearCountdown(roomCode);

    if (room.getHostId() === socket.id) {
      io.to(roomCode).emit('room:closed', { message: 'Host ended the match' });
      const players = room.activePlayers();
      for (const player of players) {
        roomManager.leaveRoom(player.id);
      }
      io.in(roomCode).socketsLeave(roomCode);
      return;
    }

    roomManager.leaveRoom(socket.id);
    if (room.getPhase() === 'inRound') {
      finishRound(room);
    }
    io.to(roomCode).emit('player:left', { playerId: socket.id });
    const snapshot = roomManager.snapshot(roomCode);
    if (snapshot) {
      io.to(roomCode).emit('room:state', snapshot);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Flag Dash server listening on port ${PORT}`);
});
