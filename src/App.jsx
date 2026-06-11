import { Routes, Route } from 'react-router-dom'
import Navbar from "./components/Navbar";
import HomePage from './pages/HomePage'
import ConvertPage from './pages/ConvertPage'
import BgRemovePage from './pages/BgRemovePage'
import ResizePage from './pages/ResizePage'
import SvgConverterPage from './pages/SvgConverterPage'

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/convert" element={<ConvertPage />} />
        <Route path="/svg-converter" element={<SvgConverterPage />} />
        <Route path="/remove-bg" element={<BgRemovePage />} />
        <Route path="/resize" element={<ResizePage />} />
      </Routes>

    </>
    
  )
}

export default App;