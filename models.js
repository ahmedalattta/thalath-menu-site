// Thalath — procedural 3D models (real-world scale, metres). Built in the browser, exported to GLB for <model-viewer>.
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const TAU=Math.PI*2, rnd=(a,b)=>a+Math.random()*(b-a);
let seed=7;const srnd=(a,b)=>{seed=(seed*16807)%2147483647;return a+(seed/2147483647)*(b-a)};

/* ---------- textures ---------- */
function cv(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
function speckle(g,w,h,n,cols,rmax,a0=.05,a1=.25){for(let i=0;i<n;i++){g.fillStyle=cols[i%cols.length];g.globalAlpha=srnd(a0,a1);g.beginPath();g.arc(srnd(0,w),srnd(0,h),srnd(.5,rmax),0,TAU);g.fill()}g.globalAlpha=1}
const cremaTex=()=>cv(512,512,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,10,w/2,w/2,w/2);
  r.addColorStop(0,'#c98a4b');r.addColorStop(.55,'#a8652c');r.addColorStop(.9,'#6a3818');r.addColorStop(1,'#3f200c');g.fillStyle=r;g.fillRect(0,0,w,w);
  speckle(g,w,w,1400,['#e8b77c','#4a240d','#d9a066'],2.4)});
function heart(g,cx,cy,s){g.beginPath();g.moveTo(cx,cy+s*.95);g.bezierCurveTo(cx-s*1.25,cy+s*.15,cx-s*.85,cy-s*.95,cx,cy-s*.35);g.bezierCurveTo(cx+s*.85,cy-s*.95,cx+s*1.25,cy+s*.15,cx,cy+s*.95);g.closePath()}
const latteTex=()=>cv(512,512,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,20,w/2,w/2,w/2);
  r.addColorStop(0,'#8e5428');r.addColorStop(.7,'#6e3c1a');r.addColorStop(1,'#43230e');g.fillStyle=r;g.fillRect(0,0,w,w);speckle(g,w,w,600,['#b07a48','#4a260f'],2);
  const r2=g.createRadialGradient(w/2,w/2+10,10,w/2,w/2,170);r2.addColorStop(0,'#fffaf2');r2.addColorStop(.8,'#f3e4cf');r2.addColorStop(1,'#d9b993');
  g.save();g.shadowColor='rgba(70,35,12,.5)';g.shadowBlur=12;heart(g,w/2,w/2+18,150);g.fillStyle=r2;g.fill();g.restore()});
// vertical drink texture: stops top(0)→bottom(1)
function drinkTex(stops,fx,W=256,H=1024){return cv(W,H,(g,w,h)=>{const l=g.createLinearGradient(0,0,0,h);stops.forEach(s=>l.addColorStop(s[0],s[1]));g.fillStyle=l;g.fillRect(0,0,w,h);if(fx)fx(g,w,h)})}
const strawTex=()=>cv(64,512,(g,w,h)=>{g.fillStyle='#efe6d6';g.fillRect(0,0,w,h);g.fillStyle='#d6614b';for(let y=-h;y<h*2;y+=48){g.beginPath();g.moveTo(0,y);g.lineTo(w,y+40);g.lineTo(w,y+62);g.lineTo(0,y+22);g.fill()}});
const limeTex=()=>cv(256,256,(g,w)=>{const c=w/2;g.fillStyle='#4f8a2b';g.beginPath();g.arc(c,c,c,0,TAU);g.fill();g.fillStyle='#e9f0c8';g.beginPath();g.arc(c,c,c*.88,0,TAU);g.fill();
  for(let i=0;i<10;i++){const a0=i/10*TAU+.04,a1=(i+1)/10*TAU-.04;g.beginPath();g.moveTo(c,c);g.arc(c,c,c*.8,a0,a1);g.closePath();g.fillStyle='#b9d85a';g.fill()}});
const spongeTex=(base,dots)=>{/*diffuse*/const t=cv(256,256,(g,w)=>{g.fillStyle=base;g.fillRect(0,0,w,w);speckle(g,w,w,2200,dots,2.2)});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(30,30);return t};


/* ---------- surface detail: height canvas -> normal map ---------- */
function normalFrom(w,h,drawHeight,strength=2,repeat=null){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#808080';g.fillRect(0,0,w,h);drawHeight(g,w,h);
  const src=g.getImageData(0,0,w,h).data,out=g.createImageData(w,h),o=out.data,H=(x,y)=>src[(((y+h)%h)*w+((x+w)%w))*4]/255;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(H(x+1,y)-H(x-1,y))*strength,dy=(H(x,y+1)-H(x,y-1))*strength;const nz=1/Math.sqrt(dx*dx+dy*dy+1),i=(y*w+x)*4;
    o[i]=(-dx*nz*.5+.5)*255;o[i+1]=(dy*nz*.5+.5)*255;o[i+2]=(nz*.5+.5)*255;o[i+3]=255}
  g.putImageData(out,0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.NoColorSpace;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat)}return t}
function greyTex(w,h,draw){const t=cv(w,h,draw);t.colorSpace=THREE.NoColorSpace;return t}
// condensation: fog + droplets (height for normal, matching roughness map)
function dropletLayout(n,w,h){const d=[];for(let i=0;i<n;i++){const r=srnd(1.5,7)*(Math.random()<.08?2.2:1);d.push([srnd(0,w),srnd(h*.12,h),r,srnd(1,1.6)])}return d}
function condensation(){const W=1024,H=512,drops=dropletLayout(900,W,H);
  const nrm=normalFrom(W,H,(g)=>{drops.forEach(([x,y,r,e])=>{const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'#ffffff');gr.addColorStop(.7,'#c8c8c8');gr.addColorStop(1,'#808080');g.fillStyle=gr;g.beginPath();g.ellipse(x,y,r,r*e,0,0,TAU);g.fill()})},3.2);
  const rough=greyTex(W,H,(g)=>{const l=g.createLinearGradient(0,0,0,H);l.addColorStop(0,'#0a0a0a');l.addColorStop(.12,'#161616');l.addColorStop(1,'#1c1c1c');g.fillStyle=l;g.fillRect(0,0,W,H);
    g.fillStyle='#060606';drops.forEach(([x,y,r,e])=>{g.beginPath();g.ellipse(x,y,r*1.1,r*e*1.1,0,0,TAU);g.fill()})});
  return {nrm,rough}}
const coldGlass=()=>{const {nrm,rough}=condensation();return new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:1,roughnessMap:rough,metalness:0,transmission:1,thickness:.004,ior:1.5,
  normalMap:nrm,normalScale:new THREE.Vector2(.55,.55),specularIntensity:1,side:THREE.DoubleSide})};
const spongeNormal=()=>normalFrom(256,256,(g,w,h)=>{for(let i=0;i<900;i++){const r=srnd(1,4.5),x=srnd(0,w),y=srnd(0,h);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'#202020');gr.addColorStop(1,'#808080');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill()}},4,30);
const foamNormal=()=>normalFrom(256,256,(g,w,h)=>{for(let i=0;i<1400;i++){const r=srnd(.6,2.2),x=srnd(0,w),y=srnd(0,h);g.fillStyle=Math.random()<.5?'#9a9a9a':'#6a6a6a';g.beginPath();g.arc(x,y,r,0,TAU);g.fill()}},1.6,6);

