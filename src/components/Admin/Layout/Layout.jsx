import Sidebar from '../Sidebar/Sidebar'
import Header from '../Header/Header'

export default function Layout({ children, activePage, onNavigate }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Sidebar - Fixed full height */}
      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onNavigate={onNavigate} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
