import { colors } from "./colors"

export interface CadenceStep {
  id: number
  dayOffset: number
  type: "call" | "email" | "video" | "social"
  action: string
  description: string
  subActions?: string[]
}

export interface StatusCadence {
  status: string
  steps: CadenceStep[]
  transitions: {
    [key: string]: {
      condition: string
      newStatus: string
      description: string
    }
  }
}

// Utility function to add business days (excluding weekends)
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let businessDaysAdded = 0
  
  while (businessDaysAdded < days) {
    result.setDate(result.getDate() + 1)
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      businessDaysAdded++
    }
  }
  
  return result
}

// Status-specific cadence definitions based on the user's sales funnel process
export const STATUS_CADENCES: StatusCadence[] = [
  {
    status: "INITIAL_OUTREACH",
    steps: [
      {
        id: 1,
        dayOffset: 0,
        type: "call",
        action: "Initial Contact Call",
        description: "Make initial call to prospect",
        subActions: ["Make call", "If answered → transition to CONTACTED", "If no answer → leave voicemail and transition to VOICEMAIL"]
      }
    ],
    transitions: {
      "call_answered": {
        condition: "Call answered/connected",
        newStatus: "CONTACTED",
        description: "Prospect answered the phone"
      },
      "no_answer": {
        condition: "No answer/voicemail left",
        newStatus: "VOICEMAIL",
        description: "Left first voicemail"
      }
    }
  },
  {
    status: "VOICEMAIL",
    steps: [
      {
        id: 1,
        dayOffset: 0,
        type: "call",
        action: "Voicemail #1",
        description: "Leave first voicemail",
        subActions: ["Leave voicemail"]
      },
      {
        id: 2,
        dayOffset: 7,
        type: "call",
        action: "Voicemail #2",
        description: "Leave second voicemail",
        subActions: ["Leave voicemail"]
      },
      {
        id: 3,
        dayOffset: 14, // +7 from step 2
        type: "call",
        action: "Voicemail #3",
        description: "Leave third voicemail",
        subActions: ["Leave voicemail"]
      },
      {
        id: 4,
        dayOffset: 24, // +10 from step 3
        type: "call",
        action: "Voicemail #4 - Final",
        description: "Leave final voicemail",
        subActions: ["Leave voicemail", "If no answer after this → mark NOT INTERESTED"]
      }
    ],
    transitions: {
      "call_answered": {
        condition: "They answer on any call",
        newStatus: "CONTACTED",
        description: "Prospect answered the phone"
      },
      "explicitly_declined": {
        condition: "They explicitly decline",
        newStatus: "NOT INTERESTED",
        description: "Prospect declined service"
      },
      "max_voicemails_reached": {
        condition: "After 4th voicemail with no response",
        newStatus: "NOT INTERESTED",
        description: "Maximum voicemail attempts reached"
      }
    }
  },
  {
    status: "CONTACTED",
    steps: [
      {
        id: 1,
        dayOffset: 0,
        type: "call",
        action: "Call + Demo Email",
        description: "Call and send intro/demo-link email",
        subActions: ["Make call", "Send intro email with demo link"]
      },
      {
        id: 2,
        dayOffset: 5,
        type: "email",
        action: "Spam Check Email",
        description: "Did my demo link land in spam?",
        subActions: ["Send spam check email"]
      },
      {
        id: 3,
        dayOffset: 7, // +2 from step 2
        type: "call",
        action: "Follow-up Call + Text",
        description: "Call → if no answer, leave voicemail and send text",
        subActions: ["Make call", "If no answer: leave voicemail", "Send text message"]
      },
      {
        id: 4,
        dayOffset: 14, // +7 from step 3
        type: "email",
        action: "Case Study Email",
        description: "Follow-up email with case study or feature highlight",
        subActions: ["Send case study email"]
      },
      {
        id: 5,
        dayOffset: 21, // +7 from step 4
        type: "call",
        action: "Second Follow-up Call",
        description: "Call → if no answer, leave voicemail and send text",
        subActions: ["Make call", "If no answer: leave voicemail", "Send text message"]
      },
      {
        id: 6,
        dayOffset: 31, // +10 from step 5
        type: "email",
        action: "Final Email Attempt",
        description: "Last chance to see your 3D property demo",
        subActions: ["Send final email"]
      }
    ],
    transitions: {
      "positive_response": {
        condition: "They reply with questions or positive signals",
        newStatus: "INTERESTED",
        description: "Prospect showed interest"
      },
      "no_response_after_final": {
        condition: "No response after final email",
        newStatus: "NOT INTERESTED",
        description: "No response to complete sequence"
      }
    }
  },
  {
    status: "INTERESTED",
    steps: [
      {
        id: 1,
        dayOffset: 0,
        type: "email",
        action: "Next-Steps Summary",
        description: "Send next-steps summary email (what to expect, how to prep, timeline)",
        subActions: ["Send next-steps email with timeline and expectations"]
      },
      {
        id: 2,
        dayOffset: 7,
        type: "email",
        action: "Status Check Email",
        description: "Where are we at?",
        subActions: ["Send status check email"]
      },
      {
        id: 3,
        dayOffset: 21, // +14 from step 2
        type: "call",
        action: "Status Check Call",
        description: "Call for status check (if no email reply) + text",
        subActions: ["Make status check call", "Send text if needed"]
      },
      {
        id: 4,
        dayOffset: 28, // +7 (weekly follow-ups)
        type: "call",
        action: "Weekly Check-in",
        description: "Custom status check at preferred cadence",
        subActions: ["Weekly or bi-weekly check-in"]
      }
    ],
    transitions: {
      "deal_closed": {
        condition: "Deal is closed/won",
        newStatus: "CLOSED",
        description: "Deal successfully closed"
      },
      "lost_interest": {
        condition: "Lost interest or went cold",
        newStatus: "NOT INTERESTED",
        description: "Prospect lost interest"
      }
    }
  },
  {
    status: "CLOSED",
    steps: [
      {
        id: 1,
        dayOffset: 0,
        type: "email",
        action: "Delivery Email",
        description: "Send final 3D model link and instructions",
        subActions: ["Send delivery email with final 3D model"]
      },
      {
        id: 2,
        dayOffset: 30, // 1 month
        type: "email",
        action: "1-Month Check-in",
        description: "Check-in & feedback request (How can we improve?)",
        subActions: ["Send feedback request email"]
      },
      {
        id: 3,
        dayOffset: 180, // 6 months
        type: "email",
        action: "6-Month Market Update",
        description: "Market-update email / trends report",
        subActions: ["Send market trends report"]
      },
      {
        id: 4,
        dayOffset: 365, // 12 months
        type: "email",
        action: "Annual Market Update",
        description: "Annual market-update email / trends report",
        subActions: ["Send annual market update"]
      },
      {
        id: 5,
        dayOffset: 545, // 18 months (+6 months from previous)
        type: "email",
        action: "Semi-Annual Check-in",
        description: "Semi-annual check-in & insights",
        subActions: ["Send semi-annual check-in"]
      }
    ],
    transitions: {
      "new_needs": {
        condition: "They have new needs",
        newStatus: "INTERESTED",
        description: "Client has new project needs"
      }
    }
  }
]

