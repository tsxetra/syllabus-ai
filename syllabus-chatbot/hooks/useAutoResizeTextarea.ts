import { useEffect, useRef } from 'react'

export function useAutoResizeTextarea(
  value: string,
  minHeight = '3rem',
  maxHeight = '20rem'
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get natural height
    textarea.style.height = 'auto'

    // Calculate desired height
    const scrollHeight = Math.max(textarea.scrollHeight, parseFloat(minHeight.replace('rem', '')) * 16) // Estimate rem to px

    // Apply min and max height constraints
    const constrainedHeight = Math.min(scrollHeight, parseFloat(maxHeight.replace('rem', '')) * 16)

    // Set the height
    textarea.style.height = constrainedHeight + 'px'

    // If we're at max height and scrollHeight exceeds it, enable scrolling
    textarea.style.overflowY = scrollHeight > parseFloat(maxHeight.replace('rem', '')) * 16 ? 'auto' : 'hidden'
  }, [value, minHeight, maxHeight])

  return textareaRef
}
