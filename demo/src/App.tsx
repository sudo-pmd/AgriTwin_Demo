import { useEffect, useMemo, useRef, useState } from 'react';
import World, { LANDMARKS, type Nearby, type Snapshot, type WorldEvent } from './scene/world';
import {
  BANDS,
  KIT_PARTS,
  MISSIONS,
  MOISTURE,
  SLOTS,
  TAMPERED_SLOT,
  VOICE,
  scoreBreakdown,
  shortSeal,
  type Layer,
  type Mode,
  type Scenario,
} from './scene/model';
import Sound from './audio';

type Phase = 'intro' | 'play' | 'done';

const NO_INTERACTIONS = { slots: false, box: false, valve: false, probes: false };

/* -------------------------------------------------------------------- */
/* Icônes du menu                                                       */
/* -------------------------------------------------------------------- */

function IconOrbit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <ellipse cx="12" cy="12" rx="9.2" ry="4.4" transform="rotate(-24 12 12)" />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="19.4" cy="7.4" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconWalk() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13.1" cy="4.4" r="1.9" />
      <path d="M13.2 8.2 10.6 13l2.8 2.4.9 5.1M10.6 13 7.4 15.2M13.4 15.4l3.6 1.2M12.1 9.6l3.1 2 2.6-.4" />
    </svg>
  );
}

function IconSound({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.6h3L11 6.4v11.2L7 14.4H4z" />
      {muted ? (
        <path d="M15.2 9.6l4.4 4.8M19.6 9.6l-4.4 4.8" />
      ) : (
        <path d="M14.6 9.2a4.4 4.4 0 0 1 0 5.6M17.2 6.8a7.8 7.8 0 0 1 0 10.4" />
      )}
    </svg>
  );
}

function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.7 9.4a2.5 2.5 0 1 1 3.3 2.4c-.7.3-1 .9-1 1.6v.4" />
      <circle cx="12" cy="17.1" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Nombre qui rejoint sa cible sans à-coup (setInterval : survit aux onglets masqués). */
