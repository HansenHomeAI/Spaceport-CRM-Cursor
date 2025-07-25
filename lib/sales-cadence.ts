import { colors } from "./colors"

// New status-based system
export type LeadStatus = "NOT INTERESTED" | "VOICEMAIL" | "CONTACTED" | "INTERESTED" | "CLOSED"

export interface StatusAction {
  id: string
  dayOffset: number
  type: "call" | "email" | "video" | "social" | "text"
  action: string
  description: string
  priority: "low" | "medium" | "high"
  autoTransition?: LeadStatus // Automatic status transition on completion
  quickActions?: string[] // Quick action button options
}

export interface StatusWorkflow {
  status: LeadStatus
  color: string
  actions: StatusAction[]
  description: string
  nextStatus?: LeadStatus
  stopConditions?: string[]
}

// Status-based workflows
export const STATUS_WORKFLOWS: Record<LeadStatus, StatusWorkflow> = {
  "NOT INTERESTED": {
    status: "NOT INTERESTED",
    color: "#ef4444", // red
    description: "Lead has declined or is not interested",
    actions: [],
    stopConditions: ["Manual stop - lead explicitly declined"]
  },

  "VOICEMAIL": {
    status: "VOICEMAIL",
    color: "#eab308", // yellow
    description: "Left voicemail sequence in progress",
    nextStatus: "NOT INTERESTED",
    actions: [
      {
        id: "voicemail-1",
        dayOffset: 0,
        type: "call",
        action: "Leave Voicemail #1",
        description: "First voicemail attempt",
        priority: "high",
        quickActions: ["Left Voicemail", "Phone Answered", "No Answer"]
      },
      {
        id: "voicemail-2", 
        dayOffset: 7,
        type: "call",
        action: "Leave Voicemail #2",
        description: "Second voicemail attempt",
        priority: "high",
        quickActions: ["Left Voicemail", "Phone Answered", "No Answer"]
      },
      {
        id: "voicemail-3",
        dayOffset: 14,
        type: "call", 
        action: "Leave Voicemail #3",
        description: "Third voicemail attempt",
        priority: "high",
        quickActions: ["Left Voicemail", "Phone Answered", "No Answer"]
      },
      {
        id: "voicemail-4",
        dayOffset: 24,
        type: "call",
        action: "Leave Voicemail #4",
        description: "Final voicemail attempt",
        priority: "medium",
        autoTransition: "NOT INTERESTED",
        quickActions: ["Left Voicemail", "Phone Answered", "No Answer"]
      }
    ],
    stopConditions: ["After 4 voicemails with no response", "Lead explicitly declines", "Lead answers call"]
  },

  "CONTACTED": {
    status: "CONTACTED",
    color: "#3b82f6", // blue
    description: "Initial contact made, following up for interest",
    nextStatus: "NOT INTERESTED",
    actions: [
      {
        id: "initial-contact",
        dayOffset: 0,
        type: "call",
        action: "Call + Send Demo Email",
        description: "Call and send intro/demo-link email",
        priority: "high",
        quickActions: ["Made Call", "Sent Email", "Left Voicemail"]
      },
      {
        id: "spam-check",
        dayOffset: 5,
        type: "email",
        action: "Spam Check Email",
        description: "Did my demo link land in spam?",
        priority: "medium",
        quickActions: ["Sent Email"]
      },
      {
        id: "follow-up-call-1",
        dayOffset: 7,
        type: "call",
        action: "Follow-up Call + Text",
        description: "Call, if no answer leave voicemail and send text",
        priority: "high",
        quickActions: ["Made Call", "Left Voicemail", "Sent Text"]
      },
      {
        id: "case-study-email",
        dayOffset: 14,
        type: "email",
        action: "Follow-up Email",
        description: "Case study or feature highlight email",
        priority: "medium",
        quickActions: ["Sent Email"]
      },
      {
        id: "follow-up-call-2",
        dayOffset: 21,
        type: "call",
        action: "Second Follow-up Call",
        description: "Call, if no answer leave voicemail and send text",
        priority: "high",
        quickActions: ["Made Call", "Left Voicemail", "Sent Text"]
      },
      {
        id: "final-email",
        dayOffset: 31,
        type: "email",
        action: "Final Email Attempt",
        description: "Last chance to see your 3D property demo",
        priority: "low",
        autoTransition: "NOT INTERESTED",
        quickActions: ["Sent Email"]
      }
    ],
    stopConditions: ["After final email with no response", "Lead replies with positive signals", "Lead explicitly declines"]
  },

  "INTERESTED": {
    status: "INTERESTED",
    color: "#22c55e", // green
    description: "Lead has shown interest, managing active opportunity",
    nextStatus: "CLOSED",
    actions: [
      {
        id: "next-steps-email",
        dayOffset: 0,
        type: "email",
        action: "Next-Steps Email",
        description: "Summary email with expectations and timeline",
        priority: "high",
        quickActions: ["Sent Email"]
      },
      {
        id: "status-check-email",
        dayOffset: 7,
        type: "email",
        action: "Status Check Email",
        description: "Where are we at?",
        priority: "medium",
        quickActions: ["Sent Email"]
      },
      {
        id: "status-check-call",
        dayOffset: 14,
        type: "call",
        action: "Status Check Call",
        description: "Call for status check if no email reply + text",
        priority: "high",
        quickActions: ["Made Call", "Left Voicemail", "Sent Text"]
      },
      {
        id: "weekly-followup",
        dayOffset: 21,
        type: "call",
        action: "Weekly Follow-up",
        description: "Custom status check at preferred cadence",
        priority: "medium",
        quickActions: ["Made Call", "Sent Email", "Sent Text"]
      }
    ],
    stopConditions: ["Lead closes deal", "Lead becomes unresponsive", "Lead explicitly declines"]
  },

  "CLOSED": {
    status: "CLOSED",
    color: "#8b5cf6", // purple
    description: "Deal closed, maintaining relationship for future opportunities",
    actions: [
      {
        id: "delivery-email",
        dayOffset: 0,
        type: "email",
        action: "Delivery Email",
        description: "Final 3D model link and instructions",
        priority: "high",
        quickActions: ["Sent Email", "Delivered Files"]
      },
      {
        id: "one-month-checkin",
        dayOffset: 30,
        type: "email",
        action: "1 Month Check-in",
        description: "Check-in & feedback request",
        priority: "medium",
        quickActions: ["Sent Email", "Made Call"]
      },
      {
        id: "six-month-update",
        dayOffset: 180,
        type: "email",
        action: "6 Month Market Update",
        description: "Market-update email / trends report",
        priority: "low",
        quickActions: ["Sent Email"]
      },
      {
        id: "twelve-month-update",
        dayOffset: 365,
        type: "email",
        action: "12 Month Market Update", 
        description: "Annual market-update email / trends report",
        priority: "low",
        quickActions: ["Sent Email"]
      },
      {
        id: "ongoing-updates",
        dayOffset: 545, // 18 months
        type: "email",
        action: "Semi-annual Updates",
        description: "Repeat semi-annual check-in & insights",
        priority: "low",
        quickActions: ["Sent Email"]
      }
    ],
    stopConditions: ["Lead has new needs (transition back to INTERESTED)"]
  }
}

