// src/components/CatalogMascot.tsx
// No extra dependencies — pure CSS animations, self-contained keyframes
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function CatalogMascot() {
  return (
    <>
      <style>{`

        /* ── SCENE CONTAINER ── */
        .tags-scene {
          position: relative;
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          width: 220px;
          height: 130px;
          overflow: visible;
        }

        /* ── BUTTON ── */
        .tags-btn {
          position: absolute;
          bottom: 0;
          left: 50%;
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
          text-decoration: none;
          box-shadow: 0 6px 20px rgba(250,86,0,0.45);
          transform-origin: center bottom;
          z-index: 2;
          animation: tagsBtnSpring 2.8s ease-in-out infinite;
        }
        .tags-btn:hover { background: #E04A00; }

        @keyframes tagsBtnSpring {
          0%,58%   { transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          64%      { transform: translateX(-50%) scaleY(0.78) scaleX(1.18); }
          71%      { transform: translateX(-50%) scaleY(1.09) scaleX(0.93); }
          76%      { transform: translateX(-50%) scaleY(0.97) scaleX(1.02); }
          82%,100% { transform: translateX(-50%) scaleY(1)    scaleX(1);    }
        }

        /* ── PULSE RINGS ── */
        .tags-pulse {
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 190px;
          height: 48px;
          border-radius: 999px;
          border: 2px solid rgba(250,86,0,0.3);
          pointer-events: none;
          z-index: 1;
          animation: tagsPulse 1.8s ease-out infinite;
        }
        .tags-pulse:nth-child(2) { animation-delay: 0.6s; }
        .tags-pulse:nth-child(3) { animation-delay: 1.2s; }
        @keyframes tagsPulse {
          0%   { transform: translateX(-50%) scale(1);   opacity: 0.7; }
          100% { transform: translateX(-50%) scale(1.5); opacity: 0;   }
        }

        /* ── MASCOT: subtle ~26px drop (≈1cm) ── */
        .tags-mascot {
          position: absolute;
          left: 50%;
          width: 56px;
          height: 56px;
          z-index: 3;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
          animation: tagsMascotDrop 2.8s ease-in-out infinite;
        }

        @keyframes tagsMascotDrop {
          /* idle float */
          0%,15%  { bottom: 60px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          22%     { bottom: 64px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          32%     { bottom: 60px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          /* wait then fall */
          52%     { bottom: 60px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          62%     { bottom: 38px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
          /* squash on impact */
          65%     { bottom: 36px; transform: translateX(-50%) scaleY(0.74) scaleX(1.22); }
          /* spring launch */
          73%     { bottom: 60px; transform: translateX(-50%) scaleY(1.10) scaleX(0.92); }
          80%     { bottom: 60px; transform: translateX(-50%) scaleY(0.97) scaleX(1.03); }
          100%    { bottom: 60px; transform: translateX(-50%) scaleY(1)    scaleX(1);    }
        }

        /* ── ARM WAVE ── */
        .tags-arm-l {
          animation: tagsArmL 1s ease-in-out infinite alternate;
          transform-origin: 16px 26px;
        }
        .tags-arm-r {
          animation: tagsArmR 1s ease-in-out infinite alternate;
          transform-origin: 40px 26px;
          animation-delay: 0.5s;
        }
        @keyframes tagsArmL { from { transform: rotate(-28deg); } to { transform: rotate(16deg);  } }
        @keyframes tagsArmR { from { transform: rotate(28deg);  } to { transform: rotate(-16deg); } }

        /* ── BLINK ── */
        .tags-eye { animation: tagsBlink 3.5s ease-in-out infinite; }
        @keyframes tagsBlink {
          0%,87%,100% { transform: scaleY(1);    }
          92%          { transform: scaleY(0.07); }
        }

        /* ── CROWN ── */
        .tags-crown {
          animation: tagsCrown 2.6s linear infinite;
          transform-origin: 28px 4px;
        }
        @keyframes tagsCrown { to { transform: rotate(360deg); } }

        /* ── LEGS ── */
        .tags-leg-l {
          animation: tagsLegL 0.5s ease-in-out infinite alternate;
          transform-origin: 22px 46px;
        }
        .tags-leg-r {
          animation: tagsLegR 0.5s ease-in-out infinite alternate;
          transform-origin: 34px 46px;
          animation-delay: 0.25s;
        }
        @keyframes tagsLegL { from { transform: rotate(-12deg); } to { transform: rotate(8deg);   } }
        @keyframes tagsLegR { from { transform: rotate(12deg);  } to { transform: rotate(-8deg);  } }

        /* ── FLOATING "CLICK ME" WORDS ──
           Anchor sits at button pill centre (bottom: 22px).
           Words appear at impact (≈63% of 2.8s), drift slowly upward, fade out.
        */
        .tags-floaters {
          position: absolute;
          bottom: 14px;
          left: 50%;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 20;
        }

        .tags-word {
          position: absolute;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 1px;
          text-transform: uppercase;
          white-space: nowrap;
          opacity: 0;
          animation: tagsFloatUp 2.8s ease-out infinite;
        }

        @keyframes tagsFloatUp {
          0%,61%  { opacity: 0;   transform: translate(var(--sx),  0px)   scale(0.5);  }
          64%     { opacity: 1;   transform: translate(var(--sx),  0px)   scale(1.15); }
          70%     { opacity: 1;   transform: translate(var(--sx), -10px)  scale(1);    }
          85%     { opacity: 0.9; transform: translate(var(--sx2),-24px)  scale(0.95); }
          98%     { opacity: 0;   transform: translate(var(--sx2),-34px)  scale(0.8);  }
          100%    { opacity: 0; }
        }

      `}</style>

      <div className="tags-scene">

        {/* Pulse rings */}
        <div className="tags-pulse" />
        <div className="tags-pulse" />
        <div className="tags-pulse" />

        {/* Floating words — anchored at button centre, fire on impact */}
        <div className="tags-floaters">
          {/* CLICK — drifts left, white */}
          <span className="tags-word"
            style={{ color: '#ffffff', textShadow: '0 1px 8px rgba(0,0,0,0.9)', ['--sx' as any]: '-52px', ['--sx2' as any]: '-58px', animationDelay: '0s' }}>
            CLICK
          </span>
          {/* ME! — drifts right, gold */}
          <span className="tags-word"
            style={{ color: '#FFD600', textShadow: '0 1px 8px rgba(0,0,0,0.9)', ['--sx' as any]: '18px', ['--sx2' as any]: '24px', animationDelay: '0.06s' }}>
            ME!
          </span>
          {/* star left */}
          <span className="tags-word"
            style={{ color: '#FFD600', fontSize: 16, textShadow: '0 1px 6px rgba(0,0,0,0.7)', ['--sx' as any]: '-22px', ['--sx2' as any]: '-26px', animationDelay: '0.03s' }}>
            ★
          </span>
          {/* sparkle right */}
          <span className="tags-word"
            style={{ color: '#FF2D55', fontSize: 14, textShadow: '0 1px 6px rgba(0,0,0,0.7)', ['--sx' as any]: '44px', ['--sx2' as any]: '50px', animationDelay: '0.08s' }}>
            ✦
          </span>
          {/* dot far left */}
          <span className="tags-word"
            style={{ color: '#ffffff', fontSize: 18, textShadow: '0 1px 6px rgba(0,0,0,0.6)', ['--sx' as any]: '-70px', ['--sx2' as any]: '-74px', animationDelay: '0.04s' }}>
            ·
          </span>
        </div>

        {/* Mascot */}
        <div className="tags-mascot">
          <svg viewBox="0 0 56 56" width="56" height="56" xmlns="http://www.w3.org/2000/svg">

            {/* ground shadow */}
            <ellipse cx="28" cy="54" rx="14" ry="3" fill="rgba(0,0,0,0.10)" />

            {/* legs */}
            <g className="tags-leg-l">
              <rect x="17" y="44" width="7" height="10" rx="3.5" fill="#FA5600" />
              <circle cx="20.5" cy="54" r="3.5" fill="#1C1C1E" />
            </g>
            <g className="tags-leg-r">
              <rect x="32" y="44" width="7" height="10" rx="3.5" fill="#FA5600" />
              <circle cx="35.5" cy="54" r="3.5" fill="#1C1C1E" />
            </g>

            {/* body */}
            <rect x="12" y="22" width="32" height="25" rx="7" fill="#FA5600" />
            <rect x="12" y="22" width="32" height="5"  rx="7" fill="#E04A00" />
            <line x1="32" y1="27" x2="32" y2="47" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
            <line x1="12" y1="36" x2="44" y2="36" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

            {/* left arm */}
            <g className="tags-arm-l">
              <rect x="3"  y="24" width="11" height="6" rx="3" fill="#FFD600" />
              <circle cx="3" cy="27" r="3.5" fill="#FF9500" />
            </g>

            {/* right arm */}
            <g className="tags-arm-r">
              <rect x="42" y="24" width="11" height="6" rx="3" fill="#FFD600" />
              <circle cx="53" cy="27" r="3.5" fill="#FF9500" />
            </g>

            {/* head */}
            <rect x="14" y="7" width="28" height="20" rx="6" fill="#1C1C1E" />
            <rect x="17" y="10" width="9"  height="3"  rx="1.5" fill="rgba(255,255,255,0.07)" />

            {/* eyes */}
            <g className="tags-eye" style={{ transformOrigin: '21px 17px' }}>
              <circle cx="21" cy="17" r="4.5" fill="white" />
              <circle cx="21" cy="17" r="2.5" fill="#FA5600" />
              <circle cx="22" cy="15.8" r="0.9" fill="white" />
            </g>
            <g className="tags-eye" style={{ transformOrigin: '35px 17px', animationDelay: '0.1s' }}>
              <circle cx="35" cy="17" r="4.5" fill="white" />
              <circle cx="35" cy="17" r="2.5" fill="#FA5600" />
              <circle cx="36" cy="15.8" r="0.9" fill="white" />
            </g>

            {/* smile */}
            <path d="M22 22 Q28 26 34 22" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />

            {/* belly screen */}
            <rect x="18" y="30" width="20" height="11" rx="3.5" fill="#1C1C1E" />
            <text x="28" y="39" textAnchor="middle" fontSize="7" fill="#FFD600" fontWeight="900" fontFamily="monospace">TAGS</text>

            {/* crown */}
            <g className="tags-crown">
              <polygon
                points="28,1 30,5 35,5.5 31.5,8.5 32.5,13.5 28,11 23.5,13.5 24.5,8.5 21,5.5 26,5"
                fill="#FFD600" stroke="#FF9500" strokeWidth="0.4" />
            </g>

            {/* antenna */}
            <line x1="28" y1="7" x2="28" y2="3" stroke="#FFD600" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="28" cy="2" r="1.8" fill="#FF2D55">
              <animate attributeName="r"    values="1.8;2.6;1.8"                   dur="0.9s" repeatCount="indefinite" />
              <animate attributeName="fill" values="#FF2D55;#FFD600;#FF2D55" dur="0.9s" repeatCount="indefinite" />
            </circle>

          </svg>
        </div>

        {/* Browse Catalog button */}
        <Link to="/products" className="tags-btn">
          Browse Catalog <ArrowRight size={14} />
        </Link>

      </div>
    </>
  );
}

export default CatalogMascot;
