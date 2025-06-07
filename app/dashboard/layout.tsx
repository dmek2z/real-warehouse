"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation" 
import { Grid3x3, History, Home, LogOut, Package, Settings, Users, Menu as MenuIcon } from "lucide-react" 
import Image from "next/image"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { StorageProvider } from "@/contexts/storage-context"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import DashboardLogic from "@/components/DashboardLogic" // 이 컴포넌트는 위에서 수정된 버전 사용
import type { Permission } from "@/contexts/auth-context"


interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  id: string
}

const navItems: NavItem[] = [
  { title: "대시보드", href: "/dashboard", icon: Home, id: "dashboard" },
  { title: "랙 보기", href: "/dashboard/racks", icon: Grid3x3, id: "racks" },
  { title: "품목 코드", href: "/dashboard/products", icon: Package, id: "products" },
  { title: "히스토리", href: "/dashboard/history", icon: History, id: "history" },
  { title: "사용자 관리", href: "/dashboard/users", icon: Users, id: "users" },
  { title: "설정", href: "/dashboard/settings", icon: Settings, id: "settings" },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [quickInit, setQuickInit] = useState(false); // 빠른 초기화 상태
  const { user, logout, isLoading: authIsLoading, isInitialized, hasPermission } = useAuth();

  // 새로고침 시 localStorage에서 빠르게 사용자 정보 로드
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser && !quickInit) {
        setQuickInit(true);
        console.log('DashboardLayout: Quick initialization with localStorage user');
      }
    } catch (error) {
      console.warn('DashboardLayout: Failed to read localStorage:', error);
    }
    
    // 100ms 후 강제로 quickInit을 true로 설정 (로딩 상태 단축)
    const quickTimeout = setTimeout(() => {
      if (!quickInit) {
        setQuickInit(true);
        console.log('DashboardLayout: Quick timeout - forcing display');
      }
    }, 100);

    return () => clearTimeout(quickTimeout);
  }, [quickInit]);

  const accessibleNavItems = navItems.filter((item) => {
    // quickInit이 true이거나 정상적으로 초기화가 완료된 경우
    if (quickInit || (isInitialized && !authIsLoading)) {
      if (item.id === "settings") return !!user; 
      return hasPermission(item.id, "view");
    }
    // 로딩 중이거나 초기화되지 않았으면 기본 메뉴들만 표시
    return ["dashboard", "racks", "products"].includes(item.id);
  });

  // ** 로딩 조건을 더 엄격하게 수정: quickInit이 false이고 초기화도 안된 경우에만 로딩 **
  if (!quickInit && (!isInitialized || authIsLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700">TAD STORY 로딩 중...</p>
            <p className="text-sm text-gray-500 mt-1">잠시만 기다려주세요</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StorageProvider>
      <DashboardLogic> {/* DashboardLogic의 내부 로직은 위에서 비활성화한 상태로 테스트 */}
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
            <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="메뉴 열기">
                  <MenuIcon className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b pb-4">
                    <Image
                      src="/images/tad-story-logo.png"
                      alt="TAD STORY"
                      width={150}
                      height={40}
                      className="object-contain"
                    />
                  </div>
                  <nav className="grid gap-2">
                    {accessibleNavItems.map((item) => ( // user가 있을 때만 메뉴 아이템을 보여주도록 수정 가능
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileNavOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                          pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.title}
                      </Link>
                    ))}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <Image
                src="/images/tad-story-logo.png"
                alt="TAD STORY"
                width={150}
                height={40}
                className="object-contain"
              />
            </div>
            <div className="flex-1" />
            {user && (
              <div className="flex items-center gap-4">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-auto justify-start gap-2">
                            {user?.name || user?.email || "사용자"} 
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                    {hasPermission("settings", "view") && (
                        <DropdownMenuItem asChild>
                        <Link href="/dashboard/settings">설정</Link>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={async () => {
                        await logout();
                    }}>로그아웃</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </header>
          <div className="flex flex-1">
            <aside className="hidden w-64 border-r bg-muted/40 md:block">
              <nav className="grid gap-2 p-4">
                {accessibleNavItems.map((item) => ( // user가 있을 때만 메뉴 아이템을 보여주도록 수정 가능
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                      pathname === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.title}
                  </Link>
                ))}
              </nav>
            </aside>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </DashboardLogic>
    </StorageProvider>
  )
}