export interface CadenceProgress {
  currentStep: number
  completedSteps: number[]
  lastActionDate: string
  nextActionDate: string
  isDormant: boolean
  statusCadence: StatusCadence | null
}

export function getCadenceForStatus(status: string): StatusCadence | null {
  return STATUS_CADENCES.find(cadence => cadence.status === status) || null
}

export function calculateCadenceProgress(
  notes: Array<{ type: string; timestamp: string; text: string }>,
  status: string,
  createdAt?: string
): CadenceProgress {
  const now = new Date()
  const sortedNotes = notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const lastNote = sortedNotes[0]
  
  // Get the appropriate cadence for the current status
  const statusCadence = getCadenceForStatus(status)
  
  if (!statusCadence) {
    return {
      currentStep: 1,
      completedSteps: [],
      lastActionDate: "",
      nextActionDate: now.toISOString(),
      isDormant: false,
      statusCadence: null
    }
  }

  // Use lead creation date as starting point if no notes exist
  const startDate = lastNote 
    ? new Date(lastNote.timestamp)
    : createdAt 
    ? new Date(createdAt)
    : now

  if (!lastNote && !createdAt) {
    return {
      currentStep: 1,
      completedSteps: [],
      lastActionDate: "",
      nextActionDate: now.toISOString(),
      isDormant: false,
      statusCadence
    }
  }

  const daysSinceLastAction = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Check for dormancy (30+ days with no action for active statuses)
  const activeStatuses = ["VOICEMAIL", "CONTACTED", "INTERESTED"]
  if (activeStatuses.includes(status) && daysSinceLastAction > 30) {
    return {
      currentStep: 0,
      completedSteps: [],
      lastActionDate: startDate.toISOString(),
      nextActionDate: now.toISOString(),
      isDormant: true,
      statusCadence
    }
  }

  // Calculate completed steps and current step based on status-specific logic
  const completedSteps: number[] = []
  let currentStep = 1

  // Status-specific progress calculation
  switch (status) {
    case "VOICEMAIL":
      return calculateVoicemailProgress(notes, startDate, statusCadence)
    case "CONTACTED":
      return calculateContactedProgress(notes, startDate, statusCadence)
    case "INTERESTED":
      return calculateInterestedProgress(notes, startDate, statusCadence)
    case "CLOSED":
      return calculateClosedProgress(notes, startDate, statusCadence)
    default:
      return {
        currentStep: 1,
        completedSteps: [],
        lastActionDate: startDate.toISOString(),
        nextActionDate: now.toISOString(),
        isDormant: false,
        statusCadence
      }
  }
}

