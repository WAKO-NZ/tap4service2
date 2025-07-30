/**
 * LandingPage.tsx - Version V1.9
 * - Increased button height to h-[clamp(10rem,20vw,12rem)] for better mobile usability.
 * - Increased vertical spacing between buttons to mt-[clamp(1rem,2vw,1.5rem)] for improved separation.
 * - Stacked Technician and Customer buttons vertically (flex-col) below tagline text.
 * - Made buttons scalable with width using w-full and max-w-[clamp(16rem,60vw,24rem)].
 * - Changed Technician Registration to "Technician" and Customer Registration to "Customer".
 * - Removed Login button.
 * - Added CSS spark animation to buttons for approximate "sparks" effect.
 * - Removed page number from top-right corner.
 * - Smaller text for mobile.
 * - Tagline: "Streamlined Property Technical Services: Quick, Affordable, and Just a Tap Away!".
 * - Displays 3D logo with WebGL or static image fallback.
 */
import { useEffect, useRef, useState, Component, type ErrorInfo } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { FaWrench, FaUser } from 'react-icons/fa';

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
    console.error('Error in LandingPage:', error, errorInfo);
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
            <Link
              to="/"
              className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    console.log('LandingPage imports:', {
      THREE: !!THREE,
      FaWrench: !!FaWrench,
      FaUser: !!FaUser,
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
    const updateSize = () => {
      const size = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.7, 700);
      renderer.setSize(size, size);
      canvasRef.current!.style.width = `${size}px`;
      canvasRef.current!.style.height = `${size}px`;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Create 3D logo with fallback texture
    const geometry = new THREE.BoxGeometry(2.0, 2.0, 2.0);
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

    camera.position.z = 4.0;

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
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col items-center bg-gray-900 text-white p-[clamp(1rem,4vw,2rem)]">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 opacity-50" />
        <div className="relative flex flex-col items-center w-full max-w-[clamp(20rem,80vw,32rem)] z-10">
          {hasWebGL ? (
            <canvas
              ref={canvasRef}
              className="mx-auto mt-[clamp(0.125rem,0.25vw,0.25rem)] mb-[clamp(0.125rem,0.25vw,0.25rem)] w-[min(70vw,70vh,700px)] h-[min(70vw,70vh,700px)]"
              aria-label="3D Tap4Service Logo"
            />
          ) : (
            <img
              src="/Tap4Service Logo 1.png"
              alt="Tap4Service Logo"
              className="mx-auto mt-[clamp(0.125rem,0.25vw,0.25rem)] mb-[clamp(0.125rem,0.25vw,0.25rem)] w-[min(70vw,70vh,700px)] h-[min(70vw,70vh,700px)]"
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/700';
                console.warn('Failed to load static logo; using placeholder.');
              }}
            />
          )}
          <p className="text-[clamp(1.5rem,4vw,2rem)] font-bold font-sans mb-[clamp(0.125rem,0.25vw,0.25rem)] bg-gradient-to-r from-gray-300 to-blue-500 bg-clip-text text-transparent animate-pulse-text text-center">
            Streamlined Property Technical Services: Quick, Affordable, and Just a Tap Away!
          </p>
          <div className="w-full flex flex-col space-y-2 mt-[clamp(1rem,2vw,1.5rem)]">
            {/* Silver Cyber Glow Button (Technician) */}
            <Link
              to="/technician-login"
              className="w-full max-w-[clamp(16rem,60vw,24rem)] h-[clamp(10rem,20vw,12rem)] relative bg-gradient-to-r from-gray-300 to-gray-600 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-blue-500/70 hover:scale-105 transition-all duration-300 animate-pulse-fast overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 animate-spark"
              role="button"
              aria-label="Technician Login"
            >
              <div
                className="absolute inset-0 bg-gray-600/30 transform -skew-x-20 -translate-x-4"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)',
                  backgroundSize: '10px 10px',
                }}
              />
              <div className="absolute inset-0 bg-gray-700/20 transform skew-x-20 translate-x-4" />
              <div className="relative flex items-center justify-center h-full z-10">
                <FaWrench className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                Technician
              </div>
            </Link>
            {/* Sapphire Security Button (Customer) */}
            <Link
              to="/customer-login"
              className="w-full max-w-[clamp(16rem,60vw,24rem)] h-[clamp(10rem,20vw,12rem)] relative bg-gradient-to-r from-blue-500 to-blue-800 text-white text-[clamp(0.875rem,2vw,1rem)] font-bold rounded-2xl shadow-2xl hover:shadow-white/50 hover:scale-105 transition-all duration-300 animate-ripple overflow-hidden focus:outline-none focus:ring-2 focus:ring-white animate-spark"
              role="button"
              aria-label="Customer Login"
            >
              <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
              <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
              <div className="relative flex items-center justify-center h-full z-10">
                <FaUser className="mr-2 text-[clamp(1.25rem,2.5vw,1.5rem)]" />
                Customer
              </div>
            </Link>
          </div>
        </div>
        <style>{`
          @keyframes pulse-fast {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
            }
            50% {
              transform: scale(1.02);
              box-shadow: 0 0 30px rgba(59, 130, 246, 0.7);
            }
          }
          @keyframes ripple {
            0% {
              background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 100%);
              background-size: 0% 0%;
            }
            50% {
              background-size: 100% 100%;
            }
            100% {
              background-size: 0% 0%;
            }
          }
          @keyframes pulse-text {
            0%, 100% {
              text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
            }
            50% {
              text-shadow: 0 0 20px rgba(59, 130, 246, 0.7);
            }
          }
          @keyframes spark {
            0% {
              box-shadow: 0 0 5px rgba(255, 255, 0, 0.3);
            }
            50% {
              box-shadow: 0 0 15px rgba(255, 255, 0, 0.8);
            }
            100% {
              box-shadow: 0 0 5px rgba(255, 255, 0, 0.3);
            }
          }
          .animate-pulse-fast {
            animation: pulse-fast 2s ease-in-out infinite;
          }
          .animate-ripple {
            animation: ripple 2s ease-in-out infinite;
          }
          .animate-pulse-text {
            animation: pulse-text 3s ease-in-out infinite;
          }
          .animate-spark {
            animation: spark 1s ease-in-out infinite alternate;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-pulse-fast,
            .animate-ripple,
            .animate-pulse-text,
            .animate-spark {
              animation: none !important;
            }
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
}