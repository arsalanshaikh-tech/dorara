'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth-store'
import { getMe } from '@/lib/services/auth-service'
import { USE_MOCKS } from '@/lib/api/client'

/**
 * Restores the signed-in user from the httpOnly session cookie once per page load, so pages
 * outside the authenticated app shell (the trip planner, My Trips) know who is signed in.
 * Guests simply stay guests: a 401 here is normal and silent.
 */
export function AuthBootstrap() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (USE_MOCKS || user) return
    let active = true
    getMe()
      .then((u) => {
        if (active) setUser(u)
      })
      .catch(() => {
        /* signed out */
      })
    return () => {
      active = false
    }
    // Run once on mount; `user` is only read to skip the call when already known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
