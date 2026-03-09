import { useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { BlochSphere } from './components/BlochSphere';
import type { GateAction } from './components/BlochSphere';
import './index.css';

function App() {
  const [gateQueue, setGateQueue] = useState<GateAction[]>([]);
  const [resetFlag, setResetFlag] = useState(0);
  const [customSequence, setCustomSequence] = useState('');

  // Solovay-Kitaev Approximation State
  const [targetTheta, setTargetTheta] = useState(90);
  const [targetPhi, setTargetPhi] = useState(0);
  const [epsilon, setEpsilon] = useState(0.1);
  const [foundSequence, setFoundSequence] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [dotSize, setDotSize] = useState(0.03);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const START_STATES: Record<string, THREE.Vector3> = useMemo(() => ({
    '|0>': new THREE.Vector3(0, 0, 1),
    '|1>': new THREE.Vector3(0, 0, -1),
    '|+>': new THREE.Vector3(1, 0, 0),
    '|->': new THREE.Vector3(-1, 0, 0),
    '|i>': new THREE.Vector3(0, 1, 0),
    '|-i>': new THREE.Vector3(0, -1, 0),
  }), []);

  const [startStateKey, setStartStateKey] = useState<string>('|0>');
  const startState = START_STATES[startStateKey] || START_STATES['|0>'];

  const applyGate = (axis: THREE.Vector3, angle: number) => {
    setGateQueue((prev) => [...prev, { axis, angle, id: Date.now() + Math.random() }]);
  };

  const handleGateComplete = useCallback((id: number) => {
    setGateQueue((prev) => prev.filter((gate) => gate.id !== id));
  }, []);

  const H_AXIS = new THREE.Vector3(1, 0, 1).normalize();
  const Z_AXIS = new THREE.Vector3(0, 0, 1);

  const applyX = () => applyGate(new THREE.Vector3(1, 0, 0), Math.PI);
  const applyY = () => applyGate(new THREE.Vector3(0, 1, 0), Math.PI);
  const applyZ = () => applyGate(Z_AXIS, Math.PI);
  const applyH = () => applyGate(H_AXIS, Math.PI);
  const applyS = () => applyGate(Z_AXIS, Math.PI / 2);
  const applySdg = () => applyGate(Z_AXIS, -Math.PI / 2);
  const applyT = () => applyGate(Z_AXIS, Math.PI / 4);
  const applyTdg = () => applyGate(Z_AXIS, -Math.PI / 4);
  const applyRx2 = () => applyGate(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const applyRy2 = () => applyGate(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const applyRz2 = () => applyGate(Z_AXIS, Math.PI / 2);

  const applyCustomSequence = () => {
    const chars = customSequence.split('');
    const newGates: GateAction[] = [];

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i].toUpperCase();
      let axis: THREE.Vector3 | undefined;
      let angle = 0;

      if (char === 'H') { axis = H_AXIS; angle = Math.PI; }
      else if (char === 'T') {
        axis = Z_AXIS;
        if (chars[i+1] === '†' || chars[i+1] === '!' || chars[i+1] === 'i') {
          angle = -Math.PI / 4;
          i++;
        } else {
          angle = Math.PI / 4;
        }
      }
      else if (char === 'S') {
        axis = Z_AXIS;
        if (chars[i+1] === '†' || chars[i+1] === '!' || chars[i+1] === 'i') {
          angle = -Math.PI / 2;
          i++;
        } else {
          angle = Math.PI / 2;
        }
      }
      else if (char === 'X') { axis = new THREE.Vector3(1, 0, 0); angle = Math.PI; }
      else if (char === 'Y') { axis = new THREE.Vector3(0, 1, 0); angle = Math.PI; }
      else if (char === 'Z') { axis = Z_AXIS; angle = Math.PI; }

      if (axis) {
        newGates.push({ axis, angle, id: Date.now() + Math.random() + i });
      }
    }

    if (newGates.length > 0) {
      // Calculate overall transformation
      const overallQuat = new THREE.Quaternion(); // Identity quaternion
      for (const gate of newGates) {
        const q = new THREE.Quaternion().setFromAxisAngle(gate.axis, gate.angle);
        overallQuat.premultiply(q); // premultiply because applyQuaternion does q * v * q^-1, so q2 * (q1 * v * q1^-1) * q2^-1 = (q2 * q1) * v * (q2 * q1)^-1
      }

      const startVec = startState.clone();
      const endVec = startVec.clone().applyQuaternion(overallQuat);
      console.log('--- Custom Sequence Overall Transformation ---');
      console.log('Combined Quaternion:', overallQuat);
      console.log(`Position after sequence (from ${startStateKey}):`, endVec);

      // Ensure shortest path for animation (w >= 0)
      if (overallQuat.w < 0) {
        overallQuat.x = -overallQuat.x;
        overallQuat.y = -overallQuat.y;
        overallQuat.z = -overallQuat.z;
        overallQuat.w = -overallQuat.w;
      }

      // Convert combined quaternion to an axis and angle
      const singleAngle = 2 * Math.acos(Math.max(-1, Math.min(1, overallQuat.w)));
      const singleAxis = new THREE.Vector3(1, 0, 0);
      const s = Math.sqrt(1 - overallQuat.w * overallQuat.w);

      if (s > 0.0001) {
        singleAxis.set(overallQuat.x / s, overallQuat.y / s, overallQuat.z / s).normalize();
      }

      setGateQueue((prev) => [
        ...prev,
        { axis: singleAxis, angle: singleAngle, id: Date.now() + Math.random() }
      ]);
    }
  };

  const solveSK = () => {
    setIsSearching(true);
    setFoundSequence([]);

    const tTheta = (targetTheta * Math.PI) / 180;
    const tPhi   = (targetPhi   * Math.PI) / 180;
    const targetVec = new THREE.Vector3(
      Math.sin(tTheta) * Math.cos(tPhi),
      Math.sin(tTheta) * Math.sin(tPhi),
      Math.cos(tTheta)
    );

    const hQuat   = new THREE.Quaternion().setFromAxisAngle(H_AXIS, Math.PI);
    const tQuat   = new THREE.Quaternion().setFromAxisAngle(Z_AXIS,  Math.PI / 4);
    const tdgQuat = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -Math.PI / 4);

    const startVec = startState.clone();

    type Gate = { name: string; quat: THREE.Quaternion };
    const gates: Gate[] = [
      { name: 'H',  quat: hQuat   },
      { name: 'T',  quat: tQuat   },
      { name: 'T†', quat: tdgQuat },
    ];

    let bestSeq: string[] = [];
    let minError = Infinity;
    const startTime = performance.now();
    const TIME_LIMIT_MS = 2000;

    /**
     * Canonical relation-based pruning for the {H, T, T†} gate set:
     *   H·H  = I           → no two consecutive H
     *   T·T† = I           → T may not follow T†, and vice-versa
     *   T^8  = I           → run of identical T / T† capped at 7
     */
    const canAppend = (seq: string[], next: string): boolean => {
      const n = seq.length;
      if (n === 0) return true;
      const last = seq[n - 1];

      if (next === 'H'  && last === 'H' ) return false;   // H² = I
      if (next === 'T'  && last === 'T†') return false;   // T·T† = I
      if (next === 'T†' && last === 'T' ) return false;   // T†·T = I

      // T^8 = I  →  run of the same T-type must stay < 8
      if (next === 'T' || next === 'T†') {
        let run = 0;
        for (let i = n - 1; i >= 0 && seq[i] === next; i--) run++;
        if (run >= 7) return false;
      }

      return true;
    };

    /**
     * Iterative-Deepening DFS (IDDFS).
     *
     * For each increasing depth limit we do a full DFS, returning as soon as
     * a sequence whose endpoint sits within ε of the target is found.
     * Because we enumerate depth 0, 1, 2, … in order, the *first* solution
     * encountered is guaranteed to be the shortest (minimum-length string).
     *
     * Memory usage is O(maxDepth) — vastly better than BFS O(3^maxDepth).
     */
    const dfs = (
      quat: THREE.Quaternion,
      seq: string[],
      maxDepth: number
    ): boolean => {
      if (performance.now() - startTime > TIME_LIMIT_MS) return false;

      const currentVec = startVec.clone().applyQuaternion(quat);
      const error = currentVec.distanceTo(targetVec);

      // Track global best across all depths (fallback if ε never reached)
      if (error < minError) {
        minError = error;
        bestSeq  = [...seq];
      }

      if (error < epsilon) return true;          // ← solution found
      if (seq.length >= maxDepth) return false;  // ← depth budget exhausted

      for (const gate of gates) {
        if (!canAppend(seq, gate.name)) continue;

        seq.push(gate.name);
        const nextQuat = quat.clone().premultiply(gate.quat);

        if (dfs(nextQuat, seq, maxDepth)) {
          seq.pop();
          return true;  // bubble the success upward immediately
        }

        seq.pop();
      }

      return false;
    };

    const MAX_DEPTH = 30;
    for (let depth = 0; depth <= MAX_DEPTH; depth++) {
      if (dfs(new THREE.Quaternion(), [], depth)) break;
      if (performance.now() - startTime > TIME_LIMIT_MS)  break;
    }

    setFoundSequence(bestSeq);
    setIsSearching(false);
  };

  const applyFoundSequence = () => {
    const newGates: GateAction[] = [];
    foundSequence.forEach((gate, i) => {
      let axis: THREE.Vector3 | undefined;
      let angle = 0;
      
      if (gate === 'H') { axis = H_AXIS; angle = Math.PI; }
      else if (gate === 'T') { axis = Z_AXIS; angle = Math.PI / 4; }
      else if (gate === 'T†') { axis = Z_AXIS; angle = -Math.PI / 4; }
      
      if (axis) {
        newGates.push({ axis, angle, id: Date.now() + Math.random() + i });
      }
    });
    
    if (newGates.length > 0) {
      setGateQueue((prev) => [...prev, ...newGates]);
    }
  };

  const targetVector = useMemo(() => {
    const tTheta = (targetTheta * Math.PI) / 180;
    const tPhi = (targetPhi * Math.PI) / 180;
    return new THREE.Vector3(
      Math.sin(tTheta) * Math.cos(tPhi),
      Math.sin(tTheta) * Math.sin(tPhi),
      Math.cos(tTheta)
    );
  }, [targetTheta, targetPhi]);

  const reset = () => {
    setGateQueue([]);
    setResetFlag((prev) => prev + 1);
    setFoundSequence([]);
  };

  const gateBtn = "w-[45px] h-[45px] rounded border border-[#444] flex items-center justify-center text-sm font-semibold bg-[#2a2a2a] text-[#e0e0e0] cursor-pointer transition-all hover:bg-[#3a3a3a] hover:border-[#646cff] hover:text-white active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#646cff]";

  return (
      <div className="flex w-full h-full relative">
      {/* Settings Modal/Popover */}
      <button
        className="absolute top-4 right-4 z-50 bg-[#222] border border-[#444] text-[#e0e0e0] p-2 rounded-full cursor-pointer hover:bg-[#333] hover:border-[#646cff] transition-all"
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        title="Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>

      {isSettingsOpen && (
        <div className="absolute top-16 right-4 z-50 w-64 bg-[#222] border border-[#444] rounded-lg p-4 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[#e0e0e0] font-bold text-sm uppercase tracking-wider m-0">Settings</h3>
            <button
              className="text-[#888] hover:text-white cursor-pointer bg-transparent border-none p-0 flex"
              onClick={() => setIsSettingsOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="flex flex-col gap-1 mb-4">
            <span className="text-[#aaa] text-[0.8rem]">Start State</span>
            <select
              className="w-full bg-[#333] border border-[#444] text-white px-2 py-1 rounded text-[0.8rem] focus:outline-none focus:border-[#646cff]"
              value={startStateKey}
              onChange={(e) => {
                setStartStateKey(e.target.value);
                setGateQueue([]);
                setResetFlag((prev) => prev + 1);
                setFoundSequence([]);
              }}
            >
              {Object.keys(START_STATES).map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 mb-4">
            <div className="flex justify-between text-[0.8rem]">
              <span className="text-[#aaa]">Anim Speed</span>
              <span className="font-mono text-[#646cff]">{animationSpeed}x</span>
            </div>
            <input
              className="w-full accent-[#646cff]"
              type="range" min="0.1" max="5" step="0.1"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[0.8rem]">
              <span className="text-[#aaa]">Dot Size</span>
              <span className="font-mono text-[#646cff]">{dotSize}</span>
            </div>
            <input
              className="w-full accent-[#646cff]"
              type="range" min="0.01" max="0.1" step="0.01"
              value={dotSize}
              onChange={(e) => setDotSize(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-62.5 min-w-62.5 bg-[#1a1a1a] px-5 py-6 flex flex-col border-r border-[#333] overflow-y-auto">
        <h1 className="text-[1.8rem] font-bold mt-0 mb-1 text-white">Bloch</h1>
        <p className="text-[#888] mt-0 mb-6 text-[0.85rem]">Quantum Simulator</p>

        {/* Solovay–Kitaev panel */}
        <span className="text-[0.75rem] uppercase tracking-widest text-[#666] mb-3">Elementary Gates</span>
        <div className="flex flex-wrap gap-2">
          <button className={gateBtn} onClick={applyX} title="Pauli-X (NOT)">X</button>
          <button className={gateBtn} onClick={applyY} title="Pauli-Y">Y</button>
          <button className={gateBtn} onClick={applyZ} title="Pauli-Z (Phase Flip)">Z</button>
          <button className={gateBtn} onClick={applyH} title="Hadamard">H</button>
          <button className={gateBtn} onClick={applyS} title="S Gate (π/2 Phase)">S</button>
          <button className={gateBtn} onClick={applySdg} title="S† Gate (-π/2 Phase)">S†</button>
          <button className={gateBtn} onClick={applyT} title="T Gate (π/4 Phase)">T</button>
          <button className={gateBtn} onClick={applyTdg} title="T† Gate (-π/4 Phase)">T†</button>
          <button className={gateBtn} onClick={applyRx2} title="Rx(π/2)">Rx</button>
          <button className={gateBtn} onClick={applyRy2} title="Ry(π/2)">Ry</button>
          <button className={gateBtn} onClick={applyRz2} title="Rz(π/2)">Rz</button>
        </div>

        <div className="mt-6 flex flex-col">
          <span className="text-[0.75rem] uppercase tracking-widest text-[#666] mb-3">Custom Sequence</span>
          <div className="flex flex-col gap-2">
            <input
              className="w-full bg-[#222] border border-[#333] text-white px-3 py-2 rounded text-sm font-mono placeholder-[#555] focus:border-[#646cff] outline-none"
              placeholder="e.g. HTHT"
              value={customSequence}
              onChange={(e) => setCustomSequence(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCustomSequence()}
            />
            <button
              className="w-full h-8 text-[0.85rem] rounded border border-[#444] bg-[#333] text-[#e0e0e0] cursor-pointer transition-all hover:bg-[#444] hover:border-[#646cff]"
              onClick={applyCustomSequence}
            >
              Apply Sequence
            </button>
          </div>
        </div>

        {/* Solovay–Kitaev panel */}
        <div className="flex flex-col bg-[#222] rounded-lg px-4 py-4 mt-4 border border-[#333]">
          <span className="text-[0.75rem] uppercase tracking-widest text-[#666] mb-3">Solovay–Kitaev</span>

          {/* θ slider */}
          <div className="flex flex-col gap-1 mb-3">
            <div className="flex justify-between text-[0.8rem]">
              <span className="text-[#aaa]">θ (0–180°)</span>
              <span className="font-mono text-[#646cff]">{targetTheta}°</span>
            </div>
            <input
              className="w-full accent-[#646cff]"
              type="range" min="0" max="180"
              value={targetTheta}
              onChange={(e) => setTargetTheta(Number(e.target.value))}
            />
          </div>

          {/* φ slider */}
          <div className="flex flex-col gap-1 mb-3">
            <div className="flex justify-between text-[0.8rem]">
              <span className="text-[#aaa]">φ (0–360°)</span>
              <span className="font-mono text-[#646cff]">{targetPhi}°</span>
            </div>
            <input
              className="w-full accent-[#646cff]"
              type="range" min="0" max="360"
              value={targetPhi}
              onChange={(e) => setTargetPhi(Number(e.target.value))}
            />
          </div>

          {/* ε number input */}
          <div className="flex items-center justify-between mb-3 text-[0.8rem]">
            <span className="text-[#aaa]">ε (Epsilon)</span>
            <input
              className="w-16 bg-[#333] border border-[#444] text-white px-1 py-0.5 rounded text-[0.8rem]"
              type="number" step="0.01" min="0.01" max="1"
              value={epsilon}
              onChange={(e) => setEpsilon(Number(e.target.value))}
            />
          </div>

          <button
            className="w-full h-8 text-[0.85rem] rounded border border-[#444] bg-[#333] text-[#e0e0e0] cursor-pointer mt-1 transition-all hover:bg-[#444] hover:border-[#646cff] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={solveSK}
            disabled={isSearching}
          >
            {isSearching ? 'Searching...' : 'Find Approximation'}
          </button>

          {foundSequence.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#333]">
              <div className="font-mono text-[0.75rem] text-yellow-300 bg-[#111] p-2 rounded break-all mb-2 leading-relaxed">
                {foundSequence.join(' → ')}
              </div>
              <button
                className="w-full h-7 text-[0.75rem] rounded border border-[#2a6a2a] bg-[#1a4a1a] text-[#ccffcc] cursor-pointer transition-all hover:bg-[#2a5a2a] hover:border-[#44ff44]"
                onClick={applyFoundSequence}
              >
                Apply Sequence
              </button>
            </div>
          )}
        </div>

        <button
          className="w-full h-9 mt-6 rounded border border-[#6a2a2a] bg-[#4a1a1a] text-[#ffcccc] text-[0.85rem] cursor-pointer transition-all hover:bg-[#5a2a2a]"
          onClick={reset}
        >
          Reset
        </button>

        <div className="mt-auto pt-4 text-[0.8rem] text-[#666]">
          <p className="my-1">Drag to rotate the sphere.</p>
          <p className="my-1">Scroll to zoom.</p>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-[#121212]">
        <Canvas camera={{ position: [4, 5, 3], up: [0, 0, 1] }}>
          <color attach="background" args={['#121212']} />
          <ambientLight intensity={0.8} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <OrbitControls makeDefault />
          <BlochSphere
            key={resetFlag}
            gateQueue={gateQueue}
            onGateComplete={handleGateComplete}
            targetVector={targetVector}
            epsilon={epsilon}
            animationSpeed={animationSpeed}
            dotSize={dotSize}
            startState={startState}
          />
        </Canvas>
      </div>
    </div>
  );
}

export default App;
