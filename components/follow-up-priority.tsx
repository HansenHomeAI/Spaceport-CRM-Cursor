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
  const priorityLeads = useMemo(() => {
    const now = new Date()
    
    return leads
      .filter(lead => {
        if (lead.notes.length === 0) return true
        
        const lastNote = lead.notes.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0]
        
        const daysSinceLastContact = Math.floor(
          (now.getTime() - new Date(lastNote.timestamp).getTime()) / (1000 * 60 * 60 * 24)
        )
        
        // Only show leads that need attention within the last month
        return daysSinceLastContact <= 30
      })
      .sort((a, b) => {
        // Priority order: interested > contacted/voicemail > cold > dormant
        const getPriorityScore = (lead: Lead) => {
          if (lead.status === "interested") return 4
          if (lead.status === "contacted" || lead.status === "left voicemail") return 3
          if (lead.status === "cold") return 2
          if (lead.status === "dormant") return 1
          return 0
        }
        
        const scoreA = getPriorityScore(a)
        const scoreB = getPriorityScore(b)
        
        if (scoreA !== scoreB) return scoreB - scoreA
        
        // If same priority, sort by most recent contact
        const lastNoteA = a.notes.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0]
        const lastNoteB = b.notes.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0]
        
        if (!lastNoteA && !lastNoteB) return 0
        if (!lastNoteA) return 1
        if (!lastNoteB) return -1
        
        return new Date(lastNoteB.timestamp).getTime() - new Date(lastNoteA.timestamp).getTime()
      })
      .slice(0, 8) // Limit to top 8
  }, [leads])

  const groupedLeads = useMemo(() => {
    const groups = {
      interested: priorityLeads.filter(lead => lead.status === "interested"),
      contacted: priorityLeads.filter(lead => lead.status === "contacted" || lead.status === "left voicemail"),
      cold: priorityLeads.filter(lead => lead.status === "cold"),
      dormant: priorityLeads.filter(lead => lead.status === "dormant")
    }
    
    return Object.entries(groups).filter(([_, leads]) => leads.length > 0)
  }, [priorityLeads])

  const getPriorityColor = (status: Lead["status"]) => {
    switch (status) {
      case "interested":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      case "contacted":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30"
      case "left voicemail":
        return "bg-orange-500/20 text-orange-300 border-orange-500/30"
      case "cold":
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
      case "dormant":
        return "bg-gray-600/20 text-gray-400 border-gray-600/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  }

  const getPriorityLabel = (status: Lead["status"]) => {
    switch (status) {
      case "interested":
        return "Interested"
      case "contacted":
        return "Contacted"
      case "left voicemail":
        return "Left Voicemail"
      case "cold":
        return "Cold"
      case "dormant":
        return "Dormant"
      default:
        return status
    }
  }

  if (priorityLeads.length === 0) {
    return (
      <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
        <CardHeader>
          <CardTitle className="text-primary-hierarchy font-title text-xl">Priority Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/50 text-sm">No leads need immediate attention</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
      <CardHeader>
        <CardTitle className="text-primary-hierarchy font-title text-xl">Priority Follow-ups</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {groupedLeads.map(([groupKey, groupLeads]) => (
            <div key={groupKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  groupKey === "interested" ? "bg-green-400" :
                  groupKey === "contacted" ? "bg-blue-400" :
                  groupKey === "cold" ? "bg-gray-400" :
                  "bg-gray-500"
                }`} />
                <h4 className="text-sm font-medium text-white/80 capitalize">
                  {groupKey === "contacted" ? "Recently Contacted" : groupKey}
                </h4>
                <span className="text-xs text-white/50">({groupLeads.length})</span>
              </div>
              
              <div className="grid gap-2">
                {groupLeads.map((lead) => {
                  const lastNote = lead.notes.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                  )[0]
                  
                  return (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                        getPriorityColor(lead.status)
                      }`}
                      onClick={() => onLeadSelect(lead)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{lead.name}</div>
                          <div className="text-xs opacity-70 truncate">
                            {lastNote ? lastNote.text : "No interactions yet"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge className={`text-xs rounded-full ${
                            getPriorityColor(lead.status)
                          }`}>
                            {getPriorityLabel(lead.status)}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
