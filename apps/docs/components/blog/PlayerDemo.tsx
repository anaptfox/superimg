'use client'

import { useRef, useEffect } from 'react'
import { Player } from 'superimg-react/player'
import { useVideoSession, VideoControls, VideoCanvas } from 'superimg-react'
import { introTemplate } from '@/content/blog/templates/intro-demo'
import { getExampleById } from '@/lib/video/examples'

interface PlayerDemoProps {
  /** Use a pre-defined template from EDITOR_EXAMPLES by id */
  templateId?: string
  /** Duration in seconds (default: 5) */
  duration?: number
}

/**
 * PlayerDemo renders a video template inline in blog posts.
 *
 * Without templateId: renders the intro-demo template (original behavior)
 * With templateId: compiles and renders the template from EDITOR_EXAMPLES
 */
export function PlayerDemo({ templateId, duration = 5 }: PlayerDemoProps) {
  // If no templateId, use the original intro template behavior
  if (!templateId) {
    return (
      <div className="not-prose my-8 flex flex-col items-center">
        <div
          className="w-full overflow-hidden rounded-xl"
          style={{ maxWidth: 640, aspectRatio: '16/9' }}
        >
          <Player
            template={introTemplate}
            format="horizontal"
            playbackMode="loop"
            loadMode="eager"
            controls
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    )
  }

  // Use useVideoSession to compile templates from EDITOR_EXAMPLES
  return <CompiledPlayerDemo templateId={templateId} duration={duration} />
}

function CompiledPlayerDemo({ templateId, duration }: { templateId: string; duration: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const example = getExampleById(templateId)

  const session = useVideoSession({
    containerRef,
    initialFormat: 'horizontal',
    duration,
  })

  useEffect(() => {
    if (example) {
      session.compile(example.code)
    }
  }, [example?.code])

  useEffect(() => {
    if (session.template && !session.isPlaying) {
      session.play()
    }
  }, [session.template])

  if (!example) {
    return (
      <div className="not-prose my-8 flex items-center justify-center rounded-xl bg-muted p-8 text-muted-foreground">
        Template &quot;{templateId}&quot; not found
      </div>
    )
  }

  return (
    <div className="not-prose my-8 flex flex-col items-center">
      <div
        className="w-full overflow-hidden rounded-xl bg-[#0d0d0d]"
        style={{ maxWidth: 640 }}
      >
        <div className="flex items-center justify-center p-4" style={{ aspectRatio: '16/9' }}>
          <div
            ref={containerRef}
            className="max-h-full max-w-full rounded shadow-lg"
            style={{ width: '100%', height: '100%', aspectRatio: '16/9' }}
          />
        </div>
        <div className="border-t border-border/50">
          <VideoControls store={session.store} showTime />
        </div>
      </div>
    </div>
  )
}
