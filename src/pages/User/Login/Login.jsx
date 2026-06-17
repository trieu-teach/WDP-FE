import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { AuthShell } from '@/components/layout/AuthShell.jsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getSession, getRolePath, login } from '@/lib/auth.js'
import '@/components/layout/AuthForm.css'

const NAV_LINKS = [{ to: '/', label: 'Trang chủ' }]

export { ROLES, ROLE_OPTIONS, ROLE_LABELS, getRolePath, getSession, logout, login, register } from '@/lib/auth.js'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [remember, setRemember] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getSession()
    if (user) {
      navigate(getRolePath(user.role), { replace: true })
      return
    }
    const saved = sessionStorage.getItem('rememberEmail')
    if (saved) setForm(f => ({ ...f, email: saved }))
  }, [navigate])

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
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
      navigate(getRolePath(user.role))
    } catch (err) {
      setError(err?.message ?? 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header links={NAV_LINKS} />
      <AuthShell
        title="Đăng nhập workspace"
        subtitle="Đăng nhập bằng tên đăng nhập hoặc email đã đăng ký."
        footer={
          <p className="text-center text-sm text-muted-foreground">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
              Đăng ký
            </Link>
          </p>
        }
      >
        <div className="auth-form-card">
          <div className="auth-form-card__head">
            <h2>Đăng nhập</h2>
            <p>Dùng tên đăng nhập hoặc email của bạn.</p>
          </div>

          <div className="auth-form-card__body">
            {error ? (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <section className="auth-form__section">
                <div className="auth-form__fields">
                  <div className="auth-form__field">
                    <label htmlFor="login-email">Tên đăng nhập hoặc email</label>
                    <Input
                      id="login-email"
                      className="auth-form__input placeholder:text-muted-foreground/45"
                      type="text"
                      autoComplete="username"
                      placeholder="bao123 hoặc ban@example.com"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                    />
                  </div>

                  <div className="auth-form__field">
                    <label htmlFor="login-password">Mật khẩu</label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        className="auth-form__input pr-10 placeholder:text-muted-foreground/45"
                        type={showPass ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={form.password}
                        onChange={e => setField('password', e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1/2 right-1 -translate-y-1/2"
                        onClick={() => setShowPass(v => !v)}
                        aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              <label className="auth-form__check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                <span>Ghi nhớ tài khoản</span>
              </label>

              <Button type="submit" className="auth-form__submit" disabled={loading}>
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          </div>
        </div>
      </AuthShell>
      <Footer />
    </div>
  )
}
