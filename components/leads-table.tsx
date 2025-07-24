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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
  status: "Left Voicemail" | "Contacted" | "Interested" | "Not Interested" | "Needs Follow-Up"
  lastInteraction: string
  ownerId?: string
  ownerName?: string
  nextActionDate: string
  needsAttention?: boolean
  notes: Array<{
    id: string
    text: string
    timestamp: string
    type: "call" | "email" | "note" | "video" | "social"
  }>
  createdAt: string
  updatedAt: string
  createdBy?: string
  createdByName?: string
  lastUpdatedBy?: string
  lastUpdatedByName?: string
}

interface LeadsTableProps {
  leads: Lead[]
  onLeadUpdate: (leadId: string, updates: Partial<Lead>) => void
  onLeadSelect: (lead: Lead) => void
  sortConfig?: {
    field: 'name' | 'status' | 'lastContact' | 'dateAdded' | 'interestLevel'
    direction: 'asc' | 'desc'
  }
  onSortChange?: (config: {
    field: 'name' | 'status' | 'lastContact' | 'dateAdded' | 'interestLevel'
    direction: 'asc' | 'desc'
  }) => void
}

const columnHelper = createColumnHelper<Lead>()

export function LeadsTable({
  leads,
  onLeadUpdate,
  onLeadSelect,
  sortConfig,
  onSortChange,
}: LeadsTableProps) {
  const { user } = useAuth()
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null)

  // Sort leads based on current configuration
  const sortedLeads = useMemo(() => {
    if (!sortConfig) return leads

    const sorted = [...leads].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.field) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'lastContact':
          const aLastNote = a.notes.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0]
          const bLastNote = b.notes.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0]
          aValue = aLastNote ? new Date(aLastNote.timestamp).getTime() : 0
          bValue = bLastNote ? new Date(bLastNote.timestamp).getTime() : 0
          break
        case 'dateAdded':
          // Using id as proxy for date added since it's timestamp-based
          aValue = parseInt(a.id)
          bValue = parseInt(b.id)
          break
        case 'interestLevel':
          const interestOrder = { 
            "Interested": 5, 
            "Contacted": 4, 
            "Needs Follow-Up": 3, 
            "Left Voicemail": 2, 
            "Not Interested": 1 
          }
          aValue = interestOrder[a.status]
          bValue = interestOrder[b.status]
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [leads, sortConfig])

  // Filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let filtered = sortedLeads
    return filtered
  }, [sortedLeads])

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

  const columns = useMemo<ColumnDef<Lead, any>[]>(
    () => [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="text-gray-400 font-body hover:text-white p-0"
              >
                Contact
                <ArrowUpDown className="ml-2 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 bg-black/95 backdrop-blur-xl border-system rounded-2xl shadow-2xl" align="start" forceMount sideOffset={8}>
              <div className="p-4">
                <div className="text-xs text-gray-400 font-body mb-4 px-1">Sort by</div>
                <div className="space-y-1">
                  {[
                    { value: 'name', label: 'Name', icon: '👤' },
                    { value: 'status', label: 'Status', icon: '📊' },
                    { value: 'lastContact', label: 'Last Contact', icon: '📞' },
                    { value: 'dateAdded', label: 'Date Added', icon: '📅' },
                    { value: 'interestLevel', label: 'Interest Level', icon: '🎯' }
                  ].map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => onSortChange?.({ 
                        field: option.value as any,
                        direction: sortConfig?.direction || 'desc'
                      })}
                      className={`text-white hover:bg-white/10 rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 ${
                        sortConfig?.field === option.value ? 'bg-white/10 ring-1 ring-white/20' : ''
                      }`}
                    >
                      <span className="mr-3 text-lg">{option.icon}</span>
                      <span className="font-body flex-1">{option.label}</span>
                      {sortConfig?.field === option.value && (
                        <span className="text-xs opacity-60 ml-2">
                          {sortConfig.direction === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
                <div className="border-t border-white/10 mt-4 pt-4">
                  <div className="text-xs text-gray-400 font-body mb-3 px-1">Direction</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={sortConfig?.direction === 'asc' ? 'default' : 'outline'}
                      onClick={() => onSortChange?.({ 
                        field: sortConfig?.field || 'name',
                        direction: 'asc'
                      })}
                      className={`text-xs rounded-full transition-all duration-200 ${
                        sortConfig?.direction === 'asc' 
                          ? 'bg-white text-black shadow-lg' 
                          : 'border-white/20 text-white hover:bg-white/10'
                      }`}
                    >
                      ↑ Ascending
                    </Button>
                    <Button
                      size="sm"
                      variant={sortConfig?.direction === 'desc' ? 'default' : 'outline'}
                      onClick={() => onSortChange?.({ 
                        field: sortConfig?.field || 'name',
                        direction: 'desc'
                      })}
                      className={`text-xs rounded-full transition-all duration-200 ${
                        sortConfig?.direction === 'desc' 
                          ? 'bg-white text-black shadow-lg' 
                          : 'border-white/20 text-white hover:bg-white/10'
                      }`}
                    >
                      ↓ Descending
                    </Button>
                  </div>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        cell: ({ getValue, row, column }) => {
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id
          const value = getValue()
          const lead = row.original

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
                <div
                  className="text-white font-title cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200"
                  onDoubleClick={() => setEditingCell({ rowId: row.id, columnId: column.id })}
                >
                  {value}
                </div>
                {lead.needsAttention && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-2xl">
                        <p className="font-body text-red-300">Missing required fields - needs attention</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="text-gray-400 font-body text-sm">{row.original.email}</div>
              <div className="text-gray-400 font-body text-sm">{row.original.phone}</div>
              {lead.company && <div className="text-gray-500 font-body text-xs">{lead.company}</div>}
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
                  className={`${statusColor.bg} ${statusColor.text} ${statusColor.border} rounded-pill px-4 py-1.5 font-body`}
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
                className="text-gray-400 hover:text-white hover:bg-white/10 rounded-pill px-3 py-1 transition-all duration-200 font-body"
              >
                <UserX className="h-3 w-3 mr-1" />
                Unclaimed
              </Button>
            )
          }

          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => isOwnedByCurrentUser ? handleUnclaimLead(row.original.id) : null}
              disabled={!isOwnedByCurrentUser}
              className={`${
                isOwnedByCurrentUser
                  ? "bg-[#CD70E4]/20 text-[#CD70E4] border-[#CD70E4]/30 hover:bg-[#CD70E4]/30"
                  : "bg-blue-500/20 text-blue-300 border-blue-500/30 cursor-default"
              } rounded-pill px-2 py-1 font-body text-xs transition-all duration-200`}
            >
              <User className="h-3 w-3 mr-1" />
              {ownerName}
            </Button>
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
    [editingCell, onLeadUpdate, onLeadSelect, user, sortConfig, onSortChange],
  )

  const table = useReactTable({
    data: filteredAndSortedLeads,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
                  <th key={header.id} className="text-left p-3 text-sm font-body text-gray-400 whitespace-nowrap">
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
                  <td key={cell.id} className="p-3">
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
