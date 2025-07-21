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
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  // Calculate follow-up priorities based on your cadence
  const calculateFollowUps = (): FollowUpItem[] => {
    const now = new Date()
    const followUps: FollowUpItem[] = []

    leads.forEach((lead) => {
      if (lead.status === "closed") return

      const lastInteraction = lead.notes.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0]

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

      // Follow-up cadence logic
      if (lastInteraction.type === "call" && daysSinceLastContact >= 2) {
        followUps.push({
          lead,
          urgency: daysSinceLastContact > 4 ? "high" : "medium",
          nextAction: "email",
          daysOverdue: daysSinceLastContact - 2,
          reason: "Email follow-up after call",
        })
      } else if (lastInteraction.type === "email" && daysSinceLastContact >= 4) {
        followUps.push({
          lead,
          urgency: daysSinceLastContact > 7 ? "high" : "medium",
          nextAction: "call",
          daysOverdue: daysSinceLastContact - 4,
          reason: "Call follow-up after email",
        })
      } else if (daysSinceLastContact >= 7) {
        followUps.push({
          lead,
          urgency: "low",
          nextAction: "call",
          daysOverdue: daysSinceLastContact - 7,
          reason: "Weekly check-in",
        })
      }
    })

    return followUps.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 }
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency] || b.daysOverdue - a.daysOverdue
    })
  }

  const followUps = calculateFollowUps()

  if (followUps.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mb-8"
    >
      <h2 className="text-primary-hierarchy font-title text-lg mb-4">Priority Follow-ups</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {followUps.slice(0, 8).map((item) => {
          const UrgencyIcon = urgencyIcons[item.urgency]
          const isExpanded = expandedCard === item.lead.id

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
                className={`bg-black/20 backdrop-blur-xl border-system hover:bg-black/30 transition-all duration-300 cursor-pointer rounded-3xl ${
                  isExpanded ? "ring-2 ring-purple-500/30" : ""
                }`}
                onClick={() => setExpandedCard(isExpanded ? null : item.lead.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-primary-hierarchy font-title text-sm truncate">{item.lead.name}</h3>
                      <p className="text-medium-hierarchy font-body text-xs truncate">{item.lead.email}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <UrgencyIcon className="h-3 w-3 text-purple-400" />
                      <Badge className={`${urgencyColors[item.urgency]} text-xs rounded-full px-2 py-0.5`}>
                        {item.urgency}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {item.nextAction === "call" ? (
                      <Phone className="h-3 w-3 text-purple-400" />
                    ) : (
                      <Mail className="h-3 w-3 text-purple-400" />
                    )}
                    <span className="text-medium-hierarchy font-body text-xs">
                      {item.nextAction === "call" ? "Call needed" : "Email needed"}
                    </span>
                  </div>

                  <p className="text-medium-hierarchy font-body text-xs leading-tight">{item.reason}</p>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-3 pt-3 border-t border-white/10"
                      >
                        <div className="space-y-2">
                          <div className="text-xs">
                            <span className="text-medium-hierarchy font-body">Address: </span>
                            <span className="text-primary-hierarchy font-body">{item.lead.address}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-medium-hierarchy font-body">Phone: </span>
                            <span className="text-primary-hierarchy font-body">{item.lead.phone}</span>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              onLeadSelect(item.lead)
                            }}
                            size="sm"
                            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-full text-xs mt-2"
                          >
                            View Full Profile
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
