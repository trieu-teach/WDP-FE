import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Layout from '@/components/Admin/Layout/Layout.jsx'
import Dashboard from '@/pages/Admin/Dashboard/Dashboard.jsx'
import AdminManga from '@/pages/Admin/Manga/Manga.jsx'
import Chapters from '@/pages/Admin/Chapters/Chapters.jsx'
import Users from '@/pages/Admin/Users/Users.jsx'
import Profile from '@/pages/Admin/Profile/Profile.jsx'
import Rankings from '@/pages/Admin/Rankings/Rankings.jsx'
import Finance from '@/pages/Admin/Finance/Finance.jsx'
import AdminWithdrawals from '@/pages/Admin/Withdrawals/AdminWithdrawals.jsx'
import PublicationCalendar from '@/pages/Admin/PublicationCalendar/PublicationCalendar.jsx'
import EndRequests from '@/pages/Admin/EndRequests/EndRequests.jsx'
import AdminNotifications from '@/pages/Admin/Notifications/AdminNotifications.jsx'
import Home from '@/pages/User/Home/Home.jsx'
import Login from '@/pages/User/Login/Login.jsx'
import Register from '@/pages/User/Register/Register.jsx'
import RegisterVerifyOtp from '@/pages/User/Register/RegisterVerifyOtp.jsx'
import Mangaka from '@/pages/User/Mangaka/Mangaka.jsx'
import SeriesUploadDetail from '@/pages/User/Mangaka/SeriesUploadDetail.jsx'
import Assistant from '@/pages/User/Assistant/Assistant.jsx'
import UserProfile from '@/pages/User/Profile/Profile.jsx'
import Eb from '@/pages/User/Eb/Eb.jsx'
import EbSeriesDetail from '@/pages/User/Eb/EbSeriesDetail.jsx'
import EbPublish from '@/pages/User/Eb/EbPublish.jsx'
import EbCouncilDecision from '@/pages/User/Eb/EbCouncilDecision.jsx'
import EbPublicationSchedule from '@/pages/User/Eb/EbPublicationSchedule.jsx'
import EbHistory from '@/pages/User/Eb/EbHistory.jsx'
import EbHistoryDetail from '@/pages/User/Eb/EbHistoryDetail.jsx'
import MangakaTeRevision from '@/pages/User/Mangaka/MangakaTeRevision.jsx'
import MangakaAssistantReview from '@/pages/User/Mangaka/MangakaAssistantReview.jsx'
import MangakaAssistantReviewDetail from '@/pages/User/Mangaka/MangakaAssistantReviewDetail.jsx'
import MangakaProfile from '@/pages/User/Mangaka/MangakaProfile.jsx'
import MangakaEndRequests from '@/pages/User/Mangaka/MangakaEndRequests.jsx'
import AssistantProfile from '@/pages/User/Assistant/AssistantProfile.jsx'
import TantouHub from '@/pages/User/Tantou/TantouHub.jsx'
import TantouEditor from '@/pages/User/Tantou/TantouEditor.jsx'
import SessionBootstrap from '@/components/auth/SessionBootstrap.jsx'
import { seriesEndRequestsService } from '@/api/seriesEndRequests.service.js'
import { notificationsService } from '@/api/notifications.service.js'
import { mapAdminNotificationStats } from '@/utils/adminNotificationMappers.js'

function AdminShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathParts = location.pathname.split('/').filter(Boolean)
  const activePage =
    pathParts[0] === 'admin' && pathParts[1]
      ? pathParts[1]
      : 'dashboard'
  const [endRequestPending, setEndRequestPending] = useState(0)
  const [notificationUnread, setNotificationUnread] = useState(0)

  const refreshEndRequestBadge = useCallback(() => {
    seriesEndRequestsService
      .adminList({ status: 'pending', page: 1, limit: 1 })
      .then((res) => setEndRequestPending(Number(res.total ?? 0) || 0))
      .catch(() => setEndRequestPending(0))
  }, [])

  const refreshNotificationBadge = useCallback(() => {
    notificationsService
      .adminStats()
      .then((raw) => {
        const stats = mapAdminNotificationStats(raw)
        setNotificationUnread(Number(stats.unread) || 0)
      })
      .catch(() => setNotificationUnread(0))
  }, [])

  useEffect(() => {
    refreshEndRequestBadge()
    refreshNotificationBadge()
    const timer = window.setInterval(() => {
      refreshEndRequestBadge()
      refreshNotificationBadge()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [refreshEndRequestBadge, refreshNotificationBadge, location.pathname])

  return (
    <Layout
      activePage={activePage}
      onNavigate={id => navigate(`/admin/${id}`)}
      navBadges={{
        'end-requests': endRequestPending,
        notifications: notificationUnread,
      }}
    >
      <Outlet />
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/verify-otp" element={<RegisterVerifyOtp />} />
        <Route path="/mangaka" element={<Mangaka />} />
        <Route path="/mangaka/profile" element={<MangakaProfile />} />
        <Route path="/mangaka/profile/:authorId" element={<MangakaProfile />} />
        <Route path="/mangaka/review" element={<MangakaAssistantReview />} />
        <Route path="/mangaka/review/chapter/:chapterId" element={<MangakaAssistantReviewDetail />} />
        <Route path="/mangaka/end-requests" element={<MangakaEndRequests />} />
        <Route path="/mangaka/series/:seriesSlug" element={<SeriesUploadDetail />} />
        <Route path="/mangaka/series/:seriesSlug/chapter/:chapterId" element={<SeriesUploadDetail />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/assistant/profile" element={<AssistantProfile />} />
        <Route path="/assistant/profile/:authorId" element={<AssistantProfile />} />
        <Route path="/eb" element={<Eb />} />
        <Route path="/eb/series/:seriesId" element={<EbSeriesDetail />} />
        <Route path="/eb/chapter/:chapterId" element={<Eb />} />
        <Route path="/eb/chapter/:chapterId/decision" element={<EbCouncilDecision />} />
        <Route path="/eb/chapter/:chapterId/publish" element={<EbPublish />} />
        <Route path="/eb/schedule" element={<EbPublicationSchedule />} />
        <Route path="/eb/history" element={<EbHistory />} />
        <Route path="/eb/history/:evaluationId" element={<EbHistoryDetail />} />
        <Route path="/mangaka/chapter/:chapterId/te-revision" element={<MangakaTeRevision />} />
        <Route path="/tantou" element={<TantouHub />} />
        <Route path="/tantou/:section" element={<TantouEditor />} />
        <Route path="/profile" element={<UserProfile />} />

        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="rankings" element={<Rankings />} />
          <Route path="finance" element={<Finance />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="publication-calendar" element={<PublicationCalendar />} />
          <Route path="manga" element={<AdminManga />} />
          <Route path="chapters" element={<Chapters />} />
          <Route path="users" element={<Users />} />
          <Route path="end-requests" element={<EndRequests />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-center" />
    </BrowserRouter>
  )
}
