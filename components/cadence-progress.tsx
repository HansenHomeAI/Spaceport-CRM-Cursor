"use client"

import { motion } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { colors } from "@/lib/colors"
import { SALES_CADENCE, type CadenceProgress } from "@/lib/sales-cadence"

interface CadenceProgressProps {
  progress: CadenceProgress[]
  status: string
  onStepClick?: (stepId: string) => void
  className?: string
}

export function CadenceProgress({ progress, status, onStepClick, className = "" }: CadenceProgressProps) {
  const statusColor = colors.status[status as keyof typeof colors.status] || {
    bg: "bg-gray-500/10",
    text: "text-gray-300",
    border: "border-gray-500/20",
    icon: "#6b7280",
  }

  const completedSteps = progress.filter(p => p.completed).length
  const totalSteps = SALES_CADENCE.length
  const progressPercentage = (completedSteps / totalSteps) * 100

  return (
    <div className={`w-full ${className}`}>
      {/* Progress Line Container */}
      <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
        {/* Glowing Progress Line */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full relative"
          style={{
            background: `linear-gradient(90deg, white 0%, ${statusColor.icon} 100%)`,
            boxShadow: `0 0 20px ${statusColor.icon}40, 0 0 40px ${statusColor.icon}20`
          }}
        />
        
        {/* Subtle glow effect */}
        <div 
          className="absolute inset-0 rounded-full opacity-30"
          style={{
            background: `linear-gradient(90deg, white 0%, ${statusColor.icon} 100%)`,
            filter: 'blur(8px)'
          }}
        />
      </div>

      {/* Step Markers */}
      <div className="relative mt-3">
        <div className="flex justify-between items-center">
          {SALES_CADENCE.map((step, index) => {
            const stepProgress = progress.find(p => p.stepId === step.id)
            const isCompleted = stepProgress?.completed || false
            const isOverdue = stepProgress?.overdue || false
            const stepPosition = (index / (SALES_CADENCE.length - 1)) * 100

            return (
              <TooltipProvider key={step.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative cursor-pointer"
                      onClick={() => onStepClick?.(step.id)}
                    >
                      {/* Step Marker */}
                      <div
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                          isCompleted
                            ? `bg-gradient-to-r from-white to-${statusColor.icon} border-white shadow-lg`
                            : isOverdue
                            ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50'
                            : 'bg-black/20 border-white/30 hover:border-white/60'
                        }`}
                        style={{
                          boxShadow: isCompleted 
                            ? `0 0 12px ${statusColor.icon}60, 0 0 24px ${statusColor.icon}30`
                            : isOverdue
                            ? '0 0 12px #ef444460, 0 0 24px #ef444430'
                            : 'none'
                        }}
                      />
                      
                      {/* Step Label */}
                      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                        <div className={`text-xs font-body ${
                          isCompleted ? 'text-white' : isOverdue ? 'text-red-300' : 'text-gray-400'
                        }`}>
                          {step.icon}
                        </div>
                        <div className={`text-xs font-body mt-1 ${
                          isCompleted ? 'text-white' : isOverdue ? 'text-red-300' : 'text-gray-400'
                        }`}>
                          Day {step.day}
                        </div>
                      </div>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-2xl p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{step.icon}</span>
                        <div>
                          <div className="font-body text-white font-medium">{step.title}</div>
                          <div className="text-xs text-gray-300 font-body">{step.description}</div>
                        </div>
                      </div>
                      {stepProgress && (
                        <div className="text-xs text-gray-400 font-body">
                          {isCompleted ? (
                            <span className="text-green-300">✓ Completed</span>
                          ) : isOverdue ? (
                            <span className="text-red-300">⚠ Overdue</span>
                          ) : (
                            <span className="text-blue-300">⏰ Scheduled</span>
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>
      </div>

      {/* Progress Summary */}
      <div className="mt-4 text-center">
        <div className="text-sm font-body text-gray-300">
          {completedSteps} of {totalSteps} steps completed
        </div>
        <div className="text-xs font-body text-gray-400 mt-1">
          {progress.find(p => p.overdue) ? (
            <span className="text-red-300">⚠ Overdue steps need attention</span>
          ) : (
            <span className="text-green-300">✓ On track</span>
          )}
        </div>
      </div>
    </div>
  )
} 