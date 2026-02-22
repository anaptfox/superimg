'use client'

import { useRef, useState } from 'react'
import { Player, type PlayerRef } from 'superimg-react/player'
import { introTemplate } from '@/content/blog/templates/intro-demo'

export function PlayerDemo() {
  const ref = useRef<PlayerRef>(null)
  const [playing, setPlaying] = useState(false)

  return (
    <div className="not-prose my-8 flex flex-col items-center gap-4">
      <div
        className="w-full overflow-hidden rounded-xl"
        style={{ maxWidth: 640, aspectRatio: '16/9' }}
      >
        <Player
          ref={ref}
          template={introTemplate}
          width={640}
          height={360}
          playbackMode="loop"
          loadMode="eager"
          style={{ width: '100%', height: '100%' }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => (playing ? ref.current?.pause() : ref.current?.play())}
          className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => {
            ref.current?.seekToFrame(0)
            ref.current?.play()
          }}
          className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          Replay
        </button>
      </div>
    </div>
  )
}
