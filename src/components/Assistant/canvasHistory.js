import { util } from 'fabric'

const MAX_STEPS = 50

export function createCanvasHistory() {
  let stack = [[]]
  let index = 0
  let restoring = false

  function snapshot(canvas) {
    return canvas
      .getObjects()
      .filter(o => o.layerType === 'paint')
      .map(o => o.toObject(['layerId', 'layerType']))
  }

  async function applySnapshot(canvas, snap) {
    restoring = true
    canvas.getObjects().filter(o => o.layerType === 'paint').forEach(o => canvas.remove(o))
    if (snap.length > 0) {
      const objs = await util.enlivenObjects(snap)
      objs.forEach(o => {
        canvas.add(o)
      })
    }
    canvas.requestRenderAll()
    restoring = false
  }

  return {
    isRestoring: () => restoring,
    reset(canvas) {
      stack = [snapshot(canvas)]
      index = 0
      return getState()
    },
    push(canvas) {
      if (restoring) return getState()
      const snap = snapshot(canvas)
      const prev = stack[index]
      const same = JSON.stringify(prev) === JSON.stringify(snap)
      if (same) return getState()

      stack = stack.slice(0, index + 1)
      stack.push(snap)
      if (stack.length > MAX_STEPS) {
        stack.shift()
      } else {
        index += 1
      }
      return getState()
    },
    async undo(canvas) {
      if (index <= 0) return getState()
      index -= 1
      await applySnapshot(canvas, stack[index])
      return getState()
    },
    async redo(canvas) {
      if (index >= stack.length - 1) return getState()
      index += 1
      await applySnapshot(canvas, stack[index])
      return getState()
    },
    getState,
  }

  function getState() {
    return {
      canUndo: index > 0,
      canRedo: index < stack.length - 1,
    }
  }
}
