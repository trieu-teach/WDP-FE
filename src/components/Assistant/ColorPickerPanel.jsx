import { useCallback, useEffect, useRef, useState } from 'react'
import { QUICK_SWATCHES } from '../../constants/paintPalette.js'
import { hexToHsl, hslToHex, normalizeHex } from './colorPickerUtils.js'
import './ColorPickerPanel.css'

export default function ColorPickerPanel({ label, color, onChange, disabled }) {
  const slRef = useRef(null)
  const hueRef = useRef(null)
  const [hsl, setHsl] = useState(() => hexToHsl(normalizeHex(color)))
  const [hexInput, setHexInput] = useState(() => normalizeHex(color))

  useEffect(() => {
    const next = normalizeHex(color)
    setHsl(hexToHsl(next))
    setHexInput(next)
  }, [color])

  const emit = useCallback(
    (h, s, l) => {
      const hex = hslToHex(h, s, l)
      setHexInput(hex)
      onChange(hex)
    },
    [onChange],
  )

  const updateHsl = useCallback(
    (patch) => {
      setHsl(prev => {
        const next = { ...prev, ...patch }
        emit(next.h, next.s, next.l)
        return next
      })
    },
    [emit],
  )

  function pickFromSl(clientX, clientY) {
    const el = slRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    updateHsl({ s: Math.round(x * 100), l: Math.round((1 - y) * 100) })
  }

  function pickFromHue(clientX) {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    updateHsl({ h: Math.round(x * 360) })
  }

  function onSlPointerDown(e) {
    if (disabled) return
    e.preventDefault()
    pickFromSl(e.clientX, e.clientY)
    const move = ev => pickFromSl(ev.clientX, ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onHuePointerDown(e) {
    if (disabled) return
    e.preventDefault()
    pickFromHue(e.clientX)
    const move = ev => pickFromHue(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onHexCommit(value) {
    const v = value.startsWith('#') ? value : `#${value}`
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      const n = normalizeHex(v)
      setHexInput(n)
      const parsed = hexToHsl(n)
      setHsl(parsed)
      onChange(n)
    } else {
      setHexInput(normalizeHex(color))
    }
  }

  const hueColor = `hsl(${hsl.h}, 100%, 50%)`

  return (
    <div className={`as-color-picker${disabled ? ' as-color-picker--disabled' : ''}`}>
      <div className="as-color-picker__head">
        <span className="as-color-picker__label">{label}</span>
        <span
          className="as-color-picker__preview"
          style={{ background: normalizeHex(color) }}
          title={normalizeHex(color)}
        />
      </div>

      <div className="as-color-picker__spectrum">
        <div
          ref={slRef}
          className="as-color-picker__sl"
          role="application"
          aria-label={`Chọn độ bão hòa và độ sáng cho ${label}`}
          style={{ '--picker-hue': hueColor }}
          onPointerDown={onSlPointerDown}
        >
          <span
            className="as-color-picker__cursor"
            style={{
              left: `${hsl.s}%`,
              top: `${100 - hsl.l}%`,
            }}
            aria-hidden
          />
        </div>
        <div
          ref={hueRef}
          className="as-color-picker__hue"
          role="slider"
          aria-label="Vòng màu"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={hsl.h}
          onPointerDown={onHuePointerDown}
        >
          <span
            className="as-color-picker__hue-thumb"
            style={{ left: `${(hsl.h / 360) * 100}%` }}
            aria-hidden
          />
        </div>
      </div>

      <div className="as-color-picker__hex-row">
        <label className="as-color-picker__hex">
          <span>Hex</span>
          <input
            type="text"
            value={hexInput}
            disabled={disabled}
            spellCheck={false}
            maxLength={7}
            onChange={e => setHexInput(e.target.value)}
            onBlur={e => onHexCommit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onHexCommit(e.target.value)
            }}
          />
        </label>
        <label className="as-color-picker__native" title="Bảng màu hệ thống">
          <input
            type="color"
            value={normalizeHex(color)}
            disabled={disabled}
            onChange={e => {
              const n = normalizeHex(e.target.value)
              setHsl(hexToHsl(n))
              setHexInput(n)
              onChange(n)
            }}
          />
          <span>⋯</span>
        </label>
      </div>

      <div className="as-color-picker__quick">
        <span className="as-color-picker__quick-label">Màu thường dùng</span>
        <div className="as-color-picker__swatches">
          {QUICK_SWATCHES.map(c => (
            <button
              key={c}
              type="button"
              className={`as-color-picker__swatch${normalizeHex(color) === c ? ' active' : ''}`}
              style={{ background: c }}
              title={c}
              disabled={disabled}
              onClick={() => {
                setHsl(hexToHsl(c))
                setHexInput(c)
                onChange(c)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
