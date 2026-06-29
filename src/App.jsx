import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase, trackSession } from './lib/supabase'
import Navbar from "./components/Navbar";
import HomePage from './pages/HomePage'
import UpscalePage from './pages/UpscalePage'
import BgRemovePage from './pages/BgRemovePage'
import ResizePage from './pages/ResizePage'
import SvgConverterPage from './pages/SvgConverterPage'
import Pricing from './pages/PricingPage'
import Auth from './pages/Auth'
import Account from './pages/Account'


function App() {
  useEffect(() => {
    // Track session on page load (returning users)
    trackSession()

    // Track session whenever someone signs in fresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') trackSession()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upscale" element={<UpscalePage />} />
        <Route path="/svg-converter" element={<SvgConverterPage />} />
        <Route path="/remove-bg" element={<BgRemovePage />} />
        <Route path="/resize" element={<ResizePage />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />
        <Route path="/account" element={<Account />} />
      </Routes>
    </>
  )
}

export default App;