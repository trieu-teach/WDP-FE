import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export function OtpInput({ value, onChange, disabled, className }) {
  const refs = useRef([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  function emit(nextDigits) {
    onChange(nextDigits.join('').slice(0, 6))
  }

  function handleChange(index, raw) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    emit(next)
    if (digit && index < 5) refs.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus()
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    onChange(pasted)
    const focusIndex = Math.min(pasted.length, 5)
    refs.current[focusIndex]?.focus()
  }

  return (
    <div className={cn('flex justify-center gap-2 sm:gap-3', className)} onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={el => { refs.current[index] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={`OTP digit ${index + 1}`}
          className={cn(
            'size-11 rounded-xl border bg-background text-center text-lg font-semibold shadow-sm transition-colors sm:size-12',
            'focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none',
            disabled && 'opacity-60',
          )}
          onChange={e => handleChange(index, e.target.value)}
          onKeyDown={e => handleKeyDown(index, e)}
        />
      ))}
    </div>
  )
}
