import { colors } from "./colors"

export interface CadenceStep {
  id: number
  dayOffset: number // Days since status started or last action
  type: "call" | "email" | "video" | "social"
  action: string
  description: string
  subActions?: string[]
}

// Status-specific cadence definitions
export const STATUS_CADENCES = {
  "Left Voicemail": [
    {
      id: 1,
      dayOffset: 0,
      type: "call" as const,
      action: "Voicemail #1",
      description: "Leave first voicemail",
      subActions: ["Leave voicemail #1"]
    },
    {
      id: 2,
      dayOffset: 7,
      type: "call" as const,
      action: "Voicemail #2",
      description: "Leave second voicemail",
      subActions: ["Leave voicemail #2"]
    },
    {
      id: 3,
      dayOffset: 7,
      type: "call" as const,
      action: "Voicemail #3",
      description: "Leave third voicemail",
      subActions: ["Leave voicemail #3"]
    },
    {
      id: 4,
      dayOffset: 10,
      type: "call" as const,
      action: "Voicemail #4",
      description: "Leave final voicemail - mark Not Interested if no response",
      subActions: ["Leave voicemail #4", "Mark Not Interested if no answer"]
    }
  ],

  "Contacted": [
    {
      id: 1,
      dayOffset: 0,
      type: "call" as const,
      action: "Call + Demo Email",
      description: "Call and send intro/demo-link email",
      subActions: ["Make call", "Send demo link email"]
    },
    {
      id: 2,
      dayOffset: 5,
      type: "email" as const,
      action: "Spam Check",
      description: "Did my demo link land in spam?",
      subActions: ["Send spam-check email"]
    },
    {
      id: 3,
      dayOffset: 2,
      type: "call" as const,
      action: "Follow-up Call",
      description: "Call → if no answer, leave voicemail and send text",
      subActions: ["Make call", "Leave voicemail if no answer", "Send text"]
    },
    {
      id: 4,
      dayOffset: 7,
      type: "email" as const,
      action: "Case Study",
      description: "Follow-up email (case study, feature highlight)",
      subActions: ["Send case study email"]
    },
    {
      id: 5,
      dayOffset: 7,
      type: "call" as const,
      action: "Second Follow-up",
      description: "Call → if no answer, leave voicemail and send text",
      subActions: ["Make call", "Leave voicemail if no answer", "Send text"]
    },
    {
      id: 6,
      dayOffset: 10,
      type: "email" as const,
      action: "Final Attempt",
      description: "Last chance to see your 3D property demo",
      subActions: ["Send final email attempt", "Mark Not Interested if no response"]
    }
  ],

  "Interested": [
    {
      id: 1,
      dayOffset: 0,
      type: "email" as const,
      action: "Next Steps Summary",
      description: "Send summary of what to expect, how to prep, timeline",
      subActions: ["Send next-steps email"]
    },
    {
      id: 2,
      dayOffset: 7,
      type: "email" as const,
      action: "Status Check",
      description: "Where are we at?",
      subActions: ["Send status-check email"]
    },
    {
      id: 3,
      dayOffset: 14,
      type: "call" as const,
      action: "Status Call",
      description: "Call for status check (if no email reply) + text",
      subActions: ["Make status call", "Send text"]
    },
    {
      id: 4,
      dayOffset: 7, // Then weekly
      type: "call" as const,
      action: "Weekly Check-in",
      description: "Custom status check (weekly/bi-weekly)",
      subActions: ["Weekly/bi-weekly check-in"]
    }
  ],

  "Closed": [
    {
      id: 1,
      dayOffset: 0,
      type: "email" as const,
      action: "Delivery Email",
      description: "Send final 3D model link and instructions",
      subActions: ["Send delivery email with 3D model link"]
    },
    {
      id: 2,
      dayOffset: 30, // 1 month
      type: "email" as const,
      action: "Check-in & Feedback",
      description: "How can we improve?",
      subActions: ["Send check-in email", "Request feedback"]
    },
    {
      id: 3,
      dayOffset: 150, // 6 months from close
      type: "email" as const,
      action: "Market Update",
      description: "Market-update email / trends report",
      subActions: ["Send market update email"]
    },
    {
      id: 4,
      dayOffset: 365, // 12 months from close
      type: "email" as const,
      action: "Annual Update",
      description: "Annual market-update email / trends report",
      subActions: ["Send annual update email"]
    },
    {
      id: 5,
      dayOffset: 180, // Every 6 months thereafter
      type: "email" as const,
      action: "Semi-annual Check-in",
      description: "Semi-annual check-in & insights",
      subActions: ["Send semi-annual check-in"]
    }
  ]
}

export interface CadenceProgress {
  currentStep: number
  completedSteps: number[]
  lastActionDate: string
  nextActionDate: string
  isDormant: boolean
  status: string
  statusStartDate?: string // When the lead entered this status
}

// Helper function to calculate business days
function addBusinessDays(startDate: Date, businessDays: number): Date {
  const result = new Date(startDate)
  let daysAdded = 0
  
  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1)
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      daysAdded++
    }
  }
  
  return result
}

// SIMPLIFIED: Find when a lead entered their current status
function findStatusStartDate(
  currentStatus: string,
  notes: Array<{ type: string; timestamp: string; text: string }>,
  leadUpdatedAt?: string
): string {
  // Look for explicit status change notes (most reliable)
  const statusChangeNote = notes
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .find(note => 
      note.text.toLowerCase().includes(`status changed to ${currentStatus.toLowerCase()}`) ||
      note.text.toLowerCase().includes(`moved to ${currentStatus.toLowerCase()}`) ||
      note.text.toLowerCase().includes(`set to ${currentStatus.toLowerCase()}`)
    )

  if (statusChangeNote) {
    return statusChangeNote.timestamp
  }

  // SIMPLIFIED: If no explicit status change, use the lead's last updated date or most recent note
  if (leadUpdatedAt) {
    return leadUpdatedAt
  }

  // Fallback to most recent note
  const latestNote = notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
  return latestNote?.timestamp || new Date().toISOString()
}