/* ---------- materials ---------- */
const ceramic=()=>new THREE.MeshPhysicalMaterial({color:0xf3f0eb,roughness:.22,clearcoat:1,clearcoatRoughness:.12,side:THREE.DoubleSide});
const glass=()=>new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.02,transmission:1,thickness:.004,ior:1.5,specularIntensity:1,side:THREE.DoubleSide});
const plastic=()=>{const {nrm,rough}=condensation();return new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.8,roughnessMap:rough,transmission:1,thickness:.0008,ior:1.45,normalMap:nrm,normalScale:new THREE.Vector2(.7,.7),specularIntensity:1,side:THREE.DoubleSide})};
const ice=()=>new THREE.MeshPhysicalMaterial({color:0xf4fbff,roughness:.08,transmission:1,thickness:.018,ior:1.31,specularIntensity:1,normalMap:foamNormal(),normalScale:new THREE.Vector2(.35,.35)});
function iceGeo(s){const g=new RoundedBoxGeometry(s*srnd(.85,1.1),s*srnd(.8,1.05),s*srnd(.85,1.1),4,s*.22);const p=g.attributes.position,v=new THREE.Vector3();const a=srnd(0,9),b=srnd(0,9);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const k=1+.06*Math.sin(v.x*260+a)*Math.cos(v.y*240+b)+.04*Math.sin(v.z*300+a*b);p.setXYZ(i,v.x*k,v.y*k,v.z*k)}g.computeVertexNormals();return g}

/* ---------- helpers ---------- */
const lathe=(pts,mat,seg=80)=>new THREE.Mesh(new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg),mat);
const cup=({rb,rt,h,t=.0028})=>lathe([[0,0],[rb*.82,0],[rb,.004],[rt,h],[rt-t*.5,h+.0012],[rt-t,h],[rb-t*.6,.006+t],[0,.006+t]],ceramic());
const innerR=(rb,rt,h,t,y)=>(rb-t*.6)+(rt-t-(rb-t*.6))*((y-.006)/(h-.006));
function handle(rt,rb,h,size){const m=new THREE.Mesh(new THREE.TorusGeometry(size,size*.26,20,48,Math.PI*1.15),ceramic());m.rotation.z=-Math.PI*.575;m.position.set((rt+rb)/2+size*.15,h*.55,0);return m}
const saucer=R=>lathe([[0,0],[R*.45,0],[R*.48,.002],[R,.011],[R+.002,.0135],[R-.003,.0138],[R*.5,.0055],[0,.0055]],ceramic());
function sleeve(rb,rt,h,y0,y1,off=.0003){const r0=rb+(rt-rb)*(y0/h)+off,r1=rb+(rt-rb)*(y1/h)+off;const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,y1-y0,96,1,true),coldGlass());m.position.y=(y0+y1)/2;return m}
const tumbler=({rb,rt,h,t=.0012,base=.007,cold=true})=>{const g=new THREE.Group(),rAt=y=>rb+(rt-rb)*(y/h);
  g.add(lathe([[0,0],[rb-.003,0],[rb-.0035,.0015],[rb,.0015],[rb+.0002,base],[rt,h-.004],[rt+.0022,h-.0025],[rt+.0024,h],[rt+.0005,h+.0008],[rt-.0006,h-.003],[rb-.0006,base],[0,base]],cold?glass():pet(),128));
  const tx=TEX['wrap_clear.png'];if(tx){const y0=h*.2,y1=h*.88;const pr=new THREE.Mesh(new THREE.CylinderGeometry(rAt(y1)+.0012,rAt(y0)+.0012,y1-y0,128,1,true),
    new THREE.MeshPhysicalMaterial({map:tx,alphaTest:.35,roughness:.5,side:THREE.DoubleSide}));pr.position.y=(y0+y1)/2;g.add(pr)}
  if(cold)g.add(sleeve(rb,rt,h,.004,h*.95,.0007));return g};
const C12={rb:.0342,rt:.0475,h:.111},C16={rb:.0355,rt:.0475,h:.132};
function liquid(rb,rt,h,y0,tex,topColor,extra={}){const side=new THREE.MeshPhysicalMaterial({map:tex,roughness:.22,clearcoat:.3,...extra});
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,72,1,false),[side,new THREE.MeshPhysicalMaterial({color:topColor,roughness:.15,...extra}),new THREE.MeshPhysicalMaterial({color:0x222222})]);m.position.y=y0+h/2;return m}
function cubes(g,n,y,r,s){for(let i=0;i<n;i++){const c=new THREE.Mesh(iceGeo(s),ice());
  const a=i/n*TAU+srnd(-.3,.3),d=r*srnd(.2,.6);c.position.set(Math.cos(a)*d,y+srnd(-s*.5,s*.4)+(i%3)*s*.22,Math.sin(a)*d);c.rotation.set(srnd(0,TAU),srnd(0,TAU),srnd(0,TAU));g.add(c)}}
function straw(g,h,x,z,tilt){const m=new THREE.Mesh(new THREE.CylinderGeometry(.0034,.0034,h,24,1,true),new THREE.MeshPhysicalMaterial({map:strawTex(),roughness:.7,side:THREE.DoubleSide}));
  m.position.set(x,h/2+.01,z);m.rotation.z=tilt;m.rotation.x=tilt*.4;g.add(m)}
const radAt=(rb,rt,h,y)=>rb+(rt-rb)*(y/h);

function icedCup(stops,top,extra={},o={}){const g=new THREE.Group(),{rb,rt,h}=C12,t=.0012,base=.007;g.add(tumbler({rb,rt,h,t,base}));const lh=o.lh||.09,lt=radAt(rb,rt,h,base+lh)-t-.0006;
  g.add(liquid(rb-t-.0006,lt,lh,base,drinkTex(stops),top,extra));
  if(o.foam){const f=new THREE.Mesh(new THREE.CircleGeometry(lt,72),new THREE.MeshPhysicalMaterial({color:0xd2ab80,roughness:.6,sheen:.5,sheenColor:0xffffff,normalMap:foamNormal(),normalScale:new THREE.Vector2(.5,.5)}));f.rotation.x=-Math.PI/2;f.position.y=base+lh+.0004;g.add(f)}
  cubes(g,o.ice||6,base+lh+.002,lt,.021);straw(g,.18,.012,-.006,-.16);return g}
/* logo decal: wraps the Thalath wordmark around a cup */
function logoDecal(logoImg,rb,rt,h,yC,height,color){const ar=logoImg.width/logoImg.height,wd=height*ar,r=radAt(rb,rt,h,yC)+.0009;
  const theta=wd/r;const tex=cv(1024,Math.round(1024/ar),(g,w,hh)=>{g.drawImage(logoImg,0,0,w,hh);g.globalCompositeOperation='source-in';g.fillStyle=color;g.fillRect(0,0,w,hh)});
  const y0=yC-height/2,y1=yC+height/2;
  const geo=new THREE.CylinderGeometry(radAt(rb,rt,h,y1)+.0009,radAt(rb,rt,h,y0)+.0009,height,48,1,true,-theta/2,theta);
  const m=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({map:tex,transparent:true,alphaTest:.35,roughness:.45,side:THREE.FrontSide}));m.position.y=yC;
  // CylinderGeometry UVs run left→right around +theta; flip so the word reads correctly from the front (+z)
  return m}

