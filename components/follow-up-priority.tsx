"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, AlertTriangle, Phone, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  onLeadClick: (lead: Lead) => void
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

export function FollowUpPriority({ leads, onLeadClick }: FollowUpPriorityProps) {
  const priorityLeads = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    return leads
      .filter((lead) => {
        // Only show leads that need follow-up within the last month
        const lastNote = lead.notes[0]
        if (!lastNote) return false

        const lastContactDate = new Date(lastNote.timestamp)
        return lastContactDate >= thirtyDaysAgo
      })
      .map((lead) => {
        const lastNote = lead.notes[0]
        const lastContactDate = new Date(lastNote.timestamp)
        const daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24))

        // Determine priority based on status and recency
        let priority: "high" | "medium" | "low" = "low"
        let priorityReason = ""

        if (lead.status === "interested") {
          priority = "high"
          priorityReason = "Interested lead"
        } else if (lead.status === "contacted" || lead.status === "left voicemail") {
          if (daysSinceContact <= 7) {
            priority = "medium"
            priorityReason = "Recently contacted"
          } else {
            priority = "high"
            priorityReason = "Needs follow-up"
          }
        } else if (lead.status === "cold") {
          if (daysSinceContact <= 14) {
            priority = "medium"
            priorityReason = "Cold lead - recent contact"
          } else {
            priority = "low"
            priorityReason = "Cold lead - dormant"
          }
        } else if (lead.status === "dormant") {
          priority = "low"
          priorityReason = "Dormant lead"
        }

        return {
          ...lead,
          priority,
          priorityReason,
          daysSinceContact,
        }
      })
      .filter((lead) => lead.priority !== "low") // Only show medium and high priority
      .sort((a, b) => {
        // Sort by priority first, then by recency
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        return a.daysSinceContact - b.daysSinceContact
      })
  }, [leads])

  const groupedLeads = useMemo(() => {
    const groups = {
      high: priorityLeads.filter(lead => lead.priority === "high"),
      medium: priorityLeads.filter(lead => lead.priority === "medium"),
    }
    return groups
  }, [priorityLeads])

  if (priorityLeads.length === 0) {
    return (
      <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
        <CardHeader>
          <CardTitle className="text-primary-hierarchy font-title text-2xl">Priority Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-white/60 text-sm">No priority follow-ups needed</div>
            <div className="text-white/40 text-xs mt-1">All leads are up to date</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
      <CardHeader>
        <CardTitle className="text-primary-hierarchy font-title text-xl">Priority Follow-ups</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High Priority Group */}
        {groupedLeads.high.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span className="text-red-300 text-sm font-medium">High Priority ({groupedLeads.high.length})</span>
            </div>
            <div className="space-y-2 pl-4">
              {groupedLeads.high.map((lead) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-xl cursor-pointer"
                  onClick={() => onLeadClick(lead)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{lead.name}</div>
                    <div className="text-red-300 text-xs">{lead.priorityReason}</div>
                  </div>
                  <div className="text-red-300 text-xs">
                    {lead.daysSinceContact === 0 ? "Today" : `${lead.daysSinceContact}d ago`}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Medium Priority Group */}
        {groupedLeads.medium.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-yellow-300 text-sm font-medium">Medium Priority ({groupedLeads.medium.length})</span>
            </div>
            <div className="space-y-2 pl-4">
              {groupedLeads.medium.map((lead) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl cursor-pointer"
                  onClick={() => onLeadClick(lead)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{lead.name}</div>
                    <div className="text-yellow-300 text-xs">{lead.priorityReason}</div>
                  </div>
                  <div className="text-yellow-300 text-xs">
                    {lead.daysSinceContact === 0 ? "Today" : `${lead.daysSinceContact}d ago`}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
