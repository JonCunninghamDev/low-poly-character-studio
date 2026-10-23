import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LandingExperience } from './LandingExperience'
import { StudioShell } from './StudioShell'
import { MinimalStudio } from './MinimalStudio'
import { installCanvasNativeScroll } from './canvas-native-scroll'
import './styles.css'
import './canvas-native-scroll.css'
import './landing-experience.css'
import './guided-generation-workflow.css'
import './product-responsive-reflow.css'
import './studio-simplification.css'

installCanvasNativeScroll()

function guestRouteRequested() {
  return new URLSearchParams(window.location.search).get('guest') === '1'
}

function App() {
  const advanced = new URLSearchParams(window.location.search).get('advanced') === '1'
  const [guestStarted, setGuestStarted] = useState(guestRouteRequested)

  if (!advanced) return <MinimalStudio />

  if (guestStarted) {
    return <StudioShell />
  }

  return <LandingExperience onContinueAsGuest={() => setGuestStarted(true)} />
}

createRoot(document.getElementById('root')!).render(<App />)