/* ---------- dishes ---------- */
export const BUILD={
 espresso(){const g=new THREE.Group(),rb=.022,rt=.031,h=.056,t=.0028;g.add(saucer(.062));const c=cup({rb,rt,h,t});c.position.y=.006;g.add(c);
  const hd=handle(rt,rb,h,.011);hd.position.y+=.006;g.add(hd);const fy=h*.8,s=new THREE.Mesh(new THREE.CircleGeometry(innerR(rb,rt,h,t,fy),64),new THREE.MeshPhysicalMaterial({map:cremaTex(),roughness:.3,clearcoat:.6,normalMap:foamNormal(),normalScale:new THREE.Vector2(.3,.3)}));
  s.rotation.x=-Math.PI/2;s.position.y=.006+fy;g.add(s);return g},
 latte(){const g=new THREE.Group(),rb=.03,rt=.047,h=.072,t=.003;g.add(saucer(.078));const c=cup({rb,rt,h,t});c.position.y=.006;g.add(c);
  const hd=handle(rt,rb,h,.014);hd.position.y+=.006;g.add(hd);const fy=h*.9,s=new THREE.Mesh(new THREE.CircleGeometry(innerR(rb,rt,h,t,fy),72),new THREE.MeshPhysicalMaterial({map:latteTex(),roughness:.42,sheen:.6,sheenColor:0xffffff,normalMap:foamNormal(),normalScale:new THREE.Vector2(.25,.25)}));
  s.rotation.x=-Math.PI/2;s.rotation.z=Math.PI/2;s.position.y=.006+fy;g.add(s);return g},
 icedLatte(){const g=new THREE.Group(),rb=.0342,rt=.0475,h=.111,t=.0012,base=.007;g.add(tumbler({rb,rt,h,t,base}));const lh=.09,lt=radAt(rb,rt,h,base+lh)-t-.0006;
  g.add(liquid(rb-t-.0006,lt,lh,base,drinkTex([[0,'#6a3a1c'],[.2,'#9a6438'],[.42,'#d4ad85'],[.62,'#ece0cf'],[1,'#f1e7d8']],(gg,w,hh)=>{gg.globalAlpha=.3;for(let i=0;i<40;i++){gg.strokeStyle=i%2?'#7a4524':'#b07a48';gg.lineWidth=srnd(3,12);gg.beginPath();let x=srnd(0,w),y=srnd(hh*.1,hh*.45);gg.moveTo(x,y);for(let k=0;k<5;k++){x+=srnd(-50,50);y+=srnd(10,70);gg.lineTo(x,y)}gg.stroke()}gg.globalAlpha=1}),0x8a5530));
  cubes(g,6,base+lh+.002,lt,.021);straw(g,.18,.012,-.006,-.16);return g},
/* iced coffee family: same 12oz Thalath tumbler, liquid colour per drink (0 = top of the drink) */
 icedAmericano(){return icedCup([[0,'#2b160c'],[.5,'#3a1f11'],[1,'#47281a']],0x341c0f,{roughness:.1,clearcoat:.6})},
 icedSpanishLatte(){return icedCup([[0,'#6a3a1c'],[.16,'#9a6438'],[.36,'#d6b088'],[.62,'#ecdcc4'],[.8,'#e8cfa2'],[1,'#ddb97f']],0x8a5530)},
 icedDrip(){return icedCup([[0,'#4a2612'],[.6,'#5c3118'],[1,'#6b3a1b']],0x452311,{roughness:.1,clearcoat:.6})},
 icedV60(){return icedCup([[0,'#6e3b19'],[.6,'#83491f'],[1,'#935427']],0x6a3818,{roughness:.1,clearcoat:.6})},
 freddo(){return icedCup([[0,'#cfa679'],[.13,'#bf9062'],[.2,'#5a3018'],[.55,'#43230f'],[1,'#36190a']],0xc89d70,{},{lh:.09,ice:5,foam:true})},
 matchaStrawberry(){const g=new THREE.Group(),rb=.0355,rt=.0475,h=.132,t=.0012,base=.007;g.add(tumbler({rb,rt,h,t,base}));const lh=.108,lt=radAt(rb,rt,h,base+lh)-t-.0006;
  g.add(liquid(rb-t-.0006,lt,lh,base,drinkTex([[0,'#6f9a3c'],[.24,'#88ad52'],[.36,'#cfdcae'],[.48,'#f2eee3'],[.64,'#f1e5dc'],[.74,'#ef9aa6'],[.86,'#de6578'],[1,'#c63f57']]),0x86ad4f));
  cubes(g,6,base+lh+.002,lt,.02);straw(g,.19,-.01,.008,.17);return g},
 strawberryMojito(){const g=new THREE.Group(),rb=.0355,rt=.0475,h=.132,t=.0012,base=.007;g.add(tumbler({rb,rt,h,t,base}));const lh=.112,lt=radAt(rb,rt,h,base+lh)-t-.0006;
  g.add(liquid(rb-t-.0006,lt,lh,base,drinkTex([[0,'#f6b3b8'],[.45,'#ee8792'],[1,'#d9566a']],(gg,w,hh)=>{for(let i=0;i<60;i++){gg.fillStyle='rgba(255,255,255,'+srnd(.15,.4)+')';gg.beginPath();gg.arc(srnd(0,w),srnd(0,hh),srnd(1.5,4),0,TAU);gg.fill()}}),0xf29aa4,{roughness:.12,clearcoat:.5}));
  // strawberry halves
  for(let i=0;i<5;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.009,24,16,0,Math.PI),new THREE.MeshPhysicalMaterial({color:0xd8283f,roughness:.35,clearcoat:.6,side:THREE.DoubleSide}));
   s.scale.set(1,1.3,1);const a=srnd(0,TAU),d=srnd(.004,.022);s.position.set(Math.cos(a)*d,base+lh+srnd(-.002,.004),Math.sin(a)*d);s.rotation.set(srnd(0,TAU),srnd(0,TAU),0);g.add(s)}
  // mint
  const sh=new THREE.Shape();sh.moveTo(0,0);sh.quadraticCurveTo(.011,.012,0,.03);sh.quadraticCurveTo(-.011,.012,0,0);const lg=new THREE.ShapeGeometry(sh,12);
  for(let i=0;i<12;i++){const m=new THREE.Mesh(lg,new THREE.MeshPhysicalMaterial({color:new THREE.Color().setHSL(.3,.5,srnd(.24,.34)),roughness:.45,side:THREE.DoubleSide}));
   const a=srnd(0,TAU),d=lt*srnd(0,.7);m.position.set(Math.cos(a)*d,base+lh*srnd(.97,1.08),Math.sin(a)*d);m.rotation.set(srnd(-1.2,1.2),srnd(0,TAU),srnd(-1,1));g.add(m)}
  cubes(g,7,base+lh-.01,lt,.02);
  const lw=new THREE.Mesh(new THREE.CylinderGeometry(.021,.021,.005,48),[new THREE.MeshPhysicalMaterial({color:0x4f8a2b}),new THREE.MeshPhysicalMaterial({map:limeTex()}),new THREE.MeshPhysicalMaterial({map:limeTex()})]);
  lw.rotation.z=Math.PI/2;lw.rotation.y=.4;lw.position.set(-(rt-.004),h-.004,.004);g.add(lw);straw(g,.2,.012,.01,-.14);return g},
 carrotCake(){const g=new THREE.Group();g.add(lathe([[0,0],[.06,0],[.062,.002],[.095,.008],[.097,.0105],[.093,.0108],[.06,.0045],[0,.0045]],ceramic()));
  const R=.085,a=.62,cake=new THREE.Group();let y=.0046;
  const sponge=new THREE.MeshPhysicalMaterial({map:spongeTex('#b4692e',['#d98a45','#7a3f17','#e3a55c']),normalMap:spongeNormal(),normalScale:new THREE.Vector2(1.2,1.2),roughness:.9}),frost=new THREE.MeshPhysicalMaterial({color:0xf5efe4,roughness:.55,sheen:.3,normalMap:foamNormal(),normalScale:new THREE.Vector2(.5,.5)});
  function wedge(r,hh,mat){const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(r,0);s.absarc(0,0,r,0,a,false);s.lineTo(0,0);
   const geo=new THREE.ExtrudeGeometry(s,{depth:hh,bevelEnabled:true,bevelThickness:.0007,bevelSize:.0007,bevelSegments:2,curveSegments:32});geo.rotateX(-Math.PI/2);return new THREE.Mesh(geo,mat)}
  for(let i=0;i<3;i++){const s=wedge(R,.017,sponge);s.position.y=y;cake.add(s);y+=.017;const f=wedge(R*1.002,i<2?.004:.006,frost);f.position.y=y;cake.add(f);y+=i<2?.004:.006}
  // carrot shreds on top
  for(let i=0;i<34;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(srnd(.006,.013),.0012,.0013),new THREE.MeshPhysicalMaterial({color:new THREE.Color().setHSL(.07,.85,srnd(.48,.58)),roughness:.5}));
   const rr=srnd(.03,.075),aa=srnd(.1,a-.1);m.position.set(Math.cos(aa)*rr,y+.0008,-Math.sin(aa)*rr);m.rotation.y=srnd(0,TAU);cake.add(m)}
  cake.position.set(-Math.cos(a/2)*R*.48,0,Math.sin(a/2)*R*.48);cake.rotation.y=.9;g.add(cake);return g}
};

