import { layerAccentColor } from '../../constants/paintPalette.js'
import './LayersPanel.css'

export default function LayersPanel({
  layers,
  activeLayerId,
  paintLayers,
  onSelectLayer,
  onToggleVisible,
  onRemoveLayer,
  onClearLayer,
  onAddLayer,
  activeLayerIsPaint,
}) {
  return (
    <div className="as-layers-panel">
      <div className="as-layers-panel__head">
        <h3>Layers</h3>
        <button type="button" className="as-layers-panel__add" onClick={onAddLayer}>
          + Thêm
        </button>
      </div>

      <ul className="as-layers-list">
        {[...layers].reverse().map(layer => {
          const isActive = activeLayerId === layer.id
          const accent =
            layer.type === 'paint' ? layerAccentColor(layer.id, paintLayers) : '#8a8782'
          const isPaint = layer.type === 'paint'

          return (
            <li
              key={layer.id}
              className={[
                'as-layer-row',
                layer.locked ? 'as-layer-row--locked' : '',
                isActive ? 'as-layer-row--active' : '',
                !layer.visible ? 'as-layer-row--hidden' : '',
              ].filter(Boolean).join(' ')}
              style={isActive ? { '--layer-accent': accent } : undefined}
            >
              {isActive ? <span className="as-layer-row__accent" aria-hidden /> : null}

              <button
                type="button"
                className="as-layer-row__vis"
                disabled={layer.locked}
                aria-label={layer.visible ? 'Ẩn layer' : 'Hiện layer'}
                onClick={() => onToggleVisible(layer.id)}
              >
                {layer.visible ? '👁' : '👁‍🗨'}
              </button>

              <button
                type="button"
                className="as-layer-row__main"
                disabled={!isPaint}
                onClick={() => isPaint && onSelectLayer(layer.id)}
              >
                <span className="as-layer-row__icon" aria-hidden>
                  {layer.type === 'base' ? '🖼' : layer.type === 'notes' ? '📝' : '✏️'}
                </span>
                <span className="as-layer-row__text">
                  <span className="as-layer-row__name">{layer.name}</span>
                  {isActive ? <span className="as-layer-row__badge">Đang dùng</span> : null}
                </span>
              </button>

              {layer.locked ? (
                <span className="as-layer-row__lock" title="Khóa">🔒</span>
              ) : isPaint ? (
                <button
                  type="button"
                  className="as-layer-row__del"
                  title="Xóa layer"
                  onClick={() => onRemoveLayer(layer.id)}
                >
                  ×
                </button>
              ) : (
                <span className="as-layer-row__spacer" />
              )}
            </li>
          )
        })}
      </ul>

      {activeLayerIsPaint ? (
        <div className="as-layers-panel__actions">
          <button type="button" className="as-layers-panel__clear" onClick={onClearLayer}>
            Xóa nét trên layer
          </button>
          <button
            type="button"
            className="as-layers-panel__delete"
            onClick={() => onRemoveLayer(activeLayerId)}
          >
            Xóa cả layer
          </button>
        </div>
      ) : null}
    </div>
  )
}
