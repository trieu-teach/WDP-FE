import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { AuthBoxField, AuthSplitLayout } from '@/components/layout/AuthSplitLayout.jsx'
import { getSession, login } from '@/lib/auth.js'
import { queueWelcomeBack } from '@/utils/welcomeBackStorage.js'

export { ROLES, ROLE_OPTIONS, ROLE_LABELS, getRolePath, getSession, logout, login, register } from '@/lib/auth.js'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [remember, setRemember] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getSession()
    if (user) {
      const from = location.state?.from
      navigate(typeof from === 'string' ? from : '/', { replace: true })
      return
    }
    const saved = sessionStorage.getItem('rememberEmail')
    if (saved) setForm((f) => ({ ...f, email: saved }))
  }, [navigate, location.state])

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    if (error) setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Vui lòng nhập tên đăng nhập/email và mật khẩu.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const user = await login(form.email, form.password)
      if (remember) sessionStorage.setItem('rememberEmail', form.email.trim())
      else sessionStorage.removeItem('rememberEmail')
      queueWelcomeBack({
        name: user.name || user.username || 'MangaHub',
        avatarUrl: user.avatarUrl || '',
      })
      navigate('/')
    } catch (err) {
      setError(err?.message ?? 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplitLayout
      title="Không gian sáng tạo manga"
      subtitle="Đăng nhập để tiếp tục series, phối hợp Assistant và đẩy chapter lên biên tập."
      heroEyebrow="MangaHub"
      heroCaption="Mangaka · Assistant · Editorial"
    >
      <div className="auth-split-box">
        <div className="auth-split-greeting">
          <h2>Chào mừng trở lại</h2>
          <p>Đăng nhập để vào MangaHub</p>
        </div>

        {error ? (
          <div className="auth-split-error" role="alert" aria-live="polite">
            {error}
          </div>
        ) : null}

        <form className="auth-login-form" onSubmit={handleSubmit} noValidate>
          <AuthBoxField
            id="login-email"
            label="Tên đăng nhập hoặc email"
            autoComplete="username"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            required
          />

          <AuthBoxField
            id="login-password"
            label="Mật khẩu"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            required
            toggle={(
              <button
                type="button"
                className="auth-box-field__toggle"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          />

          <label className="auth-split-check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Ghi nhớ email
          </label>

          <button type="submit" className="auth-split-btn" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <div className="auth-split-links">
            <p>
              Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
            </p>
          </div>
        </form>
      </div>
    </AuthSplitLayout>
  )
}
