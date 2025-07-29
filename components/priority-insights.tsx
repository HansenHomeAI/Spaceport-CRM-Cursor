"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Info, TrendingUp, Clock, AlertTriangle, Phone, Mail, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Lead } from "./leads-table"

interface PriorityInsightsProps {
  leads: Lead[]
}

interface PriorityBreakdown {
  totalLeads: number
  highPriority: number
  mediumPriority: number
  lowPriority: number
  averageScore: number
  scoreDistribution: {
    "150-200": number
    "100-149": number
    "50-99": number
    "0-49": number
  }
  statusDistribution: Record<string, number>
  engagementLevels: {
    high: number
    medium: number
    low: number
  }
}

export function PriorityInsights({ leads }: PriorityInsightsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Helper function to normalize old status values to new ones
  const normalizeStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      "cold": "Not Interested",
      "contacted": "Contacted", 
      "interested": "Interested",
      "closed": "Closed",
      "dormant": "Not Interested",
      "left voicemail": "Left Voicemail",
      "Left Voicemail": "Left Voicemail",
      "Contacted": "Contacted",
      "Interested": "Interested", 
      "Not Interested": "Not Interested",
      "Closed": "Closed"
    }
    return statusMap[status] || "Left Voicemail"
  }

  // Calculate priority score for a single lead
  const calculateLeadScore = (lead: Lead): number => {
    const now = new Date()
    const normalizedStatus = normalizeStatus(lead.status)
    const lastInteraction = lead.notes.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0]

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
    
    return Math.max(0, Math.min(200, score))
  }

  // Calculate insights
  const calculateInsights = (): PriorityBreakdown => {
    const scores = leads.map(lead => calculateLeadScore(lead))
    const totalLeads = leads.length
    const averageScore = totalLeads > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / totalLeads) : 0

    const highPriority = scores.filter(score => score >= 150).length
    const mediumPriority = scores.filter(score => score >= 100 && score < 150).length
    const lowPriority = scores.filter(score => score < 100).length

    const scoreDistribution = {
      "150-200": scores.filter(score => score >= 150).length,
      "100-149": scores.filter(score => score >= 100 && score < 150).length,
      "50-99": scores.filter(score => score >= 50 && score < 100).length,
      "0-49": scores.filter(score => score < 50).length
    }

    const statusDistribution = leads.reduce((acc, lead) => {
      const status = normalizeStatus(lead.status)
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const engagementLevels = {
      high: leads.filter(lead => {
        const interactions = lead.notes.filter(note => note.type === "call" || note.type === "email").length
        return interactions >= 3
      }).length,
      medium: leads.filter(lead => {
        const interactions = lead.notes.filter(note => note.type === "call" || note.type === "email").length
        return interactions >= 1 && interactions < 3
      }).length,
      low: leads.filter(lead => {
        const interactions = lead.notes.filter(note => note.type === "call" || note.type === "email").length
        return interactions === 0
      }).length
    }

    return {
      totalLeads,
      highPriority,
      mediumPriority,
      lowPriority,
      averageScore,
      scoreDistribution,
      statusDistribution,
      engagementLevels
    }
  }

  const insights = calculateInsights()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mb-8"
    >
      <Card className="bg-black/20 backdrop-blur-xl border-2 border-white/20 rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-purple-400" />
              <CardTitle className="text-xl font-title text-primary-hierarchy">
                Priority System Insights
              </CardTitle>
            </div>
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300">
                  <Info className="h-4 w-4 mr-2" />
                  {isExpanded ? "Hide Details" : "Show Details"}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Priority Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-500/10 rounded-xl border border-green-500/20">
              <div className="text-2xl font-title text-green-300">{insights.highPriority}</div>
              <div className="text-sm text-green-400 font-body">High Priority</div>
              <div className="text-xs text-gray-400 mt-1">
                {insights.totalLeads > 0 ? Math.round((insights.highPriority / insights.totalLeads) * 100) : 0}% of leads
              </div>
            </div>
            <div className="text-center p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
              <div className="text-2xl font-title text-yellow-300">{insights.mediumPriority}</div>
              <div className="text-sm text-yellow-400 font-body">Medium Priority</div>
              <div className="text-xs text-gray-400 mt-1">
                {insights.totalLeads > 0 ? Math.round((insights.mediumPriority / insights.totalLeads) * 100) : 0}% of leads
              </div>
            </div>
            <div className="text-center p-4 bg-gray-500/10 rounded-xl border border-gray-500/20">
              <div className="text-2xl font-title text-gray-300">{insights.lowPriority}</div>
              <div className="text-sm text-gray-400 font-body">Low Priority</div>
              <div className="text-xs text-gray-400 mt-1">
                {insights.totalLeads > 0 ? Math.round((insights.lowPriority / insights.totalLeads) * 100) : 0}% of leads
              </div>
            </div>
          </div>

          {/* Average Score */}
          <div className="text-center p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <div className="text-3xl font-title text-purple-300">{insights.averageScore}</div>
            <div className="text-sm text-purple-400 font-body">Average Priority Score</div>
            <div className="text-xs text-gray-400 mt-1">Out of 200 possible points</div>
          </div>

          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleContent className="space-y-4">
            {/* Score Distribution */}
            <div>
              <h4 className="text-lg font-title text-primary-hierarchy mb-3">Score Distribution</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(insights.scoreDistribution).map(([range, count]) => (
                  <div key={range} className="text-center p-3 bg-black/20 rounded-lg border border-white/10">
                    <div className="text-lg font-title text-white">{count}</div>
                    <div className="text-xs text-gray-400 font-body">{range}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Distribution */}
            <div>
              <h4 className="text-lg font-title text-primary-hierarchy mb-3">Status Distribution</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(insights.statusDistribution).map(([status, count]) => (
                  <div key={status} className="text-center p-3 bg-black/20 rounded-lg border border-white/10">
                    <div className="text-lg font-title text-white">{count}</div>
                    <div className="text-xs text-gray-400 font-body">{status}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement Levels */}
            <div>
              <h4 className="text-lg font-title text-primary-hierarchy mb-3">Engagement Levels</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-lg font-title text-green-300">{insights.engagementLevels.high}</div>
                  <div className="text-xs text-green-400 font-body">High (3+ interactions)</div>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div className="text-lg font-title text-yellow-300">{insights.engagementLevels.medium}</div>
                  <div className="text-xs text-yellow-400 font-body">Medium (1-2 interactions)</div>
                </div>
                <div className="text-center p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                  <div className="text-lg font-title text-gray-300">{insights.engagementLevels.low}</div>
                  <div className="text-xs text-gray-400 font-body">Low (0 interactions)</div>
                </div>
              </div>
            </div>

            {/* Scoring System Explanation */}
            <div className="bg-black/30 rounded-xl p-4 border border-white/10">
              <h4 className="text-lg font-title text-primary-hierarchy mb-3">How Priority Scores Work</h4>
              <div className="space-y-2 text-sm text-gray-300 font-body">
                <div className="flex justify-between">
                  <span>Base Status Score:</span>
                  <span>0-100 points</span>
                </div>
                <div className="flex justify-between">
                  <span>Engagement History:</span>
                  <span>0-50 points</span>
                </div>
                <div className="flex justify-between">
                  <span>Recent Activity:</span>
                  <span>0-30 points</span>
                </div>
                <div className="flex justify-between">
                  <span>Overdue Penalty:</span>
                  <span>-50 to 0 points</span>
                </div>
                <div className="flex justify-between">
                  <span>Complete Information:</span>
                  <span>0-20 points</span>
                </div>
                <div className="flex justify-between">
                  <span>Company Information:</span>
                  <span>0-10 points</span>
                </div>
                <div className="border-t border-white/10 pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total Possible:</span>
                    <span>200 points</span>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </motion.div>
  )
} 