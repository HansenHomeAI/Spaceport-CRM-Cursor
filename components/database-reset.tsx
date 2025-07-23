"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Trash2, Database, AlertTriangle, RefreshCw } from "lucide-react"

interface DatabaseResetProps {
  onResetDatabase: () => Promise<{ success: boolean; message: string }>
  onDeleteAllLeads: () => Promise<{ success: boolean; message: string }>
  isProductionMode: boolean
}

export function DatabaseReset({ onResetDatabase, onDeleteAllLeads, isProductionMode }: DatabaseResetProps) {
  const [isResetting, setIsResetting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleResetDatabase = async () => {
    setIsResetting(true)
    try {
      const result = await onResetDatabase()
      setMessage({ type: result.success ? "success" : "error", text: result.message })
    } catch (error) {
      setMessage({ type: "error", text: "Failed to reset database" })
    } finally {
      setIsResetting(false)
    }
  }

  const handleDeleteAllLeads = async () => {
    setIsDeleting(true)
    try {
      const result = await onDeleteAllLeads()
      setMessage({ type: result.success ? "success" : "error", text: result.message })
    } catch (error) {
      setMessage({ type: "error", text: "Failed to delete all leads" })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="bg-black/20 backdrop-blur-xl border-system rounded-brand">
      <CardHeader>
        <CardTitle className="text-white font-title flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Badge className={`${isProductionMode ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'} rounded-pill`}>
            {isProductionMode ? 'Production Mode' : 'Development Mode'}
          </Badge>
        </div>

        <div className="space-y-3">
          {/* Delete All Leads */}
          <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-brand">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-title">Delete All Contacts</h3>
                <p className="text-gray-400 text-sm">Remove all contacts from the database</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-pill"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-brand">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white font-title flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    Delete All Contacts
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400 font-body">
                    This will permanently delete ALL contacts from the database. This action cannot be undone.
                    {isProductionMode && " This will affect all users in your organization."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10 rounded-pill">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAllLeads}
                    className="bg-red-500 text-white hover:bg-red-600 rounded-pill"
                  >
                    Delete All Contacts
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Reset Database */}
          <div className="flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-brand">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-title">Reset Database</h3>
                <p className="text-gray-400 text-sm">Clear all data and start fresh</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 rounded-pill"
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset Database
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-brand">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white font-title flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                    Reset Database
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400 font-body">
                    This will completely reset the database, removing all contacts, activities, and user data.
                    {isProductionMode && " This will affect all users in your organization."}
                    <br /><br />
                    <strong>This action cannot be undone!</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10 rounded-pill">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetDatabase}
                    className="bg-orange-500 text-white hover:bg-orange-600 rounded-pill"
                  >
                    Reset Database
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-brand border ${
              message.type === "success" 
                ? "bg-green-500/10 border-green-500/20 text-green-300" 
                : "bg-red-500/10 border-red-500/20 text-red-300"
            }`}
          >
            {message.text}
          </motion.div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          <p>⚠️ These actions are irreversible and will affect all users.</p>
          {isProductionMode && (
            <p>🔒 Production mode: Changes will be permanent and affect your live database.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 