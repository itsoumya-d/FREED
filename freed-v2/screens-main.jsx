// ── FREED — Main Screens · Reference Design Language (Dark Mode) ─────────────

// ── Design tokens ──────────────────────────────────────────────────────────────
const M_BG       = '#1B1929';
const M_SURF     = '#242236';
const M_SURF2    = '#2D2A44';
const M_TEXT     = '#F0ECF8';
const M_TEXT2    = '#9894B5';
const M_TEXT3    = '#5C5880';
const M_PURPLE   = '#B898FF';
const M_PEACH    = '#FF9B72';
const M_PINK     = '#FF85A8';
const M_MINT     = '#5ADF9E';
const M_SKY      = '#82CEFF';
const M_YELLOW   = '#FFD666';

// Card gradient fills
const M_PEACH_CARD  = 'linear-gradient(145deg, #3E2214 0%, #2C1A10 100%)';
const M_PINK_CARD   = 'linear-gradient(145deg, #3E1624 0%, #2C1018 100%)';
const M_PURPLE_CARD = 'linear-gradient(145deg, #271540 0%, #1E1130 100%)';
const M_SKY_CARD    = 'linear-gradient(145deg, #152840 0%, #111E2C 100%)';
const M_MINT_CARD   = 'linear-gradient(145deg, #143028 0%, #10221C 100%)';
const M_YELLOW_CARD = 'linear-gradient(145deg, #302614 0%, #221C10 100%)';

// Tinted bg chips
const M_PURPLEBG = 'rgba(184,152,255,0.18)';
const M_PEACHBG  = 'rgba(255,155,114,0.18)';
const M_PINKBG   = 'rgba(255,133,168,0.18)';
const M_MINTBG   = 'rgba(90,223,158,0.18)';
const M_SKYBG    = 'rgba(130,206,255,0.18)';
const M_YELLOWBG = 'rgba(255,214,102,0.18)';

// ── Shared helpers ─────────────────────────────────────────────────────────────
function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <span style={{ fontSize: 16, fontWeight: 900, color: M_TEXT, fontFamily: "'Nunito', sans-serif" }}>{title}</span>
      {action && (
        <button onClick={onAction} style={{ background: 'none', border: 'none', cursor: 'pointer', color: M_PURPLE, fontSize: 13, fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>
          {action}
        </button>
      )}
    </div>
  );
}

