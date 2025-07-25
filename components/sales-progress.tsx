"use client"

import { motion } from "framer-motion"
import { Phone, Mail, Video, Users } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getCadenceSteps, type CadenceProgress } from "@/lib/sales-cadence"

interface SalesProgressProps {
  progress: CadenceProgress
  statusColor: string
  leadStatus: string
}

const stepIcons = {
  call: Phone,
  email: Mail,
  video: Video,
  social: Users,
}

export function SalesProgress({ progress, statusColor, leadStatus }: SalesProgressProps) {
  const cadenceSteps = getCadenceSteps(leadStatus)
  const totalSteps = cadenceSteps.length
  
  // Don't show progress for statuses without cadences
  if (totalSteps === 0 || leadStatus === "Not Interested") {
    return (
      <div className="relative py-6 px-2">
        <div className="text-center text-gray-400 text-sm">
          {leadStatus === "Not Interested" ? "No follow-up cadence - lead not interested" :
           "No cadence defined for this status"}
        </div>
      </div>
    )
  }
  
  const stepWidth = 100 / (totalSteps - 1) // percentage width between steps

  return (
    <div className="relative py-6 px-2">
      {/* Base line with gradient and glow */}
      <div className="absolute h-[2px] left-0 right-0 top-1/2 -translate-y-1/2">
        <div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(to right, white, ${statusColor})`,
            boxShadow: `0 0 10px rgba(255, 255, 255, 0.2), 0 0 20px ${statusColor}40`
          }}
        />
      </div>
      
      {/* Progress line showing completed steps */}
      <div className="absolute h-[2px] left-0 top-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
        style={{
          width: totalSteps > 1 ? `${(progress.completedSteps.length / (totalSteps - 1)) * 100}%` : "0%",
          background: `linear-gradient(to right, ${statusColor}, ${statusColor})`,
          boxShadow: `0 0 10px ${statusColor}40`
        }}
      />

      {/* Step markers */}
      {cadenceSteps.map((step, index) => {
        const StepIcon = stepIcons[step.type]
        const isCompleted = progress.completedSteps.includes(step.id)
        const isCurrent = progress.currentStep === step.id
        const isFuture = step.id > progress.currentStep
        const position = `${index * stepWidth}%`

        return (
          <TooltipProvider key={step.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: position }}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.2 : isCompleted ? 1.1 : 1,
                      boxShadow: isCurrent
                        ? `0 0 0 4px ${statusColor}20, 0 0 20px ${statusColor}40`
                        : isCompleted
                        ? `0 0 0 2px ${statusColor}40, 0 0 10px ${statusColor}30`
                        : "none"
                    }}
                    className={`relative w-4 h-4 rounded-full transition-all duration-300 border-2 ${
                      isCompleted
                        ? `border-white shadow-lg`
                        : isCurrent
                        ? `border-white bg-white/20`
                        : isFuture
                        ? `border-white/20 bg-transparent`
                        : `border-white/50 bg-transparent`
                    }`}
                    style={{
                      backgroundColor: isCompleted ? statusColor : 'transparent'
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                      <StepIcon
                        className={`w-4 h-4 ${
                          isCompleted || isCurrent ? "text-white" : isFuture ? "text-white/20" : "text-white/50"
                        }`}
                      />
                    </div>
                  </motion.div>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-black/90 backdrop-blur-xl border-white/10 rounded-xl"
              >
                <div className="text-sm font-body">
                  <div className="font-semibold mb-1">{step.action}</div>
                  <div className="text-gray-400">{step.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {step.dayOffset === 0 ? "Immediate" : `+${step.dayOffset} business days`}
                  </div>
                  {isFuture && (
                    <div className="text-xs text-gray-600 mt-1">Not yet due</div>
                  )}
                  {isCurrent && !isCompleted && (
                    <div className="text-xs text-yellow-400 mt-1">In progress</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
    </div>
  )
} 