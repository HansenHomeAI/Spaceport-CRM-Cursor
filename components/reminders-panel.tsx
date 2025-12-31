"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { Calendar, Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Lead } from "@/lib/crm-types"
import { formatTimestamp } from "@/lib/utils"

interface RemindersPanelProps {
  leads: Lead[]
  onLeadSelect: (lead: Lead) => void
}

export function RemindersPanel({ leads, onLeadSelect }: RemindersPanelProps) {
  const reminders = useMemo(() => {
    return leads.flatMap((lead) =>
      lead.notes
        .filter((note) => note.text.includes("Set reminder:"))
        .map((note) => {
          const reminderDate = new Date(note.timestamp)
          const today = new Date()
          const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
          const startOfReminder = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate())
          const dayDiff = Math.floor((startOfReminder.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24))

          return {
            lead,
            note,
            reminderDate,
            dayDiff,
          }
        })
    )
  }, [leads])

  if (reminders.length === 0) return null

  const sortedReminders = [...reminders].sort(
    (a, b) => a.reminderDate.getTime() - b.reminderDate.getTime()
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="mb-10"
    >
      <h2 className="text-2xl font-title text-primary-hierarchy mb-6">Scheduled Reminders</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedReminders.map(({ lead, note, reminderDate, dayDiff }) => {
          const canCall = lead.phone && lead.phone !== "Not provided"
          const canEmail = lead.email && lead.email !== "Not provided"
          const badgeLabel = dayDiff < 0 ? `${Math.abs(dayDiff)}d overdue` : dayDiff === 0 ? "Due today" : `In ${dayDiff}d`
          const badgeClass =
            dayDiff < 0
              ? "bg-red-500/20 text-red-300 border-red-500/30"
              : dayDiff === 0
              ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
              : "bg-blue-500/20 text-blue-300 border-blue-500/30"

          return (
            <div
              key={`${lead.id}-${note.id}`}
              className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:bg-white/5 transition-all duration-200 cursor-pointer"
              onClick={() => onLeadSelect(lead)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-medium text-sm">{lead.name}</div>
                  <div className="text-xs text-gray-400 font-body mt-1 flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {formatTimestamp(reminderDate.toISOString())}
                  </div>
                </div>
                <Badge className={`${badgeClass} text-xs rounded-full`}>{badgeLabel}</Badge>
              </div>
              <div className="text-sm text-gray-300 font-body mt-3">{note.text}</div>
              {note.createdByName && (
                <div className="text-xs text-gray-500 font-body mt-2">By {note.createdByName}</div>
              )}
              <div className="flex items-center gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className={`border-white/10 text-white hover:bg-white/10 rounded-full text-xs px-3 ${
                    canCall ? "" : "opacity-40 pointer-events-none"
                  }`}
                  onClick={(event) => event.stopPropagation()}
                  asChild
                >
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="h-3 w-3 mr-1" />
                    Call
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`border-white/10 text-white hover:bg-white/10 rounded-full text-xs px-3 ${
                    canEmail ? "" : "opacity-40 pointer-events-none"
                  }`}
                  onClick={(event) => event.stopPropagation()}
                  asChild
                >
                  <a href={`mailto:${lead.email}?subject=Follow%20up%20for%20${encodeURIComponent(lead.name)}`}>
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </a>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
