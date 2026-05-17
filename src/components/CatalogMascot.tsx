// src/components/CatalogMascot.tsx
// Drop-in mascot component — no extra dependencies, pure CSS animations via Tailwind + inline styles

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function CatalogMascot() {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* ── MASCOT ── */}
      <div style={styles.mascotWrap}>

        {/* Sparkles */}
        <div style={{ ...styles.sparkle, background: '#FFD600', top: -10, left: -16, animation: 'tagsSpark 1.2s ease-in-out infinite' }} />
        <div style={{ ...styles.sparkle, background: '#FF2D55', top: 10, right: -18, animation: 'tagsSpark 1.5s ease-in-out infinite reverse', animationDelay: '0.4s' }} />
        <div style={{ ...styles.sparkle, width: 6, height: 6, background: '#25D366', top: -14, right: 6, animation: 'tagsSpark 1s ease-in-out infinite', animationDelay: '0.8s' }} />
        <div style={{ ...styles.sparkle, width: 5, height: 5, background: '#fff', top: 6, left: -20, animation: 'tagsSpark 1.3s ease-in-out infinite', animationDelay: '0.2s' }} />

        {/* Speech bubble */}
        <div style={styles.bubble}>
          Click me! 🎉
          <span style={styles.bubbleTail} />
        </div>

        {/* SVG Robot Mascot */}
        <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={styles.svg}>
          <ellipse cx="40" cy="75" rx="18" ry="4" fill="rgba(0,0,0,0.12)" />

          {/* Legs */}
          <g style={{ animation: 'tagsLegL 0.4s ease-in-out infinite alternate', transformOrigin: '33px 65px' }}>
            <rect x="28" y="62" width="10" height="14" rx="5" fill="#FA5600"/>
            <circle cx="33" cy="76" r="5" fill="#1C1C1E"/>
          </g>
          <g style={{ animation: 'tagsLegR 0.4s ease-in-out infinite alternate', transformOrigin: '47px 65px', animationDelay: '0.2s' }}>
            <rect x="42" y="62" width="10" height="14" rx="5" fill="#FA5600"/>
            <circle cx="47" cy="76" r="5" fill="#1C1C1E"/>
          </g>

          {/* Body */}
          <rect x="18" y="30" width="44" height="36" rx="10" fill="#FA5600"/>
          <rect x="18" y="30" width="44" height="6" rx="10" fill="#E04A00"/>
          <line x1="40" y1="36" x2="40" y2="66" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
          <line x1="18" y1="48" x2="62" y2="48" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>

          {/* Left Arm */}
          <g style={{ animation: 'tagsArmL 0.7s ease-in-out infinite alternate', transformOrigin: '22px 38px' }}>
            <rect x="6" y="33" width="14" height="8" rx="4" fill="#FFD600"/>
            <circle cx="6" cy="37" r="5" fill="#FF9500"/>
          </g>

          {/* Right Arm */}
          <g style={{ animation: 'tagsArmR 0.7s ease-in-out infinite alternate', transformOrigin: '58px 38px', animationDelay: '0.35s' }}>
            <rect x="60" y="33" width="14" height="8" rx="4" fill="#FFD600"/>
            <circle cx="74" cy="37" r="5" fill="#FF9500"/>
          </g>

          {/* Head */}
          <rect x="22" y="10" width="36" height="26" rx="9" fill="#1C1C1E"/>
          <rect x="26" y="13" width="12" height="4" rx="2" fill="rgba(255,255,255,0.08)"/>

          {/* Eyes */}
          <g style={{ animation: 'tagsBlink 3s ease-in-out infinite', transformOrigin: '31px 24px' }}>
            <circle cx="31" cy="24" r="6" fill="white"/>
            <circle cx="31" cy="24" r="3.5" fill="#FA5600"/>
            <circle cx="32.5" cy="22.5" r="1.2" fill="white"/>
          </g>
          <g style={{ animation: 'tagsBlink 3s ease-in-out infinite', transformOrigin: '49px 24px', animationDelay: '0.1s' }}>
            <circle cx="49" cy="24" r="6" fill="white"/>
            <circle cx="49" cy="24" r="3.5" fill="#FA5600"/>
            <circle cx="50.5" cy="22.5" r="1.2" fill="white"/>
          </g>

          {/* Smile */}
          <path d="M33 31 Q40 36 47 31" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>

          {/* Belly screen */}
          <rect x="27" y="40" width="26" height="16" rx="5" fill="#1C1C1E"/>
          <text x="40" y="51" textAnchor="middle" fontSize="9" fill="#FFD600" fontWeight="900" fontFamily="monospace">TAGS</text>

          {/* Crown star */}
          <g style={{ animation: 'tagsCrown 2s linear infinite', transformOrigin: '40px 6px' }}>
            <polygon points="40,0 42.5,5 48,5.5 44,9 45.5,15 40,12 34.5,15 36,9 32,5.5 37.5,5"
              fill="#FFD600" stroke="#FF9500" strokeWidth="0.5"/>
          </g>

          {/* Antenna */}
          <line x1="40" y1="10" x2="40" y2="4" stroke="#FFD600" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="40" cy="3" r="2.5" fill="#FF2D55">
            <animate attributeName="r" values="2.5;3.5;2.5" dur="0.8s" repeatCount="indefinite"/>
            <animate attributeName="fill" values="#FF2D55;#FFD600;#FF2D55" dur="0.8s" repeatCount="indefinite"/>
          </circle>
        </svg>

        {/* Shadow under mascot */}
        <div style={styles.mascotShadow} />
      </div>

      {/* ── BUTTON AREA ── */}
      <div style={{ position: 'relative', marginTop: 90 }}>

        {/* Floating stars */}
        {[
          { top: -20, left: '10%', delay: '0s',   emoji: '⭐' },
          { top: -14, right: '15%', delay: '0.5s', emoji: '✨' },
          { bottom: -18, left: '20%', delay: '1s',  emoji: '🌟' },
          { bottom: -14, right: '10%', delay: '1.5s', emoji: '💫' },
        ].map((s, i) => (
          <span key={i} style={{ ...styles.btnStar, ...s, animationDelay: s.delay }}>{s.emoji}</span>
        ))}

        {/* Pulse rings */}
        {[0, 0.6, 1.2].map((delay, i) => (
          <div key={i} style={{ ...styles.pulseRing, animationDelay: `${delay}s` }} />
        ))}

        {/* The actual button */}
        <Link
          to="/products"
          className="bg-[#FA5600] hover:bg-[#E04A00] text-white font-black uppercase text-sm tracking-widest py-4 px-8 flex items-center justify-center gap-2 transition-all rounded-full shadow-lg"
          style={{ position: 'relative', zIndex: 1 }}
        >
          Browse Catalog <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {/* ── KEYFRAME STYLES ── */}
      <style>{`
        @keyframes tagsBounce {
          0%,100% { transform: translateX(-50%) translateY(0)     rotate(0deg); }
          20%      { transform: translateX(-50%) translateY(-18px) rotate(-6deg); }
          40%      { transform: translateX(-50%) translateY(-8px)  rotate(4deg); }
          60%      { transform: translateX(-50%) translateY(-20px) rotate(-4deg); }
          80%      { transform: translateX(-50%) translateY(-4px)  rotate(3deg); }
        }
        @keyframes tagsArmL {
          from { transform: rotate(-30deg); }
          to   { transform: rotate(20deg); }
        }
        @keyframes tagsArmR {
          from { transform: rotate(30deg); }
          to   { transform: rotate(-20deg); }
        }
        @keyframes tagsBlink {
          0%,90%,100% { transform: scaleY(1); }
          95%          { transform: scaleY(0.1); }
        }
        @keyframes tagsCrown {
          0%   { transform: rotate(0deg)   scale(1); }
          50%  { transform: rotate(180deg) scale(1.3); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes tagsLegL {
          from { transform: rotate(-15deg); }
          to   { transform: rotate(10deg); }
        }
        @keyframes tagsLegR {
          from { transform: rotate(15deg); }
          to   { transform: rotate(-10deg); }
        }
        @keyframes tagsSpark {
          0%,100% { transform: translateY(0)    scale(1);   opacity: 1; }
          50%      { transform: translateY(-10px) scale(1.4); opacity: 0.6; }
        }
        @keyframes tagsPulse {
          0%   { transform: scale(1);    opacity: 0.8; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes tagsBubble {
          0%,100% { transform: scale(1)    rotate(-2deg); opacity: 1; }
          50%      { transform: scale(1.08) rotate(2deg);  opacity: 0.9; }
        }
        @keyframes tagsStar {
          0%,100% { transform: scale(0) rotate(0deg);   opacity: 0; }
          30%,70% { transform: scale(1) rotate(180deg); opacity: 1; }
        }
        @keyframes tagsShadow {
          0%,100% { transform: translateX(-50%) scaleX(1);   opacity: 0.15; }
          40%      { transform: translateX(-50%) scaleX(0.5); opacity: 0.08; }
          60%      { transform: translateX(-50%) scaleX(0.4); opacity: 0.06; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  mascotWrap: {
    position: 'absolute',
    top: -90,
    left: '50%',
    width: 80,
    height: 80,
    zIndex: 10,
    animation: 'tagsBounce 1.4s ease-in-out infinite',
  },
  svg: {
    width: 80,
    height: 80,
    filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))',
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  bubble: {
    position: 'absolute',
    top: -26,
    right: -72,
    background: 'white',
    color: '#FA5600',
    fontSize: 10,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '4px 9px',
    borderRadius: 10,
    whiteSpace: 'nowrap',
    boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
    animation: 'tagsBubble 2s ease-in-out infinite',
    zIndex: 20,
  },
  bubbleTail: {
    content: '',
    position: 'absolute',
    bottom: -6,
    left: 10,
    borderWidth: 6,
    borderStyle: 'solid',
    borderColor: 'white transparent transparent transparent',
  },
  mascotShadow: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    width: 40,
    height: 8,
    background: 'rgba(0,0,0,0.15)',
    borderRadius: '50%',
    animation: 'tagsShadow 1.4s ease-in-out infinite',
  },
  pulseRing: {
    position: 'absolute',
    inset: -6,
    borderRadius: 999,
    border: '3px solid rgba(250,86,0,0.4)',
    animation: 'tagsPulse 1.8s ease-out infinite',
    pointerEvents: 'none',
  },
  btnStar: {
    position: 'absolute',
    fontSize: 12,
    animation: 'tagsStar 2s ease-in-out infinite',
    pointerEvents: 'none',
  },
};

export default CatalogMascot;
