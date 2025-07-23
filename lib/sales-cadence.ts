import { colors } from "./colors"

export interface CadenceStep {
  id: number
  day: number
  type: "call" | "email" | "video" | "social"
  action: string
  description: string
  subActions?: string[]
}

export const SALES_CADENCE: CadenceStep[] = [
  {
    id: 1,
    day: 1,
    type: "call",
    action: "Initial Contact",
    description: "Call + Voicemail → Email with tour link",
    subActions: ["Make call", "Leave voicemail", "Send tour link email"]
  },
  {
    id: 2,
    day: 3,
    type: "email",
    action: "Spam Check",
    description: "Follow-up email + LinkedIn connection",
    subActions: ["Send spam check email", "Connect on LinkedIn"]
  },
  {
    id: 3,
    day: 5,
    type: "call",
    action: "Second Call",
    description: "Call + Voicemail (reference tour)",
    subActions: ["Make second call", "Leave voicemail with tour reference"]
  },
  {
    id: 4,
    day: 7,
    type: "email",
    action: "Case Study",
    description: "Send luxury case study",
    subActions: ["Send case study email"]
  },
  {
    id: 5,
    day: 10,
    type: "video",
    action: "Personalized Video",
    description: "60-second personalized video message",
    subActions: ["Record video", "Send video email"]
  },
  {
    id: 6,
    day: 14,
    type: "email",
    action: "ROI Data",
    description: "Send ROI and performance data",
    subActions: ["Send ROI email"]
  },
  {
    id: 7,
    day: 25,
    type: "email",
    action: "Re-engagement",
    description: "Share new success story",
    subActions: ["Send re-engagement email"]
  }
]

export interface CadenceProgress {
  currentStep: number
  completedSteps: number[]
  lastActionDate: string
  nextActionDate: string
  isDormant: boolean
}

export function calculateCadenceProgress(notes: Array<{ type: string; timestamp: string }>): CadenceProgress {
  const now = new Date()
  const sortedNotes = notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const lastNote = sortedNotes[0]
  
  if (!lastNote) {
    return {
      currentStep: 1,
      completedSteps: [],
      lastActionDate: "",
      nextActionDate: now.toISOString(),
      isDormant: false
    }
  }

  const daysSinceLastAction = Math.floor(
    (now.getTime() - new Date(lastNote.timestamp).getTime()) / (1000 * 60 * 60 * 24)
  )

  // If no action in 30 days, mark as dormant
  if (daysSinceLastAction > 30) {
    return {
      currentStep: 0,
      completedSteps: [],
      lastActionDate: lastNote.timestamp,
      nextActionDate: now.toISOString(),
      isDormant: true
    }
  }

  // Calculate completed steps based on notes
  const completedSteps = SALES_CADENCE.filter(step => {
    const stepNotes = sortedNotes.filter(note => {
      const noteDate = new Date(note.timestamp)
      const daysSinceStart = Math.floor(
        (noteDate.getTime() - new Date(notes[notes.length - 1].timestamp).getTime()) / (1000 * 60 * 60 * 24)
      )
      return Math.abs(daysSinceStart - step.day) <= 1 // Allow 1 day flexibility
    })
    return stepNotes.length > 0
  }).map(step => step.id)

  // Find next step
  const currentStep = completedSteps.length + 1
  const nextStep = SALES_CADENCE.find(step => step.id === currentStep)

  return {
    currentStep,
    completedSteps,
    lastActionDate: lastNote.timestamp,
    nextActionDate: nextStep 
      ? new Date(new Date(lastNote.timestamp).getTime() + nextStep.day * 24 * 60 * 60 * 1000).toISOString()
      : lastNote.timestamp,
    isDormant: false
  }
}

export function getProgressColor(progress: CadenceProgress, status: string): string {
  if (progress.isDormant) {
    return colors.status.dormant.icon
  }
  
  const statusColor = colors.status[status as keyof typeof colors.status]
  return statusColor?.icon || colors.status.cold.icon
} 