import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Line, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

export interface GateAction {
  axis: THREE.Vector3;
  angle: number;
  id: number;
}

interface BlochSphereProps {
  gateQueue: GateAction[];
  onGateComplete: (id: number) => void;
  targetVector?: THREE.Vector3;
  epsilon?: number;
  animationSpeed?: number;
  dotSize?: number;
  startState?: THREE.Vector3;
}

export function BlochSphere({ 
  gateQueue, 
  onGateComplete, 
  targetVector, 
  epsilon,
  animationSpeed = 1,
  dotSize = 0.03,
  startState = new THREE.Vector3(0, 0, 1)
}: BlochSphereProps) {
  const arrowRef = useRef<THREE.Group>(null);
  const [trail, setTrail] = useState<THREE.Vector3[]>(() => [startState.clone()]);

  // Calculate the epsilon circle parameters
  const targetCircle = useMemo(() => {
    if (!targetVector || !epsilon) return null;
    
    const R = 1; // sphere radius (unit sphere)
    // The epsilon input is a Euclidean distance between the tips of vectors of length R.
    // For two vectors of length R with angle alpha between them, the Euclidean distance d is:
    // d = sqrt(R^2 + R^2 - 2*R*R*cos(alpha)) = sqrt(2*R^2(1 - cos(alpha))) = sqrt(4*R^2*sin^2(alpha/2)) = 2*R*sin(alpha/2)
    // So alpha = 2 * asin(d / (2 * R))
    const d = Math.min(epsilon, 2 * R); // distance cannot exceed diameter
    const alpha = 2 * Math.asin(d / (2 * R));
    
    // Radius of the flat circle: r = R * sin(alpha)
    const circleRadius = R * Math.sin(alpha);
    // Distance from sphere center to circle center: h = R * cos(alpha)
    const h = R * Math.cos(alpha);
    
    // Center of the circle in 3D space
    const circleCenter = targetVector.clone().normalize().multiplyScalar(h);
    
    // Create a orientation for the circle (look at the target)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), targetVector.clone().normalize());
    
    return { circleRadius, circleCenter, quaternion };
  }, [targetVector, epsilon]);

  // The actual mathematical state
  const currentQuaternion = useMemo(() => {
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      startState.clone().normalize()
    );
  }, [startState]);

  // Set the arrow rotation to the start state when component mounts or start state changes
  useEffect(() => {
    if (arrowRef.current) {
      arrowRef.current.quaternion.copy(currentQuaternion);
    }
  }, [currentQuaternion]);

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
      const speed = Math.PI * 1.5 * animationSpeed; // radians per second
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
        const dotPosition = new THREE.Vector3(0, 0, 1).applyQuaternion(tempQ);
        // Leave a dot at the finished location
        setTrail((prev) => [...prev, dotPosition]);

        onGateComplete(animState.current.gateId);
      }
    }
  });

  return (
    <group>
      {/* The Sphere */}
      <Sphere args={[1, 32, 32]}>
        <meshStandardMaterial color="#88ccff" transparent opacity={0.2} wireframe />
      </Sphere>

      {/* Axes */}
      <Line points={[[-1.5, 0, 0], [1.5, 0, 0]]} color="red" lineWidth={1} />
      <Line points={[[0, -1.5, 0], [0, 1.5, 0]]} color="green" lineWidth={1} />
      <Line points={[[0, 0, -1.5], [0, 0, 1.5]]} color="blue" lineWidth={1} />

      {/* Axis Labels */}
      <Billboard position={[1.7, 0, 0]}>
        <Text color="red" fontSize={0.1}>X</Text>
      </Billboard>
      <Billboard position={[0, 1.7, 0]}>
        <Text color="green" fontSize={0.1}>Y</Text>
      </Billboard>
      <Billboard position={[0, 0, 1.7]}>
        <Text color="blue" fontSize={0.1}>Z (|0⟩)</Text>
      </Billboard>
      <Billboard position={[0, 0, -1.7]}>
        <Text color="blue" fontSize={0.1}>-Z (|1⟩)</Text>
      </Billboard>

      {/* Equator Lines for visual reference */}
      <Line points={Array.from({ length: 65 }).map((_, i) => [Math.cos(i * Math.PI / 32), Math.sin(i * Math.PI / 32), 0])} color="#ffffff" opacity={0.3} transparent />
      <Line points={Array.from({ length: 65 }).map((_, i) => [Math.cos(i * Math.PI / 32), 0, Math.sin(i * Math.PI / 32)])} color="#ffffff" opacity={0.3} transparent />
      <Line points={Array.from({ length: 65 }).map((_, i) => [0, Math.cos(i * Math.PI / 32), Math.sin(i * Math.PI / 32)])} color="#ffffff" opacity={0.3} transparent />

      {/* Target Point & Epsilon Circle */}
      {targetVector && (
        <group>
          {/* Target Point */}
          <Sphere args={[0.01, 8, 8]} position={targetVector}>
            <meshBasicMaterial color="#ff4444" />
          </Sphere>
          
          {/* Epsilon Circle */}
          {targetCircle && (
            <mesh 
              position={targetCircle.circleCenter} 
              quaternion={targetCircle.quaternion}
            >
              <ringGeometry args={[targetCircle.circleRadius, targetCircle.circleRadius + 0.02, 64]} />
              <meshBasicMaterial color="#ff4444" transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      )}

      {/* State Vector Arrow */}
      {/* Group is rotated so the child geometries align along Z axis by default (representing |0>) */}
      <group ref={arrowRef}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0.43, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.9]} />
            <meshBasicMaterial color="#ff00ff" />
          </mesh>
          <mesh position={[0, 0.93, 0]}>
            <coneGeometry args={[0.02, 0.10]} />
            <meshBasicMaterial color="#ff00ff" />
          </mesh>
          {/* Dot at the tip of the vector */}
          <Sphere args={[dotSize, 16, 16]} position={[0, 1, 0]}>
            <meshBasicMaterial color="#ffff00" />
          </Sphere>
        </group>
      </group>

      {/* Trail Dots */}
      {trail.map((pos, i) => (
        <Sphere key={i} args={[dotSize, 16, 16]} position={pos}>
          <meshBasicMaterial color="#ffff00" />
        </Sphere>
      ))}
    </group>
  );
}
