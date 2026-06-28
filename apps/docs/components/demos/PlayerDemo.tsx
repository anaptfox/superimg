'use client'

import { Player } from 'superimg/react'
import { introTemplate } from '@/content/templates/intro-demo'
import { getExampleById } from '@/lib/video/examples'
import { usePlaygroundExample } from '@/lib/playground/example'

interface PlayerDemoProps {
  templateId?: string
  duration?: number
}

export function PlayerDemo({ templateId, duration = 5 }: PlayerDemoProps) {
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

  return <CompiledPlayerDemo templateId={templateId} duration={duration} />
}

function CompiledPlayerDemo({ templateId, duration }: { templateId: string; duration: number }) {
  const example = getExampleById(templateId)
  const { template, assets, assetResolver } = usePlaygroundExample(example)

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
        <Player
          template={template ?? undefined}
          assets={assets}
          assetResolver={assetResolver}
          format="horizontal"
          duration={duration}
          playbackMode="loop"
          loadMode="eager"
          autoPlay
          controls
          className="w-full"
          style={{ aspectRatio: '16/9' }}
        />
      </div>
    </div>
  )
}