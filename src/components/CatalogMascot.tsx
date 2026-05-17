// src/components/CatalogMascot.tsx
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function CatalogMascot() {
  return (
    <>
      <style>{`
        .tags-scene {
          position: relative;
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          height: 130px;
          width: 220px;
        }

        /* ── MASCOT: subtle ~30px travel (≈1 cm on screen) ── */
        .tags-mascot {
          position: absolute;
          left: 50%;
          width: 64px;
          height: 64px;
          z-index: 3;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
          /* bottom:56px = resting above button; falls to bottom:44px on impact */
          animation: tagsMascotBounce 2.2s ease-in-out infinite;
        }

        @keyframes tagsMascotBounce {
          /*  idle float at top  */
          0%   { bottom: 68px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          8%   { bottom: 72px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          18%  { bottom: 68px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          /* pause before fall */
          50%  { bottom: 68px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          /* fall down to button */
          62%  { bottom: 44px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          /* squash on landing */
          65%  { bottom: 42px; transform: translateX(-50%) scaleY(0.76) scaleX(1.20); }
          /* spring launch back up */
          72%  { bottom: 74px; transform: translateX(-50%) scaleY(1.10) scaleX(0.93); }
          78%  { bottom: 68px; transform: translateX(-50%) scaleY(0.97) scaleX(1.03); }
          84%  { bottom: 70px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          100% { bottom: 68px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
        }

        /* ── ARM WAVE ── */
        .tags-arm-l {
          animation: tagsArmL 0.9s ease-in-out infinite alternate;
          transform-origin: 18px 30px;
        }
        .tags-arm-r {
          animation: tagsArmR 0.9s ease-in-out infinite alternate;
          transform-origin: 46px 30px;
          animation-delay: 0.45s;
        }
        @keyframes tagsArmL {
          from { transform: rotate(-25deg); }
          to   { transform: rotate(15deg);  }
        }
        @keyframes tagsArmR {
          from { transform: rotate(25deg);  }
          to   { transform: rotate(-15deg); }
        }

        /* ── BLINK ── */
        .tags-eye-l { animation: tagsBlink 3.5s ease-in-out infinite; transform-origin: 24px 19px; }
        .tags-eye-r { animation: tagsBlink 3.5s ease-in-out infinite; transform-origin: 40px 19px; animation-delay: 0.12s; }
        @keyframes tagsBlink {
          0%,88%,100% { transform: scaleY(1);    }
          93%          { transform: scaleY(0.08); }
        }

        /* ── CROWN SPIN ── */
        .tags-crown {
          animation: tagsCrown 2.4s linear infinite;
          transform-origin: 32px 5px;
        }
        @keyframes tagsCrown {
          0%   { transform: rotate(0deg)   scale(1);    }
          50%  { transform: rotate(180deg) scale(1.22); }
          100% { transform: rotate(360deg) scale(1);    }
        }

        /* ── LEG DANCE ── */
        .tags-leg-l { animation: tagsLegL 0.45s ease-in-out infinite alternate; transform-origin: 24px 52px; }
        .tags-leg-r { animation: tagsLegR 0.45s ease-in-out infinite alternate; transform-origin: 40px 52px; animation-delay: 0.22s; }
        @keyframes tagsLegL {
          from { transform: rotate(-12deg); }
          to   { transform: rotate(8deg);   }
        }
        @keyframes tagsLegR {
          from { transform: rotate(12deg);  }
          to   { transform: rotate(-8deg);  }
        }

        /* ── BUTTON: squishes when mascot lands, springs back ── */
        .tags-btn {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform-origin: center bottom;
          background: #FA5600;
          color: white;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 14px 28px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          box-shadow: 0 6px 20px rgba(250,86,0,0.4);
          text-decoration: none;
          z-index: 2;
          animation: tagsButtonSpring 2.2s ease-in-out infinite;
        }
        .tags-btn:hover { background: #E04A00; }

        /* synced: impact at 62–65% → squish → spring up → settle */
        @keyframes tagsButtonSpring {
          0%   { transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          62%  { transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          /* squish down */
          65%  { transform: translateX(-50%) scaleY(0.78) scaleX(1.16); }
          /* spring back up */
          71%  { transform: translateX(-50%) scaleY(1.09) scaleX(0.94); }
          76%  { transform: translateX(-50%) scaleY(0.97) scaleX(1.02); }
          81%  { transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          100% { transform: translateX(-50%) scaleY(1)    scaleX(1);    }
        }

        /* ── SPEECH BUBBLE ── */
        .tags-bubble {
          position: absolute;
          top: -2px;
          right: -14px;
          background: white;
          color: #FA5600;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 3px 8px;
          border-radius: 8px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 10;
          animation: tagsBubble 2.2s ease-in-out infinite;
        }
        .tags-bubble::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 8px;
          border: 5px solid transparent;
          border-top-color: white;
          border-bottom: 0;
        }
        @keyframes tagsBubble {
          0%,100% { transform: scale(1)    rotate(-1deg); opacity: 1;   }
          50%      { transform: scale(1.05) rotate(1deg);  opacity: 0.9; }
        }

        /* ── SPARKLES ── */
        .tags-sp {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          animation: tagsSparkle 1.4s ease-in-out infinite;
        }
        @keyframes tagsSparkle {
          0%,100% { transform: translateY(0)    scale(1);   opacity: 0.9; }
          50%      { transform: translateY(-7px) scale(1.3); opacity: 0.5; }
        }

        /* ── PULSE RINGS ── */
        .tags-pulse {
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 180px;
          height: 48px;
          border-radius: 999px;
          border: 2px solid rgba(250,86,0,0.3);
          animation: tagsPulse 1.8s ease-out infinite;
          pointer-events: none;
          z-index: 1;
        }
        .tags-pulse:nth-child(2) { animation-delay: 0.6s; }
        .tags-pulse:nth-child(3) { animation-delay: 1.2s; }
        @keyframes tagsPulse {
          0%   { transform: translateX(-50%) scale(1);   opacity: 0.7; }
          100% { transform: translateX(-50%) scale(1.5); opacity: 0;   }
        }
      `}</style>

      <div className="tags-scene">

        {/* Pulse rings */}
        <div className="tags-pulse" />
        <div className="tags-pulse" />
        <div className="tags-pulse" />

        {/* Mascot */}
        <div className="tags-mascot">

          {/* Speech bubble */}
          <div className="tags-bubble">Click me! 🎉</div>

          {/* Sparkles */}
          <div className="tags-sp" style={{ width:6, height:6, background:'#FFD600', top:-6,  left:-12, animationDelay:'0s'    }} />
          <div className="tags-sp" style={{ width:5, height:5, background:'#FF2D55', top: 8,  right:-13, animationDelay:'0.5s'  }} />
          <div className="tags-sp" style={{ width:4, height:4, background:'#25D366', top:-8,  right: 2,  animationDelay:'1.0s'  }} />

          {/* SVG Robot */}
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="64" height="64">

            {/* Legs */}
            <g className="tags-leg-l">
              <rect x="20" y="50" width="8" height="11" rx="4" fill="#FA5600"/>
              <circle cx="24" cy="61" r="4" fill="#1C1C1E"/>
            </g>
            <g className="tags-leg-r">
              <rect x="36" y="50" width="8" height="11" rx="4" fill="#FA5600"/>
              <circle cx="40" cy="61" r="4" fill="#1C1C1E"/>
            </g>

            {/* Body */}
            <rect x="14" y="24" width="36" height="29" rx="8" fill="#FA5600"/>
            <rect x="14" y="24" width="36" height="5"  rx="8" fill="#E04A00"/>
            <line x1="32" y1="29" x2="32" y2="53" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2"/>
            <line x1="14" y1="38" x2="50" y2="38" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>

            {/* Left arm */}
            <g className="tags-arm-l">
              <rect x="4"  y="26" width="12" height="7" rx="3.5" fill="#FFD600"/>
              <circle cx="4" cy="29.5" r="4" fill="#FF9500"/>
            </g>

            {/* Right arm */}
            <g className="tags-arm-r">
              <rect x="48" y="26" width="12" height="7" rx="3.5" fill="#FFD600"/>
              <circle cx="60" cy="29.5" r="4" fill="#FF9500"/>
            </g>

            {/* Head */}
            <rect x="16" y="8" width="32" height="22" rx="7" fill="#1C1C1E"/>
            <rect x="19" y="11" width="10" height="3" rx="1.5" fill="rgba(255,255,255,0.07)"/>

            {/* Eyes */}
            <g className="tags-eye-l">
              <circle cx="24" cy="19" r="5"   fill="white"/>
              <circle cx="24" cy="19" r="2.8" fill="#FA5600"/>
              <circle cx="25.2" cy="17.8" r="1" fill="white"/>
            </g>
            <g className="tags-eye-r">
              <circle cx="40" cy="19" r="5"   fill="white"/>
              <circle cx="40" cy="19" r="2.8" fill="#FA5600"/>
              <circle cx="41.2" cy="17.8" r="1" fill="white"/>
            </g>

            {/* Smile */}
            <path d="M26 25 Q32 29 38 25" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/>

            {/* Belly screen */}
            <rect x="21" y="32" width="22" height="13" rx="4" fill="#1C1C1E"/>
            <text x="32" y="42" textAnchor="middle" fontSize="7.5" fill="#FFD600" fontWeight="900" fontFamily="monospace">TAGS</text>

            {/* Crown star */}
            <g className="tags-crown">
              <polygon
                points="32,0 34,4.5 39,5 35.5,8 36.8,13 32,10.5 27.2,13 28.5,8 25,5 30,4.5"
                fill="#FFD600" stroke="#FF9500" strokeWidth="0.5"/>
            </g>

            {/* Antenna */}
            <line x1="32" y1="8" x2="32" y2="3" stroke="#FFD600" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="32" cy="2.5" r="2" fill="#FF2D55">
              <animate attributeName="r"    values="2;3;2"                   dur="0.9s" repeatCount="indefinite"/>
              <animate attributeName="fill" values="#FF2D55;#FFD600;#FF2D55" dur="0.9s" repeatCount="indefinite"/>
            </circle>

          </svg>
        </div>

        {/* Browse Catalog button */}
        <Link to="/products" className="tags-btn">
          Browse Catalog <ArrowRight size={15} />
        </Link>

      </div>
    </>
  );
}

export default CatalogMascot;
