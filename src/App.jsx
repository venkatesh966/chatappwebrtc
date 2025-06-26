import Chat from './components/Chat'
import './App.css'

function App() {
  return (
    <div
      className="app-fancy-bg"
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        background: 'linear-gradient(135deg, #4f8cff 0%, #3ff57a 100%)',
        backgroundAttachment: 'fixed',
        overflowX: 'hidden',
        overflowY: 'auto',
        paddingBottom: '20px',
      }}
    >
      <h1
        style={{
          marginTop: 18,
          marginBottom: 18,
          fontSize: 40,
          fontWeight: 900,
          letterSpacing: 1.5,
          fontFamily: 'inherit',
          color: '#FFFFFF',
          textShadow: '0 3px 8px rgba(0, 0, 0, 0.35)',
        }}
      >
        NoBridge
      </h1>
      <p
        className="animated-tagline"
        style={{
          marginTop: -10,
          marginBottom: 8,
          fontSize: 15,
          fontWeight: 500,
          color: '#F0F9FF',
          textAlign: 'center',
          letterSpacing: 0.5,
          textShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
          opacity: 0, // Will animate to 1
        }}
      >
        Seamless Connect. Instant Share. Free Chat. Direct Call.
      </p>
      <div style={{ marginBottom: '16px' }}>
        <Chat boxWidth={550} />
      </div>
      
      {/* Page Footer */}
      <footer
        style={{
          marginTop: 'auto',
          paddingTop: '20px',
          paddingBottom: '10px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 400,
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
          }}
        >
          Built by Venkatesh Morpoju ⚡ 2025 • v1.3
        </p>
      </footer>
    </div>
  )
}

export default App
