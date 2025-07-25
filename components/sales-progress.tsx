"use client"

import { motion } from "framer-motion"
import { CheckCircle2, Clock, ArrowRight } from "lucide-react"
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
      <div className="p-4">
        <div className="text-center text-sm text-gray-500">
          Update lead status to use new workflow
        </div>
      </div>
    )
  }

  const workflow = STATUS_WORKFLOWS[progress.status]
  const totalActions = workflow.actions.length
  const statusProgressColor = statusColor || getStatusColor(progress.status)
  const completionPercentage = totalActions > 0 ? (progress.completedActions.length / totalActions) * 100 : 0

  // Handle terminal states simply
  if (totalActions === 0 || progress.status === "NOT INTERESTED") {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center gap-3">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusProgressColor }}
          />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {progress.status.replace("_", " ")}
          </span>
        </div>
      </div>
    )
  }

  const nextAction = progress.nextAction
  const hasAvailableActions = progress.availableActions.length > 0

  return (
    <div className="p-6 space-y-6">
      {/* Status and Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusProgressColor }}
            />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {progress.status.replace("_", " ")}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {progress.completedActions.length} of {totalActions} complete
          </span>
        </div>
        
        {/* Simple progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1">
          <motion.div
            className="h-1 rounded-full"
            style={{ backgroundColor: statusProgressColor }}
            initial={{ width: 0 }}
            animate={{ width: `${completionPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Next Action */}
      {nextAction && hasAvailableActions && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {nextAction.priority === "high" ? (
                <motion.div
                  className="w-2 h-2 rounded-full bg-red-500"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              ) : (
                <Clock className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                {nextAction.action}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {nextAction.description}
              </p>
              {nextAction.priority === "high" && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    Action needed
                  </span>
                </div>
              )}
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 mt-0.5" />
          </div>
        </div>
      )}
    </div>
  )
} 