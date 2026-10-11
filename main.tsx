import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/noto-sans-thai/thai-400.css'
import '@fontsource/noto-sans-thai/thai-600.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
