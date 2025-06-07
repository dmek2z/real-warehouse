"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, User, Shield, Key, Check, X } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  
  // 이름 변경 관련 상태
  const [newName, setNewName] = useState(user?.name || "")
  const [isNameEditing, setIsNameEditing] = useState(false)
  
  // 비밀번호 변경 관련 상태
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">사용자 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  // 이름 변경 함수
  const handleNameChange = async () => {
    if (!newName.trim()) {
      toast.error("이름을 입력해주세요.")
      return
    }

    if (newName === user.name) {
      setIsNameEditing(false)
      return
    }

    setIsLoading(true)
    try {
      // users 테이블 업데이트
      const { error: updateError } = await supabase
        .from('users')
        .update({ name: newName.trim() })
        .eq('id', user.id)

      if (updateError) {
        console.error("이름 변경 오류:", updateError)
        toast.error("이름 변경에 실패했습니다.")
        return
      }

      // Supabase Auth 메타데이터 업데이트
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: newName.trim() }
      })

      if (authError) {
        console.error("Auth 메타데이터 업데이트 오류:", authError)
      }

      toast.success("이름이 성공적으로 변경되었습니다.")
      setIsNameEditing(false)
      
      // 페이지 새로고침하여 변경사항 반영
      window.location.reload()
    } catch (error) {
      console.error("이름 변경 중 오류:", error)
      toast.error("이름 변경 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  // 비밀번호 변경 함수
  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("모든 필드를 입력해주세요.")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("새 비밀번호가 일치하지 않습니다.")
      return
    }

    if (newPassword.length < 6) {
      toast.error("새 비밀번호는 최소 6자 이상이어야 합니다.")
      return
    }

    setIsLoading(true)
    try {
      // 현재 비밀번호 확인
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })

      if (signInError) {
        toast.error("현재 비밀번호가 올바르지 않습니다.")
        setIsLoading(false)
        return
      }

      // 새 비밀번호로 업데이트
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        console.error("비밀번호 변경 오류:", updateError)
        toast.error("비밀번호 변경에 실패했습니다.")
        return
      }

      toast.success("비밀번호가 성공적으로 변경되었습니다. 새 비밀번호는 즉시 적용됩니다.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      
      // 5초 후 자동으로 재로그인 권장 알림
      setTimeout(() => {
        toast.info("보안을 위해 로그아웃 후 새 비밀번호로 다시 로그인하는 것을 권장합니다.", {
          duration: 8000
        })
      }, 2000)
    } catch (error) {
      console.error("비밀번호 변경 중 오류:", error)
      toast.error("비밀번호 변경 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  // 권한 표시 함수
  const getPermissionBadgeVariant = (hasPermission: boolean) => {
    return hasPermission ? "default" : "secondary"
  }

  const getPermissionIcon = (hasPermission: boolean) => {
    return hasPermission ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />
  }

  // 페이지 이름 매핑
  const pageNames: { [key: string]: string } = {
    dashboard: "대시보드",
    racks: "랙 관리",
    products: "품목 코드",
    history: "히스토리",
    users: "사용자 관리",
    settings: "설정"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">설정</h1>
        <p className="text-muted-foreground">계정 정보 및 보안 설정을 관리합니다.</p>
      </div>

      <div className="grid gap-6">
        {/* 계정 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              계정 정보
            </CardTitle>
            <CardDescription>
              기본 계정 정보를 확인하고 수정할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 이메일 (읽기 전용) */}
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                이메일은 변경할 수 없습니다.
              </p>
            </div>

            {/* 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              {isNameEditing ? (
                <div className="flex gap-2">
                  <Input
                    id="name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="이름을 입력하세요"
                  />
                  <Button 
                    onClick={handleNameChange} 
                    disabled={isLoading}
                    size="sm"
                  >
                    저장
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsNameEditing(false)
                      setNewName(user.name)
                    }}
                    size="sm"
                  >
                    취소
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  <Input
                    value={user.name}
                    disabled
                    className="bg-muted"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => setIsNameEditing(true)}
                    size="sm"
                  >
                    수정
                  </Button>
                </div>
              )}
            </div>

            {/* 역할 (읽기 전용) */}
            <div className="space-y-2">
              <Label htmlFor="role">역할</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="role"
                  value={user.role}
                  disabled
                  className="bg-muted flex-1"
                />
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role === 'admin' ? '관리자' : 
                   user.role === 'manager' ? '매니저' : '뷰어'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 비밀번호 변경 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              비밀번호 변경
            </CardTitle>
            <CardDescription>
              보안을 위해 주기적으로 비밀번호를 변경하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 현재 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">현재 비밀번호</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="현재 비밀번호를 입력하세요"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* 새 비밀번호 */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">새 비밀번호</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* 새 비밀번호 확인 */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호를 다시 입력하세요"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button 
              onClick={handlePasswordChange} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "변경 중..." : "비밀번호 변경"}
            </Button>
          </CardContent>
        </Card>

        {/* 권한 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              내 권한
            </CardTitle>
            <CardDescription>
              현재 계정에 부여된 페이지별 접근 권한을 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.role === 'admin' ? (
              <div className="space-y-3">
                <Badge variant="default" className="text-sm">
                  관리자 - 모든 권한
                </Badge>
                <p className="text-sm text-muted-foreground">
                  관리자는 시스템의 모든 기능에 접근하고 편집할 수 있습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {user.permissions.map((permission, index) => {
                    const pageName = pageNames[permission.page] || permission.page
                    return (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="font-medium">{pageName}</div>
                        <div className="flex gap-2">
                          <Badge 
                            variant={getPermissionBadgeVariant(permission.view)}
                            className="flex items-center gap-1"
                          >
                            {getPermissionIcon(permission.view)}
                            보기
                          </Badge>
                          <Badge 
                            variant={getPermissionBadgeVariant(permission.edit)}
                            className="flex items-center gap-1"
                          >
                            {getPermissionIcon(permission.edit)}
                            편집
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                <Separator />
                
                <div className="text-sm text-muted-foreground">
                  <p><strong>보기 권한:</strong> 페이지에 접근하여 내용을 볼 수 있습니다.</p>
                  <p><strong>편집 권한:</strong> 데이터를 추가, 수정, 삭제할 수 있습니다.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
