import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  ImagePlus,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  createEmptySeriesForm,
  seriesToForm,
  validateSeriesForm,
  SERIES_GENRES,
  SERIES_FORMATS,
  SERIES_TAGS,
} from '@/utils/seriesModel.js'
import './AddSeriesModal.css'

const TARGET_AUDIENCES = [
  { value: 'shonen', label: 'Shōnen', hint: '13-18 tuổi' },
  { value: 'shojo', label: 'Shōjo', hint: '13-18 tuổi' },
  { value: 'seinen', label: 'Seinen', hint: '18+' },
  { value: 'josei', label: 'Josei', hint: '18+' },
  { value: 'all', label: 'Mọi lứa tuổi', hint: 'All ages' },
]

const AGE_RATINGS = [
  { value: 'All ages', label: 'Mọi lứa tuổi', icon: '🌱' },
  { value: 'Teens 13+', label: 'Tuổi teen', icon: '🎒' },
  { value: 'Mature 17+', label: 'Người lớn', icon: '🔞' },
  { value: 'Adults Only 18+', label: 'Chỉ 18+', icon: '⛔' },
]

export default function AddSeriesModal({
  open,
  onClose,
  onSubmit,
  mode = 'create',
  initialSeries = null,
  authorName = '',
  existingTitles = [],
}) {
  const isEdit = mode === 'edit' && initialSeries

  const [form, setForm] = useState(() => createEmptySeriesForm(authorName))
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEdit) setForm(seriesToForm(initialSeries))
    else setForm(createEmptySeriesForm(authorName))
    setTouched(false)
  }, [open, isEdit, initialSeries?.id, authorName])

  const titlesForValidation = useMemo(() => {
    if (!isEdit) return existingTitles
    const self = String(initialSeries?.title ?? '').trim().toLowerCase()
    return existingTitles.filter(t => String(t).toLowerCase() !== self)
  }, [existingTitles, isEdit, initialSeries?.title])

  const validation = useMemo(
    () => validateSeriesForm(form, titlesForValidation),
    [form, titlesForValidation],
  )

  function patch(updates) { setForm(prev => ({ ...prev, ...updates })) }
  function toggleTag(tag) {
    patch({
      tags: form.tags.includes(tag)
        ? form.tags.filter(t => t !== tag)
        : [...form.tags, tag],
    })
  }

  function handleClose() {
    setForm(createEmptySeriesForm(authorName))
    setTouched(false)
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (!validation.ok) return
    onSubmit(form, { mode: isEdit ? 'edit' : 'create', seriesId: initialSeries?.id })
    if (!isEdit) setForm(createEmptySeriesForm(authorName))
    setTouched(false)
  }

  const err = (key) => (touched ? validation.errors[key] : null)
  const showErr = (key) => {
    const msg = err(key)
    if (msg) return msg
    if (!touched) return null
    if (key === 'name' && !form.name.trim()) return 'Tên series tối thiểu 2 ký tự.'
    if (key === 'description' && !form.description.trim()) return 'Vui lòng nhập mô tả.'
    if (key === 'genre' && !form.genre) return 'Vui lòng chọn thể loại.'
    if (key === 'target_audience' && !form.target_audience) return 'Vui lòng chọn đối tượng.'
    return null
  }

  const descriptionFilled = form.description.length
  const charLimit = 1000
  const charPercent = Math.min((descriptionFilled / charLimit) * 100, 100)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="series-modal p-0 sm:max-w-[640px] gap-0 border-0"
        showCloseButton={false}
      >
        {/* HERO HEADER */}
        <div className="series-modal__hero">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border border-border/40 bg-background/60 text-muted-foreground transition hover:bg-background hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
          <div className="series-modal__eyebrow">
            <Sparkles className="size-3.5" />
            {isEdit ? 'Chỉnh sửa series' : 'Series mới'}
          </div>
          <h2 className="series-modal__title">
            {isEdit ? initialSeries?.title || 'Series' : 'Tạo series mới'}
          </h2>
          <p className="series-modal__subtitle">
            {isEdit
              ? 'Cập nhật hồ sơ để series hấp dẫn hơn với độc giả.'
              : 'Điền thông tin cơ bản để series xuất hiện trên nền tảng.'}
          </p>
        </div>

        {/* BODY */}
        <form
          id="series-form"
          onSubmit={handleSubmit}
          className="series-modal__body"
        >
          <div className="series-modal__flow">
            {/* SECTION 1: Thông tin cơ bản */}
            <div className="series-modal__block">
              <div className="series-modal__block-head">
                <h3 className="series-modal__block-title flex items-center gap-2">
                  <BookOpen className="size-4 text-primary" />
                  Thông tin cơ bản
                </h3>
                <span className="series-modal__block-note">Bắt buộc</span>
              </div>

              <div className="series-modal__field">
                <Label htmlFor="s-name">
                  Tên series <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="s-name"
                  value={form.name}
                  onChange={e => patch({ name: e.target.value })}
                  placeholder="Ví dụ: Kiếm Thần Vô Song"
                  maxLength={120}
                  autoFocus
                  className="series-modal__control"
                />
                {showErr('name') && (
                  <p className="series-modal__error">{showErr('name')}</p>
                )}
              </div>

              <div className="series-modal__field">
                <div className="flex items-center justify-between">
                  <Label htmlFor="s-desc">
                    Mô tả <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {descriptionFilled}/{charLimit}
                  </span>
                </div>
                <Textarea
                  id="s-desc"
                  value={form.description}
                  onChange={e => patch({ description: e.target.value })}
                  placeholder="Cốt truyện, bối cảnh, nhân vật chính…"
                  rows={4}
                  maxLength={charLimit}
                  className="series-modal__control series-modal__textarea"
                />
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      charPercent > 80
                        ? 'bg-destructive'
                        : charPercent > 50
                          ? 'bg-amber-500'
                          : 'bg-primary',
                    )}
                    style={{ width: `${charPercent}%` }}
                  />
                </div>
                {showErr('description') && (
                  <p className="series-modal__error">{showErr('description')}</p>
                )}
              </div>
            </div>

            <div className="series-modal__divider" />

            {/* SECTION 2: Phân loại */}
            <div className="series-modal__block">
              <div className="series-modal__block-head">
                <h3 className="series-modal__block-title flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Phân loại
                </h3>
                <span className="series-modal__block-note">Giúp độc giả tìm thấy bạn</span>
              </div>

              <div className="series-modal__field">
                <Label>
                  Thể loại <span className="text-destructive">*</span>
                </Label>
                <div className="series-modal__genre-panel">
                  <div className="series-modal__genres">
                    {SERIES_GENRES.map(g => {
                      const active = form.genre === g
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => patch({ genre: g })}
                          className={cn(
                            'series-modal__genre',
                            active && 'series-modal__genre--active',
                          )}
                        >
                          {active && <Check className="size-3" />}
                          {g}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {showErr('genre') && (
                  <p className="series-modal__error">{showErr('genre')}</p>
                )}
              </div>

              <div className="series-modal__field">
                <Label>
                  Đối tượng độc giả <span className="text-destructive">*</span>
                </Label>
                <div className="series-modal__publish">
                  {TARGET_AUDIENCES.map(a => {
                    const active = form.target_audience === a.value
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => patch({ target_audience: a.value })}
                        className={cn(
                          'series-modal__publish-card',
                          active && 'series-modal__publish-card--active',
                        )}
                      >
                        <span className="series-modal__publish-title">{a.label}</span>
                        <span className="series-modal__publish-hint">{a.hint}</span>
                        <span className="series-modal__publish-dot" />
                      </button>
                    )
                  })}
                </div>
                {showErr('target_audience') && (
                  <p className="series-modal__error">{showErr('target_audience')}</p>
                )}
              </div>
            </div>

            <div className="series-modal__divider" />

            {/* SECTION 3: Định dạng & độ tuổi */}
            <div className="series-modal__block">
              <div className="series-modal__block-head">
                <h3 className="series-modal__block-title flex items-center gap-2">
                  <ImagePlus className="size-4 text-primary" />
                  Định dạng & phân loại nội dung
                </h3>
                <span className="series-modal__block-note">Tuỳ chọn</span>
              </div>

              <div className="series-modal__field">
                <Label>Định dạng xuất bản</Label>
                <div className="series-modal__publish">
                  {SERIES_FORMATS.map(f => {
                    const active = (form.category || 'manga') === f.value
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => patch({ category: f.value })}
                        className={cn(
                          'series-modal__publish-card',
                          active && 'series-modal__publish-card--active',
                        )}
                      >
                        <span className="series-modal__publish-title">{f.label}</span>
                        <span className="series-modal__publish-hint">
                          {f.value === 'manga' && 'Truyện tranh Nhật Bản'}
                          {f.value === 'manhwa' && 'Truyện tranh Hàn Quốc'}
                          {f.value === 'manhua' && 'Truyện tranh Trung Quốc'}
                          {f.value === 'webtoon' && 'Cuộn dọc, đọc trên mobile'}
                        </span>
                        <span className="series-modal__publish-dot" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="series-modal__field">
                <Label>
                  <Users className="inline size-3.5 mr-1 text-muted-foreground" />
                  Độ tuổi giới hạn
                </Label>
                <div className="series-modal__publish">
                  {AGE_RATINGS.map(a => {
                    const active = form.age_rating === a.value
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => patch({ age_rating: a.value })}
                        className={cn(
                          'series-modal__publish-card',
                          active && 'series-modal__publish-card--active',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base leading-none">{a.icon}</span>
                          <span className="series-modal__publish-title">{a.label}</span>
                        </span>
                        <span className="series-modal__publish-hint">{a.value}</span>
                        <span className="series-modal__publish-dot" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="series-modal__divider" />

            {/* SECTION 4: Tags */}
            <div className="series-modal__block">
              <div className="series-modal__block-head">
                <h3 className="series-modal__block-title flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Tags
                </h3>
                <span className="series-modal__block-note">
                  {form.tags.length > 0 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Đã chọn {form.tags.length}
                    </Badge>
                  ) : (
                    'Chọn vài tags để dễ tìm kiếm'
                  )}
                </span>
              </div>

              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2">
                  {form.tags.map(t => (
                    <Badge
                      key={t}
                      variant="default"
                      className="cursor-pointer gap-1 pr-1.5 hover:bg-primary/90"
                      onClick={() => toggleTag(t)}
                    >
                      {t}
                      <X className="size-3" />
                    </Badge>
                  ))}
                </div>
              )}

              <div className="series-modal__genre-panel">
                <div className="series-modal__genres">
                  {SERIES_TAGS.map(tag => {
                    const active = form.tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          'series-modal__genre',
                          active && 'series-modal__genre--active',
                        )}
                      >
                        {active ? <Check className="size-3" /> : <span className="text-muted-foreground/60">#</span>}
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* FOOTER */}
        <div className="series-modal__foot">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="text-muted-foreground"
          >
            Huỷ
          </Button>
          <Button
            type="submit"
            form="series-form"
            disabled={touched && !validation.ok}
            className="gap-1.5 min-w-[140px]"
          >
            {isEdit ? 'Lưu thay đổi' : 'Tạo series'}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
