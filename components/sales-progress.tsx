"use client"

import { motion } from "framer-motion"
import { Phone, Mail, Video, Users, MessageSquare, Calendar, CheckCircle2, Clock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { 
  STATUS_WORKFLOWS, 
  type StatusProgress, 
  type LeadStatus,
  type StatusAction,
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

const priorityColors = {
  high: "#ef4444", // red
  medium: "#f59e0b", // amber
  low: "#6b7280", // gray
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
    const legacyProgress = progress as LegacyCadenceProgress
    
    return (
      <div className="relative py-6 px-2">
        <div className="text-center text-sm text-medium-hierarchy">
          Legacy cadence system - please update lead status to use new workflow
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
      <div className="relative py-6 px-2">
        <div className="text-center space-y-2">
          <div 
            className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
            style={{ 
              backgroundColor: `${statusProgressColor}20`,
              border: `2px solid ${statusProgressColor}`,
              boxShadow: `0 0 20px ${statusProgressColor}40`
            }}
          >
            <CheckCircle2 className="w-6 h-6" style={{ color: statusProgressColor }} />
          </div>
          <div className="text-sm font-title text-primary-hierarchy">{workflow.description}</div>
        </div>
      </div>
    )
  }

  const stepWidth = totalActions > 1 ? 100 / (totalActions - 1) : 0
  const completionPercentage = (progress.completedActions.length / totalActions) * 100

  return (
    <div className="relative py-8 px-2">
      {/* Status Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Badge 
            className="text-white border-2 rounded-full px-4 py-1.5 font-title"
            style={{ 
              backgroundColor: `${statusProgressColor}20`,
              borderColor: statusProgressColor,
              color: statusProgressColor
            }}
          >
            {progress.status}
          </Badge>
          <div className="text-xs text-medium-hierarchy">
            Day {progress.daysInStatus} in status
          </div>
        </div>
        <div className="text-sm text-medium-hierarchy font-body max-w-xs mx-auto">
          {workflow.description}
        </div>
      </div>

      {/* Base line with gradient and glow */}
      <div className="absolute h-[3px] left-0 right-0 top-1/2 -translate-y-1/2">
        <div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(to right, ${statusProgressColor}40, ${statusProgressColor})`,
            boxShadow: `0 0 10px rgba(255, 255, 255, 0.2), 0 0 20px ${statusProgressColor}40`
          }}
        />
      </div>
      
      {/* Progress line showing completed actions */}
      <motion.div 
        className="absolute h-[3px] left-0 top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out rounded-full"
        initial={{ width: "0%" }}
        animate={{ width: `${completionPercentage}%` }}
        style={{
          background: `linear-gradient(to right, ${statusProgressColor}, ${statusProgressColor})`,
          boxShadow: `0 0 15px ${statusProgressColor}60, 0 0 30px ${statusProgressColor}40`
        }}
      />

      {/* Action markers */}
      {workflow.actions.map((action, index) => {
        const ActionIcon = actionIcons[action.type]
        const isCompleted = progress.completedActions.includes(action.id)
        const isCurrent = progress.currentActionId === action.id
        const isAvailable = progress.availableActions.some(a => a.id === action.id)
        const isFuture = !isCompleted && !isAvailable
        const position = totalActions > 1 ? `${index * stepWidth}%` : "50%"

        // Determine priority glow
        const priorityGlow = priorityColors[action.priority]

        return (
          <TooltipProvider key={action.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: position }}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.3 : isCompleted ? 1.2 : isAvailable ? 1.1 : 1,
                      boxShadow: isCurrent
                        ? `0 0 0 6px ${statusProgressColor}30, 0 0 25px ${statusProgressColor}50, 0 0 0 2px ${priorityGlow}60`
                        : isCompleted
                        ? `0 0 0 3px ${statusProgressColor}50, 0 0 15px ${statusProgressColor}40`
                        : isAvailable
                        ? `0 0 0 2px ${priorityGlow}60, 0 0 15px ${priorityGlow}40`
                        : "none"
                    }}
                    transition={{ duration: 0.3 }}
                    className={`relative w-5 h-5 rounded-full border-2 ${
                      isCompleted
                        ? `border-white shadow-lg`
                        : isCurrent
                        ? `border-white bg-white/30`
                        : isAvailable
                        ? `border-white bg-white/20`
                        : isFuture
                        ? `border-white/30 bg-transparent`
                        : `border-white/50 bg-transparent`
                    }`}
                    style={{
                      backgroundColor: isCompleted ? statusProgressColor : 'transparent'
                    }}
                  >
                    {/* Priority indicator */}
                    {action.priority === "high" && (isAvailable || isCurrent) && (
                      <motion.div
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                        style={{ backgroundColor: priorityGlow }}
                        animate={{ 
                          opacity: [0.7, 1, 0.7],
                          scale: [0.8, 1, 0.8]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}

                    <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                      <ActionIcon
                        className={`w-5 h-5 ${
                          isCompleted || isCurrent ? "text-white" 
                          : isAvailable ? "text-white/90"
                          : isFuture ? "text-white/30" 
                          : "text-white/50"
                        }`}
                      />
                    </div>

                    {/* Action type badge */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                      <Badge 
                        className="text-xs px-2 py-0.5 rounded-full border font-body"
                        style={{
                          backgroundColor: isCompleted || isAvailable ? `${statusProgressColor}20` : "transparent",
                          borderColor: isCompleted || isAvailable ? statusProgressColor : "rgba(255,255,255,0.2)",
                          color: isCompleted || isAvailable ? statusProgressColor : "rgba(255,255,255,0.5)"
                        }}
                      >
                        {action.type}
                      </Badge>
                    </div>
                  </motion.div>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-black/90 backdrop-blur-xl border-white/10 rounded-xl"
              >
                <div className="text-sm font-body max-w-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-semibold text-primary-hierarchy">{action.action}</div>
                    {action.priority === "high" && (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
                        High Priority
                      </Badge>
                    )}
                  </div>
                  <div className="text-gray-400 mb-2">{action.description}</div>
                  <div className="text-xs text-gray-500">
                    {action.dayOffset === 0 ? "Today" : `Day ${action.dayOffset}`}
                  </div>
                  {isFuture && (
                    <div className="text-xs text-gray-600 mt-1">Not yet due</div>
                  )}
                  {isAvailable && !isCompleted && (
                    <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Action due
                    </div>
                  )}
                  {isCurrent && (
                    <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Current priority
                    </div>
                  )}
                  {isCompleted && (
                    <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}

      {/* Progress stats */}
      <div className="flex justify-between items-center mt-12 text-xs text-medium-hierarchy">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {progress.completedActions.length} of {totalActions} completed
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {progress.availableActions.length} actions due
        </div>
      </div>
    </div>
  )
} 