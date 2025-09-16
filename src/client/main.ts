import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  CreateRoomResponse,
  JoinRoomResponse,
  PlayerSummary,
  RoomSnapshot,
  RoundResultPayload,
  ServerToClientEvents
} from '../shared/types';

interface AppState {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  isHost: boolean;
  nickname: string;
  roomCode: string | null;
  roundEndsAt: number | null;
  timerInterval: number | null;
  hasSubmittedGuess: boolean;
}

const state: AppState = {
  socket: io(),
  isHost: false,
  nickname: '',
  roomCode: null,
  roundEndsAt: null,
  timerInterval: null,
  hasSubmittedGuess: false
};

const createForm = document.getElementById('create-form') as HTMLFormElement | null;
const joinForm = document.getElementById('join-form') as HTMLFormElement | null;
const lobbySection = document.getElementById('lobby') as HTMLElement | null;
const lobbyError = document.getElementById('lobby-error') as HTMLElement | null;
const inviteHint = document.getElementById('invite-hint') as HTMLElement | null;
const gameSection = document.getElementById('game') as HTMLElement | null;
const gameStatus = document.getElementById('game-status') as HTMLElement | null;
const scoreboard = document.getElementById('scoreboard') as HTMLElement | null;
const roomCodeDisplay = document.getElementById('room-code-display') as HTMLElement | null;
const startButton = document.getElementById('start-button') as HTMLButtonElement | null;
const copyLinkButton = document.getElementById('copy-link-button') as HTMLButtonElement | null;
const flagCard = document.getElementById('flag-card') as HTMLElement | null;
const flagEmoji = document.getElementById('flag-emoji') as HTMLElement | null;
const roundTimer = document.getElementById('round-timer') as HTMLElement | null;
const guessForm = document.getElementById('guess-form') as HTMLFormElement | null;
const guessInput = document.getElementById('guess-input') as HTMLInputElement | null;
const guessError = document.getElementById('guess-error') as HTMLElement | null;
const roundResults = document.getElementById('round-results') as HTMLElement | null;
const gameError = document.getElementById('game-error') as HTMLElement | null;

function setLobbyError(message: string): void {
  if (lobbyError) {
    lobbyError.textContent = message;
  }
}

function setGameError(message: string): void {
  if (gameError) {
    gameError.textContent = message;
  }
}

