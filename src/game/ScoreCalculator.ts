export class ScoreCalculator {
  constructor(private readonly maxPoints = 1000) {}

  score(elapsedMs: number, roundTimeSeconds: number, isCorrect: boolean): number {
    if (!isCorrect) {
      return 0;
    }
    if (roundTimeSeconds <= 0) {
      return 0;
    }

    const roundDurationMs = roundTimeSeconds * 1000;
    const clampedElapsed = Math.min(Math.max(elapsedMs, 0), roundDurationMs);
    const remainingRatio = (roundDurationMs - clampedElapsed) / roundDurationMs;
    return Math.round(this.maxPoints * remainingRatio);
  }
}
