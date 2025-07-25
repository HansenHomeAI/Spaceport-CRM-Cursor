"use client"

import { motion } from "framer-motion"
import { Phone, Mail, Video, Users, MessageSquare, CheckCircle2, Clock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  STATUS_WORKFLOWS, 
  type StatusProgress, 
  type LeadStatus,
  getStatusColor
} from "@/lib/sales-cadence"

interface SalesProgressProps {
  progress: StatusProgress
  statusColor?: string
}

const actionIcons = {
  call: Phone,
  email: Mail,
  video: Video,
  social: Users,
  text: MessageSquare,
}

// Legacy fallback for old CadenceProgress
interface LegacyCadenceProgress {
  currentStep: number
  completedSteps: number[]
  lastActionDate: string
  nextActionDate: string
  isDormant: boolean
}

function isStatusProgress(progress: any): progress is StatusProgress {
  return 'status' in progress && 'availableActions' in progress
}

export function SalesProgress({ progress, statusColor }: SalesProgressProps) {
  // Handle legacy progress format
  if (!isStatusProgress(progress)) {
    return (
      <div className="relative py-4 px-2">
        <div className="text-center text-sm text-gray-400">
          Please update lead status to use new workflow
        </div>
      </div>
    )
  }

  const workflow = STATUS_WORKFLOWS[progress.status]
  const totalActions = workflow.actions.length
  const statusProgressColor = statusColor || getStatusColor(progress.status)

  // Handle empty workflow (like NOT INTERESTED)
  if (totalActions === 0) {
    return (
      <div className="relative py-4 px-2">
        <div className="text-center space-y-3">
          <div 
            className="w-8 h-8 rounded-full mx-auto flex items-center justify-center border"
            style={{ 
              borderColor: statusProgressColor,
              color: statusProgressColor
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-sm text-gray-300">{workflow.description}</div>
        </div>
      </div>
    )
  }

  const completionPercentage = (progress.completedActions.length / totalActions) * 100
  const nextAction = progress.availableActions[0] // Only show the most important next action

  return (
    <div className="space-y-4">
      {/* Clean status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusProgressColor }}
          />
          <span className="text-sm font-medium text-white">{progress.status}</span>
        </div>
        <div className="text-xs text-gray-400">
          Day {progress.daysInStatus}
        </div>
      </div>

      {/* Simple progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Progress</span>
          <span className="text-xs text-gray-400">
            {progress.completedActions.length}/{totalActions}
          </span>
        </div>
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: statusProgressColor }}
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Next action - clean and minimal */}
      {nextAction && (
        <div 
          className="p-3 rounded-lg border border-gray-800 bg-gray-900/50"
          style={{ borderLeftColor: statusProgressColor, borderLeftWidth: '2px' }}
        >
          <div className="flex items-center gap-2 mb-1">
            {(() => {
              const Icon = actionIcons[nextAction.type]
              return <Icon className="w-3 h-3 text-gray-400" />
            })()}
            <span className="text-sm font-medium text-white">{nextAction.action}</span>
            {nextAction.priority === "high" && (
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            )}
          </div>
          <p className="text-xs text-gray-400">{nextAction.description}</p>
        </div>
      )}
    </div>
  )
} 