function setGuessError(message: string): void {
  if (guessError) {
    guessError.textContent = message;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toggleLobby(visible: boolean): void {
  if (lobbySection) {
    lobbySection.hidden = !visible;
  }
}

function toggleGame(visible: boolean): void {
  if (gameSection) {
    gameSection.hidden = !visible;
  }
}

function updateScoreboard(players: PlayerSummary[]): void {
  if (!scoreboard) {
    return;
  }
  scoreboard.innerHTML = '';
  players.forEach((player) => {
    const card = document.createElement('div');
    card.className = 'score-card';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = player.nickname;

    const score = document.createElement('div');
    score.className = 'score';
    score.textContent = player.score.toString();

    card.appendChild(name);
    card.appendChild(score);
    scoreboard.appendChild(card);
  });
}

function updateRoomStatus(snapshot: RoomSnapshot): void {
  if (roomCodeDisplay) {
    roomCodeDisplay.textContent = `Room code: ${snapshot.roomCode}`;
  }
  if (startButton) {
    startButton.hidden = !state.isHost;
    startButton.disabled = snapshot.players.length < 2 || snapshot.phase !== 'lobby';
  }
  const shareLink = `${window.location.origin}?room=${snapshot.roomCode}`;
  if (copyLinkButton) {
    copyLinkButton.disabled = false;
    copyLinkButton.dataset.link = shareLink;
  }
  if (inviteHint) {
    inviteHint.textContent = `Invite link: ${shareLink}`;
  }
  updateScoreboard(snapshot.players);
}

function resetRoundUi(): void {
  if (flagCard) {
    flagCard.hidden = true;
  }
  if (roundResults) {
    roundResults.hidden = true;
    roundResults.innerHTML = '';
  }
  setGuessError('');
  if (guessInput) {
    guessInput.value = '';
    guessInput.disabled = false;
  }
  if (guessForm) {
    guessForm.dataset.submitted = 'false';
  }
  state.hasSubmittedGuess = false;
  stopTimer();
}

function enterRoom(snapshot: RoomSnapshot, isHost: boolean): void {
  state.isHost = isHost;
  state.roomCode = snapshot.roomCode;
  toggleLobby(false);
  toggleGame(true);
  setLobbyError('');
  resetRoundUi();
  updateRoomStatus(snapshot);
  if (gameStatus) {
    gameStatus.textContent = 'Waiting for players…';
  }
}

function formatResultRow(result: RoundResultPayload, correctAnswer: string): HTMLElement {
  const row = document.createElement('div');
  row.className = `result-row ${result.isCorrect ? 'success' : 'fail'}`;

  const name = document.createElement('div');
  name.textContent = result.nickname;

  const guess = document.createElement('div');
  guess.textContent = result.guess ? result.guess : 'No guess';

  const score = document.createElement('div');
  score.textContent = result.isCorrect
    ? `+${result.pointsAwarded}`
    : `0 • Answer: ${correctAnswer}`;

  row.appendChild(name);
  row.appendChild(guess);
  row.appendChild(score);
  return row;
}

function stopTimer(): void {
  if (state.timerInterval !== null) {
    window.clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  state.roundEndsAt = null;
}

function startTimer(endTimestamp: number): void {
  state.roundEndsAt = endTimestamp;
  if (!roundTimer) {
    return;
  }
  if (state.timerInterval !== null) {
    window.clearInterval(state.timerInterval);
  }
  const update = () => {
    if (!state.roundEndsAt) {
      return;
    }
    const remaining = Math.max(0, state.roundEndsAt - Date.now());
    roundTimer.textContent = `${(remaining / 1000).toFixed(1)}s`;
  };
  update();
  state.timerInterval = window.setInterval(update, 100);
}

function handleRoundStarted(payload: {
  roundNumber: number;
  totalRounds: number;
  flag: { emoji: string };
  roundEndsAt: number;
}): void {
  if (gameStatus) {
    gameStatus.textContent = `Round ${payload.roundNumber} of ${payload.totalRounds}`;
  }
  if (flagCard && flagEmoji) {
    flagCard.hidden = false;
    flagEmoji.textContent = payload.flag.emoji;
  }
  if (roundResults) {
    roundResults.hidden = true;
    roundResults.innerHTML = '';
  }
  setGuessError('');
  if (guessInput) {
    guessInput.disabled = false;
    guessInput.value = '';
    guessInput.focus();
  }
  state.hasSubmittedGuess = false;
  startTimer(payload.roundEndsAt);
}

function handleRoundEnded(payload: {
  roundNumber: number;
  correctAnswer: string;
  results: RoundResultPayload[];
}): void {
  stopTimer();
  if (gameStatus) {
    gameStatus.textContent = `Round ${payload.roundNumber} complete`;
  }
  if (roundResults) {
    roundResults.hidden = false;
    roundResults.innerHTML = '';
    payload.results.forEach((result) => {
      roundResults.appendChild(formatResultRow(result, payload.correctAnswer));
    });
  }
  if (guessInput) {
    guessInput.disabled = true;
  }
}

function handleGameFinished(finalScores: PlayerSummary[]): void {
  stopTimer();
  if (gameStatus) {
    gameStatus.textContent = 'Match complete';
  }
  updateScoreboard(finalScores);
}

function copyInviteLink(): void {
  if (!state.roomCode) {
    return;
  }
  const link = `${window.location.origin}?room=${state.roomCode}`;
  void navigator.clipboard?.writeText(link);
}

function attachEventHandlers(): void {
  if (createForm) {
    createForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const nicknameInput = createForm.querySelector('#create-nickname') as HTMLInputElement | null;
      const roundsInput = createForm.querySelector('#round-count') as HTMLInputElement | null;
      const secondsInput = createForm.querySelector('#round-duration') as HTMLInputElement | null;
      const nickname = nicknameInput?.value.trim() ?? 'Host';
      const rounds = clamp(Number(roundsInput?.value ?? 5), 1, 20);
      const seconds = clamp(Number(secondsInput?.value ?? 15), 5, 60);
      state.nickname = nickname || 'Host';
      state.socket.emit(
        'room:create',
        { nickname: state.nickname, settings: { totalRounds: rounds, roundTimeSeconds: seconds } },
        (response: CreateRoomResponse) => {
          if (!response.ok || !response.snapshot || !response.roomCode) {
            setLobbyError(response.message ?? 'Unable to create room');
            return;
          }
          enterRoom(response.snapshot, true);
          setLobbyError('');
        }
      );
    });
  }

  if (joinForm) {
    joinForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const nicknameInput = joinForm.querySelector('#join-nickname') as HTMLInputElement | null;
      const codeInput = joinForm.querySelector('#room-code') as HTMLInputElement | null;
      const nickname = nicknameInput?.value.trim() ?? 'Guest';
      const roomCode = (codeInput?.value.trim() ?? '').toUpperCase();
      if (!roomCode) {
        setLobbyError('Enter a room code to join');
        return;
      }
      state.nickname = nickname || 'Guest';
      state.socket.emit(
        'room:join',
        { roomCode, nickname: state.nickname },
        (response: JoinRoomResponse) => {
          if (!response.ok || !response.snapshot) {
            setLobbyError(response.message ?? 'Unable to join room');
            return;
          }
          enterRoom(response.snapshot, false);
          setLobbyError('');
        }
      );
    });
  }

  if (startButton) {
    startButton.addEventListener('click', () => {
      state.socket.emit('game:start', (response) => {
        if (!response.ok) {
          setGameError(response.message ?? 'Unable to start game');
        } else {
          setGameError('');
        }
      });
    });
  }

  if (copyLinkButton) {
    copyLinkButton.addEventListener('click', () => {
      copyInviteLink();
    });
  }

  if (guessForm) {
    guessForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (state.hasSubmittedGuess) {
        return;
      }
      const guess = guessInput?.value.trim() ?? '';
      state.socket.emit('round:submitGuess', { guess }, (response) => {
        if (!response.ok) {
          setGuessError(response.message ?? 'Guess rejected');
          return;
        }
        state.hasSubmittedGuess = true;
        if (guessInput) {
          guessInput.disabled = true;
        }
        setGuessError('Guess submitted!');
      });
    });
  }
}

