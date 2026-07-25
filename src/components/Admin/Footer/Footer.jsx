import { Heart, Sparkles } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="flex h-14 items-center justify-between border-t border-border/50 bg-gradient-to-r from-card via-card/80 to-card px-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>© 2026</span>
        <span className="font-semibold text-foreground">MangaHub</span>
        <span className="flex items-center gap-1">
          Built with <Heart className="size-3 fill-primary text-primary" />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-gradient-to-r from-primary/5 via-transparent to-rose-500/5 px-3 py-1">
          <Sparkles className="size-3 text-primary" />
          <span className="bg-gradient-to-r from-primary to-rose-500 bg-clip-text font-mono text-xs font-semibold text-transparent">
            v1.0.0
          </span>
        </div>
      </div>
    </footer>
  )
}
