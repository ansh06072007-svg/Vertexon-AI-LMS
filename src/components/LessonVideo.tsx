import { useRef, useState } from 'react';
import { Code2, Maximize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';
import { formatTime } from '../lib/time';

type LessonVideoProps = {
  time: number;
  duration: number;
  playing: boolean;
  speed: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSpeedChange: () => void;
};

export default function LessonVideo({
  time,
  duration,
  playing,
  speed,
  onTogglePlay,
  onSeek,
  onSpeedChange,
}: LessonVideoProps) {
  const progress = Math.min(100, (time / duration) * 100);
  const shellRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      shellRef.current?.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  };

  return (
    <div
      ref={shellRef}
      className="video-shell relative aspect-[16/9] select-none overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07050d] shadow-[0_24px_60px_-40px_rgba(0,0,0,1)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_72%_18%,rgba(37,99,235,0.16),transparent_52%),radial-gradient(ellipse_at_18%_84%,rgba(124,58,237,0.18),transparent_56%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.24]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
        }}
      />

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
        <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/45 px-2 py-1.5 font-mono text-[8px] text-white/50 backdrop-blur lg:text-[9.5px]">
          <Code2 className="h-2.5 w-2.5 text-teal-300/70 lg:h-3 lg:w-3" />
          dijkstra_visualizer.py
        </span>
        <span className="rounded-md border border-white/10 bg-black/45 px-1.5 py-1.5 text-[7.5px] font-semibold tracking-wide text-white/40 backdrop-blur lg:text-[8.5px]">
          HD
        </span>
      </div>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-teal2/15 bg-teal2/[0.07] px-2 py-1.5 backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-teal2" />
        <span className="text-[7.5px] font-semibold uppercase tracking-[0.1em] text-teal-300/80 lg:text-[8.5px]">
          Live trace
        </span>
      </div>

      <button
        onClick={onTogglePlay}
        aria-label={playing ? 'Pause lesson' : 'Play lesson'}
        className="absolute inset-x-0 top-10 bottom-[56px] z-0 flex items-stretch text-left"
      >
        <div className="w-[54%] overflow-hidden px-4 pt-2 font-mono text-[8px] leading-[1.95] text-white/40 sm:text-[9.5px] lg:text-[10.5px]">
          <p><span className="text-teal-300/60"># Dijkstra with an indexed min-heap</span></p>
          <p><span className="text-[#c4b5fd]">dist</span> = {'{'}v: <span className="text-[#93c5fd]">inf</span> for v in graph{'}'}</p>
          <p>dist[source] = <span className="text-amber-200/80">0</span></p>
          <p>heap = [(<span className="text-amber-200/80">0</span>, source)]</p>
          <p className="text-white/45"><span className="text-[#c4b5fd]">while</span> heap:</p>
          <p>　　d, u = heappop(heap)</p>
          <p>　　<span className="text-[#c4b5fd]">for</span> v, w in graph[u]:</p>
          <p className="-ml-1 rounded bg-primary-500/15 px-1 text-primary-200/80">　　　　<span className="text-[#c4b5fd]">if</span> d + w &lt; dist[v]:</p>
          <p>　　　　　　dist[v] = d + w</p>
          <p>　　　　　　heappush(heap, (dist[v], v))</p>
          <p className="mt-1 text-white/25">→ settle 0 · 2 · 1 · 4 · 3 · 5</p>
        </div>

        <div className="relative flex-1">
          <svg viewBox="0 0 165 132" className="h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="edge-active" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#2dd4bf" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
              <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="2.6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g stroke="rgba(255,255,255,0.14)" strokeWidth="1" fill="none">
              <path d="M28 30 78 20 122 44 140 88 102 112 45 102 18 69Z" />
              <path d="M78 20 74 65 45 102" />
              <path d="M122 44 74 65 102 112" />
              <path d="M18 69 74 65" />
              <path d="M122 44 102 112" />
            </g>

            <g stroke="rgba(45,212,191,0.75)" strokeWidth="1.7" fill="none" strokeLinecap="round">
              <path d="M28 30 78 20 122 44 74 65 102 112" />
            </g>

            <g fill="#0d0b16" stroke="#6d5bd0" strokeWidth="1.2">
              <circle cx="28" cy="30" r="7" />
              <circle cx="78" cy="20" r="7" />
              <circle cx="122" cy="44" r="7" />
              <circle cx="140" cy="88" r="7" />
              <circle cx="102" cy="112" r="7" />
              <circle cx="45" cy="102" r="7" />
              <circle cx="18" cy="69" r="7" />
            </g>
            <g fill="#0d0b16" stroke="#2dd4bf" strokeWidth="1.4" filter="url(#node-glow)">
              <circle cx="74" cy="65" r="8.5" />
            </g>

            <g fill="rgba(255,255,255,0.72)" fontSize="5.5" fontFamily="JetBrains Mono, monospace" textAnchor="middle">
              <text x="28" y="32">0</text>
              <text x="78" y="22">1</text>
              <text x="122" y="46">2</text>
              <text x="140" y="90">3</text>
              <text x="102" y="114">4</text>
              <text x="45" y="104">5</text>
              <text x="18" y="71">6</text>
              <text x="74" y="67">★</text>
            </g>

            <g fill="rgba(196,181,253,0.5)" fontSize="4.6" fontFamily="JetBrains Mono, monospace">
              <text x="47" y="22">4</text>
              <text x="101" y="29">8</text>
              <text x="52" y="81">2</text>
              <text x="118" y="75">7</text>
              <text x="122" y="104">9</text>
              <text x="26" y="94">3</text>
            </g>
          </svg>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md border border-teal2/20 bg-[#081210]/85 px-2.5 py-1.5 backdrop-blur">
            <p className="text-center font-mono text-[7px] uppercase tracking-[0.08em] text-teal-300/60 lg:text-[8px]">
              Shortest path
            </p>
            <p className="mt-0.5 text-center font-mono text-[9px] font-medium text-teal-200/90 lg:text-[11px]">
              0 → 4 · cost 13
            </p>
          </div>
        </div>
      </button>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/85 to-transparent px-4 pb-3 pt-12">
        <div className="relative h-1.5">
          <div className="absolute inset-x-0 top-0 h-1.5 rounded-full bg-white/[0.14]" />
          <div
            className="absolute left-0 top-0 h-1.5 rounded-full bg-gradient-to-r from-primary-400 via-primary-300 to-teal2"
            style={{ width: `${progress}%` }}
          />
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
            style={{ left: `${progress}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration}
            value={Math.floor(time)}
            onChange={(event) => onSeek(Number(event.target.value))}
            aria-label="Seek video"
            className="absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 cursor-pointer opacity-0"
          />
        </div>

        <div className="mt-2 flex items-center gap-3">
          <button onClick={() => onSeek(time - 10)} aria-label="Rewind 10 seconds" className="text-white/55 transition hover:text-white">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={onTogglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-black shadow-[0_0_18px_-2px_rgba(255,255,255,0.4)] transition hover:scale-105"
          >
            {playing ? <Pause className="h-3.5 w-3.5 fill-black" /> : <Play className="ml-[1px] h-3.5 w-3.5 fill-black" />}
          </button>
          <button onClick={() => onSeek(time + 10)} aria-label="Forward 10 seconds" className="text-white/55 transition hover:text-white">
            <RotateCw className="h-4 w-4" />
          </button>
          <span className="ml-1 font-mono text-[9px] tabular-nums text-white/55 lg:text-[10.5px]">
            {formatTime(time)} <span className="text-white/25">/ {formatTime(duration)}</span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={onSpeedChange}
              className="rounded border border-white/15 px-2 py-1 font-mono text-[8.5px] text-white/55 transition hover:border-white/30 hover:text-white lg:text-[9.5px]"
              aria-label="Change playback speed"
            >
              {speed}x
            </button>
            <button
              onClick={() => setMuted((current) => !current)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="text-white/45 transition hover:text-white"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              className="text-white/45 transition hover:text-white"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
