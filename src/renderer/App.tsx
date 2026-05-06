import { useState } from 'react'
import LoginScreen from './components/LoginScreen'
import GameWindow from './components/GameWindow'
import { GroupsProvider } from './components/GroupsContext'

type Screen = 'login' | 'game'

export default function App() {
  const [screen, setScreen] = useState<Screen>('login')

  return (
    <GroupsProvider>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        {screen === 'login' && (
          <LoginScreen onConnected={() => setScreen('game')} />
        )}
        {screen === 'game' && (
          <GameWindow onDisconnect={() => setScreen('login')} />
        )}
      </div>
    </GroupsProvider>
  )
}
