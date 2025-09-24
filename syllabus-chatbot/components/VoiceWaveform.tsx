import { motion } from "framer-motion"

interface VoiceWaveformProps {
  isRecording: boolean
  className?: string
}

export function VoiceWaveform({ isRecording, className = "" }: VoiceWaveformProps) {
  if (!isRecording) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`bg-card border border-border rounded-full px-6 py-3 shadow-lg ${className}`}
      role="status"
      aria-label="Recording audio"
    >
      <div className="flex items-center gap-3">
        <div className="flex gap-1" aria-hidden="true">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 h-6 bg-primary rounded-full"
              animate={{
                height: [6, 12, 6],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 0.6,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.1,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground select-none">
          Listening...
        </span>
      </div>
    </motion.div>
  )
}