export interface StatusProgress {
  status: LeadStatus
  currentActionId: string | null
  completedActions: string[]
  lastActionDate: string
  nextActionDate: string
  isDormant: boolean
  daysInStatus: number
  nextAction: StatusAction | null
  availableActions: StatusAction[]
}

// Calculate business days (excluding weekends)
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let addedDays = 0
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1)
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++
    }
  }
  
  return result
}

// Calculate business days between two dates
function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  let businessDays = 0
  
  while (start < end) {
    start.setDate(start.getDate() + 1)
    if (start.getDay() !== 0 && start.getDay() !== 6) {
      businessDays++
    }
  }
  
  return businessDays
}

export function calculateStatusProgress(
  status: LeadStatus,
  notes: Array<{ type: string; timestamp: string; text: string; id: string }>
): StatusProgress {
  const now = new Date()
  const workflow = STATUS_WORKFLOWS[status]
  const sortedNotes = notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  
  // Find the last status-changing note or first note
  const lastNote = sortedNotes[0]
  const statusStartDate = lastNote ? new Date(lastNote.timestamp) : now
  
  if (!lastNote) {
    return {
      status,
      currentActionId: null,
      completedActions: [],
      lastActionDate: "",
      nextActionDate: now.toISOString(),
      isDormant: false,
      daysInStatus: 0,
      nextAction: null,
      availableActions: workflow.actions.slice(0, 1) // Show first action
    }
  }

  const daysInStatus = getBusinessDaysBetween(statusStartDate, now)
  
  // Check if dormant (no activity in 30+ business days)
  const daysSinceLastAction = getBusinessDaysBetween(new Date(lastNote.timestamp), now)
  const isDormant = daysSinceLastAction > 30

  // Find completed actions based on notes
  const completedActions: string[] = []
  
  workflow.actions.forEach(action => {
    const hasMatchingNote = notes.some(note => {
      const noteText = note.text.toLowerCase()
      const actionText = action.action.toLowerCase()
      
      // Check for specific action matches
      if (action.id.includes("voicemail") && noteText.includes("voicemail")) return true
      if (action.id.includes("email") && noteText.includes("email")) return true
      if (action.id.includes("call") && (noteText.includes("call") || noteText.includes("phone"))) return true
      if (action.id.includes("text") && noteText.includes("text")) return true
      
      return false
    })
    
    if (hasMatchingNote) {
      completedActions.push(action.id)
    }
  })

  // Find current action (first incomplete action that's due)
  let currentActionId: string | null = null
  let nextAction: StatusAction | null = null
  
  for (const action of workflow.actions) {
    if (!completedActions.includes(action.id)) {
      const actionDueDate = addBusinessDays(statusStartDate, action.dayOffset)
      
      if (now >= actionDueDate) {
        currentActionId = action.id
        nextAction = action
        break
      }
    }
  }

  // Find next action date
  let nextActionDate = now.toISOString()
  if (nextAction) {
    const actionDueDate = addBusinessDays(statusStartDate, nextAction.dayOffset)
    nextActionDate = actionDueDate.toISOString()
  } else {
    // Find next incomplete action
    for (const action of workflow.actions) {
      if (!completedActions.includes(action.id)) {
        const actionDueDate = addBusinessDays(statusStartDate, action.dayOffset)
        nextActionDate = actionDueDate.toISOString()
        break
      }
    }
  }

  // Get available actions (current action + any overdue actions)
  const availableActions = workflow.actions.filter(action => {
    if (completedActions.includes(action.id)) return false
    const actionDueDate = addBusinessDays(statusStartDate, action.dayOffset)
    return now >= actionDueDate
  })

  return {
    status,
    currentActionId,
    completedActions,
    lastActionDate: lastNote.timestamp,
    nextActionDate,
    isDormant,
    daysInStatus,
    nextAction,
    availableActions
  }
}

