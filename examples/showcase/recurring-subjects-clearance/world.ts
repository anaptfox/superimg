import * as THREE from "three";
import type { NativeSurfaceModule } from "@foxworth/superimg";
import { DESIGN, type sampleMorning } from "./model";
import { SPOON_DESIGN, HANDLE_POINTS, HANDLE_TUBE } from "./spatial-data";
type Frame = ReturnType<typeof sampleMorning>;
export default {
  create({canvas,width,height,dpr}) {
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(dpr); renderer.setSize(width,height,false);
    const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(45,width/height,.1,1000);

const design = DESIGN;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
scene.background = new THREE.Color('#d6c7ae');
const noise = (x: number,y: number,seed=281) => { const n=Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453; return n-Math.floor(n); };
function texture(width: number,height: number,paint: (x: number, y: number) => number[]) {
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const context=canvas.getContext('2d'); if (!context) throw new Error('Canvas 2D context unavailable'); const pixels=context.createImageData(width,height);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const c=paint(x,y); const i=(y*width+x)*4;
    pixels.data[i]=c[0]; pixels.data[i+1]=c[1]; pixels.data[i+2]=c[2]; pixels.data[i+3]=c[3]??255;
  }
  context.putImageData(pixels,0,0);
  const map=new THREE.CanvasTexture(canvas); map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping; map.anisotropy=4; return map;
}
const wood=texture(1024,256,(x,y)=>{
  const vein=Math.sin(y*1.5+Math.sin(x*.008)*2+Math.sin(x*.023+y*.025)*1.3)*6;
  const fine=noise(x,y)*3; return [94+vein+fine,59+vein*.7+fine,34+vein*.4+fine];
}); wood.repeat.set(1.7,1.7);
const linen=texture(256,256,(x,y)=>{
  const n=noise(x,y)*8; const weave=(x%4===0||y%4===0)?-17:0; return [224+n+weave,213+n+weave,194+n+weave];
}); linen.repeat.set(7,7);
const plaster=texture(128,128,(x,y)=>{ const n=noise(Math.floor(x/4),Math.floor(y/4))*15; return [220+n,220+n,220+n]; });
const glazeMap=texture(256,256,(x,y)=>{ const n=noise(x,y); const grain=n>.987?95:230+n*20; return [grain,grain,grain]; });
const floor=new THREE.Mesh(new THREE.BoxGeometry(120,3,90),new THREE.MeshStandardMaterial({map:wood,bumpMap:wood,bumpScale:.08,roughness:.8,envMapIntensity:.12}));
floor.position.set(0,-1.5,-5); floor.receiveShadow=true; scene.add(floor);
const wall=new THREE.Mesh(new THREE.PlaneGeometry(150,80),new THREE.MeshStandardMaterial({color:'#d6c7ae',roughness:1,bumpMap:plaster,bumpScale:.09}));
wall.position.set(0,32,-40); wall.receiveShadow=true; scene.add(wall);
const wash=texture(256,256,(x,y)=>{
  const u=x/255,v=y/255;const edge=Math.min(u,1-u,v,1-v);const pane=(Math.abs(u-.5)<.018||Math.abs(v-.5)<.022)?0:1;
  return [255,236,201,Math.round(Math.min(1,edge*12)*pane*45)];
});
const windowWash=new THREE.Mesh(new THREE.PlaneGeometry(40,30),new THREE.MeshBasicMaterial({map:wash,transparent:true,depthWrite:false}));
windowWash.position.set(-14,20,-39.97);windowWash.rotation.z=-.12;scene.add(windowWash);
const napkin=new THREE.Group(); napkin.position.set(-6,.07,6); napkin.rotation.y=.14;
const cloth=new THREE.MeshStandardMaterial({map:linen,bumpMap:linen,bumpScale:.055,roughness:.96});
for(const p of [[16,.12,16,0,0],[15.7,.045,15.3,.15,.085]]) {
  const fold=new THREE.Mesh(new THREE.BoxGeometry(p[0],p[1],p[2]),cloth); fold.position.set(p[3],p[4],0); fold.receiveShadow=true; fold.castShadow=true; napkin.add(fold);
} scene.add(napkin);
const brass=new THREE.MeshStandardMaterial({color:SPOON_DESIGN.metal,metalness:1,roughness:.28});
const spoon=new THREE.Group();
const bowl=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),brass); bowl.scale.set(SPOON_DESIGN.bowl.x,SPOON_DESIGN.bowl.y,SPOON_DESIGN.bowl.z); spoon.add(bowl);
const stem=new THREE.Mesh(new THREE.CylinderGeometry(SPOON_DESIGN.stem.topRadius,SPOON_DESIGN.stem.bottomRadius,SPOON_DESIGN.stem.length,12),brass); stem.rotation.x=Math.PI/2; stem.position.z=SPOON_DESIGN.stem.centerZ; spoon.add(stem);
spoon.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;}); scene.add(spoon);
const key=new THREE.DirectionalLight('#ffd9a8',3.2); key.position.set(-35,32,18); key.castShadow=true;
Object.assign(key.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:150}); key.shadow.mapSize.set(2048,2048); key.shadow.bias=-.0004; key.shadow.normalBias=.025; key.shadow.radius=4;
scene.add(key); scene.add(key.target);
scene.add(new THREE.HemisphereLight('#c9d4dc','#6b4a2e',.7));
const kick=new THREE.SpotLight('#ffe9ce',1000,130,.6,1,1.4); kick.position.set(22,18,-24); kick.target.position.set(0,5,0); scene.add(kick,kick.target);
const gobo=new THREE.Group();
const invisible=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
for(const p of [[1.2,24,0,0],[18,1.2,0,0],[1.2,24,-9,0],[1.2,24,9,0],[18,1.2,0,12],[18,1.2,0,-12]]) {
  const bar=new THREE.Mesh(new THREE.BoxGeometry(p[0],p[1],.3),invisible);bar.position.set(p[2],p[3],0);bar.castShadow=true;gobo.add(bar);
} gobo.position.set(-16,20,15); gobo.lookAt(0,0,0); scene.add(gobo);
const environment=new THREE.Scene(); environment.background=new THREE.Color('#8e7962');
for(const p of [[-14,15,-14,5,12,12],[-12,12,14,4,14,8],[14,10,10,6,12,2],[0,24,0,30,1,1]]) {
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(p[3],p[4]),new THREE.MeshBasicMaterial({color:new THREE.Color('#fff2dc').multiplyScalar(p[5]),side:THREE.DoubleSide}));
  panel.position.set(p[0],p[1],p[2]); panel.lookAt(0,0,0); environment.add(panel);
}
const pmrem=new THREE.PMREMGenerator(renderer); const env=pmrem.fromScene(environment,.05); scene.environment=env.texture; pmrem.dispose();
environment.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();o.material.dispose();}});
const points=design.profile.map(p=>new THREE.Vector2(p.radius,p.y));
const bodyGeometry=new THREE.LatheGeometry(points,96);
const colors=[]; const position=bodyGeometry.attributes.position;
for(let i=0;i<position.count;i++) {
  const j=i%points.length; const y=position.getY(i); const x=position.getX(i),z=position.getZ(i); const theta=Math.atan2(z,x);
  const r=Math.hypot(x,z); const delta=j>3&&j<11 ? .025*Math.sin(y*7.5)+.03*Math.sin(theta*3) : 0;
  if(r>0){position.setX(i,x*(r+delta)/r);position.setZ(i,z*(r+delta)/r);}
  const c=new THREE.Color(j>=12?design.liner:design.glaze);
  if(j<12) {c.multiplyScalar(.78+.22*Math.min(1,y/8));c.lerp(new THREE.Color(design.lip),Math.max(0,(y-9.05)/.5)*.75);}
  colors.push(c.r,c.g,c.b);
}
bodyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));bodyGeometry.computeVertexNormals();
const bodyMaterial=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.23,clearcoat:1,clearcoatRoughness:.05,bumpMap:glazeMap,bumpScale:.018,envMapIntensity:1.1});
const handleMaterial=new THREE.MeshPhysicalMaterial({color:design.glaze,roughness:.23,clearcoat:1,clearcoatRoughness:.05,bumpMap:glazeMap,bumpScale:.018,envMapIntensity:1.1});
const handleCurve=new THREE.CatmullRomCurve3(HANDLE_POINTS.map(p=>new THREE.Vector3(p[0],p[1],0)));
const handleGeometry=new THREE.TubeGeometry(handleCurve,64,HANDLE_TUBE.radius,20,false);
for(let i=0;i<handleGeometry.attributes.position.count;i++){
  const p=handleGeometry.attributes.position; const t=Math.floor(i/21)/64;const center=handleCurve.getPointAt(t);const taper=1-HANDLE_TUBE.taper*Math.sin(Math.PI*t);
  p.setXYZ(i,center.x+(p.getX(i)-center.x)*HANDLE_TUBE.flatten*taper,center.y+(p.getY(i)-center.y)*HANDLE_TUBE.flatten*taper,p.getZ(i)*HANDLE_TUBE.depth*taper);
}handleGeometry.computeVertexNormals();
const footGeometry=new THREE.TorusGeometry(3.35,.15,12,80);footGeometry.rotateX(Math.PI/2);
const footMaterial=new THREE.MeshStandardMaterial({color:design.clay,roughness:.9,bumpMap:glazeMap,bumpScale:.04});
const coffeeMaterial=new THREE.MeshPhysicalMaterial({color:'#1f0f07',roughness:.07,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.3});
const coffeeGeometry=new THREE.CircleGeometry(1,96);coffeeGeometry.rotateX(-Math.PI/2);
const cremaMaterial=new THREE.MeshStandardMaterial({color:'#7a4a26',roughness:.38});
const shadowMap=texture(128,128,(x,y)=>{const r=Math.hypot(x-64,y-64)/64;return [26,14,6,Math.round(220*Math.exp(-Math.pow(r*1.8,4)))];});
const tideMap=texture(256,64,(x,y)=>{const v=y/63;const line=.5+.12*Math.sin(x*.1);return [140,106,74,Math.round(90*Math.exp(-Math.pow((v-line)/.2,2))*(.6+.4*noise(x,y)))];});
const steamMap=texture(128,256,(x,y)=>{
  const p=y/255;const center=64+18*Math.sin(p*8);const a=Math.exp(-Math.pow((x-center)/(9+9*p),2))*Math.pow(Math.sin(p*Math.PI),1.5)*160;
  return [239,228,209,Math.round(a)];
}); steamMap.wrapT=THREE.RepeatWrapping;
const ringMap=texture(256,256,(x,y)=>{const r=Math.hypot(x-128,y-128)/128;return [120,90,57,Math.round(75*Math.exp(-Math.pow((r-.79)/.025,2))*(.7+.3*noise(x,y)))];});
const ring=new THREE.Mesh(new THREE.PlaneGeometry(9,9),new THREE.MeshBasicMaterial({map:ringMap,transparent:true,opacity:0,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(-5.5,.2,6);scene.add(ring);
const mugs=[0,1].map((index) => {
  const group=new THREE.Group();
  const body=new THREE.Mesh(bodyGeometry,bodyMaterial),handle=new THREE.Mesh(handleGeometry,handleMaterial),foot=new THREE.Mesh(footGeometry,footMaterial);
  foot.position.y=.12;group.add(body,handle,foot);
  const liquid=new THREE.Mesh(coffeeGeometry,coffeeMaterial);group.add(liquid);
  const crema=new THREE.Mesh(new THREE.TorusGeometry(1,.016,8,96),cremaMaterial);crema.rotation.x=Math.PI/2;group.add(crema);
  const tide=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.6,.3,96,1,true),new THREE.MeshBasicMaterial({map:tideMap,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));tide.position.y=8.7;group.add(tide);
  const wisps: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]=[];
  for(let i=0;i<2;i++){const w=new THREE.Mesh(new THREE.PlaneGeometry(1.3,6),new THREE.MeshBasicMaterial({map:steamMap,transparent:true,opacity:.04,depthWrite:false,side:THREE.DoubleSide}));group.add(w);wisps.push(w);}
  group.traverse(o=>{if(o instanceof THREE.Mesh && !wisps.includes(o as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>)){o.castShadow=true;o.receiveShadow=true;}});
  scene.add(group);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(10.4,10.4),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.55}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const contact=new THREE.Mesh(new THREE.RingGeometry(2.9,3.65,80),new THREE.MeshBasicMaterial({color:'#291a0e',transparent:true,opacity:.3,depthWrite:false}));contact.rotation.x=-Math.PI/2;scene.add(contact);
  return {group,body,handle,foot,liquid,crema,tide,wisps,shadow,contact};
});

