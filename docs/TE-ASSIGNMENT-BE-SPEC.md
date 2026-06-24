// =============================================================================
//  SPEC — Chapter TE Assignment (BE changes)
//  Cần thêm vào:  models/Chapter.js  +  routes/submissions.js
// =============================================================================

// =============================================================================
// 1.  Chapter Model — thêm 2 trường
// =============================================================================

// File: models/Chapter.js
// Tìm schema Chapter, thêm vào:

const chapterSchema = new mongoose.Schema(
  {
    // ... các trường hiện có ...

    // --- TRƯỜNG MỚI ---
    te_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    te_assigned_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

// =============================================================================
// 2.  Submissions Routes — thêm 3 API mới
// =============================================================================

// File: routes/submissions.js
// Middleware: requireAuth  (đảm bảo user đã login)
// Middleware: requireRole('mangaka')  (chỉ Mangaka mới gọi được)

// ---------------------------------------------------------------------------
// GET /submissions/te-users
// Mô tả: Mangaka xem danh sách TE (Editor active)
// ---------------------------------------------------------------------------
router.get('/te-users', requireAuth, async (req, res) => {
  // Lấy tất cả user có role = 'editor' (hoặc 'te') và status = 'active'
  const teUsers = await User.find({
    role: { $in: ['editor', 'te'] },
    status: 'active',
  })
    .select('_id username full_name email')
    .sort({ full_name: 1 })

  res.json({ success: true, data: teUsers })
})

// ---------------------------------------------------------------------------
// POST /submissions/chapters/:chapterId/assign-te
// Mô tả: Mangaka gán TE cụ thể cho chapter
// Body: { te_id: string }   hoặc   { te_id: null } để bỏ gán
// ---------------------------------------------------------------------------
router.post('/chapters/:chapterId/assign-te', requireAuth, async (req, res) => {
  const { chapterId } = req.params
  const { te_id } = req.body   // ObjectId string hoặc null

  // 1) Verify chapter tồn tại và thuộc về Mangaka đang login
  const chapter = await Chapter.findOne({
    _id: chapterId,
    // Nếu Chapter có trường author_id hoặc createdBy thì lọc thêm:
    // author_id: req.user._id
  })
  if (!chapter) {
    return res.status(404).json({ success: false, message: 'Chapter not found.' })
  }

  // 2) Nếu gán TE mới → verify TE hợp lệ
  if (te_id) {
    const teUser = await User.findOne({
      _id: te_id,
      role: { $in: ['editor', 'te'] },
      status: 'active',
    })
    if (!teUser) {
      return res.status(400).json({
        success: false,
        message: 'Invalid TE user or TE is not active.',
      })
    }
  }

  // 3) Cập nhật chapter
  chapter.te_id = te_id ? new mongoose.Types.ObjectId(te_id) : null
  chapter.te_assigned_at = te_id ? new Date() : null
  await chapter.save()

  // 4) Nếu gán TE → tạo notification cho TE
  if (te_id) {
    await Notification.create({
      user_id: te_id,
      type: 'te_assigned',
      title: 'Bạn được gán chapter mới',
      message: `Mangaka vừa gán bạn làm TE cho chapter "${chapter.title || chapter.chapter_number}" của series.`,
      data: { chapterId: chapter._id },
    })
  }

  return res.json({
    success: true,
    data: {
      _id: chapter._id,
      te_id: chapter.te_id,
      te_assigned_at: chapter.te_assigned_at,
    },
  })
})

// ---------------------------------------------------------------------------
// DELETE /submissions/chapters/:chapterId/remove-te
// Mô tả: Mangaka gỡ TE khỏi chapter
// ---------------------------------------------------------------------------
router.delete('/chapters/:chapterId/remove-te', requireAuth, async (req, res) => {
  const { chapterId } = req.params

  const chapter = await Chapter.findOne({ _id: chapterId })
  if (!chapter) {
    return res.status(404).json({ success: false, message: 'Chapter not found.' })
  }

  chapter.te_id = null
  chapter.te_assigned_at = null
  await chapter.save()

  return res.json({
    success: true,
    data: { _id: chapter._id, te_id: null, te_assigned_at: null },
  })
})

// =============================================================================
// 3.  Sửa 4 chỗ logic nhất quán
// =============================================================================

// ---------------------------------------------------------------------------
// 3a. POST /submissions/chapters/:chapterId/submit-to-te
// Thay đổi: ưu tiên notify TE đã được gán (chapter.te_id),
//            không broadcast nữa
// ---------------------------------------------------------------------------
// Trong route hiện tại, tìm đoạn gửi notification cho TE.
// Thay thế bằng:

const targetTeId = chapter.te_id  // ưu tiên TE đã gán
if (targetTeId) {
  // Gửi notification CHỈ cho TE được gán
  await Notification.create({
    user_id: targetTeId,
    type: 'chapter_pending_te',
    title: 'Chapter mới chờ TE Review',
    message: `Chapter "${chapter.title || chapter.chapter_number}" đã được gửi sang TE.`,
    data: { chapterId: chapter._id },
  })
} else {
  // Fallback: broadcast cho tất cả TE (nếu chưa gán ai)
  const allTEs = await User.find({ role: { $in: ['editor', 'te'] }, status: 'active' })
  await Notification.insertMany(
    allTEs.map((te) => ({
      user_id: te._id,
      type: 'chapter_pending_te',
      title: 'Chapter mới chờ TE Review',
      message: `Chapter "${chapter.title || chapter.chapter_number}" đã được gửi sang TE.`,
      data: { chapterId: chapter._id },
    })),
  )
}

// ---------------------------------------------------------------------------
// 3b. GET /submissions/te  (lọc theo te_id)
// Thay đổi: TE chỉ thấy chapter được gán cho mình HOẶC chưa ai gán
// ---------------------------------------------------------------------------
router.get('/te', requireAuth, async (req, res) => {
  // ... lấy submissions/chapters có status = 'pending_TE' ...
  const query = {
    status: 'pending_TE',
    $or: [
      { te_id: req.user._id },       // được gán cho mình
      { te_id: null },               // hoặc chưa ai gán
    ],
  }
  // ... phần còn lại giữ nguyên
})

// ---------------------------------------------------------------------------
// 3c. GET /te-reviews/pending   (lọc theo te_id)
// ---------------------------------------------------------------------------
router.get('/te-reviews/pending', requireAuth, async (req, res) => {
  // thêm filter $or vào query hiện tại:
  const query = {
    status: 'pending_TE',
    $or: [
      { te_id: req.user._id },
      { te_id: null },
    ],
  }
})

// ---------------------------------------------------------------------------
// 3d. GET /te-reviews/dashboard  (lọc theo te_id)
// ---------------------------------------------------------------------------
router.get('/te-reviews/dashboard', requireAuth, async (req, res) => {
  const query = {
    status: { $in: ['pending_TE', 'in_TE_review', 'TE_revision'] },
    $or: [
      { te_id: req.user._id },
      { te_id: null },
    ],
  }
})

// ---------------------------------------------------------------------------
// 3e. POST /series-review/:seriesId/submit
// Thay đổi: khi avg >= 3.5, chỉ gửi EB những chapter được gán cho TE đó
// ---------------------------------------------------------------------------
// Trong logic gửi EB (sau khi TE approve):
// Thay vì gửi TẤT CẢ chapters → chỉ gửi chapters có te_id === currentUser._id
if (avgScore >= 3.5) {
  const ebChapters = chapters.filter(
    (c) => c.te_id && String(c.te_id) === String(req.user._id),
  )
  // Xử lý ebChapters thay vì chapters
}

// ---------------------------------------------------------------------------
// 3f. GET /series-review/:seriesId/next-chapter
// Thay đổi: chỉ trả về chapter được gán cho TE đó
// ---------------------------------------------------------------------------
router.get('/series-review/:seriesId/next-chapter', requireAuth, async (req, res) => {
  const chapter = await Chapter.findOne({
    series_id: req.params.seriesId,
    status: 'pending_TE',
    te_id: req.user._id,   // ← thêm filter này
  })
    .sort({ chapter_number: 1 })
    .populate('series_id', 'name')

  if (!chapter) {
    return res.status(404).json({ success: false, message: 'No chapter found.' })
  }
  return res.json({ success: true, data: chapter })
})
