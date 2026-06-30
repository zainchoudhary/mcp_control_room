import { useState, useRef, useCallback, useEffect } from 'react'

const SPEECH_LANG_MAP = {
  en: 'en-US',
  ur: 'ur-PK',
  ar: 'ar-SA',
  hi: 'hi-IN',
  zh: 'zh-CN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  tr: 'tr-TR',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ru: 'ru-RU',
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function speechLangFromAppLanguage(languageId) {
  return SPEECH_LANG_MAP[languageId] || 'en-US'
}

export function useSpeechRecognition({ lang = 'en-US', onTranscript, onError, onEnd } = {}) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef(null)
  const shouldListenRef = useRef(false)

  useEffect(() => {
    setSupported(!!getSpeechRecognition())
  }, [])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition || shouldListenRef.current) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0]?.transcript || ''
        if (event.results[i].isFinal) final += piece
        else interim += piece
      }
      onTranscript?.({ final, interim })
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      onError?.(event.error)
      shouldListenRef.current = false
      setListening(false)
    }

    recognition.onend = () => {
      if (shouldListenRef.current) {
        try {
          recognition.start()
        } catch {
          shouldListenRef.current = false
          setListening(false)
          onEnd?.()
        }
        return
      }
      setListening(false)
      onEnd?.()
    }

    recognitionRef.current = recognition
    shouldListenRef.current = true
    setListening(true)

    try {
      recognition.start()
    } catch {
      shouldListenRef.current = false
      setListening(false)
      onError?.('not-allowed')
    }
  }, [lang, onTranscript, onError, onEnd])

  const toggle = useCallback(() => {
    if (listening || shouldListenRef.current) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => () => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
  }, [])

  return { listening, supported, start, stop, toggle }
}
