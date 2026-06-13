// ── FREED — Home Screens · Reference Design Language (Dark Mode) ─────────────

// ── Design tokens ──────────────────────────────────────────────────────────────
const _BG       = '#1B1929';
const _SURF     = '#242236';
const _SURF2    = '#2D2A44';
const _TEXT     = '#F0ECF8';
const _TEXT2    = '#9894B5';
const _TEXT3    = '#5C5880';
const _PURPLE   = '#B898FF';
const _PEACH    = '#FF9B72';
const _PINK     = '#FF85A8';
const _MINT     = '#5ADF9E';
const _SKY      = '#82CEFF';
const _YELLOW   = '#FFD666';

// Card gradient fills — dark mode of reference pastel cards
const _PEACH_CARD  = 'linear-gradient(145deg, #3E2214 0%, #2C1A10 100%)';
const _PINK_CARD   = 'linear-gradient(145deg, #3E1624 0%, #2C1018 100%)';
const _PURPLE_CARD = 'linear-gradient(145deg, #271540 0%, #1E1130 100%)';
const _SKY_CARD    = 'linear-gradient(145deg, #152840 0%, #111E2C 100%)';
const _MINT_CARD   = 'linear-gradient(145deg, #143028 0%, #10221C 100%)';
const _YELLOW_CARD = 'linear-gradient(145deg, #302614 0%, #221C10 100%)';

// Tinted bg chips
const _PURPLEBG = 'rgba(184,152,255,0.18)';
const _PEACHBG  = 'rgba(255,155,114,0.18)';
const _PINKBG   = 'rgba(255,133,168,0.18)';
const _MINTBG   = 'rgba(90,223,158,0.18)';
const _YELLOWBG = 'rgba(255,214,102,0.18)';
const _SKYBG    = 'rgba(130,206,255,0.18)';

// ── Recovery Ring ──────────────────────────────────────────────────────────────
function StreakOrb({ days }) {
  const pct = Math.min(100, Math.round((days / 90) * 100));
  const r = 64, stroke = 10;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <div style={{ position: 'relative', width: 156, height: 156, flexShrink: 0 }}>
      <svg width="156" height="156" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="78" cy="78" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}/>
        <circle cx="78" cy="78" r={r} fill="none"
          stroke="url(#recRingGrad)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <defs>
          <linearGradient id="recRingGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={_SKY}/>
            <stop offset="50%" stopColor={_PURPLE}/>
            <stop offset="100%" stopColor={_PINK}/>
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: "'Nunito', sans-serif", fontSize: 32, fontWeight: 900,
          color: _TEXT, lineHeight: 1, letterSpacing: '-0.03em',
          animation: 'countUp 0.5s both',
        }}>
          {pct}<span style={{ fontSize: 16, color: _TEXT2, fontWeight: 700 }}>%</span>
        </div>
        <div style={{ fontSize: 10, color: _TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700, marginTop: 3 }}>
          Complete
        </div>
      </div>
    </div>
  );
}

