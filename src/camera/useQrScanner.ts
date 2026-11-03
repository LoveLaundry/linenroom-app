/**
 * Camera QR scanning for the linen room.
 *
 * Two decoders, in order of preference:
 *
 *   1. `BarcodeDetector` — native, present in Chromium. No bundled payload.
 *   2. `jsQR` — pure JavaScript, used when the native detector is missing
 *      (Firefox, Safari) or refuses the `qr_code` format.
 *
 * The previous version relied on the native detector alone. Where it was absent
 * the page reported "unsupported" and never decoded anything, which is what
 * "the camera opens but nothing scans" looked like in practice.
 *
 * Two failure modes are handled explicitly because they are invisible
 * otherwise:
 *
 *   - The camera API is undefined outside a secure context. Opening the app
 *     over http:// on a LAN address is not a secure context, so scanning
 *     silently cannot start. That case now says so.
 *   - `video.play()` can reject (autoplay policy) before frames exist. The loop
 *     used to wait forever for `readyState`, so no frame was ever inspected.
 *     Playback is retried from inside the loop instead.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[]
}) => BarcodeDetectorLike

type NativeCtor = BarcodeDetectorCtor & {
  getSupportedFormats?: () => Promise<string[]>
}

function detectorCtor(): NativeCtor | null {
  // Read through a cast rather than a global declaration: `BarcodeDetector` is
  // not in every TS lib version, and redeclaring it would clash where it is.
  const scope = window as unknown as { BarcodeDetector?: NativeCtor }
  return scope.BarcodeDetector ?? null
}

/** The width frames are downscaled to before decoding. */
const DECODE_WIDTH = 640

/** How long a decoded value is ignored after being acted on. */
const REPEAT_WINDOW_MS = 1500

/** Delay between decode attempts. */
const TICK_MS = 180

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
  /** Which decoder is in use, for the status line. */
  decoder: 'native' | 'jsqr' | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  start: () => Promise<void>
  stop: () => void
}

function insecureContextMessage(): string | null {
  if (window.isSecureContext) return null
  const host = window.location.hostname
  const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
  if (loopback) return null
  return (
    'The camera needs HTTPS (or localhost). This page was opened over plain ' +
    'HTTP, so the browser blocks camera access. Type the tag or use a scan gun.'
  )
}

export function useQrScanner(onCode: (code: string) => void): QrScanner {
  const [state, setState] = useState<ScannerState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [decoder, setDecoder] = useState<'native' | 'jsqr' | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastCodeRef = useRef<string>('')
  const lastAtRef = useRef<number>(0)
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
    setDecoder(null)
    setState((previous) =>
      previous === 'unsupported' || previous === 'denied' ? previous : 'idle',
    )
  }, [])

  /** Wait for the <video> to be in the tree; it mounts with the panel. */
  const waitForVideo = useCallback(async (): Promise<HTMLVideoElement | null> => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const element = videoRef.current
      if (element) return element
      await new Promise((resolve) => window.setTimeout(resolve, 50))
    }
    return null
  }, [])

  const start = useCallback(async () => {
    if (streamRef.current) return

    const insecure = insecureContextMessage()
    if (insecure) {
      setState('unsupported')
      setMessage(insecure)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      setMessage('This browser exposes no camera API. Type the tag or use a scan gun.')
      return
    }

    setState('starting')
    setMessage(null)

    // Pick the decoder before asking for the camera, so an unsupported device
    // fails without prompting for permission.
    const Ctor = detectorCtor()
    let useNative = false
    if (Ctor) {
      try {
        if (typeof Ctor.getSupportedFormats === 'function') {
          const formats = await Ctor.getSupportedFormats()
          useNative = formats.includes('qr_code')
        } else {
          useNative = true
        }
      } catch {
        useNative = false
      }
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false,
      })
    } catch (caught) {
      const name = (caught as { name?: string } | null)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied')
        setMessage('Camera permission was refused. Allow it, or type the tag.')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setState('error')
        setMessage('No camera was found on this device. Type the tag instead.')
      } else {
        setState('error')
        setMessage('Could not start the camera. Type the tag instead.')
      }
      return
    }

    streamRef.current = stream
    const video = await waitForVideo()
    if (!video) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
      setState('error')
      setMessage('The camera preview did not appear. Close and reopen the camera.')
      return
    }

    video.srcObject = stream
    video.muted = true
    video.setAttribute('playsinline', 'true')
    try {
      await video.play()
    } catch {
      // Retried inside the loop; autoplay can be refused until the element is
      // actually laid out.
    }

    let nativeDetector: BarcodeDetectorLike | null = null
    if (useNative && Ctor) {
      try {
        nativeDetector = new Ctor({ formats: ['qr_code'] })
      } catch {
        nativeDetector = null
      }
    }

    setDecoder(nativeDetector ? 'native' : 'jsqr')
    setState('scanning')

    const canvas = canvasRef.current ?? document.createElement('canvas')
    canvasRef.current = canvas
    const context = canvas.getContext('2d', { willReadFrequently: true })

    const emit = (raw: string) => {
      const value = raw.trim()
      if (!value) return
      const now = Date.now()
      if (value === lastCodeRef.current && now - lastAtRef.current < REPEAT_WINDOW_MS) return
      lastCodeRef.current = value
      lastAtRef.current = now
      if (navigator.vibrate) navigator.vibrate(40)
      onCodeRef.current(value)
    }

    const decodeFrame = async (element: HTMLVideoElement): Promise<string | null> => {
      if (nativeDetector) {
        try {
          const found = await nativeDetector.detect(element)
          return found[0]?.rawValue ?? null
        } catch {
          // A torn-down track throws; fall through to the next tick.
          return null
        }
      }
      if (!context) return null
      const sourceWidth = element.videoWidth
      const sourceHeight = element.videoHeight
      if (!sourceWidth || !sourceHeight) return null
      const scale = Math.min(1, DECODE_WIDTH / sourceWidth)
      const width = Math.round(sourceWidth * scale)
      const height = Math.round(sourceHeight * scale)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      context.drawImage(element, 0, 0, width, height)
      const frame = context.getImageData(0, 0, width, height)
      const result = jsQR(frame.data, width, height, { inversionAttempts: 'attemptBoth' })
      return result?.data ?? null
    }

    const tick = async () => {
      if (!streamRef.current) return
      timerRef.current = null
      const element = videoRef.current
      if (element) {
        if (element.paused) {
          // Autoplay was refused earlier; keep trying, silently.
          try {
            await element.play()
          } catch {
            /* the next tick retries */
          }
        }
        if (element.readyState >= 2 && !element.paused) {
          const raw = await decodeFrame(element)
          if (raw) emit(raw)
        }
      }
      if (!streamRef.current) return
      timerRef.current = window.setTimeout(() => void tick(), TICK_MS)
    }
    void tick()
  }, [waitForVideo])

  // Release the camera on unmount, otherwise the indicator light stays on and
  // the next mount cannot acquire the device.
  useEffect(() => stop, [stop])

  return { state, message, decoder, videoRef, start, stop }
}
