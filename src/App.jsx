import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import Layout from '@/components/Admin/Layout/Layout.jsx'
import Dashboard from '@/pages/Admin/Dashboard/Dashboard.jsx'
import AdminManga from '@/pages/Admin/Manga/Manga.jsx'
import Chapters from '@/pages/Admin/Chapters/Chapters.jsx'
import Users from '@/pages/Admin/Users/Users.jsx'
import Profile from '@/pages/Admin/Profile/Profile.jsx'
import EbRepresentative from '@/pages/Admin/EbRepresentative/EbRepresentative.jsx'
import Home from '@/pages/User/Home/Home.jsx'
import Login from '@/pages/User/Login/Login.jsx'
import Register from '@/pages/User/Register/Register.jsx'
import RegisterVerifyOtp from '@/pages/User/Register/RegisterVerifyOtp.jsx'
import Mangaka from '@/pages/User/Mangaka/Mangaka.jsx'
import SeriesUploadDetail from '@/pages/User/Mangaka/SeriesUploadDetail.jsx'
import Assistant from '@/pages/User/Assistant/Assistant.jsx'
import UserProfile from '@/pages/User/Profile/Profile.jsx'
import Eb from '@/pages/User/Eb/Eb.jsx'
import TantouEditor from '@/pages/User/Tantou/TantouEditor.jsx'
import SessionBootstrap from '@/components/auth/SessionBootstrap.jsx'

function AdminShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const activePage = location.pathname.split('/').pop() || 'dashboard'

  return (
    <Layout activePage={activePage} onNavigate={id => navigate(`/admin/${id}`)}>
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
        <Route path="/mangaka/series/:seriesSlug" element={<SeriesUploadDetail />} />
        <Route path="/mangaka/series/:seriesSlug/chapter/:chapterId" element={<SeriesUploadDetail />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/eb" element={<Eb />} />
        <Route path="/tantou" element={<TantouEditor />} />
        <Route path="/profile" element={<UserProfile />} />

        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="manga" element={<AdminManga />} />
          <Route path="chapters" element={<Chapters />} />
          <Route path="users" element={<Users />} />
          <Route path="eb-representative" element={<EbRepresentative />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-center" />
    </BrowserRouter>
  )
}
