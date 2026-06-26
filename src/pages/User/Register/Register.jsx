import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Phone } from 'lucide-react'
import Header from '@/components/User/Header/Header.jsx'
import Footer from '@/components/User/Footer/Footer.jsx'
import { AuthShell, RoleCard } from '@/components/layout/AuthShell.jsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ROLES, ROLE_OPTIONS, register, getRolePath } from '@/lib/auth.js'
import '@/components/layout/AuthForm.css'

const NAV_LINKS = [{ to: '/', label: 'Trang chủ' }]

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: ROLES.MANGAKA,
  })
  const [agree, setAgree] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    if (error) setError('')
  }

  function validate() {
    if (!form.name.trim()) return 'Vui lòng nhập họ tên.'
    if (!form.username.trim()) return 'Vui lòng nhập tên đăng nhập.'
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(form.username.trim())) {
      return 'Tên đăng nhập: 3–32 ký tự, chỉ chữ, số và dấu gạch dưới.'
    }
    if (!form.email.trim()) return 'Vui lòng nhập email.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email không hợp lệ.'
    if (form.phone.trim()) {
      const phone = form.phone.replace(/[\s.-]/g, '')
      if (!/^(0|\+84)\d{9,10}$/.test(phone)) {
        return 'Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678).'
      }
    }
    if (!form.role) return 'Vui lòng chọn vai trò.'
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
        role: form.role,
      })
      navigate(getRolePath(user.role))
    } catch (err) {
      setError(err?.message ?? 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header links={NAV_LINKS} />
      <AuthShell
        variant="register"
        title="Tham gia MangaHub"
        subtitle="Đăng ký Mangaka hoặc Assistant. Tantou Editor / Editor Board do Admin cấp tài khoản."
        footer={
          <p className="text-center text-sm text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Đăng nhập
            </Link>
          </p>
        }
      >
        <div className="auth-form-card">
          <div className="auth-form-card__head">
            <h2>Đăng ký</h2>
            <p>Chọn vai trò và điền thông tin tài khoản.</p>
          </div>

          <div className="auth-form-card__body">
            {error ? (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <section className="auth-form__section">
                <p className="auth-form__section-title">Vai trò của bạn</p>
                <div className="auth-form__roles">
                  {ROLE_OPTIONS.map(opt => (
                    <RoleCard
                      key={opt.value}
                      value={opt.value}
                      active={form.role === opt.value}
                      icon={opt.icon}
                      title={opt.title}
                      desc={opt.desc}
                      onSelect={() => setField('role', opt.value)}
                    />
                  ))}
                </div>
              </section>

              <section className="auth-form__section">
                <div className="auth-form__fields">
                  <div className="auth-form__field">
                    <label htmlFor="reg-name">Họ và tên</label>
                    <Input
                      id="reg-name"
                      className="auth-form__input placeholder:text-muted-foreground/45"
                      autoComplete="name"
                      placeholder="Nguyễn Văn A"
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                    />
                  </div>

                  <div className="auth-form__field">
                    <label htmlFor="reg-username">Tên đăng nhập</label>
                    <Input
                      id="reg-username"
                      className="auth-form__input placeholder:text-muted-foreground/45"
                      autoComplete="username"
                      placeholder="bao123"
                      value={form.username}
                      onChange={e => setField('username', e.target.value.replace(/\s/g, ''))}
                    />
                  </div>

                  <div className="auth-form__field">
                    <label htmlFor="reg-email">Email</label>
                    <Input
                      id="reg-email"
                      className="auth-form__input placeholder:text-muted-foreground/45"
                      type="email"
                      autoComplete="email"
                      placeholder="ban@example.com"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                    />
                  </div>

                  <div className="auth-form__field">
                    <label htmlFor="reg-phone">
                      Số điện thoại <span className="text-muted-foreground">(tuỳ chọn)</span>
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reg-phone"
                        className="auth-form__input pl-9 placeholder:text-muted-foreground/45"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="0912345678"
                        value={form.phone}
                        onChange={e => setField('phone', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="auth-form__row auth-form__row--2">
                    <div className="auth-form__field">
                      <label htmlFor="reg-password">Mật khẩu</label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          className="auth-form__input pr-10 placeholder:text-muted-foreground/45"
                          type={showPass ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Tối thiểu 6 ký tự"
                          value={form.password}
                          onChange={e => setField('password', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1/2 right-1 -translate-y-1/2"
                          onClick={() => setShowPass(v => !v)}
                        >
                          {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="auth-form__field">
                      <label htmlFor="reg-confirm">Xác nhận mật khẩu</label>
                      <div className="relative">
                        <Input
                          id="reg-confirm"
                          className="auth-form__input pr-10 placeholder:text-muted-foreground/45"
                          type={showConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Nhập lại"
                          value={form.confirmPassword}
                          onChange={e => setField('confirmPassword', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute top-1/2 right-1 -translate-y-1/2"
                          onClick={() => setShowConfirm(v => !v)}
                        >
                          {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <label className="auth-form__check">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={e => setAgree(e.target.checked)}
                />
                <span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật.</span>
              </label>

              <Button type="submit" className="auth-form__submit" disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đăng ký'}
              </Button>
            </form>
          </div>
        </div>
      </AuthShell>
      <Footer />
    </div>
  )
}
