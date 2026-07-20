import { useCallback, useEffect, useState } from 'react'

/**
 * How the operator is scanning right now.
 *
 *  camera   — the device camera decodes QR codes (phone/tablet on the floor)
 *  external — a WiFi/USB 2D scanner types the code into a focused input and sends Enter
 */
export type ScanMode = 'camera' | 'external'

const STORAGE_KEY = 'mc_scan_mode'

/**
 * Default per device, because the right answer differs by hardware:
 *  - A desktop at the store desk usually has no usable camera but does have a scanner.
 *  - A phone on the floor has a camera and often no scanner.
 * Coarse pointer + a touch-capable screen is the best available proxy for "handheld".
 * Always overridable — this is only the starting position.
 */
function detectDefault(): ScanMode {
  if (typeof window === 'undefined') return 'external'
  const handheld =
    window.matchMedia?.('(pointer: coarse)').matches && navigator.maxTouchPoints > 0
  return handheld ? 'camera' : 'external'
}

function read(): ScanMode {
  if (typeof window === 'undefined') return 'external'
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v === 'camera' || v === 'external') return v
  } catch {
    /* private mode / storage disabled — fall through to the detected default */
  }
  return detectDefault()
}

/**
 * Scanning mode, remembered per device.
 *
 * Persisted in localStorage so an operator picks once rather than on every screen and
 * every shift. Shared across all scan screens (Receive Stock, Scan & Issue, Dispatch)
 * so switching in one place applies everywhere, and a `storage` listener keeps other
 * open tabs in step.
 *
 * IMPORTANT: when the mode is `external`, callers must not mount the camera component
 * at all. Merely hiding it would still hold the media track — that means a permission
 * prompt the operator did not ask for and a flat battery by mid-shift.
 */
export function useScanMode(): {
  mode: ScanMode
  setMode: (m: ScanMode) => void
  isCamera: boolean
  isExternal: boolean
} {
  const [mode, setModeState] = useState<ScanMode>(read)

  const setMode = useCallback((m: ScanMode) => {
    setModeState(m)
    try {
      window.localStorage.setItem(STORAGE_KEY, m)
    } catch {
      /* preference just won't persist; the session still works */
    }
  }, [])

  // Keep other tabs/screens in step when the choice changes elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      if (e.newValue === 'camera' || e.newValue === 'external') setModeState(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { mode, setMode, isCamera: mode === 'camera', isExternal: mode === 'external' }
}
