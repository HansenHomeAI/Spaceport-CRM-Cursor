"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, AlertTriangle, Phone, Mail } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Lead } from "./leads-table"

interface FollowUpItem {
  lead: Lead
  urgency: "high" | "medium" | "low" | "dormant-interested"
  nextAction: "call" | "email"
  daysOverdue: number
  reason: string
}

interface FollowUpPriorityProps {
  leads: Lead[]
  onLeadSelect: (lead: Lead) => void
}

const urgencyColors = {
  high: "bg-red-500/10 text-red-300 border-red-500/20",
  medium: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  low: "bg-green-500/10 text-green-300 border-green-500/20",
}

const urgencyIcons = {
  high: AlertTriangle,
  medium: Clock,
  low: Clock,
}

export function FollowUpPriority({ leads, onLeadSelect }: FollowUpPriorityProps) {
  // Calculate follow-up priorities based on your cadence
  const calculateFollowUps = (): FollowUpItem[] => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Start of today
    const followUps: FollowUpItem[] = []

    leads.forEach((lead) => {
      if (lead.status === "closed") return

      const lastInteraction = lead.notes.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0]

      // Check for reminders (both upcoming and overdue)
      const allReminders = lead.notes.filter(note => note.text.includes("Set reminder:"))
      
      if (allReminders.length > 0) {
        // Find the most recent reminder
        const mostRecentReminder = allReminders.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0]
        
        const reminderDate = new Date(mostRecentReminder.timestamp)
        const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate())
        
        // Check if reminder is due today or overdue
        if (reminderDay <= today) {
          // Check if there's been any action since the reminder was set
          const actionsAfterReminder = lead.notes.filter(note => 
            !note.text.includes("Set reminder:") && 
            new Date(note.timestamp) > reminderDate
          )
          
          if (actionsAfterReminder.length === 0) {
            // No action taken since reminder was set - high priority
            const daysOverdue = Math.floor((today.getTime() - reminderDay.getTime()) / (1000 * 60 * 60 * 24))
            followUps.push({
              lead,
              urgency: "high",
              nextAction: "call",
              daysOverdue: daysOverdue,
              reason: daysOverdue === 0 ? "Reminder due today" : `Reminder overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
            })
            return
          }
          // If there's been action since the reminder, treat it as a normal lead
        } else {
          // Reminder is in the future - don't include in follow-ups (lowest priority)
          return
        }
      }

      if (!lastInteraction) {
        // No interaction yet - high priority
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

      // High priority: Interested leads (green) - even if dormant
      if (lead.status === "interested") {
        followUps.push({
          lead,
          urgency: daysSinceLastContact > 30 ? "dormant-interested" : "high",
          nextAction: "call",
          daysOverdue: 0,
          reason: daysSinceLastContact > 30 ? "Interested lead - dormant" : "Interested lead - high priority",
        })
        return
      }

      // Only include leads with interactions in the last month (except interested leads)
      if (daysSinceLastContact > 30) {
        return
      }

      // Yellow priority: Past due or needs follow-up
      if (daysSinceLastContact > 7) {
        followUps.push({
          lead,
          urgency: "medium",
          nextAction: lastInteraction.type === "call" ? "email" : "call",
          daysOverdue: daysSinceLastContact - 7,
          reason: "Past due follow-up",
        })
        return
      }

      // Check if they're on cadence and need immediate action
      if (lastInteraction.type === "call" && daysSinceLastContact >= 2) {
        followUps.push({
          lead,
          urgency: "medium",
          nextAction: "email",
          daysOverdue: daysSinceLastContact - 2,
          reason: "Email follow-up after call",
        })
      } else if (lastInteraction.type === "email" && daysSinceLastContact >= 4) {
        followUps.push({
          lead,
          urgency: "medium",
          nextAction: "call",
          daysOverdue: daysSinceLastContact - 4,
          reason: "Call follow-up after email",
        })
      }
    })

    return followUps.sort((a, b) => {
      const urgencyOrder = { high: 4, "dormant-interested": 3, medium: 2, low: 1 }
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
      case "dormant-interested":
        return "bg-green-700/20 text-green-400 border-green-700/30"
      case "medium":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      default:
        return "bg-red-500/20 text-red-300 border-red-500/30"
    }
  }

  const getGroupTitle = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "High Priority"
      case "dormant-interested":
        return "Dormant Interested"
      case "medium":
        return "Needs Follow-up"
      default:
        return "Low Priority"
    }
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
          <div key={urgency} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={`${getGroupColor(urgency)} rounded-full px-3 py-1`}>
                {getGroupTitle(urgency)} ({items.length})
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {items.slice(0, 6).map((item) => {
                const UrgencyIcon = urgencyIcons[item.urgency === "dormant-interested" ? "high" : item.urgency]

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
                      className="bg-black/20 backdrop-blur-xl border-system hover:bg-black/30 transition-all duration-300 cursor-pointer rounded-2xl"
                      onClick={() => onLeadSelect(item.lead)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-primary-hierarchy font-title text-sm truncate">{item.lead.name}</h3>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <UrgencyIcon className="h-3 w-3 text-purple-400" />
                            <Badge className={`${getGroupColor(urgency)} text-xs rounded-full px-2 py-0.5`}>
                              {item.urgency === "dormant-interested" ? "Dormant" : item.urgency}
                            </Badge>
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
          </div>
        ))}
      </div>
    </motion.div>
  )
}
