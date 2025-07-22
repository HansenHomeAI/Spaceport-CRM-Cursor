"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  getSortedRowModel,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { MapPin, ArrowUpDown, Info, User, UserX, X, Clock, AlertTriangle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { colors } from "@/lib/colors"
import { useAuth } from "@/lib/auth-context"

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  address: string
  company?: string
  status: "cold" | "contacted" | "interested" | "closed" | "dormant"
  lastInteraction: string
  ownerId?: string
  ownerName?: string
  priority: "high" | "medium" | "low" | "dormant"
  nextActionDate: string
  notes: Array<{
    id: string
    text: string
    timestamp: string
    type: "call" | "email" | "note"
  }>
}

interface LeadsTableProps {
  leads: Lead[]
  onLeadUpdate: (leadId: string, updates: Partial<Lead>) => void
  onLeadSelect: (lead: Lead) => void
  sortByRecent?: boolean
  showDormant?: boolean
}

const columnHelper = createColumnHelper<Lead>()

// Sales cadence logic
const calculatePriority = (lead: Lead): { priority: Lead["priority"]; nextActionDate: string; reason: string } => {
  const now = new Date()
  const lastNote = lead.notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  if (!lastNote) {
    return {
      priority: "high",
      nextActionDate: new Date().toISOString(),
      reason: "No initial contact made",
    }
  }

  const daysSinceLastContact = Math.floor(
    (now.getTime() - new Date(lastNote.timestamp).getTime()) / (1000 * 60 * 60 * 24),
  )

  // Over 30 days = dormant
  if (daysSinceLastContact > 30) {
    return {
      priority: "dormant",
      nextActionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
      reason: "Dormant - follow up when convenient",
    }
  }

  // Sales cadence based on last interaction type and status
  if (lead.status === "interested") {
    if (daysSinceLastContact >= 2) {
      return {
        priority: "high",
        nextActionDate: new Date().toISOString(),
        reason: "Interested lead needs immediate follow-up",
      }
    }
  }

  if (lastNote.type === "call" && daysSinceLastContact >= 3) {
    return {
      priority: "medium",
      nextActionDate: new Date().toISOString(),
      reason: "Email follow-up after call",
    }
  }

  if (lastNote.type === "email" && daysSinceLastContact >= 5) {
    return {
      priority: "medium",
      nextActionDate: new Date().toISOString(),
      reason: "Call follow-up after email",
    }
  }

  if (daysSinceLastContact >= 7) {
    return {
      priority: "low",
      nextActionDate: new Date().toISOString(),
      reason: "Weekly check-in",
    }
  }

  return {
    priority: "low",
    nextActionDate: new Date(Date.now() + (7 - daysSinceLastContact) * 24 * 60 * 60 * 1000).toISOString(),
    reason: "On schedule",
  }
}