function calculateVoicemailProgress(
  notes: Array<{ type: string; timestamp: string; text: string }>,
  startDate: Date,
  statusCadence: StatusCadence
): CadenceProgress {
  const now = new Date()
  const completedSteps: number[] = []
  let currentStep = 1

  // Count voicemails left
  const voicemails = notes.filter(note => 
    note.type === "call" && 
    (note.text.toLowerCase().includes("voicemail") || note.text.toLowerCase().includes("left message"))
  )

  // Calculate which steps should be completed based on time and voicemails
  statusCadence.steps.forEach((step, index) => {
    const stepDueDate = addBusinessDays(startDate, step.dayOffset)
    const hasMatchingVoicemail = voicemails.length > index
    
    if (hasMatchingVoicemail && now >= stepDueDate) {
      completedSteps.push(step.id)
      currentStep = step.id + 1
    }
  })

  // If we've completed all voicemail steps, we should transition to NOT INTERESTED
  if (completedSteps.length >= 4) {
    currentStep = 4 // Stay on final step
  }

  const nextStep = statusCadence.steps.find(step => step.id === currentStep)
  const nextActionDate = nextStep 
    ? addBusinessDays(startDate, nextStep.dayOffset).toISOString()
    : now.toISOString()

  return {
    currentStep,
    completedSteps,
    lastActionDate: startDate.toISOString(),
    nextActionDate,
    isDormant: false,
    statusCadence
  }
}

