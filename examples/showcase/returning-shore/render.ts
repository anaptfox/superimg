import { Frame, Fill, Text, Vector, vector } from '@foxworth/superimg';
import { HOME, hash, ease, type ShoreSnapshot } from './model';
const BASE = ['#52796b', '#b68d48', '#d7b168', '#293f70', '#282b2a'];
function tone(hex: string, t: number) { const n = parseInt(hex.slice(1),16), f = .76 + t * .048; return `#${[n>>16,n>>8&255,n&255].map(c => Math.min(255,Math.round(c*f)).toString(16).padStart(2,'0')).join('')}`; }
const PAINT = BASE.flatMap(c => Array.from({length:8},(_,t)=>tone(c,t)));
const FACETS=HOME.map(g=>{const angle=hash(g.id,12)*Math.PI*2,c=Math.cos(angle),n=Math.sin(angle);return [[-.9,-.45],[.1,-.84],[.96,-.2],[.52,.75],[-.56,.66]].map(([px,py],i)=>{const rough=.76+hash(g.id,i+20)*.4;return [(px!*c-py!*n)*rough,(px!*n+py!*c)*rough] as const;});});
const fixed = (v: number) => v.toFixed(2);
// One projection cache: held live pigment does not rebuild 90,000 facet vertices.
// Coordinates, IDs and the complete sampled population remain unchanged.
let homePaint: { key: string; facets: Array<string | undefined>; shadows: Array<string | undefined> } | undefined;
export function renderShore(s: ShoreSnapshot, view: { width: number; height: number; teaching: boolean }) {
  const {width:w,height:h} = view, scale = Math.min(w/1280,h/720), z = scale * s.zoom;
  const project = (x:number,y:number) => [w/2+(x+s.panX)*z,h/2+(y+s.panY)*z] as const;
  const key = [w,h,z,s.panX,s.panY].join(':');
  if (homePaint?.key !== key) homePaint = { key, facets: new Array(HOME.length), shadows: new Array(HOME.length) };
  const cached = homePaint;
  const paths = Array.from({length:160},()=>[] as string[]), shadows: string[]=[];
  for (const g of s.grains) {
    if (s.fidelity === 'reduced' && !g.protected && g.id % 2) continue;
    const [x,y]=project(g.x,g.y), r=g.size*z;
    const home = HOME[g.id]!;
    const atHome = g.x === home.x && g.y === home.y && g.size === home.size;
    const facet=(atHome ? cached.facets[g.id] : undefined) ?? FACETS[g.id]!.map(([px,py],i)=>`${i?'L':'M'}${fixed(x+px*r)},${fixed(y+py*r)}`).join('')+'Z';
    if (atHome) cached.facets[g.id] = facet;
    const d=facet;
    const opacityBand = Math.min(3, Math.floor(g.exposed * 4));
    paths[(g.palette*8+g.tone)*4+opacityBand]!.push(d);
    if(g.id%3===0) {
      const shadow=(atHome ? cached.shadows[g.id] : undefined) ?? `M${fixed(x-r*.55)},${fixed(y+r*.55)}l${fixed(r*1.4)},${fixed(-r*.13)}l${fixed(r*.2)},${fixed(r*.42)}Z`;
      if(atHome) cached.shadows[g.id]=shadow;
      shadows.push(shadow);
    }
  }
  const [panelX,panelY]=project(-540,-270);
  const exposed=s.underpaint.flatMap((p,i)=>{const next=s.underpaint[i+1];if(!next||Math.max(p.exposure,next.exposure)<.25)return[];const [x,y]=project(p.x,p.y),[x2,y2]=project(next.x,next.y);return [`M${fixed(x)},${fixed(y)}L${fixed(x2)},${fixed(y2)}`];}).join('');
  const revealMask = s.revealImpulses.flatMap((p,i) => {
    const [x,y]=project(p.x,p.y);
    return [[1.2,.25],[1.05,.5],[.85,1]].map(([radius,opacity],band)=>{
      const r=p.radius*radius!*z;
      return vector.path({id:`reveal-impulse-${i}-${band}`,d:`M${fixed(x-r)},${fixed(y)}a${fixed(r)},${fixed(r)} 0 1 0 ${fixed(r*2)},0a${fixed(r)},${fixed(r)} 0 1 0 ${fixed(-r*2)},0Z`,fill:'white',opacity:opacity!*(1-ease(p.age/4))});
    });
  });
  const hatches = s.underpaint.filter((p,i)=>i%4===0&&p.exposure>.3).map(p=>{
    const [x,y]=project(p.x,p.y-14);return `M${fixed(x-5*z)},${fixed(y-5*z)}l${fixed(10*z)},${fixed(10*z)}`;
  }).join('');
  const oldCoast = s.underpaint.map((p,i)=>{const [x,y]=project(p.x,p.y);return `${i?'L':'M'}${fixed(x)},${fixed(y)}`;}).join('')+(()=>{const [rx,ry]=project(525,-244),[lx,ly]=project(-525,-244);return `L${fixed(rx)},${fixed(ry)}L${fixed(lx)},${fixed(ly)}Z`;})();
  const outerLine=Array.from({length:110},(_,i)=>{const x=-525+i*1050/109,[px,py]=project(x,-246+15*Math.sin(x/145));return `${i?'L':'M'}${fixed(px)},${fixed(py)}`;}).join('');
  const {filmSeconds:t}=s;
  const caption=t<6?'Dry pigment holds a coastline.':t<8.5?'Raking light reveals the pigment relief.':t<11.5?'A brush exposes an older shore.':t<15.5?'The pigment remembers its home.': 'A larger history surrounds the painting.';
  return Frame({id:'returning-shore-stage',width:w,height:h},
    Fill({id:'plaster-ground',color:'#cbc0a5'}),
    Fill({id:'raking-light',gradient:{kind:'linear',angle:'to bottom right',stops:['#efe7d4 0%','#d6c9ac 60%','#a89c81 100%']}}),
    Frame({id:'panel-shadow',x:panelX+10*scale,y:panelY+12*scale,width:1080*z,height:540*z,style:{opacity:.2}},Fill({id:'shadow-paint',color:'#6e634a'})),
    Frame({id:'plaster-panel',x:panelX,y:panelY,width:1080*z,height:540*z},Fill({id:'plaster-paint',color:'#e5dcc5'})),
    Vector({id:'pigment-surface',width:w,height:h,viewBox:{x:0,y:0,width:w,height:h}},
      ...(revealMask.length ? [vector.defs(vector.mask({id:'shore-brush-exposure',mode:'alpha'},...revealMask))] : []),
      vector.path({id:'earlier-shoreline',d:oldCoast,fill:'#9a5e45',stroke:'#9a5e45',strokeWidth:1.6*z,opacity:.035}),
      ...(revealMask.length ? [vector.group({id:'exposed-underpainting',mask:'shore-brush-exposure'},
        vector.path({id:'underpaint-earth-wash',d:oldCoast,fill:'#9a5e45',opacity:.35}),
        ...(hatches?[vector.path({id:'earlier-coast-hatching',d:hatches,fill:'none',stroke:'#74472f',strokeWidth:1*z,opacity:.55})]:[]),
        ...(exposed?[vector.path({id:'revealed-earlier-shore',d:exposed,fill:'none',stroke:'#8c4f36',strokeWidth:2.2*z,opacity:.85})]:[]),
      )] : []),
      vector.path({id:'older-outer-shore',d:outerLine,fill:'none',stroke:'#8c4f36',strokeWidth:1.1*z,opacity:.45}),
      ...paths.flatMap((p,i)=>p.length?[vector.path({id:`pigment-${i}`,d:p.join(''),fill:PAINT[Math.floor(i/4)]!,opacity:[.96,.92,.86,.8][i%4]!})]:[]),
      ...(shadows.length?[vector.path({id:'pigment-relief',d:shadows.join(''),fill:'#171f28',opacity:.18})]:[]),
    ),
    Frame({id:'title',x:w*.085,y:h*.075,width:w*.62,height:42*scale,style:{opacity:1-ease((t-2.5)/.5)+ease((t-20.5)/1)}},Text({id:'title-ink',size:24*scale,fontFamily:'Inter',weight:500,color:'#292b28',letterSpacing:-.4*scale},'Pentimento — The Returning Shore')),
    Frame({id:'subtitle',x:w*.085,y:h*.13,width:w*.65,height:24*scale,style:{opacity:1-ease((t-2.5)/.5)+ease((t-20.5)/1)}},Text({id:'subtitle-ink',size:10*scale,fontFamily:'Inter',weight:400,color:'#625d50',letterSpacing:1.5*scale},'PIGMENT / PLASTER / MEMORY')),
    ...(view.teaching?[Frame({id:'teaching-caption',x:w*.085,y:h*.86,width:w*.82,height:35*scale},Fill({id:'caption-paper',color:'#e5dcc5',style:{opacity:.92}}),Frame({id:'caption-inset',x:10*scale,y:5*scale,width:w*.8,height:25*scale},Text({id:'caption-ink',size:18*scale,fontFamily:'Inter',weight:500,color:'#292b28'},caption)))]:[]),
  );
}
