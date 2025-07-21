"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Phone, MessageCircle, TrendingUp, TrendingDown } from "lucide-react"

interface MetricCardsProps {
  callsMade: number
  responsesReceived: number
  weeklyData?: {
    calls: number[]
    responses: number[]
    labels: string[]
  }
}

// Enhanced chart component with more details
function DetailedChart({
  data,
  color,
  title,
  currentValue,
  labels,
}: {
  data: number[]
  color: string
  title: string
  currentValue: number
  labels: string[]
}) {
  // After: safe math that prevents NaN
  const max = Math.max(...data.filter((n) => typeof n === "number"), 1)
  const min = Math.min(...data.filter((n) => typeof n === "number"), 0)
  const range = max - min || 1

  // Calculate trend
  const trend = data.length > 1 ? data[data.length - 1] - data[data.length - 2] : 0
  const trendPercentage = data[data.length - 2] ? ((trend / data[data.length - 2]) * 100).toFixed(1) : "0"

  const points = data
    .map((value, index) => {
      // Guard: if data.length === 1, put the point in the middle (x = 50)
      const x = data.length === 1 ? 50 : (index / Math.max(data.length - 1, 1)) * 100

      // Guard: ensure value is a valid number
      const safeValue = typeof value === "number" ? value : min
      const y = 100 - ((safeValue - min) / range) * 70

      return `${x},${y + 15}`
    })
    .join(" ")

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="text-4xl font-title text-primary-hierarchy">{currentValue}</div>
        <div className="flex items-center gap-1">
          {trend >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
          <span className={`text-sm font-body ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
            {trend >= 0 ? "+" : ""}
            {trendPercentage}%
          </span>
        </div>
      </div>

      <div className="h-24 w-full mb-3">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <defs>
            <pattern id={`grid-${title}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill={`url(#grid-${title})`} />

          {/* Area fill */}
          <polygon fill={`url(#gradient-${title})`} points={`${points} 100,85 0,85`} />

          {/* Line */}
          <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} className="drop-shadow-sm" />

          {/* Data points */}
          {data.map((value, index) => {
            const x = data.length === 1 ? 50 : (index / Math.max(data.length - 1, 1)) * 100
            const safeValue = typeof value === "number" ? value : min
            const y = 100 - ((safeValue - min) / range) * 70 + 15
            return <circle key={index} cx={x} cy={y} r="2" fill={color} className="drop-shadow-sm" />
          })}
        </svg>
      </div>

      {/* Week labels */}
      <div className="flex justify-between text-xs text-medium-hierarchy font-body">
        {labels.map((label, index) => (
          <span key={index} className={index === labels.length - 1 ? "text-primary-hierarchy font-title" : ""}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MetricCards({ callsMade, responsesReceived, weeklyData }: MetricCardsProps) {
  // Default weekly data if not provided
  const defaultWeeklyData = {
    calls: [12, 15, 8, 22, 18, 25, callsMade],
    responses: [3, 5, 2, 8, 6, 9, responsesReceived],
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"],
  }

  const data = weeklyData || defaultWeeklyData

  const cards = [
    {
      title: "Calls Made This Week",
      value: callsMade,
      icon: Phone,
      gradient: "from-purple-500/20 to-purple-600/20",
      chartData: data.calls,
      chartColor: "#a855f7",
      description: "Total outbound calls made this week",
    },
    {
      title: "Responses Received",
      value: responsesReceived,
      icon: MessageCircle,
      gradient: "from-purple-400/20 to-purple-500/20",
      chartData: data.responses,
      chartColor: "#8b5cf6",
      description: "Leads that responded positively",
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <Card className="bg-black/20 backdrop-blur-xl border-system hover:bg-black/30 transition-all duration-300 rounded-3xl group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex-1">
                <CardTitle className="text-medium-hierarchy font-body text-sm mb-1">{card.title}</CardTitle>
                <p className="text-medium-hierarchy font-body text-xs">{card.description}</p>
              </div>
              <div className={`p-3 rounded-full bg-gradient-to-br ${card.gradient} backdrop-blur-sm`}>
                <card.icon className="h-5 w-5 text-purple-300" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DetailedChart
                data={card.chartData}
                color={card.chartColor}
                title={card.title}
                currentValue={card.value}
                labels={data.labels}
              />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
