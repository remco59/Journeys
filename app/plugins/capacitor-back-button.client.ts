import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

// Maps the Android hardware/gesture back button to WebView history, and
// exits the app from the root instead of leaving a blank WebView behind.
export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) return

  CapacitorApp.addListener('backButton', () => {
    if (window.history.state?.back) {
      window.history.back()
    } else {
      CapacitorApp.exitApp()
    }
  })
})
