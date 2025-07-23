export interface CadenceStep {
  id: string
  day: number
  type: 'call' | 'email' | 'voicemail' | 'linkedin' | 'video'
  title: string
  description: string
  action: string
  icon: string
}

export const SALES_CADENCE: CadenceStep[] = [
  {
    id: 'initial-contact',
    day: 1,
    type: 'call',
    title: 'Initial Call + Voicemail',
    description: 'Make first contact and leave voicemail',
    action: 'Call + Leave Voicemail',
    icon: '📞'
  },
  {
    id: 'email-1',
    day: 1,
    type: 'email',
    title: 'Tour Link Email',
    description: 'Send tour link with GIF preview',
    action: 'Send Tour Email',
    icon: '📧'
  },
  {
    id: 'email-2',
    day: 3,
    type: 'email',
    title: 'Spam Check Email',
    description: 'Follow-up email + LinkedIn connect',
    action: 'Send Spam Check Email',
    icon: '📧'
  },
  {
    id: 'call-2',
    day: 5,
    type: 'call',
    title: 'Second Call',
    description: 'Call with tour link reference',
    action: 'Make Follow-up Call',
    icon: '📞'
  },
  {
    id: 'email-3',
    day: 7,
    type: 'email',
    title: 'Case Study Email',
    description: 'Luxury case study + screenshot',
    action: 'Send Case Study',
    icon: '📧'
  },
  {
    id: 'video-email',
    day: 10,
    type: 'video',
    title: 'Video Email',
    description: '60-second personalized video',
    action: 'Send Video Email',
    icon: '🎥'
  },
  {
    id: 'email-4',
    day: 14,
    type: 'email',
    title: 'ROI/Data Email',
    description: 'Share ROI and performance data',
    action: 'Send ROI Email',
    icon: '📊'
  },
  {
    id: 'email-5',
    day: 25,
    type: 'email',
    title: 'Success Story Email',
    description: 'New success story, soft re-engagement',
    action: 'Send Success Story',
    icon: '📧'
  }
]

export interface CadenceProgress {
  stepId: string
  completed: boolean
  completedDate?: string
  scheduledDate?: string
  overdue: boolean
}

export function calculateCadenceProgress(lead: any): CadenceProgress[] {
  const now = new Date()
  const lastInteraction = lead.notes
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  if (!lastInteraction) {
    // No interaction yet - start at day 1
    return SALES_CADENCE.map(step => ({
      stepId: step.id,
      completed: false,
      scheduledDate: new Date().toISOString(),
      overdue: false
    }))
  }

  const lastInteractionDate = new Date(lastInteraction.timestamp)
  const daysSinceLastContact = Math.floor(
    (now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  return SALES_CADENCE.map(step => {
    const stepDate = new Date(lastInteractionDate.getTime() + (step.day - 1) * 24 * 60 * 60 * 1000)
    const isOverdue = now > stepDate
    const isCompleted = lead.notes.some((note: any) => 
      note.cadenceStepId === step.id && note.type === step.type
    )

    return {
      stepId: step.id,
      completed: isCompleted,
      completedDate: isCompleted ? lead.notes.find((note: any) => 
        note.cadenceStepId === step.id
      )?.timestamp : undefined,
      scheduledDate: stepDate.toISOString(),
      overdue: isOverdue && !isCompleted
    }
  })
}

export function getNextRecommendedStep(lead: any): CadenceStep | null {
  const progress = calculateCadenceProgress(lead)
  const nextStep = progress.find(p => !p.completed && p.overdue)
  
  if (nextStep) {
    return SALES_CADENCE.find(step => step.id === nextStep.stepId) || null
  }

  // If no overdue steps, find the next scheduled step
  const now = new Date()
  const nextScheduled = progress.find(p => 
    !p.completed && new Date(p.scheduledDate!) > now
  )

  if (nextScheduled) {
    return SALES_CADENCE.find(step => step.id === nextScheduled.stepId) || null
  }

  return null
} 