import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { AuthBoxField, AuthSplitLayout } from '@/components/layout/AuthSplitLayout.jsx'
import { ROLES, register, getRolePath, getSession } from '@/lib/auth.js'
import './Register.css'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [agree, setAgree] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getSession()
    if (user) {
      navigate(getRolePath(user.role), { replace: true })
    }
  }, [navigate])

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    if (error) setError('')
  }

  function validate() {
    if (!form.name.trim()) return 'Vui lòng nhập họ tên.'
    if (!form.username.trim()) return 'Vui lòng nhập tên đăng nhập.'
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(form.username.trim())) {
      return 'Tên đăng nhập: 3–32 ký tự, chỉ chữ, số và dấu gạch dưới.'
    }
    if (!form.email.trim()) return 'Vui lòng nhập email.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Email không hợp lệ.'
    }
    if (form.phone.trim()) {
      const phone = form.phone.replace(/[\s.-]/g, '')
      if (!/^(0|\+84)\d{9,10}$/.test(phone)) {
        return 'Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678).'
      }
    }
    if (form.password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.'
    if (form.password !== form.confirmPassword) return 'Mật khẩu xác nhận không khớp.'
    if (!agree) return 'Bạn cần đồng ý với điều khoản sử dụng.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const msg = validate()
    if (msg) {
      setError(msg)
      return
    }

    setLoading(true)
    setError('')

    const email = form.email.trim().toLowerCase()
    const username = form.username.trim()

    try {
      const user = await register({
        username,
        name: form.name,
        email,
        phone: form.phone,
        password: form.password,
        role: ROLES.MANGAKA,
      })
      navigate(getRolePath(user.role))
    } catch (err) {
      setError(err?.message ?? 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplitLayout
      variant="register"
      title="Bắt đầu hành trình"
      subtitle="Đăng ký tài khoản Mangaka để tạo series và phối hợp trên MangaHub."
      heroEyebrow="MangaHub"
      heroCaption="Tạo series · Giao việc · Xuất bản"
    >
      <div className="auth-split-box auth-split-box--register">
        <div className="auth-split-greeting">
          <h2>Tạo tài khoản</h2>
          <p>Đăng ký Mangaka để bắt đầu làm việc trên MangaHub</p>
        </div>

        {error ? (
          <div className="auth-split-error" role="alert" aria-live="polite">
            {error}
          </div>
        ) : null}

        <form className="auth-register-form" onSubmit={handleSubmit} noValidate>
          <section className="auth-register-section">
            <p className="auth-register-section__title">Thông tin tài khoản</p>
            <div className="auth-register-grid">
              <AuthBoxField
                id="reg-name"
                label="Họ và tên"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />

              <AuthBoxField
                id="reg-username"
                label="Tên đăng nhập"
                autoComplete="username"
                value={form.username}
                onChange={(e) => setField('username', e.target.value.replace(/\s/g, ''))}
                required
              />

              <AuthBoxField
                id="reg-email"
                label="Email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                required
              />

              <AuthBoxField
                id="reg-phone"
                label="Số điện thoại"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                optional
              />
            </div>
          </section>

          <section className="auth-register-section">
            <div className="auth-register-grid auth-register-grid--password">
              <AuthBoxField
                id="reg-password"
                label="Mật khẩu"
                type={showPass ? 'text' : 'password'}
                autoComplete="new-password"
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

              <AuthBoxField
                id="reg-confirm"
                label="Xác nhận mật khẩu"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                required
                toggle={(
                  <button
                    type="button"
                    className="auth-box-field__toggle"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                )}
              />
            </div>
          </section>

          <label className="auth-split-check auth-split-check--legal auth-register-agree">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>
              Tôi đồng ý với{' '}
              <span className="auth-split-legal" title="Nội dung sắp cập nhật">
                Điều khoản sử dụng
              </span>
              {' '}và{' '}
              <span className="auth-split-legal" title="Nội dung sắp cập nhật">
                Chính sách bảo mật
              </span>
              .
            </span>
          </label>

          <button type="submit" className="auth-split-btn auth-register-submit" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng ký ngay'}
          </button>

          <div className="auth-split-links auth-register-links">
            <p>
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </p>
          </div>
        </form>
      </div>
    </AuthSplitLayout>
  )
}
