import { createRoot } from 'react-dom/client'
import { App } from '@/app'
import { AppProviders } from '@/app/providers'
import '@/app/styles/main.scss'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element was not found')
}

createRoot(rootElement).render(
  <AppProviders>
    <App />
  </AppProviders>,
)