/* Caramel Chapter — clear cup, dark base, milky body with caramel drips, caramel coffee top, ice, Thalath logo */
BUILD.caramelChapter=async function(){const g=new THREE.Group(),rb=.0355,rt=.0475,h=.132,t=.0006,base=.007;g.add(tumbler({rb,rt,h,base}));
  const lh=.112,lt=radAt(rb,rt,h,base+lh)-t-.0007;
  const tex=drinkTex([[0,'#8f5222'],[.1,'#a8672f'],[.18,'#d6ad84'],[.5,'#e0c29d'],[.66,'#d3ae86'],[.72,'#3a2214'],[.78,'#1d110b'],[1,'#140b07']],(gg,w,hh)=>{
    // caramel drips running down from the top
    for(let i=0;i<34;i++){const x=srnd(0,w),len=srnd(hh*.25,hh*.68),wd=srnd(10,26);
     gg.fillStyle='rgba(160,88,30,'+srnd(.75,.95)+')';gg.beginPath();gg.moveTo(x-wd/2,0);gg.bezierCurveTo(x-wd/2+srnd(-8,8),len*.4,x-wd/2+srnd(-8,8),len*.8,x-wd*.35,len);gg.arc(x,len,wd*.38,Math.PI,0,true);gg.bezierCurveTo(x+wd/2+srnd(-8,8),len*.8,x+wd/2+srnd(-8,8),len*.4,x+wd/2,0);gg.fill()}
    // dark specks in the milky layer
    for(let i=0;i<120;i++){gg.fillStyle='rgba(55,30,16,'+srnd(.55,.9)+')';gg.beginPath();gg.ellipse(srnd(0,w),srnd(hh*.2,hh*.68),srnd(4,8),srnd(5,10),srnd(0,3),0,TAU);gg.fill()}
    // wavy boundary into the dark base
    gg.fillStyle='#24150d';gg.beginPath();gg.moveTo(0,hh*.74);for(let x=0;x<=w;x+=8)gg.lineTo(x,hh*.72+Math.sin(x*.04)*7+srnd(-3,3));gg.lineTo(w,hh);gg.lineTo(0,hh);gg.fill()},1024,512);
  g.add(liquid(rb-t-.0007,lt,lh,base,tex,0x9b5c27,{roughness:.25,clearcoat:.4}));
  cubes(g,7,base+lh+.002,lt,.022);
  return g};


/* ---------- more dishes (shapes follow the product photos in the menu file) ---------- */
function ribbedGlass(rb,rt,h,base){ // ribbed tumbler like the shake / mojito photos
  const geo=new THREE.CylinderGeometry(rt,rb,h,96,8,true);const p=geo.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const a=Math.atan2(v.x,v.z),y=(v.y+h/2)/h;const k=1+0.035*Math.max(0,Math.sin(a*28))*(y<.85?1:0);p.setXYZ(i,v.x*k,v.y,v.z*k)}
  geo.computeVertexNormals();const m=new THREE.Mesh(geo,glass());m.position.y=h/2;const g=new THREE.Group();g.add(m);g.add(sleeve(rb,rt,h,.004,h*.8,.0016));
  const b=new THREE.Mesh(new THREE.CylinderGeometry(rb-.001,rb,base,64),glass());b.position.y=base/2;g.add(b);return g}
function fruitWheel(r,rind,flesh,seg){return new THREE.Mesh(new THREE.CylinderGeometry(r,r,.005,48),[new THREE.MeshPhysicalMaterial({color:rind}),
  new THREE.MeshPhysicalMaterial({map:cv(256,256,(g,w)=>{const c=w/2;g.fillStyle=rind;g.beginPath();g.arc(c,c,c,0,TAU);g.fill();g.fillStyle='#f4f2d8';g.beginPath();g.arc(c,c,c*.88,0,TAU);g.fill();
   for(let i=0;i<seg;i++){const a0=i/seg*TAU+.05,a1=(i+1)/seg*TAU-.05;g.beginPath();g.moveTo(c,c);g.arc(c,c,c*.8,a0,a1);g.closePath();g.fillStyle=flesh;g.fill()}}),transmission:.15}),
  new THREE.MeshPhysicalMaterial({color:flesh})])}
function mintLeaves(g,n,y0,y1,r){const sh=new THREE.Shape();sh.moveTo(0,0);sh.quadraticCurveTo(.011,.012,0,.03);sh.quadraticCurveTo(-.011,.012,0,0);const lg=new THREE.ShapeGeometry(sh,12);
  for(let i=0;i<n;i++){const m=new THREE.Mesh(lg,new THREE.MeshPhysicalMaterial({color:new THREE.Color().setHSL(.3,.5,srnd(.24,.34)),roughness:.45,side:THREE.DoubleSide}));
   const a=srnd(0,TAU),d=r*srnd(0,.7);m.position.set(Math.cos(a)*d,srnd(y0,y1),Math.sin(a)*d);m.rotation.set(srnd(-1.2,1.2),srnd(0,TAU),srnd(-1,1));g.add(m)}}

