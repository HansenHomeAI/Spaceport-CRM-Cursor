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

export function calculateCadenceProgress(notes: Array<{ type: string; timestamp: string; text: string }>): CadenceProgress {
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

  // Calculate completed steps based on actual completion
  const completedSteps: number[] = []
  let currentStep = 1

  // Check if we have any interactions
  if (sortedNotes.length > 0) {
    const firstNoteDate = new Date(sortedNotes[sortedNotes.length - 1].timestamp)
    
    // Step 1: Initial Contact (Call + Email)
    const hasCall = sortedNotes.some(note => note.type === "call" && !note.text.includes("Left voicemail"))
    const hasEmail = sortedNotes.some(note => note.type === "email")
    const hasVoicemail = sortedNotes.some(note => note.text.includes("Left voicemail"))
    
    // Step 1 is complete if we have either a successful call OR an email (more flexible)
    if (hasCall || hasEmail) {
      completedSteps.push(1)
      currentStep = 2
    } else if (hasVoicemail) {
      // If we only left voicemail, stay on step 1 but don't mark it complete
      currentStep = 1
    }

    // Step 2: Spam Check Email (only if step 1 is complete)
    if (completedSteps.includes(1)) {
      const spamCheckEmail = sortedNotes.find(note => 
        note.type === "email" && 
        (note.text.includes("spam check") || note.text.includes("Spam Check") || note.text.includes("follow-up"))
      )
      if (spamCheckEmail) {
        completedSteps.push(2)
        currentStep = 3
      }
    }

    // Step 3: Second Call (only if step 2 is complete)
    if (completedSteps.includes(2)) {
      const secondCall = sortedNotes.find(note => 
        note.type === "call" && 
        (note.text.includes("second") || note.text.includes("Second") || note.text.includes("tour reference") || note.text.includes("follow-up call"))
      )
      if (secondCall) {
        completedSteps.push(3)
        currentStep = 4
      }
    }

    // Step 4: Case Study Email (only if step 3 is complete)
    if (completedSteps.includes(3)) {
      const caseStudyEmail = sortedNotes.find(note => 
        note.type === "email" && 
        (note.text.includes("case study") || note.text.includes("Case Study"))
      )
      if (caseStudyEmail) {
        completedSteps.push(4)
        currentStep = 5
      }
    }

    // Step 5: Video (only if step 4 is complete)
    if (completedSteps.includes(4)) {
      const videoSent = sortedNotes.find(note => 
        note.type === "video" || note.text.includes("video")
      )
      if (videoSent) {
        completedSteps.push(5)
        currentStep = 6
      }
    }

    // Step 6: ROI Email (only if step 5 is complete)
    if (completedSteps.includes(5)) {
      const roiEmail = sortedNotes.find(note => 
        note.type === "email" && 
        (note.text.includes("ROI") || note.text.includes("roi") || note.text.includes("performance data"))
      )
      if (roiEmail) {
        completedSteps.push(6)
        currentStep = 7
      }
    }

    // Step 7: Re-engagement (only if step 6 is complete)
    if (completedSteps.includes(6)) {
      const reengagementEmail = sortedNotes.find(note => 
        note.type === "email" && 
        (note.text.includes("re-engagement") || note.text.includes("success story"))
      )
      if (reengagementEmail) {
        completedSteps.push(7)
        currentStep = 7 // Final step
      }
    }
  }

  // Find next step
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
    return "#eab308" // Yellow color for dormant/needs follow-up
  }
  
  // Handle both old and new status formats
  const normalizedStatus = normalizeStatus(status)
  const statusColor = colors.status[normalizedStatus as keyof typeof colors.status]
  return statusColor?.icon || "#60a5fa" // Default to blue
}

// Helper function to normalize old status values to new ones
function normalizeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    "cold": "Not Interested",
    "contacted": "Contacted", 
    "interested": "Interested",
    "closed": "Not Interested", // Map closed to not interested since we removed it
    "dormant": "Needs Follow-Up",
    "left voicemail": "Left Voicemail",
    // New statuses (already correct)
    "Left Voicemail": "Left Voicemail",
    "Contacted": "Contacted",
    "Interested": "Interested", 
    "Not Interested": "Not Interested",
    "Needs Follow-Up": "Needs Follow-Up"
  }
  
  return statusMap[status] || "Contacted" // Default fallback
} 