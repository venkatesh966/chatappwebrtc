import Chat from './components/Chat'
import './App.css'

function App() {
  return (
    <div
      className="app-fancy-bg"
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        background: 'linear-gradient(135deg, #4f8cff 0%, #3ff57a 100%)',
        backgroundAttachment: 'fixed',
        overflow: 'hidden',
      }}
    >
      <h1
        style={{
          marginTop: 38,
          marginBottom: 18,
          fontSize: 44,
          fontWeight: 900,
          letterSpacing: 1.5,
          color: '#fff',
          textShadow: '0 6px 32px rgba(60,60,60,0.25), 0 1px 0 #3b6be0',
          fontFamily: 'inherit',
        }}
      >
        Vibe Connect
      </h1>
      <Chat boxWidth={550} />
    </div>
  )
}

export default App
