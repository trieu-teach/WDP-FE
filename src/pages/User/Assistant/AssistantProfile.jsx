import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Briefcase,
  Edit,
  ExternalLink,
  Globe,
  Heart,
  Link2,
  Loader2,
  Save,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import Header from '@/components/User/Header/Header.jsx'
import WalletTab from '@/components/Wallet/WalletTab.jsx'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AvatarCropDialog } from '@/components/mangaka/AvatarCropDialog.jsx'
import { CoverCropDialog } from '@/components/mangaka/CoverCropDialog.jsx'
import { getApiErrorMessage, resolveMediaUrl } from '@/api/http.js'
import {
  fileToBase64 as fileToAvatarBase64,
  assistantProfileService,
} from '@/api/assistantProfile.service.js'
import { getSession, logout, refreshSession, updateSession, ROLES } from '@/lib/auth.js'
import { cn } from '@/lib/utils'
import '../Mangaka/MangakaProfile.css'

const BIO_MAX = 500

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/assistant', label: 'Workspace' },
]

function emptySocialLinks() {
  return { facebook: '', twitter: '', website: '' }
}

function emptyForm() {
  return {
    fullName: '',
    email: '',
    username: '',
    avatarUrl: '',
    avatarBase64: '',
    coverImageUrl: '',
    coverImageBase64: '',
    bio: '',
    socialLinks: emptySocialLinks(),
  }
}

function withAvatarCacheBust(url) {
  const value = String(url ?? '').trim()
  if (!value || /^(data:|blob:)/i.test(value)) return value
  const bare = value.split('#')[0].split('?')[0]
  return `${bare}?t=${Date.now()}`
}

function mapSocialLinks(raw, fallback) {
  const links = raw && typeof raw === 'object' ? raw : {}
  const fb = fallback && typeof fallback === 'object' ? fallback : {}
  return {
    facebook: String(links.facebook ?? fb.facebook ?? '').trim(),
    twitter: String(links.twitter ?? fb.twitter ?? '').trim(),
    website: String(links.website ?? fb.website ?? '').trim(),
  }
}

function payloadToForm(payload, fallbackUser) {
  const u = payload?.user ?? {}
  const rawAvatar = u.avatarUrl || fallbackUser?.avatarUrl || ''
  const rawCover = u.coverImageUrl || fallbackUser?.coverImageUrl || ''
  return {
    fullName: u.fullName || fallbackUser?.name || '',
    email: u.email || fallbackUser?.email || '',
    username: u.username || fallbackUser?.username || '',
    avatarUrl: withAvatarCacheBust(rawAvatar),
    avatarBase64: '',
    coverImageUrl: withAvatarCacheBust(rawCover),
    coverImageBase64: '',
    bio: u.bio || fallbackUser?.bio || '',
    socialLinks: mapSocialLinks(u.socialLinks, fallbackUser?.socialLinks),
  }
}

function toExternalHref(url) {
  const value = String(url ?? '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function getInitials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || 'A'
  )
}

