/**
 * Camera QR scanning for the linen room.
 *
 * Uses the browser's native BarcodeDetector rather than bundling a decoder: it
 * ships with Chromium and Android Chrome, needs no WASM payload over a slow
 * linen-room connection, and keeps this app dependency-free. Where it is
 * missing (Firefox, older Safari) the hook reports `unsupported` and the page
 * degrades to the keyboard path, which is also what a USB/bluetooth scan gun
 * uses — those present as a keyboard and type the code, so they keep working.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[]
}) => BarcodeDetectorLike

function detectorCtor(): BarcodeDetectorCtor | null {
  // Read through a cast rather than a global declaration: `BarcodeDetector` is
  // not in every TS lib version, and redeclaring it would clash where it is.
  const scope = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  return scope.BarcodeDetector ?? null
}

export type ScannerState =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'unsupported'
  | 'denied'
  | 'error'

interface QrScanner {
  state: ScannerState
  message: string | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  start: () => Promise<void>
  stop: () => void
}

/**
 * @param onCode Called once per distinct decoded value. The same code is
 *   suppressed for a short window so a tag held in front of the lens does not
 *   fire dozens of lookups while the operator moves it away.
 */
export function useQrScanner(onCode: (code: string) => void): QrScanner {
  const [state, setState] = useState<ScannerState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastCodeRef = useRef<string>('')
  const lastAtRef = useRef<number>(0)
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      window.clearTimeout(rafRef.current)
      rafRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
    setState((previous) =>
      previous === 'unsupported' || previous === 'denied' ? previous : 'idle',
    )
  }, [])

  const start = useCallback(async () => {
    if (streamRef.current) return

    const Ctor = detectorCtor()
    if (!Ctor) {
      setState('unsupported')
      setMessage(
        'This browser cannot decode QR codes. Type the tag or use a scan gun instead.',
      )
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      setMessage('No camera is available on this device. Type the tag instead.')
      return
    }

    setState('starting')
    setMessage(null)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
    } catch (caught) {
      const name = (caught as { name?: string } | null)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied')
        setMessage('Camera permission was refused. Allow it, or type the tag.')
      } else {
        setState('error')
        setMessage('Could not start the camera. Type the tag instead.')
      }
      return
    }

    streamRef.current = stream
    const video = videoRef.current
    if (!video) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
      setState('idle')
      return
    }

    video.srcObject = stream
    try {
      await video.play()
    } catch {
      // Autoplay can be blocked when the element is not yet visible; the loop
      // below still reads frames once playback actually begins.
    }

    setState('scanning')
    const detector = new Ctor({ formats: ['qr_code'] })

    const tick = async () => {
      if (!streamRef.current) return
      const element = videoRef.current
      if (element && element.readyState >= 2) {
        try {
          const found = await detector.detect(element)
          const raw = found[0]?.rawValue?.trim()
          if (raw) {
            const now = Date.now()
            // 1.2s suppression: long enough to lift the tag, short enough to
            // re-scan the same piece deliberately.
            const isRepeat = raw === lastCodeRef.current && now - lastAtRef.current < 1200
            if (!isRepeat) {
              lastCodeRef.current = raw
              lastAtRef.current = now
              if (navigator.vibrate) navigator.vibrate(40)
              onCodeRef.current(raw)
            }
          }
        } catch {
          // detect() throws on a torn-down track; the next tick retries.
        }
      }
      rafRef.current = window.setTimeout(() => void tick(), 250)
    }
    void tick()
  }, [])

  // Release the camera on unmount, otherwise the indicator light stays on and
  // the next mount cannot acquire the device.
  useEffect(() => stop, [stop])

  return { state, message, videoRef, start, stop }
}
