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
import { MapPin, ArrowUpDown, Info, User, UserX, X, Clock, AlertTriangle, ExternalLink, ChevronDown, Check, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { colors } from "@/lib/colors"
import { useAuth } from "@/lib/auth-context"
import { formatTimestamp, formatRelativeTime, isValidUrl, getGoogleMapsUrl } from "@/lib/utils"

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  address: string
  properties?: Array<{
    id: string
    address: string
    isSold: boolean
    soldDate?: string
  }>
  company?: string
  status: "Left Voicemail" | "Contacted" | "Interested" | "Not Interested" | "Closed"
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
  users?: Array<{ id: string; name: string }>
  onDeleteLead?: (leadId: string) => void
}

const columnHelper = createColumnHelper<Lead>()

// Helper function to normalize old status values to new ones
const normalizeStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    "cold": "Not Interested",
    "contacted": "Contacted", 
    "interested": "Interested",
    "closed": "Closed",
    "dormant": "Not Interested", // Map old dormant to Not Interested
    "left voicemail": "Left Voicemail",
    "needs follow-up": "Not Interested", // Map old needs follow-up to Not Interested
    // New statuses (already correct)
    "Left Voicemail": "Left Voicemail",
    "Contacted": "Contacted",
    "Interested": "Interested", 
    "Not Interested": "Not Interested",
    "Closed": "Closed"
  }
  
  return statusMap[status] || "Left Voicemail" // Default to Left Voicemail for new leads
}

