import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import FreePlay from './pages/FreePlay'
import FollowPlay from './pages/FollowPlay'
import AiTranscription from './pages/AiTranscription'
import SongLibrary from './pages/SongLibrary'
import Results from './pages/Results'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/free-play" element={<FreePlay />} />
        <Route path="/follow-play" element={<FollowPlay />} />
        <Route path="/ai-transcription" element={<AiTranscription />} />
        <Route path="/library" element={<SongLibrary />} />
        <Route path="/results" element={<Results />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
