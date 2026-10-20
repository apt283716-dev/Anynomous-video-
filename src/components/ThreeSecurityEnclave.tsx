/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface ThreeSecurityEnclaveProps {
  status: 'idle' | 'calling' | 'connected' | 'burned';
  audioLevel?: number; // 0.0 to 1.0 from microphone or call
  isRecording?: boolean;
  securityHash?: string;
  className?: string;
}

export const ThreeSecurityEnclave: React.FC<ThreeSecurityEnclaveProps> = ({
  status,
  audioLevel = 0,
  isRecording = false,
  securityHash = 'SHA256:E2EE:ACTIVE',
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioLevelRef = useRef(audioLevel);
  const statusRef = useRef(status);
  const isRecordingRef = useRef(isRecording);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
    statusRef.current = status;
    isRecordingRef.current = isRecording;
  }, [audioLevel, status, isRecording]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 450;

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (Boolean(navigator.webdriver) || /HeadlessChrome/i.test(navigator.userAgent));

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.045);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 5.5);

    // 2. Modern Renderer with PBR Pipeline
    const renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    if (!isHeadless) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(renderer.domElement);

    // 3. Studio Environment Map (PMREMGenerator + RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 4. Studio PBR Lighting
    const keyLight = new THREE.DirectionalLight(0xfef08a, 2.8);
    keyLight.position.set(4, 6, 4);
    if (!isHeadless) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 15;
      keyLight.shadow.camera.left = -3;
      keyLight.shadow.camera.right = 3;
      keyLight.shadow.camera.top = 3;
      keyLight.shadow.camera.bottom = -3;
    }
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 1.4);
    scene.add(fillLight);

    const corePointLight = new THREE.PointLight(0x06b6d4, 3, 6);
    corePointLight.position.set(0, 1.2, 0);
    scene.add(corePointLight);

    // 5. Procedural Textures (Zero 404 dependencies)
    // Procedural Circuit Bump Texture
    const circuitCanvas = document.createElement('canvas');
    circuitCanvas.width = 256;
    circuitCanvas.height = 256;
    const ctx = circuitCanvas.getContext('2d')!;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    const circuitBumpMap = new THREE.CanvasTexture(circuitCanvas);
    circuitBumpMap.wrapS = THREE.RepeatWrapping;
    circuitBumpMap.wrapT = THREE.RepeatWrapping;
    circuitBumpMap.repeat.set(4, 2);

    // Procedural Radial Shadow Texture
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const shadowCtx = shadowCanvas.getContext('2d')!;
    const shadowGrad = shadowCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    shadowCtx.fillStyle = shadowGrad;
    shadowCtx.fillRect(0, 0, 256, 256);
    const radialShadowTex = new THREE.CanvasTexture(shadowCanvas);

    // 6. Composite 8-Part Procedural Cryptographic Shield Model (THREE.Group)
    const securityGroup = new THREE.Group();
    securityGroup.position.set(0, 0, 0); // Sits at pedestal center
    scene.add(securityGroup);

    // Part 1: Heavy Outer Titanium Shield Ring (Primary Silhouette)
    const outerTorusGeo = new THREE.TorusGeometry(1.6, 0.08, 16, 64);
    const outerTorusMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.22,
      bumpMap: circuitBumpMap,
      bumpScale: 0.04,
    });
    const outerTorus = new THREE.Mesh(outerTorusGeo, outerTorusMat);
    outerTorus.position.y = 1.2;
    outerTorus.castShadow = !isHeadless;
    securityGroup.add(outerTorus);

    // Part 2: Gyroscopic Inner Ring Alpha (Secondary Read)
    const innerRingAlphaGeo = new THREE.TorusGeometry(1.25, 0.05, 12, 48);
    const innerRingAlphaMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.85,
      roughness: 0.18,
    });
    const innerRingAlpha = new THREE.Mesh(innerRingAlphaGeo, innerRingAlphaMat);
    innerRingAlpha.position.y = 1.2;
    securityGroup.add(innerRingAlpha);

    // Part 3: Gyroscopic Inner Ring Beta (Secondary Read)
    const innerRingBetaGeo = new THREE.TorusGeometry(0.95, 0.04, 12, 48);
    const innerRingBetaMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.9,
      roughness: 0.12,
    });
    const innerRingBeta = new THREE.Mesh(innerRingBetaGeo, innerRingBetaMat);
    innerRingBeta.position.y = 1.2;
    securityGroup.add(innerRingBeta);

    // Part 4: Transmissive Quantum Enclave Crystal Shell (Accent Detail)
    const crystalGeo = new THREE.SphereGeometry(0.65, 32, 24);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      transmission: 0.85,
      opacity: 1,
      transparent: true,
      roughness: 0.08,
      metalness: 0.1,
      ior: 1.45,
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    crystalMesh.position.y = 1.2;
    securityGroup.add(crystalMesh);

    // Part 5: Inner Pulsing Cryptographic Key Core (Accent Detail)
    const coreKeyGeo = new THREE.IcosahedronGeometry(0.35, 1);
    const coreKeyMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.8,
    });
    const coreKeyMesh = new THREE.Mesh(coreKeyGeo, coreKeyMat);
    coreKeyMesh.position.y = 1.2;
    securityGroup.add(coreKeyMesh);

    // Part 6: 8 Orbital DTLS-SRTP Key Node Prisms
    const nodeCount = 8;
    const nodeGroup = new THREE.Group();
    nodeGroup.position.y = 1.2;
    securityGroup.add(nodeGroup);

    const nodePrismGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.22, 6);
    const nodePrismMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.92,
      roughness: 0.15,
      emissive: 0x0369a1,
      emissiveIntensity: 0.4,
    });

    const orbitalNodes: THREE.Mesh[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2;
      const prism = new THREE.Mesh(nodePrismGeo, nodePrismMat);
      prism.position.set(Math.cos(angle) * 1.4, Math.sin(angle * 2) * 0.15, Math.sin(angle) * 1.4);
      prism.rotation.z = Math.PI / 4;
      nodeGroup.add(prism);
      orbitalNodes.push(prism);
    }

    // Part 7: Laser Alignment Filaments (Tube / Lines)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
    });
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new Float32Array(nodeCount * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const laserLines = new THREE.LineSegments(lineGeo, lineMat);
    laserLines.position.y = 1.2;
    securityGroup.add(laserLines);

    // Part 8: Radial Contact Shadow & Carbon Floor Pedestal
    const pedestalGeo = new THREE.CylinderGeometry(2.1, 2.2, 0.1, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.7,
      roughness: 0.4,
    });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalMesh.position.y = 0.05;
    pedestalMesh.receiveShadow = !isHeadless;
    securityGroup.add(pedestalMesh);

    const shadowPlaneGeo = new THREE.PlaneGeometry(5, 5);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: radialShadowTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    scene.add(shadowPlane);

    // 7. Interactive Orbit / Damped Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotY = 0;
    let targetRotX = 0.2;
    let currentRotY = 0;
    let currentRotX = 0.2;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevMouseX = clientX;
      prevMouseY = clientY;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevMouseX;
      const deltaY = clientY - prevMouseY;
      prevMouseX = clientX;
      prevMouseY = clientY;

      targetRotY += deltaX * 0.008;
      targetRotX = Math.max(-0.2, Math.min(0.6, targetRotX + deltaY * 0.008));
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const canvasDom = renderer.domElement;
    canvasDom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvasDom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // 8. Animation & Damped 60fps Loop
    let animId: number;
    const clock = new THREE.Clock();
    let lastRenderTime = 0;
    const targetFps = isHeadless ? 20 : 60;
    const frameInterval = 1000 / targetFps;

    const animate = (currentTime: number) => {
      animId = requestAnimationFrame(animate);

      const deltaMs = currentTime - lastRenderTime;
      if (isHeadless && deltaMs < frameInterval) return;
      lastRenderTime = currentTime;

      const dt = Math.min(clock.getDelta(), 0.1);

      // Camera Damping
      const dampingFactor = 1 - Math.exp(-6 * dt);
      currentRotY += (targetRotY - currentRotY) * dampingFactor;
      currentRotX += (targetRotX - currentRotX) * dampingFactor;

      securityGroup.rotation.y = currentRotY;
      securityGroup.rotation.x = currentRotX;

      // Status-specific transformations
      const curStatus = statusRef.current;
      const curAudio = audioLevelRef.current;
      const recActive = isRecordingRef.current;

      const time = clock.getElapsedTime();

      // Gyro Ring Motions
      outerTorus.rotation.z = time * 0.2;
      innerRingAlpha.rotation.x = time * 0.5;
      innerRingAlpha.rotation.y = time * 0.3;
      innerRingBeta.rotation.y = -time * 0.6;
      innerRingBeta.rotation.z = time * 0.4;

      // Reactivity to Audio & Status
      const pulseSpeed = curStatus === 'connected' ? 4 : curStatus === 'calling' ? 8 : 1.5;
      const pulseScale = 1 + Math.sin(time * pulseSpeed) * 0.08 + curAudio * 0.4;
      coreKeyMesh.scale.set(pulseScale, pulseScale, pulseScale);
      coreKeyMesh.rotation.x = time * 0.8;
      coreKeyMesh.rotation.y = time * 1.1;

      // Status color shift
      if (curStatus === 'burned') {
        coreKeyMat.color.setHex(0xef4444);
        coreKeyMat.emissive.setHex(0xb91c1c);
        corePointLight.color.setHex(0xef4444);
      } else if (recActive) {
        // Blinking stealth recording indicator in 3D core
        const recBlink = Math.sin(time * 6) > 0;
        coreKeyMat.color.setHex(recBlink ? 0xf43f5e : 0x06b6d4);
        coreKeyMat.emissive.setHex(recBlink ? 0xbe123c : 0x0891b2);
        corePointLight.color.setHex(recBlink ? 0xf43f5e : 0x06b6d4);
      } else if (curStatus === 'connected') {
        coreKeyMat.color.setHex(0x10b981);
        coreKeyMat.emissive.setHex(0x059669);
        corePointLight.color.setHex(0x10b981);
      } else {
        coreKeyMat.color.setHex(0x06b6d4);
        coreKeyMat.emissive.setHex(0x0891b2);
        corePointLight.color.setHex(0x06b6d4);
      }

      // Orbital Nodes & Filaments Update
      nodeGroup.rotation.y = time * 0.4;
      const positions = laserLines.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < nodeCount; i++) {
        const node = orbitalNodes[i];
        const idx = i * 6;
        // From center (0, 0, 0)
        positions[idx] = 0;
        positions[idx + 1] = 0;
        positions[idx + 2] = 0;
        // To node world coordinate in nodeGroup
        positions[idx + 3] = node.position.x;
        positions[idx + 4] = node.position.y;
        positions[idx + 5] = node.position.z;
      }
      laserLines.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // 9. Resize Handling
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || window.innerWidth;
      const newH = container.clientHeight || 450;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 10. Clean Resource Disposal
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvasDom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvasDom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      outerTorusGeo.dispose();
      outerTorusMat.dispose();
      innerRingAlphaGeo.dispose();
      innerRingAlphaMat.dispose();
      innerRingBetaGeo.dispose();
      innerRingBetaMat.dispose();
      crystalGeo.dispose();
      crystalMat.dispose();
      coreKeyGeo.dispose();
      coreKeyMat.dispose();
      nodePrismGeo.dispose();
      nodePrismMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      pedestalGeo.dispose();
      pedestalMat.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      circuitBumpMap.dispose();
      radialShadowTex.dispose();
      envTexture.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-[360px] md:h-[440px] rounded-2xl overflow-hidden bg-slate-950/80 border border-slate-800/80 select-none shadow-2xl ${className}`}
      data-testid="three-security-enclave"
    >
      {/* Viewport-First Compact Control Dock (<=15% footprint, solid rgba surfaces per guidelines) */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-2 pointer-events-auto shadow-md">
          <span
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              status === 'connected'
                ? 'bg-emerald-400'
                : status === 'calling'
                ? 'bg-amber-400'
                : status === 'burned'
                ? 'bg-rose-500'
                : 'bg-cyan-400'
            }`}
          />
          <span className="font-semibold uppercase tracking-wider">
            {status === 'connected'
              ? 'P2P Tunnel Active'
              : status === 'calling'
              ? 'Exchanging Handshake'
              : status === 'burned'
              ? 'Token Burned'
              : 'Quantum Enclave Ready'}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-cyan-400 flex items-center gap-1.5 pointer-events-auto shadow-md">
          <span>DTLS 1.3 / SRTP</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">{securityHash.slice(0, 10)}...</span>
        </div>
      </div>

      {isRecording && (
        <div className="absolute top-14 right-3 bg-rose-950/90 border border-rose-600/80 px-2.5 py-1 rounded-lg text-[11px] font-mono text-rose-300 flex items-center gap-2 shadow-lg animate-pulse">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>LOCAL RECORDER IS ACTIVE (MY SIDE ONLY)</span>
        </div>
      )}

      {/* Floating Drag Hint */}
      <div className="absolute bottom-2.5 left-3 text-[10px] font-mono text-slate-500 select-none pointer-events-none">
        ✦ Interactive 3D Security Core • Drag to orbit
      </div>
    </div>
  );
};