const evidenceCanvas = canvas as HTMLCanvasElement & { coffeeGeometryEvidence?: () => { id: string; min: number[]; max: number[] }[] };
evidenceCanvas.coffeeGeometryEvidence = () => {
  scene.updateMatrixWorld(true);
  const entries: [string, THREE.Object3D[]][] = [
    ...mugs.flatMap((m,i): [string, THREE.Object3D[]][] => [[i===0?'breakfast/body':'counter/body',[m.body,m.foot]],[i===0?'breakfast/handle':'counter/handle',[m.handle]]]),
    ['spoon/bowl',[bowl]], ['spoon/stem',[stem]],
  ];
  return entries.map(([id,objects]) => { const bounds=new THREE.Box3(); for(const object of objects) bounds.union(new THREE.Box3().setFromObject(object,true)); return {id,min:bounds.min.toArray(),max:bounds.max.toArray()}; });
};
return { sample({data:frame}) {
camera.fov=2*Math.atan(12/frame.camera.focal)*180/Math.PI;
camera.position.fromArray(frame.camera.position);camera.lookAt(new THREE.Vector3().fromArray(frame.camera.target));camera.updateProjectionMatrix();
key.position.fromArray(frame.later?[-28,22,26]:[-35,32,18]);key.color.set(frame.later?'#ffc68a':'#ffd9a8');key.intensity=frame.later?2.8:3.2;
ring.material.opacity=frame.ring;
spoon.position.fromArray(frame.spoon.data.performance.position);spoon.rotation.set(frame.spoon.data.performance.tilt,frame.spoon.data.performance.yaw,0);
for(let i=0;i<mugs.length;i++){
  const mug=mugs[i],sample=frame.mugs[i].data,p=sample.performance;
  mug.group.position.fromArray(p.position);mug.group.rotation.set(p.tilt*Math.PI/180,p.yaw*Math.PI/180,0);
  const radius=sample.state.fill>.9?3.57:3.66;
  mug.liquid.position.y=.85+sample.state.fill*7.85;mug.liquid.scale.set(radius,1,radius);mug.liquid.rotation.z=p.liquidTilt;
  mug.crema.position.y=mug.liquid.position.y+.012;mug.crema.scale.set(radius,radius,1);mug.tide.visible=sample.state.tide;
  mug.shadow.position.set(p.position[0],i===0?.205:.008,p.position[2]);mug.shadow.material.opacity=.55*(1-Math.min(1,Math.max(0,p.position[1]-.17)/3));
  mug.contact.position.copy(mug.shadow.position);mug.contact.position.y+=.002;mug.contact.material.opacity=.3*(1-Math.min(1,Math.max(0,p.position[1]-.17)/.8));
  for(let j=0;j<mug.wisps.length;j++){
    const w=mug.wisps[j];w.quaternion.copy(mug.group.quaternion).invert().multiply(camera.quaternion);
    w.material.opacity=.08*p.steam*(.8+.2*Math.sin(frame.seconds*1.2+j));w.position.set((j-.5)*1.4+.2*Math.sin(frame.seconds*.8+j),mug.liquid.position.y+3+j*.3,0);
  }
}

renderer.render(scene,camera);
}, dispose() {
  const seen=new Set<unknown>();
  scene.traverse(o=>{const m=o as THREE.Mesh; for(const r of [m.geometry,...(Array.isArray(m.material)?m.material:[m.material])]) { if(r&&!seen.has(r)){seen.add(r); for(const v of Object.values(r)) if((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose(); r.dispose();} }});
  delete evidenceCanvas.coffeeGeometryEvidence; env.dispose(); renderer.dispose(); renderer.forceContextLoss();
}};
  }
} satisfies NativeSurfaceModule<Frame>;
