"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import api from "@/shared/api/axios"
import { User } from "@/types/auth"
import type { ApiResponse } from "@/shared/api/types"

type LoginCredentials = {
  citizen_id: string
  password: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)
const TOKEN_COOKIE_KEY = "phts_token"

function setTokenCookie(token: string) {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure}`
}

function clearTokenCookie() {
  if (typeof document === "undefined") return
  document.cookie = `${TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`
}

function getRoleHomePath(role: User["role"]): string {
  switch (role) {
    case "USER":
      return "/user"
    case "HEAD_WARD":
      return "/head-ward"
    case "HEAD_DEPT":
      return "/head-dept"
    case "PTS_OFFICER":
      return "/pts-officer"
    case "DIRECTOR":
      return "/director"
    case "HEAD_HR":
      return "/head-hr"
    case "HEAD_FINANCE":
      return "/head-finance"
    case "FINANCE_OFFICER":
      return "/finance-officer"
    case "ADMIN":
      return "/admin"
    default:
      return "/"
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const tokenKey = "phts_token"
  const userKey = "phts_user"

  const logout = React.useCallback(() => {
    localStorage.removeItem(tokenKey)
    localStorage.removeItem(userKey)
    clearTokenCookie()
    setUser(null)
    router.push("/login")
  }, [router, tokenKey, userKey])

  const refreshCurrentUser = React.useCallback(async () => {
    const token = localStorage.getItem(tokenKey)
    if (!token) {
      setUser(null)
      return null
    }
    setTokenCookie(token)

    const { data } = await api.get<ApiResponse<User>>("/auth/me")
    if (!data.success || !data.data) {
      throw new Error("Failed to fetch user")
    }

    setUser(data.data)
    localStorage.setItem(userKey, JSON.stringify(data.data))
    return data.data
  }, [tokenKey, userKey])

  // 1. Check User on Mount
  React.useEffect(() => {
    const initAuth = async () => {
      try {
        await refreshCurrentUser()
      } catch (error) {
        console.error("Token expired or invalid:", error)
        logout()
      } finally {
        setIsLoading(false)
      }
    }

    void initAuth()
  }, [logout, refreshCurrentUser])

  // 2. Refresh user on tab focus / visibility to detect role changes from backend.
  React.useEffect(() => {
    const shouldSkip = !localStorage.getItem(tokenKey) || isLoading
    if (shouldSkip) return

    const syncUser = async () => {
      try {
        await refreshCurrentUser()
      } catch {
        logout()
      }
    }

    const onFocus = () => {
      void syncUser()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncUser()
      }
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [isLoading, logout, refreshCurrentUser, tokenKey])

  // 3. Enforce route by current role so layout/sidebar always match active user.
  React.useEffect(() => {
    if (isLoading || !user) return
    const roleHome = getRoleHomePath(user.role)
    if (pathname === "/login") {
      router.replace(roleHome)
      return
    }
    if (pathname !== roleHome && !pathname.startsWith(`${roleHome}/`)) {
      router.replace(roleHome)
    }
  }, [isLoading, pathname, router, user])

  // 4. Login Function
  const login = async (credentials: LoginCredentials) => {
    try {
      // credentials should contain { citizen_id, password }
      const { data } = await api.post<ApiResponse<{ token: string; user: User }>>("/auth/login", credentials)

      // Backend returns { success, token, user } (no nested data)
      if (data.success) {
        const token = (data as unknown as { token?: string }).token ?? data.data?.token
        const user = (data as unknown as { user?: User }).user ?? data.data?.user
        if (!token || !user) {
          throw new Error("Login response missing token or user")
        }

        localStorage.setItem(tokenKey, token)
        localStorage.setItem(userKey, JSON.stringify(user))
        setTokenCookie(token)

        setUser(user)

        // Redirect based on current role
        router.push(getRoleHomePath(user.role))
      } else {
         throw new Error(data.error || "Login failed");
      }

    } catch (error: unknown) {
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook for usage
export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
