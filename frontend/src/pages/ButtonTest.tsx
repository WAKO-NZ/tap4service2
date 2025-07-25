import { useEffect, useRef, useState, Component, type ErrorInfo } from 'react';
import * as THREE from 'three';
import {
  SilverCyberGlowButton,
  SapphireSecurityButton,
  CrimsonAlertButton,
  EmeraldTechButton,
  AmethystAccessButton,
  GoldPrestigeButton,
  ObsidianStealthButton,
  CobaltIndustrialButton,
  PearlEleganceButton,
  NeonFusionButton,
} from '../components/ButtonStyles'; // Removed .tsx extension
import { FaWrench } from 'react-icons/fa';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error in ButtonTest:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center text-red-500 p-8">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p>{this.state.errorMessage}</p>
          <p>
            Please try refreshing the page or contact support at{' '}
            <a href="mailto:support@tap4service.co.nz" className="underline">
              support@tap4service.co.nz
            </a>.
          </p>
          <div className="mt-4 flex space-x-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ButtonTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    console.log('ButtonTest imports:', {
      THREE: !!THREE,
      FaWrench: !!FaWrench,
    });

    // Check for WebGL support
    const tempCanvas = document.createElement('canvas');
    const gl = tempCanvas.getContext('webgl') || tempCanvas.getContext('experimental-webgl');
    if (!gl) {
      setHasWebGL(false);
      console.warn('WebGL not supported; falling back to static logo.');
      return;
    }

    if (!canvasRef.current) return;

    // Set up Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true });
    renderer.setSize(300, 300);

    // Create 3D logo with fallback texture
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    let material: THREE.MeshBasicMaterial;
    try {
      const texture = new THREE.TextureLoader().load(
        '/Tap4Service Logo 1.png',
        undefined,
        undefined,
        () => console.warn('Failed to load logo texture; using fallback.')
      );
      material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    } catch {
      material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    }
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    camera.position.z = 3;

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      cube.rotation.x += 0.005;
      cube.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []);

  const handleButtonClick = (style: string) => {
    console.log(`${style} Test Button clicked`);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative p-8 max-w-md w-full text-center z-10">
          {hasWebGL ? (
            <canvas ref={canvasRef} className="mx-auto mb-6 w-[300px] h-[300px]" aria-label="3D Tap4Service Logo" />
          ) : (
            <img
              src="/Tap4Service Logo 1.png"
              alt="Tap4Service Logo"
              className="mx-auto mb-6 w-[300px] h-[300px]"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/300';
                console.warn('Failed to load static logo; using placeholder.');
              }}
            />
          )}
          <div className="space-y-6">
            <SilverCyberGlowButton
              to="#"
              icon={FaWrench}
              ariaLabel="Silver Cyber Glow Test Button"
              onClick={() => handleButtonClick('Silver Cyber Glow')}
            >
              Silver Cyber Glow
            </SilverCyberGlowButton>
            <SapphireSecurityButton
              to="#"
              icon={FaWrench}
              ariaLabel="Sapphire Security Test Button"
              onClick={() => handleButtonClick('Sapphire Security')}
            >
              Sapphire Security
            </SapphireSecurityButton>
            <CrimsonAlertButton
              to="#"
              icon={FaWrench}
              ariaLabel="Crimson Alert Test Button"
              onClick={() => handleButtonClick('Crimson Alert')}
            >
              Crimson Alert
            </CrimsonAlertButton>
            <EmeraldTechButton
              to="#"
              icon={FaWrench}
              ariaLabel="Emerald Tech Test Button"
              onClick={() => handleButtonClick('Emerald Tech')}
            >
              Emerald Tech
            </EmeraldTechButton>
            <AmethystAccessButton
              to="#"
              icon={FaWrench}
              ariaLabel="Amethyst Access Test Button"
              onClick={() => handleButtonClick('Amethyst Access')}
            >
              Amethyst Access
            </AmethystAccessButton>
            <GoldPrestigeButton
              to="#"
              icon={FaWrench}
              ariaLabel="Gold Prestige Test Button"
              onClick={() => handleButtonClick('Gold Prestige')}
            >
              Gold Prestige
            </GoldPrestigeButton>
            <ObsidianStealthButton
              to="#"
              icon={FaWrench}
              ariaLabel="Obsidian Stealth Test Button"
              onClick={() => handleButtonClick('Obsidian Stealth')}
            >
              Obsidian Stealth
            </ObsidianStealthButton>
            <CobaltIndustrialButton
              to="#"
              icon={FaWrench}
              ariaLabel="Cobalt Industrial Test Button"
              onClick={() => handleButtonClick('Cobalt Industrial')}
            >
              Cobalt Industrial
            </CobaltIndustrialButton>
            <PearlEleganceButton
              to="#"
              icon={FaWrench}
              ariaLabel="Pearl Elegance Test Button"
              onClick={() => handleButtonClick('Pearl Elegance')}
            >
              Pearl Elegance
            </PearlEleganceButton>
            <NeonFusionButton
              to="#"
              icon={FaWrench}
              ariaLabel="Neon Fusion Test Button"
              onClick={() => handleButtonClick('Neon Fusion')}
            >
              Neon Fusion
            </NeonFusionButton>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}