BUILD.matchaVanilla=function(){const g=new THREE.Group(),rb=.0355,rt=.0475,h=.132,t=.0012,base=.007;g.add(tumbler({rb,rt,h,t,base}));const lh=.108,lt=radAt(rb,rt,h,base+lh)-t-.0006;
  g.add(liquid(rb-t-.0006,lt,lh,base,drinkTex([[0,'#6e9a3a'],[.3,'#86ac4e'],[.45,'#b9cd8f'],[.6,'#e9ecd9'],[1,'#f4f1e6']],(gg,w,hh)=>{gg.globalAlpha=.35;for(let i=0;i<30;i++){gg.strokeStyle=i%2?'#7aa244':'#f4f1e6';gg.lineWidth=srnd(4,14);gg.beginPath();let x=srnd(0,w),y=srnd(hh*.3,hh*.55);gg.moveTo(x,y);for(let k=0;k<4;k++){x+=srnd(-50,50);y+=srnd(10,60);gg.lineTo(x,y)}gg.stroke()}gg.globalAlpha=1}),0x86ad4f));
  cubes(g,6,base+lh+.002,lt,.02);return g};
BUILD.blueMojito=function(){const g=new THREE.Group(),rb=.0355,rt=.0475,h=.132,t=.0012,base=.007;g.add(tumbler({rb,rt,h,t,base}));const lh=.112,lt=radAt(rb,rt,h,base+lh)-t-.0006;
  g.add(liquid(rb-t-.0006,lt,lh,base,drinkTex([[0,'#8fd3f0'],[.5,'#46a9db'],[1,'#2a7fbf']],(gg,w,hh)=>{for(let i=0;i<60;i++){gg.fillStyle='rgba(255,255,255,'+srnd(.15,.4)+')';gg.beginPath();gg.arc(srnd(0,w),srnd(0,hh),srnd(1.5,4),0,TAU);gg.fill()}}),0x7cc6ea,{roughness:.12,clearcoat:.5}));
  mintLeaves(g,12,base+lh*.97,base+lh*1.08,lt);cubes(g,7,base+lh+.002,lt,.02);
  const lw=fruitWheel(.021,'#4f8a2b','#b9d85a',10);lw.rotation.z=Math.PI/2;lw.rotation.y=.4;lw.position.set(-(rt-.004),h-.004,.004);g.add(lw);straw(g,.2,.012,.01,-.14);return g};
BUILD.icedTeaLemon=function(){const g=new THREE.Group(),rb=.0342,rt=.0475,h=.111,t=.0012,base=.007;g.add(tumbler({rb,rt,h,t,base}));const lh=.09,lt=radAt(rb,rt,h,base+lh)-t-.0006;
  g.add(liquid(rb-t-.0006,lt,lh,base,drinkTex([[0,'#d98a2b'],[.5,'#b8661a'],[1,'#8f4810']]),0xd08a35,{roughness:.1,clearcoat:.6}));cubes(g,6,base+lh+.002,lt,.021);
  const lw=fruitWheel(.022,'#e2b912','#fbe98a',10);lw.rotation.x=Math.PI/2;lw.rotation.z=.25;lw.position.set(.004,base+lh*.6,lt*.55);g.add(lw);
  const lw2=fruitWheel(.022,'#e2b912','#fbe98a',10);lw2.rotation.z=Math.PI/2;lw2.rotation.y=-.5;lw2.position.set(rt-.004,h-.004,.004);g.add(lw2);return g};
function shake(color,top,dec){const g=new THREE.Group(),rb=.034,rt=.04,h=.105,base=.008;g.add(ribbedGlass(rb,rt,h,base));const lh=.1,lt=rt-.0022;
  const liq=new THREE.Mesh(new THREE.CylinderGeometry(lt,rb-.0018,lh-.002,72),new THREE.MeshPhysicalMaterial({map:drinkTex(color,(gg,w,hh)=>speckle(gg,w,hh,500,dec,2.5,.1,.35)),roughness:.55}));
  liq.position.y=base+(lh-.002)/2;g.add(liq);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(lt,48,16,0,TAU,0,Math.PI/2),new THREE.MeshPhysicalMaterial({color:new THREE.Color(color[0][1]),roughness:.6}));dome.scale.y=.22;dome.position.y=base+lh-.002;g.add(dome);
  top(g,base+lh+.004,lt);return g}
const oats=(g,y,r,n=26)=>{for(let i=0;i<n;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.0026,10,6),new THREE.MeshPhysicalMaterial({color:new THREE.Color().setHSL(.1,.45,srnd(.62,.74)),roughness:.9}));
  m.scale.set(1,.35,.8);const a=srnd(0,TAU),d=r*Math.sqrt(srnd(0,.7));m.position.set(Math.cos(a)*d,y+srnd(0,.002),Math.sin(a)*d);m.rotation.y=srnd(0,TAU);g.add(m)}};
BUILD.shakeStrawberry=function(){return shake([[0,'#f2a7ae'],[1,'#ec95a0']],(g,y,r)=>{for(let i=0;i<4;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.009,24,16),new THREE.MeshPhysicalMaterial({color:0xd8283f,roughness:.35,clearcoat:.6}));
  s.scale.set(1,1.25,1);const a=i*1.6,d=r*.45;s.position.set(Math.cos(a)*d,y+.004,Math.sin(a)*d);g.add(s)}oats(g,y,r,14)},['#ffffff','#d8566b'])};
BUILD.shakeBlueberry=function(){return shake([[0,'#a98cc4'],[1,'#9a7cb8']],(g,y,r)=>{oats(g,y,r,30);for(let i=0;i<9;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.0055,20,14),new THREE.MeshPhysicalMaterial({color:0x2d3566,roughness:.45,sheen:.6,sheenColor:0x8a95c8}));
  const a=srnd(0,TAU),d=r*srnd(0,.6);b.position.set(Math.cos(a)*d,y+.004,Math.sin(a)*d);g.add(b)}},['#5a3d7a','#ffffff'])};
BUILD.shakeBanana=function(){return shake([[0,'#ecd08e'],[1,'#e2c27a']],(g,y,r)=>{oats(g,y,r,30);for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.004,32),new THREE.MeshPhysicalMaterial({color:0xf6e7b4,roughness:.6}));
  const a=i*2.1,d=r*.4;s.position.set(Math.cos(a)*d,y+.004,Math.sin(a)*d);s.rotation.set(srnd(-.4,.4),0,srnd(-.4,.4));g.add(s)}},['#8a5a2a','#ffffff'])};
BUILD.pecanTart=function(){const g=new THREE.Group();g.add(lathe([[0,0],[.05,0],[.052,.002],[.075,.007],[.077,.0095],[.073,.0098],[.05,.0042],[0,.0042]],ceramic()));
  const R=.04,pts=[];for(let i=0;i<=8;i++){const y=i/8*.018;pts.push([R*(.9+.1*Math.min(1,i/2)),y])}
  const shellGeo=new THREE.CylinderGeometry(R,R*.9,.018,120,1,true);const p=shellGeo.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const a=Math.atan2(v.x,v.z),k=1+.035*Math.cos(a*24);p.setXYZ(i,v.x*k,v.y,v.z*k)}shellGeo.computeVertexNormals();
  const crust=new THREE.MeshPhysicalMaterial({map:spongeTex('#d39a55',['#b97a3a','#ecc283']),normalMap:spongeNormal(),roughness:.85,side:THREE.DoubleSide});
  const sh=new THREE.Mesh(shellGeo,crust);sh.position.y=.0045+.009;g.add(sh);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(R*1.01,.0028,12,120),crust);rim.rotation.x=Math.PI/2;rim.position.y=.0045+.018;g.add(rim);
  const fill=new THREE.Mesh(new THREE.CylinderGeometry(R*.97,R*.88,.015,96),new THREE.MeshPhysicalMaterial({color:0x6b3410,roughness:.15,clearcoat:1}));fill.position.y=.0045+.0085;g.add(fill);
  const nut=new THREE.MeshPhysicalMaterial({color:0x7a3e17,roughness:.45,clearcoat:.8});
  [[0,0],[.016,0],[.028,0]].forEach(([d],ri)=>{const n=ri==0?1:ri==1?6:11;for(let i=0;i<n;i++){const a=i/n*TAU+ri*.3,m=new THREE.Mesh(new THREE.SphereGeometry(.0055,16,10),nut);
   m.scale.set(1,.42,1.7);m.position.set(Math.cos(a)*d,.0045+.016,Math.sin(a)*d);m.rotation.y=-a+Math.PI/2;g.add(m)}});return g};