function PageHeader({ title, right }) {
  return (
    <div style={{ padding: '14px 20px 12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h1 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 24, fontWeight: 900, color: M_TEXT, letterSpacing: '-0.02em' }}>{title}</h1>
      {right}
    </div>
  );
}

// Summary stat card — matching reference 2×2 grid format
function MStatCard({ value, label, sub, accent, cardBg, icon }) {
  return (
    <div style={{
      flex: 1, borderRadius: 22, padding: '16px 14px',
      background: cardBg,
      display: 'flex', flexDirection: 'column', minHeight: 114,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 34, fontWeight: 900, color: M_TEXT, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value}
        </div>
        <div style={{ width: 30, height: 30, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
          {icon}
        </div>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <div style={{ fontSize: 13, color: accent, fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: M_TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 600, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Donut chart — reference multicolor style ───────────────────────────────────
function DonutChart({ segments, total, label = 'Total' }) {
  const cx = 90, cy = 90, r = 65, sw = 14;
  const C = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <div style={{ position: 'relative', width: 180, height: 180 }}>
      <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw}/>
        {segments.map((seg, i) => {
          const dashLen = C * seg.pct;
          const dashOffset = C * (1 - cumulative);
          cumulative += seg.pct;
          return (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={seg.color} strokeWidth={sw}
              strokeLinecap="butt"
              strokeDasharray={`${dashLen} ${C - dashLen}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 36, fontWeight: 900, color: M_TEXT, lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: 12, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{label}</div>
      </div>
    </div>
  );
}

// ── ANALYTICS SCREEN ───────────────────────────────────────────────────────────
function AnalyticsScreen({ streak }) {
  const [view, setView] = React.useState('ring');
  const days = streak || 5;
  const pct = Math.min(100, Math.round((days / 90) * 100));
  const level = Math.floor(pct / 10);

  // Big recovery ring
  const r = 88, circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  const levelNames = ['Just Starting','First Steps','Biology Shifting','Building Momentum','Confidence Rising','Halfway There','Dopamine Healing','Drive Returning','Emotional Growth','Almost Free','Fully Reset'];

  const benefits = [
    { label: 'Improved Confidence', pct: Math.min(100, pct * 1.1), color: M_PURPLE },
    { label: 'Mental Clarity',      pct: Math.min(100, pct * 0.95), color: M_MINT },
    { label: 'Increased Energy',    pct: Math.min(100, pct * 1.05), color: M_PEACH },
    { label: 'Better Sleep',        pct: Math.min(100, pct * 0.9),  color: M_SKY },
    { label: 'Reduced Anxiety',     pct: Math.min(100, pct * 0.85), color: M_YELLOW },
    { label: 'Self-Esteem',         pct: Math.min(100, pct * 1.0),  color: M_PINK },
  ];

  // Donut segments
  const donutSegs = [
    { pct: 0.44, color: M_SKY,    label: 'Complete' },
    { pct: 0.30, color: M_PINK,   label: 'Pending' },
    { pct: 0.16, color: M_PURPLE, label: 'Healing' },
    { pct: 0.10, color: M_PEACH,  label: 'Ongoing' },
  ];

  // Radar
  const radarAxes = ['Discipline','Confidence','Clarity','Energy','Social','Emotional'];
  const radarValues = [0.7, 0.55, 0.65, 0.6, 0.45, 0.5];
  const radarPath = React.useMemo(() => {
    const cx = 110, cy = 110, rr = 80;
    return radarAxes.map((_, i) => {
      const a = (i / radarAxes.length) * 2 * Math.PI - Math.PI / 2;
      return [cx + rr * radarValues[i] * Math.cos(a), cy + rr * radarValues[i] * Math.sin(a)];
    });
  }, []);
  const radarBg = React.useMemo(() => {
    const cx = 110, cy = 110, rr = 80;
    return radarAxes.map((_, i) => {
      const a = (i / radarAxes.length) * 2 * Math.PI - Math.PI / 2;
      return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    });
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, background: M_BG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="Analytics" right={
        <div style={{ display: 'flex', background: M_SURF2, borderRadius: 14, padding: 3, gap: 2 }}>
          {['ring','donut','radar'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 10px', borderRadius: 11, border: 'none', cursor: 'pointer',
              fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 800,
              background: view === v ? M_PURPLE_CARD : 'transparent',
              color: view === v ? M_PURPLE : M_TEXT3,
              transition: 'all 200ms',
              outline: view === v ? `1.5px solid rgba(184,152,255,0.3)` : '1.5px solid transparent',
            }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      }/>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 104px' }}>

        {/* DONUT VIEW */}
        {view === 'donut' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 0 8px', gap: 24 }}>
              <DonutChart segments={donutSegs} total={36} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {donutSegs.map((seg, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{seg.label}</span>
                    <span style={{ fontSize: 11, color: seg.color, fontFamily: "'Nunito', sans-serif", fontWeight: 900, marginLeft: 'auto' }}>{Math.round(seg.pct * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stat row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <MStatCard value={days+'d'} label="Current Streak" accent={M_PURPLE} cardBg={M_PURPLE_CARD} icon="🔥" />
              <MStatCard value="23d"      label="Best Ever"      accent={M_PEACH}  cardBg={M_PEACH_CARD}  icon="🏆" />
            </div>

            {/* CLARA Insights card */}
            <div style={{
              background: M_PINK_CARD, border: `1.5px solid rgba(255,133,168,0.2)`,
              borderRadius: 22, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 10, color: M_PINK, fontWeight: 900, letterSpacing: '0.08em', fontFamily: "'Nunito', sans-serif", flex: 1 }}>
                <div style={{ marginBottom: 5 }}>REPORT FOR YOUR RECOVERY COACH</div>
                <div style={{ fontSize: 14, color: M_TEXT, fontWeight: 900, marginBottom: 3 }}>Share with CLARA AI</div>
                <div style={{ fontSize: 13, color: M_TEXT2, fontWeight: 600 }}>
                  Review your mood, habits &amp; streak data
                </div>
              </div>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: M_PINK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B1929" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </div>
          </>
        )}

        {/* RING VIEW */}
        {view === 'ring' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ position: 'relative', width: 220, height: 220 }}>
                <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="110" cy="110" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13"/>
                  <circle cx="110" cy="110" r={r} fill="none"
                    stroke="url(#aRingGrad)" strokeWidth="13"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                  />
                  <defs>
                    <linearGradient id="aRingGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={M_SKY}/>
                      <stop offset="50%" stopColor={M_PURPLE}/>
                      <stop offset="100%" stopColor={M_PINK}/>
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, color: M_TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 800, letterSpacing: '0.1em' }}>RECOVERY</div>
                  <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 44, fontWeight: 900, color: M_TEXT, lineHeight: 1, letterSpacing: '-0.03em' }}>{pct}%</div>
                  <div style={{ fontSize: 11, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{days} DAY STREAK</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <MStatCard value={days+'d'} label="Current Streak" accent={M_PURPLE} cardBg={M_PURPLE_CARD} icon="🔥"/>
              <MStatCard value="23d"      label="Best Ever"      accent={M_PEACH}  cardBg={M_PEACH_CARD}  icon="🏆"/>
              <MStatCard value="3/6"      label="Habits Today"   accent={M_MINT}   cardBg={M_MINT_CARD}   icon="✓"/>
            </div>
            <div style={{ background: M_PURPLE_CARD, border: `1.5px solid rgba(184,152,255,0.18)`, borderRadius: 20, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600, marginBottom: 4 }}>You're on track to fully reset by:</div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 20, fontWeight: 900, color: M_TEXT }}>
                {new Date(Date.now() + (90 - days) * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div style={{ background: M_SURF, borderRadius: 20, padding: '16px', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 16, background: M_PURPLE_CARD, border: `1.5px solid rgba(184,152,255,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {['🌱','🌿','🌳','💪','⚡','🎯','🧠','🔥','💎','👑','🏆'][level]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: M_TEXT, fontFamily: "'Nunito', sans-serif" }}>Level {level} — {levelNames[level]}</div>
                  <div style={{ fontSize: 12, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>{pct}% toward full recovery</div>
                </div>
              </div>
              <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: ((pct % 10) * 10) + '%', background: `linear-gradient(90deg, ${M_PURPLE}, ${M_PINK})`, borderRadius: 99 }} />
              </div>
            </div>
            <SectionHeader title="Recovery Benefits"/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
              {benefits.map((b, i) => (
                <div key={i} style={{ animation: `fadeIn 0.3s ${i * 0.06}s both` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 13, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{b.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: b.color, fontFamily: "'Nunito', sans-serif" }}>{Math.round(b.pct)}%</span>
                  </div>
                  <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: b.pct + '%', background: b.color, borderRadius: 99, transition: `width 1s ${0.2 + i*0.07}s cubic-bezier(0.4,0,0.2,1)` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* RADAR VIEW */}
        {view === 'radar' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 14px' }}>
              <svg width="220" height="220">
                {[0.25,0.5,0.75,1.0].map((s, ri) => {
                  const pts = radarBg.map(([x,y]) => [110+(x-110)*s, 110+(y-110)*s]);
                  return <polygon key={ri} points={pts.map(p=>p.join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>;
                })}
                {radarBg.map(([x,y],i) => <line key={i} x1="110" y1="110" x2={x} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>)}
                <polygon points={radarPath.map(p=>p.join(',')).join(' ')} fill={M_PURPLEBG} stroke={M_PURPLE} strokeWidth="2"/>
                {radarPath.map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4" fill={M_PURPLE} stroke={M_BG} strokeWidth="1.5"/>)}
                {radarBg.map(([x,y],i) => {
                  const lx = 110+(x-110)*1.28, ly = 110+(y-110)*1.28;
                  return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill={M_TEXT3} fontSize="10" fontFamily="Nunito,sans-serif" fontWeight="700">{radarAxes[i]}</text>;
                })}
              </svg>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <MStatCard value={days+'d'} label="Current Streak" accent={M_PURPLE} cardBg={M_PURPLE_CARD} icon="🔥"/>
              <MStatCard value="23d"      label="Best Ever"      accent={M_PEACH}  cardBg={M_PEACH_CARD}  icon="🏆"/>
            </div>
            <SectionHeader title="Habit Scores"/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {radarAxes.map((ax, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, animation: `fadeIn 0.3s ${i*0.05}s both` }}>
                  <span style={{ fontSize: 13, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 700, width: 80, flexShrink: 0 }}>{ax}</span>
                  <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: (radarValues[i]*100)+'%', background: `linear-gradient(90deg, ${M_PURPLE}, ${M_PINK})`, borderRadius: 99, transition: `width 1s ${i*0.1}s cubic-bezier(0.4,0,0.2,1)` }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 900, color: M_PURPLE, fontFamily: "'Nunito', sans-serif", width: 36, textAlign: 'right' }}>{Math.round(radarValues[i]*100)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── LIBRARY SCREEN ─────────────────────────────────────────────────────────────
function LibraryScreen({ onCLARA, onBreathe }) {
  const quickItems = [
    { icon: '🌊', label: 'Breathe',  color: M_PURPLE, cardBg: M_PURPLE_CARD, action: onBreathe },
    { icon: '🤖', label: 'CLARA',    color: M_MINT,   cardBg: M_MINT_CARD,   action: onCLARA },
    { icon: '🧘', label: 'Meditate', color: M_PEACH,  cardBg: M_PEACH_CARD,  action: null },
    { icon: '📚', label: 'Research', color: M_SKY,    cardBg: M_SKY_CARD,    action: null },
  ];

  const articles = [
    { title: 'How Your Brain Rewires Itself',       tag: 'Neuroscience',  time: '5 min', color: M_PURPLE },
    { title: 'The Dopamine Reset: What to Expect',  tag: 'Science',       time: '8 min', color: M_MINT },
    { title: 'Building Identity, Not Willpower',    tag: 'Psychology',    time: '6 min', color: M_PEACH },
    { title: 'Relationships After Recovery',        tag: 'Relationships', time: '7 min', color: M_PINK },
  ];

  const sounds = [
    { icon: '🌊', label: 'Ocean',       color: M_SKY },
    { icon: '🌧️', label: 'Rain',        color: M_PURPLE },
    { icon: '🌫️', label: 'White Noise', color: M_TEXT2 },
    { icon: '🌲', label: 'Forest',      color: M_MINT },
    { icon: '🔥', label: 'Fire',        color: M_PEACH },
  ];
  const [playing, setPlaying] = React.useState(null);

  return (
    <div style={{ position: 'absolute', inset: 0, background: M_BG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="Library"/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 104px' }}>

        {/* Quick access */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          {quickItems.map((q, i) => (
            <button key={i} onClick={q.action} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              padding: '18px 8px', borderRadius: 22,
              background: q.cardBg,
              border: `1.5px solid rgba(255,255,255,0.07)`,
              cursor: 'pointer',
              transition: 'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
              animation: `fadeIn 0.3s ${i*0.07}s both`,
            }}
              onPointerDown={e => e.currentTarget.style.transform='scale(0.93)'}
              onPointerUp={e => e.currentTarget.style.transform='scale(1)'}
            >
              <span style={{ fontSize: 26 }}>{q.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: q.color, fontFamily: "'Nunito', sans-serif" }}>{q.label}</span>
            </button>
          ))}
        </div>

        {/* Sounds */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeader title="Relaxation Sounds"/>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {sounds.map((s, i) => (
              <button key={i} onClick={() => setPlaying(playing === i ? null : i)} style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px', borderRadius: 20, minWidth: 74,
                background: playing === i ? `${s.color}22` : M_SURF,
                border: playing === i ? `2px solid ${s.color}44` : `1.5px solid rgba(255,255,255,0.07)`,
                cursor: 'pointer', transition: 'all 200ms',
                transform: playing === i ? 'scale(1.04)' : 'scale(1)',
              }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: playing === i ? s.color : M_TEXT2, fontFamily: "'Nunito', sans-serif" }}>{s.label}</span>
                {playing === i && (
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
                    {[1,2,3,4].map(b => (
                      <div key={b} style={{ width: 3, borderRadius: 2, background: s.color, height: (4+b*2)+'px', animation: `soundBar${b} ${0.4+b*0.1}s ease-in-out infinite alternate` }}/>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Articles */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeader title="Articles" action="See all"/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {articles.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 20,
                background: M_SURF, cursor: 'pointer',
                animation: `fadeIn 0.3s ${i*0.07}s both`,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0, background: `${a.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: M_TEXT, fontFamily: "'Nunito', sans-serif", marginBottom: 6 }}>{a.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 9px', borderRadius: 99, background: `${a.color}22`, color: a.color, fontFamily: "'Nunito', sans-serif" }}>{a.tag}</span>
                    <span style={{ fontSize: 11, color: M_TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>{a.time} read</span>
                  </div>
                </div>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_TEXT3} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            ))}
          </div>
        </div>

        {/* Top Streaks */}
        <SectionHeader title="🏆 Top Streaks" action="Full list"/>
        {[
          { name: 'James W.',  days: 312, badge: '🥇', cardBg: M_YELLOW_CARD, color: M_YELLOW },
          { name: 'Marcus T.', days: 287, badge: '🥈', cardBg: M_SURF,        color: M_TEXT2 },
          { name: 'Anonymous', days: 241, badge: '🥉', cardBg: M_SURF,        color: M_PEACH },
        ].map((u, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            borderRadius: 18, marginBottom: 8,
            background: u.cardBg,
            animation: `fadeIn 0.3s ${i*0.07}s both`,
          }}>
            <span style={{ fontSize: 18 }}>{u.badge}</span>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: [M_PURPLE, M_MINT, M_PEACH][i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: "'Nunito', sans-serif" }}>{u.name.charAt(0)}</div>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: M_TEXT, fontFamily: "'Nunito', sans-serif" }}>{u.name}</span>
            <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: 18, fontWeight: 900, color: u.color }}>{u.days}d</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── COMMUNITY SCREEN ───────────────────────────────────────────────────────────
function CommunityScreen() {
  const [tab, setTab] = React.useState('forum');
  const [filter, setFilter] = React.useState('Hot');
  const posts = [
    { id: 1, user: 'Marcus_T',  anon: false, avatar: M_PURPLE, time: '2h', tag: 'Win',      tagColor: M_MINT,  title: 'Day 30 — I feel like a completely different person', body: 'Just hit 30 days. The brain fog is gone, my confidence is back...', votes: 247, comments: 34, voted: true },
    { id: 2, user: 'Anonymous', anon: true,  avatar: M_TEXT2,  time: '4h', tag: 'Struggle', tagColor: M_PEACH, title: 'Day 3 and the cravings are intense', body: 'Not going to lie, today was really hard. I almost relapsed twice...', votes: 89, comments: 21, voted: false },
    { id: 3, user: 'Jake_F',    anon: false, avatar: M_PEACH,  time: '6h', tag: 'Question', tagColor: M_YELLOW,title: 'Does exercise really help with urges?', body: 'I keep reading that exercise helps. Anyone have experience?', votes: 63, comments: 18, voted: false },
    { id: 4, user: 'WillS_22',  anon: false, avatar: M_MINT,   time: '1d', tag: 'Win',      tagColor: M_MINT,  title: '90 days — Full dopamine reset complete', body: 'Words cannot describe how different I feel. Stay strong brothers...', votes: 412, comments: 67, voted: false },
  ];
  const [localPosts, setLocalPosts] = React.useState(posts);

  return (
    <div style={{ position: 'absolute', inset: 0, background: M_BG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 24, fontWeight: 900, color: M_TEXT }}>Community</h1>
          <button style={{ width: 36, height: 36, borderRadius: 12, background: M_SURF2, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_TEXT2} strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 2, background: M_SURF2, borderRadius: 16, padding: 3, marginBottom: 14 }}>
          {['forum','teams','friends'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, height: 34, borderRadius: 13, border: 'none', cursor: 'pointer',
              fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
              background: tab === t ? M_PURPLE_CARD : 'transparent',
              color: tab === t ? M_PURPLE : M_TEXT3,
              transition: 'all 200ms',
              outline: tab === t ? `1.5px solid rgba(184,152,255,0.25)` : '1.5px solid transparent',
            }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {tab === 'forum' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: M_SURF, borderRadius: 16, padding: '10px 14px', marginBottom: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEXT3} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input placeholder="Search posts..." style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: M_TEXT, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600 }}/>
            </div>
            <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
              {['Hot','New','Top'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '5px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 800,
                  background: filter === f ? M_PURPLE_CARD : M_SURF,
                  color: filter === f ? M_PURPLE : M_TEXT3,
                  outline: filter === f ? `1.5px solid rgba(184,152,255,0.3)` : '1.5px solid transparent',
                  transition: 'all 150ms',
                }}>{f}</button>
              ))}
            </div>
          </>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 104px' }}>
        {tab === 'forum' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {localPosts.map((p, i) => (
              <div key={p.id} style={{ background: M_SURF, borderRadius: 22, padding: '16px', animation: `fadeIn 0.3s ${i*0.07}s both`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', fontFamily: "'Nunito', sans-serif" }}>
                    {p.anon ? '?' : p.user.charAt(0)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: M_TEXT2, fontFamily: "'Nunito', sans-serif" }}>{p.user}</span>
                  <span style={{ fontSize: 11, color: M_TEXT3, fontFamily: "'Nunito', sans-serif", marginLeft: 'auto' }}>{p.time}</span>
                  <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 99, background: `${p.tagColor}22`, color: p.tagColor, fontFamily: "'Nunito', sans-serif" }}>{p.tag}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: M_TEXT, fontFamily: "'Nunito', sans-serif", marginBottom: 5, lineHeight: 1.35 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", marginBottom: 12, lineHeight: 1.5, fontWeight: 500 }}>{p.body}</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); setLocalPosts(prev => prev.map(post => post.id === p.id ? { ...post, votes: post.voted ? post.votes-1 : post.votes+1, voted: !post.voted } : post)); }} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: p.voted ? M_PURPLE : M_TEXT3, fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 800, padding: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={p.voted ? M_PURPLE : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg>
                    {p.votes}
                  </button>
                  <button style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: M_TEXT3, fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 800, padding: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    {p.comments}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'teams' && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ background: M_PURPLE_CARD, border: `1.5px solid rgba(184,152,255,0.2)`, borderRadius: 22, padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>👥</div>
              <h3 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 18, fontWeight: 900, color: M_TEXT, marginBottom: 8 }}>Join an Accountability Team</h3>
              <p style={{ fontSize: 14, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", marginBottom: 20, lineHeight: 1.55, fontWeight: 500 }}>Small groups (3–10) with daily check-ins and a shared streak counter.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>Join a Team</button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Create Team</button>
              </div>
            </div>
          </div>
        )}
        {tab === 'friends' && (
          <div style={{ padding: '8px 0' }}>
            {[{ name: 'Jamie K.', days: 14, color: M_PURPLE }, { name: 'Alex P.', days: 7, color: M_MINT }, { name: 'Ryan M.', days: 31, color: M_PEACH }].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 20, marginBottom: 10, background: M_SURF, animation: `fadeIn 0.3s ${i*0.08}s both` }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: "'Nunito', sans-serif" }}>{f.name.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: M_TEXT, fontFamily: "'Nunito', sans-serif", marginBottom: 2 }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>🔥 {f.days} day streak</div>
                </div>
                <button style={{ padding: '7px 16px', borderRadius: 99, background: M_PURPLE_CARD, border: `1.5px solid rgba(184,152,255,0.3)`, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: M_PURPLE, fontFamily: "'Nunito', sans-serif" }}>Support</button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}>+ Add Friend</button>
          </div>
        )}
      </div>
      {tab === 'forum' && (
        <div style={{ position: 'absolute', bottom: 104, right: 20, zIndex: 50 }}>
          <button style={{ width: 54, height: 54, borderRadius: '50%', background: M_PURPLE, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 24px rgba(184,152,255,0.5)` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B1929" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── PROFILE SCREEN ─────────────────────────────────────────────────────────────
function ProfileScreen({ streak, onCard }) {
  const days = streak || 5;
  const achievements = [
    { name: 'Seed',       icon: '🌱', days: 1,  unlocked: true },
    { name: 'Sprout',     icon: '🌿', days: 3,  unlocked: true },
    { name: 'Pioneer',    icon: '⚡', days: 5,  unlocked: days >= 5 },
    { name: 'Momentum',   icon: '🔥', days: 7,  unlocked: days >= 7 },
    { name: 'Foundation', icon: '🏛️', days: 14, unlocked: days >= 14 },
    { name: 'Resilient',  icon: '💪', days: 21, unlocked: days >= 21 },
    { name: 'Committed',  icon: '🎯', days: 30, unlocked: days >= 30 },
    { name: 'Sovereign',  icon: '👑', days: 90, unlocked: days >= 90 },
  ];
  const achColors = [M_MINT, M_PURPLE, M_PEACH, M_PINK, M_SKY, M_YELLOW, M_PURPLE, M_YELLOW];

  return (
    <div style={{ position: 'absolute', inset: 0, background: M_BG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="Profile" right={
        <button style={{ width: 36, height: 36, borderRadius: 12, background: M_SURF2, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚙</button>
      }/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 104px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24, animation: 'fadeIn 0.4s both' }}>
          <div style={{
            width: 78, height: 78, borderRadius: '50%',
            background: `linear-gradient(135deg, ${M_PURPLE}, ${M_PINK})`,
            margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 900, color: '#fff', fontFamily: "'Nunito', sans-serif",
            boxShadow: `0 0 28px rgba(184,152,255,0.35)`,
          }}>A</div>
          <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900, color: M_TEXT, marginBottom: 12 }}>Alex</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: M_PEACH_CARD, borderRadius: 99, padding: '5px 14px', border: `1.5px solid rgba(255,155,114,0.2)` }}>
              <span style={{ fontSize: 13 }}>🔥</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: M_PEACH, fontFamily: "'Nunito', sans-serif" }}>{days} DAY STREAK</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: M_MINT_CARD, borderRadius: 99, padding: '5px 14px', border: `1.5px solid rgba(90,223,158,0.2)` }}>
              <span style={{ fontSize: 13 }}>💎</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: M_MINT, fontFamily: "'Nunito', sans-serif" }}>357 KARMA</span>
            </div>
          </div>
        </div>

        {/* Achievements */}
        <div style={{ marginBottom: 20 }}>
          <SectionHeader title="Achievements" action="See all"/>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {achievements.map((a, i) => (
              <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, animation: `fadeIn 0.3s ${i*0.06}s both` }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: a.unlocked ? `${achColors[i]}22` : M_SURF,
                  border: a.unlocked ? `2px solid ${achColors[i]}44` : `1.5px solid rgba(255,255,255,0.06)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: a.unlocked ? 22 : 16,
                  filter: a.unlocked ? 'none' : 'grayscale(1) opacity(0.22)',
                  boxShadow: a.unlocked ? `0 0 14px ${achColors[i]}33` : 'none',
                }}>
                  {a.unlocked ? a.icon : '🔒'}
                </div>
                <span style={{ fontSize: 9, color: a.unlocked ? M_TEXT2 : M_TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress card CTA */}
        <button onClick={onCard} style={{
          width: '100%', padding: '16px 18px', borderRadius: 22, marginBottom: 16,
          background: M_PURPLE_CARD, border: `1.5px solid rgba(184,152,255,0.2)`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          animation: 'fadeIn 0.4s 0.15s both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(184,152,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🃏</div>
            <span style={{ fontSize: 15, fontWeight: 900, color: M_TEXT, fontFamily: "'Nunito', sans-serif" }}>View Progress Card</span>
          </div>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={M_PURPLE} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>

        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <MStatCard value={days} label="Best Record" sub="days clean" accent={M_YELLOW} cardBg={M_YELLOW_CARD} icon="🏆"/>
          <MStatCard value={Math.max(0, 90-days)} label="Days to 90" sub="days remaining" accent={M_MINT} cardBg={M_MINT_CARD} icon="🎯"/>
        </div>

        <div style={{ background: M_SURF, borderRadius: 22, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: M_TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700, marginBottom: 4 }}>Invite Your Friends</div>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 17, fontWeight: 900, color: M_TEXT, marginBottom: 12 }}>Earn $5 per referral</div>
          <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '0 24px' }}>Share FREED</button>
        </div>

        <div style={{ background: M_SURF, borderRadius: 22, overflow: 'hidden' }}>
          {[
            { icon: '🛡️', label: 'Internet Filter',     sub: 'Block adult content',      color: M_PURPLE },
            { icon: '🌊', label: 'Craving Control',      sub: 'Breath-work for urges',    color: M_SKY },
            { icon: '💚', label: 'Reasons for Changing', sub: 'Your personal motivators', color: M_MINT },
            { icon: '📓', label: 'Recovery Journal',     sub: 'Private encrypted notes',  color: M_YELLOW },
            { icon: '🧹', label: 'Detox',                sub: 'Reset after a relapse',    color: M_PEACH },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              cursor: 'pointer',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 13, flexShrink: 0, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: M_TEXT, fontFamily: "'Nunito', sans-serif" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 500 }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEXT3} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PROGRESS CARD SCREEN ───────────────────────────────────────────────────────
function ProgressCardScreen({ streak, onBack }) {
  const days = streak || 5;
  const pct = Math.min(100, Math.round((days / 90) * 100));
  const startDate = new Date(Date.now() - days * 86400000);
  const cardOptions = [
    [M_PEACH, M_PINK,   M_PEACH_CARD],
    [M_PURPLE, M_SKY,   M_PURPLE_CARD],
    [M_MINT, M_YELLOW,  M_MINT_CARD],
  ];
  const [cardIdx, setCardIdx] = React.useState(days < 8 ? 0 : days < 31 ? 1 : 2);
  const [c1, c2, cardBg] = cardOptions[cardIdx];

  return (
    <div style={{ position: 'absolute', inset: 0, background: M_BG, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ padding: '14px 20px 0', width: '100%' }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 13, background: M_SURF2, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M_TEXT2} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', width: '100%' }}>
        <div style={{
          width: '100%', maxWidth: 320, borderRadius: 28,
          background: cardBg,
          border: `2px solid ${c1}33`,
          padding: '28px 24px', marginBottom: 24,
          animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: M_TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 800, letterSpacing: '0.1em', marginBottom: 4 }}>FREED · PROGRESS CARD</div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 900, color: M_TEXT }}>Alex</div>
            </div>
            <div style={{ background: `${c1}22`, borderRadius: 12, padding: '6px 12px', border: `1.5px solid ${c1}44` }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: c1, fontFamily: "'Nunito', sans-serif" }}>LV {Math.floor(pct / 10)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 72, fontWeight: 900, color: M_TEXT, lineHeight: 1, letterSpacing: '-0.04em' }}>{days}</div>
            <div style={{ fontSize: 18, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>Days Free</div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: pct + '%', background: `linear-gradient(90deg, ${c1}, ${c2})`, borderRadius: 99 }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: M_TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>Since {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span style={{ fontSize: 11, color: c1, fontFamily: "'Nunito', sans-serif", fontWeight: 900 }}>{pct}% Reset</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {cardOptions.map((c, i) => (
            <button key={i} onClick={() => setCardIdx(i)} style={{
              width: 38, height: 38, borderRadius: '50%',
              background: `linear-gradient(135deg, ${c[0]}, ${c[1]})`,
              border: cardIdx === i ? `3px solid ${M_TEXT}` : '3px solid transparent',
              cursor: 'pointer', transition: 'border 150ms',
            }}/>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width: 190 }}>
          Share Card
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── BREATHING SCREEN ───────────────────────────────────────────────────────────
function BreathingScreen({ onBack }) {
  const PHASES = [
    { label: 'Inhale',  duration: 4000, color: M_SKY,    scale: 1.35 },
    { label: 'Hold',    duration: 7000, color: M_PURPLE, scale: 1.35 },
    { label: 'Exhale',  duration: 8000, color: M_MINT,   scale: 0.75 },
  ];
  const [phaseIdx, setPhaseIdx] = React.useState(0);
  const [seconds, setSeconds] = React.useState(4);
  const [running, setRunning] = React.useState(false);
  const [cycles, setCycles] = React.useState(0);
  const phase = PHASES[phaseIdx];

  React.useEffect(() => {
    if (!running) return;
    const dur = PHASES[phaseIdx].duration;
    setSeconds(dur / 1000);
    const countdown = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(countdown);
          const next = (phaseIdx + 1) % PHASES.length;
          if (next === 0) setCycles(c => c + 1);
          setPhaseIdx(next);
          return PHASES[next].duration / 1000;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, [phaseIdx, running]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: M_BG, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ padding: '14px 20px 0', width: '100%' }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 13, background: M_SURF2, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M_TEXT2} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 900, color: M_TEXT, marginBottom: 6 }}>4-7-8 Breathing</h2>
        <p style={{ fontSize: 13, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 600, marginBottom: 40, textAlign: 'center' }}>Reduces anxiety and stops urges in minutes</p>
        <div style={{
          width: 180, height: 180, borderRadius: '50%', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32,
          transition: `transform ${phase.duration}ms ease-in-out`,
          transform: running ? `scale(${phase.scale})` : 'scale(1)',
        }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `${phase.color}15`, animation: running ? 'pulse-ring 2s ease-out infinite' : 'none' }}/>
          <div style={{ width: 160, height: 160, borderRadius: '50%', background: `${phase.color}22`, border: `3px solid ${phase.color}44`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 36, fontWeight: 900, color: phase.color, lineHeight: 1 }}>{running ? seconds : '–'}</div>
            <div style={{ fontSize: 12, color: M_TEXT2, fontFamily: "'Nunito', sans-serif", fontWeight: 700, marginTop: 2 }}>{running ? phase.label : 'Ready'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          {PHASES.map((p, i) => (
            <div key={i} style={{
              padding: '8px 14px', borderRadius: 99,
              background: phaseIdx === i && running ? `${p.color}22` : M_SURF,
              border: phaseIdx === i && running ? `1.5px solid ${p.color}44` : `1.5px solid rgba(255,255,255,0.07)`,
              transition: 'all 300ms',
            }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: phaseIdx === i && running ? p.color : M_TEXT3, fontFamily: "'Nunito', sans-serif", textAlign: 'center' }}>{p.label}</div>
              <div style={{ fontSize: 9, color: M_TEXT3, fontFamily: "'Nunito', sans-serif", fontWeight: 700, textAlign: 'center' }}>{p.duration / 1000}s</div>
            </div>
          ))}
        </div>
        {cycles > 0 && (
          <div style={{ background: M_MINT_CARD, borderRadius: 99, padding: '6px 18px', marginBottom: 16, border: `1.5px solid rgba(90,223,158,0.2)` }}>
            <span style={{ fontSize: 12, color: M_MINT, fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>🎉 {cycles} cycle{cycles > 1 ? 's' : ''} complete</span>
          </div>
        )}
        <button onClick={() => { setRunning(r => !r); if (!running) { setPhaseIdx(0); setSeconds(4); } }}
          className={running ? 'btn btn-ghost' : 'btn btn-primary'}
          style={{ width: 200 }}>
          {running ? 'Pause' : 'Start Breathing'}
        </button>
      </div>
    </div>
  );
}

// ── CLARA AI SCREEN ────────────────────────────────────────────────────────────
function ClaraScreen({ onBack }) {
  const [messages, setMessages] = React.useState([
    { role: 'ai', text: "Hi, I'm CLARA — your recovery companion 💜 How are you feeling today? I'm here to listen without judgment." }
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const listRef = React.useRef(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
      const reply = await window.claude.complete({
        messages: [{ role: 'user', content: `You are CLARA, a compassionate AI recovery companion for FREED, a pornography addiction recovery app. You are warm, non-judgmental, and supportive. Keep responses concise (2-4 sentences). Previous conversation: ${JSON.stringify(history)}. User says: ${userMsg}` }]
      });
      setMessages(m => [...m, { role: 'ai', text: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: "I'm here for you. What's on your mind?" }]);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: M_BG, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 13, background: M_SURF2, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M_TEXT2} strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: M_PURPLE_CARD, border: `2px solid rgba(184,152,255,0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🤖</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: M_TEXT, fontFamily: "'Nunito', sans-serif" }}>CLARA</div>
          <div style={{ fontSize: 11, color: M_MINT, fontFamily: "'Nunito', sans-serif", fontWeight: 700 }}>● Online</div>
        </div>
      </div>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.3s both' }}>
            <div style={{
              maxWidth: '82%', padding: '11px 15px',
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: m.role === 'user' ? M_PURPLE : M_SURF,
              color: M_TEXT, fontFamily: "'Nunito', sans-serif", fontSize: 14, lineHeight: 1.55, fontWeight: 500,
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '11px 16px', borderRadius: '18px 18px 18px 4px', background: M_SURF }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: M_TEXT3, animation: `breathe 1s ${i*0.2}s ease-in-out infinite` }}/>)}
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '10px 16px 24px', display: 'flex', gap: 10, alignItems: 'center', borderTop: `1px solid rgba(255,255,255,0.06)`, flexShrink: 0 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Talk to CLARA…"
          style={{ flex: 1, height: 46, padding: '0 18px', background: M_SURF, border: `1.5px solid rgba(255,255,255,0.09)`, borderRadius: 999, color: M_TEXT, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, outline: 'none' }}
        />
        <button onClick={send} style={{
          width: 46, height: 46, borderRadius: '50%', background: M_PURPLE,
          border: 'none', cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: input.trim() && !loading ? 1 : 0.4,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1929" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  AnalyticsScreen, LibraryScreen, CommunityScreen, ProfileScreen,
  ProgressCardScreen, BreathingScreen, ClaraScreen,
});
