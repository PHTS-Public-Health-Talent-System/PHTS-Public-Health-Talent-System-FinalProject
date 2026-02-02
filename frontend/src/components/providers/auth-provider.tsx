"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const router = useRouter()

  const logout = React.useCallback(() => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setUser(null)
    router.push("/login")
  }, [router])

  // 1. Check User on Mount
  React.useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token")

      if (token) {
        try {
          // Verify token with backend
          const { data } = await api.get<ApiResponse<User>>('/auth/me')
          if (data.success) {
             setUser(data.data)
             localStorage.setItem("user", JSON.stringify(data.data))
          } else {
             throw new Error("Failed to fetch user");
          }
        } catch (error) {
          console.error("Token expired or invalid:", error)
          logout()
        }
      } else {
        // No token found
        setUser(null)
      }
      setIsLoading(false)
    }

    initAuth()
  }, [logout])

  // 2. Login Function
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

        localStorage.setItem("token", token)
        localStorage.setItem("user", JSON.stringify(user))

        setUser(user)

        // Redirect based on Role
        const role = user.role
        if (role === 'USER') router.push('/dashboard/user')
        else if (role === 'HEAD_WARD') router.push('/dashboard/head-ward')
        else if (role === 'PTS_OFFICER') router.push('/dashboard/pts-officer')
        else if (role === 'DIRECTOR') router.push('/dashboard/director')
        else if (role === 'HEAD_HR') router.push('/dashboard/head-hr')
        else if (role === 'HEAD_FINANCE') router.push('/dashboard/head-finance')
        else if (role === 'FINANCE_OFFICER') router.push('/dashboard/finance-officer')
        else if (role === 'ADMIN') router.push('/dashboard/admin')
        else router.push('/dashboard') // Default
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
