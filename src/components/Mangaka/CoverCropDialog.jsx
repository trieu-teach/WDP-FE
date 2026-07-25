import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getCroppedImageDataUrl } from '@/utils/cropImage.js'
import './CoverCropDialog.css'

/** Khớp BE Cloudinary: tỉ lệ 3:1 — xuất nhỏ hơn rồi BE resize 1200×400. */
export const COVER_WIDTH = 900
export const COVER_HEIGHT = 300
export const COVER_ASPECT = COVER_WIDTH / COVER_HEIGHT

/**
 * Dialog crop ảnh bìa — luôn khung chữ nhật 3:1 (không dùng chung avatar).
 */
export function CoverCropDialog({ open, imageSrc, onOpenChange, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setBusy(false)
  }, [open, imageSrc])

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return
    setBusy(true)
    try {
      const dataUrl = await getCroppedImageDataUrl(imageSrc, croppedAreaPixels, {
        circular: false,
        width: COVER_WIDTH,
        height: COVER_HEIGHT,
        quality: 0.72,
      })
      onConfirm?.(dataUrl)
      onOpenChange?.(false)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cover-crop-dialog sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Điều chỉnh ảnh bìa</DialogTitle>
          <DialogDescription>
            Kéo ảnh để chọn vùng banner tỉ lệ 3:1 (BE lưu 1200×400).
          </DialogDescription>
        </DialogHeader>

        <div className="cover-crop-dialog__stage">
          {open && imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={COVER_ASPECT}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{ cropAreaStyle: { borderRadius: 0 } }}
              classes={{ cropAreaClassName: 'cover-crop-dialog__area' }}
            />
          ) : null}
        </div>

        <div className="cover-crop-dialog__zoom">
          <Label htmlFor="cover-crop-zoom" className="text-xs text-muted-foreground">
            Zoom
          </Label>
          <input
            id="cover-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="cover-crop-dialog__range"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            disabled={busy}
          >
            <X className="size-4" />
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || !croppedAreaPixels}
            className="bg-[#6f3cff] hover:bg-[#5a2fd6]"
          >
            <Check className="size-4" />
            Áp dụng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CoverCropDialog
