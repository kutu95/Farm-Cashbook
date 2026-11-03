'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'farm-cashbook-pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isInstalledApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Storage can be blocked in private mode. The banner still hides for this visit.
  }
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      if (isInstalledApp() || wasDismissed()) return
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallPrompt(true)
    }

    const handleAppInstalled = () => {
      rememberDismiss()
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'dismissed') {
      rememberDismiss()
    }

    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    rememberDismiss()
    setDeferredPrompt(null)
    setShowInstallPrompt(false)
  }

  if (!showInstallPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-800 bg-primary px-4 py-3 text-primary-foreground md:bottom-6 md:left-auto md:right-6 md:max-w-md">
      <div>
        <div className="font-semibold">Install Farm Cashbook</div>
        <div className="text-sm text-primary-foreground/90">Add to your home screen for quick access</div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleInstallClick}
          className="rounded-md bg-white px-3 py-2 text-sm font-medium text-green-800"
        >
          Install
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md border border-white/70 px-3 py-2 text-sm"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