function calculateContactedProgress(
  notes: Array<{ type: string; timestamp: string; text: string }>,
  startDate: Date,
  statusCadence: StatusCadence
): CadenceProgress {
  const now = new Date()
  const completedSteps: number[] = []
  let currentStep = 1

  // Check for specific actions in notes
  const hasInitialCall = notes.some(note => note.type === "call")
  const hasIntroEmail = notes.some(note => 
    note.type === "email" && 
    (note.text.toLowerCase().includes("demo") || note.text.toLowerCase().includes("intro"))
  )
  const hasSpamCheck = notes.some(note => 
    note.type === "email" && 
    note.text.toLowerCase().includes("spam")
  )
  const hasFollowUpCall = notes.filter(note => note.type === "call").length >= 2
  const hasCaseStudy = notes.some(note => 
    note.type === "email" && 
    note.text.toLowerCase().includes("case study")
  )
  const hasSecondFollowUp = notes.filter(note => note.type === "call").length >= 3
  const hasFinalEmail = notes.some(note => 
    note.type === "email" && 
    (note.text.toLowerCase().includes("final") || note.text.toLowerCase().includes("last chance"))
  )

  // Calculate steps based on actions and timing
  statusCadence.steps.forEach((step) => {
    const stepDueDate = addBusinessDays(startDate, step.dayOffset)
    let stepCompleted = false

    switch (step.id) {
      case 1:
        stepCompleted = (hasInitialCall || hasIntroEmail) && now >= stepDueDate
        break
      case 2:
        stepCompleted = hasSpamCheck && now >= stepDueDate
        break
      case 3:
        stepCompleted = hasFollowUpCall && now >= stepDueDate
        break
      case 4:
        stepCompleted = hasCaseStudy && now >= stepDueDate
        break
      case 5:
        stepCompleted = hasSecondFollowUp && now >= stepDueDate
        break
      case 6:
        stepCompleted = hasFinalEmail && now >= stepDueDate
        break
    }

    if (stepCompleted) {
      completedSteps.push(step.id)
      currentStep = step.id + 1
    }
  })

  const nextStep = statusCadence.steps.find(step => step.id === currentStep)
  const nextActionDate = nextStep 
    ? addBusinessDays(startDate, nextStep.dayOffset).toISOString()
    : now.toISOString()

  return {
    currentStep,
    completedSteps,
    lastActionDate: startDate.toISOString(),
    nextActionDate,
    isDormant: false,
    statusCadence
  }
}

function calculateInterestedProgress(
  notes: Array<{ type: string; timestamp: string; text: string }>,
  startDate: Date,
  statusCadence: StatusCadence
): CadenceProgress {
  const now = new Date()
  const completedSteps: number[] = []
  let currentStep = 1

  // Check for specific actions
  const hasNextStepsEmail = notes.some(note => 
    note.type === "email" && 
    (note.text.toLowerCase().includes("next steps") || note.text.toLowerCase().includes("timeline"))
  )
  const hasStatusCheckEmail = notes.some(note => 
    note.type === "email" && 
    note.text.toLowerCase().includes("status")
  )
  const hasStatusCheckCall = notes.some(note => 
    note.type === "call" && 
    note.text.toLowerCase().includes("status")
  )
  const hasWeeklyCheckin = notes.filter(note => 
    note.text.toLowerCase().includes("check") || note.text.toLowerCase().includes("follow")
  ).length >= 3

  statusCadence.steps.forEach((step) => {
    const stepDueDate = addBusinessDays(startDate, step.dayOffset)
    let stepCompleted = false

    switch (step.id) {
      case 1:
        stepCompleted = hasNextStepsEmail && now >= stepDueDate
        break
      case 2:
        stepCompleted = hasStatusCheckEmail && now >= stepDueDate
        break
      case 3:
        stepCompleted = hasStatusCheckCall && now >= stepDueDate
        break
      case 4:
        stepCompleted = hasWeeklyCheckin && now >= stepDueDate
        break
    }

    if (stepCompleted) {
      completedSteps.push(step.id)
      currentStep = step.id + 1
    }
  })

  const nextStep = statusCadence.steps.find(step => step.id === currentStep)
  const nextActionDate = nextStep 
    ? addBusinessDays(startDate, nextStep.dayOffset).toISOString()
    : now.toISOString()

  return {
    currentStep,
    completedSteps,
    lastActionDate: startDate.toISOString(),
    nextActionDate,
    isDormant: false,
    statusCadence
  }
}

