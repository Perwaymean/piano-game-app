import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SettingsContextProvider } from './context/SettingsContext'
import { AudioContextProvider } from './context/AudioContextProvider'
import { ToastProvider } from './components/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsContextProvider>
      <ToastProvider>
        <AudioContextProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </AudioContextProvider>
      </ToastProvider>
    </SettingsContextProvider>
  </StrictMode>,
)