// ── Sidebar stat card (next to ring, reference style) ──────────────────────────
function SideStatCard({ value, label, accent, cardBg, icon }) {
  return (
    <div style={{
      flex: 1, borderRadius: 18, padding: '11px 13px',
      background: cardBg,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8,
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 10, color: accent, fontFamily: "'Nunito', sans-serif", fontWeight: 900, letterSpacing: '0.02em' }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: "'Nunito', sans-serif", fontSize: 24, fontWeight: 900,
        color: _TEXT, lineHeight: 1, letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Summary card — 2×2 grid (reference large stat card) ───────────────────────
function SummaryCard({ value, label, accent, cardBg, icon }) {
  return (
    <div style={{
      borderRadius: 22, padding: '18px 16px',
      background: cardBg,
      display: 'flex', flexDirection: 'column',
      minHeight: 118,
    }}>
      <div style={{
        fontFamily: "'Nunito', sans-serif", fontSize: 36, fontWeight: 900,
        color: _TEXT, lineHeight: 1, letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
        <div style={{ fontSize: 12, color: accent, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>
          {label}
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 9,
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ── HOME SCREEN ────────────────────────────────────────────────────────────────
function HomeScreen({ streak, onPanic, onTabChange }) {
  const [timeStr, setTimeStr] = React.useState('');
  const days = streak || 5;

  React.useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
      setTimeStr(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const weekDays = ['M','T','W','T','F','S','S'];
  const checkStates = [true, false, true, true, true, true, null];
  const rewardPct = Math.min(100, Math.round((days / 90) * 100));

  return (
    <div style={{ position: 'absolute', inset: 0, background: _BG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 104 }}>

        {/* Header */}
        <div style={{ padding: '12px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FreedLogo size={0.62} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: _PEACHBG, borderRadius: 99, padding: '5px 12px' }}>
              <span style={{ fontSize: 14 }}>🔥</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: _PEACH, fontFamily: "'Nunito', sans-serif" }}>{days}</span>
            </div>
            <button onClick={() => onTabChange('community')} style={{
              width: 36, height: 36, borderRadius: 12, background: _SURF, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={_TEXT2} strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </button>
            <button style={{
              width: 36, height: 36, borderRadius: 12, background: _SURF, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={_TEXT2} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Week strip */}
        <div style={{ padding: '0 20px 18px', display: 'flex', gap: 6 }}>
          {weekDays.map((d, i) => {
            const state = checkStates[i];
            const isToday = state === null;
            return (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                animation: `fadeIn 0.3s ${i * 0.04}s both`,
              }}>
                <span style={{ fontSize: 10, color: _TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{d}</span>
                <div style={{
                  width: 34, height: 34, borderRadius: 11,
                  background: isToday ? _PURPLE_CARD : state ? _MINT_CARD : _SURF,
                  border: isToday ? `2px solid ${_PURPLE}55` : state ? `1.5px solid rgba(90,223,158,0.3)` : `1.5px solid rgba(255,255,255,0.07)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isToday ? (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: _PURPLE }} />
                  ) : state ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={_MINT} strokeWidth="2.5" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={_TEXT3} strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's Progress */}
        <div style={{ padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: _TEXT, fontFamily: "'Nunito', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>Today's Progress</span>
            <span style={{ fontSize: 12, color: _PURPLE, fontFamily: "'Nunito', sans-serif", fontWeight: 800, flexShrink: 0 }}>View All</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <StreakOrb days={days} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SideStatCard value={days} label="Day Streak" accent={_PEACH} cardBg={_PEACH_CARD} icon="🔥" />
              <SideStatCard value="3/6" label="Habits Done" accent={_PURPLE} cardBg={_PURPLE_CARD} icon="✓" />
              <SideStatCard value={Math.max(0, 90-days)} label="Days to 90" accent={_MINT} cardBg={_MINT_CARD} icon="🎯" />
            </div>
          </div>
        </div>

        {/* Daily Pledge banner — reference action banner style */}
        <div style={{ padding: '0 20px 18px' }}>
          <div style={{
            background: _YELLOW_CARD,
            border: `1.5px solid rgba(255,214,102,0.2)`,
            borderRadius: 20, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 14,
            cursor: 'pointer',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 15,
              background: _YELLOWBG,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
            }}>🙏</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: _TEXT, fontFamily: "'Nunito', sans-serif" }}>Take Today's Pledge</div>
              <div style={{ fontSize: 12, color: _TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>Renew your commitment daily</div>
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: _YELLOW, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#221C10" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Summary — 2×2 grid (reference style) */}
        <div style={{ padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: _TEXT, fontFamily: "'Nunito', sans-serif" }}>Summary</span>
            <span style={{ fontSize: 12, color: _PURPLE, fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>View All</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SummaryCard value={days}              label="Day Streak"    accent={_PEACH}  cardBg={_PEACH_CARD}  icon="🔥" />
            <SummaryCard value="3/6"               label="Habits Done"   accent={_PINK}   cardBg={_PINK_CARD}   icon="✓" />
            <SummaryCard value={Math.max(0,90-days)} label="Days to 90"  accent={_PURPLE} cardBg={_PURPLE_CARD} icon="🎯" />
            <SummaryCard value="357"               label="Karma Points"  accent={_SKY}    cardBg={_SKY_CARD}    icon="💎" />
          </div>
        </div>

        {/* Brain Rewiring */}
        <div style={{ padding: '0 20px 18px' }}>
          <div style={{ background: _SURF, borderRadius: 20, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: _TEXT, fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>🧠 Brain Rewiring</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: _PURPLE, fontFamily: "'Nunito', sans-serif" }}>{rewardPct}%</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: rewardPct + '%',
                background: `linear-gradient(90deg, ${_PURPLE}, ${_PINK})`,
                borderRadius: 99, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
              }} />
            </div>
            <div style={{ fontSize: 11, color: _TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 600, marginTop: 10 }}>
              Dopamine receptors restoring · Day {days} of 90
            </div>
          </div>
        </div>

        {/* Today's Habits */}
        <div style={{ padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: _TEXT, fontFamily: "'Nunito', sans-serif" }}>Today's Habits</span>
            <span style={{ fontSize: 12, color: _PURPLE, fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>3/6</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'No adult content', done: true,  accent: _MINT   },
              { label: 'Cold shower',       done: true,  accent: _SKY    },
              { label: 'Exercise',          done: true,  accent: _PEACH  },
              { label: 'Meditation',        done: false, accent: _PURPLE },
              { label: 'Journal',           done: false, accent: _YELLOW },
              { label: 'No social media',   done: false, accent: _PINK   },
            ].map((h, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 16,
                background: h.done ? _MINT_CARD : _SURF,
                animation: `fadeIn 0.3s ${i * 0.04}s both`,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 9, flexShrink: 0,
                  background: h.done ? _MINT : 'rgba(255,255,255,0.07)',
                  border: h.done ? 'none' : '1.5px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 200ms',
                }}>
                  {h.done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0A2018" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                </div>
                <span style={{
                  fontSize: 14, fontWeight: h.done ? 600 : 700,
                  color: h.done ? _TEXT2 : _TEXT,
                  fontFamily: "'Nunito', sans-serif",
                  textDecoration: h.done ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {h.label}
                </span>
                {!h.done && (
                  <div style={{ width: 20, height: 20, borderRadius: 7, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Panic Button */}
        <div style={{ padding: '0 20px 24px' }}>
          <button onClick={onPanic} style={{
            width: '100%', height: 62, borderRadius: 999,
            background: _PINK_CARD,
            border: `2px solid rgba(255,133,168,0.28)`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            animation: 'heartbeat 4s ease-in-out infinite',
          }}
            onPointerDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: _PINKBG,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={_PINK} strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 17, fontWeight: 900, color: _PINK }}>
              Panic Button
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PANIC SCREEN ───────────────────────────────────────────────────────────────
function PanicScreen({ onThinking, onRelapsed, onClose }) {
  const [quoteIdx, setQuoteIdx] = React.useState(0);
  const [seIdx, setSeIdx] = React.useState(0);

  const quotes = ['YOU GOT THIS.','STAY STRONG.','THIS WILL PASS.','YOU ARE BETTER THAN THIS.','ONE MOMENT AT A TIME.'];
  const sideEffects = [
    { icon: '📉', title: 'Reduced Performance', body: 'Brain fog, low energy, less drive' },
    { icon: '🌫️', title: 'Mental Fog',          body: 'Difficulty focusing and thinking clearly' },
    { icon: '😔', title: 'Shame Cycle',          body: 'Guilt that makes the next relapse easier' },
    { icon: '💔', title: 'Reduced Confidence',   body: 'Kills your self-image and drive' },
    { icon: '😰', title: 'Increased Anxiety',    body: 'Social withdrawal and performance anxiety' },
  ];

  React.useEffect(() => {
    const t1 = setInterval(() => setQuoteIdx(i => (i + 1) % quotes.length), 3000);
    const t2 = setInterval(() => setSeIdx(i => (i + 1) % sideEffects.length), 2600);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const se = sideEffects[seIdx];

  return (
    <div style={{ position: 'absolute', inset: 0, background: _BG, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{
          width: 38, height: 38, borderRadius: 13, background: _SURF2,
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={_TEXT2} strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div style={{
          background: _PINK_CARD, border: `1.5px solid rgba(255,133,168,0.3)`,
          borderRadius: 99, padding: '5px 16px',
          fontSize: 11, fontWeight: 900, color: _PINK,
          fontFamily: "'Nunito', sans-serif", letterSpacing: '0.08em',
        }}>
          PANIC MODE
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: '28px 24px 18px', textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Nunito', sans-serif",
          fontSize: 30, fontWeight: 900, color: _TEXT,
          lineHeight: 1.15, letterSpacing: '-0.02em', minHeight: 78,
          transition: 'opacity 0.3s',
        }}>
          {quotes[quoteIdx]}
        </div>
        <p style={{ fontSize: 14, color: _TEXT2, marginTop: 10, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>
          Take a breath. This feeling will pass in minutes.
        </p>
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ background: _PINK_CARD, border: `1.5px solid rgba(255,133,168,0.22)`, borderRadius: 22, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: _PINK, fontWeight: 900, letterSpacing: '0.1em', marginBottom: 12, fontFamily: "'Nunito', sans-serif" }}>
            RELAPSING WILL CAUSE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 17, flexShrink: 0,
              background: 'rgba(255,133,168,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>
              {se.icon}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: _TEXT, fontFamily: "'Nunito', sans-serif" }}>{se.title}</div>
              <div style={{ fontSize: 13, color: _TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>{se.body}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 14, justifyContent: 'center' }}>
            {sideEffects.map((_, i) => (
              <div key={i} style={{
                width: i === seIdx ? 20 : 5, height: 5, borderRadius: 99,
                background: i === seIdx ? _PINK : 'rgba(255,255,255,0.12)',
                transition: 'all 250ms',
              }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px', flex: 1 }}>
        <div style={{ background: _PURPLE_CARD, border: `1.5px solid rgba(184,152,255,0.22)`, borderRadius: 22, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: _PURPLE, fontWeight: 900, letterSpacing: '0.1em', marginBottom: 10, fontFamily: "'Nunito', sans-serif" }}>
            REMEMBER WHY YOU STARTED
          </div>
          <p style={{ fontSize: 14, color: _TEXT2, fontFamily: "'Nunito', sans-serif", lineHeight: 1.55, fontStyle: 'italic', fontWeight: 500 }}>
            "I want to be confident, clear-headed, and genuinely proud of myself."
          </p>
        </div>
      </div>

      <div style={{ padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={onThinking} style={{
          height: 58, borderRadius: 999,
          background: _PINK_CARD, border: `2px solid rgba(255,133,168,0.35)`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 900, color: _PINK,
          transition: 'transform 150ms',
        }}
          onPointerDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          ⚡ I'm thinking of relapsing — Help me
        </button>
        <button onClick={onRelapsed} style={{
          height: 48, borderRadius: 999, background: 'transparent',
          border: `1.5px solid rgba(255,255,255,0.08)`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700, color: _TEXT3,
        }}>
          I already relapsed
        </button>
      </div>
    </div>
  );
}

// ── CHALLENGE SCREEN ───────────────────────────────────────────────────────────
function ChallengeScreen({ onComplete, onBack }) {
  const [selected, setSelected] = React.useState(null);
  const [phase, setPhase] = React.useState('pick');
  const [timerSec, setTimerSec] = React.useState(0);
  const [maxSec, setMaxSec] = React.useState(60);
  const [rating, setRating] = React.useState(0);

  const challenges = [
    { id: 'pushups',  icon: '💪', name: '10 Push-ups',       cat: 'Physical',    dur: '1 min',  diff: 'Easy',   diffColor: _MINT,   secs: 60,  steps: ['Get into push-up position', 'Lower chest to floor with control', 'Push back up explosively', 'Complete 10 full reps'] },
    { id: 'breathe',  icon: '🌊', name: '4-7-8 Breathing',   cat: 'Mindfulness', dur: '3 min',  diff: 'Easy',   diffColor: _PURPLE, secs: 180, steps: ['Find a comfortable position', 'Inhale slowly for 4 seconds', 'Hold your breath for 7 seconds', 'Exhale completely for 8 seconds', 'Repeat 3 cycles'] },
    { id: 'cold',     icon: '🧊', name: 'Cold Water Face',    cat: 'Cold',        dur: '30 sec', diff: 'Medium', diffColor: _SKY,    secs: 30,  steps: ['Fill sink with cold water', 'Take a deep breath', 'Submerge face for 30 seconds', 'Feel the clarity return'] },
    { id: 'journal',  icon: '📓', name: 'Write 3 reasons',   cat: 'Cognitive',   dur: '2 min',  diff: 'Easy',   diffColor: _YELLOW, secs: 120, steps: ['Open your journal', 'Write 3 specific reasons you quit', 'Be detailed and personal', 'Read them back out loud'] },
    { id: 'gratitude',icon: '🙏', name: 'Gratitude list',    cat: 'Mindfulness', dur: '2 min',  diff: 'Easy',   diffColor: _MINT,   secs: 120, steps: ['Find a quiet moment', 'Write 3 things you\'re grateful for', 'Be specific, not generic', 'Feel the mood shift'] },
    { id: 'walk',     icon: '🚶', name: '5-min walk outside', cat: 'Physical',   dur: '5 min',  diff: 'Easy',   diffColor: _PEACH,  secs: 300, steps: ['Put on your shoes', 'Go outside — no phone', 'Walk at your own pace', 'Notice your surroundings', 'Return with a cleared mind'] },
  ];

  const shown = React.useMemo(() => [...challenges].sort(() => Math.random() - 0.5).slice(0, 3), []);

  React.useEffect(() => {
    if (phase !== 'doing') return;
    const t = setInterval(() => {
      setTimerSec(s => { if (s >= maxSec - 1) { clearInterval(t); return maxSec; } return s + 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, maxSec]);

  const startChallenge = (c) => { setSelected(c); setMaxSec(c.secs); setTimerSec(0); setPhase('doing'); };

  if (phase === 'done') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: _BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 28,
          background: _MINT_CARD, border: `1.5px solid rgba(90,223,158,0.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38, marginBottom: 24,
          animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>✅</div>
        <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 26, fontWeight: 900, color: _TEXT, marginBottom: 8 }}>
          Challenge Complete!
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <span style={{ fontSize: 18 }}>🔥</span>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 900, color: _PEACH }}>+50 Karma Points</span>
        </div>
        <p style={{ fontSize: 14, color: _TEXT2, fontFamily: "'Nunito', sans-serif", textAlign: 'center', marginBottom: 24, fontWeight: 600 }}>
          How do you feel right now?
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          {['😔','😐','🙂','😊','🔥'].map((e, i) => (
            <button key={i} onClick={() => setRating(i + 1)} style={{
              width: 48, height: 48, borderRadius: 16, fontSize: 22,
              border: rating === i + 1 ? `2px solid ${_MINT}` : `1.5px solid rgba(255,255,255,0.08)`,
              background: rating === i + 1 ? _MINT_CARD : _SURF,
              cursor: 'pointer',
              transform: rating === i + 1 ? 'scale(1.12)' : 'scale(1)',
              transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              {e}
            </button>
          ))}
        </div>
        <button className="btn btn-success" onClick={onComplete} style={{ width: '100%' }}>Return Home</button>
      </div>
    );
  }

  if (phase === 'doing' && selected) {
    const pct = (timerSec / maxSec) * 100;
    const r = 52, circ = 2 * Math.PI * r;
    const isDone = timerSec >= maxSec;
    return (
      <div style={{ position: 'absolute', inset: 0, background: _BG, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setPhase('pick')} style={{
            width: 38, height: 38, borderRadius: 13, background: _SURF2,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={_TEXT2} strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 900, color: _TEXT, fontFamily: "'Nunito', sans-serif" }}>{selected.name}</span>
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 900, padding: '4px 12px',
            borderRadius: 99, background: _MINT_CARD, color: _MINT, fontFamily: "'Nunito', sans-serif",
            border: `1px solid rgba(90,223,158,0.2)`,
          }}>{selected.diff}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 28 }}>
            <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9"/>
              <circle cx="70" cy="70" r={r} fill="none"
                stroke={isDone ? _MINT : _PURPLE} strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct / 100)}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 28, marginBottom: 2 }}>{selected.icon}</span>
              <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 18, fontWeight: 900, color: isDone ? _MINT : _TEXT }}>
                {Math.floor((maxSec - timerSec) / 60)}:{String((maxSec - timerSec) % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: _TEXT3, letterSpacing: '0.1em', marginBottom: 14, fontFamily: "'Nunito', sans-serif", textAlign: 'center' }}>INSTRUCTIONS</div>
            {selected.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12, animation: `fadeIn 0.3s ${i * 0.08}s both` }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 9, flexShrink: 0,
                  background: timerSec > (i / selected.steps.length) * maxSec ? _PURPLE_CARD : _SURF,
                  border: timerSec > (i / selected.steps.length) * maxSec ? `1.5px solid rgba(184,152,255,0.3)` : `1.5px solid rgba(255,255,255,0.07)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.5s',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: _TEXT, fontFamily: "'Nunito', sans-serif" }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: 14, color: _TEXT2, fontFamily: "'Nunito', sans-serif", lineHeight: 1.45, fontWeight: 600 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 24px 32px' }}>
          <button onClick={() => setPhase('done')} className="btn btn-success"
            style={{ opacity: timerSec >= maxSec * 0.5 ? 1 : 0.4, pointerEvents: timerSec >= maxSec * 0.5 ? 'all' : 'none' }}>
            {isDone ? "I'm Done! 🎉" : `Keep going… ${Math.round(pct)}%`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: _BG, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center' }}>
        <button onClick={onBack} style={{
          width: 38, height: 38, borderRadius: 13, background: _SURF2,
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={_TEXT2} strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div style={{ padding: '20px 24px 10px', textAlign: 'center' }}>
        <div style={{
          width: 62, height: 62, borderRadius: 21, margin: '0 auto 14px',
          background: _MINT_CARD, border: `1.5px solid rgba(90,223,158,0.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>⚡</div>
        <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900, color: _TEXT, marginBottom: 8 }}>Hold on. You've got this.</h2>
        <p style={{ fontSize: 14, color: _TEXT2, fontFamily: "'Nunito', sans-serif", lineHeight: 1.5, fontWeight: 600 }}>
          Pick one challenge. Your craving will pass<br />in just a few minutes.
        </p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((c, i) => (
            <button key={c.id} onClick={() => startChallenge(c)} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px', borderRadius: 22,
              background: _SURF, border: `1.5px solid rgba(255,255,255,0.07)`,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'all 150ms',
              animation: `fadeIn 0.4s ${i * 0.1}s both`,
            }}
              onPointerDown={e => { e.currentTarget.style.transform='scale(0.97)'; e.currentTarget.style.background=_SURF2; }}
              onPointerUp={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.background=_SURF; }}
            >
              <div style={{
                width: 54, height: 54, borderRadius: 18, flexShrink: 0,
                background: _SURF2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: _TEXT, fontFamily: "'Nunito', sans-serif", marginBottom: 5 }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: _TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{c.cat}</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: _TEXT3, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: _TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{c.dur}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 900, padding: '2px 9px', borderRadius: 99,
                    background: `${c.diffColor}22`, color: c.diffColor, fontFamily: "'Nunito', sans-serif",
                  }}>{c.diff}</span>
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={_MINT} strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  Stars: function Stars() { return null; },
  FreedLogo: window.FreedLogo,
  StreakOrb, HomeScreen, PanicScreen, ChallengeScreen,
});
