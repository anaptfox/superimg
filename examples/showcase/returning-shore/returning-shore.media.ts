import { video } from '@foxworth/superimg';
import { defineInteractive } from '@foxworth/superimg/interactive/define';
import { MATERIAL_FONTS } from '../_material/resources';
import { INITIAL_SHORE, sampleShore, observeShore, type ShoreData } from './model';
import { renderShore } from './render';
export { INITIAL_SHORE } from './model';
export const film = video<ShoreData>({
  size:{width:3840,height:2160},duration:'24s',fps:30,poster:'5s',fonts:MATERIAL_FONTS,
  audio:{id:'shore-score',src:'./assets/score.wav',role:'ambient',duration:'24s'},
  sample:{...INITIAL_SHORE,live:false},variants:{teaching:{teaching:true}},
  render(ctx){ctx.director({gather:'2.5s',hold:'3.5s',push:'2.5s',disturb:'3s',repair:'4s',pullback:'5s',rest:'3.5s'});return renderShore(sampleShore(ctx.data,{seconds:ctx.timeline.seconds}),{width:ctx.width,height:ctx.height,teaching:ctx.data.teaching});},
});
export const live=defineInteractive<ShoreData>({
  size:{width:3840,height:2160},sample:INITIAL_SHORE,
  guide:{id:'returning-shore',steps:[{id:'observe',label:'Observe the pigment',duration:'8s',scene:{state:'observe'}},{id:'disturb',label:'Expose the earlier shore',duration:'8s',scene:{state:'disturb'}},{id:'restore',label:'Watch it return',duration:'8s',scene:{state:'restore'}}]},
  render(ctx){const s=sampleShore(ctx.data,{seconds:ctx.timeline.seconds});ctx.scene.states({observe:{},disturb:{},restore:{}});ctx.scene.register({id:'shore-observation',role:'material',label:'Pigment state',metadata:observeShore(s)});return renderShore(s,{width:ctx.width,height:ctx.height,teaching:ctx.data.teaching});},
});
export default film;
