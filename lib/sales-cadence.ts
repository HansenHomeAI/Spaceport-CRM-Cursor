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

// Helper function to find when a lead entered their current status
function findStatusStartDate(
  currentStatus: string, 
  notes: Array<{ type: string; timestamp: string; text: string }>
): string {
  // Look for status change notes or fallback to first interaction
  const statusChangeNote = notes
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .find(note => 
      note.text.toLowerCase().includes(`status changed to ${currentStatus.toLowerCase()}`) ||
      note.text.toLowerCase().includes(`moved to ${currentStatus.toLowerCase()}`) ||
      note.text.toLowerCase().includes(`marked as ${currentStatus.toLowerCase()}`)
    )

  if (statusChangeNote) {
    return statusChangeNote.timestamp
  }

  // Special logic for specific statuses
  if (currentStatus === "Left Voicemail") {
    const voicemailNote = notes.find(note => 
      note.text.toLowerCase().includes("voicemail") || 
      note.type === "call"
    )
    if (voicemailNote) return voicemailNote.timestamp
  }

  if (currentStatus === "Contacted") {
    const contactNote = notes.find(note => 
      note.type === "call" && !note.text.toLowerCase().includes("voicemail")
    )
    if (contactNote) return contactNote.timestamp
  }

  if (currentStatus === "Interested") {
    const interestedNote = notes.find(note => 
      note.text.toLowerCase().includes("interested") ||
      note.text.toLowerCase().includes("wants to proceed") ||
      note.text.toLowerCase().includes("positive response")
    )
    if (interestedNote) return interestedNote.timestamp
  }

  if (currentStatus === "Closed") {
    const closedNote = notes.find(note => 
      note.text.toLowerCase().includes("closed") ||
      note.text.toLowerCase().includes("deal won") ||
      note.text.toLowerCase().includes("contract signed")
    )
    if (closedNote) return closedNote.timestamp
  }

  // Fallback to most recent note or current date
  const latestNote = notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
  return latestNote?.timestamp || new Date().toISOString()
}

export function calculateCadenceProgress(
  notes: Array<{ type: string; timestamp: string; text: string }>, 
  leadStatus: string,
  leadId?: string
): CadenceProgress {
  const now = new Date()
  
  // Handle "Not Interested" and "Needs Follow-Up" statuses (no active cadence)
  if (leadStatus === "Not Interested" || leadStatus === "Needs Follow-Up") {
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

  const statusStartDate = new Date(findStatusStartDate(leadStatus, notes))
  const sortedNotes = notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  
  // Calculate completed steps based on actions since status start
  const completedSteps: number[] = []
  let currentStep = 1

  // Filter notes to only those after status start
  const notesInCurrentStatus = sortedNotes.filter(note => 
    new Date(note.timestamp) >= statusStartDate
  )

  // For each cadence step, check if it's been completed
  cadenceSteps.forEach((step, index) => {
    const stepDueDate = addBusinessDays(statusStartDate, step.dayOffset)
    
    // Check if we have a matching action for this step
    const matchingAction = notesInCurrentStatus.find(note => {
      const noteDate = new Date(note.timestamp)
      
      // Must be the right type and after the step due date
      if (note.type !== step.type) return false
      
      // For status-specific matching
      if (leadStatus === "Left Voicemail") {
        return note.text.toLowerCase().includes("voicemail")
      } else if (leadStatus === "Contacted") {
        // Match step-specific actions
        if (step.action.includes("Demo Email")) {
          return note.type === "call" || (note.type === "email" && note.text.toLowerCase().includes("demo"))
        } else if (step.action.includes("Spam Check")) {
          return note.type === "email" && note.text.toLowerCase().includes("spam")
        } else if (step.action.includes("Case Study")) {
          return note.type === "email" && note.text.toLowerCase().includes("case study")
        } else if (step.action.includes("Final Attempt")) {
          return note.type === "email" && note.text.toLowerCase().includes("final")
        }
      } else if (leadStatus === "Interested") {
        if (step.action.includes("Next Steps")) {
          return note.type === "email" && note.text.toLowerCase().includes("next steps")
        } else if (step.action.includes("Status Check")) {
          return note.type === "email" && note.text.toLowerCase().includes("status")
        }
      } else if (leadStatus === "Closed") {
        if (step.action.includes("Delivery")) {
          return note.type === "email" && note.text.toLowerCase().includes("delivery")
        } else if (step.action.includes("Check-in")) {
          return note.type === "email" && note.text.toLowerCase().includes("check-in")
        } else if (step.action.includes("Market Update")) {
          return note.type === "email" && note.text.toLowerCase().includes("market")
        }
      }
      
      return note.type === step.type
    })

    if (matchingAction) {
      completedSteps.push(step.id)
      currentStep = Math.min(step.id + 1, cadenceSteps.length)
    }
  })

  // If no steps completed, start with step 1
  if (completedSteps.length === 0) {
    currentStep = 1
  }

  // Calculate next action date
  const nextStep = cadenceSteps.find(step => step.id === currentStep)
  let nextActionDate = ""
  
  if (nextStep) {
    if (currentStep === 1) {
      // First step - due immediately or based on status start
      nextActionDate = addBusinessDays(statusStartDate, nextStep.dayOffset).toISOString()
    } else {
      // Subsequent steps - based on last action
      const lastActionDate = sortedNotes.length > 0 ? new Date(sortedNotes[0].timestamp) : statusStartDate
      nextActionDate = addBusinessDays(lastActionDate, nextStep.dayOffset).toISOString()
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
    "dormant": "Needs Follow-Up",
    "left voicemail": "Left Voicemail",
    // New statuses (already correct)
    "Left Voicemail": "Left Voicemail",
    "Contacted": "Contacted",
    "Interested": "Interested", 
    "Not Interested": "Not Interested",
    "Needs Follow-Up": "Needs Follow-Up",
    "Closed": "Closed"
  }
  
  return statusMap[status] || "Contacted" // Default fallback
}

// Get the cadence steps for a specific status
export function getCadenceSteps(status: string): CadenceStep[] {
  return STATUS_CADENCES[status as keyof typeof STATUS_CADENCES] || []
} 