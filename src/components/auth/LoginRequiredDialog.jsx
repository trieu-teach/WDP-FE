import { Link } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function LoginRequiredDialog({ open, onOpenChange, onLogin, pendingPath }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vui lòng đăng nhập</DialogTitle>
          <DialogDescription>
            Bạn cần đăng nhập để truy cập workspace MangaHub
            {pendingPath ? ' và tiếp tục tới trang bạn chọn.' : '.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" asChild>
            <Link to="/register" onClick={() => onOpenChange(false)}>
              Đăng ký
            </Link>
          </Button>
          <Button type="button" onClick={onLogin}>
            Đăng nhập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
