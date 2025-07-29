"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, AlertTriangle, Phone, Mail, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Lead } from "./leads-table"

interface FollowUpItem {
  lead: Lead
  urgency: "high" | "medium" | "low"
  nextAction: "call" | "email"
  daysOverdue: number
  reason: string
  priorityScore: number // Add priority score
}

interface FollowUpPriorityProps {
  leads: Lead[]
  onLeadSelect: (lead: Lead) => void
}

const urgencyColors = {
  high: "bg-green-500/10 text-green-300 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  low: "bg-gray-500/10 text-gray-300 border-gray-500/20",
}

const urgencyIcons = {
  high: AlertTriangle,
  medium: Clock,
  low: Clock,
}

export function FollowUpPriority({ leads, onLeadSelect }: FollowUpPriorityProps) {
  const [expandedGroup, setExpandedGroup] = useState<"high" | "medium" | "low" | null>("high")

  // Helper function to normalize old status values to new ones
  const normalizeStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      "cold": "Not Interested",
      "contacted": "Contacted", 
      "interested": "Interested",
      "closed": "Closed",
      "dormant": "Not Interested",
      "left voicemail": "Left Voicemail",
      // New statuses (already correct)
      "Left Voicemail": "Left Voicemail",
      "Contacted": "Contacted",
      "Interested": "Interested", 
      "Not Interested": "Not Interested",
      "Closed": "Closed"
    }
    
    return statusMap[status] || "Left Voicemail"
  }

  // Enhanced priority calculation with scoring system
  const calculateFollowUps = (): FollowUpItem[] => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const followUps: FollowUpItem[] = []

    leads.forEach((lead) => {
      // Normalize the status to handle old data
      const normalizedStatus = normalizeStatus(lead.status)
      
      const lastInteraction = lead.notes.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0]

      // Calculate priority score based on multiple factors
      const calculatePriorityScore = (): number => {
        let score = 0
        
        // Base score from status (0-100)
        const statusScores: Record<string, number> = {
          "Interested": 100,
          "Contacted": 80,
          "Left Voicemail": 60,
          "Closed": 40,
          "Not Interested": 0
        }
        score += statusScores[normalizedStatus] || 0
        
        // Engagement history bonus (0-50)
        const callCount = lead.notes.filter(note => note.type === "call").length
        const emailCount = lead.notes.filter(note => note.type === "email").length
        const totalInteractions = callCount + emailCount
        
        // Bonus for multiple interactions (shows engagement)
        if (totalInteractions >= 3) score += 30
        else if (totalInteractions >= 2) score += 20
        else if (totalInteractions >= 1) score += 10
        
        // Bonus for recent activity (0-30)
        if (lastInteraction) {
          const daysSinceLastContact = Math.floor(
            (now.getTime() - new Date(lastInteraction.timestamp).getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSinceLastContact <= 1) score += 30
          else if (daysSinceLastContact <= 3) score += 20
          else if (daysSinceLastContact <= 7) score += 10
        }
        
        // Penalty for overdue follow-ups (-50 to 0)
        const daysSinceLastContact = lastInteraction ? Math.floor(
          (now.getTime() - new Date(lastInteraction.timestamp).getTime()) / (1000 * 60 * 60 * 24)
        ) : 999
        
        if (daysSinceLastContact > 30) score -= 50
        else if (daysSinceLastContact > 14) score -= 30
        else if (daysSinceLastContact > 7) score -= 15
        
        // Bonus for leads with complete information (0-20)
        if (lead.name && lead.name !== "Unknown Contact" && 
            lead.address && lead.address !== "Address not provided") {
          score += 20
        }
        
        // Bonus for leads with company information (0-10)
        if (lead.company && lead.company.trim()) {
          score += 10
        }
        
        return Math.max(0, Math.min(200, score)) // Cap at 200
      }

      // Check for reminders due today or overdue (highest priority)
      const allReminders = lead.notes.filter(note => note.text.includes("Set reminder:"))
      
      if (allReminders.length > 0) {
        const mostRecentReminder = allReminders.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0]
        
        const reminderDate = new Date(mostRecentReminder.timestamp)
        const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate())
        
        if (reminderDay <= today) {
          const actionsAfterReminder = lead.notes.filter(note => 
            !note.text.includes("Set reminder:") && 
            new Date(note.timestamp) > reminderDate
          )
          
          if (actionsAfterReminder.length === 0) {
            const daysOverdue = Math.floor((today.getTime() - reminderDay.getTime()) / (1000 * 60 * 60 * 24))
            const priorityScore = calculatePriorityScore() + 100 // Bonus for overdue reminders
            followUps.push({
              lead,
              urgency: priorityScore >= 150 ? "high" : priorityScore >= 100 ? "medium" : "low",
              nextAction: "call",
              daysOverdue: daysOverdue,
              reason: daysOverdue === 0 ? "Scheduled to contact today" : `Scheduled contact overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
              priorityScore: priorityScore
            })
            return
          }
        } else {
          return // Future reminders - exclude from follow-ups
        }
      }

      // Check for future reminders - exclude leads with upcoming scheduled contact
      const futureReminders = lead.notes.filter(note => {
        if (!note.text.includes("Set reminder:")) return false
        const reminderDate = new Date(note.timestamp)
        const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate())
        return reminderDay > today
      })
      
      if (futureReminders.length > 0) {
        return // Has future reminders - exclude from follow-ups to avoid redundancy
      }

      if (!lastInteraction) {
        const priorityScore = calculatePriorityScore() + 50 // Bonus for new leads
        followUps.push({
          lead,
          urgency: priorityScore >= 150 ? "high" : priorityScore >= 100 ? "medium" : "low",
          nextAction: "call",
          daysOverdue: 0,
          reason: "No initial contact made",
          priorityScore: priorityScore
        })
        return
      }

      const daysSinceLastContact = Math.floor(
        (now.getTime() - new Date(lastInteraction.timestamp).getTime()) / (1000 * 60 * 60 * 24),
      )

      // Calculate priority score for existing leads
      const priorityScore = calculatePriorityScore()
      
      // Determine urgency based on score and status-specific logic
      let urgency: "high" | "medium" | "low" = "low"
      let shouldInclude = false
      let reason = ""

      if (normalizedStatus === "Interested") {
        if (daysSinceLastContact > 3) { // Reduced from 7 days for interested leads
          urgency = priorityScore >= 150 ? "high" : priorityScore >= 100 ? "medium" : "low"
          shouldInclude = true
          reason = "Interested lead - ready for follow-up"
        }
      } else if (normalizedStatus === "Contacted") {
        if (daysSinceLastContact > 5) { // Reduced from 7 days for contacted leads
          urgency = priorityScore >= 150 ? "high" : priorityScore >= 100 ? "medium" : "low"
          shouldInclude = true
          reason = "Contacted lead - ready for follow-up"
        }
      } else if (normalizedStatus === "Left Voicemail" || normalizedStatus === "Closed") {
        if (daysSinceLastContact > 7 && daysSinceLastContact <= 30) {
          urgency = priorityScore >= 120 ? "medium" : "low"
          shouldInclude = true
          reason = `${normalizedStatus} lead - past due follow-up`
        }
      }

      if (shouldInclude) {
        followUps.push({
          lead,
          urgency,
          nextAction: lastInteraction.type === "call" ? "email" : "call",
          daysOverdue: daysSinceLastContact - (normalizedStatus === "Interested" ? 3 : normalizedStatus === "Contacted" ? 5 : 7),
          reason,
          priorityScore
        })
      }

      // "Not Interested" leads are excluded from follow-ups
    })

    return followUps.sort((a, b) => {
      // Sort by priority score first, then by urgency, then by days overdue
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore
      }
      const urgencyOrder = { high: 3, medium: 2, low: 1 }
      if (urgencyOrder[b.urgency] !== urgencyOrder[a.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency]
      }
      return b.daysOverdue - a.daysOverdue
    })
  }

  const followUps = calculateFollowUps()

  if (followUps.length === 0) return null

  // Group follow-ups by priority type
  const groupedFollowUps = followUps.reduce((groups, item) => {
    const group = item.urgency
    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(item)
    return groups
  }, {} as Record<string, FollowUpItem[]>)

  const getGroupColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      case "medium":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      case "low":
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  }

  const getGroupTitle = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "High Priority"
      case "medium":
        return "Medium Priority"
      case "low":
        return "Low Priority"
      default:
        return "Other"
    }
  }

  const toggleGroup = (urgency: "high" | "medium" | "low") => {
    setExpandedGroup(expandedGroup === urgency ? null : urgency)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mb-8"
    >
      <h2 className="text-2xl font-title text-primary-hierarchy mb-6">Priority Follow-ups</h2>
      <div className="space-y-3">
        {Object.entries(groupedFollowUps).map(([urgency, items]) => (
          <div key={urgency} className="space-y-3">
            {/* Accordion Header */}
            <Button
              onClick={() => toggleGroup(urgency as "high" | "medium" | "low")}
              variant="ghost"
              className={`w-full justify-between p-4 h-auto rounded-2xl border-2 transition-all duration-300 ${
                expandedGroup === urgency 
                  ? `${getGroupColor(urgency)} border-white/20` 
                  : "bg-black/10 backdrop-blur-sm border-white/10 hover:bg-black/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <Badge className="bg-black/20 text-white border-2 border-white/10 rounded-full px-4 py-1.5 font-body flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ 
                      backgroundColor: urgency === "high" ? "#22c55e" : urgency === "medium" ? "#eab308" : "#6b7280" // Green for high, yellow for medium, gray for low
                    }}
                  />
                  {getGroupTitle(urgency)} ({items.length})
                </Badge>
              </div>
              {expandedGroup === urgency ? (
                <ChevronDown className="h-5 w-5 text-white" />
              ) : (
                <ChevronRight className="h-5 w-5 text-white" />
              )}
            </Button>

            {/* Accordion Content */}
            <AnimatePresence>
              {expandedGroup === urgency && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 pt-2">
                    {items.map((item) => {
                      const UrgencyIcon = urgencyIcons[item.urgency]

                      return (
                        <motion.div
                          key={item.lead.id}
                          layout
                          className="relative"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Card
                            className="bg-black/20 backdrop-blur-xl border-2 border-white/20 hover:bg-black/30 transition-all duration-300 cursor-pointer rounded-2xl"
                            onClick={() => onLeadSelect(item.lead)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-primary-hierarchy font-title text-sm truncate">{item.lead.name}</h3>
                                  <p className="text-xs text-gray-400 font-body mt-1">{item.reason}</p>
                                  <p className="text-xs text-purple-400 font-body mt-1">Score: {item.priorityScore}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {item.nextAction === "call" ? (
                                  <Phone className="h-3 w-3 text-purple-400" />
                                ) : (
                                  <Mail className="h-3 w-3 text-purple-400" />
                                )}
                                <span className="text-medium-hierarchy font-body text-xs">
                                  {item.nextAction === "call" ? "Call" : "Email"}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
