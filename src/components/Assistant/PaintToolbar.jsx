import {
  BRUSH_SIZE_PRESETS,
  INPUT_MODES,
  PAINT_TOOLS,
} from '../../constants/paintPalette.js'
import ColorPickerPanel from './ColorPickerPanel.jsx'
import './PaintToolbar.css'

export default function PaintToolbar({
  inputMode,
  onInputModeChange,
  tabletConnected,
  tabletLabel,
  tool,
  onToolChange,
  brushColor,
  onBrushColorChange,
  fillColor,
  onFillColorChange,
  brushSize,
  onBrushSizeChange,
  brushOpacity,
  onBrushOpacityChange,
  shapeFilled,
  onShapeFilledChange,
  activeLayerName,
  activeLayerColor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  disabled,
}) {
  return (
    <div className="as-paint-toolbar">
      <div className="as-paint-toolbar__modes">
        <span className="as-paint-toolbar__label">Chế độ nhập</span>
        <div className="as-paint-toolbar__mode-btns">
          {INPUT_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              className={`as-paint-mode${inputMode === m.id ? ' active' : ''}`}
              disabled={disabled}
              onClick={() => onInputModeChange(m.id)}
            >
              <strong>{m.label}</strong>
              <span>{m.desc}</span>
            </button>
          ))}
        </div>
        {inputMode === 'tablet' ? (
          <p className={`as-tablet-status${tabletConnected ? ' as-tablet-status--on' : ''}`} role="status">
            {tabletConnected
              ? `✓ Đã nhận ${tabletLabel || 'bút vẽ / tablet'} — áp lực bút bật`
              : 'Cắm USB hoặc Bluetooth tablet (Wacom, XP-Pen, Huion…) rồi chạm canvas bằng bút'}
          </p>
        ) : null}
      </div>

      <div
        className="as-active-layer-banner"
        style={{ '--layer-accent': activeLayerColor || '#9b5de5' }}
      >
        <span className="as-active-layer-banner__dot" aria-hidden />
        <div>
          <span className="as-active-layer-banner__kicker">Layer đang dùng</span>
          <strong className="as-active-layer-banner__name">{activeLayerName || '—'}</strong>
        </div>
        <span className="as-active-layer-banner__hint">Mọi nét vẽ ghi vào layer này</span>
      </div>

      <div className="as-paint-toolbar__row as-paint-toolbar__history">
        <span className="as-paint-toolbar__label">Hoàn tác</span>
        <div className="as-history-btns">
          <button
            type="button"
            className="as-history-btn"
            disabled={disabled || !canUndo}
            title="Hoàn tác (Ctrl+Z)"
            onClick={onUndo}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            className="as-history-btn"
            disabled={disabled || !canRedo}
            title="Làm lại (Ctrl+Y)"
            onClick={onRedo}
          >
            ↷ Redo
          </button>
        </div>
      </div>

      <div className="as-paint-toolbar__row">
        <span className="as-paint-toolbar__label">Công cụ</span>
        <div className="as-paint-tools">
          {PAINT_TOOLS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`as-paint-tool${tool === t.id ? ' active' : ''}`}
              title={t.label}
              disabled={disabled}
              onClick={() => onToolChange(t.id)}
            >
              <span className="as-paint-tool__icon">{t.icon}</span>
              <span className="as-paint-tool__label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="as-paint-toolbar__row as-paint-toolbar__colors-row">
        <ColorPickerPanel
          label="Màu vẽ"
          color={brushColor}
          onChange={onBrushColorChange}
          disabled={disabled}
        />
        <ColorPickerPanel
          label="Màu tô / hình"
          color={fillColor}
          onChange={onFillColorChange}
          disabled={disabled}
        />
      </div>

      <div className="as-paint-toolbar__row as-paint-toolbar__sliders">
        <label className="as-paint-slider">
          <span>Cỡ nét: <strong>{brushSize}px</strong></span>
          <input
            type="range"
            min={1}
            max={64}
            value={brushSize}
            disabled={disabled}
            onChange={e => onBrushSizeChange(Number(e.target.value))}
          />
        </label>
        <div className="as-paint-size-presets">
          {BRUSH_SIZE_PRESETS.map(s => (
            <button
              key={s}
              type="button"
              className={brushSize === s ? 'active' : ''}
              disabled={disabled}
              onClick={() => onBrushSizeChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="as-paint-slider">
          <span>Độ đậm: <strong>{brushOpacity}%</strong></span>
          <input
            type="range"
            min={10}
            max={100}
            value={brushOpacity}
            disabled={disabled}
            onChange={e => onBrushOpacityChange(Number(e.target.value))}
          />
        </label>
        <label className="as-paint-fill-toggle">
          <input
            type="checkbox"
            checked={shapeFilled}
            disabled={disabled}
            onChange={e => onShapeFilledChange(e.target.checked)}
          />
          Tô kín hình (chữ nhật / elip)
        </label>
      </div>
    </div>
  )
}
