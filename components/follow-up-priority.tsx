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
  urgency: "high" | "medium"
  nextAction: "call" | "email"
  daysOverdue: number
  reason: string
}

interface FollowUpPriorityProps {
  leads: Lead[]
  onLeadSelect: (lead: Lead) => void
}

const urgencyColors = {
  high: "bg-green-500/10 text-green-300 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
}

const urgencyIcons = {
  high: AlertTriangle,
  medium: Clock,
}

export function FollowUpPriority({ leads, onLeadSelect }: FollowUpPriorityProps) {
  const [expandedGroup, setExpandedGroup] = useState<"high" | "medium" | null>("high")

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

  // Calculate follow-up priorities based on status
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
            followUps.push({
              lead,
              urgency: "high",
              nextAction: "call",
              daysOverdue: daysOverdue,
              reason: daysOverdue === 0 ? "Scheduled to contact today" : `Scheduled contact overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
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
        followUps.push({
          lead,
          urgency: "high",
          nextAction: "call",
          daysOverdue: 0,
          reason: "No initial contact made",
        })
        return
      }

      const daysSinceLastContact = Math.floor(
        (now.getTime() - new Date(lastInteraction.timestamp).getTime()) / (1000 * 60 * 60 * 24),
      )

      // High priority: "Interested" and "Contacted" leads
      if (normalizedStatus === "Interested" || normalizedStatus === "Contacted") {
        if (daysSinceLastContact > 7) {
          followUps.push({
            lead,
            urgency: "high",
            nextAction: "call",
            daysOverdue: daysSinceLastContact - 7,
            reason: `${normalizedStatus} lead - ready for follow-up`,
          })
        }
        return
      }

      // Medium priority: "Left Voicemail" and "Closed" leads
      if (normalizedStatus === "Left Voicemail" || normalizedStatus === "Closed") {
        if (daysSinceLastContact > 30) {
          return // Don't include very old leads
        }

        if (daysSinceLastContact > 7) {
          followUps.push({
            lead,
            urgency: "medium",
            nextAction: lastInteraction.type === "call" ? "email" : "call",
            daysOverdue: daysSinceLastContact - 7,
            reason: `${normalizedStatus} lead - past due follow-up`,
          })
        }
      }

      // "Not Interested" leads are excluded from follow-ups
    })

    return followUps.sort((a, b) => {
      const urgencyOrder = { high: 2, medium: 1 }
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency] || b.daysOverdue - a.daysOverdue
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
      default:
        return "Other"
    }
  }

  const toggleGroup = (urgency: "high" | "medium") => {
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
              onClick={() => toggleGroup(urgency as "high" | "medium")}
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
                      backgroundColor: urgency === "high" ? "#22c55e" : "#eab308" // Green for high, yellow for medium
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
