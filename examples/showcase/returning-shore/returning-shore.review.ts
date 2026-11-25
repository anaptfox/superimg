import type { ReviewPlan } from '@foxworth/superimg';
import {INITIAL_SHORE,sampleShore,observeShore} from './model';
export default {schemaVersion:1,beats:[
 {id:'painting',label:'The coast holds',at:'5s'},
 {id:'macro',label:'Dry pigment relief',at:'8.3s',crop:{x:1100,y:700,width:1200,height:720}},
 {id:'disturbance',label:'Brush reveals the earlier shore',at:'10.5s',range:['9s','11s']},
 {id:'repair',label:'Analytic restoration',at:'13.5s',range:['12s','14s']},
 {id:'restored',label:'No residual brush displacement',at:'15.5s'},
 {id:'panel',label:'The older shore and panel edges',at:'23s'},
],observe:c=>observeShore(sampleShore({...INITIAL_SHORE,...c.data,live:false},{seconds:c.timelineSeconds})),checks:[
 {id:'count',label:'All pigment grains conserved',metric:'logicalCount',equals:18000},
 {id:'identity',label:'Every pigment identity appears exactly once',metric:'uniqueIds',equals:18000},
 {id:'expiry',label:'Only unexpired impulses enter the local index',metric:'unexpiredImpulseIndex',equals:true},
 {id:'finite',label:'Finite geometry',metric:'finite',equals:true},
 {id:'brush-bound',label:'Brush impulse bounded',metric:'maxDisplacement',max:45.000001},
 {id:'underpainting',label:'The brush crosses the earlier shore',beat:'disturbance',metric:'exposedShoreSegments',min:5},
 {id:'underpaint-area',label:'A locally exposed earlier land shape',beat:'disturbance',metric:'exposedUnderpaintArea',min:2000},
 {id:'return',label:'Four-second restoration complete',beat:'restored',metric:'restored',equals:true},
 {id:'new-framing',label:'Ending reveals the panel',beat:'panel',metric:'zoom',max:.87},
]} satisfies ReviewPlan;
