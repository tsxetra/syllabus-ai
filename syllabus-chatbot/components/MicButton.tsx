"use client"

import { motion } from "framer-motion"
import { Mic, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useEffect } from "react"

interface MicButtonProps {
  isRecording: boolean
  isSupported: boolean
  onPressStart: () => void
  onPressEnd: () => void
  className?: string
}

export function MicButton({
  isRecording,
  isSupported,
  onPressStart,
  onPressEnd,
  className = ""
}: MicButtonProps) {
  // Mobile vibration feedback
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isSupported) return

    vibrate(50) // Short vibration
    onPressStart()
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault()
    onPressEnd()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (!isSupported) return

    vibrate(50)
    onPressStart()
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    onPressEnd()
  }

  // Handle keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!isRecording) {
        handleMouseDown(e as any)
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      if (isRecording) {
        handleMouseUp(e as any)
      }
    }
  }

  const buttonContent = (
    <Button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      className={`w-14 h-14 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl ${
        !isSupported
          ? "bg-gray-400 cursor-not-allowed opacity-50"
          : isRecording
            ? "bg-red-500 hover:bg-red-600 animate-pulse"
            : "bg-primary hover:bg-primary/90"
      } text-primary-foreground ${className}`}
      disabled={!isSupported}
      aria-label={isRecording ? "Stop voice recording" : "Start voice recording"}
      aria-pressed={isRecording}
      role="button"
      tabIndex={0}
    >
      {isRecording ? (
        <Square className="w-6 h-6" />
      ) : (
        <Mic className="w-6 h-6" />
      )}
    </Button>
  )

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent>
            <p>Microphone not available on this browser</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      {buttonContent}
      {/* Screen reader announcements */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {isRecording ? "Recording voice input" : "Voice input ready"}
      </div>
    </>
  )
}
