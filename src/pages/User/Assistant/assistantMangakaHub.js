const AVATAR_COLORS = ['#8b5cf6', '#0ea5e9', '#f97316', '#ec4899', '#10b981', '#6366f1']

export function mangakaAvatarColor(id) {
  const key = String(id ?? '')
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash + key.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0]
}

export function mangakaInitials(name) {
  const parts = String(name ?? 'M').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
  }
  return String(name ?? 'M').slice(0, 2).toUpperCase()
}

export function resolveAssignmentMangakaId(assignment, task, cooperations) {
  const assignedBy = task?.assignedBy ? String(task.assignedBy) : null
  if (assignedBy && cooperations.some(c => String(c.mangakaId) === assignedBy)) {
    return assignedBy
  }
  if (cooperations.length === 1) {
    return String(cooperations[0].mangakaId)
  }
  if (assignedBy) return assignedBy
  if (cooperations.length > 0) {
    return String(cooperations[0].mangakaId)
  }
  return 'default'
}

export function buildMangakaOptions(cooperations, assignments, chapterTaskMap) {
  const map = new Map()

  for (const c of cooperations) {
    const id = String(c.mangakaId)
    if (!id) continue
    map.set(id, {
      id,
      name: c.mangakaName || 'Mangaka',
      cooperationId: c.id,
    })
  }

  for (const a of assignments) {
    const task = chapterTaskMap[String(a.chapterId)] ?? a._task ?? null
    const mid = resolveAssignmentMangakaId(a, task, cooperations)
    if (!map.has(mid)) {
      map.set(mid, { id: mid, name: 'Mangaka', cooperationId: null })
    }
  }

  if (map.size === 0 && assignments.length > 0) {
    map.set('default', { id: 'default', name: 'Mangaka đã giao việc', cooperationId: null })
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

export function enrichAssignments(assignments, chapterTaskMap, cooperations) {
  return (assignments ?? []).map(a => {
    const task = chapterTaskMap[String(a.chapterId)] ?? a._task ?? null
    const mangakaId = resolveAssignmentMangakaId(a, task, cooperations)
    return { ...a, _task: task, _mangakaId: mangakaId }
  })
}

export function groupAssignmentsByWorkStatus(list) {
  const received = []
  const sent = []
  const revision = []

  for (const item of list) {
    const status = item._task?.status ?? item.status ?? 'pending'
    if (status === 'revision') {
      revision.push(item)
    } else if (status === 'submitted' || status === 'approved') {
      sent.push(item)
    } else {
      received.push(item)
    }
  }

  return { received, sent, revision }
}

export function countMangakaWork(list) {
  const { received, sent, revision } = groupAssignmentsByWorkStatus(list)
  return {
    received: received.length,
    sent: sent.length,
    revision: revision.length,
    total: list.length,
  }
}
