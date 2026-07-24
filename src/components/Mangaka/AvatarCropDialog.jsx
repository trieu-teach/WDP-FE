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
import './AvatarCropDialog.css'

/**
 * Dialog crop avatar — khung tròn 1:1.
 */
export function AvatarCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onConfirm,
  title = 'Điều chỉnh ảnh đại diện',
}) {
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
        width: 512,
        height: 512,
        quality: 0.92,
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
      <DialogContent className="avatar-crop-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Kéo ảnh để chọn vùng hiển thị. Dùng thanh zoom để phóng to / thu nhỏ.
          </DialogDescription>
        </DialogHeader>

        <div className="avatar-crop-dialog__stage">
          {open && imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="avatar-crop-dialog__zoom">
          <Label htmlFor="avatar-crop-zoom" className="text-xs text-muted-foreground">
            Zoom
          </Label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="avatar-crop-dialog__range"
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

export default AvatarCropDialog
