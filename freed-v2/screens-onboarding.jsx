// ── FREED — Onboarding · Reference Design Language (Dark Mode) ───────────────

function Stars() { return null; }

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG       = '#1B1929';
const SURF     = '#242236';
const SURF2    = '#2D2A44';
const TEXT     = '#F0ECF8';
const TEXT2    = '#9894B5';
const TEXT3    = '#5C5880';
const PURPLE   = '#B898FF';
const PURPLEBG = 'rgba(184,152,255,0.18)';
const PEACH    = '#FF9B72';
const PEACHBG  = 'rgba(255,155,114,0.18)';
const MINT     = '#5ADF9E';
const MINTBG   = 'rgba(90,223,158,0.18)';
const PINK     = '#FF85A8';
const PINKBG   = 'rgba(255,133,168,0.18)';
const SKY      = '#82CEFF';
const SKYBG    = 'rgba(130,206,255,0.18)';
const YELLOW   = '#FFD666';
const YELLOWBG = 'rgba(255,214,102,0.18)';

// Card gradients
const PEACH_CARD  = 'linear-gradient(145deg, #3E2214 0%, #2C1A10 100%)';
const PINK_CARD   = 'linear-gradient(145deg, #3E1624 0%, #2C1018 100%)';
const PURPLE_CARD = 'linear-gradient(145deg, #271540 0%, #1E1130 100%)';
const MINT_CARD   = 'linear-gradient(145deg, #143028 0%, #10221C 100%)';

// ── FREED Logo ─────────────────────────────────────────────────────────────────
function FreedLogo({ size = 1 }) {
  const fs = Math.round(34 * size);
  return (
    <div style={{
      fontFamily: "'Nunito', sans-serif",
      fontSize: fs, fontWeight: 900,
      letterSpacing: '-0.02em', lineHeight: 1,
      display: 'inline-flex', alignItems: 'center',
    }}>
      <span style={{ color: PURPLE }}>F</span>
      <span style={{ color: TEXT }}>R</span>
      <span style={{ color: MINT }}>E</span>
      <span style={{ color: TEXT }}>E</span>
      <span style={{ color: PEACH }}>D</span>
    </div>
  );
}

// ── Back button ───────────────────────────────────────────────────────────────
function BackBtn({ onPress }) {
  return (
    <button onClick={onPress} style={{
      width: 40, height: 40, borderRadius: 14,
      background: SURF2, border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, transition: 'background 150ms',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEXT2} strokeWidth="2.5" strokeLinecap="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
  );
}

// ── SPLASH ────────────────────────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 2000);
    const t3 = setTimeout(() => onDone(), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, background: BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.5s', opacity: phase === 2 ? 0 : 1,
    }}>
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(184,152,255,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        animation: 'popIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative',
      }}>
        <FreedLogo size={1.3} />
        <div style={{
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(6px)',
          transition: 'all 0.45s',
          fontFamily: "'Nunito', sans-serif",
          fontSize: 12, color: TEXT3,
          letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          Freedom Starts Today
        </div>
      </div>
      <div style={{
        position: 'absolute', bottom: 44,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        opacity: phase >= 1 ? 0.7 : 0, transition: 'opacity 0.5s 0.2s',
      }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1,2,3,4,5].map(i => (
            <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={YELLOW}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          ))}
        </div>
        <div style={{ fontSize: 11, color: TEXT3, fontFamily: "'Nunito', sans-serif" }}>4.9 · 12,400 ratings</div>
      </div>
    </div>
  );
}

