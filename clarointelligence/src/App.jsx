import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MapaAtrito from './pages/MapaAtrito'
import MonitorConversas from './pages/MonitorConversas'
import LogClaroSense from './pages/LogClaroSense'
import GestaoPersonas from './pages/GestaoPersonas'
import PerfisUsuario from './pages/PerfisUsuario'
import ChatCliente from './pages/ChatCliente'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="mapa-atrito" element={<MapaAtrito />} />
          <Route path="monitor-conversas" element={<MonitorConversas />} />
          <Route path="log-clarosense" element={<LogClaroSense />} />
          <Route path="gestao-personas" element={<GestaoPersonas />} />
          <Route path="perfis-usuario" element={<PerfisUsuario />} />
          <Route path="chat" element={<ChatCliente />} />
          <Route path="configuracoes" element={
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              Configurações — em desenvolvimento
            </div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
