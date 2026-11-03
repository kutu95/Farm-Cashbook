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
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      right: '20px',
      backgroundColor: '#16a34a',
      color: 'white',
      padding: '1rem',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
          Install Farm Cashbook
        </div>
        <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
          Add to your home screen for quick access
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={handleInstallClick}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'white',
            color: '#16a34a',
            border: 'none',
            borderRadius: '0.375rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid white',
            borderRadius: '0.375rem',
            cursor: 'pointer'
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
