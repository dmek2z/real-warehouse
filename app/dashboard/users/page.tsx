"use client"

import { useState, useEffect } from "react"
import { Pencil, Search, Shield, Trash2, User, UserPlus, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { useStorage } from "@/contexts/storage-context"
import { useAuth } from "@/contexts/auth-context"
import { supabaseAdmin } from "@/lib/supabaseClient"

// Types
interface Permission {
  page: string
  view: boolean
  edit: boolean
}

// 페이지 목록
const PAGES = [
  { id: "dashboard", name: "대시보드" },
  { id: "racks", name: "랙 관리" },
  { id: "products", name: "품목 코드" },
  { id: "history", name: "히스토리" },
  { id: "users", name: "사용자 관리" },
]

// 권한 템플릿
const PERMISSION_TEMPLATES = [
  {
    id: "admin",
    name: "관리자",
    permissions: PAGES.map((page) => ({
      page: page.id,
      view: true,
      edit: true,
    })),
  },
  {
    id: "manager",
    name: "매니저",
    permissions: PAGES.map((page) => ({
      page: page.id,
      view: true,
      edit: page.id !== "users",
    })),
  },
  {
    id: "viewer",
    name: "뷰어",
    permissions: PAGES.map((page) => ({
      page: page.id,
      view: true,
      edit: false,
    })),
  },
]

// 역할과 권한 템플릿 매핑
const ROLE_TO_TEMPLATE: Record<string, string> = {
  admin: "admin",
  manager: "manager",
  viewer: "viewer",
};

export default function UsersPage() {
  const { users, addUser, updateUser, deleteUser, isLoading } = useStorage()
  const { hasPermission } = useAuth()
  const { addToast } = useToast()

  // 검색
  const [searchQuery, setSearchQuery] = useState("")

  // 다이얼로그 상태
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // 현재 선택된 사용자
  const [currentUser, setCurrentUser] = useState<typeof users[0] | null>(null)

  // 폼 상태
  const [activeTab, setActiveTab] = useState("basic")
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formRole, setFormRole] = useState("viewer")
  const [formPermissions, setFormPermissions] = useState<Permission[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")

  // 폼 오류
  const [formErrors, setFormErrors] = useState<{
    name?: string
    email?: string
    password?: string
  }>({})

  // 폼 제출 시도 여부
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false)

  // 필터링된 사용자 목록
  const filteredUsers = users.filter(
    (user) =>
      searchQuery === "" ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 폼 초기화
  const resetForm = () => {
    setFormName("")
    setFormEmail("")
    setFormPassword("")
    setFormRole("viewer")
    setFormPermissions(
      PAGES.map((page) => ({
        page: page.id,
        view: false,
        edit: false,
      })),
    )
    setSelectedTemplate("")
    setFormErrors({})
    setFormSubmitAttempted(false)
    setActiveTab("basic")
  }

  // 사용자 추가 다이얼로그 열기
  const handleOpenAddDialog = () => {
    if (!hasPermission("users", "edit")) return
    resetForm()
    setAddDialogOpen(true)
  }

  // 사용자 수정 다이얼로그 열기
  const handleOpenEditDialog = (user: typeof users[0]) => {
    if (!hasPermission("users", "edit")) return
    setCurrentUser(user)

    // 폼 데이터 설정
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPassword("")
    setFormRole(user.role)

    // 권한 데이터 설정
    const permissionsCopy = user.permissions
      .filter((p) => PAGES.some((page) => page.id === p.page))
      .map((p) => ({ ...p }))

    // 누락된 페이지 권한 추가
    PAGES.forEach((page) => {
      if (!permissionsCopy.some((p) => p.page === page.id)) {
        permissionsCopy.push({
          page: page.id,
          view: false,
          edit: false,
        })
      }
    })

    setFormPermissions(permissionsCopy)
    checkPermissionTemplate(permissionsCopy)

    setFormErrors({})
    setFormSubmitAttempted(false)
    setActiveTab("basic")
    setEditDialogOpen(true)
  }

  // 권한 수정 다이얼로그 열기
  const handleOpenPermissionsDialog = (user: typeof users[0]) => {
    if (!hasPermission("users", "edit")) return
    setCurrentUser(user)

    // 권한 데이터 설정
    const permissionsCopy = user.permissions
      .filter((p) => PAGES.some((page) => page.id === p.page))
      .map((p) => ({ ...p }))

    // 누락된 페이지 권한 추가
    PAGES.forEach((page) => {
      if (!permissionsCopy.some((p) => p.page === page.id)) {
        permissionsCopy.push({
          page: page.id,
          view: false,
          edit: false,
        })
      }
    })

    setFormPermissions(permissionsCopy)
    checkPermissionTemplate(permissionsCopy)

    setPermissionsDialogOpen(true)
  }

  // 삭제 다이얼로그 열기
  const handleOpenDeleteDialog = (user: typeof users[0]) => {
    if (!hasPermission("users", "edit")) return
    setCurrentUser(user)
    setDeleteDialogOpen(true)
  }

  // 권한 템플릿 확인
  const checkPermissionTemplate = (permissions: Permission[]) => {
    for (const template of PERMISSION_TEMPLATES) {
      let isMatch = true

      for (const tp of template.permissions) {
        const up = permissions.find((p) => p.page === tp.page)
        if (!up || up.view !== tp.view || up.edit !== tp.edit) {
          isMatch = false
          break
        }
      }

      if (isMatch) {
        setSelectedTemplate(template.id)
        return
      }
    }

    setSelectedTemplate("")
  }

  // 폼 유효성 검사
  const validateForm = (isEdit = false) => {
    const errors: {
      name?: string
      email?: string
      password?: string
    } = {}

    if (!formName.trim()) {
      errors.name = "이름을 입력해주세요"
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formEmail.trim()) {
      errors.email = "이메일을 입력해주세요"
    } else if (!emailRegex.test(formEmail)) {
      errors.email = "유효한 이메일 형식이 아닙니다"
    } else {
      // 아이디 중복 검사 (수정 시 자기 자신은 제외)
      const isDuplicate = users.some(
        (user) => user.email === formEmail && (!isEdit || user.id !== currentUser?.id),
      )
      if (isDuplicate) {
        errors.email = "이미 사용 중인 이메일입니다"
      }
    }

    // 새 사용자 추가 시에만 비밀번호 필수
    if (!isEdit && !formPassword.trim()) {
      errors.password = "비밀번호를 입력해주세요"
    } else if (formPassword.trim() && formPassword.length < 6) {
      errors.password = "비밀번호는 6자 이상이어야 합니다"
    }

    setFormErrors(errors)
    setFormSubmitAttempted(true)
    return Object.keys(errors).length === 0
  }

  // 권한 업데이트
  const handlePermissionChange = (pageId: string, field: "view" | "edit", value: boolean) => {
    const updatedPermissions = formPermissions.map((perm) => {
      if (perm.page === pageId) {
        // 보기 권한을 끄면 편집 권한도 끔
        if (field === "view" && !value) {
          return { ...perm, view: false, edit: false }
        }
        // 편집 권한을 켜면 보기 권한도 켬
        if (field === "edit" && value) {
          return { ...perm, view: true, edit: true }
        }
        return { ...perm, [field]: value }
      }
      return perm
    })

    setFormPermissions(updatedPermissions)
    checkPermissionTemplate(updatedPermissions)
  }

  // 권한 템플릿 적용
  const handleApplyTemplate = (templateId: string) => {
    const template = PERMISSION_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      const permissionsCopy = template.permissions.map((p) => ({ ...p }))
      setFormPermissions(permissionsCopy)
      setSelectedTemplate(templateId)
    }
  }

  // 사용자 추가
  const handleAddUser = async () => {
    if (!validateForm() || !hasPermission("users", "edit")) return

    try {
      console.log("사용자 생성 시작:", { email: formEmail, name: formName, role: formRole });
      
      // 앱 내 이메일 중복 체크
      const appUserExists = users.some((user) => user.email === formEmail);
      if (appUserExists) {
        console.warn("Email already exists in app:", formEmail);
        addToast({
          title: "이메일 중복",
          description: "이미 등록된 이메일입니다.",
          variant: "destructive",
        });
        return;
      }

      // Supabase Auth에 사용자 생성 (서비스 롤 키 사용)
      let newUser;
      try {
        console.log('Creating user with Auth API:', { email: formEmail, name: formName, role: formRole });
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: formEmail,
          password: formPassword,
          email_confirm: true,
          phone_confirm: false,
          user_metadata: {
            name: formName,
            role: formRole
          }
        });

        if (authError) {
          console.error('Supabase Auth error:', authError);
          throw new Error(`사용자 생성 실패: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error('사용자 데이터가 생성되지 않았습니다.');
        }

        console.log('Auth user created successfully:', authData.user.id);
        
        newUser = {
          id: authData.user.id,
          email: formEmail,
          name: formName,
          role: formRole,
          status: "active" as const,
          permissions: formPermissions,
        }
        
        addToast({
          title: "✅ 사용자 생성 성공",
          description: `${formName} 계정이 생성되었습니다. 이제 로그인할 수 있습니다.`,
        })
      } catch (authError: any) {
        // Auth API 실패 시 fallback으로 로컬 생성
        console.error('Auth API failed:', {
          message: authError.message,
          code: authError.code,
          details: authError
        });
        const newUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        newUser = {
          id: newUserId,
          email: formEmail,
          name: formName,
          role: formRole,
          status: "active" as const,
          permissions: formPermissions,
        }
        
        addToast({
          title: "주의",
          description: "사용자가 생성되었지만 로그인 기능은 제한됩니다.",
          variant: "destructive",
        })
      }
      
      await addUser(newUser)
      addToast({
        title: "사용자 추가 완료",
        description: `${newUser.name} 사용자가 추가되었습니다.`,
      })
      resetForm()
      setAddDialogOpen(false)
    } catch (error: any) {
      console.error('Error adding user:', error)
      addToast({
        title: "사용자 추가 실패",
        description: error.message || "사용자를 추가하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  // 사용자 수정
  const handleUpdateUser = async () => {
    if (!validateForm(true) || !currentUser || !hasPermission("users", "edit")) return

    try {
      const updates = {
        name: formName,
        email: formEmail,
        role: formRole,
        permissions: formPermissions,
        ...(formPassword ? { password: formPassword } : {}),
      }

      await updateUser(currentUser.id, updates)
      addToast({
        title: "사용자 수정 완료",
        description: `${formName} 사용자 정보가 수정되었습니다.`,
      })
      resetForm()
      setCurrentUser(null)
      setEditDialogOpen(false)
    } catch (error) {
      console.error('Error updating user:', error)
      addToast({
        title: "사용자 수정 실패",
        description: "사용자를 수정하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  // 권한 수정
  const handleUpdatePermissions = async () => {
    if (!currentUser || !hasPermission("users", "edit")) return

    try {
      await updateUser(currentUser.id, { permissions: formPermissions })
      addToast({
        title: "권한 수정 완료",
        description: `${currentUser.name} 사용자의 권한이 수정되었습니다.`,
      })
      setCurrentUser(null)
      setPermissionsDialogOpen(false)
    } catch (error) {
      console.error('Error updating permissions:', error)
      addToast({
        title: "권한 수정 실패",
        description: "권한을 수정하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  // 사용자 삭제
  const handleDeleteUser = async () => {
    if (!currentUser || !hasPermission("users", "edit")) return

    try {
      await deleteUser(currentUser.id)
      addToast({
        title: "사용자 삭제 완료",
        description: `${currentUser.name} 사용자가 삭제되었습니다.`,
        variant: "destructive",
      })
      setCurrentUser(null)
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error('Error deleting user:', error)
      addToast({
        title: "사용자 삭제 실패",
        description: "사용자를 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  // 사용자 상태 토글
  const handleToggleStatus = async (user: typeof users[0]) => {
    if (!hasPermission("users", "edit")) return

    try {
      const newStatus = user.status === "active" ? "inactive" : "active"
      await updateUser(user.id, { status: newStatus })
      addToast({
        title: "사용자 상태 변경",
        description: `${user.name} 사용자가 ${newStatus === "active" ? "활성화" : "비활성화"} 되었습니다.`,
      })
    } catch (error) {
      console.error('Error toggling user status:', error)
      addToast({
        title: "상태 변경 실패",
        description: "사용자 상태를 변경하는 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }
  }

  // 권한 요약 정보
  const getPermissionSummary = (user: typeof users[0]) => {
    const currentPagePermissions = user.permissions.filter((p) => PAGES.some((page) => page.id === p.page))
    const viewCount = currentPagePermissions.filter((p) => p.view).length
    const editCount = currentPagePermissions.filter((p) => p.edit).length

    return (
      <div className="flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-xs">
          보기 {viewCount}/{PAGES.length}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          편집 {editCount}/{PAGES.length}
        </Badge>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          <span>사용자 정보를 불러오는 중...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">사용자 관리</h1>
        <p className="text-muted-foreground">사용자 계정 및 권한 관리</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="사용자 검색..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Button onClick={handleOpenAddDialog} disabled={!hasPermission("users", "edit")}>
          <UserPlus className="mr-2 h-4 w-4" />
          사용자 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>시스템 사용자 계정 및 권한 관리</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>사용자</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>권한</TableHead>
                <TableHead>관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.status === "active"}
                        onCheckedChange={() => handleToggleStatus(user)}
                        disabled={!hasPermission("users", "edit")}
                      />
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>
                        {user.status === "active" ? "활성" : "비활성"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{getPermissionSummary(user)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditDialog(user)}
                        disabled={!hasPermission("users", "edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDeleteDialog(user)}
                        disabled={!hasPermission("users", "edit")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "검색 결과가 없습니다." : "등록된 사용자가 없습니다."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 사용자 추가 다이얼로그 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 사용자 추가</DialogTitle>
            <DialogDescription>
              새 사용자 계정을 생성하고 권한을 설정하세요.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">기본 정보</TabsTrigger>
              <TabsTrigger value="permissions">권한 설정</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="add-name">이름 *</Label>
                  <Input
                    id="add-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={formErrors.name && formSubmitAttempted ? "border-red-500" : ""}
                  />
                  {formErrors.name && formSubmitAttempted && (
                    <p className="text-sm text-red-500">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="add-email">이메일 *</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className={formErrors.email && formSubmitAttempted ? "border-red-500" : ""}
                  />
                  {formErrors.email && formSubmitAttempted && (
                    <p className="text-sm text-red-500">{formErrors.email}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="add-password">비밀번호 *</Label>
                  <Input
                    id="add-password"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className={formErrors.password && formSubmitAttempted ? "border-red-500" : ""}
                  />
                  {formErrors.password && formSubmitAttempted && (
                    <p className="text-sm text-red-500">{formErrors.password}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>역할 및 권한 템플릿</Label>
                  <div className="mt-2 flex gap-2">
                    <select
                      value={formRole}
                      onChange={(e) => {
                        setFormRole(e.target.value);
                        const templateId = ROLE_TO_TEMPLATE[e.target.value];
                        handleApplyTemplate(templateId);
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="viewer">뷰어</option>
                      <option value="manager">매니저</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>
                </div>

                {/* 비밀번호 에러 메시지 항상 표시 */}
                {formErrors.password && formSubmitAttempted && (
                  <p className="text-sm text-red-500">{formErrors.password}</p>
                )}

                <Separator />

                <div className="space-y-4">
                  <Label>페이지별 권한</Label>
                  {PAGES.map((page) => {
                    const permission = formPermissions.find((p) => p.page === page.id)
                    return (
                      <div key={page.id} className="flex items-center justify-between p-2 border rounded">
                        <span>{page.name}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${page.id}-view`}
                              checked={permission?.view || false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(page.id, "view", checked === true)
                              }
                            />
                            <Label htmlFor={`${page.id}-view`}>보기</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${page.id}-edit`}
                              checked={permission?.edit || false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(page.id, "edit", checked === true)
                              }
                            />
                            <Label htmlFor={`${page.id}-edit`}>편집</Label>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddUser}>사용자 추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 사용자 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>사용자 정보 수정</DialogTitle>
            <DialogDescription>
              사용자 정보를 수정하세요.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">기본 정보</TabsTrigger>
              <TabsTrigger value="permissions">권한 설정</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">이름 *</Label>
                  <Input
                    id="edit-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={formErrors.name && formSubmitAttempted ? "border-red-500" : ""}
                  />
                  {formErrors.name && formSubmitAttempted && (
                    <p className="text-sm text-red-500">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-email">이메일 *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className={formErrors.email && formSubmitAttempted ? "border-red-500" : ""}
                  />
                  {formErrors.email && formSubmitAttempted && (
                    <p className="text-sm text-red-500">{formErrors.email}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-password">새 비밀번호 (변경 시에만 입력)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="변경하지 않으려면 비워두세요"
                  />
                  {formErrors.password && formSubmitAttempted && (
                    <p className="text-sm text-red-500">{formErrors.password}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>권한 템플릿</Label>
                  <div className="mt-2 flex gap-2">
                    {PERMISSION_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        variant={selectedTemplate === template.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleApplyTemplate(template.id)}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>페이지별 권한</Label>
                  {PAGES.map((page) => {
                    const permission = formPermissions.find((p) => p.page === page.id)
                    return (
                      <div key={page.id} className="flex items-center justify-between p-2 border rounded">
                        <span>{page.name}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-${page.id}-view`}
                              checked={permission?.view || false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(page.id, "view", checked === true)
                              }
                            />
                            <Label htmlFor={`edit-${page.id}-view`}>보기</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-${page.id}-edit`}
                              checked={permission?.edit || false}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(page.id, "edit", checked === true)
                              }
                            />
                            <Label htmlFor={`edit-${page.id}-edit`}>편집</Label>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdateUser}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 권한 수정 다이얼로그 */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>권한 수정</DialogTitle>
            <DialogDescription>
              {currentUser?.name} 사용자의 권한을 수정하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>권한 템플릿</Label>
              <div className="mt-2 flex gap-2">
                {PERMISSION_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedTemplate === template.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>페이지별 권한</Label>
              {PAGES.map((page) => {
                const permission = formPermissions.find((p) => p.page === page.id)
                return (
                  <div key={page.id} className="flex items-center justify-between p-2 border rounded">
                    <span>{page.name}</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`perm-${page.id}-view`}
                          checked={permission?.view || false}
                          onCheckedChange={(checked) =>
                            handlePermissionChange(page.id, "view", checked === true)
                          }
                        />
                        <Label htmlFor={`perm-${page.id}-view`}>보기</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`perm-${page.id}-edit`}
                          checked={permission?.edit || false}
                          onCheckedChange={(checked) =>
                            handlePermissionChange(page.id, "edit", checked === true)
                          }
                        />
                        <Label htmlFor={`perm-${page.id}-edit`}>편집</Label>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdatePermissions}>권한 저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 삭제</DialogTitle>
            <DialogDescription>
              {currentUser?.name} 사용자를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