export function LeadsTable({
  leads,
  onLeadUpdate,
  onLeadSelect,
  sortConfig,
  onSortChange,
  users = [],
  onDeleteLead,
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
          aValue = normalizeStatus(a.status)
          bValue = normalizeStatus(b.status)
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
          const interestOrder: Record<string, number> = { 
            "Interested": 5, 
            "Contacted": 4, 
            "Left Voicemail": 3, 
            "Closed": 2, 
            "Not Interested": 1 
          }
          aValue = interestOrder[normalizeStatus(a.status)] || 1
          bValue = interestOrder[normalizeStatus(b.status)] || 1
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
            <DropdownMenuContent className="w-64 bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl shadow-2xl" align="start" forceMount sideOffset={8}>
              <div className="p-4">
                <div className="text-xs text-gray-400 font-body mb-3 px-1">Sort by</div>
                <div className="space-y-1">
                  {[
                    { value: 'name', label: 'Name' },
                    { value: 'status', label: 'Status' },
                    { value: 'lastContact', label: 'Last Contact' },
                    { value: 'dateAdded', label: 'Date Added' },
                    { value: 'interestLevel', label: 'Interest Level' }
                  ].map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => onSortChange?.({ 
                        field: option.value as any,
                        direction: sortConfig?.direction || 'desc'
                      })}
                      className={`text-white hover:bg-white/10 rounded-xl px-3 py-2 cursor-pointer transition-all duration-200 font-body text-sm ${
                        sortConfig?.field === option.value ? 'bg-white/10' : ''
                      }`}
                    >
                      <span className="flex-1">{option.label}</span>
                      {sortConfig?.field === option.value && (
                        <span className="text-xs opacity-60 ml-2">
                          {sortConfig.direction === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
                <div className="border-t border-white/10 mt-3 pt-3">
                  <div className="text-xs text-gray-400 font-body mb-2 px-1">Direction</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={sortConfig?.direction === 'asc' ? 'default' : 'outline'}
                      onClick={() => onSortChange?.({ 
                        field: sortConfig?.field || 'name',
                        direction: 'asc'
                      })}
                      className={`text-xs rounded-xl px-3 py-1.5 transition-all duration-200 font-body ${
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
                      className={`text-xs rounded-xl px-3 py-1.5 transition-all duration-200 font-body ${
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
          // If lead has properties array, use first property
          const properties = row.original.properties || []
          const firstProperty = properties[0]
          
          if (firstProperty) {
            const value = firstProperty.address
            const isSold = firstProperty.isSold
            const count = properties.length
            
            return (
              <div
                className="flex flex-col gap-1 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group"
                onClick={() => onLeadSelect(row.original)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="text-white font-body leading-tight">
                    {isValidUrl(value) ? (
                      <a 
                        href={value} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 break-all ${isSold ? 'line-through opacity-70' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {value}
                        <ExternalLink className="h-3 w-3 inline" />
                      </a>
                    ) : (
                      <span className={isSold ? 'line-through opacity-70' : ''}>{value}</span>
                    )}
                  </div>
                </div>
                
                {count > 1 && (
                  <div className="text-xs text-gray-500 ml-6">
                    + {count - 1} more propert{count - 1 === 1 ? 'y' : 'ies'}
                  </div>
                )}
                
                {isSold && (
                  <div className="text-xs text-green-400 ml-6 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Sold
                  </div>
                )}
              </div>
            )
          }
          
          // Fallback to legacy address field
          const value = getValue()
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id

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
              <div className="text-white font-body leading-tight">
                {isValidUrl(value) ? (
                  <a 
                    href={value} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 break-all"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {value}
                    <ExternalLink className="h-3 w-3 inline" />
                  </a>
                ) : (
                  <span>{value}</span>
                )}
              </div>
            </div>
          )
        },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue, row }) => {
          const status = getValue()
          const normalizedStatus = normalizeStatus(status)
          const statusColor = colors.status[normalizedStatus as keyof typeof colors.status] || {
            bg: "bg-gray-500/10",
            text: "text-gray-300",
            border: "border-gray-500/20",
            icon: "#6b7280",
          }

          // Auto-migrate status if needed
          if (normalizedStatus !== status) {
            setTimeout(() => {
              onLeadUpdate(row.original.id, { status: normalizedStatus as Lead["status"] })
            }, 0)
          }

          return (
            <Select
              value={normalizedStatus}
              onValueChange={(newStatus) => onLeadUpdate(row.original.id, { status: newStatus as Lead["status"] })}
            >
              <SelectTrigger className="w-40 bg-transparent border-none p-0">
                <Badge
                  className="bg-black/20 text-white border-2 border-white/10 rounded-full px-4 py-1.5 font-body flex items-center gap-2"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: statusColor.icon }}
                  />
                  {normalizedStatus}
                </Badge>
              </SelectTrigger>
              <SelectContent className="bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-2">
                {Object.entries(colors.status).map(([key, color]) => (
                  <SelectItem key={key} value={key} className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.icon }} />
                      <span className="text-white font-body">{key}</span>
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
          const currentOwnerId = row.original.ownerId
          
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${
                    ownerName
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  } rounded-pill px-2 py-1 font-body text-xs transition-all duration-200 h-7`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {ownerName ? (
                    <>
                      <User className="h-3 w-3 mr-1" />
                      {ownerName}
                    </>
                  ) : (
                    <>
                      <UserX className="h-3 w-3 mr-1" />
                      Unclaimed
                    </>
                  )}
                  <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-black/90 backdrop-blur-xl border-system rounded-xl shadow-2xl p-1" align="start">
                <div className="text-xs text-gray-400 font-body px-2 py-1.5">Assign to...</div>
                
                {/* Current User (Quick Action) */}
                {user && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleClaimLead(row.original.id)
                    }}
                    className="text-white hover:bg-white/10 rounded-lg px-2 py-1.5 cursor-pointer text-sm font-body"
                  >
                    <User className="h-3 w-3 mr-2 text-blue-400" />
                    Me ({user.name})
                    {currentOwnerId === user.id && <Check className="h-3 w-3 ml-auto text-green-400" />}
                  </DropdownMenuItem>
                )}
                
                <div className="h-px bg-white/10 my-1" />
                
                {/* Other Users */}
                {users.filter(u => u.id !== user?.id).map((u) => (
                  <DropdownMenuItem
                    key={u.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onLeadUpdate(row.original.id, {
                        ownerId: u.id,
                        ownerName: u.name,
                      })
                    }}
                    className="text-white hover:bg-white/10 rounded-lg px-2 py-1.5 cursor-pointer text-sm font-body"
                  >
                    <span className="w-5" />
                    {u.name}
                    {currentOwnerId === u.id && <Check className="h-3 w-3 ml-auto text-green-400" />}
                  </DropdownMenuItem>
                ))}
                
                {/* Unassign */}
                {currentOwnerId && (
                  <>
                    <div className="h-px bg-white/10 my-1" />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnclaimLead(row.original.id)
                      }}
                      className="text-red-300 hover:bg-red-500/20 rounded-lg px-2 py-1.5 cursor-pointer text-sm font-body"
                    >
                      <UserX className="h-3 w-3 mr-2" />
                      Unassign
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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

          return (
            <div className="text-gray-400 font-body text-sm">
              {lastNote ? formatTimestamp(lastNote.timestamp) : 'No contact'}
              {lastNote && (
                <div className="text-xs text-gray-500">{formatRelativeTime(lastNote.timestamp)}</div>
              )}
            </div>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLeadSelect(row.original)}
              className="text-white hover:text-white hover:bg-white/10 rounded-brand px-4 py-2 transition-all duration-200 font-body border border-white/20"
            >
              View Details
            </Button>
            
            {onDeleteLead && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white font-title">Delete Lead?</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400 font-body">
                      Are you sure you want to delete <span className="text-white font-bold">{row.original.name}</span>? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/10 rounded-full font-body">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteLead(row.original.id)
                      }}
                      className="bg-red-600 text-white hover:bg-red-700 rounded-full font-body border-none"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ),
      }),
    ],
    [editingCell, onLeadUpdate, onLeadSelect, user, sortConfig, onSortChange, users, onDeleteLead],
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
      className="bg-black/20 backdrop-blur-xl border-2 border-white/10 rounded-xl overflow-hidden"
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
