"use client"

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface ProfanityAlertProps {
  blockedWords: string[]
  role: "user" | "assistant"
  onDismiss: () => void
  inline?: boolean
}

export function ProfanityAlert({ blockedWords, role, onDismiss, inline = false }: ProfanityAlertProps) {
  const alertContent = (
    <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
      <AlertTriangle className="h-5 w-5 text-orange-600" />
      {!inline && <AlertTitle>Something went wrong</AlertTitle>}
      <AlertDescription>
        {role === "user"
          ? "Your message contains inappropriate language. Please rephrase and try again."
          : "The AI response contained inappropriate content and has been filtered."
        }
      </AlertDescription>
      {!inline && (
        <Button
          onClick={onDismiss}
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </Alert>
  )

  if (inline) {
    return alertContent
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {alertContent}
    </motion.div>
  )
}
