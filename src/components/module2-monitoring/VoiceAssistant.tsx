import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, AudioLines, Info, Languages, MessageSquare, Play, Square, Volume2 } from '../ui/icons';
import type { AlertMessage, ParcelDataset } from '../../types/agritwin';
import { QUICK_QUESTIONS, buildQuickAnswer } from '../../data/wolofPhrases';
import { irrigationAdvice } from '../../utils/agronomyEngine';

interface VoiceAssistantProps {
  dataset: ParcelDataset;
  alerts: AlertMessage[];
  score: number;
}

type Language = 'fr' | 'wolof';

export default function VoiceAssistant({ dataset, alerts, score }: VoiceAssistantProps) {
  const [language, setLanguage] = useState<Language>('fr');
  const [playing, setPlaying] = useState<Language | null>(null);
  const [activeAlertId, setActiveAlertId] = useState<string | undefined>(alerts[0]?.id);
  const [answer, setAnswer] = useState<{ question: string; fr: string; wolof: string; frTranslation: string } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const audioRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const latest = dataset.records[dataset.records.length - 1];
  const activeAlert = alerts.find((item) => item.id === activeAlertId) ?? alerts[0];

  useEffect(() => {
    if (alerts.length > 0 && !alerts.some((item) => item.id === activeAlertId)) {
      setActiveAlertId(alerts[0].id);
    }
  }, [alerts, activeAlertId]);

  useEffect(
    () => () => {
      stopAll();
    },
    [],
  );

  const stopAll = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (audioRef.current) {
      void audioRef.current.close();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlaying(null);
  };

  const speakFrench = (text: string) => {
    stopAll();
    if (!('speechSynthesis' in window)) {
      setNotice("La synthèse vocale n'est pas disponible dans ce navigateur. Le texte reste lisible ci-dessous.");
      return;
    }
    setNotice(null);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.97;
    utterance.pitch = 1;
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.startsWith('fr'));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setPlaying('fr');
    utterance.onend = () => setPlaying(null);
    utterance.onerror = () => setPlaying(null);
    window.speechSynthesis.speak(utterance);
  };

  const playWolof = (text: string) => {
    stopAll();
    setNotice(null);
    setPlaying('wolof');
    const durationMs = Math.min(16_000, Math.max(4_200, text.length * 70));
    try {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) throw new Error('AudioContext indisponible');
      const context = new AudioCtor();
      audioRef.current = context;
      const now = context.currentTime;
      const notes = [392, 523.25, 659.25, 523.25, 587.33, 783.99, 659.25];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const start = now + index * 0.32;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.32);
      });
      timerRef.current = window.setTimeout(() => {
        setPlaying(null);
        void context.close();
        audioRef.current = null;
      }, durationMs);
    } catch {
      timerRef.current = window.setTimeout(() => setPlaying(null), durationMs);
    }
  };

  const play = (textFr: string, textWolof: string) => {
    if (language === 'fr') speakFrench(textFr);
    else playWolof(textWolof);
  };

  const askQuestion = (id: (typeof QUICK_QUESTIONS)[number]['id']) => {
    const question = QUICK_QUESTIONS.find((item) => item.id === id)!;
    const result = buildQuickAnswer(
      id,
      dataset,
      score,
      irrigationAdvice(latest.moisture15, latest.ec),
    );
    setAnswer({
      question: language === 'fr' ? question.labelFr : question.labelWolof,
      ...result,
    });
    play(result.fr, result.wolof);
  };

  const severityStyles: Record<AlertMessage['severity'], { chip: string; icon: typeof Info }> = {
    critique: { chip: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]', icon: AlertTriangle },
    vigilance: { chip: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]', icon: AlertTriangle },
    info: { chip: 'border-[#e2e8f0] bg-white text-slate-600', icon: Info },
  };

  const equalizerBars = 16;

  return (
    <section className="card p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg leading-tight text-slateink-800">
            Assistant vocal &amp; alertes bilingues
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Diffusion des conseils opérationnels en français et en wolof, indépendamment de la lecture.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-0.5">
          {(['fr', 'wolof'] as Language[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              className={`inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-xs font-bold ${
                language === code ? 'bg-white text-forest-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              {code === 'fr' ? 'Français' : 'Wolof'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.05fr]">
        <div className="space-y-2">
          {alerts.map((alert) => {
            const style = severityStyles[alert.severity];
            const Icon = style.icon;
            const active = alert.id === activeAlert?.id;
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => setActiveAlertId(alert.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  active ? 'border-forest-400 bg-forest-50/40 ring-1 ring-forest-300' : 'border-[#e2e8f0] hover:bg-[#f8fafc]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`chip border ${style.chip}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {alert.severity === 'critique' ? 'Critique' : alert.severity === 'vigilance' ? 'Vigilance' : 'Information'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {alert.id}
                  </span>
                </span>
                <span className="mt-1.5 block text-sm font-bold text-slateink-800">{alert.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{alert.message}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Lecteur d’alertes
            </p>
            {playing && (
              <button type="button" onClick={stopAll} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#b91c1c]">
                <Square className="h-3 w-3" />
                Arrêter
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => activeAlert && speakFrench(activeAlert.voiceFr)}
              className={`btn flex-1 ${
                playing === 'fr' ? 'bg-forest-700 text-white' : 'border border-[#cbd5e1] bg-white text-slateink-700 hover:bg-forest-50'
              }`}
            >
              <Volume2 className="h-4 w-4" />
              Écouter en Français
            </button>
            <button
              type="button"
              onClick={() => activeAlert && playWolof(activeAlert.voiceWolof)}
              className={`btn flex-1 ${
                playing === 'wolof' ? 'bg-[#0f172a] text-white' : 'border border-[#cbd5e1] bg-white text-slateink-700 hover:bg-[#f0f9ff]'
              }`}
            >
              <Languages className="h-4 w-4" />
              Déglu ci Wolof
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2">
            <div className="flex h-8 items-end gap-[3px]" aria-hidden="true">
              {Array.from({ length: equalizerBars }).map((_, index) => (
                <span
                  key={index}
                  className={`w-[3px] rounded-full ${
                    playing === 'wolof' ? 'animate-equalize bg-[#0284c7]' : 'bg-[#cbd5e1]'
                  }`}
                  style={{
                    height: `${10 + ((index * 7) % 20)}px`,
                    animationDelay: `${(index % 6) * 0.11}s`,
                  }}
                />
              ))}
            </div>
            <p className="flex-1 text-[11px] font-semibold text-slate-500">
              {playing === 'fr'
                ? 'Lecture en français en cours…'
                : playing === 'wolof'
                  ? 'Message vocal wolof en cours de diffusion…'
                  : 'Prêt — synthèse vocale française et message vocal wolof.'}
            </p>
            <AudioLines className={`h-4 w-4 ${playing ? 'text-tech' : 'text-slate-300'}`} />
          </div>

          {activeAlert && (
            <div className="space-y-2">
              <div className="rounded-lg border border-[#e2e8f0] bg-white p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Wolof</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slateink-800">{activeAlert.voiceWolof}</p>
              </div>
              <div className="rounded-lg border border-[#e2e8f0] bg-white p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Traduction française
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {activeAlert.wolofTranslation}
                </p>
              </div>
            </div>
          )}

          {notice && (
            <p className="rounded-lg bg-[#fffbeb] px-2.5 py-1.5 text-[11px] font-semibold text-[#b45309]">
              {notice}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[#e2e8f0] pt-3">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <MessageSquare className="h-3.5 w-3.5" />
          Questions rapides — réponse immédiate en {language === 'fr' ? 'français' : 'wolof'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((question) => (
            <button
              key={question.id}
              type="button"
              onClick={() => askQuestion(question.id)}
              className="btn-secondary text-left text-xs"
            >
              <Play className="h-3.5 w-3.5 text-forest-600" />
              {language === 'fr' ? question.labelFr : question.labelWolof}
            </button>
          ))}
        </div>

        {answer && (
          <div className="mt-3 rounded-xl border border-forest-200 bg-forest-50/60 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-forest-700">
              {answer.question}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slateink-800">
              {language === 'fr' ? answer.fr : answer.wolof}
            </p>
            <p className="mt-1.5 border-t border-forest-200 pt-1.5 text-xs leading-relaxed text-slate-600">
              <span className="font-bold">Traduction : </span>
              {answer.frTranslation}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
