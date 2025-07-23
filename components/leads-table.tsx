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
import { MapPin, ArrowUpDown, Info, User, UserX, X, Clock, AlertTriangle, Trash2, Search } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { colors } from "@/lib/colors"
import { useAuth } from "@/lib/auth-context"

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  address: string
  company?: string
  status: "cold" | "contacted" | "interested" | "closed" | "dormant" | "left voicemail"
  lastInteraction: string
  ownerId?: string
  ownerName?: string
  priority: "high" | "medium" | "low" | "dormant"
  nextActionDate: string
  needsAttention?: boolean
  notes: Array<{
    id: string
    text: string
    timestamp: string
    type: "call" | "email" | "note" | "video" | "social"
  }>
}

interface LeadsTableProps {
  leads: Lead[]
  onLeadUpdate: (leadId: string, updates: Partial<Lead>) => void
  onLeadSelect: (lead: Lead) => void
  onLeadDelete: (leadId: string) => void
  sortConfig?: {
    field: 'name' | 'status' | 'priority' | 'lastContact' | 'dateAdded' | 'interestLevel'
    direction: 'asc' | 'desc'
  }
  onSortChange?: (config: {
    field: 'name' | 'status' | 'priority' | 'lastContact' | 'dateAdded' | 'interestLevel'
    direction: 'asc' | 'desc'
  }) => void
}

const columnHelper = createColumnHelper<Lead>()

export function LeadsTable({
  leads,
  onLeadUpdate,
  onLeadSelect,
  onLeadDelete,
  sortConfig,
  onSortChange,
}: LeadsTableProps) {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const handleClaimLead = (leadId: string) => {
    onLeadUpdate(leadId, {
      ownerId: user?.id,
      ownerName: user?.name,
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
        return <Clock className="h-4 w-4 text-red-400" />
      case "medium":
        return <Clock className="h-4 w-4 text-yellow-400" />
      case "low":
        return <Clock className="h-4 w-4 text-green-400" />
      case "dormant":
        return <Clock className="h-4 w-4 text-gray-400" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getPriorityColor = (priority: Lead["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-300 border-red-500/30"
      case "medium":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      case "low":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      case "dormant":
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  }

  const columns = useMemo<ColumnDef<Lead, any>[]>(
    () => [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-title text-white hover:bg-white/10"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-title text-sm">
                  {row.original.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-title truncate">{row.original.name}</p>
              <p className="text-gray-400 text-sm truncate">{row.original.email}</p>
            </div>
          </div>
        ),
      }),
      columnHelper.accessor("phone", {
        header: "Phone",
        cell: ({ row }) => (
          <div className="text-white font-body">{row.original.phone}</div>
        ),
      }),
      columnHelper.accessor("address", {
        header: "Address",
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="text-white font-body text-sm truncate max-w-48">
              {row.original.address}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-title text-white hover:bg-white/10"
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const status = row.original.status
          const statusColors = {
            cold: "bg-slate-500/20 text-slate-300 border-slate-500/30",
            contacted: "bg-blue-500/20 text-blue-300 border-blue-500/30",
            interested: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
            closed: "bg-amber-500/20 text-amber-300 border-amber-500/30",
            dormant: "bg-gray-500/20 text-gray-300 border-gray-500/30",
            "left voicemail": "bg-orange-500/20 text-orange-300 border-orange-500/30",
          }
          return (
            <Badge className={`${statusColors[status]} rounded-pill`}>
              {status}
            </Badge>
          )
        },
      }),
      columnHelper.accessor("priority", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-title text-white hover:bg-white/10"
          >
            Priority
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            {getPriorityIcon(row.original.priority)}
            <Badge className={`${getPriorityColor(row.original.priority)} rounded-pill`}>
              {row.original.priority}
            </Badge>
          </div>
        ),
      }),
      columnHelper.accessor("ownerName", {
        header: "Owner",
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            {row.original.ownerId ? (
              <>
                <User className="h-4 w-4 text-blue-400" />
                <span className="text-white font-body text-sm">{row.original.ownerName || "Unknown"}</span>
              </>
            ) : (
              <>
                <UserX className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400 font-body text-sm">Unclaimed</span>
              </>
            )}
          </div>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onLeadSelect(row.original)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-black/90 backdrop-blur-xl border-system rounded-brand">
                {!row.original.ownerId ? (
                  <DropdownMenuItem
                    onClick={() => handleClaimLead(row.original.id)}
                    className="text-white hover:bg-white/10"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Claim Lead
                  </DropdownMenuItem>
                ) : row.original.ownerId === user?.id ? (
                  <DropdownMenuItem
                    onClick={() => handleUnclaimLead(row.original.id)}
                    className="text-white hover:bg-white/10"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Unclaim Lead
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="text-gray-400 cursor-not-allowed">
                    <User className="mr-2 h-4 w-4" />
                    Claimed by {row.original.ownerName}
                  </DropdownMenuItem>
                )}
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Contact
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-brand">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white font-title">Delete Contact</AlertDialogTitle>
                      <AlertDialogDescription className="text-gray-400 font-body">
                        Are you sure you want to delete "{row.original.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10 rounded-pill">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onLeadDelete(row.original.id)}
                        className="bg-red-500 text-white hover:bg-red-600 rounded-pill"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      }),
    ],
    [onLeadSelect, onLeadUpdate, onLeadDelete, user]
  )

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm) ||
        (lead.address && lead.address.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [leads, searchTerm, statusFilter])

  const table = useReactTable({
    data: filteredLeads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-black/20 border-system text-white placeholder-gray-400 rounded-brand"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-black/20 border-system text-white rounded-brand">
            <span>{statusFilter === "all" ? "All Statuses" : statusFilter}</span>
          </SelectTrigger>
          <SelectContent className="bg-black/90 backdrop-blur-xl border-system rounded-brand">
            <SelectItem value="all" className="text-white hover:bg-white/10">All Statuses</SelectItem>
            <SelectItem value="cold" className="text-white hover:bg-white/10">Cold</SelectItem>
            <SelectItem value="contacted" className="text-white hover:bg-white/10">Contacted</SelectItem>
            <SelectItem value="interested" className="text-white hover:bg-white/10">Interested</SelectItem>
            <SelectItem value="closed" className="text-white hover:bg-white/10">Closed</SelectItem>
            <SelectItem value="dormant" className="text-white hover:bg-white/10">Dormant</SelectItem>
            <SelectItem value="left voicemail" className="text-white hover:bg-white/10">Left Voicemail</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-black/20 backdrop-blur-xl border-system rounded-brand overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-white/10">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-4 text-left font-title text-sm text-gray-400 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty state */}
      {filteredLeads.length === 0 && (
        <div className="text-center py-12">
          <div className="h-16 w-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-lg font-title text-white mb-2">No contacts found</h3>
          <p className="text-gray-400 font-body">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Get started by importing your CSV file or adding your first contact"}
          </p>
        </div>
      )}
    </div>
  )
}
