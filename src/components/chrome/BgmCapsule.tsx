/**
 * BGM capsule (EXECUTIONPLAN §7.6). The YouTube IFrame Player API is loaded only after the visitor
 * first presses ♪. Hidden 1 px player on youtube-nocookie, volume 40%, never autoplays, persisted
 * across ClientRouter navigations so music keeps playing between chapters. Official uploads only.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { bgmOn, lang } from '../../lib/prefs';
import { track } from '../../lib/analytics';

export const BGM_TRACKS = [
  { id: '6bnaBnd4kyU', ja: '#あくあ色ぱれっと', en: '#AquaIroPalette' },
  {
    id: 'Qg9Uj371GaA',
    ja: 'Aqua Step Allegretto（公式BGM）',
    en: 'Aqua Step Allegretto (official stream BGM)',
  },
  { id: 'tuWw5EQPGlc', ja: '海想列車', en: 'KAISOU RESSHA' },
  { id: 'fXeM0fXvOp8', ja: 'きらきら', en: 'Kira Kira' },
  { id: 'RBBwfP1rtkE', ja: '#きみいろプリンセス', en: '#kimiiro princess' },
] as const;

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  loadVideoById(id: string): void;
  setVolume(v: number): void;
  getPlayerState(): number;
  destroy(): void;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: Record<string, number> };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise<void>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error('blocked'));
    };
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('timeout')), 10_000);
  });
  return apiPromise;
}

export default function BgmCapsule() {
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [trackId, setTrackId] = useState<string>(BGM_TRACKS[0].id);
  const [menu, setMenu] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const L = lang.value;
  const current = BGM_TRACKS.find((t) => t.id === trackId) ?? { id: trackId, ja: trackId, en: trackId };

  async function start(id: string) {
    setVisible(true);
    setTrackId(id);
    setFailed(false);
    bgmOn.value = true;
    try {
      await loadApi();
      if (!player.current && host.current) {
        const mount = document.createElement('div');
        host.current.appendChild(mount);
        player.current = new window.YT!.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          width: 1,
          height: 1,
          videoId: id,
          playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, loop: 1, playlist: id },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              e.target.setVolume(40);
              e.target.playVideo();
            },
            onStateChange: (e: { data: number }) => setPlaying(e.data === 1),
            onError: () => setFailed(true),
          },
        });
      } else {
        player.current?.loadVideoById(id);
        player.current?.setVolume(40);
      }
      track('bgm_play', { id });
    } catch {
      setFailed(true);
    }
  }
  function stop() {
    player.current?.stopVideo();
    setPlaying(false);
    setVisible(false);
    setMenu(false);
    bgmOn.value = false;
  }
  function togglePause() {
    if (!player.current) return start(trackId);
    if (playing) player.current.pauseVideo();
    else player.current.playVideo();
  }

  useEffect(() => {
    const onBgm = (e: Event) => {
      const d = (e as CustomEvent<{ toggle?: boolean; play?: string }>).detail ?? {};
      if (d.play) return void start(d.play);
      if (d.toggle) {
        if (visible) stop();
        else void start(trackId);
      }
    };
    window.addEventListener('aia:bgm', onBgm);
    return () => window.removeEventListener('aia:bgm', onBgm);
  }, [visible, trackId]);

  useEffect(() => () => player.current?.destroy(), []);

  const say = (ja: string, en: string) => (L === 'ja' ? ja : en);
  return (
    <div
      class={`bgm${playing ? ' is-playing' : ''}`}
      hidden={!visible}
      role="region"
      aria-label={say('BGMプレーヤー', 'BGM player')}
    >
      <span class="bgm__disc" aria-hidden="true" />
      <div class="bgm__meta" aria-live="polite">
        <small>{failed ? say('読み込めませんでした', "Couldn't load") : say('再生中', 'Now playing')}</small>
        <span lang="ja">{say(current.ja, current.en)}</span>
      </div>
      {failed ? (
        <a
          class="btn btn--secondary"
          style="min-height:34px;padding:6px 12px"
          href={`https://www.youtube.com/watch?v=${trackId}`}
          target="_blank"
          rel="noopener"
        >
          {say('YouTubeで開く', 'Open on YouTube')}
        </a>
      ) : (
        <button
          type="button"
          class="bgm__btn"
          onClick={togglePause}
          aria-label={playing ? say('一時停止', 'Pause') : say('再生', 'Play')}
        >
          <svg class="icon" aria-hidden="true">
            <use href={playing ? '#i-pause' : '#i-play'} />
          </svg>
        </button>
      )}
      <div style="position:relative">
        <button
          type="button"
          class="bgm__btn"
          aria-expanded={menu}
          aria-label={say('曲をえらぶ', 'Choose a track')}
          onClick={() => setMenu((v) => !v)}
        >
          <svg class="icon" aria-hidden="true">
            <use href="#i-list" />
          </svg>
        </button>
        {menu && (
          <ul class="bgm__menu" role="list">
            {BGM_TRACKS.map((t) => (
              <li>
                <button
                  type="button"
                  aria-current={t.id === trackId}
                  onClick={() => {
                    setMenu(false);
                    void start(t.id);
                  }}
                >
                  {say(t.ja, t.en)}
                </button>
              </li>
            ))}
            <li>
              <a
                class="credit"
                style="display:block;padding:8px 12px"
                href={`https://www.youtube.com/watch?v=${trackId}`}
                target="_blank"
                rel="noopener"
              >
                {say('YouTubeで見る ↗', 'Watch on YouTube ↗')}
              </a>
            </li>
          </ul>
        )}
      </div>
      <button
        type="button"
        class="bgm__btn"
        onClick={stop}
        aria-label={say('BGMを止めて閉じる', 'Stop BGM and close')}
      >
        <svg class="icon" aria-hidden="true">
          <use href="#i-close" />
        </svg>
      </button>
      <div class="bgm__player" ref={host} aria-hidden="true" />
    </div>
  );
}
