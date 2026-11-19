export const PERFIL_MAX_CLUES = 10;
export const TRIVIA_MAX_HINTS = 3;
export const TRIVIA_STEPS = [6, 4, 2, 1] as const;

/** Perfil: acertou depois de ver N dicas (1..10) => anda 11 − N casas. Errou/esgotou => 0. */
export function perfilSteps(cluesSeen: number, correct: boolean): number {
  if (!correct) return 0;
  if (cluesSeen < 1 || cluesSeen > PERFIL_MAX_CLUES) throw new Error(`Dicas vistas inválidas: ${cluesSeen}`);
  return PERFIL_MAX_CLUES + 1 - cluesSeen;
}

/** Trivia: 0 dicas => 6, 1 => 4, 2 => 2, 3 => 1. Errou => 0. */
export function triviaSteps(hintsUsed: number, correct: boolean): number {
  if (!correct) return 0;
  if (hintsUsed < 0 || hintsUsed > TRIVIA_MAX_HINTS) throw new Error(`Dicas usadas inválidas: ${hintsUsed}`);
  return TRIVIA_STEPS[hintsUsed];
}

export function perfilTable(): { clues: number; steps: number }[] {
  return Array.from({ length: PERFIL_MAX_CLUES }, (_, i) => ({ clues: i + 1, steps: perfilSteps(i + 1, true) }));
}

export function triviaTable(): { hints: number; steps: number }[] {
  return TRIVIA_STEPS.map((steps, hints) => ({ hints, steps }));
}
