import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Investors from './pages/Investors'
import Regulators from './pages/Regulators'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/investors" element={<Investors />} />
      <Route path="/regulators" element={<Regulators />} />
    </Routes>
  )
}


