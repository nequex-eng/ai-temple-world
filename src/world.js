import * as THREE from "three";
import { createTempleCollision, moveWithCollision, groundHeightAt, collidesAt } from "./physics.js";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mat=(c,r=.85,e={})=>new THREE.MeshStandardMaterial({color:c,roughness:r,...e});
const robeFabric=(()=>{
 const canvas=document.createElement("canvas");canvas.width=canvas.height=128;
 const ctx=canvas.getContext("2d");ctx.fillStyle="#e8e0d0";ctx.fillRect(0,0,128,128);
 for(let y=0;y<128;y+=3){ctx.fillStyle="rgba(75,58,39,.055)";ctx.fillRect(0,y,128,1);}
 for(let x=0;x<128;x+=3){ctx.fillStyle="rgba(255,255,255,.18)";ctx.fillRect(x,0,1,128);}
 for(let i=0;i<900;i++){ctx.fillStyle=i%2?"rgba(70,54,36,.045)":"rgba(255,255,255,.12)";ctx.fillRect(Math.random()*128,Math.random()*128,1,2);}
 const map=new THREE.CanvasTexture(canvas);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,3);map.colorSpace=THREE.SRGBColorSpace;return map;
})();
function add(g,m,p,pos=[0,0,0],rot=[0,0,0],cast=true){
 const o=new THREE.Mesh(g,m);o.position.set(pos[0],pos[1],pos[2]);o.rotation.set(rot[0],rot[1],rot[2]);o.castShadow=cast;o.receiveShadow=true;p.add(o);return o;
}
function texture(draw,rx=1,ry=1){const c=document.createElement("canvas");c.width=c.height=512;const x=c.getContext("2d");draw(x,512);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.colorSpace=THREE.SRGBColorSpace;return t;}
function labelSprite(name){
 const c=document.createElement("canvas");c.width=384;c.height=96;const x=c.getContext("2d");
 x.fillStyle="rgba(18,31,25,.78)";x.beginPath();x.roundRect(7,7,370,82,13);x.fill();
 x.strokeStyle="rgba(215,187,132,.6)";x.lineWidth=2;x.stroke();
 x.fillStyle="#f1dfbd";x.font="32px serif";x.textAlign="center";x.textBaseline="middle";x.fillText(String(name||"行者").slice(0,16),192,47);
 const map=new THREE.CanvasTexture(c),s=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));
 s.scale.set(2.45,.62,1);s.position.y=3;return s;
}

function plaqueSprite(title,subtitle){
 const c=document.createElement("canvas");c.width=512;c.height=128;const x=c.getContext("2d");
 x.fillStyle="rgba(25,39,31,.94)";x.beginPath();x.roundRect(5,5,502,118,8);x.fill();
 x.strokeStyle="rgba(218,190,135,.9)";x.lineWidth=4;x.stroke();
 x.strokeStyle="rgba(218,190,135,.28)";x.lineWidth=1;x.strokeRect(13,13,486,102);
 x.textAlign="center";x.textBaseline="middle";x.fillStyle="#f0dfbd";x.font="bold 38px serif";x.fillText(String(title||"佛殿").slice(0,14),256,48);
 x.fillStyle="#cbb58a";x.font="17px sans-serif";x.fillText(String(subtitle||"TEMPLE HALL").slice(0,32),256,91);
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));
 sprite.scale.set(4.5,1.125,1);return sprite;
}

