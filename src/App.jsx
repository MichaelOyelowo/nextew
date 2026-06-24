import { Routes, Route } from 'react-router-dom'
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