BUILD.chocChipCookie=function(){const g=new THREE.Group();g.add(lathe([[0,0],[.045,0],[.047,.002],[.068,.006],[.07,.0085],[.066,.0088],[.045,.0038],[0,.0038]],ceramic()));
  const geo=new THREE.CylinderGeometry(.042,.043,.011,72,3);const p=geo.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const a=Math.atan2(v.x,v.z),r=Math.hypot(v.x,v.z);if(r>.001){const k=1+.04*Math.sin(a*5+1)+.025*Math.sin(a*11);p.setXYZ(i,v.x*k,v.y*(r>.03?.75:1)+(r<.03&&v.y>0?.0015:0),v.z*k)}}
  geo.computeVertexNormals();const c=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({map:spongeTex('#c9893f',['#a8692a','#e2ad62','#7a4a1c']),normalMap:spongeNormal(),normalScale:new THREE.Vector2(1.5,1.5),roughness:.9}));c.position.y=.0038+.0055;c.rotation.y=.4;g.add(c);
  for(let i=0;i<16;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.006,.003,.005),new THREE.MeshPhysicalMaterial({color:0x2e170c,roughness:.4,clearcoat:.4}));const a=srnd(0,TAU),d=.036*Math.sqrt(srnd(0,1));
   m.position.set(Math.cos(a)*d,.0038+.0105,Math.sin(a)*d);m.rotation.set(srnd(-.5,.5),srnd(0,TAU),srnd(-.5,.5));g.add(m)}
  return g};


/* ---------- Thalath cups (from the real printed cups) ---------- */
const CUPS=(typeof window!=='undefined'&&window.CUP_BASE)||new URL('./assets/cups/',import.meta.url).href;
const texCache={},TEX={};
const pet=()=>new THREE.MeshPhysicalMaterial({color:0xf2f5f7,roughness:.06,metalness:0,transparent:true,opacity:.22,clearcoat:1,clearcoatRoughness:.04,specularIntensity:1,depthWrite:false,side:THREE.DoubleSide});
function loadTex(name,flip=false,off=.55){if(texCache[name])return texCache[name];return texCache[name]=new Promise((res,rej)=>new THREE.TextureLoader().load(CUPS+name,t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  t.wrapS=THREE.RepeatWrapping;if(flip){t.repeat.x=-1}t.offset.x=off;TEX[name]=t;res(t)},undefined,rej))}
const paperWhite=()=>new THREE.MeshPhysicalMaterial({color:0xf4f1ea,roughness:.78,side:THREE.DoubleSide});
// double-wall paper cup: white inner cup shows as a band at the bottom, printed outer wall above it
async function paperCup({rt,rb,h,band,tex}){const g=new THREE.Group(),rAt=y=>rb+(rt-rb)*(y/h);
  // inner cup (white): wall + bottom
  g.add(lathe([[0,.004],[rb-.0014,.004],[rb-.0016,0],[rb-.0006,0],[rAt(band+.003)-.0006,band+.003],[rt-.0006,h-.0006],[rt-.0016,h-.0006],[rAt(.006)-.0022,.006],[0,.006]],paperWhite(),96));
  // printed outer wall
  const t=await loadTex(tex),y0=band,y1=h-.0022;
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(rAt(y1)+.0009,rAt(y0)+.0009,y1-y0,128,1,true),
    new THREE.MeshPhysicalMaterial({map:t,roughness:.62,clearcoat:.08,clearcoatRoughness:.6,side:THREE.FrontSide}));
  wall.position.y=(y0+y1)/2;g.add(wall);
  // folded lower edge of the outer wall
  const lip=new THREE.Mesh(new THREE.TorusGeometry(rAt(y0)+.0004,.0007,10,128),new THREE.MeshPhysicalMaterial({map:t,roughness:.62}));lip.rotation.x=Math.PI/2;lip.position.y=y0+.0003;g.add(lip);
  // rolled rim
  const rim=new THREE.Mesh(new THREE.TorusGeometry(rt-.0002,.0016,16,128),paperWhite());rim.rotation.x=Math.PI/2;rim.position.y=h-.0004;g.add(rim);
  return g}
// clear PET cup with the printed pattern
async function clearCup({rt,rb,h,base=.007,cold=true}){const g=new THREE.Group(),t=.0006,rAt=y=>rb+(rt-rb)*(y/h);
  g.add(lathe([[0,0],[rb-.003,0],[rb-.0035,.0015],[rb,.0015],[rb+.0002,base],[rt,h-.004],[rt+.0022,h-.0025],[rt+.0024,h],[rt+.0005,h+.0008],[rt-t,h-.003],[rb-t,base],[0,base]],cold?glass():pet(),128));
  const tx=await loadTex('wrap_clear.png'),y0=h*.2,y1=h*.88;
  const pr=new THREE.Mesh(new THREE.CylinderGeometry(rAt(y1)+.0012,rAt(y0)+.0012,y1-y0,128,1,true),
    new THREE.MeshPhysicalMaterial({map:tx,alphaTest:.35,roughness:.5,side:THREE.DoubleSide}));
  pr.position.y=(y0+y1)/2;g.add(pr);
  if(cold)g.add(sleeve(rb,rt,h,.004,h*.95,.0007));
  return g}
Object.assign(BUILD,{
 cupClear(){return clearCup({rt:.0475,rb:.0342,h:.111,cold:false})},
 cupSage(){return paperCup({rt:.045,rb:.0293,h:.124,band:.0136,tex:'wrap_sage.jpg'})},
 cupOrange(){return paperCup({rt:.040,rb:.0284,h:.108,band:.015,tex:'wrap_orange.jpg'})},
 cupOrangeS(){return paperCup({rt:.031,rb:.0226,h:.0775,band:.0078,tex:'wrap_orange.jpg'})},
 cupGrey(){return paperCup({rt:.0315,rb:.0224,h:.081,band:.0073,tex:'wrap_grey.jpg'})},
});


/* hot drinks in Thalath paper cups */
const PC={S:{rt:.031,rb:.0226,h:.0775,band:.0078,tex:'wrap_orange.jpg'},G:{rt:.0315,rb:.0224,h:.081,band:.0073,tex:'wrap_grey.jpg'},
  O:{rt:.040,rb:.0284,h:.108,band:.015,tex:'wrap_orange.jpg'},L:{rt:.045,rb:.0293,h:.124,band:.0136,tex:'wrap_sage.jpg'}};