function setupSocket(): void {
  state.socket.on('room:created', (snapshot) => {
    enterRoom(snapshot, true);
  });

  state.socket.on('room:state', (snapshot) => {
    updateRoomStatus(snapshot);
  });

  state.socket.on('player:joined', () => {
    if (gameStatus) {
      gameStatus.textContent = 'Both players ready. Host can start the match.';
    }
  });

  state.socket.on('player:left', () => {
    if (gameStatus) {
      gameStatus.textContent = 'Your opponent left the room.';
    }
  });

  state.socket.on('room:closed', (payload) => {
    setGameError(payload.message);
    if (startButton) {
      startButton.disabled = true;
    }
    resetRoundUi();
    stopTimer();
  });

  state.socket.on('room:error', (payload) => {
    setGameError(payload.message);
  });

  state.socket.on('game:starting', (payload) => {
    if (gameStatus) {
      gameStatus.textContent = `Next round begins in ${payload.countdownSeconds}s`;
    }
    stopTimer();
    if (guessInput) {
      guessInput.disabled = true;
    }
  });

  state.socket.on('round:started', (payload) => {
    setGameError('');
    handleRoundStarted(payload);
  });

  state.socket.on('round:ended', (payload) => {
    handleRoundEnded(payload);
  });

  state.socket.on('game:finished', (payload) => {
    handleGameFinished(payload.finalScores);
  });
}

function hydrateFromQuery(): void {
  const params = new URLSearchParams(window.location.search);
  const roomFromUrl = params.get('room');
  if (roomFromUrl) {
    const roomCodeField = document.getElementById('room-code') as HTMLInputElement | null;
    if (roomCodeField) {
      roomCodeField.value = roomFromUrl;
    }
    if (inviteHint) {
      inviteHint.textContent = `Joining room ${roomFromUrl}`;
    }
  }
}

hydrateFromQuery();
attachEventHandlers();
setupSocket();