export function LeadsTable({
  leads,
  onLeadUpdate,
  onLeadSelect,
  sortByRecent = false,
  showDormant = false,
}: LeadsTableProps) {
  const { user } = useAuth()
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)
  const [sorting, setSorting] = useState<Array<{ id: string; desc: boolean }>>([])

  // Calculate priorities for all leads
  const leadsWithPriority = useMemo(() => {
    return leads.map((lead) => {
      const { priority, nextActionDate, reason } = calculatePriority(lead)
      return { ...lead, priority, nextActionDate, priorityReason: reason }
    })
  }, [leads])

  // Filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let filtered = leadsWithPriority

    // Filter by dormant status
    if (!showDormant) {
      filtered = filtered.filter((lead) => lead.priority !== "dormant")
    }

    // Sort by priority and recency
    if (sortByRecent) {
      filtered.sort((a, b) => {
        // First by priority
        const priorityOrder = { high: 4, medium: 3, low: 2, dormant: 1 }
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
        if (priorityDiff !== 0) return priorityDiff

        // Then by most recent interaction
        const aLastNote = a.notes.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0]
        const bLastNote = b.notes.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0]
        const aTime = aLastNote ? new Date(aLastNote.timestamp).getTime() : 0
        const bTime = bLastNote ? new Date(bLastNote.timestamp).getTime() : 0
        return bTime - aTime
      })
    }

    return filtered
  }, [leadsWithPriority, sortByRecent, showDormant])

  const handleClaimLead = (leadId: string) => {
    if (!user) return
    onLeadUpdate(leadId, {
      ownerId: user.id,
      ownerName: user.name,
    })
  }

  const handleUnclaimLead = (leadId: string) => {
    onLeadUpdate(leadId, {
      ownerId: undefined,
      ownerName: undefined,
    })
  }

  const getPriorityIcon = (priority: Lead["priority"]) => {
    switch (priority) {
      case "high":
        return <AlertTriangle className="h-3 w-3 text-red-400" />
      case "medium":
        return <Clock className="h-3 w-3 text-yellow-400" />
      case "low":
        return <Clock className="h-3 w-3 text-green-400" />
      case "dormant":
        return <Clock className="h-3 w-3 text-gray-400" />
    }
  }

  const getPriorityColor = (priority: Lead["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-300 border-red-500/20"
      case "medium":
        return "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
      case "low":
        return "bg-green-500/10 text-green-300 border-green-500/20"
      case "dormant":
        return "bg-gray-500/10 text-gray-300 border-gray-500/20"
    }
  }

  const columns = useMemo<ColumnDef<Lead, any>[]>(
    () => [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                  className="text-gray-400 font-body hover:text-white p-0"
                >
                  Contact
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                  <Info className="ml-1 h-3 w-3 opacity-50" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-2xl">
                <p className="font-body">Sort contacts alphabetically by name</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
        cell: ({ getValue, row, column }) => {
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id
          const value = getValue()
          const lead = row.original as Lead & { priorityReason?: string }

          if (isEditing) {
            return (
              <Input
                defaultValue={value}
                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg"
                onBlur={(e) => {
                  onLeadUpdate(row.original.id, { name: e.target.value })
                  setEditingCell(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onLeadUpdate(row.original.id, { name: e.currentTarget.value })
                    setEditingCell(null)
                  }
                }}
                autoFocus
              />
            )
          }

          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getPriorityIcon(lead.priority)}
                <div
                  className="text-white font-title cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200"
                  onDoubleClick={() => setEditingCell({ rowId: row.id, columnId: column.id })}
                >
                  {value}
                </div>
              </div>
              <div className="text-gray-400 font-body text-sm">{row.original.email}</div>
              <div className="text-gray-400 font-body text-sm">{row.original.phone}</div>
              {lead.company && <div className="text-gray-500 font-body text-xs">{lead.company}</div>}
              {lead.priorityReason && <div className="text-xs text-gray-500 italic">{lead.priorityReason}</div>}
            </div>
          )
        },
      }),
      columnHelper.accessor("address", {
        header: "Property Address",
        cell: ({ getValue, row, column }) => {
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id
          const value = getValue()

          if (isEditing) {
            return (
              <Input
                defaultValue={value}
                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg"
                onBlur={(e) => {
                  onLeadUpdate(row.original.id, { address: e.target.value })
                  setEditingCell(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onLeadUpdate(row.original.id, { address: e.currentTarget.value })
                    setEditingCell(null)
                  }
                }}
                autoFocus
              />
            )
          }

          return (
            <div
              className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group"
              onDoubleClick={() => setEditingCell({ rowId: row.id, columnId: column.id })}
            >
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="text-white font-body leading-tight">{value}</div>
            </div>
          )
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue, row }) => {
          const status = getValue()
          const statusColor = colors.status[status as keyof typeof colors.status] || {
            bg: "bg-gray-500/10",
            text: "text-gray-300",
            border: "border-gray-500/20",
            icon: "#6b7280",
          }

          return (
            <Select
              value={status}
              onValueChange={(newStatus) => onLeadUpdate(row.original.id, { status: newStatus as Lead["status"] })}
            >
              <SelectTrigger className="w-32 bg-transparent border-none p-0">
                <Badge
                  className={`${statusColor.bg} ${statusColor.text} ${statusColor.border} rounded-lg px-4 py-1.5 font-body`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Badge>
              </SelectTrigger>
              <SelectContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-xl">
                {Object.entries(colors.status).map(([key, color]) => (
                  <SelectItem key={key} value={key} className="rounded-lg font-body">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.icon }} />
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        },
      }),
      columnHelper.accessor("priority", {
        header: "Priority",
        cell: ({ getValue, row }) => {
          const priority = getValue()
          const lead = row.original as Lead & { priorityReason?: string }

          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={`${getPriorityColor(priority)} rounded-lg px-3 py-1 font-body cursor-help`}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-2xl">
                  <p className="font-body">{lead.priorityReason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
      }),
      columnHelper.accessor("ownerName", {
        header: "Owner",
        cell: ({ getValue, row }) => {
          const ownerName = getValue()
          const isOwnedByCurrentUser = row.original.ownerId === user?.id

          if (!ownerName) {
            return (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleClaimLead(row.original.id)}
                className="text-gray-400 hover:text-white hover:bg-white/10 rounded-lg px-3 py-1 transition-all duration-200 font-body"
              >
                <UserX className="h-3 w-3 mr-1" />
                Unclaimed
              </Button>
            )
          }

          return (
            <div className="flex items-center gap-2">
              <Badge
                className={`${
                  isOwnedByCurrentUser
                    ? "bg-[#CD70E4]/20 text-[#CD70E4] border-[#CD70E4]/30"
                    : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                } rounded-lg px-3 py-1 font-body`}
              >
                <User className="h-3 w-3 mr-1" />
                {ownerName}
              </Badge>
              {isOwnedByCurrentUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnclaimLead(row.original.id)}
                  className="text-gray-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg px-2 py-1 transition-all duration-200"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )
        },
      }),
      columnHelper.accessor("lastInteraction", {
        header: ({ column }) => (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                  className="text-gray-400 font-body hover:text-white p-0"
                >
                  Last Contact
                  <ArrowUpDown className="ml-2 h-3 w-3" />
                  <Info className="ml-1 h-3 w-3 opacity-50" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-2xl">
                <p className="font-body">Sort by most recent interaction date</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
        cell: ({ getValue, row }) => {
          const lastNote = row.original.notes.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )[0]
          const daysSince = lastNote
            ? Math.floor((new Date().getTime() - new Date(lastNote.timestamp).getTime()) / (1000 * 60 * 60 * 24))
            : null

          return (
            <div className="text-gray-400 font-body text-sm">
              {getValue()}
              {daysSince !== null && (
                <div className="text-xs">{daysSince === 0 ? "Today" : `${daysSince} days ago`}</div>
              )}
            </div>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLeadSelect(row.original)}
                          className="text-white hover:text-white hover:bg-white/10 rounded-brand px-4 py-2 transition-all duration-200 font-body border border-white/20"
          >
            View Details
          </Button>
        ),
      }),
    ],
    [editingCell, onLeadUpdate, onLeadSelect, user],
  )

  const table = useReactTable({
    data: filteredAndSortedLeads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-black/20 backdrop-blur-xl border-white/10 rounded-xl overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/5">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="text-left p-6 text-sm font-body text-gray-400">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <motion.tr
                key={row.id}
                className="border-b border-white/5 hover:bg-white/5 transition-all duration-200 cursor-pointer"
                whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-6">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
