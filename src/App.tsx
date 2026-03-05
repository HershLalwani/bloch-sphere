import { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { BlochSphere } from './components/BlochSphere';
import type { GateAction } from './components/BlochSphere';
import './index.css';

function App() {
  const [gateQueue, setGateQueue] = useState<GateAction[]>([]);
  const [resetFlag, setResetFlag] = useState(0);

  const applyGate = (axis: THREE.Vector3, angle: number) => {
    setGateQueue((prev) => [...prev, { axis, angle, id: Date.now() + Math.random() }]);
  };

  const handleGateComplete = useCallback((id: number) => {
    setGateQueue((prev) => prev.filter((gate) => gate.id !== id));
  }, []);

  const applyX = () => applyGate(new THREE.Vector3(1, 0, 0), Math.PI);
  const applyY = () => applyGate(new THREE.Vector3(0, 1, 0), Math.PI);
  const applyZ = () => applyGate(new THREE.Vector3(0, 0, 1), Math.PI);
  const applyH = () => applyGate(new THREE.Vector3(1, 0, 1), Math.PI); // Hadamard roughly equivalent (X+Z)/sqrt(2)
  const applyT = () => applyGate(new THREE.Vector3(0, 0, 1), Math.PI / 4); // T gate (pi/4 around Z)

  const reset = () => {
    setGateQueue([]);
    setResetFlag((prev) => prev + 1);
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <h1>Bloch Sphere</h1>
        <div className="gates">
          <button onClick={applyX}>X Gate (NOT)</button>
          <button onClick={applyY}>Y Gate</button>
          <button onClick={applyZ}>Z Gate (Phase Flip)</button>
          <button onClick={applyH}>H Gate (Hadamard)</button>
          <button onClick={applyT}>T Gate (π/4 Phase)</button>
          <button onClick={reset} className="reset-btn">Reset to |0⟩</button>
        </div>
        <div className="instructions">
          <p>Drag to rotate the sphere.</p>
          <p>Scroll to zoom.</p>
        </div>
      </div>
      <div className="canvas-container">
        <Canvas camera={{ position: [4, 3, 5] }}>
          <color attach="background" args={['#121212']} />
          <ambientLight intensity={0.8} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <OrbitControls makeDefault />
          <BlochSphere
            key={resetFlag}
            gateQueue={gateQueue}
            onGateComplete={handleGateComplete}
          />
        </Canvas>
      </div>
    </div>
  );
}

export default App;