// ── WELCOME ───────────────────────────────────────────────────────────────────
function WelcomeScreen({ onStartQuiz, onLogin }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(184,152,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{ padding: '48px 0 0', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <FreedLogo size={0.85} />
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 28px', position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: 170, height: 170, borderRadius: '50%',
          background: `conic-gradient(from 180deg, ${PURPLE}44, ${MINT}44, ${PEACH}44, ${PINK}44, ${PURPLE}44)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32, animation: 'float 5s ease-in-out infinite',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 8, borderRadius: '50%',
            background: SURF,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 60 }}>🌱</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s 0.15s both' }}>
          <h1 style={{
            fontFamily: "'Nunito', sans-serif",
            fontSize: 30, fontWeight: 900, lineHeight: 1.18,
            color: TEXT, marginBottom: 14, letterSpacing: '-0.02em',
          }}>
            Break free.<br />
            <span style={{ color: PURPLE }}>Become who</span><br />
            you were meant to be.
          </h1>
          <p style={{ fontSize: 15, color: TEXT2, lineHeight: 1.6, fontFamily: "'Nunito', sans-serif", fontWeight: 500 }}>
            Science-backed recovery. Real results.
          </p>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 6, marginTop: 22, animation: 'fadeIn 0.5s 0.3s both',
        }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[1,2,3,4,5].map(i => (
              <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill={YELLOW}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            ))}
          </div>
          <div style={{ fontSize: 12, color: TEXT3, fontFamily: "'Nunito', sans-serif" }}>
            Rated #1 Recovery App · 50,000+ users
          </div>
        </div>
      </div>
      <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.5s 0.4s both', position: 'relative', zIndex: 1 }}>
        <button className="btn btn-primary" onClick={onStartQuiz} style={{ fontSize: 17 }}>
          Start My Recovery
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1929" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onLogin}>Already have an account</button>
      </div>
    </div>
  );
}

// ── QUIZ ──────────────────────────────────────────────────────────────────────
function QuizScreen({ question, step, total, options, multi = false, onAnswer, onBack, onSkip }) {
  const [selected, setSelected] = React.useState(multi ? [] : null);
  const [pressing, setPressing] = React.useState(null);

  const toggle = (val) => {
    if (multi) {
      setSelected(s => s.includes(val) ? s.filter(x => x !== val) : [...s, val]);
    } else {
      setSelected(val);
      setTimeout(() => onAnswer(val), 160);
    }
  };

  const progress = (step / total) * 100;

  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <BackBtn onPress={onBack} />
          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: progress + '%',
              background: `linear-gradient(90deg, ${PURPLE}, ${MINT})`,
              borderRadius: 99, transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
          <span style={{ fontSize: 12, color: TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700, flexShrink: 0 }}>
            {step}/{total}
          </span>
        </div>
        <div style={{ animation: 'fadeIn 0.3s both' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: PURPLEBG, borderRadius: 99, padding: '4px 12px', marginBottom: 12,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: PURPLE }} />
            <span style={{ fontSize: 11, fontWeight: 900, color: PURPLE, letterSpacing: '0.1em', fontFamily: "'Nunito', sans-serif" }}>
              QUESTION {step}
            </span>
          </div>
          <h2 style={{
            fontFamily: "'Nunito', sans-serif",
            fontSize: 22, fontWeight: 900, color: TEXT,
            lineHeight: 1.3, letterSpacing: '-0.01em',
          }}>
            {question}
          </h2>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((opt, i) => {
          const isSelected = multi ? selected.includes(opt.value) : selected === opt.value;
          const cardBgs = [PEACH_CARD, PINK_CARD, PURPLE_CARD, MINT_CARD];
          return (
            <button key={i} onClick={() => toggle(opt.value)}
              onPointerDown={() => setPressing(opt.value)}
              onPointerUp={() => setPressing(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px',
                background: isSelected ? cardBgs[i % 4] : SURF,
                border: isSelected ? `2px solid ${PURPLE}55` : `1.5px solid rgba(255,255,255,0.07)`,
                borderRadius: 20, cursor: 'pointer',
                transform: pressing === opt.value ? 'scale(0.97)' : isSelected ? 'scale(1.01)' : 'scale(1)',
                transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
                animation: `fadeIn 0.3s ${i * 0.06}s both`,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 11,
                background: isSelected ? PURPLE : 'rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 200ms',
              }}>
                {isSelected ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B1929" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 800, color: TEXT3, fontFamily: "'Nunito', sans-serif" }}>{i + 1}</span>
                )}
              </div>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: isSelected ? TEXT : TEXT2,
                fontFamily: "'Nunito', sans-serif", lineHeight: 1.3, textAlign: 'left', flex: 1,
                transition: 'color 150ms',
              }}>
                {opt.label}
              </span>
              {multi && (
                <div style={{
                  width: 22, height: 22, borderRadius: 7,
                  border: isSelected ? `2px solid ${PURPLE}` : '1.5px solid rgba(255,255,255,0.18)',
                  background: isSelected ? PURPLE : 'transparent',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms',
                }}>
                  {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1B1929" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '10px 20px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {multi && (
          <button className="btn btn-primary" onClick={() => onAnswer(selected)}
            style={{ opacity: selected.length > 0 ? 1 : 0.4, pointerEvents: selected.length > 0 ? 'all' : 'none' }}>
            Continue ({selected.length} selected)
          </button>
        )}
        {onSkip && (
          <button onClick={onSkip} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: TEXT3, fontSize: 14, fontFamily: "'Nunito', sans-serif",
            fontWeight: 600, padding: 8,
          }}>
            Skip this question
          </button>
        )}
      </div>
    </div>
  );
}

// ── INSIGHT ───────────────────────────────────────────────────────────────────
function InsightScreen({ icon, title, body, bullets, cta, onNext }) {
  const cardBgs = [PEACH_CARD, MINT_CARD, PURPLE_CARD];
  const accents = [PEACH, MINT, PURPLE];

  return (
    <div style={{
      position: 'absolute', inset: 0, background: BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '44px 24px 36px',
    }}>
      <div style={{
        width: 110, height: 110, borderRadius: 34,
        background: PURPLEBG,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28, marginTop: 16,
        animation: 'float 4s ease-in-out infinite',
        border: `1.5px solid rgba(184,152,255,0.25)`,
      }}>
        <span style={{ fontSize: 50 }}>{icon}</span>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 24, animation: 'fadeIn 0.4s 0.1s both' }}>
        <h2 style={{
          fontFamily: "'Nunito', sans-serif",
          fontSize: 26, fontWeight: 900, color: TEXT,
          marginBottom: 12, letterSpacing: '-0.02em',
        }}>
          {title}
        </h2>
        {body && (
          <p style={{ fontSize: 15, color: TEXT2, lineHeight: 1.65, fontFamily: "'Nunito', sans-serif", fontWeight: 500 }}>
            {body}
          </p>
        )}
      </div>

      {bullets && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {bullets.map((b, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: cardBgs[i % 3], borderRadius: 20,
              animation: `fadeIn 0.4s ${0.2 + i * 0.1}s both`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {b.icon}
              </div>
              <p style={{ fontSize: 14, color: TEXT2, fontFamily: "'Nunito', sans-serif", lineHeight: 1.4, fontWeight: 500 }}>
                <strong style={{ color: accents[i % 3], fontWeight: 800 }}>{b.bold}</strong>
                {b.text && ' ' + b.text}
              </p>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{
            width: i === 0 ? 22 : 6, height: 6, borderRadius: 99,
            background: i === 0 ? PURPLE : 'rgba(255,255,255,0.12)',
          }} />
        ))}
      </div>
      <button className="btn btn-primary" onClick={onNext}>
        {cta || 'Next'}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1929" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  );
}

// ── SIGN UP ───────────────────────────────────────────────────────────────────
function SignUpScreen({ onApple, onGoogle, onEmail, onBack }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 20px 0', position: 'relative', zIndex: 1 }}>
        <BackBtn onPress={onBack} />
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 24px 24px', position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36, animation: 'fadeIn 0.4s both' }}>
          <FreedLogo size={0.95} />
          <h2 style={{
            fontFamily: "'Nunito', sans-serif",
            fontSize: 24, fontWeight: 900, color: TEXT,
            marginTop: 16, marginBottom: 8, letterSpacing: '-0.02em',
          }}>
            Create your account
          </h2>
          <p style={{ fontSize: 14, color: TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 500 }}>
            Join 50,000+ people on their recovery journey
          </p>
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={onApple} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            height: 58, borderRadius: 999,
            background: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 800, color: '#000',
            animation: 'fadeIn 0.4s 0.1s both',
          }}>
            <svg width="18" height="18" viewBox="0 0 814 1000" fill="#000">
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-87.8-150.3-120.2c-50.5-36.5-100.2-93-100.2-206.3C.1 487.2 123.5 349 235.8 273.9c65.5-43.5 149.6-73 235.7-73 83.9 0 141.1 33.9 193.4 59.7 52.3 25.8 100.5 71.4 100.5 71.4z"/>
            </svg>
            Continue with Apple
          </button>
          <button onClick={onGoogle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            height: 58, borderRadius: 999,
            background: SURF2, border: `1.5px solid rgba(255,255,255,0.1)`,
            cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 700, color: TEXT,
            animation: 'fadeIn 0.4s 0.15s both',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <button onClick={onEmail} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            height: 58, borderRadius: 999,
            background: SURF, border: `1.5px solid rgba(255,255,255,0.08)`,
            cursor: 'pointer',
            fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 700, color: TEXT2,
            animation: 'fadeIn 0.4s 0.2s both',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEXT2} strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
            Continue with Email
          </button>
        </div>
        <p style={{
          marginTop: 20, fontSize: 12, color: TEXT3,
          fontFamily: "'Nunito', sans-serif", textAlign: 'center', lineHeight: 1.5,
          animation: 'fadeIn 0.4s 0.3s both',
        }}>
          By continuing you agree to our{' '}
          <span style={{ color: PURPLE }}>Terms</span>{' '}&amp;{' '}
          <span style={{ color: PURPLE }}>Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────
function EmailScreen({ onBack, onContinue }) {
  const [mode, setMode] = React.useState('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [showPass, setShowPass] = React.useState(false);

  const labelStyle = {
    fontSize: 11, fontWeight: 800, color: TEXT3,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    fontFamily: "'Nunito', sans-serif",
    display: 'block', marginBottom: 8,
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 20px 0' }}>
        <BackBtn onPress={onBack} />
      </div>
      <div style={{ flex: 1, padding: '20px 24px 32px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 26, fontWeight: 900, color: TEXT, marginBottom: 6 }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ fontSize: 14, color: TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 500 }}>
            {mode === 'signin' ? 'Sign in to continue your journey' : 'Set up your FREED account'}
          </p>
        </div>
        <div style={{ display: 'flex', background: SURF2, borderRadius: 16, padding: 4, marginBottom: 26, gap: 4 }}>
          {['signin','signup'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, height: 38, borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 800,
              background: mode === m ? PURPLEBG : 'transparent',
              color: mode === m ? PURPLE : TEXT3,
              transition: 'all 200ms',
              outline: mode === m ? `1.5px solid rgba(184,152,255,0.3)` : '1.5px solid transparent',
            }}>
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {mode === 'signup' && (
            <div>
              <label style={labelStyle}>Full Name</label>
              <input className="input-field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label style={labelStyle}>Email Address</label>
            <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input className="input-field" type={showPass ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: 48 }} />
              <button onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEXT3} strokeWidth="2" strokeLinecap="round">
                  {showPass
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: PURPLE, fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>
                  Forgot password?
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => onContinue({ email, password, name })}
          style={{ marginTop: 24, opacity: email && password ? 1 : 0.4 }}>
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </div>
    </div>
  );
}

// ── PAYWALL ───────────────────────────────────────────────────────────────────
function PaywallScreen({ onSubscribe, onRestore, onClose }) {
  const [plan, setPlan] = React.useState('annual');

  const plans = [
    { id: 'annual',   label: 'Yearly',   price: '$3.33', period: '/mo', sub: '12 months · $39.99', badge: 'Best Value', badgeColor: PURPLE, badgeBg: PURPLEBG },
    { id: 'monthly',  label: 'Monthly',  price: '$9.99', period: '/mo', sub: 'Billed monthly',      badge: 'Popular',   badgeColor: PEACH,  badgeBg: PEACHBG },
    { id: 'lifetime', label: 'Weekly',   price: '$4.99', period: '/wk', sub: 'Billed weekly',       badge: 'Regular',   badgeColor: MINT,   badgeBg: MINTBG },
  ];

  const features = [
    { text: 'Challenge System — intercept cravings instantly', color: PEACH },
    { text: 'Content Blocker — device-level protection',       color: PURPLE },
    { text: 'CLARA AI Therapist — 150 sessions/day',          color: MINT },
    { text: 'Full analytics + radar chart + level system',     color: SKY },
    { text: 'Life Tree, achievements, progress card',          color: YELLOW },
    { text: '30-Day & 28-Day structured programs',            color: PINK },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {onClose && (
        <div style={{ padding: '14px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            width: 34, height: 34, borderRadius: 12,
            background: SURF2, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEXT2} strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* Hero banner — reference "Go Premium" gradient */}
      <div style={{
        margin: '8px 20px 0',
        borderRadius: 24,
        background: 'linear-gradient(135deg, #3E1624 0%, #3E2214 60%, #302614 100%)',
        padding: '24px 22px 18px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -20, width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,133,168,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: 20, width: 100, height: 100, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,155,114,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 42, marginBottom: 10, textAlign: 'center', position: 'relative', zIndex: 1 }}>✨</div>
        <h1 style={{
          fontFamily: "'Nunito', sans-serif", fontSize: 30, fontWeight: 900,
          color: TEXT, letterSpacing: '-0.02em', marginBottom: 6,
          textAlign: 'center', position: 'relative', zIndex: 1,
        }}>
          Go Premium
        </h1>
        <p style={{ fontSize: 14, color: TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          Unlock the full FREED experience
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex' }}>
            {[PEACH, PURPLE, MINT, SKY].map((c, i) => (
              <div key={i} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: c, border: `2px solid ${BG}`, marginLeft: i > 0 ? -5 : 0,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>
            <strong style={{ color: TEXT }}>50,247</strong> recovering now
          </span>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '18px 24px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              animation: `fadeIn 0.4s ${0.1 + i * 0.05}s both`,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1B1929" strokeWidth="3" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, color: TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Choose a plan */}
      <div style={{ padding: '0 20px 6px' }}>
        <div style={{ fontSize: 13, color: TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
          Choose a Plan
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.map((p, i) => {
            const isActive = plan === p.id;
            return (
              <button key={p.id} onClick={() => setPlan(p.id)} style={{
                display: 'flex', alignItems: 'center',
                padding: '14px 16px', borderRadius: 20,
                background: isActive ? SURF2 : SURF,
                border: isActive ? `2px solid ${PURPLE}55` : `1.5px solid rgba(255,255,255,0.07)`,
                cursor: 'pointer',
                transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
                animation: `fadeIn 0.4s ${0.3 + i * 0.07}s both`,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', marginRight: 14, flexShrink: 0,
                  border: isActive ? `6px solid ${PURPLE}` : `2px solid rgba(255,255,255,0.22)`,
                  transition: 'all 200ms',
                }} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: TEXT, fontFamily: "'Nunito', sans-serif" }}>{p.label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 99,
                      background: p.badgeBg, color: p.badgeColor,
                      fontFamily: "'Nunito', sans-serif",
                    }}>
                      {p.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>{p.sub}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: isActive ? TEXT : TEXT2, fontFamily: "'Nunito', sans-serif" }}>{p.price}</span>
                  <span style={{ fontSize: 11, color: TEXT3, fontFamily: "'Nunito', sans-serif" }}>{p.period}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '16px 24px 28px' }}>
        <button className="btn btn-primary" onClick={() => onSubscribe(plan)}
          style={{ fontSize: 17, fontWeight: 900, animation: 'glow-pulse 2.5s ease-in-out infinite' }}>
          Upgrade Plan
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12 }}>
          {['Cancel anytime', 'No commitment', 'Secure'].map((t, i) => (
            <span key={i} style={{ fontSize: 11, color: TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke={MINT} strokeWidth="3" fill="none" strokeLinecap="round"/>
              </svg>
              {t}
            </span>
          ))}
        </div>
        <button onClick={onRestore} style={{
          background: 'none', border: 'none', cursor: 'pointer', width: '100%',
          marginTop: 12, fontSize: 12, color: TEXT3, fontFamily: "'Nunito', sans-serif",
          fontWeight: 600, textDecoration: 'underline',
        }}>
          Restore Purchase
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  Stars, FreedLogo, BackBtn,
  SplashScreen, WelcomeScreen, QuizScreen, InsightScreen,
  SignUpScreen, EmailScreen, PaywallScreen,
});
