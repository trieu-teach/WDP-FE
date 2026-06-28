import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { AuthBoxField, AuthSplitLayout } from '@/components/layout/AuthSplitLayout.jsx'
import { getSession, getRolePath, login } from '@/lib/auth.js'

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
      navigate(typeof from === 'string' ? from : getRolePath(user.role), { replace: true })
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
      const from = location.state?.from
      navigate(typeof from === 'string' ? from : getRolePath(user.role))
    } catch (err) {
      setError(err?.message ?? 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplitLayout
      title={(
        <>
          Chào mừng
          <br />
          trở lại!
        </>
      )}
      subtitle="Đăng nhập để tiếp tục trải nghiệm MangaHub."
    >
      <div className="auth-split-box">
        <h2>Đăng nhập</h2>

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
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập ngay'}
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