function pine(scene,x,z,s,m){
 const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);
 add(new THREE.CylinderGeometry(.16,.3,3.1,9),m.bark,g,[0,1.55,0]);
 for(let i=0;i<5;i++){
  const angle=i*2.17+Math.random()*.24,offset=.12+Math.random()*.12;
  const crown=add(new THREE.ConeGeometry(1.9-i*.29,2.9,11),i%2?m.pine2:m.pine,g,[Math.cos(angle)*offset,2.05+i*.73,Math.sin(angle)*offset],[Math.sin(angle)*.035,i*.31,Math.cos(angle)*.035]);
  crown.scale.set(.92+Math.random()*.17,.9+Math.random()*.16,.92+Math.random()*.17);
 }
 for(let i=0;i<3;i++){
  const a=i*Math.PI*2/3+.4,branch=add(new THREE.CylinderGeometry(.045,.085,1.35,6),m.bark,g,[Math.cos(a)*.46,2.1,Math.sin(a)*.46],[Math.sin(a)*.65,0,Math.cos(a)*-.65]);
 }
}
function planeRoof(parent,w,d,ry,ey,side,m){
 const nx=14,nz=7,positions=[],uvs=[],indices=[];
 for(let j=0;j<=nz;j++){
  const t=j/nz;
  for(let i=0;i<=nx;i++){
   const u=i/nx,x=(-w/2-1.2-.62*t)+u*(w+2.4+1.24*t),z=side*t*(d/2+1.1);
   const cornerLift=Math.pow(Math.abs(u*2-1),5)*Math.pow(t,1.35)*.72;
   const eaveLift=Math.pow(t,5)*.16;
   const y=ry+(ey-ry)*t+cornerLift+eaveLift;
   positions.push(x,y,z);uvs.push(u*2.8,t*2.2);
   if(i<nx&&j<nz){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d0=c+1;indices.push(a,c,b,b,c,d0);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return add(g,m,parent);
}
function hall(scene,cfg,m){
 const {x,z,w,d,h}=cfg,g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 add(new THREE.BoxGeometry(w+2.2,.54,d+2.2),m.stone,g,[0,.27,0]);
 // Level landing plus three broad, climbable stone treads.
 add(new THREE.BoxGeometry(w,.54,1.3),m.stoneLight,g,[0,.27,d/2+.58]);
 const stairHeights=[.54,.36,.18];
 for(let i=0;i<3;i++)add(new THREE.BoxGeometry(w*.62,.18,1.0),m.stoneLight,g,[0,stairHeights[i]-.09,d/2+1.72+i]);
 add(new THREE.BoxGeometry(w,h,.32),m.wall,g,[0,.54+h/2,-d/2+.16],[0,0,0],false);
 add(new THREE.BoxGeometry(.32,h,d),m.wall,g,[-w/2+.16,.54+h/2,0],[0,0,0],false);
 add(new THREE.BoxGeometry(.32,h,d),m.wall,g,[w/2-.16,.54+h/2,0],[0,0,0],false);
 for(const sx of [-1,1]){
  add(new THREE.BoxGeometry(.32,h,d),m.pillar,g,[sx*(w/2-.35),.54+h/2,0]);
  add(new THREE.CylinderGeometry(.18,.22,h,10),m.pillar,g,[sx*(w/2-.35),.54+h/2,d/2-.4]);
 }
 const n=Math.max(4,Math.round(w/3));
 for(let i=0;i<n;i++){
  const px=-w/2+(i+.5)*w/n;
  if(Math.abs(px)<w*.2)continue;
  add(new THREE.CylinderGeometry(.16,.2,h,10),m.pillar,g,[px,.54+h/2,d/2-.35]);
  add(new THREE.BoxGeometry(.48,.16,.54),m.gold,g,[px,.54+h-.08,d/2-.35]);
 }
 const doorW=w*.38;
 add(new THREE.BoxGeometry(doorW*.28,h*.75,.18),m.darkWood,g,[-doorW*.42,.54+h*.38,d/2-.06],[0,-.78,0]);
 add(new THREE.BoxGeometry(doorW*.28,h*.75,.18),m.darkWood,g,[doorW*.42,.54+h*.38,d/2-.06],[0,.78,0]);
 for(const side of [-1,1]){
  const px=side*w*.34;
  add(new THREE.BoxGeometry(w*.18,h*.4,.13),m.darkWood,g,[px,.54+h*.55,d/2+.02]);
  for(let j=-2;j<=2;j++)add(new THREE.BoxGeometry(.035,h*.38,.05),m.goldDark,g,[px+j*w*.034,.54+h*.55,d/2+.1],[0,0,0],false);
  for(let j=0;j<4;j++)add(new THREE.BoxGeometry(w*.17,.035,.05),m.goldDark,g,[px,.54+h*.37+j*h*.095,d/2+.1],[0,0,0],false);
 }
 add(new THREE.BoxGeometry(w+1.8,.42,.6),m.darkWood,g,[0,.54+h-.24,d/2+.08]);
 add(new THREE.BoxGeometry(w+1.8,.42,.6),m.darkWood,g,[0,.54+h-.24,-d/2-.08]);
 const roofMat=m.roof,ry=.54+h+2.25,ey=.54+h+1.15;
 planeRoof(g,w,d,ry,ey,1,roofMat);planeRoof(g,w,d,ry,ey,-1,roofMat);
 add(new THREE.CylinderGeometry(.12,.12,w+2.6,10),m.gold,g,[0,ry+.1,0],[0,0,Math.PI/2]);
 for(const sx of [-1,1])for(const sz of [-1,1])add(new THREE.SphereGeometry(.22,9,8),m.gold,g,[sx*(w/2+1.55),ey+.18,sz*(d/2+1.0)]);
 add(new THREE.BoxGeometry(Math.min(w*.4,5),.75,.18),m.sign,g,[0,.54+h*.7,d/2+.17]);
 const plaque=plaqueSprite(cfg.label||"佛殿",cfg.subtitle||"TEMPLE HALL");plaque.scale.set(Math.min(w*.34,4.3),.9,1);plaque.position.set(0,.54+h*.7,d/2+.29);g.add(plaque);
 return g;
}
function lantern(scene,x,z,m){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 add(new THREE.BoxGeometry(.18,1.9,.18),m.stoneLight,g,[0,.95,0]);
 add(new THREE.BoxGeometry(.9,.16,.9),m.stone,g,[0,1.9,0]);
 add(new THREE.BoxGeometry(.55,.7,.55),m.paper,g,[0,2.35,0]);
 add(new THREE.ConeGeometry(.7,.42,4),m.roof,g,[0,2.9,0],[0,Math.PI/4,0]);
 add(new THREE.ConeGeometry(.08,.34,6),m.gold,g,[0,3.26,0]);
 const l=new THREE.PointLight(0xffce8c,.48,7);l.position.set(0,2.3,0);g.add(l);
}
function avatar(scene,profile={},id="local",isLocal=false){
 const root=new THREE.Group();root.name="monk-"+id;scene.add(root);
 const robe=mat(profile.robe||"#b49a72",.96,{map:robeFabric,bumpMap:robeFabric,bumpScale:.018}),trim=mat(0xd7bf91,.65),skin=mat(profile.skin||"#d7ad87"),dark=mat(0x392f27),sandal=mat(0x574b3b);
 const body=new THREE.Group();root.add(body);
 add(new THREE.LatheGeometry([new THREE.Vector2(.24,.08),new THREE.Vector2(.32,.18),new THREE.Vector2(.43,.5),new THREE.Vector2(.54,1.06),new THREE.Vector2(.62,1.42),new THREE.Vector2(.52,1.55),new THREE.Vector2(.29,1.63)],24),robe,body);
 add(new THREE.ConeGeometry(.19,.9,4),trim,body,[0,.92,.27]).scale.set(.75,1,.2);
 add(new THREE.TorusGeometry(.42,.045,7,32),trim,body,[0,.43,0],[Math.PI/2,0,0]);
 add(new THREE.TorusGeometry(.23,.04,8,28),trim,body,[0,1.53,0],[Math.PI/2,0,0]);
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const leg=add(new THREE.CapsuleGeometry(.105,.28,4,8),dark,body,[side*.2,.19,0]);legs.push(leg);
  add(new THREE.BoxGeometry(.28,.09,.4),sandal,body,[side*.2,.045,.08]);
  const pivot=new THREE.Group();pivot.position.set(side*.43,1.36,0);body.add(pivot);
  add(new THREE.CapsuleGeometry(.155,.62,4,8),robe,pivot,[side*.03,-.28,0],[0,0,side*.16]);
  add(new THREE.SphereGeometry(.12,10,8),skin,pivot,[side*.03,-.61,.02]);arms.push(pivot);
 }
 add(new THREE.CylinderGeometry(.12,.15,.22,12),skin,body,[0,1.65,0]);
 const head=new THREE.Group();head.position.set(0,1.94,0);body.add(head);
 add(new THREE.SphereGeometry(.315,20,16),skin,head,[0,.12,0]);
 // Smooth, clearly shaven monastic scalp (no hair cap or hairstyle).
 const scalp=add(new THREE.SphereGeometry(.318,20,14),skin,head,[0,.235,-.012]);scalp.scale.set(1,.58,.96);
 // Layered kasaya robe and cloth sash make the silhouette read as a Buddhist monk.
 add(new THREE.TorusGeometry(.31,.075,9,28),trim,body,[0,1.57,.015],[Math.PI/2,0,0]);
 const sash=add(new THREE.BoxGeometry(.18,1.3,.085),trim,body,[.24,.93,.43],[0,0,-.42]);sash.scale.set(.85,1,.8);
 const drapeCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.34,1.53,.24),new THREE.Vector3(-.22,1.34,.47),new THREE.Vector3(.02,1.08,.54),new THREE.Vector3(.27,.82,.49),new THREE.Vector3(.37,.53,.38)]);
 body.add(new THREE.Mesh(new THREE.TubeGeometry(drapeCurve,24,.018,7,false),trim));
 // Natural overlapping robe folds: subtle raised seams rather than a smooth toy-like cylinder.
 const foldMaterial=new THREE.MeshStandardMaterial({color:0x493c2c,roughness:1,transparent:true,opacity:.17});
 for(let i=0;i<7;i++){
  const x=-.34+i*.113;
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x*.5,1.42,.48),new THREE.Vector3(x*.8,1.02,.535),new THREE.Vector3(x,.62,.51),new THREE.Vector3(x*.88,.24,.53)]);
  body.add(new THREE.Mesh(new THREE.TubeGeometry(curve,14,.008,5,false),foldMaterial));
 }
 add(new THREE.TorusGeometry(.39,.055,8,32),trim,body,[0,.55,0],[Math.PI/2,0,0]);
 // Long robe hem covers the trousers; only the sandals remain visible.
 add(new THREE.CylinderGeometry(.48,.58,.42,24,1,true),robe,body,[0,.25,0]);
 add(new THREE.BoxGeometry(.13,.035,.05),trim,body,[0,1.43,.49]);
 for(const side of [-1,1]){
  add(new THREE.SphereGeometry(.064,10,8),skin,head,[side*.3,.11,0]);
  add(new THREE.SphereGeometry(.024,8,8),dark,head,[side*.105,.15,.292],[0,0,0],false);
 }
 add(new THREE.SphereGeometry(.04,8,8),skin,head,[0,.04,.3],[0,0,0],false);
 // Fine facial structure: softly closed eyes, brow ridges, nose and a restrained mouth.
 const feature=mat(0x59463b,.94),lip=mat(0x805c50,.9);
 for(const side of [-1,1]){
  const eyeCurve=new THREE.CatmullRomCurve3([
   new THREE.Vector3(side*.19,.145,.274),new THREE.Vector3(side*.105,.125,.302),new THREE.Vector3(side*.045,.14,.31)
  ]);
  head.add(new THREE.Mesh(new THREE.TubeGeometry(eyeCurve,10,.009,5,false),feature));
  const browCurve=new THREE.CatmullRomCurve3([
   new THREE.Vector3(side*.22,.205,.255),new THREE.Vector3(side*.13,.225,.28),new THREE.Vector3(side*.055,.205,.295)
  ]);
  head.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve,10,.012,5,false),skin));
 }
 add(new THREE.SphereGeometry(.035,10,8),skin,head,[0,.105,.315]).scale.set(.72,1.2,.72);
 const mouthCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.055,.035,.292),new THREE.Vector3(0,.027,.305),new THREE.Vector3(.055,.035,.292)]);
 head.add(new THREE.Mesh(new THREE.TubeGeometry(mouthCurve,10,.006,5,false),lip));
 const incenseStick=new THREE.Group();body.add(incenseStick);incenseStick.visible=false;
 add(new THREE.CylinderGeometry(.018,.018,.72,7),mat(0x98683a,.8),incenseStick,[0,0,0]);
 add(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0xff9c54}),incenseStick,[0,.37,0]);
 incenseStick.position.set(.08,1.05,.52);
 const broom=new THREE.Group();body.add(broom);broom.visible=false;
 add(new THREE.CylinderGeometry(.026,.035,1.12,7),mat(0x765233),broom,[0,-.2,0]);
 add(new THREE.CylinderGeometry(.19,.23,.3,9),mat(0xb59a6d),broom,[0,-.83,0]);
 broom.position.set(.12,1.05,.52);
 const beads=new THREE.Group();body.add(beads);
 for(let i=0;i<13;i++){const a=Math.PI*.12+i*Math.PI*.76/12;add(new THREE.SphereGeometry(.032,7,6),trim,beads,[Math.sin(a)*.32,1.24+Math.cos(a)*.18,.32]);}
 if(profile.style==="pilgrim"){
  add(new THREE.BoxGeometry(.42,.56,.22),dark,body,[-.57,.73,-.08],[0,0,-.18]);
 }
 const tag=labelSprite(profile.name||"行者");root.add(tag);
 return {
  id,root,body,head,arms,legs,tag,profile,target:new THREE.Vector3(),targetRotation:0,pose:"walk",until:0,
  setProfile(p){this.profile=p;robe.color.set(p.robe||"#b49a72");skin.color.set(p.skin||"#d7ad87");this.setLabel(p.name);},
  setLabel(name){this.tag.material.map.dispose();root.remove(this.tag);this.tag=labelSprite(name);root.add(this.tag);},
  setPosition(x,z,r=0,y=0){root.position.set(x,y,z);root.rotation.y=r;this.target.set(x,y,z);this.targetRotation=r;},
  setTarget(p){this.target.set(p.x,0,p.z);this.targetRotation=Number(p.rotation)||0;if(p.action&&p.action!=="walk")this.setPose(p.action,2100);},
  setPose(a,ms=2600){this.pose=a;this.until=performance.now()+ms;},
  update(dt,time,moving=false){
   if(this.until&&time>this.until){this.pose="walk";this.until=0;}
   if(!isLocal){let d=((this.targetRotation-root.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;root.rotation.y+=d*(1-Math.pow(.0001,dt));}
   body.rotation.x=0;head.rotation.x=0;body.position.y=Math.sin(time*.0018)*.012;head.rotation.y=Math.sin(time*.0012)*.018;arms[0].rotation.set(0,0,-.12);arms[1].rotation.set(0,0,.12);legs[0].rotation.x=0;legs[1].rotation.x=0;
   if(moving&&this.pose==="walk"){const v=Math.sin(time*.0075)*.34;legs[0].rotation.x=v;legs[1].rotation.x=-v;arms[0].rotation.x=-v*.5;arms[1].rotation.x=v*.5;body.position.y=Math.abs(Math.sin(time*.018))*.035;}
   incenseStick.visible=this.pose==="incense";broom.visible=this.pose==="sweep";
   if(this.pose==="bow"||this.pose==="kneel"||this.pose==="chant"){body.rotation.x=this.pose==="chant"?.08:.17;head.rotation.x=this.pose==="chant"?.13:.26;arms[0].rotation.x=-.2;arms[1].rotation.x=-.2;arms[0].rotation.z=.65;arms[1].rotation.z=-.65;if(this.pose==="kneel"){body.position.y=-.25;legs[0].rotation.x=-.7;legs[1].rotation.x=-.7;}}
   else if(this.pose==="meditate"){
    body.position.y=-.19+Math.sin(time*.00125)*.012;
    body.rotation.x=-.025+Math.sin(time*.0008)*.008;
    head.rotation.x=.035+Math.sin(time*.0011)*.008;
    legs[0].rotation.x=-1.1;legs[1].rotation.x=-1.1;
    // Both forearms rise gently and meet at the lap in a quiet meditation mudra.
    arms[0].rotation.set(-1.02,0,.52);
    arms[1].rotation.set(-1.02,0,-.52);
   }
   else if(this.pose==="greet"){arms[0].rotation.x=-.75;arms[1].rotation.x=-.75;arms[0].rotation.z=-.42;arms[1].rotation.z=.42;}
   else if(this.pose==="incense"){arms[0].rotation.x=-.6;arms[1].rotation.x=-.6;}
   else if(this.pose==="sweep"){arms[0].rotation.x=.15;arms[1].rotation.x=-.5;arms[1].rotation.z=.5*Math.sin(time*.01);}
  },
  dispose(){scene.remove(root);root.traverse(o=>{o.geometry?.dispose();if(o.material){const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){material.map?.dispose();material.dispose();}}});}
 };
}

