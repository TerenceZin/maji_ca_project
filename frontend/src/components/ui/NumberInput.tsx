import { InputHTMLAttributes, useEffect, useRef, useState } from 'react'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'step' | 'min' | 'max'>

interface Props extends BaseProps {
  value: number | null | undefined
  onChange: (v: number | null) => void
  min?: number
  max?: number
  step?: number | 'any'
  integer?: boolean
  /** If set, replaces null with this value on blur (e.g. min-1 quantities). */
  blurFallback?: number
  /** If true, clamps to min/max immediately on change instead of only on blur. */
  clampOnChange?: boolean
  /** Fired on blur with the final, fallback/clamp-applied value. Useful for triggering side-effects (rescale…) only when the user finishes editing. */
  onCommit?: (v: number | null) => void
}

export default function NumberInput({
  value, onChange,
  min, max, step, integer,
  blurFallback, clampOnChange, onCommit,
  onBlur: onBlurProp, onFocus: onFocusProp,
  ...rest
}: Props) {
  const [raw, setRaw] = useState<string>(value == null ? '' : String(value))
  const focused = useRef(false)
  const lastEmitted = useRef<number | null>(value ?? null)

  // Resync from external value (rescale, reset…) — but never while user is editing.
  useEffect(() => {
    if (focused.current) return
    const external = value ?? null
    if (external !== lastEmitted.current) {
      setRaw(external == null ? '' : String(external))
      lastEmitted.current = external
    }
  }, [value])

  const parse = (s: string): number | null => {
    if (s === '' || s === '-' || s === '.' || s === '-.') return null
    const n = integer ? parseInt(s, 10) : parseFloat(s)
    return Number.isNaN(n) ? null : n
  }

  const emit = (n: number | null) => {
    lastEmitted.current = n
    onChange(n)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value
    setRaw(s)
    let n = parse(s)
    if (clampOnChange && n !== null) {
      if (min !== undefined && n < min) n = min
      if (max !== undefined && n > max) n = max
    }
    emit(n)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    focused.current = false
    let n = parse(raw)
    if (n === null && blurFallback !== undefined) n = blurFallback
    if (n !== null) {
      if (min !== undefined && n < min) n = min
      if (max !== undefined && n > max) n = max
      if (integer) n = Math.round(n)
    }
    const newRaw = n == null ? '' : String(n)
    if (newRaw !== raw) setRaw(newRaw)
    if (n !== lastEmitted.current) emit(n)
    onCommit?.(n)
    onBlurProp?.(e)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focused.current = true
    onFocusProp?.(e)
  }

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      step={step ?? (integer ? 1 : 'any')}
      value={raw}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  )
}
