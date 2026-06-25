import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { cooperationService } from '@/api/cooperation.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import {
  apiAssistantToCatalog,
  apiCooperationToRosterEntry,
  apiRequestToUi,
  isPendingRequest,
} from '@/utils/cooperationMappers.js'

export function useMangakaCooperation() {
  const [roster, setRoster] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [assistants, setAssistants] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [coops, requests, allAssistants] = await Promise.all([
        cooperationService.getMangakaCooperations(),
        cooperationService.getSentRequests(),
        cooperationService.getAllAssistants(),
      ])
      console.debug('[COOP] raw mangaka cooperations', coops)
      console.debug('[COOP] raw sent requests', requests)
      setRoster((Array.isArray(coops) ? coops : []).map(apiCooperationToRosterEntry))
      setSentRequests((Array.isArray(requests) ? requests : []).map(apiRequestToUi))
      setAssistants(Array.isArray(allAssistants) ? allAssistants : [])
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được dữ liệu hợp tác.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const catalog = useMemo(() => {
    const coopIds = new Set(roster.map(r => String(r.assistantId)))
    const pendingIds = new Set(
      sentRequests.filter(r => isPendingRequest(r.status) || r.status === 'accepted_meet')
        .map(r => String(r.assistantId)),
    )

    return assistants.map(user => {
      const profile = apiAssistantToCatalog(user)
      const assistantKey = profile.accountId ? String(profile.accountId) : null
      let availability = 'unavailable'
      if (assistantKey && coopIds.has(assistantKey)) availability = 'mine'
      else if (assistantKey && pendingIds.has(assistantKey)) availability = 'pending'
      else if (assistantKey) availability = 'available'

      const pendingRequest = sentRequests.find(
        r => String(r.assistantId) === assistantKey && isPendingRequest(r.status),
      ) ?? null

      return {
        ...profile,
        availability,
        pendingRequest,
        rosterEntry: roster.find(r => String(r.assistantId) === assistantKey) ?? null,
      }
    })
  }, [assistants, roster, sentRequests])

  const assignees = roster
    .filter(r => r.assistantId)
    .map(r => ({
      label: r.name,
      assistantId: String(r.assistantId),
    }))

  async function sendHireRequest({ assistantId, message, seriesId }) {
    await cooperationService.sendRequest({
      assistant_id: assistantId,
      message,
      series_id: seriesId,
    })
    await refresh()
  }

  return {
    roster,
    sentRequests,
    catalog,
    assignees,
    loading,
    refresh,
    sendHireRequest,
  }
}
