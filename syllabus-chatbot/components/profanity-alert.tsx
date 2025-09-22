"use client"

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ShieldX } from "lucide-react"
import { motion } from "framer-motion"

interface ProfanityAlertProps {
  blockedWords: string[]
  role: "user" | "assistant"
  onDismiss: () => void
}

export function ProfanityAlert({ blockedWords, role, onDismiss }: ProfanityAlertProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Alert variant="destructive" className="mb-4 border-red-500 bg-red-50 dark:bg-red-950">
        <ShieldX className="h-4 w-4" />
        <AlertTitle>Content Blocked</AlertTitle>
        <AlertDescription>
          {role === "user"
            ? "Your message contains inappropriate language. Please rephrase and try again."
            : "The AI response contained inappropriate content and has been filtered."
          }
          <br />
          <span className="mt-2 inline-block text-sm">
            Detected words: {blockedWords.join(", ")}
          </span>
        </AlertDescription>
        <button
          onClick={onDismiss}
          className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss alert"
        >
          ×
        </button>
      </Alert>
    </motion.div>
  )
}