export function getStatusColor(status: LeadStatus): string {
  return STATUS_WORKFLOWS[status].color
}

// Legacy function for backward compatibility
export const SALES_CADENCE = [
  {
    id: 1,
    day: 1,
    type: "call" as const,
    action: "Initial Contact",
    description: "Call + Voicemail → Email with tour link",
    subActions: ["Make call", "Leave voicemail", "Send tour link email"]
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
  // Legacy fallback - convert to new system
  return {
    currentStep: 1,
    completedSteps: [],
    lastActionDate: notes[0]?.timestamp || "",
    nextActionDate: new Date().toISOString(),
    isDormant: false
  }
}

export function getProgressColor(progress: CadenceProgress, status: string): string {
  // Convert old status to new status
  const statusMap: Record<string, LeadStatus> = {
    "cold": "NOT INTERESTED",
    "contacted": "CONTACTED", 
    "interested": "INTERESTED",
    "closed": "CLOSED",
    "dormant": "VOICEMAIL",
    "left voicemail": "VOICEMAIL",
    "Left Voicemail": "VOICEMAIL",
    "Contacted": "CONTACTED",
    "Interested": "INTERESTED", 
    "Not Interested": "NOT INTERESTED",
    "Needs Follow-Up": "VOICEMAIL",
    "VOICEMAIL": "VOICEMAIL",
    "CONTACTED": "CONTACTED",
    "INTERESTED": "INTERESTED",
    "NOT INTERESTED": "NOT INTERESTED",
    "CLOSED": "CLOSED"
  }
  
  const newStatus = statusMap[status] || "CONTACTED"
  return getStatusColor(newStatus)
} 