const flatTex=(c0,c1,fx)=>cv(512,512,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,10,w/2,w/2,w/2);r.addColorStop(0,c0);r.addColorStop(1,c1);g.fillStyle=r;g.fillRect(0,0,w,w);if(fx)fx(g,w)});
// latte-art helpers: drawn as white microfoam on a coffee base
function foamBase(g,w,c0,c1,ring){const r=g.createRadialGradient(w/2,w/2,10,w/2,w/2,w/2);r.addColorStop(0,c0);r.addColorStop(.78,c1);r.addColorStop(1,ring);g.fillStyle=r;g.fillRect(0,0,w,w);speckle(g,w,w,700,['#b07a48','#4a260f'],1.8)}
function milk(g,draw,blur=10){g.save();g.shadowColor='rgba(70,35,12,.45)';g.shadowBlur=blur;g.fillStyle='#fbf5ec';draw();g.restore()}
function heartArt(g,w,s,dy=0){milk(g,()=>{heart(g,w/2,w/2+dy,s);g.fill()})}
function tulipArt(g,w){milk(g,()=>{[[.34,-.2],[.27,.02],[.2,.2]].forEach(([k,o])=>{g.beginPath();g.ellipse(w/2,w/2+o*w*.9,w*k*.62,w*k*.34,0,0,TAU);g.fill()})});
  g.strokeStyle='#7a4524';g.lineWidth=5;g.beginPath();g.moveTo(w/2,w*.18);g.lineTo(w/2,w*.86);g.stroke()}
function rosettaArt(g,w){ // free-poured rosetta: soft, slightly uneven crescents with a pulled line (axis runs along x so it faces the viewer)
  g.save();g.filter='blur(1.6px)';const c=w/2;
  for(let i=0;i<10;i++){const x=w*.2+i*w*.058,k=1-i*.078,ry=w*.27*k*srnd(.94,1.04),rx=w*.07*k;
    g.fillStyle=`rgba(252,246,236,${(.9-i*.02).toFixed(2)})`;g.beginPath();g.ellipse(x,c+srnd(-2,2),rx,ry,0,Math.PI*.5,Math.PI*1.5,false);g.ellipse(x+rx*.55,c,rx*.55,ry*.82,0,Math.PI*1.5,Math.PI*.5,true);g.closePath();g.fill()}
  g.fillStyle='rgba(252,246,236,.95)';g.beginPath();g.save();g.translate(w*.8,c);g.rotate(-Math.PI/2);heart(g,0,0,w*.07);g.restore();g.fill();
  g.filter='blur(1px)';g.strokeStyle='rgba(140,86,48,.75)';g.lineWidth=3.2;g.beginPath();g.moveTo(w*.14,c);g.quadraticCurveTo(w*.5,c+3,w*.86,c);g.stroke();g.restore()}
const SURF={
 crema:()=>cv(512,512,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,10,w/2,w/2,w/2);r.addColorStop(0,'#d39654');r.addColorStop(.6,'#b26d31');r.addColorStop(.92,'#70391a');r.addColorStop(1,'#3f200c');g.fillStyle=r;g.fillRect(0,0,w,w);
   // tiger striping of a fresh shot
   g.globalAlpha=.35;for(let i=0;i<26;i++){g.strokeStyle=i%2?'#5a2c10':'#e8b980';g.lineWidth=srnd(3,9);g.beginPath();const a=srnd(0,TAU);g.arc(w/2,w/2,srnd(w*.08,w*.46),a,a+srnd(.4,1.4));g.stroke()}g.globalAlpha=1;speckle(g,w,w,1200,['#f0c58c','#4a240d'],2)}),
 latte:()=>cv(512,512,(g,w)=>{foamBase(g,w,'#b57a47','#8a5228','#5a2f12');rosettaArt(g,w)}),
 spanish:()=>cv(512,512,(g,w)=>{foamBase(g,w,'#c38a52','#9a6134','#5c3416');tulipArt(g,w)}),
 flatWhite:()=>cv(512,512,(g,w)=>{foamBase(g,w,'#9c5d2e','#7a421d','#4a250e');heartArt(g,w,w*.2,w*.02)}),
 cortado:()=>cv(512,512,(g,w)=>{foamBase(g,w,'#8e5126','#6c3816','#3f200c');heartArt(g,w,w*.14,w*.02)}),
 cappuccino:()=>cv(512,512,(g,w)=>{g.fillStyle='#fbf6ee';g.fillRect(0,0,w,w);const r=g.createRadialGradient(w/2,w/2,w*.05,w/2,w/2,w*.34);r.addColorStop(0,'rgba(92,48,20,.85)');r.addColorStop(1,'rgba(92,48,20,0)');g.fillStyle=r;g.fillRect(0,0,w,w);
   speckle(g,w,w,3200,['#5a2f14','#7a4524'],1.5,.25,.7);const e=g.createRadialGradient(w/2,w/2,w*.4,w/2,w/2,w/2);e.addColorStop(0,'rgba(0,0,0,0)');e.addColorStop(1,'rgba(150,95,50,.5)');g.fillStyle=e;g.fillRect(0,0,w,w)}),
 black:()=>cv(512,512,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,10,w/2,w/2,w/2);r.addColorStop(0,'#7a4220');r.addColorStop(.8,'#4a2410');r.addColorStop(1,'#a7703f');g.fillStyle=r;g.fillRect(0,0,w,w);speckle(g,w,w,900,['#c08a55','#2a1406'],2.4,.1,.4)}),
 drip:()=>cv(512,512,(g,w)=>{const r=g.createRadialGradient(w*.42,w*.4,10,w/2,w/2,w/2);r.addColorStop(0,'#4a230d');r.addColorStop(.85,'#2a1206');r.addColorStop(1,'#6a3a18');g.fillStyle=r;g.fillRect(0,0,w,w)}),
 tea:()=>cv(512,512,(g,w)=>{const r=g.createRadialGradient(w*.42,w*.4,10,w/2,w/2,w/2);r.addColorStop(0,'#c9772a');r.addColorStop(.85,'#8a420f');r.addColorStop(1,'#c58a45');g.fillStyle=r;g.fillRect(0,0,w,w)}),
 turkish:()=>cv(512,512,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,10,w/2,w/2,w/2);r.addColorStop(0,'#6b4426');r.addColorStop(.7,'#4e2f18');r.addColorStop(1,'#7a5230');g.fillStyle=r;g.fillRect(0,0,w,w);speckle(g,w,w,3000,['#a37a52','#2c1709','#c49a6c'],1.6,.2,.6)}),
 matcha:()=>cv(512,512,(g,w)=>{foamBase(g,w,'#a6c467','#7c9b3c','#56732a');milk(g,()=>{heart(g,w/2,w/2+10,w*.17);g.fill()})})};
// fine microfoam: tiny bubbles as a normal map (denser near the cup wall)
const microFoam=()=>normalFrom(512,512,(g,w,h)=>{for(let i=0;i<5200;i++){const r=srnd(.5,1.8),x=srnd(0,w),y=srnd(0,h);const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'#b0b0b0');gr.addColorStop(1,'#808080');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill()}
  const c=w/2;for(let i=0;i<900;i++){const a=srnd(0,TAU),d=c*srnd(.86,.99),r=srnd(1.2,3.6),x=c+Math.cos(a)*d,y=c+Math.sin(a)*d;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'#e0e0e0');gr.addColorStop(.7,'#9a9a9a');gr.addColorStop(1,'#808080');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill()}},2.4);