export class TempleWorld{
 constructor(container){
  this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x9aaea4);this.scene.fog=new THREE.FogExp2(0x9aaea4,.0068);
  this.camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,440);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  this.mobile=matchMedia("(max-width: 660px)").matches;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.mobile?1.2:1.65));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;container.appendChild(this.renderer.domElement);
  this.yaw=0;this.pitch=.18;this.distance=10.5;this.drag=false;this.last={x:0,y:0};this.pointerStart={x:0,y:0};this.pointerMoved=false;this.moveTarget=null;this.raycaster=new THREE.Raycaster();this.pointerNdc=new THREE.Vector2();this.moveVelocity=new THREE.Vector2();this.jumpVelocity=0;this.jumpOffset=0;this.jumpHeld=false;this.local=null;this.remotes=new Map();this.effects=[];this.lotusPads=[];this.lotusLights=[];this.clock=new THREE.Clock();
  this.m=this.materials();this.build();this.collision=createTempleCollision(this.halls);this.buildNpcs();this.bindCamera();this.camera.position.set(0,5,35);this.camera.lookAt(0,1,25);
  this.resizeFn=()=>this.resize();addEventListener("resize",this.resizeFn);
 }
 materials(){
  const stoneTex=texture((x,w)=>{x.fillStyle="#817f72";x.fillRect(0,0,w,w);for(let y=0;y<w;y+=64)for(let a=0;a<w;a+=96){const j=(Math.random()-.5)*16;x.fillStyle="rgb("+(126+j)+","+(124+j)+","+(111+j)+")";x.fillRect(a+2,y+2,92,60);x.strokeStyle="rgba(38,42,35,.45)";x.lineWidth=3;x.strokeRect(a+2,y+2,92,60);}for(let i=0;i<13000;i++){x.fillStyle=Math.random()>.5?"rgba(255,255,255,.035)":"rgba(0,0,0,.04)";x.fillRect(Math.random()*w,Math.random()*w,1,1);}},5,5);
  const roofTex=texture((x,w)=>{x.fillStyle="#34443e";x.fillRect(0,0,w,w);for(let y=0;y<w;y+=28)for(let a=-28;a<w+28;a+=32){x.fillStyle=(Math.floor(y/28)+Math.floor(a/32))%2?"#4b5b50":"#3c4c42";x.beginPath();x.roundRect(a+(Math.floor(y/28)%2)*15,y+1,30,25,4);x.fill();x.strokeStyle="rgba(12,23,18,.65)";x.stroke();x.strokeStyle="rgba(215,198,153,.15)";x.beginPath();x.moveTo(a+5,y+4);x.lineTo(a+23,y+4);x.stroke();}},4,3);
  const wallTex=texture((x,w)=>{x.fillStyle="#c7bda6";x.fillRect(0,0,w,w);for(let i=0;i<9000;i++){x.fillStyle="rgba(45,35,22,"+(Math.random()*.07)+")";x.fillRect(Math.random()*w,Math.random()*w,2,2);}},2,2);
  const grassTex=texture((x,w)=>{x.fillStyle="#5e755c";x.fillRect(0,0,w,w);for(let i=0;i<12000;i++){x.fillStyle=Math.random()>.5?"rgba(23,56,34,.16)":"rgba(193,183,115,.12)";x.fillRect(Math.random()*w,Math.random()*w,2,5);}},7,7);
  return {
   stone:mat(0xffffff,.95,{map:stoneTex}),stoneLight:mat(0xb5af9d,.92),wall:mat(0xffffff,.92,{map:wallTex}),
   roof:new THREE.MeshStandardMaterial({map:roofTex,roughness:.9,side:THREE.DoubleSide}),
   pillar:mat(0x793d2e,.78),darkWood:mat(0x403126,.9),gold:mat(0xc3a36c,.58,{metalness:.25}),goldDark:mat(0x947748,.7),
   sign:mat(0x332a20,.85),bark:mat(0x594332,.95),pine:mat(0x365541,.95),pine2:mat(0x496748,.95),
   grass:mat(0xffffff,.98,{map:grassTex}),gravel:mat(0x8e897a,.98),paper:mat(0xd6bb83,.55,{emissive:0x6d4a20,emissiveIntensity:.2}),
   water:mat(0x527d7b,.22,{metalness:.12})
  };
 }
 build(){
  const s=this.scene,m=this.m;
  const skyCanvas=document.createElement("canvas");skyCanvas.width=8;skyCanvas.height=512;const skyCtx=skyCanvas.getContext("2d");const skyGradient=skyCtx.createLinearGradient(0,0,0,512);skyGradient.addColorStop(0,"#647d7c");skyGradient.addColorStop(.48,"#a8bcb0");skyGradient.addColorStop(.82,"#e0c9a2");skyGradient.addColorStop(1,"#c4b08f");skyCtx.fillStyle=skyGradient;skyCtx.fillRect(0,0,8,512);const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;const sky=new THREE.Mesh(new THREE.SphereGeometry(218,32,20),new THREE.MeshBasicMaterial({map:skyMap,side:THREE.BackSide,depthWrite:false,fog:false}));sky.frustumCulled=false;s.add(sky);
  s.add(new THREE.HemisphereLight(0xe8f0e5,0x59604d,2.05));
  const sun=new THREE.DirectionalLight(0xffe2b5,2.7);sun.position.set(-38,58,34);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-92,right:92,top:92,bottom:-92,near:.5,far:160});sun.shadow.bias=-.0002;s.add(sun);
  const fill=new THREE.DirectionalLight(0xb9d2cd,.75);fill.position.set(30,22,-36);s.add(fill);
  add(new THREE.PlaneGeometry(240,240),m.grass,s,[0,-.72,0],[-Math.PI/2,0,0],false);
  add(new THREE.PlaneGeometry(64,62),m.stone,s,[0,-.14,-2],[-Math.PI/2,0,0],false);
  const path=mat(0xb1a791,.95);add(new THREE.PlaneGeometry(8,70),path,s,[0,-.1,8],[-Math.PI/2,0,0],false);add(new THREE.PlaneGeometry(56,7),path,s,[0,-.1,-1],[-Math.PI/2,0,0],false);add(new THREE.PlaneGeometry(5,38),path,s,[0,-.1,-34],[-Math.PI/2,0,0],false);
  for(let ring=0;ring<2;ring++)for(let i=0;i<24;i++){const a=i*Math.PI/12+(ring?.12:0),r=100+ring*17;const hill=add(new THREE.ConeGeometry(17+Math.random()*13,38+Math.random()*30,7),mat(ring?0x70887e:0x81958b,.98),s,[Math.cos(a)*r,8-ring*2,Math.sin(a)*r],[0,Math.random(),(Math.random()-.5)*.12],false);hill.scale.set(1,.85,1.05);}
  for(let i=0;i<84;i++){const a=Math.random()*Math.PI*2,r=52+Math.random()*32,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<14&&z>12&&z<43)continue;pine(s,x,z,.72+Math.random()*.72,m);}
  // Four-sided ceremonial gate
  const gate=new THREE.Group();gate.position.z=31;s.add(gate);
  for(const x of [-4.8,4.8]){add(new THREE.BoxGeometry(.65,6.8,.72),m.pillar,gate,[x,3.4,0]);add(new THREE.BoxGeometry(1.1,.34,1.1),m.gold,gate,[x,6.9,0]);}
  add(new THREE.BoxGeometry(12,.68,1),m.darkWood,gate,[0,6.6,0]);add(new THREE.BoxGeometry(10,.2,1.1),m.pillar,gate,[0,7,0]);planeRoof(gate,10,3,9.15,8.15,1,m.roof);planeRoof(gate,10,3,9.15,8.15,-1,m.roof);add(new THREE.BoxGeometry(3.3,1.1,.17),m.darkWood,gate,[0,5.95,.58]);add(new THREE.BoxGeometry(2.25,.05,.04),m.gold,gate,[0,5.98,.69]);const gatePlaque=plaqueSprite("山门","MOUNTAIN GATE");gatePlaque.scale.set(2.7,.68,1);gatePlaque.position.set(0,5.98,.78);gate.add(gatePlaque);
  this.halls=[
   {x:0,z:-10,w:18,d:13,h:5.1,label:"天王殿",subtitle:"HALL OF HEAVENLY KINGS"},{x:0,z:-37,w:26,d:17,h:7.1,label:"大雄宝殿",subtitle:"MAHAVIRA HALL"},
   {x:-28,z:2,w:10,d:10,h:4.2,label:"钟楼",subtitle:"BELL PAVILION"},{x:28,z:-24,w:13,d:11,h:4.6,label:"藏经阁",subtitle:"SUTRA LIBRARY"},
   {x:-28,z:-25,w:13,d:10,h:4.2,label:"禅房",subtitle:"MEDITATION HALL"},{x:28,z:8,w:12,d:10,h:4.1,label:"僧舍",subtitle:"MONK QUARTERS"},{x:-29,z:31,w:11,d:9,h:3.8,label:"菩提院",subtitle:"BODHI COURTYARD"}
  ];this.halls.forEach(h=>hall(s,h,m));
  // Main sanctuary: a recognisable seated Buddha, traditional altar, and a quiet space for visitors.
  const altar=new THREE.Group();altar.position.set(0,0,-38.5);s.add(altar);
  const bud=mat(0xb28a4e,.48,{metalness:.32}),budDark=mat(0x76572f,.62,{metalness:.24}),goldLeaf=mat(0xd6b36f,.42,{metalness:.48});
  const darkWood=mat(0x39271d,.72),cushion=mat(0x8f332d,.92),cushionEdge=mat(0xc29a60,.76);
  // Raised lotus throne and carved altar tiers.
  add(new THREE.CylinderGeometry(2.15,2.35,.42,48),darkWood,altar,[0,.76,-.9]);
  add(new THREE.CylinderGeometry(2.02,2.18,.2,48),goldLeaf,altar,[0,1.05,-.9]);
  add(new THREE.CylinderGeometry(1.78,1.96,.48,48),budDark,altar,[0,1.36,-.9]);
  add(new THREE.TorusGeometry(1.72,.07,10,48),goldLeaf,altar,[0,1.57,-.9]);
  // Lotus petals around the Buddha's seat.
  for(let i=0;i<16;i++){
   const a=i*Math.PI*2/16,petal=add(new THREE.SphereGeometry(.52,14,10),i%2?goldLeaf:bud,altar,[Math.cos(a)*1.12,1.76,-.9+Math.sin(a)*1.12],[0,-a,0]);
   petal.scale.set(.48,.18,1.05);
  }
  // Cross-legged seated figure: broad folded legs, upright torso, shoulders and forearms.
  const legsSeat=add(new THREE.SphereGeometry(1,28,18),bud,altar,[0,1.98,-.88]);legsSeat.scale.set(1.38,.42,.86);
  const robeBody=add(new THREE.LatheGeometry([new THREE.Vector2(.62,0),new THREE.Vector2(.76,.22),new THREE.Vector2(.83,.72),new THREE.Vector2(.72,1.25),new THREE.Vector2(.52,1.62),new THREE.Vector2(.38,1.78)],32),bud,altar,[0,1.92,-.92]);
  const robeSeam=mat(0x74552e,.72,{metalness:.18});
  for(let i=0;i<9;i++){
   const x=-.58+i*.145;
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x*.55,3.47,-.31),new THREE.Vector3(x*.85,3.0,-.22),new THREE.Vector3(x,2.45,-.15),new THREE.Vector3(x*.9,2.1,-.2)]);
   altar.add(new THREE.Mesh(new THREE.TubeGeometry(curve,16,.014,6,false),robeSeam));
  }
  // Left and right arms rest naturally over the lap; hands meet in meditation mudra.
  for(const side of [-1,1]){
   const shoulder=add(new THREE.SphereGeometry(.39,18,14),bud,altar,[side*.72,3.28,-.91]);shoulder.scale.set(.92,1.15,.86);
   const upper=add(new THREE.CapsuleGeometry(.19,.56,6,12),bud,altar,[side*.77,2.92,-.48],[side*.18,0,side*-.13]);
   const forearm=add(new THREE.CapsuleGeometry(.17,.62,6,12),bud,altar,[side*.43,2.46,-.12],[Math.PI/2,0,side*.25]);
   add(new THREE.SphereGeometry(.18,16,12),bud,altar,[side*.13,2.35,.02]).scale.set(1.25,.62,.65);
  }
  // Neck, calm face, long earlobes, curled hair texture and ushnisha.
  add(new THREE.CylinderGeometry(.22,.27,.38,18),bud,altar,[0,3.67,-.94]);
  const face=add(new THREE.SphereGeometry(.48,28,22),bud,altar,[0,4.12,-.95]);face.scale.set(.84,1.12,.78);
  for(const side of [-1,1]){
   add(new THREE.SphereGeometry(.105,14,12),bud,altar,[side*.43,3.91,-.92]).scale.set(.72,1.55,.6);
   add(new THREE.SphereGeometry(.035,10,8),budDark,altar,[side*.19,4.18,-.25]).scale.set(1,.55,.5);
   const brow=add(new THREE.TorusGeometry(.13,.018,6,18,Math.PI),budDark,altar,[side*.18,4.27,-.25],[0,0,side*.06]);brow.rotation.x=Math.PI/2;
  }
  add(new THREE.SphereGeometry(.035,10,8),goldLeaf,altar,[0,4.12,-.22]);
  add(new THREE.SphereGeometry(.19,18,14),bud,altar,[0,4.62,-.95]).scale.set(.72,1,.72);
  // Fine raised curls on the scalp catch the warm interior lighting.
  for(let row=0;row<4;row++)for(let col=0;col<11;col++){
   const x=(col-5)*.064,y=4.39+row*.075,z=-.95-Math.sqrt(Math.max(.04,.19-x*x-(y-4.42)*(y-4.42)))*.72;
   if(Number.isFinite(z))add(new THREE.SphereGeometry(.026,7,6),budDark,altar,[x,y,z]);
  }
  // Twin halo rings and a restrained radial aureole behind the head.
  const halo=new THREE.Group();halo.position.set(0,4.12,-1.66);altar.add(halo);
  add(new THREE.TorusGeometry(1.13,.055,10,72),goldLeaf,halo);
  add(new THREE.TorusGeometry(1.32,.022,8,72),bud,halo);
  for(let i=0;i<24;i++){const a=i*Math.PI*2/24,ray=add(new THREE.CylinderGeometry(.012,.022,.23,6),goldLeaf,halo,[Math.cos(a)*1.23,Math.sin(a)*1.23,0],[0,0,-a]);}
  // Small offering table, incense vessel and paired butter lamps.
  add(new THREE.BoxGeometry(3.1,.18,.92),darkWood,altar,[0,1.05,1.12]);
  add(new THREE.BoxGeometry(2.85,.16,.72),goldLeaf,altar,[0,1.21,1.12]);
  for(const side of [-1,1]){
   add(new THREE.BoxGeometry(.16,.86,.16),darkWood,altar,[side*1.2,.57,1.12]);
   const lamp=new THREE.Group();lamp.position.set(side*1.02,1.32,1.12);altar.add(lamp);
   add(new THREE.CylinderGeometry(.13,.2,.12,16),goldLeaf,lamp,[0,0,0]);
   add(new THREE.ConeGeometry(.055,.22,10),mat(0xffb84e,.35,{emissive:0xff8b25,emissiveIntensity:.65}),lamp,[0,.16,0]);
   const light=new THREE.PointLight(0xffb76a,.32,4);light.position.set(0,.3,0);lamp.add(light);
  }
  const incenseBowl=new THREE.Group();incenseBowl.position.set(0,1.38,1.1);altar.add(incenseBowl);
  add(new THREE.CylinderGeometry(.22,.3,.22,18),budDark,incenseBowl,[0,0,0]);
  add(new THREE.TorusGeometry(.22,.035,8,24),goldLeaf,incenseBowl,[0,.12,0]);
  // Warm wall lanterns and framed lotus reliefs make the hall feel inhabited, not empty.
  for(const side of [-1,1]){
   const wallDecor=new THREE.Group();wallDecor.position.set(side*11.72,0,-38.1);altar.add(wallDecor);
   const frameMat=mat(0x493326,.78),reliefMat=mat(0xb58c52,.72,{metalness:.18});
   add(new THREE.BoxGeometry(.12,2.05,.12),frameMat,wallDecor,[0,3.65,0]);
   add(new THREE.BoxGeometry(.12,2.05,.12),frameMat,wallDecor,[0,3.65,.78]);
   add(new THREE.BoxGeometry(.12,.12,.9),reliefMat,wallDecor,[0,4.66,.39]);
   add(new THREE.BoxGeometry(.12,.12,.9),reliefMat,wallDecor,[0,2.64,.39]);
   const panel=add(new THREE.BoxGeometry(.055,1.82,.72),mat(0x8b6a43,.9),wallDecor,[0,3.65,.39]);
   const lotusRelief=new THREE.Group();lotusRelief.position.set(-side*.045,3.65,.39);wallDecor.add(lotusRelief);
   add(new THREE.TorusGeometry(.25,.025,7,28),reliefMat,lotusRelief,[0,0,0],[0,0,0]);
   for(let petal=0;petal<8;petal++){
    const a=petal*Math.PI/4;
    const bloom=add(new THREE.SphereGeometry(.16,10,8),reliefMat,lotusRelief,[Math.cos(a)*.22,Math.sin(a)*.22,.01]);
    bloom.scale.set(.42,1.1,.18);bloom.rotation.z=a;
   }
   const lantern=new THREE.Group();lantern.position.set(-side*10.92,3.75,-38.1);altar.add(lantern);
   add(new THREE.CylinderGeometry(.28,.22,.12,8),frameMat,lantern,[0,.57,0]);
   add(new THREE.CylinderGeometry(.22,.22,.82,8,1,true),mat(0xe3c98d,.7,{emissive:0x8a5b25,emissiveIntensity:.16,transparent:true,opacity:.9,side:THREE.DoubleSide}),lantern,[0,0,0]);
   add(new THREE.CylinderGeometry(.28,.28,.1,8),frameMat,lantern,[0,-.48,0]);
   add(new THREE.ConeGeometry(.07,.22,8),goldLeaf,lantern,[0,-.64,0]);
   const glow=new THREE.PointLight(0xffc77e,.42,5);glow.position.set(0,0,0);lantern.add(glow);
  }
  // Individual brocade kneeling cushions on the visitor side of the altar.
  for(const [x,z] of [[-2.55,4.7],[-.85,4.7],[.85,4.7],[2.55,4.7],[-1.7,6.45],[0,6.45],[1.7,6.45]]){
   const matGroup=new THREE.Group();matGroup.position.set(x,.58,z);altar.add(matGroup);
   const base=add(new THREE.BoxGeometry(1.28,.18,1.05),cushionEdge,matGroup,[0,0,0]);base.scale.set(1,.85,1);
   const pad=add(new THREE.BoxGeometry(1.16,.2,.93),cushion,matGroup,[0,.12,0]);pad.scale.set(1,.8,1);
   add(new THREE.BoxGeometry(1.05,.025,.025),goldLeaf,matGroup,[0,.225,.46]);
   for(const side of [-1,1])add(new THREE.SphereGeometry(.035,8,6),goldLeaf,matGroup,[side*.48,.23,.38]);
  }
  // Bell tower & bronze bell
  const bell=new THREE.Group();bell.position.set(-28,0,2);s.add(bell);
  add(new THREE.CylinderGeometry(1.05,1.28,2,24),mat(0x927444,.42,{metalness:.62}),bell,[0,2.25,0]);
  add(new THREE.TorusGeometry(1.1,.12,8,32),m.gold,bell,[0,3.15,0],[Math.PI/2,0,0]);
  add(new THREE.CylinderGeometry(.08,.08,1.8,10),m.darkWood,bell,[0,1.6,0]);add(new THREE.SphereGeometry(.2,10,8),m.gold,bell,[0,.85,0]);
  for(const [x,z] of [[-6,24],[6,24],[-12,-1],[12,-1],[-20,-39],[20,-39],[0,41]])lantern(s,x,z,m);
  // Incense censer
  this.incensePosition=new THREE.Vector3(8,0,0);const censer=new THREE.Group();censer.position.copy(this.incensePosition);s.add(censer);
  add(new THREE.CylinderGeometry(1.15,1.45,1.2,12),mat(0x71695b,.5,{metalness:.25}),censer,[0,.7,0]);
  add(new THREE.CylinderGeometry(1.36,1.12,.22,12),m.gold,censer,[0,1.4,0]);const incensePlaque=plaqueSprite("香炉广场","INCENSE COURTYARD");incensePlaque.scale.set(3.2,.8,1);incensePlaque.position.set(8,3.1,2.2);s.add(incensePlaque);
  // Lotus pond
  this.pondPosition=new THREE.Vector3(31,0,33);const pond=new THREE.Group();pond.position.copy(this.pondPosition);s.add(pond);
  add(new THREE.CylinderGeometry(10.2,10.4,.55,64),m.stone,pond,[0,-.03,0]);
  add(new THREE.CircleGeometry(9.8,64),m.water,pond,[0,.27,0],[-Math.PI/2,0,0],false);
  add(new THREE.TorusGeometry(10,.2,9,72),m.stoneLight,pond,[0,.3,0],[Math.PI/2,0,0]);const lotusPlaque=plaqueSprite("莲花池","LOTUS POND");lotusPlaque.scale.set(3.1,.78,1);lotusPlaque.position.set(0,3.8,10.5);pond.add(lotusPlaque);
  for(let i=0;i<17;i++){const a=Math.random()*Math.PI*2,r=1+Math.random()*7.8,x=Math.cos(a)*r,z=Math.sin(a)*r;const pad=add(new THREE.CircleGeometry(.52+Math.random()*.28,9),mat(0x557d5a,.58),pond,[x,.31,z],[-Math.PI/2,0,0],false);this.lotusPads.push({pad,phase:Math.random()*6.28});if(i%3===0){const flower=new THREE.Group();flower.position.set(x,.34,z);pond.add(flower);for(let j=0;j<7;j++){const a=j*Math.PI*2/7,p=add(new THREE.SphereGeometry(.15,8,8),mat(j%2?0xe7d6be:0xc68b92,.62),flower,[Math.cos(a)*.2,.05,Math.sin(a)*.2]);p.scale.set(.7,1.5,.6);}add(new THREE.SphereGeometry(.11,8,8),m.gold,flower,[0,.1,0]);}}
  // Bodhi tree
  const bodhi=new THREE.Group();bodhi.position.set(-29,0,29);s.add(bodhi);add(new THREE.CylinderGeometry(.7,1,7,12),m.bark,bodhi,[0,3.5,0]);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;add(new THREE.CylinderGeometry(.18,.34,4,8),m.bark,bodhi,[Math.cos(a)*1.4,5,Math.sin(a)*1.4],[0,0,-Math.cos(a)*.45]);}
  for(let i=0;i<24;i++){const a=i*2.399,r=.65+Math.random()*3.15,leaf=add(new THREE.IcosahedronGeometry(1.55+Math.random()*.55,1),i%3===0?m.pine2:m.pine,bodhi,[Math.cos(a)*r,6.8+Math.random()*3.0,Math.sin(a)*r],[Math.random()*.45,Math.random()*6.28,Math.random()*.45]);leaf.scale.set(1.15+Math.random()*.45,.72+Math.random()*.48,.9+Math.random()*.45);}
  // Boundary stones / decorative details
  for(const side of [-1,1]){add(new THREE.BoxGeometry(.5,.7,45),m.stone,s,[side*31,.18,-11]);for(let z=-30;z<10;z+=5)add(new THREE.BoxGeometry(.9,.9,.9),m.stoneLight,s,[side*31,.55,z]);}
  // Floating warm dust
  this.ambient=new THREE.Group();s.add(this.ambient);
  for(let i=0;i<90;i++){const d=add(new THREE.SphereGeometry(.035+Math.random()*.025,6,6),new THREE.MeshBasicMaterial({color:i%4?0xe9d9ad:0xffd78a,transparent:true,opacity:.25+Math.random()*.35}),this.ambient,[(Math.random()-.5)*72,1+Math.random()*11,(Math.random()-.5)*72],[0,0,0],false);d.userData.phase=Math.random()*8;d.userData.y=d.position.y;}
 }
 buildNpcs(){
  const roster=[
   {name:"净行",robe:"#a97950",skin:"#d4a27e",style:"monk",x:-3,z:23,route:[[-3,18],[2,13],[3,20]]},
   {name:"慧远",robe:"#b49a72",skin:"#c99170",style:"monk",x:4,z:4,route:[[4,4],[-4,3],[-4,-1],[3,-2]]},
   {name:"云游僧",robe:"#887b62",skin:"#d7ad87",style:"pilgrim",x:-25,z:10,route:[[-25,10],[-21,4],[-21,-1]]},
   {name:"明心",robe:"#c1ad88",skin:"#e0b995",style:"monk",x:23,z:-17,route:[[23,-17],[19,-15],[17,-18],[20,-20]]},
   {name:"守经人",robe:"#8d795d",skin:"#c99472",style:"monk",x:-22,z:-18,route:[[-22,-18],[-19,-16],[-18,-12],[-24,-12]]},
   {name:"行脚客",robe:"#9c805e",skin:"#d4a27e",style:"pilgrim",x:-21,z:23,route:[[-21,23],[-18,25],[-17,29],[-21,31]]},
   {name:"莲生",robe:"#ad8c70",skin:"#d6a784",style:"monk",x:18,z:28,route:[[18,28],[22,20],[15,18]]},
   {name:"小沙弥",robe:"#c3a477",skin:"#e0b995",style:"monk",x:18,z:8,route:[[18,8],[16,12],[19,16],[20,12]]},
   {name:"守殿僧",robe:"#a88b68",skin:"#c99170",style:"monk",x:-2.55,z:-33.8,route:[[-2.55,-33.8]],stationary:true}
  ];
  this.npcs=roster.map((spec,index)=>{
   const a=avatar(this.scene,spec,"npc-"+index,true);a.root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});a.setPosition(spec.x,spec.z,index%2?Math.PI:0,groundHeightAt(spec.x,spec.z,this.halls));
   const npc={avatar:a,route:spec.route.map(p=>new THREE.Vector3(p[0],0,p[1])),target:new THREE.Vector3(spec.x,0,spec.z),targetIndex:0,moving:false,nextAt:performance.now()+1200+index*900,stuckAt:0};
   if(index===3||index===6){a.setPose("bow",4500);npc.nextAt=performance.now()+4500;}
   if(index===4){a.setPose("meditate",9000);npc.nextAt=performance.now()+9000;}
   if(spec.stationary){a.setPose("meditate",24*60*60*1000);npc.stationary=true;npc.moving=false;}
   return npc;
  });
 }
 updateNpcs(dt,time){
  for(const npc of this.npcs||[]){
   const a=npc.avatar,p=a.root.position;
   if(npc.stationary){a.update(dt,time,false);continue;}
   if(npc.moving){
    const dx=npc.target.x-p.x,dz=npc.target.z-p.z,dist=Math.hypot(dx,dz);
    if(dist<.48){npc.moving=false;const idle=["bow","greet","meditate","chant","sweep"];a.setPose(idle[Math.floor(Math.random()*idle.length)],2600+Math.random()*1800);npc.nextAt=time+4200+Math.random()*5200;npc.stuckAt=0;}
    else{
     const step=Math.min(dist,1.25*dt),r=moveWithCollision(p,dx/dist*step,dz/dist*step,this.collision);
     p.set(r.x,r.y,r.z);
     if(r.blocked){npc.stuckAt=npc.stuckAt||time;if(time-npc.stuckAt>4500){npc.moving=false;npc.nextAt=time+800;npc.stuckAt=0;}}
     else npc.stuckAt=0;
     a.root.rotation.y=Math.atan2(dx,dz);
    }
   }else if(time>=npc.nextAt){
    npc.targetIndex=(npc.targetIndex+1)%npc.route.length;
    const target=npc.route[npc.targetIndex];npc.target.copy(target);
    a.setPose("walk",60000);npc.moving=true;
   }
   a.update(dt,time,npc.moving);
  }
 }
 bindCamera(){
  const c=this.renderer.domElement;
  c.addEventListener("pointerdown",e=>{this.drag=true;this.pointerMoved=false;this.pointerStart={x:e.clientX,y:e.clientY};this.last={x:e.clientX,y:e.clientY};c.setPointerCapture(e.pointerId);});
  c.addEventListener("pointerup",e=>{
   if(!this.drag)return;this.drag=false;
   if(!this.pointerMoved&&this.local)this.setClickDestination(e.clientX,e.clientY);
  });
  c.addEventListener("pointercancel",()=>this.drag=false);
  c.addEventListener("pointermove",e=>{
   if(!this.drag)return;
   const dx=e.clientX-this.last.x,dy=e.clientY-this.last.y;
   if(Math.hypot(e.clientX-this.pointerStart.x,e.clientY-this.pointerStart.y)>7)this.pointerMoved=true;
   if(this.pointerMoved){this.yaw-=dx*.0042;this.pitch=clamp(this.pitch+dy*.003,-.05,.78);}
   this.last={x:e.clientX,y:e.clientY};
  });
  c.addEventListener("wheel",e=>{this.distance=clamp(this.distance+Math.sign(e.deltaY)*.7,6.5,18);},{passive:true});
 }
 setClickDestination(clientX,clientY){
  const rect=this.renderer.domElement.getBoundingClientRect();
  this.pointerNdc.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
  this.raycaster.setFromCamera(this.pointerNdc,this.camera);
  const hit=this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
  if(!hit||Math.abs(hit.x)>70||Math.abs(hit.z)>70||collidesAt(hit.x,hit.z,this.collision))return false;
  this.moveTarget=new THREE.Vector3(hit.x,0,hit.z);
  return true;
 }
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();const mobile=matchMedia("(max-width: 660px)").matches;if(mobile!==this.mobile){this.mobile=mobile;this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.2:1.65));}this.renderer.setSize(innerWidth,innerHeight);}
 setLocalProfile(p,id){if(this.local){const oldStyle=this.local.profile?.style,pos=this.getPosition();this.local.setProfile(p);if(oldStyle!==p.style){this.local.dispose();this.local=avatar(this.scene,p,id,true);this.local.setPosition(pos.x,pos.z,pos.rotation,groundHeightAt(pos.x,pos.z,this.halls));}return;}this.local=avatar(this.scene,p,id,true);this.local.setPosition(0,25,0,groundHeightAt(0,25,this.halls));}
 addRemote(p){if(!p?.id||p.id===this.local?.id)return;if(this.remotes.has(p.id)){this.updateRemote(p);return;}const a=avatar(this.scene,p,p.id);a.setPosition(p.x,p.z,p.rotation||0);a.setTarget(p);this.remotes.set(p.id,a);}
 updateRemote(p){if(!p?.id||p.id===this.local?.id)return;let a=this.remotes.get(p.id);if(!a){this.addRemote(p);return;}if(a.profile.style!==p.style){const pos=a.root.position.clone(),rotation=a.root.rotation.y;a.dispose();a=avatar(this.scene,p,p.id);a.setPosition(pos.x,pos.z,rotation);this.remotes.set(p.id,a);}else if(a.profile.name!==p.name||a.profile.robe!==p.robe||a.profile.skin!==p.skin)a.setProfile(p);a.setTarget(p);}
 removeRemote(id){const a=this.remotes.get(id);if(a){a.dispose();this.remotes.delete(id);}}
 setDebugPosition(x,z){if(this.local)this.local.setPosition(x,z,this.local.root.rotation.y,groundHeightAt(x,z,this.halls));}
 setDebugYaw(yaw){this.yaw=Number(yaw)||0;}
 setLocalPose(action){
  if(!this.local)return;
  if(action==="meditate"){
   const cushions=[[-2.55,4.7],[-.85,4.7],[.85,4.7],[2.55,4.7],[-1.7,6.45],[0,6.45],[1.7,6.45]];
   const p=this.local.root.position,altarZ=-38.5;
   const nearest=cushions.map(([x,z])=>({x,z,d:Math.hypot(p.x-x,p.z-(altarZ+z))})).sort((a,b)=>a.d-b.d)[0];
   if(nearest&&nearest.d<2.35)this.local.setPosition(nearest.x,altarZ+nearest.z,Math.PI,.54);
  }
  this.local.setPose(action);
 }
 getPosition(){const p=this.local?.root.position;return p?{x:p.x,z:p.z,rotation:this.local.root.rotation.y}:{x:0,z:25,rotation:0};}
 currentLocation(){
  const p=this.local?.root.position||{x:0,z:25};
  const pts=[{x:0,z:28,index:0,key:"gate"},{x:0,z:-10,index:1,key:"heaven"},{x:0,z:-37,index:2,key:"main"},{x:8,z:0,index:3,key:"incense"},{x:-28,z:2,index:4,key:"bell"},{x:28,z:-24,index:5,key:"library"},{x:-28,z:-25,index:6,key:"meditation"},{x:-29,z:31,index:7,key:"bodhi"},{x:31,z:33,index:8,key:"lotus"},{x:28,z:8,index:9,key:"dorm"}];
  return pts.reduce((b,a)=>Math.hypot(p.x-a.x,p.z-a.z)<Math.hypot(p.x-b.x,p.z-b.z)?a:b,pts[0]);
 }
 canAct(a){
  const p=this.local?.root.position;if(!p)return false;
  if(a==="incense")return Math.hypot(p.x-8,p.z)<8;
  if(a==="bell")return Math.hypot(p.x+28,p.z-2)<8;
  if(a==="lotus")return Math.hypot(p.x-31,p.z-33)<13;
  if(a==="sweep")return Math.hypot(p.x,p.z)<38;
  if(a==="meditate"){
   const cushions=[[-2.55,4.7],[-.85,4.7],[.85,4.7],[2.55,4.7],[-1.7,6.45],[0,6.45],[1.7,6.45]];
   return cushions.some(([x,z])=>Math.hypot(p.x-x,p.z-(-38.5+z))<2.35);
  }
  return true;
 }
 update(dt,input={},time=performance.now()){
  if(!this.local)return;
  const f=(input.forward||0)-(input.backward||0)+(input.joyY||0);
  const side=(input.right||0)-(input.left||0)+(input.joyX||0);
  const hasInput=Math.hypot(f,side)>.05;if(hasInput)this.moveTarget=null;
  if(this.local.until&&time>this.local.until){this.local.pose="walk";this.local.until=0;}
  const canMove=["walk","greet","bow","chant"].includes(this.local.pose);
  let direction=null;
  if(hasInput&&canMove){
   const fw=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
   const rt=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
   direction=fw.multiplyScalar(f).add(rt.multiplyScalar(side)).normalize();
  }else if(this.moveTarget&&canMove){
   const dx=this.moveTarget.x-this.local.root.position.x,dz=this.moveTarget.z-this.local.root.position.z;
   if(Math.hypot(dx,dz)<.62)this.moveTarget=null;
   else direction=new THREE.Vector3(dx,0,dz).normalize();
  }
  const topSpeed=direction?(input.run?5.2:2.8):0;
  const desired=new THREE.Vector2(direction?.x||0,direction?.z||0).multiplyScalar(topSpeed);
  const response=1-Math.exp(-dt*(direction?13:19));
  this.moveVelocity.lerp(desired,response);
  if(this.moveVelocity.length()<.012)this.moveVelocity.set(0,0);
  const moving=this.moveVelocity.length()>.03;
  let result={x:this.local.root.position.x,y:groundHeightAt(this.local.root.position.x,this.local.root.position.z,this.halls),z:this.local.root.position.z,blocked:false};
  if(moving&&canMove){
   const localPosition=this.local.root.position;
   // Collision is resolved before vertical motion, so a jump cannot tunnel through masonry or stair edges.
   result=moveWithCollision(localPosition,this.moveVelocity.x*dt,this.moveVelocity.y*dt,this.collision);
   if(result.blocked){this.moveVelocity.multiplyScalar(.28);if(this.moveTarget)this.moveTarget=null;}
   if(direction)this.local.root.rotation.y=Math.atan2(direction.x,direction.z);
  }
  const localPosition=this.local.root.position;
  const groundY=groundHeightAt(result.x,result.z,this.halls);
  const wantsJump=!!input.jump;
  if(wantsJump&&!this.jumpHeld&&this.jumpOffset<=.001&&canMove)this.jumpVelocity=4.35;
  this.jumpHeld=wantsJump;
  if(this.jumpOffset>0||this.jumpVelocity>0){
   this.jumpVelocity-=12.8*dt;this.jumpOffset+=this.jumpVelocity*dt;
   if(this.jumpOffset<=0){this.jumpOffset=0;this.jumpVelocity=0;}
  }
  localPosition.set(result.x,groundY+this.jumpOffset,result.z);
  this.lastMovement={forward:f,side,dt,moving,pose:this.local.pose,blocked:result.blocked,jumping:this.jumpOffset>0,position:{x:localPosition.x,y:localPosition.y,z:localPosition.z}};
  this.local.update(dt,time,moving&&this.local.pose==="walk");
  // Remote players are also resolved against the same masonry and stair geometry.
  for(const a of this.remotes.values()){
   const p=a.root.position,dx=a.target.x-p.x,dz=a.target.z-p.z,len=Math.hypot(dx,dz);
   if(len>.025){const step=Math.min(len,5.2*dt),r=moveWithCollision(p,dx/len*step,dz/len*step,this.collision);p.set(r.x,r.y,r.z);}
   else p.y=groundHeightAt(p.x,p.z,this.halls);
   a.update(dt,time,false);
  }
  this.updateNpcs(dt,time);
  const cameraTargetPosition=this.local.root.position,target=new THREE.Vector3(cameraTargetPosition.x+Math.sin(this.yaw)*this.distance,cameraTargetPosition.y+3.15+Math.sin(this.pitch)*this.distance*.75,cameraTargetPosition.z+Math.cos(this.yaw)*this.distance);
  this.camera.position.lerp(target,1-Math.pow(.0007,dt));this.camera.lookAt(cameraTargetPosition.x,cameraTargetPosition.y+1.2,cameraTargetPosition.z);
  for(const item of this.lotusPads)item.pad.position.y=.31+Math.sin(time*.001+item.phase)*.025;
  for(const item of this.lotusLights){item.group.position.y=.35+Math.sin(time*.0012+item.phase)*.09;item.group.rotation.y+=dt*.16;}
  for(const d of this.ambient.children){d.position.y=d.userData.y+Math.sin(time*.0006+d.userData.phase)*.35;d.position.x+=Math.sin(time*.00017+d.userData.phase)*.0007;}
  this.updateEffects(dt);this.renderer.render(this.scene,this.camera);
 }
 addEffect(type,position=null){
  const p=position?new THREE.Vector3(position.x,0,position.z):(this.local?.root.position||new THREE.Vector3()),g=new THREE.Group();g.position.copy(p);if(type==="bell")g.position.set(-28,0,2);this.scene.add(g);
  if(type==="incense"){for(let i=0;i<12;i++){const puff=add(new THREE.SphereGeometry(.11+Math.random()*.1,7,6),new THREE.MeshBasicMaterial({color:0xe7e1d1,transparent:true,opacity:.32}),g,[Math.random()*.4-.2,1.5+Math.random()*.2,Math.random()*.4-.2],[0,0,0],false);puff.userData.life=3;puff.userData.vy=.6;}}
  else if(type==="lotus"){
   for(let i=0;i<7;i++){const a=i*Math.PI*2/7,petal=add(new THREE.SphereGeometry(.17,8,8),mat(0xe6c9c6,.65,{emissive:0x4f2523,emissiveIntensity:.3}),g,[Math.cos(a)*.23,.2,Math.sin(a)*.23]);petal.scale.set(.7,1.6,.55);}
   add(new THREE.SphereGeometry(.11,8,8),this.m.gold,g,[0,.2,0]);
   const l=new THREE.PointLight(0xffdca5,1.7,5);l.position.y=.8;g.add(l);
   g.position.set(this.pondPosition.x,.35,this.pondPosition.z);
   this.lotusLights.push({group:g,phase:Math.random()*6.28});
   if(this.lotusLights.length>24){const old=this.lotusLights.shift();this.scene.remove(old.group);old.group.traverse(o=>{o.geometry?.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();});}
   return;
  }
  else {for(let i=0;i<12;i++){const d=add(new THREE.SphereGeometry(.045,6,6),new THREE.MeshBasicMaterial({color:0xf2d59a,transparent:true,opacity:.7}),g,[(Math.random()-.5)*1.5,1.7+Math.random()*1.4,(Math.random()-.5)*.7],[0,0,0],false);d.userData.life=1.5;d.userData.vy=.35;}}
  this.effects.push({group:g,life:type==="sweep"?1.3:3});
 }
 updateEffects(dt){for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;for(const c of e.group.children)if(c.userData.life){c.userData.life-=dt;c.position.y+=dt*(c.userData.vy||.1);if(c.material?.opacity!==undefined)c.material.opacity=Math.max(0,c.userData.life/3)*.35;}if(e.life<=0){this.scene.remove(e.group);e.group.traverse(o=>{o.geometry?.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();});this.effects.splice(i,1);}}}
 dispose(){removeEventListener("resize",this.resizeFn);this.local?.dispose();for(const a of this.remotes.values())a.dispose();for(const item of this.lotusLights){this.scene.remove(item.group);item.group.traverse(o=>{o.geometry?.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();});}this.renderer.dispose();if(this.renderer.domElement.parentElement===this.container)this.container.removeChild(this.renderer.domElement);}
}