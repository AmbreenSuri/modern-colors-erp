import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState, type CameraDevice } from 'html5-qrcode'
import { CameraOff, Loader2, Camera, RefreshCw } from 'lucide-react'

interface CameraQrScannerProps {
  onResult: (text: string) => void
  /** Pause decoding (e.g. while the parent processes a scan). */
  paused?: boolean
}

const REGION_ID = 'qr-camera-region'

/**
 * Live rear-camera QR scanner (mobile-first) built on html5-qrcode.
 *
 * The camera is started by an explicit TAP, not automatically: many mobile
 * browsers (notably iOS WebKit and in-app browsers) refuse getUserMedia unless
 * it is initiated from a user gesture, which is why an auto-start showed
 * "No camera available". Decodes continuously, de-dupes repeat reads, and falls
 * back gracefully (manual entry always remains on the page).
 */
export function CameraQrScanner({ onResult, paused = false }: CameraQrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const cancelledRef = useRef(false)
  const startingRef = useRef(false)
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  // Create the scanner instance once (the region element already exists in the DOM).
  useEffect(() => {
    cancelledRef.current = false
    try {
      scannerRef.current = new Html5Qrcode(REGION_ID, { verbose: false })
    } catch {
      setStatus('error')
      setError('Scanner could not initialise. Use manual entry below.')
    }
    return () => {
      cancelledRef.current = true
      const s = scannerRef.current
      scannerRef.current = null
      if (!s) return
      // Only stop a running scanner (stop() throws otherwise). Guarded so a
      // double-mount can never crash the page.
      try {
        const state = s.getState?.()
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          s.stop()
            .then(() => {
              try {
                s.clear()
              } catch {
                /* noop */
              }
            })
            .catch(() => {})
        } else {
          try {
            s.clear()
          } catch {
            /* noop */
          }
        }
      } catch {
        /* noop */
      }
    }
  }, [])

  const startCamera = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner || startingRef.current) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Camera needs a secure (HTTPS) connection. Use manual entry below.')
      return
    }
    startingRef.current = true
    setStatus('starting')
    setError(null)

    const onDecode = (text: string) => {
      if (pausedRef.current) return
      const now = Date.now()
      if (text === lastRef.current.text && now - lastRef.current.at < 2500) return
      lastRef.current = { text, at: now }
      onResult(text)
    }

    const config = {
      fps: 15,
      qrbox: (w: number, h: number) => {
        const size = Math.max(200, Math.floor(Math.min(w, h) * 0.8))
        return { width: size, height: size }
      },
      aspectRatio: 1,
      // Native BarcodeDetector when supported (Android Chrome) — faster + more reliable.
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    }

    const isPermissionError = (e: unknown) =>
      (e instanceof DOMException && e.name === 'NotAllowedError') ||
      (e instanceof Error && /permission|denied|notallowed/i.test(e.message))

    // Continuous autofocus applied AFTER start (best-effort) — never in the
    // getUserMedia constraints, where an unsupported focusMode makes start() fail.
    const applyAutofocus = () => {
      scanner
        .applyVideoConstraints({ advanced: [{ focusMode: 'continuous' }] } as unknown as MediaTrackConstraints)
        .catch(() => {})
    }
    const onOk = () => {
      if (!cancelledRef.current) {
        setStatus('running')
        applyAutofocus()
      }
    }

    // Progressive attempts — high-res rear → plain rear → any camera. All "ideal"
    // so they degrade instead of failing on cameras that can't meet them.
    const attempts: MediaTrackConstraints[] = [
      { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      { facingMode: { ideal: 'environment' } },
      {},
    ]
    let lastErr: unknown
    try {
      for (const cam of attempts) {
        try {
          await scanner.start(cam, config, onDecode, () => {})
          onOk()
          return
        } catch (e) {
          lastErr = e
          if (isPermissionError(e)) break
        }
      }
      // Last resort: enumerate devices and try each (rear-labelled first).
      if (!isPermissionError(lastErr)) {
        try {
          const cams: CameraDevice[] = await Html5Qrcode.getCameras()
          const ordered = cams
            .slice()
            .sort(
              (a, b) =>
                Number(/back|rear|environment/i.test(b.label)) -
                Number(/back|rear|environment/i.test(a.label)),
            )
          for (const c of ordered) {
            try {
              await scanner.start(c.id, config, onDecode, () => {})
              onOk()
              return
            } catch (e) {
              lastErr = e
              if (isPermissionError(e)) break
            }
          }
        } catch (e) {
          lastErr = e
        }
      }

      if (cancelledRef.current) return
      const name =
        lastErr instanceof Error ? lastErr.name || lastErr.message : String(lastErr ?? 'unknown')
      setStatus('error')
      setError(
        isPermissionError(lastErr)
          ? 'Camera access was blocked. Allow camera for this site in your browser settings, then tap Try again.'
          : `Could not start the camera (${name}). Tap Try again, or use manual entry below.`,
      )
    } finally {
      startingRef.current = false
    }
  }, [onResult])

  return (
    <div className="space-y-2">
      <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-lg border bg-black">
        <div id={REGION_ID} className="mx-auto w-full [&_video]:block [&_video]:w-full" />

        {status === 'idle' && (
          <button
            type="button"
            onClick={startCamera}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/90"
          >
            <Camera className="h-9 w-9" />
            <span className="font-medium">Tap to start camera</span>
          </button>
        )}

        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
            <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/85">
            <CameraOff className="h-6 w-6" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setStatus('idle')
                setError(null)
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/30 px-3 py-1.5 text-white"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}
      </div>

      {status === 'running' && (
        <p className="text-center text-xs text-muted-foreground">
          Point the rear camera at a unit's QR code.
        </p>
      )}
      {status === 'idle' && (
        <p className="text-center text-xs text-muted-foreground">
          Tap the camera above to begin scanning.
        </p>
      )}
    </div>
  )
}
