import { useState, useRef, useEffect, useCallback } from "react"

// Web Speech API type declarations (not in standard TypeScript lib)
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechGrammarList {}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  grammars: SpeechGrammarList
  interimResults: boolean
  lang: string
  maxAlternatives: number
  serviceURI: string
  start(): void
  stop(): void
  abort(): void
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
}

interface STTCallbacks {
  onInterimTranscript: (text: string) => void
  onFinalTranscript: (text: string) => void
  onError: (error: string) => void
}

interface UseSTTReturn {
  supported: boolean
  isListening: boolean
  start: (callbacks: STTCallbacks) => void
  stop: () => void
  abort: () => void
}

export function useSTT(): UseSTTReturn {
  const [supported] = useState(() => {
    return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  })

  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const callbacksRef = useRef<STTCallbacks | null>(null)

  useEffect(() => {
    if (supported) {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()

      const recognition = recognitionRef.current!
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (interimTranscript && callbacksRef.current?.onInterimTranscript) {
          callbacksRef.current.onInterimTranscript(interimTranscript)
        }

        if (finalTranscript && callbacksRef.current?.onFinalTranscript) {
          callbacksRef.current.onFinalTranscript(finalTranscript)
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('STT error:', event.error)
        setIsListening(false)
        if (callbacksRef.current?.onError) {
          let errorMsg = 'Speech recognition error'
          switch (event.error) {
            case 'no-speech':
              errorMsg = 'No speech detected'
              break
            case 'audio-capture':
              errorMsg = 'Audio capture failed'
              break
            case 'not-allowed':
              errorMsg = 'Microphone permission denied'
              break
            case 'network':
              errorMsg = 'Network error'
              break
            default:
              errorMsg = `Recognition failed: ${event.error}`
          }
          callbacksRef.current.onError(errorMsg)
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [supported])

  const start = useCallback((callbacks: STTCallbacks) => {
    if (!supported || isListening) return

    callbacksRef.current = callbacks

    try {
      recognitionRef.current?.start()
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      callbacks.onError?.('Failed to start speech recognition')
    }
  }, [supported, isListening])

  const stop = useCallback(() => {
    if (!supported || !isListening) return

    recognitionRef.current?.stop()
  }, [supported, isListening])

  const abort = useCallback(() => {
    if (!supported) return

    recognitionRef.current?.abort()
    setIsListening(false)
  }, [supported])

  return {
    supported,
    isListening,
    start,
    stop,
    abort
  }
}