// lighter foam ring where the drink meets the wall
function edgeFoam(g,w,col,a=.75){const c=w/2,r=g.createRadialGradient(c,c,c*.8,c,c,c);r.addColorStop(0,'rgba(0,0,0,0)');r.addColorStop(.7,col.replace('A',a*.5));r.addColorStop(1,col.replace('A',a));g.fillStyle=r;g.fillRect(0,0,w,w)}
const DOME={turkish:.012,cappuccino:.075,latte:.02,spanish:.02,flatWhite:.016,cortado:.014,matcha:.02,crema:.01,black:.004,drip:0,tea:0};
async function hotCup(size,surf){const c=PC[size],g=await paperCup(c),y=c.h-.0009,r=c.rt-.0011,tx=SURF[surf](),glossy=['black','drip','tea'].includes(surf),milky=!glossy&&surf!=='crema';
  if(!glossy){const ctx=tx.image.getContext('2d');edgeFoam(ctx,tx.image.width,surf==='crema'?'rgba(225,170,105,A)':surf==='matcha'?'rgba(214,230,170,A)':'rgba(250,244,234,A)',surf==='crema'?.6:.8);tx.needsUpdate=true}
  const mat=new THREE.MeshPhysicalMaterial({map:tx,emissive:0xffffff,emissiveMap:tx,emissiveIntensity:glossy?.18:.3,roughness:glossy?.08:.62,clearcoat:glossy?.8:0,clearcoatRoughness:.06,
    sheen:milky?.35:0,sheenRoughness:.6,sheenColor:0xfff8ee,normalMap:glossy?null:microFoam(),normalScale:new THREE.Vector2(milky?.55:.35,milky?.55:.35)});
  // surface as a polar grid so it can bulge into a meniscus / foam dome with flat top-down UVs
  const geo=new THREE.RingGeometry(.00001,r,96,24),p=geo.attributes.position,hd=c.h*(DOME[surf]||0);
  for(let i=0;i<p.count;i++){const d=Math.hypot(p.getX(i),p.getY(i))/r;p.setZ(i,hd*Math.pow(Math.max(0,1-Math.pow(d,2.2)),.55))}geo.computeVertexNormals();
  const s=new THREE.Mesh(geo,mat);s.rotation.x=-Math.PI/2;s.rotation.z=Math.PI/2;s.position.y=y;g.add(s);
  // foam/crema collar that climbs the paper wall so there is no gap at the edge
  if(!glossy){const col=new THREE.Mesh(new THREE.TorusGeometry(r-.0002,.0009,12,128),new THREE.MeshPhysicalMaterial({color:surf==='crema'?0xd9a466:surf==='matcha'?0xd3e2a6:0xfbf6ee,roughness:.7,sheen:.4,sheenColor:0xffffff,normalMap:foamNormal(),normalScale:new THREE.Vector2(.4,.4)}));
    col.rotation.x=Math.PI/2;col.position.y=y+.0006;g.add(col)}
  return g}
Object.assign(BUILD,{
 espresso(){return hotCup('S','crema')},
 latte(){return hotCup('L','latte')},
 spanishLatte(){return hotCup('L','spanish')},
 cappuccino(){return hotCup('L','cappuccino')},
 americano(){return hotCup('L','black')},
 flatWhite(){return hotCup('G','flatWhite')},
 cortado(){return hotCup('G','cortado')},
 dripCoffee(){return hotCup('O','drip')},
 hotTea(){return hotCup('O','tea')},
 hotMatcha(){return hotCup('L','matcha')},
 turkish(){return hotCup('S','turkish')},
});


/* ---------- fast renderer for the product strip ---------- */
const groups={};
async function built(key){if(!groups[key]){await Promise.all(['wrap_clear.png','wrap_orange.jpg','wrap_sage.jpg','wrap_grey.jpg'].map(n=>loadTex(n)));seed=7;const g=await BUILD[key]();
  const bb=new THREE.Box3().setFromObject(g),sz=bb.getSize(new THREE.Vector3());
  const root=new THREE.Group();root.add(g);groups[key]={root,g,bb,sz}}return groups[key]}
function mkRenderer(canvas){const R=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:!canvas});R.toneMapping=THREE.NeutralToneMapping;R.outputColorSpace=THREE.SRGBColorSpace;R.setClearColor(0,0);
  const pm=new THREE.PMREMGenerator(R);R.env=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();return R}
function place(cam,info,aspect,phi){const {bb,sz}=info,cy=bb.min.y+sz.y*.5,rad=Math.max(sz.y*.62,sz.x*.62/aspect);const d=rad/Math.tan(THREE.MathUtils.degToRad(cam.fov/2))*1.04,p=THREE.MathUtils.degToRad(phi);
  cam.aspect=aspect;cam.near=d/50;cam.far=d*20;cam.position.set(0,cy+Math.cos(p)*d,Math.sin(p)*d);cam.lookAt(0,cy+sz.y*.07,0);cam.updateProjectionMatrix()}
let SR=null,senv=null;
export async function still(key,{w=520,h=640,phi=62,yaw=.35}={}){const info=await built(key);SR=SR||mkRenderer();const R=SR;R.setPixelRatio(1);R.setSize(w,h,false);
  const sc=new THREE.Scene();sc.environment=R.env;const ob=info.root.clone();ob.rotation.y=yaw;sc.add(ob);const cam=new THREE.PerspectiveCamera(22,w/h);place(cam,info,w/h,phi);R.render(sc,cam);
  return await new Promise(res=>R.domElement.toBlob(b=>res(URL.createObjectURL(b)),'image/webp',.9))}
export function live(canvas){const R=mkRenderer(canvas),sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(22,1);sc.environment=R.env;let info=null,spin=0,vel=.55,drag=null,raf=0,last=0,phi=62,alpha=0,target=0;
  function size(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;R.setPixelRatio(Math.min(2,devicePixelRatio||1));R.setSize(w,h,false);if(info)place(cam,info,w/h,phi)}
  function loop(t){raf=requestAnimationFrame(loop);const dt=Math.min(.05,(t-(last||t))/1000);last=t;if(!info)return;if(!drag)spin+=vel*dt;info.root.rotation.y=spin;
    alpha+=(target-alpha)*Math.min(1,dt*9);canvas.style.opacity=alpha.toFixed(3);R.render(sc,cam)}
  new ResizeObserver(size).observe(canvas);raf=requestAnimationFrame(loop);
  return{async show(key,p=62,yaw=.35){target=0;const inf=await built(key);if(info)sc.remove(info.root);info=inf;phi=p;spin=yaw;sc.add(info.root);size();target=1},
    hide(){target=0},stop(){cancelAnimationFrame(raf)}}}

/* ---------- export ---------- */
const cache={};const exporter=new GLTFExporter();
export async function glb(key){if(cache[key])return cache[key];await Promise.all(['wrap_clear.png','wrap_orange.jpg','wrap_sage.jpg','wrap_grey.jpg'].map(n=>loadTex(n)));seed=7;const g=await BUILD[key]();const s=new THREE.Scene();s.add(g);
  const buf=await exporter.parseAsync(s,{binary:true,maxTextureSize:1024});return cache[key]=URL.createObjectURL(new Blob([buf],{type:'model/gltf-binary'}))}
export {paperCup,clearCup};
