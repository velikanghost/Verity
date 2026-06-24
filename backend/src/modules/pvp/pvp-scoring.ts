export type PvpResult = "win" | "loss" | "draw"

const RESULT_XP: Record<PvpResult, number> = {
  win: 100,
  loss: 30,
  draw: 50,
}

const PERFECT_SCORE_BONUS_XP = 20
const XP_BOOST_MULTIPLIER = 1.2

export function calculatePvpScore(
  picks: Array<{ isCorrect: boolean | null }>,
): number {
  return picks.filter((pick) => pick.isCorrect === true).length
}

export function calculatePvpResultXp(
  result: PvpResult,
  score: number,
  totalChildMarkets: number,
  boostActive: boolean,
  boostMultiplier?: number,
): number {
  const perfectBonus = score === totalChildMarkets ? PERFECT_SCORE_BONUS_XP : 0
  const resultXp = RESULT_XP[result] + perfectBonus

  const multiplier =
    boostMultiplier !== undefined && boostMultiplier > 0
      ? boostMultiplier
      : boostActive
        ? XP_BOOST_MULTIPLIER
        : 1

  return Math.round(resultXp * multiplier)
}