export function calculateCadenceProgress(
  notes: Array<{ type: string; timestamp: string; text: string }>, 
  leadStatus: string,
  leadId?: string,
  leadUpdatedAt?: string
): CadenceProgress {
  const now = new Date()
  
  // Handle "Not Interested" status (no active cadence)
  if (leadStatus === "Not Interested") {
    return {
      currentStep: 0,
      completedSteps: [],
      lastActionDate: notes.length > 0 ? notes[0].timestamp : "",
      nextActionDate: "",
      isDormant: true,
      status: leadStatus
    }
  }

  const cadenceSteps = STATUS_CADENCES[leadStatus as keyof typeof STATUS_CADENCES] || []
  
  if (cadenceSteps.length === 0) {
    return {
      currentStep: 0,
      completedSteps: [],
      lastActionDate: "",
      nextActionDate: "",
      isDormant: true,
      status: leadStatus
    }
  }

  // SIMPLIFIED: Find status start date
  const statusStartDate = new Date(findStatusStartDate(leadStatus, notes, leadUpdatedAt))
  const sortedNotes = notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  
  // SIMPLIFIED: Track completed steps LINEARLY (no skipping allowed)
  const completedSteps: number[] = []
  let currentStep = 1

  // Filter notes to only those after status start
  const notesInCurrentStatus = sortedNotes.filter(note => 
    new Date(note.timestamp) >= statusStartDate
  )

  // SIMPLIFIED: Complete steps in order, one by one
  for (let stepIndex = 0; stepIndex < cadenceSteps.length; stepIndex++) {
    const step = cadenceSteps[stepIndex]
    
    // Check if we have a matching action for this step
    const hasMatchingAction = notesInCurrentStatus.some(note => {
      // SIMPLIFIED: Just match the note type, no complex keyword matching
      if (note.type !== step.type) return false
      
      // For voicemail status, ensure it's actually a voicemail
      if (leadStatus === "Left Voicemail") {
        return note.text.toLowerCase().includes("voicemail") || 
               note.text.toLowerCase().includes("left message") ||
               note.text.toLowerCase().includes("no answer")
      }
      
      // For other statuses, just match the type
      return true
    })

    if (hasMatchingAction) {
      completedSteps.push(step.id)
      currentStep = step.id + 1 // Next step
    } else {
      // STOP: Can't complete later steps until this one is done
      break
    }
  }

  // Ensure currentStep doesn't exceed available steps
  if (currentStep > cadenceSteps.length) {
    currentStep = cadenceSteps.length // Stay on final step
  }

  // Calculate next action date
  const nextStep = cadenceSteps.find(step => step.id === currentStep)
  let nextActionDate = ""
  
  if (nextStep) {
    if (currentStep === 1) {
      // First step - use status start date + offset
      nextActionDate = addBusinessDays(statusStartDate, nextStep.dayOffset).toISOString()
    } else {
      // Subsequent steps - use last completed action date + offset
      const lastCompletedStep = cadenceSteps.find(step => step.id === currentStep - 1)
      if (lastCompletedStep) {
        const lastActionNote = notesInCurrentStatus.find(note => note.type === lastCompletedStep.type)
        const lastActionDate = lastActionNote ? new Date(lastActionNote.timestamp) : statusStartDate
        nextActionDate = addBusinessDays(lastActionDate, nextStep.dayOffset).toISOString()
      }
    }
  }

  // Check if dormant (no action in 30+ days)
  const daysSinceLastAction = sortedNotes.length > 0 
    ? Math.floor((now.getTime() - new Date(sortedNotes[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : Math.floor((now.getTime() - statusStartDate.getTime()) / (1000 * 60 * 60 * 24))

  return {
    currentStep,
    completedSteps,
    lastActionDate: sortedNotes.length > 0 ? sortedNotes[0].timestamp : statusStartDate.toISOString(),
    nextActionDate,
    isDormant: daysSinceLastAction > 30,
    status: leadStatus,
    statusStartDate: statusStartDate.toISOString()
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
    "closed": "Closed",
    "dormant": "Not Interested",
    "left voicemail": "Left Voicemail",
    "needs follow-up": "Not Interested",
    // New statuses (already correct)
    "Left Voicemail": "Left Voicemail",
    "Contacted": "Contacted",
    "Interested": "Interested", 
    "Not Interested": "Not Interested",
    "Closed": "Closed"
  }
  
  return statusMap[status] || "Left Voicemail" // Default fallback
}

// Get the cadence steps for a specific status
export function getCadenceSteps(status: string): CadenceStep[] {
  return STATUS_CADENCES[status as keyof typeof STATUS_CADENCES] || []
}

// NEW: Auto status transition logic
export function shouldAutoTransitionStatus(
  currentStatus: string,
  newNote: { type: string; text: string }
): string | null {
  // Auto-transition from "Left Voicemail" to "Contacted" on successful call
  if (currentStatus === "Left Voicemail" && newNote.type === "call") {
    const noteText = newNote.text.toLowerCase()
    // If it's a successful call (not a voicemail), transition to Contacted
    if (!noteText.includes("voicemail") && 
        !noteText.includes("no answer") && 
        !noteText.includes("left message") &&
        (noteText.includes("talked") || noteText.includes("spoke") || noteText.includes("answered"))) {
      return "Contacted"
    }
  }
  
  return null // No auto-transition
} 