function useTween(value: number) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const id = window.setInterval(() => {
      const gap = value - current.current;
      if (Math.abs(gap) < 0.6) {
        current.current = value;
        setDisplay(value);
        window.clearInterval(id);
        return;
      }
      current.current += gap * 0.22;
      setDisplay(Math.round(current.current));
    }, 45);
    return () => window.clearInterval(id);
  }, [value]);
  return display;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World | null>(null);
  const soundRef = useRef<Sound>(new Sound());
  const eventRef = useRef<(event: WorldEvent) => void>(() => {});
  const advancedRef = useRef(-1);
  const toastId = useRef(0);

  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<Mode>('orbit');
  const [layer, setLayer] = useState<Layer>('zones');
  const [missionIndex, setMissionIndex] = useState(0);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [scenario, setScenario] = useState<Scenario>({ heat: false, irrigation: false, tampered: false });
  const [moisture, setMoisture] = useState<number>(MOISTURE.start);
  const [kitStage, setKitStage] = useState(0);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ x: -46, z: 46, yaw: 0, mode: 'orbit', locked: false, waypoint: null });
  const [registry, setRegistry] = useState<{ index: number; ok: boolean }[]>([]);
  const [toast, setToast] = useState<{ id: number; text: string; tone: 'ok' | 'info' | 'bad' } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [help, setHelp] = useState(false);
  const [peak, setPeak] = useState(68);
  const [renderError, setRenderError] = useState(false);

  const score = useMemo(() => scoreBreakdown(scenario), [scenario]);
  const total = useTween(score.total);
  const mission = MISSIONS[missionIndex];
  const canReport = registry.some((entry) => !entry.ok);
  const doneCount = mission ? mission.objectives.filter((objective) => progress[objective.id]).length : 0;
  const waypoint = snapshot.waypoint;
  const waypointAngle = useMemo(() => {
    if (!waypoint) return 0;
    let relative =
      Math.atan2(-(waypoint.x - snapshot.x), -(waypoint.z - snapshot.z)) - snapshot.yaw;
    while (relative > Math.PI) relative -= Math.PI * 2;
    while (relative < -Math.PI) relative += Math.PI * 2;
    return (-relative * 180) / Math.PI;
  }, [waypoint, snapshot.x, snapshot.z, snapshot.yaw]);

  /* ---------------------------------------------------------------- */
  /* Monde                                                             */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let world: World | null = null;
    try {
      world = new World(canvas, {
        onNearby: setNearby,
        onEvent: (event) => eventRef.current(event),
        onSnapshot: setSnapshot,
      });
      worldRef.current = world;
    } catch (error) {
      // WebGL absent ou bloqué : le récit reste consultable au lieu d'un écran noir.
      console.error('Le champ virtuel — scène 3D indisponible', error);
      setRenderError(true);
    }
    return () => {
      world?.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    soundRef.current.enabled = soundOn;
  }, [soundOn]);

  useEffect(() => {
    worldRef.current?.setAutoRotate(phase === 'intro');
  }, [phase]);

  useEffect(() => {
    setPeak((value) => Math.max(value, score.total));
  }, [score.total]);

  const notify = (text: string, tone: 'ok' | 'info' | 'bad' = 'info') => {
    toastId.current += 1;
    const id = toastId.current;
    setToast({ id, text, tone });
    window.setTimeout(() => {
      setToast((current) => (current && current.id === id ? null : current));
    }, 5200);
  };

  const mark = (id: string) => {
    setProgress((current) => (current[id] ? current : { ...current, [id]: true }));
  };

  /* ---------------------------------------------------------------- */
  /* Actions de jeu                                                    */
  /* ---------------------------------------------------------------- */

  const chooseLayer = (next: Layer) => {
    setLayer(next);
    worldRef.current?.setLayer(next);
    soundRef.current.click();
    if (next === 'ndvi') mark('ndvi');
    if (next === 'radar') mark('radar');
    if (next === 'zones' && progress.ndvi && progress.radar) mark('zones');
  };

  const installPart = () => {
    if (kitStage >= KIT_PARTS.length) return;
    const next = kitStage + 1;
    setKitStage(next);
    worldRef.current?.setKitStage(next);
    mark(KIT_PARTS[next - 1].id);
    soundRef.current.click();
    notify(`${KIT_PARTS[next - 1].label} raccordé au boîtier.`, 'ok');
  };

  const openIrrigation = () => {
    if (scenario.irrigation) return;
    setScenario((current) => ({ ...current, irrigation: true }));
    worldRef.current?.setHeat(false);
    mark('open');
    soundRef.current.water();
    notify(`${VOICE.irrigation.wolof} — ${VOICE.irrigation.fr}`, 'ok');
  };

  const inspect = (index: number) => {
    const ok = index !== TAMPERED_SLOT;
    worldRef.current?.markInspected(index);
    setRegistry((current) => (current.some((entry) => entry.index === index) ? current : [...current, { index, ok }]));
    mark(`inspect-${index}`);
    if (ok) {
      soundRef.current.click();
      notify(`Sonde ${SLOTS[index].zone} : empreinte conforme au registre.`, 'ok');
    } else {
      soundRef.current.alert();
      setScenario((current) => ({ ...current, tampered: true }));
      notify(`Sonde ${SLOTS[index].zone} : empreinte non concordante, scellé rompu.`, 'bad');
    }
  };

  const report = () => {
    if (progress.report) return;
    mark('report');
    worldRef.current?.setAlarm(true);
    soundRef.current.lock();
    notify(`${VOICE.fraud.wolof} — ${VOICE.fraud.fr}`, 'bad');
  };

  eventRef.current = (event: WorldEvent) => {
    if (event.type === 'sensor') {
      soundRef.current.plant();
      mark(`slot-${event.index}`);
      notify(`Sonde ${event.index + 1} plantée en zone ${SLOTS[event.index].zone}.`, 'ok');
    } else if (event.type === 'kit') {
      installPart();
    } else if (event.type === 'irrigate') {
      openIrrigation();
    } else if (event.type === 'inspect') {
      inspect(event.index);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Progression des missions                                          */
  /* ---------------------------------------------------------------- */

  const enterMission = (index: number) => {
    const next = MISSIONS[index];
    if (!next) return;
    setMissionIndex(index);
    setNearby(null);
    if (next.id === 'sensors') {
      worldRef.current?.setInteractions({ ...NO_INTERACTIONS, slots: true });
      notify('Rejoignez les trois balises vertes et plantez une sonde.', 'info');
    }
    if (next.id === 'kit') {
      worldRef.current?.setInteractions({ ...NO_INTERACTIONS, box: true });
      notify('Le mât vous attend au sud-ouest de la parcelle.', 'info');
    }
    if (next.id === 'water') {
      worldRef.current?.setInteractions({ ...NO_INTERACTIONS, valve: true });
      worldRef.current?.setHeat(true);
      setScenario((current) => ({ ...current, heat: true }));
      mark('heat');
      soundRef.current.alert();
      notify(`Tàng bi dafa ëmb : ${VOICE.heat.fr}`, 'bad');
    }
    if (next.id === 'fraud') {
      worldRef.current?.setInteractions({ ...NO_INTERACTIONS, probes: true });
      worldRef.current?.setTampered(TAMPERED_SLOT);
      notify('Trois scellés à vérifier : approchez-vous de chaque sonde.', 'info');
    }
  };

  useEffect(() => {
    if (!mission || phase !== 'play') return;
    const complete = mission.objectives.every((objective) => progress[objective.id]);
    if (!complete || advancedRef.current >= missionIndex) return;
    advancedRef.current = missionIndex;
    soundRef.current.success();
    if (missionIndex === MISSIONS.length - 1) {
      const timer = window.setTimeout(() => {
        setToast(null);
        setPhase('done');
      }, 1600);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => enterMission(missionIndex + 1), 1500);
    return () => window.clearTimeout(timer);
  }, [progress, mission, missionIndex, phase]);

  /* Chaleur : l'humidité descend jusqu'au plancher. */
  useEffect(() => {
    if (phase !== 'play' || mission?.id !== 'water' || scenario.irrigation) return;
    const step = (MOISTURE.start - MOISTURE.floor) / 95;
    const timer = window.setInterval(() => {
      setMoisture((value) => Math.max(MOISTURE.floor, Number((value - step).toFixed(1))));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, mission?.id, scenario.irrigation]);

  /* Irrigation : remontée de l'humidité. */
  useEffect(() => {
    if (!scenario.irrigation || moisture >= MOISTURE.irrigated) return;
    const timer = window.setInterval(() => {
      setMoisture((value) => Math.min(MOISTURE.irrigated, Number((value + 1.1).toFixed(1))));
    }, 320);
    return () => window.clearInterval(timer);
  }, [scenario.irrigation, moisture]);

  /* ---------------------------------------------------------------- */
  /* Navigation                                                        */
  /* ---------------------------------------------------------------- */

  const start = (next: Mode) => {
    soundRef.current.enabled = soundOn;
    soundRef.current.click();
    setPhase('play');
    switchMode(next, true);
  };

  const switchMode = (next: Mode, silent = false) => {
    setMode(next);
    setNearby(null);
    worldRef.current?.setMode(next);
    if (!silent) soundRef.current.click();
    if (next === 'walk') worldRef.current?.lock();
  };

  const restart = () => {
    worldRef.current?.reset();
    worldRef.current?.setInteractions(NO_INTERACTIONS);
    advancedRef.current = -1;
    setProgress({});
    setScenario({ heat: false, irrigation: false, tampered: false });
    setMoisture(MOISTURE.start);
    setKitStage(0);
    setRegistry([]);
    setMissionIndex(0);
    setPeak(68);
    setLayer('zones');
    setMode('orbit');
    setToast(null);
    setPhase('play');
  };

  /* ---------------------------------------------------------------- */
  /* Rendu                                                             */
  /* ---------------------------------------------------------------- */

  return (
    <div className="site">
      <header className="topbar">
        <a className="brand" href="#champ" aria-label="AgriTwin — Le champ virtuel">
          <span className="brand-mark" aria-hidden>
            ◈
          </span>
          <span className="brand-text">
            <span className="brand-name">AgriTwin</span>
            <span className="brand-sub">Le champ virtuel</span>
          </span>
        </a>
        <nav className="menu" aria-label="Menu de la visite">
          <div className="mode-switch" role="group" aria-label="Mode de visite">
            <button
              type="button"
              className={mode === 'orbit' ? 'is-on' : ''}
              aria-pressed={mode === 'orbit'}
              title="Survol de la parcelle"
              onClick={() => switchMode('orbit')}
            >
              <IconOrbit />
              <span className="menu-label">Survol</span>
            </button>
            <button
              type="button"
              className={mode === 'walk' ? 'is-on' : ''}
              aria-pressed={mode === 'walk'}
              title="Marche à hauteur d’homme"
              onClick={() => switchMode('walk')}
            >
              <IconWalk />
              <span className="menu-label">Marche</span>
            </button>
          </div>
          <span className="menu-sep" aria-hidden />
          <button
            type="button"
            className={soundOn ? 'menu-btn is-on' : 'menu-btn'}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Couper le son' : 'Activer le son'}
            onClick={() => setSoundOn((value) => !value)}
          >
            <IconSound muted={!soundOn} />
            <span className="menu-label">{soundOn ? 'Son' : 'Muet'}</span>
          </button>
          <button type="button" className="menu-btn" aria-label="Aide et commandes" onClick={() => setHelp(true)}>
            <IconHelp />
            <span className="menu-label">Aide</span>
          </button>
        </nav>
      </header>

      <section className="stage" id="champ">
        <canvas ref={canvasRef} className={mode === 'walk' && phase === 'play' ? 'stage-canvas is-walk' : 'stage-canvas'} />
        <div className="stage-vignette" aria-hidden />

        {renderError && (
          <div className="gl-fallback" role="status">
            <p className="eyebrow">Affichage 3D indisponible</p>
            <h2>La parcelle ne peut pas s’ouvrir en trois dimensions.</h2>
            <p>
              Le navigateur n’a pas pu démarrer WebGL — accélération matérielle désactivée, pilote à jour ou appareil trop
              juste. Le récit, les chiffres et la méthode du projet restent lisibles juste en dessous.
            </p>
            <a className="btn-primary" href="#projet">
              Lire la présentation
            </a>
          </div>
        )}

        {phase === 'play' && mission && (
          <article className="panel mission">
            <header className="mission-head">
              <span className="mission-count">
                <b>{String(missionIndex + 1).padStart(2, '0')}</b>
                <i>/05</i>
              </span>
              <div>
                <p className="eyebrow">{mission.kicker}</p>
                <h2>{mission.title}</h2>
              </div>
              <span className="mission-tally">
                {doneCount}/{mission.objectives.length}
              </span>
            </header>
            <ul className="objectives">
              {mission.objectives.map((objective) => (
                <li key={objective.id} className={progress[objective.id] ? 'is-done' : ''}>
                  <span className="tick" aria-hidden>
                    {progress[objective.id] ? '✓' : ''}
                  </span>
                  <span>{objective.label}</span>
                </li>
              ))}
            </ul>
            {mission.id === 'fraud' && (
              <div className="registry">
                <p className="eyebrow">Registre des scellés</p>
                {SLOTS.map((slot, index) => {
                  const entry = registry.find((item) => item.index === index);
                  return (
                    <div key={slot.zone} className={`registry-row ${entry ? (entry.ok ? 'is-ok' : 'is-bad') : ''}`}>
                      <span>{slot.zone}</span>
                      <code>{entry ? (entry.ok ? shortSeal(slot.seal) : '3d5b·7f02·c9a4') : '—'}</code>
                      <em>{entry ? (entry.ok ? 'conforme' : 'rompu') : 'non lu'}</em>
                    </div>
                  );
                })}
                {canReport && (
                  <button type="button" className="report-btn" onClick={report}>
                    Signaler le scellé rompu
                  </button>
                )}
              </div>
            )}
            <p className="hint">
              {mode === 'walk' ? mission.hint : mission.hint.replace('appuyez sur E', 'cliquez sur l’élément')}
            </p>
            <details className="mission-context">
              <summary>Le contexte</summary>
              <p>{mission.brief}</p>
            </details>
          </article>
        )}

        {phase === 'play' && (
          <aside className="panel data">
            <div className="score-block">
              <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`Score Vert ${score.total} sur 100`}>
                <circle className="ring-track" cx="50" cy="50" r="42" />
                <circle
                  className={`ring-fill tone-${score.verdict.tone}`}
                  cx="50"
                  cy="50"
                  r="42"
                  style={{ strokeDashoffset: 263.9 - (263.9 * total) / 100 }}
                />
              </svg>
              <div className="score-read">
                <span className="score-num">{total}</span>
                <span className="score-max">/100</span>
                <p>Score Vert du scénario</p>
              </div>
            </div>

            <ul className="metrics compact">
              <li className="metric">
                <span>Humidité 15 cm</span>
                <b className={moisture < MOISTURE.alarm ? 'is-alert' : ''}>{moisture.toFixed(1)} %</b>
                <i>
                  <b style={{ width: `${Math.min(100, (moisture / 36) * 100)}%` }} />
                </i>
              </li>
              <li className="metric">
                <span>Air</span>
                <b>{scenario.heat && !scenario.irrigation ? '39,5' : scenario.irrigation ? '31,4' : '33,8'} °C</b>
              </li>
            </ul>

            <p className={`verdict tone-${score.verdict.tone}`}>{score.verdict.label}</p>

            <details className="data-more">
              <summary>Détail du score</summary>
              <ul className="bars">
                {[
                  { label: 'Régularité hydrique', value: score.water, max: 35 },
                  { label: 'Vigueur végétative', value: score.vegetation, max: 25 },
                  { label: 'Santé du sol', value: score.soil, max: 20 },
                  { label: 'Intégrité', value: score.integrity, max: 20 },
                ].map((row) => (
                  <li key={row.label}>
                    <span>{row.label}</span>
                    <i>
                      <b style={{ width: `${(row.value / row.max) * 100}%` }} />
                    </i>
                    <em>
                      {row.value}
                      <small>/{row.max}</small>
                    </em>
                  </li>
                ))}
              </ul>
              <ul className="metrics compact">
                <li className="metric">
                  <span>NDVI</span>
                  <b>{scenario.irrigation ? '0,74' : scenario.heat ? '0,57' : '0,68'}</b>
                </li>
                <li className="metric">
                  <span>Eau</span>
                  <b>{scenario.irrigation ? '1 240 L' : '0 L'}</b>
                </li>
              </ul>
              <p className="verdict-detail">{score.verdict.detail}</p>
            </details>
          </aside>
        )}

        {phase === 'play' && mode === 'walk' && (
          <>
            <div className="crosshair" aria-hidden />
            <div className="minimap" aria-hidden>
              <svg viewBox="0 0 120 106">
                <rect x="6" y="4" width="108" height="98" rx="6" className="map-field" />
                <rect x="6" y="4" width="108" height="32" className="map-zone map-north" />
                <rect x="6" y="36" width="108" height="33" className="map-zone map-centre" />
                <rect x="6" y="69" width="108" height="33" className="map-zone map-south" />
                {SLOTS.map((slot, index) => {
                  const x = 6 + ((slot.x + 65) / 130) * 108;
                  const y = 4 + ((slot.z + 57) / 114) * 98;
                  const done = progress[`slot-${index}`];
                  return <circle key={slot.zone} cx={x} cy={y} r={done ? 3 : 2.4} className={done ? 'map-dot is-done' : 'map-dot'} />;
                })}
                <rect
                  x={6 + ((LANDMARKS.box.x + 65) / 130) * 108 - 2.2}
                  y={4 + ((LANDMARKS.box.z + 57) / 114) * 98 - 2.2}
                  width="4.4"
                  height="4.4"
                  rx="1"
                  className="map-node map-node-box"
                />
                <rect
                  x={6 + ((LANDMARKS.valve.x + 65) / 130) * 108 - 1.8}
                  y={4 + ((LANDMARKS.valve.z + 57) / 114) * 98 - 1.8}
                  width="3.6"
                  height="3.6"
                  rx="1"
                  className="map-node map-node-valve"
                />
                {waypoint && (
                  <circle
                    cx={6 + ((waypoint.x + 65) / 130) * 108}
                    cy={4 + ((waypoint.z + 57) / 114) * 98}
                    r="4.4"
                    className="map-waypoint"
                  />
                )}
                <g
                  className="map-player"
                  transform={`translate(${6 + ((snapshot.x + 65) / 130) * 108} ${4 + ((snapshot.z + 57) / 114) * 98}) rotate(${(-snapshot.yaw * 180) / Math.PI})`}
                >
                  <path d="M0,-6 L4.2,4.4 L0,2.4 L-4.2,4.4 Z" />
                </g>
              </svg>
              <span className="minimap-north">N</span>
            </div>

            <div className="dpad" role="group" aria-label="Déplacements tactiles">
              <span
                className="dpad-up"
                onPointerDown={() => worldRef.current?.pressVirtual('KeyW', true)}
                onPointerUp={() => worldRef.current?.pressVirtual('KeyW', false)}
                onPointerLeave={() => worldRef.current?.pressVirtual('KeyW', false)}
              >
                ↑
              </span>
              <span
                className="dpad-left"
                onPointerDown={() => worldRef.current?.pressVirtual('KeyA', true)}
                onPointerUp={() => worldRef.current?.pressVirtual('KeyA', false)}
                onPointerLeave={() => worldRef.current?.pressVirtual('KeyA', false)}
              >
                ←
              </span>
              <span
                className="dpad-down"
                onPointerDown={() => worldRef.current?.pressVirtual('KeyS', true)}
                onPointerUp={() => worldRef.current?.pressVirtual('KeyS', false)}
                onPointerLeave={() => worldRef.current?.pressVirtual('KeyS', false)}
              >
                ↓
              </span>
              <span
                className="dpad-right"
                onPointerDown={() => worldRef.current?.pressVirtual('KeyD', true)}
                onPointerUp={() => worldRef.current?.pressVirtual('KeyD', false)}
                onPointerLeave={() => worldRef.current?.pressVirtual('KeyD', false)}
              >
                →
              </span>
            </div>
          </>
        )}

        {phase === 'play' && mode === 'walk' && nearby && (
          <button type="button" className="prompt" onClick={() => worldRef.current?.interact()}>
            <kbd>E</kbd>
            <span>{nearby.label}</span>
          </button>
        )}

        {phase === 'play' && mode === 'orbit' && mission && mission.id !== 'scan' && (
          <p className="orbit-tip">Cliquez directement dans la parcelle pour agir.</p>
        )}

        {phase === 'play' && (
          <div className="layers">
            <p className="eyebrow">Calques satellite</p>
          <div className="layer-buttons">
            {(['zones', 'ndvi', 'radar'] as Layer[]).map((item) => (
              <button key={item} type="button" className={layer === item ? 'is-on' : ''} onClick={() => chooseLayer(item)}>
                {item === 'zones' ? 'Zones' : item === 'ndvi' ? 'NDVI' : 'Radar'}
              </button>
            ))}
          </div>
            {layer === 'zones' && (
              <ul className="zone-legend">
                {BANDS.map((band) => (
                  <li key={band.key}>
                    <i className={`dot-${band.tone}`} aria-hidden />
                    <b>{band.label}</b> · {band.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {phase === 'play' && mission?.id === 'kit' && (
          <div className="dock">
            <p className="eyebrow">Kit d’installation</p>
            <div className="dock-parts">
              {KIT_PARTS.map((part, index) => (
                <span key={part.id} className={index < kitStage ? 'is-done' : ''}>
                  <b>{index + 1}</b>
                  {part.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {phase === 'play' && mode === 'walk' && waypoint && (
          <div className={`waypoint ${nearby ? 'is-near' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${waypointAngle}deg)` }}>
              <path d="M12 2.5 L18.5 19.5 L12 15.8 L5.5 19.5 Z" />
            </svg>
            <span>{waypoint.label}</span>
            <b>{nearby ? 'à portée' : `${Math.round(waypoint.distance)} m`}</b>
          </div>
        )}

        {toast && (
          <div className={`toast tone-${toast.tone}`} role="status">
            <span className="toast-dot" aria-hidden />
            {toast.text}
          </div>
        )}

        {phase === 'intro' && !renderError && (
          <div className="intro">
            <div className="intro-inner">
              <p className="eyebrow">Démonstration publique · Niayes, Sénégal</p>
              <h1>
                Entrez dans
                <br />
                <em>le champ.</em>
              </h1>
              <p className="lede">
                1,5 hectare d’oignons, trois sondes, une vague de chaleur. Mesurez le sol, installez le kit, sauvez la
                récolte — puis découvrez ce qu’une sonde arrachée fait à un dossier de crédit.
              </p>
              <div className="intro-actions">
                <button type="button" className="btn-primary" onClick={() => start('walk')}>
                  Commencer la visite
                </button>
                <button type="button" className="btn-ghost" onClick={() => start('orbit')}>
                  Survoler d’abord
                </button>
              </div>
              <dl className="intro-keys">
                <div>
                  <dt>ZQSD</dt>
                  <dd>marcher</dd>
                </div>
                <div>
                  <dt>Souris</dt>
                  <dd>regarder</dd>
                </div>
                <div>
                  <dt>E</dt>
                  <dd>interagir</dd>
                </div>
                <div>
                  <dt>Maj</dt>
                  <dd>courir</dd>
                </div>
                <div>
                  <dt>Espace</dt>
                  <dd>sauter</dd>
                </div>
              </dl>
              <p className="intro-foot">
                Parcelle reconstituée, relevés simulés : la visite ne modifie aucun dossier certifié.
              </p>
            </div>
            <a className="intro-scroll" href="#projet">
              Comprendre le projet ↓
            </a>
          </div>
        )}

        {phase === 'done' && (
          <div className="finale">
            <div className="finale-card">
              <p className="eyebrow">Visite terminée</p>
              <h2>
                La récolte est sauvée.
                <br />
                Le dossier, non.
              </h2>
              <div className="finale-scores">
                <div>
                  <span>Meilleur score atteint</span>
                  <b>{peak}</b>
                </div>
                <div className="is-bad">
                  <span>Après l’intrusion</span>
                  <b>{score.total}</b>
                </div>
              </div>
              <p>
                Le goutte-à-goutte a ramené l’humidité du sol à 31,6 % et le Score Vert à 86. Mais l’empreinte de la sonde
                Nord ne concorde plus avec le registre : l’intégrité tombe à 0 et le décaissement est bloqué jusqu’à la
                visite du technicien.
              </p>
              <ul className="finale-list">
                <li>Score final : {score.total}/100 · profil {score.profile}</li>
                <li>Chaîne d’intégrité : rompue à la sonde Nord</li>
                <li>Dossier bancaire : verrouillé</li>
              </ul>
              <div className="intro-actions">
                <button type="button" className="btn-primary" onClick={restart}>
                  Rejouer la visite
                </button>
                <a className="btn-ghost" href="#projet">
                  Comprendre le projet
                </a>
              </div>
            </div>
          </div>
        )}

        {help && (
          <div className="modal" role="dialog" aria-modal="true" aria-label="Aide" onClick={() => setHelp(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <p className="eyebrow">Prendre en main</p>
              <h3>Comme dans un jeu de terrain</h3>
              <ul>
                <li>
                  <kbd>Z</kbd>
                  <kbd>Q</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd> marcher — les flèches fonctionnent aussi
                </li>
                <li>
                  <kbd>Souris</kbd> regarder (cliquez une fois dans le champ pour capturer la souris)
                </li>
                <li>
                  <kbd>E</kbd> planter, raccorder, ouvrir la vanne, lire un scellé
                </li>
                <li>
                  <kbd>Maj</kbd> courir · <kbd>Espace</kbd> sauter · <kbd>Échap</kbd> libérer la souris
                </li>
                <li>Sur mobile, utilisez la croix de déplacement et le bouton « E ».</li>
              </ul>
              <p className="modal-note">
                Le mode « Survol » garde la souris libre : cliquez un cercle vert, le mât ou la vanne pour agir.
              </p>
              <button type="button" className="btn-primary" onClick={() => setHelp(false)}>
                Reprendre la visite
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="story" id="projet">
        <div className="story-inner">
          <p className="eyebrow">Sous le capot</p>
          <h2>Un jumeau numérique, pas une maquette.</h2>
          <p className="story-lede">
            AgriTwin réunit trois choses que le financement rural sépare encore : la mesure du sol, la preuve qu’elle
            n’a pas été falsifiée, et un score qu’une banque peut lire. Cette visite en est la version jouable.
          </p>
          <div className="story-grid">
            <article>
              <span>01</span>
              <h3>Le sol parle</h3>
              <p>
                Deux sondes capacitives à 15 et 35 cm, un pluviomètre, une passerelle LoRaWAN : la parcelle envoie son
                état à la coopérative sans réseau mobile, avec un panneau de 20 Wc pour l’alimentation.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>La preuve</h3>
              <p>
                Chaque relevé est haché en SHA-256 et chaîné au précédent. Arracher une sonde ne suffit plus à maquiller
                une saison : le scellé rompu invalide la chaîne, et le dossier avec elle.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Le financement</h3>
              <p>
                Le Score Vert traduit la régularité hydrique (35), la vigueur végétative (25), la santé du sol (20) et
                l’intégrité (20). Au-dessus de 75 points, la tranche suivante est débloquée.
              </p>
            </article>
          </div>
          <div className="numbers">
            <div>
              <b>1,5</b>
              <span>hectare instrumenté</span>
            </div>
            <div>
              <b>90</b>
              <span>relevés chaînés dans le dossier</span>
            </div>
            <div>
              <b>3</b>
              <span>zones pédoclimatiques</span>
            </div>
            <div>
              <b>35·25·20·20</b>
              <span>poids officiels du Score Vert</span>
            </div>
          </div>
          <div className="honesty">
            <h3>Ce que cette démonstration ne prouve pas</h3>
            <p>
              La parcelle est une reconstitution 3D : les plants, les volumes et les capteurs sont modélisés, les
              valeurs affichées sont simulées et aucune donnée météo réelle n’est consommée. Seules la mécanique de score
              et les empreintes SHA-256 sont réelles. La visite ne modifie jamais les relevés certifiés du dossier :
              le scénario est isolé.
            </p>
            <p className="fine">
              Parcelle Pilote Bambey · 1,5 ha · oignon Violet de Galmi · sol dior, EC 1,65 dS/m, pH 6,8.
            </p>
          </div>
        </div>
        <footer className="site-footer">
          <div>
            <strong>AgriTwin</strong>
            <span>Prototype · École Polytechnique de Thiès</span>
          </div>
          <div>
            <span>Concours Aktiion 2026 · Démonstrateur grand public</span>
            <button type="button" className="ghost-btn" onClick={restart}>
              Rejouer
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
