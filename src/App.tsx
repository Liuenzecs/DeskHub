import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppRouter } from './app/AppRouter'
import { ItemsProvider } from './app/ItemsContext'

function App() {
  return (
    <ItemsProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
    </ItemsProvider>
  )
}

export default App
