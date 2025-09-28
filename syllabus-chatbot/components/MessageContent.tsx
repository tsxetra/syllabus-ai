'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface MessageContentProps {
  content: string
  role: 'user' | 'assistant'
  timestamp?: Date
  isTyping?: boolean
}

const USER_CHAR_LIMIT = 1000
const AI_CHAR_LIMIT = 3000

export function MessageContent({ content, role, timestamp, isTyping = false }: MessageContentProps) {
  const limit = role === 'user' ? USER_CHAR_LIMIT : AI_CHAR_LIMIT
  const isoverLimit = content.length > limit && !isTyping
  const [expanded, setExpanded] = useState(false)

  const displayContent = (isTyping || expanded) ? content : (isoverLimit ? content.slice(0, limit) + '...' : content)

  return (
    <div className="relative">
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {displayContent}
      </p>
      {isoverLimit && !expanded && (
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent dark:from-gray-900 pointer-events-none" />
      )}
      {isoverLimit && (
        <div className="flex items-center justify-end mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <>
                See less <ChevronUp className="w-3 h-3 ml-1" />
              </>
            ) : (
              <>
                See more <ChevronDown className="w-3 h-3 ml-1" />
              </>
            )}
          </Button>
        </div>
      )}
      {timestamp && (
        <time className="text-xs opacity-60 mt-2 block" dateTime={timestamp.toISOString()}>
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      )}
    </div>
  )
}
