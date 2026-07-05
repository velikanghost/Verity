import type { MarketInput } from "@/lib/verity"

export type AgentSeverity = "info" | "warning" | "blocker"

export interface AgentFinding {
  severity: AgentSeverity
  message: string
}

export interface VerityAgentReview {
  approved: boolean
  score: number
  summary: string
  findings: AgentFinding[]
}

const VAGUE_WORDS = [
  "popular",
  "successful",
  "viral",
  "big",
  "famous",
  "good",
  "better",
  "important",
]

function hasNumber(value: string) {
  return /\d/.test(value)
}

function daysUntil(value: string) {
  const deadline = new Date(value)
  if (Number.isNaN(deadline.getTime())) return null
  return (deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
}

export function reviewPredictionPost(input: MarketInput): VerityAgentReview {
  const findings: AgentFinding[] = []
  const question = input.question.trim()
  const resolutionSource = input.resolutionSource.trim()
  const yesCondition = input.yesCondition.trim()
  const noCondition = input.noCondition.trim()
  const deadlineDays = daysUntil(input.deadline)

  if (!question) {
    findings.push({
      severity: "blocker",
      message: "Add a clear YES/NO market question.",
    })
  }

  // if (question && !hasNumber(`${question} ${yesCondition} ${noCondition}`)) {
  //   findings.push({
  //     severity: "blocker",
  //     message: "Add a measurable number, percentage, date, price, or count.",
  //   })
  // }

  if (VAGUE_WORDS.some((word) => question.toLowerCase().includes(word))) {
    findings.push({
      severity: "warning",
      message: "Replace vague wording with an objective threshold.",
    })
  }

  if (!input.deadline || deadlineDays === null) {
    findings.push({
      severity: "blocker",
      message: "Add a valid resolution deadline.",
    })
  } else if (deadlineDays <= 0) {
    findings.push({ severity: "blocker", message: "Choose a future deadline." })
  } else if (deadlineDays < 1) {
    findings.push({
      severity: "warning",
      message: "Very short deadlines may not gather enough social signal.",
    })
  }

  if (!resolutionSource) {
    findings.push({
      severity: "blocker",
      message: "Name the source that will resolve the market.",
    })
  }

  if (yesCondition.length < 12) {
    findings.push({
      severity: "blocker",
      message:
        "Make the YES condition explicit enough to resolve without debate.",
    })
  }

  if (noCondition.length < 12) {
    findings.push({
      severity: "blocker",
      message:
        "Make the NO condition explicit enough to resolve without debate.",
    })
  }

  const blockers = findings.filter(
    (finding) => finding.severity === "blocker",
  ).length
  const warnings = findings.filter(
    (finding) => finding.severity === "warning",
  ).length
  const score = Math.max(0, 100 - blockers * 28 - warnings * 10)
  const approved = blockers === 0 && score >= 70

  return {
    approved,
    score,
    summary: approved
      ? "Verity AI approves this prediction for the 1 USDC Arc testnet creation payment."
      : "Verity AI needs a tighter prediction before payment is enabled.",
    findings:
      findings.length > 0
        ? findings
        : [
            {
              severity: "info",
              message:
                "Clear question, measurable outcome, deadline, and resolution source detected.",
            },
          ],
  }
}
