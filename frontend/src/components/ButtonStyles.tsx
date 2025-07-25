import { Link } from 'react-router-dom';
import { FaWrench, FaUser, FaSignInAlt } from 'react-icons/fa';
import { type ReactNode, type ComponentType } from 'react';
import './ButtonStyles.css';

interface ButtonProps {
  to: string;
  children: ReactNode;
  onClick?: () => void;
  icon?: ComponentType<{ className?: string }>;
  ariaLabel: string;
}

const ButtonBase = ({ to, children, onClick, icon: Icon, ariaLabel, className }: ButtonProps & { className: string }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`block w-full h-[clamp(6rem,15vw,7rem)] relative text-white text-[clamp(1.5rem,4vw,2rem)] font-bold rounded-2xl shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden focus:outline-none ${className}`}
    role="button"
    aria-label={ariaLabel}
  >
    <div className="relative flex items-center justify-center h-full z-10">
      {Icon && <Icon className="mr-3 text-[clamp(2rem,5vw,2.5rem)]" />}
      {children}
    </div>
  </Link>
);

export const SilverCyberGlowButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="silver-cyber-glow hover:shadow-blue-500/70 animate-pulse-fast focus:ring-2 focus:ring-blue-500"
  >
    <div
      className="absolute inset-0 bg-gray-600/30 transform -skew-x-20 -translate-x-4 silver-cyber-glow-overlay"
      style={{
        backgroundImage:
          'linear-gradient(45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%, transparent)',
        backgroundSize: '10px 10px',
      }}
    />
    <div className="absolute inset-0 bg-gray-700/20 transform skew-x-20 translate-x-4" />
  </ButtonBase>
);

export const SapphireSecurityButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="sapphire-security hover:shadow-white/50 animate-ripple focus:ring-2 focus:ring-white"
  >
    <div className="absolute inset-0 bg-blue-600/30 transform -skew-x-12 -translate-x-4" />
    <div className="absolute inset-0 bg-blue-700/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);

export const CobaltIndustrialButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="cobalt-industrial hover:shadow-orange-500/70 animate-gear focus:ring-2 focus:ring-orange-500"
  >
    <div className="absolute inset-0 bg-blue-950/30 transform -skew-x-12 -translate-x-4" />
    <div className="absolute inset-0 bg-slate-900/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);

export const CrimsonAlertButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="crimson-alert hover:shadow-red-500/70 animate-sparkle focus:ring-2 focus:ring-red-500"
  >
    <div className="absolute inset-0 bg-red-600/30 transform -skew-x-12 -translate-x-4" />
    <div className="absolute inset-0 bg-red-700/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);

export const EmeraldTechButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="emerald-tech hover:shadow-emerald-500/70 animate-pulse-slow focus:ring-2 focus:ring-emerald-500"
  >
    <div className="absolute inset-0 bg-emerald-600/30 transform -skew-x-12 -translate-x-4" />
    <div className="absolute inset-0 bg-emerald-700/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);

export const AmethystAccessButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="amethyst-access hover:shadow-purple-500/70 animate-bounce focus:ring-2 focus:ring-purple-500"
  >
    <div className="absolute inset-0 bg-purple-600/30 transform -skew-x-12 -translate-x-4" />
    <div className="absolute inset-0 bg-purple-700/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);

export const GoldPrestigeButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="gold-prestige hover:shadow-yellow-500/70 animate-pulse-slow focus:ring-2 focus:ring-yellow-500"
  >
    <div
      className="absolute inset-0 bg-yellow-600/30 transform -skew-x-12 -translate-x-4 gold-prestige-overlay"
      style={{
        backgroundImage:
          'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)',
        backgroundSize: '10px 10px',
      }}
    />
    <div className="absolute inset-0 bg-yellow-700/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);

export const ObsidianStealthButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="obsidian-stealth hover:shadow-cyan-500/70 animate-pulse-medium focus:ring-2 focus:ring-cyan-500"
  >
    <div className="absolute inset-0 bg-gray-900/30 transform -skew-x-12 -translate-x-4" />
    <div className="absolute inset-0 bg-gray-950/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);

export const PearlEleganceButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="pearl-elegance text-gray-900 hover:shadow-white/50 focus:ring-2 focus:ring-white"
  >
    <div className="absolute inset-0 bg-gray-200/30 transform -skew-x-12 -translate-x-4" />
    <div className="absolute inset-0 bg-gray-300/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);

export const NeonFusionButton = (props: ButtonProps) => (
  <ButtonBase
    {...props}
    className="neon-fusion hover:shadow-[0_0_30px_rgba(236,72,153,0.7)] animate-flicker focus:ring-2 focus:ring-pink-500"
  >
    <div className="absolute inset-0 bg-pink-600/30 transform -skew-x-12 -translate-x-4" />
    <div className="absolute inset-0 bg-blue-600/20 transform skew-x-12 translate-x-4" />
  </ButtonBase>
);