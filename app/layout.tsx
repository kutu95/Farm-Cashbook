import { Providers } from '@/app/providers'
import "@/styles/globals.css"
import PWAInstallPrompt from '@/components/PWAInstallPrompt'

export const metadata = {
  title: 'Farm Cashbook',
  description: 'Manage your farm finances with ease - track expenses, payments, and generate statements.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16a34a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <PWAInstallPrompt />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && typeof window !== 'undefined') {
                window.addEventListener('load', function() {
                  // Check if we're in development mode by looking at the hostname
                  const isDevelopment = window.location.hostname === 'localhost' || 
                                      window.location.hostname === '127.0.0.1' || 
                                      window.location.hostname.includes('localhost');
                  
                  // Only register service worker in production or when explicitly enabled
                  if (!isDevelopment || window.location.search.includes('sw=true')) {
                    // Detect basePath from current URL path
                    const pathParts = window.location.pathname.split('/').filter(p => p);
                    const basePath = pathParts.length > 0 && pathParts[0] !== 'dashboard' && pathParts[0] !== 'login' 
                      ? '/' + pathParts[0] 
                      : '';
                    navigator.serviceWorker.register((basePath || '') + '/sw.js')
                      .then(function(registration) {
                        console.log('SW registered: ', registration);
                        // Check for updates
                        registration.addEventListener('updatefound', function() {
                          const newWorker = registration.installing;
                          if (newWorker) {
                            newWorker.addEventListener('statechange', function() {
                              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New content is available, reload the page
                                window.location.reload();
                              }
                            });
                          }
                        });
                      })
                      .catch(function(registrationError) {
                        console.warn('SW registration failed: ', registrationError);
                      });
                  } else {
                    console.log('Service worker registration skipped in development mode');
                    // Unregister any existing service worker in development
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      for(let registration of registrations) {
                        registration.unregister();
                        console.log('Unregistered existing service worker');
                      }
                    });
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
