import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line, Text } from '@react-three/drei';
import * as THREE from 'three';

export interface GateAction {
  axis: THREE.Vector3;
  angle: number;
  id: number;
}

interface BlochSphereProps {
  gateQueue: GateAction[];
  onGateComplete: (id: number) => void;
}

export function BlochSphere({ gateQueue, onGateComplete }: BlochSphereProps) {
  const arrowRef = useRef<THREE.Group>(null);
  const [trail, setTrail] = useState<THREE.Vector3[]>(() => [new THREE.Vector3(0, 0, 2)]);

  // The actual mathematical state
  const currentQuaternion = useMemo(() => new THREE.Quaternion(), []);

  // Animation state
  const animState = useRef<{
    active: boolean;
    gateId: number;
    axis: THREE.Vector3;
    targetAngle: number;
    currentAngle: number;
    startQuaternion: THREE.Quaternion;
  }>({
    active: false,
    gateId: -1,
    axis: new THREE.Vector3(),
    targetAngle: 0,
    currentAngle: 0,
    startQuaternion: new THREE.Quaternion(),
  });

  // Handle new gates in queue
  useEffect(() => {
    if (!animState.current.active && gateQueue.length > 0) {
      const nextGate = gateQueue[0];
      animState.current = {
        active: true,
        gateId: nextGate.id,
        axis: nextGate.axis.clone().normalize(),
        targetAngle: nextGate.angle,
        currentAngle: 0,
        startQuaternion: currentQuaternion.clone(),
      };
    }
  }, [gateQueue, currentQuaternion]);

  useFrame((_state, delta) => {
    if (animState.current.active) {
      const speed = Math.PI * 1.5; // radians per second
      let stepAngle = speed * delta;
      const remaining = Math.abs(animState.current.targetAngle) - Math.abs(animState.current.currentAngle);

      let isFinished = false;
      if (stepAngle >= remaining) {
        stepAngle = remaining;
        isFinished = true;
      }

      const dir = Math.sign(animState.current.targetAngle) || 1;
      animState.current.currentAngle += stepAngle * dir;

      const partialRot = new THREE.Quaternion().setFromAxisAngle(
        animState.current.axis,
        animState.current.currentAngle
      );
      const tempQ = animState.current.startQuaternion.clone().premultiply(partialRot);

      if (arrowRef.current) {
        arrowRef.current.quaternion.copy(tempQ);
      }

      if (isFinished) {
        currentQuaternion.copy(tempQ);
        animState.current.active = false;

        // Calculate the vector's tip position by rotating [0, 0, 2] with the final quaternion
        const dotPosition = new THREE.Vector3(0, 0, 2).applyQuaternion(tempQ);
        // Leave a dot at the finished location
        setTrail((prev) => [...prev, dotPosition]);

        onGateComplete(animState.current.gateId);
      }
    }
  });

  return (
    <group>
      {/* The Sphere */}
      <Sphere args={[2, 32, 32]}>
        <meshStandardMaterial color="#88ccff" transparent opacity={0.2} wireframe />
      </Sphere>

      {/* Axes */}
      <Line points={[[-2.5, 0, 0], [2.5, 0, 0]]} color="red" lineWidth={1} />
      <Line points={[[0, -2.5, 0], [0, 2.5, 0]]} color="green" lineWidth={1} />
      <Line points={[[0, 0, -2.5], [0, 0, 2.5]]} color="blue" lineWidth={1} />

      {/* Axis Labels */}
      <Text position={[2.7, 0, 0]} color="red" fontSize={0.2}>X</Text>
      <Text position={[0, 2.7, 0]} color="green" fontSize={0.2}>Y</Text>
      <Text position={[0, 0, 2.7]} color="blue" fontSize={0.2}>Z (|0⟩)</Text>
      <Text position={[0, 0, -2.7]} color="blue" fontSize={0.2}>-Z (|1⟩)</Text>

      {/* Equator Lines for visual reference */}
      <Line points={Array.from({ length: 65 }).map((_, i) => [2 * Math.cos(i * Math.PI / 32), 2 * Math.sin(i * Math.PI / 32), 0])} color="#ffffff" opacity={0.3} transparent />
      <Line points={Array.from({ length: 65 }).map((_, i) => [2 * Math.cos(i * Math.PI / 32), 0, 2 * Math.sin(i * Math.PI / 32)])} color="#ffffff" opacity={0.3} transparent />
      <Line points={Array.from({ length: 65 }).map((_, i) => [0, 2 * Math.cos(i * Math.PI / 32), 2 * Math.sin(i * Math.PI / 32)])} color="#ffffff" opacity={0.3} transparent />

      {/* State Vector Arrow */}
      {/* Group is rotated so the child geometries align along Z axis by default (representing |0>) */}
      <group ref={arrowRef}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 2]} />
            <meshBasicMaterial color="#ff00ff" />
          </mesh>
          <mesh position={[0, 2, 0]}>
            <coneGeometry args={[0.1, 0.2]} />
            <meshBasicMaterial color="#ff00ff" />
          </mesh>
        </group>
      </group>

      {/* Trail Dots */}
      {trail.map((pos, i) => (
        <Sphere key={i} args={[0.06, 16, 16]} position={pos}>
          <meshBasicMaterial color="#ffff00" />
        </Sphere>
      ))}
    </group>
  );
}
