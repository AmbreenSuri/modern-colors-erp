import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * A number that counts to its value instead of snapping.
 *
 * Used for KPI cards and live stock figures. Driven by requestAnimationFrame
 * against a real clock (not a fixed step count), so the duration holds even if
 * a frame is dropped on a mid-range factory phone.
 *
 * Respects prefers-reduced-motion by rendering the final value immediately —
 * animated digits are exactly the kind of motion that triggers discomfort.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration,
  className,
  prefix = '',
  suffix = '',
}: {
  value: number
  decimals?: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
}) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const from = fromRef.current
    const to = value

    if (reduced || from === to) {
      fromRef.current = to
      setDisplay(to)
      return
    }

    // Scale the duration with the size of the jump so a small correction is
    // quick and a big load-in still feels deliberate — capped either side.
    const delta = Math.abs(to - from)
    const magnitude = Math.min(1, delta / Math.max(1, Math.abs(to) || 1))
    const ms = duration ?? 420 + magnitude * 480

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      // easeOutExpo — fast commitment, gentle settle. Matches --ease-out.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      // Park the start point at wherever we stopped, so an interrupted
      // animation continues from the visible number rather than jumping back.
      fromRef.current = display
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <span className={cn('tabular', className)}>
      {prefix}
      {display.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}
