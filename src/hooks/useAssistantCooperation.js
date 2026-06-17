import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cooperationService } from '@/api/cooperation.service.js'
import { getApiErrorMessage } from '@/api/http.js'
import {
  apiAssistantCooperationToUi,
  apiRequestToUi,
  isMeetingPhase,
  isPendingRequest,
} from '@/utils/cooperationMappers.js'

export function useAssistantCooperation() {
  const [incoming, setIncoming] = useState([])
  const [cooperations, setCooperations] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [requests, coops] = await Promise.all([
        cooperationService.getIncomingRequests(),
        cooperationService.getAssistantCooperations(),
      ])
      setIncoming((Array.isArray(requests) ? requests : []).map(apiRequestToUi))
      setCooperations((Array.isArray(coops) ? coops : []).map(apiAssistantCooperationToUi))
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không tải được yêu cầu hợp tác.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const actionable = incoming.filter(
    r => isPendingRequest(r.status) || isMeetingPhase(r.status),
  )

  async function acceptMeet(requestId) {
    await cooperationService.acceptMeet(requestId)
    await refresh()
  }

  async function rejectRequest(requestId) {
    await cooperationService.rejectRequest(requestId)
    await refresh()
  }

  async function acceptCooperation(requestId) {
    await cooperationService.acceptCooperation(requestId)
    await refresh()
  }

  async function declineCooperation(requestId) {
    await cooperationService.declineCooperation(requestId)
    await refresh()
  }

  return {
    incoming,
    actionable,
    cooperations,
    loading,
    refresh,
    acceptMeet,
    rejectRequest,
    acceptCooperation,
    declineCooperation,
  }
}
