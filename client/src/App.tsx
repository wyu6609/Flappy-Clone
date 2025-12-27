import FlappyBird from "./components/FlappyBird";
import "@fontsource/inter";

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <FlappyBird />
    </div>
  );
}

export default App;
