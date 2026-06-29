/**
 * LUỒNG 2 — Bước 1: POST /chapters (multipart)
 * pages[i].image, note, work_type, assigned_to, x, y, w, h
 */

export function appendChapterPagesToFormData(formData, pageItems, options = {}) {
  const { assistantId } = options
  const list = Array.isArray(pageItems) ? pageItems : []

  list.forEach((item, i) => {
    const file = item?.file ?? item?.image ?? null
    if (file) formData.append(`pages[${i}].image`, file)

    const note = String(item?.note ?? item?.text ?? ' ').trim() || ' '
    formData.append(`pages[${i}].note`, note)
    formData.append(`pages[${i}].work_type`, item?.workType ?? item?.work_type ?? 'other')

    const assignee = item?.assignedTo ?? item?.assigned_to ?? assistantId
    if (assignee) formData.append(`pages[${i}].assigned_to`, String(assignee))

    formData.append(`pages[${i}].x`, String(item?.x ?? 0))
    formData.append(`pages[${i}].y`, String(item?.y ?? 0))
    formData.append(`pages[${i}].w`, String(item?.w ?? 100))
    formData.append(`pages[${i}].h`, String(item?.h ?? 100))
  })

  return formData
}

export function filesToChapterPageItems(files, assistantId = null) {
  return Array.from(files ?? []).map((file) => ({
    file,
    note: ' ',
    workType: 'other',
    assignedTo: assistantId,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
  }))
}