function calculateClosedProgress(
  notes: Array<{ type: string; timestamp: string; text: string }>,
  startDate: Date,
  statusCadence: StatusCadence
): CadenceProgress {
  const now = new Date()
  const completedSteps: number[] = []
  let currentStep = 1

  // Check for delivery and follow-up actions
  const hasDeliveryEmail = notes.some(note => 
    note.type === "email" && 
    (note.text.toLowerCase().includes("delivery") || note.text.toLowerCase().includes("final model"))
  )
  const hasOneMonthCheckin = notes.some(note => 
    note.type === "email" && 
    note.text.toLowerCase().includes("feedback")
  )
  const hasSixMonthUpdate = notes.filter(note => 
    note.type === "email" && 
    note.text.toLowerCase().includes("market")
  ).length >= 1
  const hasAnnualUpdate = notes.filter(note => 
    note.type === "email" && 
    note.text.toLowerCase().includes("market")
  ).length >= 2

  statusCadence.steps.forEach((step) => {
    const stepDueDate = addBusinessDays(startDate, step.dayOffset)
    let stepCompleted = false

    switch (step.id) {
      case 1:
        stepCompleted = hasDeliveryEmail && now >= stepDueDate
        break
      case 2:
        stepCompleted = hasOneMonthCheckin && now >= stepDueDate
        break
      case 3:
        stepCompleted = hasSixMonthUpdate && now >= stepDueDate
        break
      case 4:
        stepCompleted = hasAnnualUpdate && now >= stepDueDate
        break
      case 5:
        stepCompleted = notes.length >= 5 && now >= stepDueDate // Ongoing relationship
        break
    }

    if (stepCompleted) {
      completedSteps.push(step.id)
      currentStep = Math.min(step.id + 1, statusCadence.steps.length)
    }
  })

  const nextStep = statusCadence.steps.find(step => step.id === currentStep)
  const nextActionDate = nextStep 
    ? addBusinessDays(startDate, nextStep.dayOffset).toISOString()
    : addBusinessDays(now, 180).toISOString() // Default to 6 months for ongoing relationship

  return {
    currentStep,
    completedSteps,
    lastActionDate: startDate.toISOString(),
    nextActionDate,
    isDormant: false,
    statusCadence
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
    "cold": "NOT INTERESTED",
    "contacted": "CONTACTED", 
    "interested": "INTERESTED",
    "closed": "CLOSED",
    "dormant": "VOICEMAIL",
    "left voicemail": "VOICEMAIL",
    // New statuses (already correct)
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
  
  return statusMap[status] || "CONTACTED" // Default fallback
}

// Helper function to suggest status transitions based on interactions
export function suggestStatusTransition(
  currentStatus: string,
  notes: Array<{ type: string; timestamp: string; text: string }>
): { suggested: string; reason: string } | null {
  const latestNote = notes[0]
  if (!latestNote) return null

  const noteText = latestNote.text.toLowerCase()

  switch (currentStatus) {
    case "VOICEMAIL":
      if (latestNote.type === "call" && !noteText.includes("voicemail")) {
        return { suggested: "CONTACTED", reason: "Call was answered" }
      }
      if (noteText.includes("decline") || noteText.includes("not interested")) {
        return { suggested: "NOT INTERESTED", reason: "Explicitly declined" }
      }
      break

    case "CONTACTED":
      if (noteText.includes("interested") || noteText.includes("questions") || noteText.includes("positive")) {
        return { suggested: "INTERESTED", reason: "Showed interest or asked questions" }
      }
      if (noteText.includes("not interested") || noteText.includes("decline")) {
        return { suggested: "NOT INTERESTED", reason: "Declined or not interested" }
      }
      break

    case "INTERESTED":
      if (noteText.includes("closed") || noteText.includes("signed") || noteText.includes("won")) {
        return { suggested: "CLOSED", reason: "Deal closed successfully" }
      }
      if (noteText.includes("lost") || noteText.includes("not interested")) {
        return { suggested: "NOT INTERESTED", reason: "Lost interest" }
      }
      break

    case "CLOSED":
      if (noteText.includes("new project") || noteText.includes("additional needs")) {
        return { suggested: "INTERESTED", reason: "New project needs" }
      }
      break
  }

  return null
} 