import { create } from 'zustand'
import type { AuthUser } from '@/lib/services/auth-service'

type AuthState = {
  user: AuthUser | null
  isAuthenticated: boolean
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

/**
 * Lightweight Zustand auth slice. After a successful login the user returned
 * from GET /api/v1/users/me is stored here for the rest of the app to read.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
  logout: () => set({ user: null, isAuthenticated: false }),
}))
