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

      // High priority: "Interested" leads (within 56 days of last contact)
      if (normalizedStatus === "Interested") {
        if (daysSinceLastContact <= 56) {
          followUps.push({
            lead,
            urgency: "high",
            nextAction: "call",
            daysOverdue: 0,
            reason: "Interested lead - recent contact",
          })
        } else {
          followUps.push({
            lead,
            urgency: "medium",
            nextAction: "call",
            daysOverdue: daysSinceLastContact - 56,
            reason: "Interested lead - needs re-engagement",
          })
        }
        return
      }

      // Medium priority: "Contacted" leads (unless they have a follow-up date)
      if (normalizedStatus === "Contacted") {
        // Check if there's a follow-up reminder due today or overdue
        const followUpReminders = lead.notes.filter(note => 
          note.text.includes("Set reminder:") && 
          new Date(note.timestamp) <= today
        )
        
        if (followUpReminders.length > 0) {
          // Check if any actions were taken after the reminder
          const mostRecentReminder = followUpReminders.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0]
          
          const actionsAfterReminder = lead.notes.filter(note => 
            !note.text.includes("Set reminder:") && 
            new Date(note.timestamp) > new Date(mostRecentReminder.timestamp)
          )
          
          if (actionsAfterReminder.length === 0) {
            const daysOverdue = Math.floor((today.getTime() - new Date(mostRecentReminder.timestamp).getTime()) / (1000 * 60 * 60 * 24))
            followUps.push({
              lead,
              urgency: "high",
              nextAction: "call",
              daysOverdue: daysOverdue,
              reason: daysOverdue === 0 ? "Scheduled follow-up due today" : `Scheduled follow-up overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
            })
            return
          }
        }
        
        // Default priority for contacted leads without follow-up dates
        if (daysSinceLastContact <= 56) {
          followUps.push({
            lead,
            urgency: "medium",
            nextAction: "call",
            daysOverdue: 0,
            reason: "Contacted lead - recent contact",
          })
        } else {
          followUps.push({
            lead,
            urgency: "low",
            nextAction: "call",
            daysOverdue: daysSinceLastContact - 56,
            reason: "Contacted lead - needs re-engagement",
          })
        }
        return
      }

      // Low priority: "Left Voicemail" and "Closed" leads
      if (normalizedStatus === "Left Voicemail" || normalizedStatus === "Closed") {
        if (daysSinceLastContact > 90) {
          return // Don't include very old leads
        }

        if (daysSinceLastContact <= 56) {
          followUps.push({
            lead,
            urgency: "low",
            nextAction: lastInteraction.type === "call" ? "email" : "call",
            daysOverdue: 0,
            reason: `${normalizedStatus} lead - recent contact`,
          })
        } else {
          followUps.push({
            lead,
            urgency: "low",
            nextAction: lastInteraction.type === "call" ? "email" : "call",
            daysOverdue: daysSinceLastContact - 56,
            reason: `${normalizedStatus} lead - needs re-engagement`,
          })
        }
      }

      // "Not Interested" leads are excluded from follow-ups
    })

    return followUps.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 }
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
      <div className="space-y-4">
        {Object.entries(groupedFollowUps).map(([urgency, items]) => (
          <div key={urgency} className="space-y-3">
            {/* Minimalist Accordion Header */}
            <div
              onClick={() => toggleGroup(urgency as "high" | "medium" | "low")}
              className="flex items-center justify-between p-3 cursor-pointer transition-all duration-300 hover:bg-white/5 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: urgency === "high" ? "#22c55e" : urgency === "medium" ? "#eab308" : "#6b7280"
                  }}
                />
                <span className="text-white font-medium text-sm">
                  {getGroupTitle(urgency)} ({items.length})
                </span>
              </div>
              {expandedGroup === urgency ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </div>

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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4">
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
                          <div
                            className="bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer rounded-xl p-4"
                            onClick={() => onLeadSelect(item.lead)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-medium text-sm truncate">{item.lead.name}</h3>
                                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.reason}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {item.nextAction === "call" ? (
                                <Phone className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Mail className="h-3 w-3 text-blue-400" />
                              )}
                              <span className="text-xs text-gray-300 font-medium">
                                {item.nextAction === "call" ? "Call" : "Email"}
                              </span>
                            </div>
                          </div>
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
