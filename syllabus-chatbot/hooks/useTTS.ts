import { useState, useRef, useEffect, useCallback } from "react"

interface SpeechOptions {
  voiceName?: string
  rate?: number
}

interface UseTTSReturn {
  voices: SpeechSynthesisVoice[]
  isSpeaking: boolean
  speak: (text: string, options?: SpeechOptions) => Promise<void>
  cancel: () => void
  supported: boolean
}

export function useTTS(): UseTTSReturn {
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Load available voices
  useEffect(() => {
    if (!supported) return

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices()
      setVoices(availableVoices)
    }

    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      speechSynthesis.onvoiceschanged = null
    }
  }, [supported])

  // Save settings to localStorage
  const saveTTSSettings = (voiceName?: string, rate?: number) => {
    const settings = {
      voiceName: voiceName || undefined,
      rate: rate || 1.0
    }
    localStorage.setItem('syllabus-tts-settings', JSON.stringify(settings))
  }

  // Load settings from localStorage
  const loadTTSSettings = () => {
    try {
      const saved = localStorage.getItem('syllabus-tts-settings')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Error loading TTS settings:', error)
    }
    return { voiceName: undefined, rate: 1.0 }
  }

  const speak = useCallback(async (text: string, options?: SpeechOptions): Promise<void> => {
    if (!supported || !text.trim()) {
      return Promise.resolve()
    }

    // Cancel any current speech
    cancel()

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text)

      // Apply voice settings
      const savedSettings = loadTTSSettings()
      const rate = options?.rate ?? savedSettings.rate ?? 1.0
      const voiceName = options?.voiceName ?? savedSettings.voiceName

      utterance.rate = Math.max(0.1, Math.min(10, rate))

      if (voiceName) {
        const selectedVoice = voices.find(voice => voice.name === voiceName)
        if (selectedVoice) {
          utterance.voice = selectedVoice
        }
      } else if (voices.length > 0) {
        // Default to Google UK English Female if available, otherwise English voice
        const ukEnglishFemale = voices.find(voice =>
          voice.name.includes('Google UK English Female') ||
          (voice.lang.includes('en-GB') && voice.name.toLowerCase().includes('female'))
        )
        utterance.voice = ukEnglishFemale || voices.find(voice => voice.lang.startsWith('en-')) || voices[0]
      }

      utterance.onstart = () => {
        setIsSpeaking(true)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        utterance.onstart = null
        utterance.onerror = null
        utterance.onend = null
        resolve()
      }

      utterance.onerror = (event) => {
        console.error('TTS error:', event.error)
        setIsSpeaking(false)
        utterance.onstart = null
        utterance.onerror = null
        utterance.onend = null
        reject(new Error(`Speech synthesis failed: ${event.error}`))
      }

      utterRef.current = utterance
      speechSynthesis.speak(utterance)

      // Save settings for next time
      saveTTSSettings(utterance.voice?.name, utterance.rate)
    })
  }, [supported, voices])

  const cancel = useCallback(() => {
    if (!supported) return

    speechSynthesis.cancel()
    setIsSpeaking(false)
    utterRef.current = null
  }, [supported])

  return {
    voices,
    isSpeaking,
    speak,
    cancel,
    supported
  }
}
