import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let removeWorkerListeners = () => {}
  let pageIsHidden = false
  let currentRegistration: ServiceWorkerRegistration | undefined
  const setWaitingState = (waiting: boolean) => {
    window.__notegameUpdateWaiting = waiting
    window.dispatchEvent(new Event(waiting ? 'notegame:sw-update-waiting' : 'notegame:sw-update-activated'))
  }
  const installWorkerListeners = (registration: ServiceWorkerRegistration) => {
    removeWorkerListeners()
    let active = true
    const pendingStateListeners = new Set<() => void>()
    const syncWaitingState = () => {
      if (active) setWaitingState(Boolean(navigator.serviceWorker.controller && registration.waiting))
    }
    const onControllerChange = () => syncWaitingState()
    const onUpdateFound = () => {
      const installing = registration.installing
      if (!installing) return
      const onStateChange = () => {
        if (installing.state === 'installed') syncWaitingState()
        if (installing.state === 'installed' || installing.state === 'redundant') {
          installing.removeEventListener('statechange', onStateChange)
          pendingStateListeners.delete(cleanupStateListener)
        }
      }
      const cleanupStateListener = () => installing.removeEventListener('statechange', onStateChange)
      pendingStateListeners.add(cleanupStateListener)
      installing.addEventListener('statechange', onStateChange)
    }
    registration.addEventListener('updatefound', onUpdateFound)
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    removeWorkerListeners = () => {
      if (!active) return
      active = false
      registration.removeEventListener('updatefound', onUpdateFound)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      pendingStateListeners.forEach((removeListener) => removeListener())
      pendingStateListeners.clear()
    }
    syncWaitingState()
  }
  const onPageHide = () => { pageIsHidden = true; removeWorkerListeners() }
  const onPageShow = () => {
    pageIsHidden = false
    if (currentRegistration) installWorkerListeners(currentRegistration)
  }
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).then((registration) => {
      currentRegistration = registration
      if (!pageIsHidden) installWorkerListeners(registration)
    }).catch(() => {})
  }, { once: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

