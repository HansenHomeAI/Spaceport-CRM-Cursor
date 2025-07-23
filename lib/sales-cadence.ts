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

  // Calculate completed steps based on notes and timing
  const completedSteps: number[] = []
  let currentStep = 1

  // Check if we have any interactions that would indicate progress
  if (sortedNotes.length > 0) {
    const firstNoteDate = new Date(sortedNotes[sortedNotes.length - 1].timestamp)
    
    // For each step, check if we have interactions around the expected time
    SALES_CADENCE.forEach((step, index) => {
      const expectedDate = new Date(firstNoteDate.getTime() + step.day * 24 * 60 * 60 * 1000)
      const daysDiff = Math.abs((now.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24))
      
      // If we have notes within 2 days of the expected step date, mark as completed
      if (daysDiff <= 2) {
        completedSteps.push(step.id)
        currentStep = step.id + 1
      }
    })

    // If we have interactions but they don't match the cadence, mark current step as completed
    if (completedSteps.length === 0 && sortedNotes.length > 0) {
      // Find the last step that should be completed based on time elapsed
      const daysSinceStart = Math.floor((now.getTime() - firstNoteDate.getTime()) / (1000 * 60 * 60 * 24))
      const expectedSteps = SALES_CADENCE.filter(step => step.day <= daysSinceStart)
      completedSteps.push(...expectedSteps.map(step => step.id))
      
      // Mark the current step as completed even if it's not the "right" step
      const nextExpectedStep = SALES_CADENCE.find(step => step.day > daysSinceStart)
      if (nextExpectedStep) {
        currentStep = nextExpectedStep.id
        completedSteps.push(currentStep) // Mark current step as completed
      } else {
        currentStep = SALES_CADENCE.length
        completedSteps.push(currentStep) // Mark final step as completed
      }
    }
  }

  // Find next step
  const nextStep = SALES_CADENCE.find(step => step.id === currentStep + 1)

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