function formatJoined(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function AssistantProfile() {
  const navigate = useNavigate()
  const { authorId } = useParams()
  const sessionUser = getSession()
  const isPublicView = Boolean(authorId)
  const isOwnEditable =
    !isPublicView && sessionUser?.role === ROLES.ASSISTANT

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [tab, setTab] = useState('home')
  const [form, setForm] = useState(emptyForm)
  const [draft, setDraft] = useState(emptyForm)
  const [stats, setStats] = useState(null)
  const [joinedAt, setJoinedAt] = useState(null)
  const [cooperations, setCooperations] = useState([])
  const [avatarPreview, setAvatarPreview] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [avatarCropOpen, setAvatarCropOpen] = useState(false)
  const [avatarCropSrc, setAvatarCropSrc] = useState('')
  const [coverCropOpen, setCoverCropOpen] = useState(false)
  const [coverCropSrc, setCoverCropSrc] = useState('')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      // BE spec VI: Assistant profile dùng /assistant/profile riêng.
      // Không fallback sang mangakaProfileService (BE chỉ chấp nhận role Mangaka).
      const payload = isPublicView
        ? null
        : await assistantProfileService.getProfile()

      const next = payloadToForm(payload, sessionUser)
      setForm(next)
      setDraft(next)
      setStats(payload?.stats ?? null)
      setJoinedAt(payload?.user?.joinedAt ?? null)
      setCooperations(Array.isArray(payload?.series) ? payload.series : [])
      setAvatarPreview('')
      setCoverPreview('')
    } catch (err) {
      const status = err?.response?.status
      if (status === 404 || status === 405) {
        const fallback = payloadToForm({ user: {} }, sessionUser)
        setForm(fallback)
        setDraft(fallback)
        setStats(null)
        setJoinedAt(null)
        setCooperations([])
      } else {
        toast.error(getApiErrorMessage(err, 'Không tải được hồ sơ Assistant.'))
        if (!isPublicView) {
          const fallback = payloadToForm({ user: {} }, sessionUser)
          setForm(fallback)
          setDraft(fallback)
        }
        setCooperations([])
      }
    } finally {
      setLoading(false)
    }
  }, [authorId, isPublicView, sessionUser])

  const [roleChecked, setRoleChecked] = useState(false)

  useEffect(() => {
    if (isPublicView) {
      setRoleChecked(true)
      return
    }
    let cancelled = false
    async function bootstrap() {
      if (!sessionUser) return
      const user = getSession()
      // Token có nhưng sessionStorage role chưa đúng → refresh từ /auth/me trước.
      if (user && user.role !== ROLES.ASSISTANT) {
        try {
          const fresh = await refreshSession()
          if (cancelled) return
          if (!fresh || fresh.role !== ROLES.ASSISTANT) {
            const fallback = fresh?.role === ROLES.MANGAKA ? '/mangaka/profile' : '/'
            navigate(fallback, { replace: true })
            return
          }
        } catch {
          navigate('/login', { replace: true })
          return
        }
      }
      if (!cancelled) {
        setRoleChecked(true)
        void loadProfile()
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId, isPublicView, sessionUser?.id, sessionUser?.role, navigate])

  const initials = useMemo(() => getInitials(form.fullName), [form.fullName])
  const featured = cooperations.slice(0, 3)
  const displayAvatar = avatarPreview || form.avatarUrl

  const tagline = useMemo(() => {
    const bio = String(form.bio ?? '').trim()
    if (!bio) return 'Assistant trên MangaHub'
    const first = bio.split(/[\n.!?]/)[0]?.trim()
    return first?.slice(0, 80) || 'Assistant trên MangaHub'
  }, [form.bio])

  const socialItems = useMemo(() => {
    const links = form.socialLinks ?? emptySocialLinks()
    return [
      { key: 'facebook', label: 'Facebook', href: String(links.facebook ?? '').trim(), Icon: Link2 },
      { key: 'twitter', label: 'Twitter / X', href: String(links.twitter ?? '').trim(), Icon: ExternalLink },
      { key: 'website', label: 'Website', href: String(links.website ?? '').trim(), Icon: Globe },
    ]
  }, [form.socialLinks])

  const hasAnySocial = socialItems.some((item) => item.href)

  const coverUrl = useMemo(() => {
    const fromUser = coverPreview || form.coverImageUrl
    if (fromUser) return fromUser
    const withCover = cooperations.find((s) => s.coverImage)
    return withCover?.coverImage ? resolveMediaUrl(withCover.coverImage) : null
  }, [coverPreview, form.coverImageUrl, cooperations])

  function openEdit() {
    setDraft({ ...form, avatarBase64: '', coverImageBase64: '' })
    setAvatarPreview('')
    setCoverPreview('')
    setAvatarCropSrc('')
    setCoverCropSrc('')
    setAvatarCropOpen(false)
    setCoverCropOpen(false)
    setEditOpen(true)
  }

  function patch(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function patchSocial(key, value) {
    setDraft((prev) => ({
      ...prev,
      socialLinks: {
        ...(prev.socialLinks ?? emptySocialLinks()),
        [key]: value,
      },
    }))
  }

  async function handleAvatarFile(e) {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const base64 = await fileToAvatarBase64(file)
      setAvatarCropSrc(base64)
      setAvatarCropOpen(true)
    } catch (err) {
      toast.error(err?.message || 'Không đọc được ảnh.')
    }
  }

  async function handleCoverFile(e) {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const base64 = await fileToAvatarBase64(file)
      setCoverCropSrc(base64)
      setCoverCropOpen(true)
    } catch (err) {
      toast.error(err?.message || 'Không đọc được ảnh.')
    }
  }

  function handleAvatarCropConfirm(croppedDataUrl) {
    setDraft((prev) => ({ ...prev, avatarBase64: croppedDataUrl }))
    setAvatarPreview(croppedDataUrl)
    setAvatarCropSrc('')
  }

  function handleCoverCropConfirm(croppedDataUrl) {
    setDraft((prev) => ({ ...prev, coverImageBase64: croppedDataUrl }))
    setCoverPreview(croppedDataUrl)
    setCoverCropSrc('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!draft.fullName.trim()) {
      toast.error('Vui lòng nhập họ tên.')
      return
    }
    if (draft.bio.length > BIO_MAX) {
      toast.error(`Tiểu sử tối đa ${BIO_MAX} ký tự.`)
      return
    }
    setSaving(true)
    const uploadedAvatar = String(draft.avatarBase64 ?? '').trim()
    const uploadedCover = String(draft.coverImageBase64 ?? '').trim()
    try {
      const updated = await assistantProfileService.updateProfile(draft)
      let payload = updated
      try {
        payload = await assistantProfileService.getProfile()
      } catch {
        payload = updated
      }

      const next = payloadToForm(payload, {
        ...sessionUser,
        name: draft.fullName,
        email: draft.email,
        username: draft.username,
        bio: draft.bio,
        socialLinks: draft.socialLinks,
        avatarUrl: payload?.user?.avatarUrl || '',
        coverImageUrl: payload?.user?.coverImageUrl || '',
      })

      if (!next.avatarUrl && uploadedAvatar.startsWith('data:image')) {
        next.avatarUrl = uploadedAvatar
        setAvatarPreview(uploadedAvatar)
      } else {
        setAvatarPreview('')
      }
      if (!next.coverImageUrl && uploadedCover.startsWith('data:image')) {
        next.coverImageUrl = uploadedCover
        setCoverPreview(uploadedCover)
      } else {
        setCoverPreview('')
      }

      setForm(next)
      setDraft({ ...next, avatarBase64: '', coverImageBase64: '' })
      setStats(payload.stats ?? updated.stats)
      setJoinedAt(payload.user?.joinedAt ?? updated.user?.joinedAt ?? joinedAt)
      if (Array.isArray(payload.series)) setCooperations(payload.series)
      else if (Array.isArray(updated.series)) setCooperations(updated.series)

      updateSession({
        name: next.fullName,
        avatarUrl: next.avatarUrl.startsWith('data:') ? (sessionUser?.avatarUrl ?? '') : next.avatarUrl,
        bio: next.bio,
        username: next.username,
        socialLinks: next.socialLinks,
      })
      setEditOpen(false)
      toast.success('Đã cập nhật hồ sơ Assistant.')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không lưu được hồ sơ.'))
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  if (!isPublicView && !sessionUser) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header links={[]} />
        <main className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <User className="size-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Chưa đăng nhập</h1>
          <Button className="mt-6" onClick={() => navigate('/login')}>
            Đăng nhập
          </Button>
        </main>
      </div>
    )
  }

  if (!isPublicView && !roleChecked) {
    return (
      <div className="mk-profile flex min-h-screen flex-col bg-[#fafafa]">
        <Header links={NAV_LINKS} />
        <main className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span className="ml-2">Đang xác thực phiên...</span>
        </main>
      </div>
    )
  }

  return (
    <div className="mk-profile flex min-h-screen flex-col bg-[#fafafa]">
      <Header
        links={NAV_LINKS}
        onLogout={sessionUser ? handleLogout : undefined}
      />

      {loading ? (
        <main className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <span className="ml-2">Đang tải hồ sơ...</span>
        </main>
      ) : (
        <main className="flex-1 pb-16">
          <section className="mk-profile__hero">
            <div
              className="mk-profile__cover"
              style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
            />
            <div className="page-container relative">
              <div className="flex justify-end gap-2 pt-4">
                {isOwnEditable ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-white/95 shadow-sm"
                      onClick={openEdit}
                    >
                      <Edit className="size-4" />
                      Edit page
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#6f3cff] hover:bg-[#5a2fd6]"
                      asChild
                    >
                      <Link to="/assistant">+ Workspace</Link>
                    </Button>
                  </>
                ) : null}
              </div>

              <div className="mk-profile__identity">
                <Avatar
                  key={displayAvatar || 'no-avatar'}
                  className="mk-profile__avatar size-28 border-[5px] border-white shadow-lg sm:size-32"
                >
                  {displayAvatar ? (
                    <AvatarImage src={displayAvatar} alt={form.fullName} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-[#6f3cff] to-rose-500 text-3xl font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  {form.fullName || 'Assistant'}
                </h1>
                {form.username ? (
                  <p className="mt-0.5 text-sm text-zinc-400">@{form.username}</p>
                ) : null}
                <p className="mt-1 flex items-center justify-center gap-1.5 text-base text-zinc-500">
                  <Sparkles className="size-4 text-violet-500" />
                  <span className="text-zinc-400">is</span> {tagline}
                </p>
                <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {socialItems.map(({ key, label, href, Icon }) => (
                    <li key={key}>
                      {href ? (
                        <a
                          href={toExternalHref(href)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-[#6f3cff]/45 hover:text-[#6f3cff]"
                        >
                          <Icon className="size-4" />
                          {label}
                        </a>
                      ) : isOwnEditable ? (
                        <button
                          type="button"
                          onClick={openEdit}
                          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-zinc-400 transition hover:border-[#6f3cff]/45 hover:text-[#6f3cff]"
                        >
                          <Icon className="size-4" />
                          {label}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <nav className="mk-profile__tabs" aria-label="Profile sections">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'cooperations', label: 'Hợp tác' },
                  { id: 'about', label: 'About' },
                  { id: 'wallet', label: 'Ví' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn('mk-profile__tab', tab === item.id && 'is-active')}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </section>

          <div className="page-container mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-8">
              {(tab === 'home' || tab === 'cooperations') && (
                <section className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Hợp tác nổi bật
                  </p>
                  {featured.length === 0 ? (
                    <div className="mk-profile__card flex flex-col items-center gap-3 py-12 text-center">
                      <Briefcase className="size-8 text-zinc-300" />
                      <p className="text-sm text-zinc-500">Chưa có series hợp tác.</p>
                      {isOwnEditable ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/assistant">Đi đến Workspace</Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    featured.map((s) => {
                      const inner = (
                        <>
                          <div className="mk-profile__feature-thumb">
                            {s.coverImage ? (
                              <img src={s.coverImage} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center bg-zinc-100 text-zinc-400">
                                <Briefcase className="size-8" />
                              </div>
                            )}
                            <span className="mk-profile__feature-badge">Series</span>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1 p-4">
                            <h3 className="font-semibold text-zinc-900 group-hover:text-[#6f3cff]">
                              {s.title}
                            </h3>
                            <p className="line-clamp-2 text-sm text-zinc-500">
                              {s.synopsis || s.genres?.slice(0, 3).join(' · ') || 'Series'}
                            </p>
                            <p className="pt-1 text-sm font-semibold text-zinc-900">
                              {s.chapters ?? 0} chapter
                            </p>
                          </div>
                        </>
                      )
                      return (
                        <div key={s.id} className="mk-profile__feature">
                          {inner}
                        </div>
                      )
                    })
                  )}
                </section>
              )}

              {(tab === 'home' || tab === 'about') && (
                <section className="space-y-3">
                  {tab === 'home' ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                      About
                    </p>
                  ) : null}
                  <div className="mk-profile__card space-y-4 p-6">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-700">
                      {form.bio.trim()
                        ? form.bio
                        : `Xin chào! Mình là ${form.fullName || 'Assistant'} — chuyên bổ sung phần vẽ ngoại cảnh và hỗ trợ Mangaka.`}
                    </p>
                    {(hasAnySocial || isOwnEditable) ? (
                      <ul className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
                        {socialItems.map(({ key, label, href, Icon }) => {
                          if (href) {
                            return (
                              <li key={key}>
                                <a
                                  href={toExternalHref(href)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-[#6f3cff]/40 hover:bg-[#6f3cff]/5 hover:text-[#6f3cff]"
                                >
                                  <Icon className="size-3.5" />
                                  {label}
                                </a>
                              </li>
                            )
                          }
                          if (!isOwnEditable) return null
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                onClick={openEdit}
                                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-400"
                              >
                                <Icon className="size-3.5" />
                                {label}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                </section>
              )}

              {tab === 'wallet' && isOwnEditable ? (
                <section className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Ví của tôi
                  </p>
                  <WalletTab />
                </section>
              ) : null}

              {tab === 'cooperations' && cooperations.length > 3 ? (
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Tất cả hợp tác
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {cooperations.slice(3).map((s) => {
                      const card = (
                        <>
                          <div className="aspect-[16/9] bg-zinc-100">
                            {s.coverImage ? (
                              <img src={s.coverImage} alt="" className="size-full object-cover" />
                            ) : null}
                          </div>
                          <div className="p-3">
                            <p className="font-medium text-zinc-900">{s.title}</p>
                            <p className="text-xs text-zinc-500">{s.chapters ?? 0} chapter</p>
                          </div>
                        </>
                      )
                      return (
                        <div key={s.id} className="mk-profile__card overflow-hidden">
                          {card}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="mk-profile__card overflow-hidden">
                <div className="flex border-b border-zinc-100">
                  <div className="flex flex-1 items-center justify-center gap-2 border-b-2 border-[#6f3cff] px-3 py-3 text-sm font-semibold text-[#6f3cff]">
                    <Heart className="size-4" />
                    Profile
                  </div>
                  <div className="flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm text-zinc-400">
                    <Users className="size-4" />
                    Stats
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <h2 className="text-xl font-bold text-zinc-900">
                    {isPublicView
                      ? `Hồ sơ ${form.fullName || 'Assistant'}`
                      : `Hồ sơ ${form.fullName || 'Assistant'}`}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Tham gia từ {formatJoined(joinedAt)}.
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-700">
                    <Sparkles className="size-4" />
                    <span className="font-medium">Assistant</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Social links
                    </p>
                    <div className="flex flex-col gap-2">
                      {socialItems.map(({ key, label, href, Icon }) => (
                        href ? (
                          <a
                            key={key}
                            href={toExternalHref(href)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:border-[#6f3cff]/40 hover:text-[#6f3cff]"
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{label}</span>
                          </a>
                        ) : isOwnEditable ? (
                          <button
                            key={key}
                            type="button"
                            onClick={openEdit}
                            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-left text-sm text-zinc-400 transition hover:border-[#6f3cff]/40 hover:text-[#6f3cff]"
                          >
                            <Icon className="size-4 shrink-0" />
                            <span>Thêm {label}</span>
                          </button>
                        ) : null
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat
                      label="Hợp tác"
                      value={stats?.totalSeries ?? cooperations.length}
                    />
                    <MiniStat label="Chapter" value={stats?.chapters ?? 0} />
                  </div>
                  {isOwnEditable ? (
                    <Button
                      type="button"
                      className="w-full bg-[#6f3cff] hover:bg-[#5a2fd6]"
                      onClick={openEdit}
                    >
                      <Edit className="size-4" />
                      Chỉnh sửa hồ sơ
                    </Button>
                  ) : null}
                  {form.email && isOwnEditable ? (
                    <p className="text-center text-xs text-zinc-400">
                      Email: {form.email}
                    </p>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </main>
      )}

      <footer className="border-t border-zinc-200/80 py-6 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} {form.fullName || 'Assistant'} · MangaHub
      </footer>

      {isOwnEditable ? (
        <>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="scrollbar-hide max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="asst-full-name">Họ tên</Label>
                  <Input
                    id="asst-full-name"
                    value={draft.fullName}
                    onChange={(e) => patch('fullName', e.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="asst-cover-file">Ảnh bìa (cover)</Label>
                  <Input
                    id="asst-cover-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleCoverFile(e)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Banner profile — tỉ lệ 1200×400 (3:1). Kéo / zoom để chọn vùng hiển thị.
                  </p>
                  {(coverPreview || draft.coverImageUrl) ? (
                    <img
                      src={coverPreview || draft.coverImageUrl}
                      alt=""
                      className="mt-2 h-24 w-full rounded-lg object-cover ring-2 ring-[#6f3cff]/20"
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="asst-avatar-file">Ảnh đại diện</Label>
                  <Input
                    id="asst-avatar-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleAvatarFile(e)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sau khi chọn ảnh, bạn có thể kéo và zoom để chọn vùng hiển thị.
                  </p>
                  {(avatarPreview || draft.avatarUrl) ? (
                    <img
                      src={avatarPreview || draft.avatarUrl}
                      alt=""
                      className="mt-2 size-16 rounded-full object-cover ring-2 ring-[#6f3cff]/25"
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <Label htmlFor="asst-bio">Tiểu sử</Label>
                    <span>
                      {draft.bio.length}/{BIO_MAX}
                    </span>
                  </div>
                  <Textarea
                    id="asst-bio"
                    value={draft.bio}
                    onChange={(e) => patch('bio', e.target.value.slice(0, BIO_MAX))}
                    rows={4}
                  />
                </div>
                <div className="space-y-3 rounded-lg border border-zinc-100 p-3">
                  <p className="text-sm font-medium text-zinc-800">Liên kết mạng xã hội</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="asst-social-facebook">Facebook</Label>
                    <Input
                      id="asst-social-facebook"
                      type="text"
                      placeholder="https://facebook.com/..."
                      value={draft.socialLinks?.facebook ?? ''}
                      onChange={(e) => patchSocial('facebook', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="asst-social-twitter">Twitter / X</Label>
                    <Input
                      id="asst-social-twitter"
                      type="text"
                      placeholder="https://x.com/..."
                      value={draft.socialLinks?.twitter ?? ''}
                      onChange={(e) => patchSocial('twitter', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="asst-social-website">Website</Label>
                    <Input
                      id="asst-social-website"
                      type="text"
                      placeholder="https://..."
                      value={draft.socialLinks?.website ?? ''}
                      onChange={(e) => patchSocial('website', e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditOpen(false)}
                    disabled={saving}
                  >
                    Huỷ
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-[#6f3cff] hover:bg-[#5a2fd6]"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Lưu
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <AvatarCropDialog
            open={avatarCropOpen}
            imageSrc={avatarCropSrc}
            onOpenChange={(open) => {
              setAvatarCropOpen(open)
              if (!open) setAvatarCropSrc('')
            }}
            onConfirm={handleAvatarCropConfirm}
          />

          <CoverCropDialog
            open={coverCropOpen}
            imageSrc={coverCropSrc}
            onOpenChange={(open) => {
              setCoverCropOpen(open)
              if (!open) setCoverCropSrc('')
            }}
            onConfirm={handleCoverCropConfirm}
          />
        </>
      ) : null}
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-center">
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-lg font-bold tabular-nums text-zinc-900">{value}</p>
    </div>
  )
}
