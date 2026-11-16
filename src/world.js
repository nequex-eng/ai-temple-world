import * as THREE from "three";
import { createTempleCollision, moveWithCollision, groundHeightAt, collidesAt, findWalkPath } from "./physics.js?v=20261116-r9";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const HALL_CUSHION_OFFSETS=[
 [-2.55,4.7],[-.85,4.7],[.85,4.7],[2.55,4.7],[-1.7,6.45],[0,6.45],[1.7,6.45],[-5.1,3.3],
 ...[-7.5,-5,5,7.5].map(x=>[x,4.7]),
 ...[-7.5,-5,5,7.5].map(x=>[x,6.45]),
 ...[-6,-3,0,3,6].map(x=>[x,8.25]),
 ...[-8,-4,4,8].map(x=>[x,2.8])
];
const MEDITATION_CUSHIONS=HALL_CUSHION_OFFSETS.map(([x,z])=>[x,-38.5+z]);
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
function robeNamePlate(name){
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=208;
 const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineJoin="round";
 const label=String(name||"行者").trim().slice(0,12);
 ctx.font='bold 112px "Songti SC","Noto Serif CJK SC",serif';
 ctx.shadowColor="rgba(0,0,0,.9)";ctx.shadowBlur=12;ctx.lineWidth=24;
 ctx.strokeStyle="rgba(22,20,16,.96)";ctx.strokeText(label,512,104,980);
 ctx.shadowBlur=0;ctx.fillStyle="#fff0c9";ctx.fillText(label,512,104,980);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
 sprite.position.set(0,2.88,0);sprite.scale.set(1.95,.4,1);sprite.renderOrder=8;
 return sprite;
}

function pine(scene,x,z,s,m){
 const list=scene.userData.pineInstances||(scene.userData.pineInstances=[]);list.push({x,z,s});
}
function addInstancedPines(scene,m){
 const specs=scene.userData.pineInstances||[];delete scene.userData.pineInstances;if(!specs.length)return;
 const dummy=new THREE.Object3D();
 const place=(mesh,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>{dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);};
 const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.3,3.1,9),m.bark,specs.length);
 const branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.085,1.35,6),m.bark,specs.length*2);
 const crownGeometry=new THREE.ConeGeometry(1.9,2.9,9);
 const crowns=[new THREE.InstancedMesh(crownGeometry,m.pine,specs.length*2),new THREE.InstancedMesh(crownGeometry,m.pine2,specs.length*2)];
 let branchIndex=0;const crownIndex=[0,0];
 specs.forEach((tree,treeIndex)=>{
  const {x,z,s}=tree;place(trunk,treeIndex,x,1.55*s,z,s,s,s);
  for(let i=0;i<4;i++){
   const angle=i*2.17+Math.random()*.24,offset=.12+Math.random()*.12,materialIndex=i%2;
   const mesh=crowns[materialIndex],index=crownIndex[materialIndex]++;
   const variationX=.92+Math.random()*.17,variationY=.9+Math.random()*.16,variationZ=.92+Math.random()*.17,radius=(1.9-i*.32)/1.9;
   place(mesh,index,x+Math.cos(angle)*offset*s,(2.05+i*.78)*s,z+Math.sin(angle)*offset*s,s*radius*variationX,s*variationY,s*radius*variationZ,Math.sin(angle)*.035,i*.31,Math.cos(angle)*.035);
  }
  for(let i=0;i<2;i++){const a=i*Math.PI+.4;place(branches,branchIndex++,x+Math.cos(a)*.46*s,2.1*s,z+Math.sin(a)*.46*s,s,s,s,Math.sin(a)*.65,0,Math.cos(a)*-.65);}
 });
 for(const mesh of [trunk,branches,...crowns]){mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);mesh.castShadow=false;mesh.receiveShadow=false;mesh.computeBoundingSphere();scene.add(mesh);}
}
function addInstancedHills(scene,specs){
 if(!specs.length)return;
 const geometry=new THREE.ConeGeometry(1,1,7),materials=[mat(0x81958b,.98),mat(0x70887e,.98)];
 for(let ring=0;ring<2;ring++){
  const rows=specs.filter(item=>item.ring===ring),mesh=new THREE.InstancedMesh(geometry,materials[ring],rows.length),dummy=new THREE.Object3D();
  rows.forEach((hill,index)=>{dummy.position.set(hill.x,hill.y,hill.z);dummy.rotation.set(0,hill.ry,hill.rz);dummy.scale.set(hill.radius,hill.height*.85,hill.radius*1.05);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);});
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);mesh.castShadow=false;mesh.receiveShadow=false;mesh.computeBoundingSphere();scene.add(mesh);
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
 // One continuous platform: the worn tile texture is the +Y face of this same box.
 // A separate coplanar tile plane caused the entrance rows to depth-fight as the camera moved.
 const floorMap=texture((ctx,size)=>{
  ctx.fillStyle="#a69d89";ctx.fillRect(0,0,size,size);
  const tile=64;
  for(let y=0;y<size;y+=tile)for(let x=0;x<size;x+=tile){
   const tone=Math.round(153+Math.random()*20);
   ctx.fillStyle="rgb("+tone+","+(tone-5)+","+(tone-17)+")";
   ctx.fillRect(x+2,y+2,tile-4,tile-4);
   ctx.strokeStyle="rgba(54,48,39,.38)";ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,tile-2,tile-2);
   ctx.strokeStyle="rgba(255,245,220,.18)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+5,y+5);ctx.lineTo(x+tile-6,y+5);ctx.stroke();
  }
  for(let i=0;i<9000;i++){ctx.fillStyle=Math.random()>.5?"rgba(55,49,40,.035)":"rgba(255,255,255,.045)";ctx.fillRect(Math.random()*size,Math.random()*size,1,1);}
 },3,2);
 const tileMaterial=new THREE.MeshStandardMaterial({map:floorMap,roughness:.96,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const platform=new THREE.Mesh(new THREE.BoxGeometry(w+2.2,.54,d+2.2),[m.stone,m.stone,tileMaterial,m.stone,m.stone,m.stone]);
 platform.position.set(0,.27,0);platform.castShadow=true;platform.receiveShadow=false;g.add(platform);
 // The three stone treads start exactly at the platform edge and meet without gaps or overlap.
 const stairHeights=[.54,.36,.18];
 for(let i=0;i<3;i++)add(new THREE.BoxGeometry(w*.62,.18,1.0),m.stoneLight,g,[0,stairHeights[i]-.09,d/2+1.6+i]);
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
  if(Math.abs(px)<w*.36)continue;
  add(new THREE.CylinderGeometry(.16,.2,h,10),m.pillar,g,[px,.54+h/2,d/2-.35]);
  add(new THREE.BoxGeometry(.48,.16,.54),m.gold,g,[px,.54+h-.08,d/2-.35]);
 }
 const doorW=w*.34;
 // Leave both heavy timber leaves fully folded toward the jambs; the central
 // passage remains visibly open and wide enough for mobile and desktop avatars.
 add(new THREE.BoxGeometry(doorW*.28,h*.75,.18),m.darkWood,g,[-doorW*.72,.54+h*.38,d/2-.06],[0,-1.38,0]);
 add(new THREE.BoxGeometry(doorW*.28,h*.75,.18),m.darkWood,g,[doorW*.72,.54+h*.38,d/2-.06],[0,1.38,0]);
 for(const side of [-1,1]){
  const px=side*w*.46;
  add(new THREE.BoxGeometry(w*.14,h*.4,.13),m.darkWood,g,[px,.54+h*.55,d/2+.02]);
  for(let j=-2;j<=2;j++)add(new THREE.BoxGeometry(.035,h*.38,.05),m.goldDark,g,[px+j*w*.034,.54+h*.55,d/2+.1],[0,0,0],false);
  for(let j=0;j<4;j++)add(new THREE.BoxGeometry(w*.17,.035,.05),m.goldDark,g,[px,.54+h*.37+j*h*.095,d/2+.1],[0,0,0],false);
 }
 add(new THREE.BoxGeometry(w+1.8,.42,.6),m.darkWood,g,[0,.54+h-.24,d/2+.08]);
 add(new THREE.BoxGeometry(w+1.8,.42,.6),m.darkWood,g,[0,.54+h-.24,-d/2-.08]);
 const roofMat=m.roof,ry=.54+h+2.25,ey=.54+h+1.15;
 planeRoof(g,w,d,ry,ey,1,roofMat);planeRoof(g,w,d,ry,ey,-1,roofMat);
 add(new THREE.CylinderGeometry(.12,.12,w+2.6,10),m.gold,g,[0,ry+.1,0],[0,0,Math.PI/2]);
 for(const sx of [-1,1])for(const sz of [-1,1])add(new THREE.SphereGeometry(.22,9,8),m.gold,g,[sx*(w/2+1.55),ey+.18,sz*(d/2+1.0)]);
 // No separate signboard geometry.
 // Avoid shadow-map acne on the close, broad masonry surfaces.
 g.traverse(o=>{if(o.isMesh)o.receiveShadow=false;});
 // All floating/overlaid plaques are intentionally omitted to prevent z-fighting and clipping.
 return g;
}
function lantern(scene,x,z,m){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 add(new THREE.BoxGeometry(.18,1.9,.18),m.stoneLight,g,[0,.95,0]);
 add(new THREE.BoxGeometry(.9,.16,.9),m.stone,g,[0,1.9,0]);
 add(new THREE.BoxGeometry(.55,.7,.55),m.paper,g,[0,2.35,0]);
 add(new THREE.ConeGeometry(.7,.42,4),m.roof,g,[0,2.9,0],[0,Math.PI/4,0]);
 add(new THREE.ConeGeometry(.08,.34,6),m.gold,g,[0,3.26,0]);
 const l=new THREE.PointLight(0xffce8c,.52,12);l.position.set(0,2.3,0);g.add(l);
 const inner=add(new THREE.BoxGeometry(.38,.5,.38),new THREE.MeshBasicMaterial({color:0xffd99a}),g,[0,2.35,0],[0,0,0],false);
 return {group:g,light:l,flame:inner};
}
function marketLabel(kind,lang="zh"){
 const labels={
  zh:{noodles:"素凉面 · 凉茶",incense:"香烛 · 莲灯",coffee:"咖啡 · 茶饮",fruit:"素食点心 · 时令水果",fortune:"算命 · 求签",souvenir:"寺院文创 · 纪念品",mcdonalds:"麦当劳 · 汉堡"},
  en:{noodles:"Noodles · Herbal Tea",incense:"Incense · Lotus Lamps",coffee:"Coffee · Tea",fruit:"Vegetarian Snacks · Fruit",fortune:"Fortune Reading",souvenir:"Temple Gifts · Souvenirs",mcdonalds:"McDonald's · Burgers"},
  ja:{noodles:"精進麺 · お茶",incense:"お香 · 蓮灯",coffee:"コーヒー · お茶",fruit:"精進菓子 · 果物",fortune:"占い · おみくじ",souvenir:"寺院グッズ · お土産",mcdonalds:"マクドナルド · バーガー"},
  ko:{noodles:"채식 국수 · 차",incense:"향 · 연등",coffee:"커피 · 차",fruit:"채식 간식 · 과일",fortune:"운세 · 점괘",souvenir:"사찰 기념품",mcdonalds:"맥도날드 · 버거"},
  th:{noodles:"บะหมี่เจ · ชาสมุนไพร",incense:"ธูป · โคมบัว",coffee:"กาแฟ · ชา",fruit:"ของว่างเจ · ผลไม้",fortune:"ดูดวง · เสี่ยงเซียมซี",souvenir:"ของที่ระลึกวัด",mcdonalds:"แมคโดนัลด์ · เบอร์เกอร์"}
 };
 return (labels[lang]||labels.zh)[kind]||"Temple Goods";
}
function marketStall(scene,x,z,side,kind,m){
 const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=side<0?Math.PI/2:-Math.PI/2;scene.add(root);
 const wood=mat(0x563b2a,.9),edge=mat(0x9a7047,.78);
 const canopyColors={noodles:0xb66a43,incense:0x8b493c,coffee:0x66503d,fruit:0x71816a,fortune:0x6d5848,souvenir:0x53766c,mcdonalds:0xb82e28};
 const cloth=mat(canopyColors[kind]||0x71816a,.95);
 add(new THREE.BoxGeometry(3.15,.18,1.18),wood,root,[0,.92,0]);add(new THREE.BoxGeometry(3.28,.09,1.28),edge,root,[0,1.055,0]);
 for(const xx of [-1.42,1.42])for(const zz of [-.48,.48])add(new THREE.CylinderGeometry(.055,.07,2.55,8),wood,root,[xx,1.82,zz]);
 add(new THREE.BoxGeometry(3.55,.13,1.65),cloth,root,[0,2.62,0]);add(new THREE.BoxGeometry(3.55,.11,.12),edge,root,[0,2.52,.77]);
 for(let i=0;i<7;i++)add(new THREE.BoxGeometry(.49,.11,1.66),i%2?cloth:mat(0xd8c5a1,.96),root,[-1.5+i*.5,2.5,0]);
 if(kind==='noodles'){
  for(const xx of [-.95,0,.95]){add(new THREE.CylinderGeometry(.28,.2,.16,18),mat(0xe7d8bf,.45),root,[xx,1.2,.02]);add(new THREE.TorusGeometry(.22,.018,6,18),mat(0xb77d4d,.6),root,[xx,1.29,.02],[Math.PI/2,0,0]);for(let n=0;n<5;n++)add(new THREE.TorusGeometry(.045,.012,5,10),mat(0xd5b76c,.7),root,[xx+(Math.random()-.5)*.18,1.3,.02+(Math.random()-.5)*.15],[Math.PI/2,0,0]);}
  add(new THREE.BoxGeometry(.62,.09,.42),mat(0x6b9a54,.8),root,[.1,1.18,-.42]);
 }else if(kind==='incense'){
  for(let i=0;i<5;i++){const bundle=new THREE.Group();bundle.position.set(-1+i*.48,1.3,.04);root.add(bundle);for(let j=0;j<7;j++)add(new THREE.CylinderGeometry(.012,.018,.72+(j%3)*.08,5),mat(j%2?0x9b6544:0x6f4636,.9),bundle,[(j-3)*.035,0,(j%2)*.035]);add(new THREE.CylinderGeometry(.11,.11,.08,10),edge,bundle,[0,-.39,0]);}
 }else if(kind==='coffee'){
  add(new THREE.CylinderGeometry(.22,.28,.42,16),mat(0x38302a,.55,{metalness:.25}),root,[-.85,1.34,0]);add(new THREE.CylinderGeometry(.17,.2,.16,16),edge,root,[-.85,1.64,0]);
  for(const xx of [-.35,.35,1.05]){add(new THREE.CylinderGeometry(.12,.1,.22,12),mat(0xe6d7bd,.38),root,[xx,1.23,.05]);add(new THREE.TorusGeometry(.095,.025,6,14),edge,root,[xx,1.35,.05],[Math.PI/2,0,0]);}
  for(let i=0;i<12;i++)add(new THREE.SphereGeometry(.035,7,6),mat(0x493326,.9),root,[(Math.random()-.5)*.38,1.18,-.42+(Math.random()-.5)*.25]);
 }else if(kind==="fortune"){
  add(new THREE.BoxGeometry(.72,.08,.42),edge,root,[-.65,1.18,.05]);
  add(new THREE.SphereGeometry(.19,16,12),mat(0x36595b,.2,{metalness:.25}),root,[-.65,1.42,.05]);
  for(let i=0;i<7;i++)add(new THREE.CylinderGeometry(.018,.025,.56,5),mat(i%2?0x9a6a3d:0x6e4a32,.8),root,[.25+(i%4)*.17,1.35+(i%3)*.025,-.18+Math.floor(i/4)*.26]);
  add(new THREE.BoxGeometry(.38,.045,.5),mat(0xd6c49e,.94),root,[.95,1.16,-.28],[0,-.12,0]);
 }else if(kind==="souvenir"){
  for(let i=0;i<6;i++){
   const x=-1.12+(i%3)*.68,z=-.28+Math.floor(i/3)*.52;
   add(new THREE.BoxGeometry(.46,.34,.42),mat([0x9a543e,0x55776c,0xb58b4b][i%3],.82),root,[x,1.34,z]);
   add(new THREE.CylinderGeometry(.09,.1,.24,10),mat(i%2?0xd5c29d:0x6d8977,.72),root,[x,1.62,z]);
  }
 }else if(kind==="mcdonalds"){
  add(new THREE.BoxGeometry(.92,.12,.66),mat(0xe9d7b4,.62),root,[0,1.16,.02]);
  add(new THREE.CylinderGeometry(.13,.17,.26,14),mat(0xb82e28,.48),root,[-.95,1.33,-.04]);
  add(new THREE.CylinderGeometry(.145,.145,.035,14),mat(0xf0d56c,.45),root,[-.95,1.48,-.04]);
  add(new THREE.SphereGeometry(.22,12,9),mat(0xb88743,.9),root,[.15,1.37,.02]).scale.set(1,.55,1);
  add(new THREE.CylinderGeometry(.22,.22,.075,14),mat(0x4d3928,.9),root,[.15,1.29,.02]);
  add(new THREE.SphereGeometry(.18,12,9),mat(0x9a3c2f,.9),root,[.15,1.47,.02]).scale.set(1,.32,1);
 }else{
  for(let i=0;i<6;i++)add(new THREE.SphereGeometry(.18,10,8),mat([0xb84d38,0xc99b43,0x6d8c50][i%3],.72),root,[-1+(i%3)*.75,1.28,Math.floor(i/3)*.32-.12]);
 }
 for(const xx of [-1.35,1.35]){add(new THREE.BoxGeometry(.12,.48,.12),wood,root,[xx,2.22,.78]);add(new THREE.BoxGeometry(.3,.34,.3),m.paper,root,[xx,1.9,.78]);add(new THREE.ConeGeometry(.22,.16,4),m.darkWood,root,[xx,2.15,.78],[0,Math.PI/4,0]);}
 const productLabel=marketLabel(kind,"zh");
 const signCanvas=document.createElement("canvas");signCanvas.width=768;signCanvas.height=176;
 const ctx=signCanvas.getContext("2d");ctx.fillStyle=kind==="mcdonalds"?"#a82524":"#3b2b20";ctx.fillRect(0,0,768,176);
 ctx.strokeStyle="#d8bd82";ctx.lineWidth=9;ctx.strokeRect(12,12,744,152);
 ctx.textAlign="center";ctx.textBaseline="middle";ctx.font='bold 66px "Songti SC","Noto Serif CJK SC",serif';
 ctx.fillStyle=kind==="mcdonalds"?"#ffdf75":"#fff0cc";ctx.shadowColor="rgba(255,211,129,.55)";ctx.shadowBlur=8;ctx.fillText(productLabel,384,88,700);
 const signMap=new THREE.CanvasTexture(signCanvas);signMap.colorSpace=THREE.SRGBColorSpace;
 add(new THREE.BoxGeometry(2.12,.58,.12),wood,root,[0,2.12,.88]);
 add(new THREE.PlaneGeometry(1.98,.45),new THREE.MeshBasicMaterial({map:signMap,toneMapped:false}),root,[0,2.12,.948],[0,0,0],false);
 root.userData.marketItemLabel=productLabel;root.userData.marketSign={ctx,map:signMap,canvas:signCanvas,kind};
 root.userData.nightLights=[];
 for(const xx of [-1.42,1.42]){
  add(new THREE.SphereGeometry(.085,9,7),new THREE.MeshBasicMaterial({color:0xffc779}),root,[xx,2.08,.6],[0,0,0],false);
  const glow=new THREE.PointLight(0xffc77e,.34,6);glow.position.set(xx,2.05,.6);root.add(glow);
  root.userData.nightLights.push({light:glow,base:.34});
 }
 return root;
}
function marketVendor(scene,x,z,facing,m){
 const root=new THREE.Group();root.position.set(x,0,z);root.rotation.y=facing;scene.add(root);
 const skin=mat(0xd0a17e,.9),cloth=mat(0x78634c,.98),apron=mat(0x4f6654,.98),dark=mat(0x332a22,.98);
 add(new THREE.CapsuleGeometry(.31,.72,5,9),cloth,root,[0,.92,0]);add(new THREE.BoxGeometry(.48,.58,.12),apron,root,[0,.9,.28]);
 const head=new THREE.Group();head.position.set(0,1.58,.02);root.add(head);
 add(new THREE.SphereGeometry(.255,16,12),skin,head,[0,.09,0]);
 add(new THREE.SphereGeometry(.26,16,10),dark,head,[0,.24,-.025]).scale.set(1,.36,1);
 const arms=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.31,1.28,.025);root.add(arm);
  add(new THREE.CapsuleGeometry(.09,.55,4,8),cloth,arm,[side*.045,-.25,.02],[0,0,side*.18]);
  add(new THREE.SphereGeometry(.09,8,7),skin,arm,[side*.055,-.54,.055]);
  arms.push(arm);
 }
 root.userData.animateInteraction=(time,phase=0)=>{
  const reach=Math.sin(time*.0021+phase),offer=Math.max(0,Math.sin(time*.00135+phase+1.2));
  arms[0].rotation.set(-.28-Math.max(0,reach)*.45,0,-.3-Math.max(0,reach)*.34);
  arms[1].rotation.set(-.18-offer*.55,0,.28+offer*.25);
  head.rotation.x=Math.sin(time*.00125+phase)*.055;
  root.position.y=.012*Math.sin(time*.002+phase);
 };
 return root;
}
function avatar(scene,profile={},id="local",isLocal=false,showName=true){
 const root=new THREE.Group();root.name="monk-"+id;scene.add(root);
 const robe=mat(profile.robe||"#b49a72",.96,{map:robeFabric,bumpMap:robeFabric,bumpScale:.018}),trim=mat(0xd7bf91,.65),skin=mat(profile.skin||"#d7ad87"),dark=mat(0x392f27),sandal=mat(0x574b3b);
 const body=new THREE.Group();root.add(body);
 const robeProfile=[
  [.07,.27,.22], [.15,.32,.245], [.32,.34,.25], [.5,.32,.235],
  [.68,.29,.21], [.84,.285,.195], [1.0,.31,.195], [1.14,.36,.21],
  [1.27,.425,.225], [1.37,.465,.22], [1.44,.42,.195], [1.51,.29,.17], [1.57,.18,.15]
 ];
 const robeGeometry=new THREE.LatheGeometry(robeProfile.map(([y,r])=>new THREE.Vector2(r,y)),48);
 robeGeometry.scale(1,1,.78);
 robeGeometry.computeVertexNormals();
 add(robeGeometry,robe,body);
 add(new THREE.ConeGeometry(.19,.9,4),trim,body,[0,.92,.27]).scale.set(.75,1,.2);
 add(new THREE.TorusGeometry(.42,.045,7,32),trim,body,[0,.43,0],[Math.PI/2,0,0]);
 add(new THREE.TorusGeometry(.23,.04,8,28),trim,body,[0,1.53,0],[Math.PI/2,0,0]);
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const leg=add(new THREE.CapsuleGeometry(.105,.28,4,8),dark,body,[side*.2,.19,0]);legs.push(leg);
  add(new THREE.BoxGeometry(.28,.09,.4),sandal,body,[side*.2,.045,.08]);
  const pivot=new THREE.Group();pivot.position.set(side*.405,1.34,0);body.add(pivot);
  const shoulder=add(new THREE.SphereGeometry(1,16,12),robe,pivot,[0,-.045,0]);
  shoulder.scale.set(.205,.205,.19);
  add(new THREE.CapsuleGeometry(.15,.58,6,12),robe,pivot,[side*.025,-.285,.005],[0,0,side*.12]);
  add(new THREE.CapsuleGeometry(.105,.27,5,10),robe,pivot,[side*.035,-.565,.025],[0,0,side*.08]);
  add(new THREE.TorusGeometry(.105,.018,6,20),trim,pivot,[side*.035,-.69,.025],[Math.PI/2,0,0]);
  const hand=new THREE.Group();hand.position.set(side*.035,-.765,.045);pivot.add(hand);
  add(new THREE.SphereGeometry(1,12,10),skin,hand,[0,0,0]).scale.set(.092,.115,.055);
  for(let finger=0;finger<4;finger++){
   const fx=(finger-1.5)*.043, length=.105+(finger===1||finger===2?.018:0);
   add(new THREE.CapsuleGeometry(.018,length*.5,4,7),skin,hand,[fx,-.095,.018],[0,0,(finger-1.5)*-.035]);
  }
  add(new THREE.CapsuleGeometry(.022,.075,4,7),skin,hand,[side*.105,-.018,.04],[0,0,side*.72]);
  arms.push(pivot);
 }
 add(new THREE.CylinderGeometry(.12,.15,.22,12),skin,body,[0,1.65,0]);
 const head=new THREE.Group();head.position.set(0,1.91,0);body.add(head);
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
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x*.5,1.42,.43),new THREE.Vector3(x*.8,1.02,.39),new THREE.Vector3(x,.62,.35),new THREE.Vector3(x*.88,.24,.42)]);
  body.add(new THREE.Mesh(new THREE.TubeGeometry(curve,14,.008,5,false),foldMaterial));
 }
 for(let i=0;i<7;i++){
  const x=-.34+i*.113;
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x*.5,1.42,-.43),new THREE.Vector3(x*.8,1.02,-.39),new THREE.Vector3(x,.62,-.35),new THREE.Vector3(x*.88,.24,-.42)]);
  body.add(new THREE.Mesh(new THREE.TubeGeometry(curve,14,.008,5,false),foldMaterial));
 }
 add(new THREE.TorusGeometry(.34,.045,8,32),trim,body,[0,.48,0],[Math.PI/2,0,0]);
 // The lower robe is already shaped into the tapered torso mesh; no cylindrical hem overlay.
 add(new THREE.BoxGeometry(.13,.035,.05),trim,body,[0,1.43,.49]);
 for(const side of [-1,1]){
  const ear=add(new THREE.SphereGeometry(1,14,10),skin,head,[side*.302,.105,-.005]);
  ear.scale.set(.09,.125,.065);
  const earInset=add(new THREE.SphereGeometry(1,12,8),mat(0x9c7160,.95),head,[side*.325,.105,.025]);
  earInset.scale.set(.025,.065,.018);
  add(new THREE.SphereGeometry(.024,10,8),dark,head,[side*.105,.15,.292],[0,0,0],false);
 }
 const chin=add(new THREE.SphereGeometry(1,14,10),skin,head,[0,-.005,.205]);chin.scale.set(.17,.105,.12);
 const noseBridge=add(new THREE.CapsuleGeometry(.027,.095,5,8),skin,head,[0,.105,.316]);
 noseBridge.rotation.x=-.16;
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
 head.scale.setScalar(.96);
 const teaCup=new THREE.Group();arms[1].add(teaCup);teaCup.position.set(.04,-.79,.14);teaCup.visible=false;
 const teaPorcelain=mat(0xe7dfcb,.32),teaRim=mat(0xb48b55,.48,{metalness:.22}),teaLiquid=mat(0x8c5930,.3);
 add(new THREE.CylinderGeometry(.075,.06,.105,16),teaPorcelain,teaCup,[0,0,0]);
 add(new THREE.TorusGeometry(.071,.009,7,18),teaRim,teaCup,[0,.054,0]);
 add(new THREE.CircleGeometry(.059,16),teaLiquid,teaCup,[0,.048,0]);
 const incenseStick=new THREE.Group();body.add(incenseStick);incenseStick.visible=false;
 add(new THREE.CylinderGeometry(.018,.018,.72,7),mat(0x98683a,.8),incenseStick,[0,0,0]);
 add(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0xff9c54}),incenseStick,[0,.37,0]);
 incenseStick.position.set(.08,1.05,.52);
 const broom=new THREE.Group();body.add(broom);broom.visible=false;
 add(new THREE.CylinderGeometry(.026,.035,1.12,7),mat(0x765233),broom,[0,-.2,0]);
 add(new THREE.CylinderGeometry(.19,.23,.3,9),mat(0xb59a6d),broom,[0,-.83,0]);
 broom.position.set(.12,1.05,.52);
 const malaCord=new THREE.CatmullRomCurve3([new THREE.Vector3(-.34,1.25,.3),new THREE.Vector3(-.24,1.06,.4),new THREE.Vector3(0,1.0,.43),new THREE.Vector3(.24,1.06,.4),new THREE.Vector3(.34,1.25,.3)]);
 body.add(new THREE.Mesh(new THREE.TubeGeometry(malaCord,28,.012,6,false),dark));
 const beads=new THREE.Group();body.add(beads);
 for(let i=0;i<13;i++){const a=Math.PI*.12+i*Math.PI*.76/12;add(new THREE.SphereGeometry(.032,7,6),trim,beads,[Math.sin(a)*.32,1.24+Math.cos(a)*.18,.32]);}
 if(profile.style==="pilgrim"){
  add(new THREE.BoxGeometry(.42,.56,.22),dark,body,[-.57,.73,-.08],[0,0,-.18]);
 }
 const namePlate=showName?robeNamePlate(profile.name||"行者"):null;if(namePlate)root.add(namePlate);
 return {
  id,root,body,head,arms,legs,tag:namePlate,profile,showName,target:new THREE.Vector3(),targetRotation:0,pose:"walk",previousPose:"walk",poseStartedAt:performance.now(),until:0,
  setProfile(p){this.profile=p;robe.color.set(p.robe||"#b49a72");skin.color.set(p.skin||"#d7ad87");this.setLabel(p.name);},
  setLabel(name){if(!this.showName)return;if(this.tag){this.root.remove(this.tag);this.tag.material?.map?.dispose();this.tag.material?.dispose();}this.tag=robeNamePlate(name);this.root.add(this.tag);},
  setPosition(x,z,r=0,y=0){root.position.set(x,y,z);root.rotation.y=r;this.target.set(x,y,z);this.targetRotation=r;},
  setTarget(p){this.target.set(p.x,0,p.z);this.targetRotation=Number(p.rotation)||0;if(p.action&&p.action!=="walk")this.setPose(p.action,2100);},
  setPose(a,ms=2600){this.previousPose=this.pose;this.pose=a;this.poseStartedAt=performance.now();this.until=performance.now()+ms;},
  update(dt,time,moving=false){
   if(this.until&&time>this.until){this.previousPose=this.pose;this.pose="walk";this.poseStartedAt=time;this.until=0;}
   const pose=(name)=>{
    const v={bodyX:0,bodyY:0,headX:0,armX0:0,armX1:0,armZ0:-.12,armZ1:.12,legX0:0,legX1:0};
    if(name==="bow"){v.bodyX=.17;v.headX=.26;v.armX0=-.2;v.armX1=-.2;v.armZ0=.65;v.armZ1=-.65;}
    else if(name==="kneel"){v.bodyY=-.25;v.bodyX=.08;v.headX=.18;v.legX0=-.7;v.legX1=-.7;v.armZ0=.45;v.armZ1=-.45;}
    else if(name==="chant"){v.bodyX=.08;v.headX=.13;v.armX0=-.2;v.armX1=-.2;v.armZ0=.65;v.armZ1=-.65;}
    else if(name==="meditate"){v.bodyY=-.19;v.bodyX=-.025;v.headX=.035;v.legX0=-1.1;v.legX1=-1.1;v.armX0=-1.02;v.armX1=-1.02;v.armZ0=.52;v.armZ1=-.52;}
    else if(name==="tea"){v.bodyY=-.17;v.bodyX=-.035;v.headX=-.12;v.legX0=-1.05;v.legX1=-1.05;v.armX0=-.92;v.armX1=-1.28;v.armZ0=.42;v.armZ1=-.22;}
    else if(name==="eat"){v.bodyY=-.17;v.bodyX=-.025;v.headX=-.08;v.legX0=-1.05;v.legX1=-1.05;v.armX0=-.75;v.armX1=-1.34;v.armZ0=.38;v.armZ1=-.28;}
    else if(name==="toilet"){v.bodyY=-.24;v.bodyX=.08;v.headX=.12;v.legX0=-.9;v.legX1=-.9;v.armX0=-.12;v.armX1=-.12;v.armZ0=.34;v.armZ1=-.34;}
    else if(name==="greet"){v.armX0=-.75;v.armX1=-.75;v.armZ0=-.42;v.armZ1=.42;}
    else if(name==="incense"){v.armX0=-.6;v.armX1=-.6;}
    else if(name==="sweep"){v.armX0=.15;v.armX1=-.5;v.armZ1=.5*Math.sin(time*.01);}
    else if(name==="rest"){v.bodyY=-.13;v.bodyX=-.08;v.headX=-.04;v.legX0=-.72;v.legX1=-.72;v.armX0=-.28;v.armX1=-.28;v.armZ0=.2;v.armZ1=-.2;}
    return v;
   };
   const from=pose(this.previousPose||"walk"),to=pose(this.pose);
   const raw=clamp((time-(this.poseStartedAt||time))/460,0,1),blend=raw*raw*(3-2*raw);
   const mix=(key)=>from[key]+(to[key]-from[key])*blend;
   body.rotation.x=mix("bodyX");
   body.rotation.z=(moving&&this.pose==="walk"?Math.sin(time*.0075)*.018:0);
   body.position.y=mix("bodyY")+Math.sin(time*(this.pose==="meditate"?.00125:.0018))*(this.pose==="meditate"?.012:.006);
   head.rotation.x=mix("headX")+Math.sin(time*.0011)*.004;
   arms[0].rotation.set(mix("armX0"),0,mix("armZ0"));
   arms[1].rotation.set(mix("armX1"),0,mix("armZ1"));
   legs[0].rotation.x=mix("legX0");legs[1].rotation.x=mix("legX1");
   if(moving&&this.pose==="walk"){
    const v=Math.sin(time*.0075)*.34*blend;
    legs[0].rotation.x=v;legs[1].rotation.x=-v;
    arms[0].rotation.x=-v*.5;arms[1].rotation.x=v*.5;
    body.position.y+=Math.abs(Math.sin(time*.018))*.035;
   }
   incenseStick.visible=this.pose==="incense";broom.visible=this.pose==="sweep";teaCup.visible=this.pose==="tea";if(this.pose==="tea")teaCup.position.y=-.79+Math.sin(time*.0028)*.018;
  },
  dispose(){scene.remove(root);root.traverse(o=>{o.geometry?.dispose();if(o.material){const materials=Array.isArray(o.material)?o.material:[o.material];for(const material of materials){material.map?.dispose();material.dispose();}}});}
 };
}

export class TempleWorld{
 constructor(container){
  this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x9aaea4);this.scene.fog=new THREE.FogExp2(0x9aaea4,.0068);
  this.camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,440);
  this.mobile=matchMedia("(max-width: 660px)").matches;this.smoothMode=false;this.renderFrameInterval=25;this.lowNpcElapsed=0;this.lastLowDetailLights=0;this.lastLowDetailAnimation=0;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  this.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio||1,1),this.mobile?1.4:1.8));this.renderer.setSize(innerWidth,innerHeight);this.renderPixelRatio=this.renderer.getPixelRatio();this.renderer.shadowMap.enabled=!this.mobile;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;container.appendChild(this.renderer.domElement);
  this.yaw=0;this.pitch=.18;this.distance=10.5;this.indoor=false;this.drag=false;this.last={x:0,y:0};this.pointerStart={x:0,y:0};this.pointerMoved=false;this.moveTarget=null;this.moveWaypoints=[];this.pendingAction=null;this.wanderActive=false;this.wanderNextAt=0;this.wanderBlockedAt=0;this.wanderLastGoal=null;this.wanderStops=[[0,38],[0,25],[-14,16],[-18,-3],[-14,-20],[0,-27],[8,-43],[14,-50],[4,-56],[14,-58],[14,25],[35,17],[35,0],[-25,12]];this.raycaster=new THREE.Raycaster();this.pointerNdc=new THREE.Vector2();this.moveVelocity=new THREE.Vector2();this.jumpVelocity=0;this.jumpOffset=0;this.jumpHeld=false;this.local=null;this.remotes=new Map();this.effects=[];this.lotusPads=[];this.templeLanterns=[];this.incenseSmoke=[];this.nightLights=[];this.lastDayNightUpdate=-Infinity;this.dayNightState=null;this.meditationCushions=MEDITATION_CUSHIONS;this.clock=new THREE.Clock();
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
  const skyCanvas=document.createElement("canvas");skyCanvas.width=8;skyCanvas.height=512;
  const skyCtx=skyCanvas.getContext("2d");
  const skyGradient=skyCtx.createLinearGradient(0,0,0,512);
  skyGradient.addColorStop(0,"#647d7c");skyGradient.addColorStop(.48,"#a8bcb0");skyGradient.addColorStop(.82,"#e0c9a2");skyGradient.addColorStop(1,"#c4b08f");
  skyCtx.fillStyle=skyGradient;skyCtx.fillRect(0,0,8,512);
  const skyMap=new THREE.CanvasTexture(skyCanvas);skyMap.colorSpace=THREE.SRGBColorSpace;
  const sky=new THREE.Mesh(new THREE.SphereGeometry(218,32,20),new THREE.MeshBasicMaterial({map:skyMap,side:THREE.BackSide,depthWrite:false,fog:false}));
  sky.frustumCulled=false;s.add(sky);this.skyCtx=skyCtx;this.skyMap=skyMap;
  this.hemiLight=new THREE.HemisphereLight(0xe8f0e5,0x59604d,2.05);s.add(this.hemiLight);
  this.sunLight=new THREE.DirectionalLight(0xffe2b5,2.7);this.sunLight.position.set(-38,58,34);this.sunLight.castShadow=!this.mobile;this.sunLight.shadow.mapSize.set(2048,2048);Object.assign(this.sunLight.shadow.camera,{left:-92,right:92,top:92,bottom:-92,near:.5,far:160});this.sunLight.shadow.bias=-.0002;s.add(this.sunLight);
  this.fillLight=new THREE.DirectionalLight(0xb9d2cd,.75);this.fillLight.position.set(30,22,-36);s.add(this.fillLight);
  this.moonLight=new THREE.DirectionalLight(0xa8bce0,.04);this.moonLight.position.set(38,35,-34);s.add(this.moonLight);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(4.2,24,16),new THREE.MeshBasicMaterial({color:0xe7e9e7,transparent:true,opacity:0,depthWrite:false}));
  s.add(moon);this.moonMesh=moon;
  const starPositions=[];
  for(let i=0;i<190;i++){const y=26+Math.random()*150,a=Math.random()*Math.PI*2,r=Math.sqrt(218*218-y*y);starPositions.push(Math.cos(a)*r,y,Math.sin(a)*r);}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute("position",new THREE.Float32BufferAttribute(starPositions,3));
  const starMaterial=new THREE.PointsMaterial({color:0xe6edf7,size:.9,transparent:true,opacity:0,depthTest:false,depthWrite:false});
  s.add(new THREE.Points(starGeometry,starMaterial));this.starMaterial=starMaterial;
  add(new THREE.PlaneGeometry(240,240),m.grass,s,[0,-.72,0],[-Math.PI/2,0,0],false);
  add(new THREE.PlaneGeometry(64,62),m.stone,s,[0,-.14,-2],[-Math.PI/2,0,0],false);
  const path=mat(0xb1a791,.95);add(new THREE.PlaneGeometry(8,70),path,s,[0,-.1,8],[-Math.PI/2,0,0],false);add(new THREE.PlaneGeometry(56,7),path,s,[0,-.1,-1],[-Math.PI/2,0,0],false);add(new THREE.PlaneGeometry(5,38),path,s,[0,-.1,-34],[-Math.PI/2,0,0],false);
  const distantHills=[];
  for(let ring=0;ring<2;ring++)for(let i=0;i<24;i++){const a=i*Math.PI/12+(ring?.12:0),r=100+ring*17;distantHills.push({ring,x:Math.cos(a)*r,y:8-ring*2,z:Math.sin(a)*r,radius:17+Math.random()*13,height:38+Math.random()*30,ry:Math.random(),rz:(Math.random()-.5)*.12});}
  addInstancedHills(s,distantHills);
  for(let i=0;i<(this.mobile?18:56);i++){const a=Math.random()*Math.PI*2,r=52+Math.random()*32,x=Math.cos(a)*r,z=Math.sin(a)*r;if((Math.abs(x)<14&&z>12&&z<43)||Math.hypot(x+52,z-12)<15)continue;pine(s,x,z,.72+Math.random()*.72,m);}
  addInstancedPines(s,m);
  // 林间茶庄：由北侧绕过祈愿墙可达，坐落在森林中的独立草地。
  const teaLawn=new THREE.Group();teaLawn.position.set(0,0,-62);s.add(teaLawn);this.teaHouse=teaLawn;
  add(new THREE.PlaneGeometry(27,23),m.grass,s,[0,-.085,-62],[-Math.PI/2,0,0],false);
  const forestPath=mat(0x9d967f,.98);
  add(new THREE.PlaneGeometry(3,15),forestPath,s,[15,-.055,-53],[-Math.PI/2,0,0],false);
  add(new THREE.PlaneGeometry(18,3),forestPath,s,[6,-.052,-60],[-Math.PI/2,0,0],false);
  add(new THREE.PlaneGeometry(3,9),forestPath,s,[0,-.05,-56],[-Math.PI/2,0,0],false);
  const teaFloor=mat(0x9b8b6c,.93),teaWood=mat(0x563b29,.88),teaTrim=mat(0xb28b58,.72,{metalness:.12});
  add(new THREE.BoxGeometry(11.2,.28,8.4),teaFloor,teaLawn,[0,.2,0]);
  for(const x of [-4.85,4.85])for(const z of [-3.55,3.55]){
   add(new THREE.BoxGeometry(.34,3.25,.34),teaWood,teaLawn,[x,1.9,z]);
   add(new THREE.BoxGeometry(.52,.16,.52),teaTrim,teaLawn,[x,3.48,z]);
  }
  add(new THREE.BoxGeometry(10.2,.22,.22),teaWood,teaLawn,[0,3.42,-3.55]);
  add(new THREE.BoxGeometry(10.2,.22,.22),teaWood,teaLawn,[0,3.42,3.55]);
  add(new THREE.BoxGeometry(.22,.22,7.1),teaWood,teaLawn,[-4.85,3.42,0]);
  add(new THREE.BoxGeometry(.22,.22,7.1),teaWood,teaLawn,[4.85,3.42,0]);
  const teaRoof=new THREE.Group();teaLawn.add(teaRoof);
  planeRoof(teaRoof,10.2,7.1,4.45,3.55,1,m.roof);planeRoof(teaRoof,10.2,7.1,4.45,3.55,-1,m.roof);
  add(new THREE.BoxGeometry(10.6,.16,7.5),teaTrim,teaLawn,[0,3.48,0]);
  for(const x of [-2.5,2.5]){
   add(new THREE.CylinderGeometry(.82,.9,.15,18),teaWood,teaLawn,[x,.83,-.35]);
   add(new THREE.CylinderGeometry(.15,.2,.63,10),teaWood,teaLawn,[x,.49,-.35]);
   for(const z of [-1.55,.95])add(new THREE.BoxGeometry(1.35,.2,.36),teaWood,teaLawn,[x,.44,z]);
   add(new THREE.CylinderGeometry(.16,.13,.23,12),m.darkWood,teaLawn,[x,.99,-.35]);
   add(new THREE.TorusGeometry(.13,.025,7,18),teaTrim,teaLawn,[x,1.11,-.35],[Math.PI/2,0,0]);
  }
  add(new THREE.BoxGeometry(1.35,.08,.72),teaTrim,teaLawn,[0,.93,-.35]);
  for(const x of [-.38,.38]){
   add(new THREE.CylinderGeometry(.13,.1,.18,12),m.paper,teaLawn,[x,1.08,-.35]);
   add(new THREE.TorusGeometry(.105,.022,7,16),teaTrim,teaLawn,[x,1.18,-.35],[Math.PI/2,0,0]);
  }
  const teaSignCanvas=document.createElement("canvas");teaSignCanvas.width=768;teaSignCanvas.height=192;
  const teaSignCtx=teaSignCanvas.getContext("2d");teaSignCtx.fillStyle="#3b2b20";teaSignCtx.fillRect(0,0,768,192);
  teaSignCtx.strokeStyle="#d8bd82";teaSignCtx.lineWidth=10;teaSignCtx.strokeRect(12,12,744,168);
  teaSignCtx.textAlign="center";teaSignCtx.textBaseline="middle";teaSignCtx.font='bold 92px "Songti SC","Noto Serif CJK SC",serif';teaSignCtx.fillStyle="#fff0cc";teaSignCtx.fillText("林间茶庄",384,96);
  const teaSignMap=new THREE.CanvasTexture(teaSignCanvas);teaSignMap.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.BoxGeometry(3.35,.92,.18),teaWood,teaLawn,[0,3.15,4.22]);
  add(new THREE.PlaneGeometry(3.08,.7),new THREE.MeshBasicMaterial({map:teaSignMap,toneMapped:false}),teaLawn,[0,3.15,4.32],[0,0,0],false);
  this.teaSign={ctx:teaSignCtx,map:teaSignMap,canvas:teaSignCanvas};
  for(const x of [-3.8,3.8]){
   const lanternGroup=new THREE.Group();lanternGroup.position.set(x,3,2.8);teaLawn.add(lanternGroup);
   add(new THREE.CylinderGeometry(.24,.32,.18,8),teaTrim,lanternGroup,[0,0,0]);
   add(new THREE.CylinderGeometry(.18,.2,.56,8),m.paper,lanternGroup,[0,-.34,0]);
   add(new THREE.ConeGeometry(.32,.18,8),teaTrim,lanternGroup,[0,-.7,0]);
   const glow=new THREE.PointLight(0xffca82,.42,10);glow.position.set(0,-.32,0);lanternGroup.add(glow);
   this.nightLights.push({light:glow,base:.42});
  }
  for(const [x,z] of [[-10,-7],[-10,7],[10,7]]){
   const shrub=add(new THREE.IcosahedronGeometry(.72,1),m.pine,teaLawn,[x,.5,z],[0,0,0],false);shrub.scale.set(1,.62,.85);
  }
  // A remote parking lot in a natural forest clearing, connected by a quiet gravel lane.
  const parkingRoad=mat(0x77786f,.96),parkingAsphalt=mat(0x454a48,.98),parkingLine=mat(0xd8d1b7,.92),parkingCurb=mat(0x9b978a,.94),parkingWood=mat(0x513a2a,.9);
  add(new THREE.PlaneGeometry(40,4.2),parkingRoad,s,[-32,-.075,22],[-Math.PI/2,0,0],false);
  add(new THREE.PlaneGeometry(4.2,12),parkingRoad,s,[-52,-.07,17],[-Math.PI/2,0,0],false);
  const parkingLot=new THREE.Group();parkingLot.position.set(-52,0,12);s.add(parkingLot);this.parkingLot=parkingLot;
  add(new THREE.PlaneGeometry(26,18),parkingAsphalt,parkingLot,[0,-.055,0],[-Math.PI/2,0,0],false);
  for(const x of [-13,13])add(new THREE.BoxGeometry(.28,.18,18),parkingCurb,parkingLot,[x,.01,0]);
  for(const z of [-9,9])add(new THREE.BoxGeometry(26,.18,.28),parkingCurb,parkingLot,[0,.01,z]);
  for(const x of [-12,-6,0,6,12])add(new THREE.BoxGeometry(.055,.018,7.4),parkingLine,parkingLot,[x,.012,0]);
  add(new THREE.BoxGeometry(25,.018,.07),parkingLine,parkingLot,[0,.012,-.02]);
  const tireMat=mat(0x202322,.98),glassMat=mat(0x34474a,.34,{metalness:.12}),chromeMat=mat(0xb9b6a8,.38,{metalness:.42});
  const carColors=[0x8b493e,0x465d72,0xc3b89e,0x59644f,0x777b78,0x9a783e,0x526b68,0x6e4e5b];
  const carSpots=[];
  for(let row=0;row<2;row++)for(let col=0;col<4;col++){
   const x=-9+col*6,z=row===0?-4.3:4.3,car=new THREE.Group();parkingLot.add(car);
   const paint=mat(carColors[row*4+col],.36,{metalness:.16});
   add(new THREE.BoxGeometry(3.55,.62,1.72),paint,car,[0,.68,0]);
   add(new THREE.BoxGeometry(2.05,.76,1.38),glassMat,car,[-.12,1.22,0]);
   add(new THREE.BoxGeometry(3.3,.12,1.78),chromeMat,car,[0,.38,0]);
   for(const side of [-1,1])for(const end of [-1,1]){
    add(new THREE.CylinderGeometry(.33,.33,.22,12),tireMat,car,[end*1.08,.36,side*.82],[Math.PI/2,0,0]);
    add(new THREE.CylinderGeometry(.13,.13,.23,12),chromeMat,car,[end*1.08,.36,side*.82],[Math.PI/2,0,0]);
   }
   for(const side of [-1,1]){
    add(new THREE.BoxGeometry(.12,.16,.27),mat(0xf2d69a,.45,{emissive:0x4a3118,emissiveIntensity:.22}),car,[1.79,.68,side*.48]);
    add(new THREE.BoxGeometry(.12,.16,.27),mat(0xa63b32,.5),car,[-1.79,.68,side*.48]);
   }
   car.position.set(x,0,z);carSpots.push({x:-52+x,z:12+z});
  }
  const parkingCanvas=document.createElement("canvas");parkingCanvas.width=768;parkingCanvas.height=192;
  const parkingCtx=parkingCanvas.getContext("2d");parkingCtx.fillStyle="#35453d";parkingCtx.fillRect(0,0,768,192);
  parkingCtx.strokeStyle="#d8bd82";parkingCtx.lineWidth=10;parkingCtx.strokeRect(12,12,744,168);
  parkingCtx.textAlign="center";parkingCtx.textBaseline="middle";parkingCtx.font='bold 78px "Songti SC","Noto Serif CJK SC",serif';
  parkingCtx.fillStyle="#fff0cc";parkingCtx.fillText("森林停车场",384,96);
  const parkingMap=new THREE.CanvasTexture(parkingCanvas);parkingMap.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.CylinderGeometry(.13,.18,3.5,10),parkingWood,parkingLot,[-10.4,1.75,8.0]);
  add(new THREE.BoxGeometry(3.8,1.08,.2),parkingWood,parkingLot,[-8.8,3.0,8.0]);
  add(new THREE.PlaneGeometry(3.52,.82),new THREE.MeshBasicMaterial({map:parkingMap,toneMapped:false}),parkingLot,[-8.8,3.0,8.11],[0,0,0],false);
  this.parkingSign={ctx:parkingCtx,map:parkingMap,canvas:parkingCanvas};
  // 山门外移，形成更宽阔的大殿前院。
  const gate=new THREE.Group();gate.position.z=-1.2;s.add(gate);
  for(const x of [-4.8,4.8]){add(new THREE.BoxGeometry(.65,6.8,.72),m.pillar,gate,[x,3.4,0]);add(new THREE.BoxGeometry(1.1,.34,1.1),m.gold,gate,[x,6.9,0]);}
  add(new THREE.BoxGeometry(12,.68,1),m.darkWood,gate,[0,6.6,0]);add(new THREE.BoxGeometry(10,.2,1.1),m.pillar,gate,[0,7,0]);planeRoof(gate,10,3,9.15,8.15,1,m.roof);planeRoof(gate,10,3,9.15,8.15,-1,m.roof);// Mountain gate remains clean architectural timber without an applied plaque.
  // Market garden: four stalls well beyond the gate, on a dedicated green lawn east of the courtyard.
  this.vendorSpecs=[
   {name:"凉面摊主",x:43,z:-1,kind:"noodles",facing:-Math.PI/2,customers:1,area:"market"},
   {name:"香烛摊主",x:43,z:7,kind:"incense",facing:-Math.PI/2,customers:0,area:"market"},
   {name:"咖啡摊主",x:43,z:15,kind:"coffee",facing:-Math.PI/2,customers:0,area:"market"},
   {name:"小食摊主",x:43,z:23,kind:"fruit",facing:-Math.PI/2,customers:0,area:"market"}
  ];
  this.roadsideVendorSpecs=[
   {name:"算命先生",x:-10,z:8,kind:"fortune",side:-1,facing:-Math.PI/2,customers:0,area:"road"},
   {name:"文创摊主",x:10,z:19,kind:"souvenir",side:1,facing:Math.PI/2,customers:0,area:"road"},
   {name:"麦当劳店员",x:-10,z:30,kind:"mcdonalds",side:-1,facing:-Math.PI/2,customers:0,area:"road"}
  ];
  this.marketStalls=[];
  add(new THREE.PlaneGeometry(26,48),m.grass,s,[43,-.08,11],[-Math.PI/2,0,0],false);
  const marketPath=mat(0xaaa18d,.96);
  add(new THREE.PlaneGeometry(4.2,40),marketPath,s,[38.1,-.035,11],[-Math.PI/2,0,0],false);
  add(new THREE.PlaneGeometry(18,4.2),marketPath,s,[40,-.035,15],[-Math.PI/2,0,0],false);
  for(const vendor of this.vendorSpecs){
   const stall=marketStall(s,vendor.x,vendor.z,1,vendor.kind,m);
   this.marketStalls.push(stall);this.nightLights.push(...stall.userData.nightLights);
  }
  for(const vendor of this.roadsideVendorSpecs){
   add(new THREE.PlaneGeometry(7.6,6.4),m.gravel,s,[vendor.x,-.07,vendor.z],[-Math.PI/2,0,0],false);
   const stall=marketStall(s,vendor.x,vendor.z,vendor.side,vendor.kind,m);
   this.marketStalls.push(stall);this.nightLights.push(...stall.userData.nightLights);
  }
  // 山门前的森林绿地：独立的中式素斋馆「斋」，面向主路敞开。
  add(new THREE.PlaneGeometry(30,25),m.grass,s,[22,-.085,25],[-Math.PI/2,0,0],false);
  const restaurantPath=mat(0xa69b82,.98);
  add(new THREE.PlaneGeometry(13.4,2.6),restaurantPath,s,[10.7,-.045,25],[-Math.PI/2,0,0],false);
  // A few mature pines frame the clearing without crowding the approach.
  for(const [tx,tz,scale] of [[12.5,15.8,.9],[33.2,16.2,1.05],[33.4,34.2,.92],[12.4,34.4,.82]]){
   const tree=new THREE.Group();tree.position.set(tx,0,tz);tree.scale.setScalar(scale);s.add(tree);
   add(new THREE.CylinderGeometry(.14,.22,2.8,8),m.bark,tree,[0,1.4,0]);
   for(let tier=0;tier<3;tier++)add(new THREE.ConeGeometry(1.55-tier*.23,2.15,8),tier===1?m.pine2:m.pine,tree,[0,2.2+tier*.78,0]);
  }
  const restaurant=new THREE.Group();restaurant.position.set(22,0,25);restaurant.rotation.y=-Math.PI/2;s.add(restaurant);this.restaurant=restaurant;
  const restaurantWood=mat(0x62452e,.9),restaurantDark=mat(0x3d3025,.94),restaurantTrim=mat(0xb18b55,.68,{metalness:.12}),restaurantFloor=mat(0x9b8160,.94),restaurantWall=mat(0x806c51,.96);
  add(new THREE.BoxGeometry(12.25,.16,9.35),restaurantFloor,restaurant,[0,-.08,0]);
  add(new THREE.PlaneGeometry(12,9.1),restaurantFloor,restaurant,[0,.008,0],[-Math.PI/2,0,0],false);
  // Timber posts, low side screens and a warm open kitchen at the rear.
  for(const x of [-5.65,5.65])for(const z of [-4.1,4.1]){
   add(new THREE.BoxGeometry(.34,4.05,.34),restaurantWood,restaurant,[x,2.02,z]);
   add(new THREE.BoxGeometry(.54,.18,.54),restaurantTrim,restaurant,[x,.12,z]);
   add(new THREE.BoxGeometry(.52,.16,.52),restaurantTrim,restaurant,[x,4.08,z]);
  }
  add(new THREE.BoxGeometry(11.15,2.65,.24),restaurantWall,restaurant,[0,1.38,-4.25]);
  for(const x of [-5.65,5.65]){
   add(new THREE.BoxGeometry(.22,1.25,8.05),restaurantWall,restaurant,[x,.68,0]);
   for(const z of [-2.7,-1.35,0,1.35,2.7])add(new THREE.BoxGeometry(.12,1.15,.09),restaurantWood,restaurant,[x,.72,z]);
   add(new THREE.BoxGeometry(.18,.13,8.1),restaurantTrim,restaurant,[x,1.35,0]);
  }
  add(new THREE.BoxGeometry(11.35,.24,.28),restaurantWood,restaurant,[0,3.62,4.13]);
  add(new THREE.BoxGeometry(11.35,.24,.28),restaurantWood,restaurant,[0,3.62,-4.13]);
  add(new THREE.BoxGeometry(.22,.22,8.25),restaurantWood,restaurant,[-5.58,3.62,0]);
  add(new THREE.BoxGeometry(.22,.22,8.25),restaurantWood,restaurant,[5.58,3.62,0]);
  planeRoof(restaurant,12,9.1,5.15,4.05,1,m.roof);
  planeRoof(restaurant,12,9.1,5.15,4.05,-1,m.roof);
  add(new THREE.CylinderGeometry(.12,.12,13.7,10),restaurantTrim,restaurant,[0,5.2,0],[0,0,Math.PI/2]);
  for(const x of [-6.8,6.8])for(const z of [-5.05,5.05])add(new THREE.SphereGeometry(.18,9,8),restaurantTrim,restaurant,[x,4.18,z]);
  // Service counter and simple vegetarian dishes make the use of the building immediately legible.
  add(new THREE.BoxGeometry(7.0,.9,.82),restaurantDark,restaurant,[0,.62,-2.65]);
  add(new THREE.BoxGeometry(7.25,.16,1.02),restaurantTrim,restaurant,[0,1.15,-2.65]);
  for(const x of [-2.4,-.8,.8,2.4]){
   add(new THREE.CylinderGeometry(.34,.28,.12,18),mat(0xe1d5bd,.48),restaurant,[x,1.28,-2.62]);
   add(new THREE.SphereGeometry(.21,12,8),mat(0x6b8b58,.76),restaurant,[x,1.36,-2.62]).scale.set(1,.34,1);
  }
  for(const x of [-2.8,2.8]){
   add(new THREE.CylinderGeometry(.78,.78,.14,20),restaurantWood,restaurant,[x,1.02,.75]);
   add(new THREE.CylinderGeometry(.13,.17,.95,10),restaurantDark,restaurant,[x,.52,.75]);
   for(const side of [-1,1]){
    add(new THREE.BoxGeometry(.94,.16,.34),restaurantWood,restaurant,[x+side*1.03,.43,.75]);
    add(new THREE.BoxGeometry(.16,.48,.16),restaurantDark,restaurant,[x+side*1.03,.2,.75]);
   }
   for(const z of [-.25,1.75]){
    add(new THREE.BoxGeometry(.9,.16,.34),restaurantWood,restaurant,[x,.43,z]);
    add(new THREE.BoxGeometry(.16,.48,.16),restaurantDark,restaurant,[x,.2,z]);
   }
  }
  // Hanging lanterns and potted greens warm the open dining room at night.
  for(const x of [-3.8,3.8]){
   add(new THREE.BoxGeometry(.045,.72,.045),restaurantDark,restaurant,[x,3.42,.15]);
   add(new THREE.CylinderGeometry(.22,.27,.52,10),m.paper,restaurant,[x,3.0,.15]);
   add(new THREE.ConeGeometry(.34,.18,10),restaurantTrim,restaurant,[x,2.68,.15]);
   const glow=new THREE.PointLight(0xffc987,.32,8);glow.position.set(x,2.95,.15);restaurant.add(glow);this.nightLights.push({light:glow,base:.32});
  }
  for(const x of [-6.8,6.8]){
   add(new THREE.BoxGeometry(.9,.48,.9),restaurantDark,restaurant,[x,.24,0]);
   const shrub=add(new THREE.IcosahedronGeometry(.55,1),m.pine,restaurant,[x,.75,0],[0,0,0],false);shrub.scale.set(1,.85,1);
  }
  const restaurantCanvas=document.createElement("canvas");restaurantCanvas.width=256;restaurantCanvas.height=256;
  const restaurantCtx=restaurantCanvas.getContext("2d");restaurantCtx.fillStyle="#302b22";restaurantCtx.fillRect(0,0,256,256);
  restaurantCtx.strokeStyle="#d7b878";restaurantCtx.lineWidth=12;restaurantCtx.strokeRect(13,13,230,230);
  restaurantCtx.textAlign="center";restaurantCtx.textBaseline="middle";restaurantCtx.fillStyle="#f1dfb9";
  restaurantCtx.font='bold 190px "Songti SC","Noto Serif CJK SC",serif';restaurantCtx.fillText("斋",128,128);
  const restaurantMap=new THREE.CanvasTexture(restaurantCanvas);restaurantMap.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.BoxGeometry(1.48,1.48,.16),restaurantDark,restaurant,[0,3.08,4.72]);
  add(new THREE.PlaneGeometry(1.34,1.34),new THREE.MeshBasicMaterial({map:restaurantMap,toneMapped:false}),restaurant,[0,3.08,4.81],[0,0,0],false);
  this.restaurantSign={ctx:restaurantCtx,map:restaurantMap,canvas:restaurantCanvas};
  // A full-length Lotus Wish Wall replaces the left courtyard boundary.
  // It runs perpendicular to the mountain gate and faces inward toward visitors.
  const wishWall=new THREE.Group();wishWall.position.set(-31,0,-13.5);wishWall.rotation.y=Math.PI/2;s.add(wishWall);
  const wishLength=64,wishHeight=5.2;
  add(new THREE.BoxGeometry(wishLength,wishHeight,.72),m.stone,wishWall,[0,wishHeight/2,0]);
  add(new THREE.BoxGeometry(wishLength+.9,.38,1.15),m.darkWood,wishWall,[0,wishHeight-.08,0]);
  add(new THREE.BoxGeometry(wishLength+.55,.28,1.0),m.darkWood,wishWall,[0,.14,0]);
  add(new THREE.BoxGeometry(wishLength-5.2,3.75,.12),m.paper,wishWall,[0,2.55,.405]);
  for(const x of [-29.1,29.1]){
   add(new THREE.BoxGeometry(.72,5.05,.9),m.darkWood,wishWall,[x,2.6,.44]);
   add(new THREE.BoxGeometry(1.0,.24,1.05),m.gold,wishWall,[x,5.16,.42]);
  }
  // A single auspicious 福 character is centered on the otherwise clean wall.
  const blessingCanvas=document.createElement("canvas");blessingCanvas.width=512;blessingCanvas.height=512;
  const blessingCtx=blessingCanvas.getContext("2d");blessingCtx.clearRect(0,0,512,512);
  blessingCtx.textAlign="center";blessingCtx.textBaseline="middle";
  blessingCtx.font='bold 390px "Songti SC","Noto Serif CJK SC",serif';
  blessingCtx.shadowColor="rgba(42,27,13,.48)";blessingCtx.shadowBlur=12;blessingCtx.shadowOffsetX=5;blessingCtx.shadowOffsetY=7;
  const blessingGradient=blessingCtx.createLinearGradient(90,90,420,430);
  blessingGradient.addColorStop(0,"#e0c17d");blessingGradient.addColorStop(.48,"#a77b3f");blessingGradient.addColorStop(1,"#78512c");
  blessingCtx.fillStyle=blessingGradient;blessingCtx.fillText("福",256,258);
  blessingCtx.shadowColor="transparent";blessingCtx.lineWidth=3;blessingCtx.strokeStyle="rgba(245,220,164,.55)";blessingCtx.strokeText("福",256,258);
  const blessingTexture=new THREE.CanvasTexture(blessingCanvas);blessingTexture.colorSpace=THREE.SRGBColorSpace;
  const blessing=new THREE.Mesh(new THREE.PlaneGeometry(2.75,2.75),new THREE.MeshBasicMaterial({map:blessingTexture,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  blessing.position.set(0,2.55,.54);wishWall.add(blessing);
  this.wishWallCanvas=document.createElement("canvas");this.wishWallCanvas.width=4096;this.wishWallCanvas.height=512;
  this.wishWallTexture=new THREE.CanvasTexture(this.wishWallCanvas);this.wishWallTexture.colorSpace=THREE.SRGBColorSpace;
  const wishesSurface=new THREE.Mesh(new THREE.PlaneGeometry(wishLength-7.0,3.25),new THREE.MeshBasicMaterial({map:this.wishWallTexture,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  wishesSurface.position.set(0,2.55,.505);wishWall.add(wishesSurface);
  this.setWishWallPrayers([]);
  // One monumental sanctuary: a single Great Hall, with the approach gate outside.
  this.halls=[{x:0,z:-37,w:26,d:17,h:7.1,label:"大雄宝殿",subtitle:"MAHAVIRA · THE GREAT HALL"}];
  this.halls.forEach(h=>hall(s,h,m));
  // Main sanctuary: a recognisable seated Buddha, traditional altar, and a quiet space for visitors.
  const altar=new THREE.Group();altar.position.set(0,0,-38.5);s.add(altar);
  const bud=mat(0xb28a4e,.48,{metalness:.32}),budDark=mat(0x76572f,.62,{metalness:.24}),goldLeaf=mat(0xd6b36f,.42,{metalness:.48});
  const darkWood=mat(0x39271d,.72),cushion=mat(0x8f332d,.92),cushionEdge=mat(0xc29a60,.76);
  // The worn floor tiles are integrated into the stone platform top face.
  // Hand-painted mineral-pigment murals: distant mountains, auspicious clouds and lotus blooms.
  const muralCanvas=document.createElement("canvas");muralCanvas.width=768;muralCanvas.height=384;
  const muralCtx=muralCanvas.getContext("2d");
  const muralGradient=muralCtx.createLinearGradient(0,0,0,384);
  muralGradient.addColorStop(0,"#c9b58d");muralGradient.addColorStop(.55,"#9a9b7b");muralGradient.addColorStop(1,"#756f55");
  muralCtx.fillStyle=muralGradient;muralCtx.fillRect(0,0,768,384);
  for(let i=0;i<5200;i++){muralCtx.fillStyle=i%2?"rgba(45,38,27,.045)":"rgba(255,238,192,.07)";muralCtx.fillRect(Math.random()*768,Math.random()*384,1+Math.random()*2,1+Math.random()*2);}
  const mountain=(x,y,w,h,color)=>{muralCtx.fillStyle=color;muralCtx.beginPath();muralCtx.moveTo(x,y+h);muralCtx.lineTo(x+w*.18,y+h*.42);muralCtx.lineTo(x+w*.34,y+h*.62);muralCtx.lineTo(x+w*.56,y);muralCtx.lineTo(x+w*.78,y+h*.54);muralCtx.lineTo(x+w,y+h);muralCtx.closePath();muralCtx.fill();};
  mountain(0,82,768,230,"#667566");mountain(70,132,650,170,"#7f8066");mountain(0,204,768,112,"#9a8d69");
  muralCtx.strokeStyle="rgba(225,207,158,.72)";muralCtx.lineWidth=3;
  for(let i=0;i<6;i++){const y=54+i*18;muralCtx.beginPath();muralCtx.moveTo(40+i*16,y);muralCtx.bezierCurveTo(100+i*16,y-22,130+i*16,y+24,188+i*16,y);muralCtx.stroke();}
  const lotus=(cx,cy,scale)=>{
   muralCtx.save();muralCtx.translate(cx,cy);muralCtx.scale(scale,scale);
   muralCtx.strokeStyle="#d7c18c";muralCtx.lineWidth=3;
   for(let i=0;i<9;i++){const a=(i-4)*.25;muralCtx.beginPath();muralCtx.ellipse(Math.sin(a)*30,-22-Math.abs(i-4)*3,13,39,a,0,Math.PI*2);muralCtx.stroke();}
   muralCtx.beginPath();muralCtx.ellipse(0,0,48,10,0,0,Math.PI*2);muralCtx.stroke();
   muralCtx.restore();
  };
  lotus(150,272,1.05);lotus(610,262,.92);
  muralCtx.strokeStyle="rgba(220,195,137,.72)";muralCtx.lineWidth=2;
  for(let x=30;x<760;x+=42){muralCtx.beginPath();muralCtx.moveTo(x,340);muralCtx.quadraticCurveTo(x+18,328,x+34,340);muralCtx.stroke();}
  const muralMap=new THREE.CanvasTexture(muralCanvas);muralMap.colorSpace=THREE.SRGBColorSpace;
  const muralMaterial=new THREE.MeshStandardMaterial({map:muralMap,roughness:1,side:THREE.DoubleSide});
  const muralFrame=mat(0x4a3325,.82),muralGold=mat(0xb08c53,.72,{metalness:.18});
  for(const side of [-1,1]){
   const x=side*12.64,rotation=-side*Math.PI/2;
   const panel=add(new THREE.PlaneGeometry(5.45,3.0),muralMaterial,altar,[x,3.86,-37.5],[0,rotation,0],false);
   for(const y of [2.31,5.41])add(new THREE.BoxGeometry(.13,.13,5.72),muralFrame,altar,[side*12.57,y,-37.5]);
   for(const z of [-40.36,-34.64])add(new THREE.BoxGeometry(.13,3.22,.13),muralFrame,altar,[side*12.57,3.86,z]);
   for(const y of [2.42,5.3])add(new THREE.BoxGeometry(.06,.035,5.5),muralGold,altar,[side*12.49,y,-37.5]);
  }
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
   add(new THREE.SphereGeometry(.035,10,8),budDark,altar,[side*.19,4.18,-.585]).scale.set(1,.55,.5);
   const brow=add(new THREE.TorusGeometry(.13,.018,6,18,Math.PI),budDark,altar,[side*.18,4.27,-.57],[0,0,side*.06]);
  }
  add(new THREE.SphereGeometry(.035,10,8),goldLeaf,altar,[0,4.12,-.555]);
  // Softly modelled nose bridge and closed lips, aligned to the face surface.
  add(new THREE.CapsuleGeometry(.035,.16,5,8),bud,altar,[0,4.095,-.59]);
  const budMouth=new THREE.CatmullRomCurve3([new THREE.Vector3(-.075,3.985,-.575),new THREE.Vector3(0,3.972,-.602),new THREE.Vector3(.075,3.985,-.575)]);
  altar.add(new THREE.Mesh(new THREE.TubeGeometry(budMouth,12,.009,6,false),budDark));
  add(new THREE.SphereGeometry(.19,18,14),bud,altar,[0,4.62,-.95]).scale.set(.72,1,.72);
  // Fine raised curls on the scalp catch the warm interior lighting.
  for(let row=0;row<4;row++)for(let col=0;col<11;col++){
   const x=(col-5)*.064,y=4.39+row*.075,z=-.95+Math.sqrt(Math.max(.04,.19-x*x-(y-4.42)*(y-4.42)))*.72;
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
   const light=new THREE.PointLight(0xffb76a,.32,4);light.position.set(0,.3,0);lamp.add(light);this.nightLights.push({light,base:.32});
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
   const lantern=new THREE.Group();lantern.position.set(side*10.92,3.75,-38.1);altar.add(lantern);
   add(new THREE.CylinderGeometry(.28,.22,.12,8),frameMat,lantern,[0,.57,0]);
   add(new THREE.CylinderGeometry(.22,.22,.82,8,1,true),mat(0xe3c98d,.7,{emissive:0x8a5b25,emissiveIntensity:.16,transparent:true,opacity:.9,side:THREE.DoubleSide}),lantern,[0,0,0]);
   add(new THREE.CylinderGeometry(.28,.28,.1,8),frameMat,lantern,[0,-.48,0]);
   add(new THREE.ConeGeometry(.07,.22,8),goldLeaf,lantern,[0,-.64,0]);
   const flame=add(new THREE.SphereGeometry(.065,9,7),new THREE.MeshBasicMaterial({color:0xffa34e}),lantern,[0,0,0]);
   flame.scale.set(.72,1.45,.72);
   const glow=new THREE.PointLight(0xffc77e,.42,5);glow.position.set(0,0,0);lantern.add(glow);
   this.templeLanterns.push({flame,glow,phase:Math.random()*6.28});
  }
  // A traditional red-and-gold runner guides visitors from the entrance toward the Buddha.
  const runnerMat=mat(0x6f2825,.98),runnerGold=mat(0xc6a56c,.78),runnerDark=mat(0x4a201e,.98);
  const runner=new THREE.Group();runner.position.set(0,.565,0);altar.add(runner);
  add(new THREE.BoxGeometry(4.8,.035,7.2),runnerMat,runner,[0,0,5.05]);
  for(const side of [-1,1]){
   add(new THREE.BoxGeometry(.095,.018,7.0),runnerGold,runner,[side*2.27,.027,5.05]);
   for(let i=0;i<9;i++){
    const z=1.85+i*.8;
    add(new THREE.TorusGeometry(.19,.018,6,20),runnerGold,runner,[side*1.7,.03,z],[Math.PI/2,0,0]);
    const flower=add(new THREE.SphereGeometry(.11,8,6),runnerGold,runner,[side*1.7,.03,z]);flower.scale.set(.65,.12,1.5);
   }
  }
  for(const z of [1.55,8.55])add(new THREE.BoxGeometry(4.65,.025,.09),runnerGold,runner,[0,.03,z]);
  // Exposed timber ceiling structure gives the sanctuary a convincing interior scale.
  const rafters=mat(0x493326,.92),beamGold=mat(0x80613f,.82);
  for(let z=-7;z<=7;z+=2.8){
   add(new THREE.BoxGeometry(23.2,.24,.28),rafters,altar,[0,7.1,z]);
   add(new THREE.BoxGeometry(.09,.035,.3),beamGold,altar,[0,7.23,z]);
  }
  for(const x of [-10.9,-7.2,-3.6,0,3.6,7.2,10.9]){
   add(new THREE.BoxGeometry(.28,.24,15.8),rafters,altar,[x,7.08,0]);
  }
  // Slow, translucent incense smoke rises continuously from the offering vessel.
  const smokeMat=new THREE.MeshBasicMaterial({color:0xe8e2d5,transparent:true,opacity:.16,depthWrite:false});
  for(const origin of [[0,1.62,1.1]]){
   for(let i=0;i<9;i++){
    const puff=add(new THREE.SphereGeometry(.105+(i%3)*.025,8,7),smokeMat.clone(),altar,[origin[0]+Math.sin(i*2.1)*.12,origin[1]+i*.24,origin[2]+Math.cos(i*1.7)*.1],[0,0,0],false);
    puff.userData.smoke={origin,phase:i/9,seed:i*1.71};
    this.incenseSmoke.push(puff);
   }
  }
  // A spacious, symmetrical arrangement of brocade cushions throughout the hall.
  for(const [x,z] of HALL_CUSHION_OFFSETS){
   const matGroup=new THREE.Group();matGroup.position.set(x,.58,z);altar.add(matGroup);
   const base=add(new THREE.BoxGeometry(1.28,.18,1.05),cushionEdge,matGroup,[0,0,0]);base.scale.set(1,.85,1);
   const pad=add(new THREE.BoxGeometry(1.16,.2,.93),cushion,matGroup,[0,.12,0]);pad.scale.set(1,.8,1);
   add(new THREE.BoxGeometry(1.05,.025,.025),goldLeaf,matGroup,[0,.225,.46]);
   for(const side of [-1,1])add(new THREE.SphereGeometry(.035,8,6),goldLeaf,matGroup,[side*.48,.23,.38]);
  }
  // Meditation hall interior: a smaller Buddha shrine, four cushions, timber screens and warm lamps.
  const meditationRoom=new THREE.Group();meditationRoom.position.set(-28,0,-25);s.add(meditationRoom);meditationRoom.visible=false;
  add(new THREE.PlaneGeometry(12.5,9.5),m.stoneLight,meditationRoom,[0,.546,0],[-Math.PI/2,0,0],false);
  const smallShrine=new THREE.Group();smallShrine.position.set(0,0,-3.45);meditationRoom.add(smallShrine);
  add(new THREE.CylinderGeometry(1.15,1.3,.28,32),darkWood,smallShrine,[0,.72,0]);
  add(new THREE.CylinderGeometry(1.02,1.12,.18,32),goldLeaf,smallShrine,[0,.94,0]);
  for(let i=0;i<12;i++){const a=i*Math.PI*2/12,petal=add(new THREE.SphereGeometry(.28,10,8),bud,smallShrine,[Math.cos(a)*.62,1.1,Math.sin(a)*.62]);petal.scale.set(.45,.2,1.1);petal.rotation.y=-a;}
  const smallSeat=add(new THREE.SphereGeometry(1,18,12),bud,smallShrine,[0,1.22,0]);smallSeat.scale.set(.78,.24,.58);
  add(new THREE.CylinderGeometry(.38,.48,1.0,20),bud,smallShrine,[0,1.75,0]);
  const smallFace=add(new THREE.SphereGeometry(.27,20,16),bud,smallShrine,[0,2.42,.015]);smallFace.scale.set(.84,1.12,.8);
  add(new THREE.SphereGeometry(.12,14,10),bud,smallShrine,[0,2.76,0]).scale.set(.8,1,.8);
  for(const side of [-1,1]){
   add(new THREE.SphereGeometry(.065,10,8),bud,smallShrine,[side*.25,2.35,.05]).scale.set(.7,1.45,.7);
   const eye=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.105,2.43,.238),new THREE.Vector3(side*.055,2.415,.25),new THREE.Vector3(side*.02,2.43,.255)]);
   smallShrine.add(new THREE.Mesh(new THREE.TubeGeometry(eye,8,.008,5,false),budDark));
  }
  add(new THREE.SphereGeometry(.025,8,8),goldLeaf,smallShrine,[0,2.4,.26]);
  const smallHalo=add(new THREE.TorusGeometry(.78,.035,8,48),goldLeaf,smallShrine,[0,2.42,-.34],[0,0,0]);
  for(const x of [-4.2,-1.4,1.4,4.2]){
   const cushionGroup=new THREE.Group();cushionGroup.position.set(x,.58,1.35);meditationRoom.add(cushionGroup);
   add(new THREE.BoxGeometry(1.12,.18,.96),cushionEdge,cushionGroup,[0,0,0]).scale.set(1,.85,1);
   add(new THREE.BoxGeometry(1.02,.2,.84),cushion,cushionGroup,[0,.12,0]).scale.set(1,.8,1);
   add(new THREE.BoxGeometry(.92,.025,.025),goldLeaf,cushionGroup,[0,.225,.41]);
   for(const side of [-1,1])add(new THREE.SphereGeometry(.03,8,6),goldLeaf,cushionGroup,[side*.42,.23,.34]);
  }
  // A low scripture stand and framed calligraphy give the room a clear contemplative purpose.
  add(new THREE.BoxGeometry(2.4,.18,.72),darkWood,meditationRoom,[0,1.0,-1.55]);
  for(const x of [-.9,0,.9])add(new THREE.BoxGeometry(.08,.58,.08),goldLeaf,meditationRoom,[x,1.34,-1.55]);

  for(const side of [-1,1]){
   const lamp=new THREE.Group();lamp.position.set(side*5.35,2.2,-2.5);meditationRoom.add(lamp);
   add(new THREE.BoxGeometry(.16,.65,.16),darkWood,lamp,[0,-.32,0]);
   add(new THREE.BoxGeometry(.56,.1,.56),goldLeaf,lamp,[0,.08,0]);
   add(new THREE.BoxGeometry(.38,.48,.38),m.paper,lamp,[0,.36,0]);
   const glow=new THREE.PointLight(0xffc77e,.24,4);glow.position.y=.4;lamp.add(glow);this.nightLights.push({light:glow,base:.24});
  }

  // Sutra Library: continuous bookcases, individually bound volumes and a low reading desk.
  const libraryRoom=new THREE.Group();libraryRoom.position.set(28,0,-24);s.add(libraryRoom);libraryRoom.visible=false;
  const shelfWood=mat(0x493326,.9),bookPalette=[0x783c32,0x435c50,0x8c7048,0x3e4e61,0x80604b];
  const bookGeometry=new THREE.BoxGeometry(.27,.53,.39),bookMaterial=mat(0xffffff,.92,{vertexColors:true});
  const bookInstances=new THREE.InstancedMesh(bookGeometry,bookMaterial,120),bookDummy=new THREE.Object3D();let bookIndex=0;
  bookInstances.castShadow=false;bookInstances.receiveShadow=false;
  for(const side of [-1,1]){
   for(let tier=0;tier<4;tier++){
    const y=.78+tier*.88;
    add(new THREE.BoxGeometry(.68,.13,8.8),shelfWood,libraryRoom,[side*5.35,y,0]);
    for(let z=-3.65;z<=3.65;z+=.52){
     bookDummy.position.set(side*5.26,y+.34,z);
     bookDummy.rotation.set(0,Math.sin(z*2+tier)*.055,0);
     bookDummy.scale.set(1,.82+Math.abs(Math.sin(z*4+tier))*.32,1);
     bookDummy.updateMatrix();bookInstances.setMatrixAt(bookIndex,bookDummy.matrix);
     bookInstances.setColorAt(bookIndex,new THREE.Color(bookPalette[Math.floor((z+4)*3+tier+side+30)%bookPalette.length]));
     bookIndex++;
    }
   }
   for(const z of [-4.35,4.35])add(new THREE.BoxGeometry(.22,4.0,.22),shelfWood,libraryRoom,[side*5.35,2.2,z]);
  }
  bookInstances.instanceMatrix.needsUpdate=true;
  if(bookInstances.instanceColor)bookInstances.instanceColor.needsUpdate=true;
  libraryRoom.add(bookInstances);
  add(new THREE.BoxGeometry(2.8,.2,1.05),shelfWood,libraryRoom,[0,.95,2.0]);
  for(const x of [-1.05,1.05])add(new THREE.BoxGeometry(.16,.78,.16),shelfWood,libraryRoom,[x,.48,2.0]);
  add(new THREE.CylinderGeometry(.11,.11,1.45,12),goldLeaf,libraryRoom,[0,1.12,2.0],[0,0,Math.PI/2]);

  // Monk quarters: two low timber beds, folded bedding, pillows and privacy screens.
  const dormRoom=new THREE.Group();dormRoom.position.set(28,0,8);s.add(dormRoom);dormRoom.visible=false;
  const bedWood=mat(0x59402e,.92),linen=mat(0xb7aa8e,.98),blanket=mat(0x85745d,.98);
  for(const side of [-1,1]){
   const x=side*3.0;
   add(new THREE.BoxGeometry(2.65,.42,3.35),bedWood,dormRoom,[x,.75,-.65]);
   add(new THREE.BoxGeometry(2.42,.16,3.12),linen,dormRoom,[x,.99,-.65]);
   add(new THREE.BoxGeometry(2.34,.1,1.32),blanket,dormRoom,[x,1.12,-1.25]);
   add(new THREE.BoxGeometry(1.05,.28,.62),linen,dormRoom,[x,1.18,.55]);
   add(new THREE.BoxGeometry(.1,1.8,.1),bedWood,dormRoom,[x-side*1.45,1.42,1.65]);
   add(new THREE.BoxGeometry(.1,1.8,.1),bedWood,dormRoom,[x-side*1.45,1.42,-2.95]);
   add(new THREE.BoxGeometry(.12,1.8,4.7),bedWood,dormRoom,[x-side*1.45,1.42,-.65]);
  }
  add(new THREE.BoxGeometry(1.6,.18,.8),bedWood,dormRoom,[0,.82,2.2]);

  // Bell tower & bronze bell
  const bell=new THREE.Group();bell.position.set(8,0,-41);s.add(bell);
  add(new THREE.CylinderGeometry(1.05,1.28,2,24),mat(0x927444,.42,{metalness:.62}),bell,[0,2.25,0]);
  add(new THREE.TorusGeometry(1.1,.12,8,32),m.gold,bell,[0,3.15,0],[Math.PI/2,0,0]);
  add(new THREE.CylinderGeometry(.08,.08,1.8,10),m.darkWood,bell,[0,1.6,0]);add(new THREE.SphereGeometry(.2,10,8),m.gold,bell,[0,.85,0]);
  // A quiet shrine now occupies the former west-side washroom site.
  const shrine=new THREE.Group();shrine.position.set(-22.5,0,-32);s.add(shrine);this.shrine=shrine;
  const shrineStone=mat(0xb8ad98,.96),shrineWood=mat(0x493326,.9),shrineTrim=mat(0x9b7a4d,.8);
  const shrineBronze=mat(0x715b43,.5,{metalness:.42}),shrineGold=mat(0xc29a59,.4,{metalness:.48});
  // Open-air altar: no enclosure, pillars, signboard or roof.
  add(new THREE.BoxGeometry(4.8,.24,3.8),shrineStone,shrine,[0,.12,0]);
  add(new THREE.PlaneGeometry(4.45,3.45),m.stoneLight,shrine,[0,.245,0],[-Math.PI/2,0,0],false);
  add(new THREE.BoxGeometry(3.15,.2,.88),shrineWood,shrine,[0,1.03,-.72]);
  for(const x of [-1.32,1.32])for(const z of [-1.02,-.42])add(new THREE.BoxGeometry(.16,.78,.16),shrineWood,shrine,[x,.53,z]);
  add(new THREE.BoxGeometry(3.3,.09,.96),shrineTrim,shrine,[0,1.17,-.72]);
  const idol=new THREE.Group();idol.position.set(0,1.22,-1.28);shrine.add(idol);
  add(new THREE.CylinderGeometry(.54,.62,.16,24),shrineGold,idol,[0,.13,0]);
  add(new THREE.SphereGeometry(1,18,14),shrineBronze,idol,[0,.43,0]).scale.set(.62,.25,.43);
  add(new THREE.SphereGeometry(1,18,14),shrineGold,idol,[0,.78,0]).scale.set(.48,.62,.36);
  add(new THREE.SphereGeometry(1,18,14),shrineGold,idol,[0,1.48,0]).scale.set(.39,.47,.34);
  add(new THREE.SphereGeometry(.14,12,10),shrineGold,idol,[0,1.91,0]);
  for(const side of [-1,1]){
   add(new THREE.SphereGeometry(.11,10,8),shrineGold,idol,[side*.405,1.48,.015]).scale.set(.7,1.55,.7);
   add(new THREE.CapsuleGeometry(.12,.38,5,8),shrineGold,idol,[side*.39,.94,.1],[0,0,side*.28]);
  }
  add(new THREE.TorusGeometry(.82,.045,8,40),shrineGold,idol,[0,1.28,-.2]);
  for(const x of [-1.08,1.08]){
   add(new THREE.CylinderGeometry(.12,.2,.2,12),shrineBronze,shrine,[x,1.36,-.18]);
   add(new THREE.SphereGeometry(.07,8,7),new THREE.MeshBasicMaterial({color:0xffc27d}),shrine,[x,1.51,-.18],[0,0,0],false);
   const lamp=new THREE.PointLight(0xffc17a,.18,4);lamp.position.set(x,1.58,-.18);shrine.add(lamp);this.nightLights.push({light:lamp,base:.18});
  }
  add(new THREE.CylinderGeometry(.18,.22,.16,16),shrineBronze,shrine,[0,1.34,.18]);
  add(new THREE.TorusGeometry(.19,.025,7,24),shrineGold,shrine,[0,1.43,.18],[Math.PI/2,0,0]);
  const shrineGlow=new THREE.PointLight(0xffd39a,.28,8);shrineGlow.position.set(0,2.0,-.4);shrine.add(shrineGlow);this.nightLights.push({light:shrineGlow,base:.28});
  this.shrineSign=null;

  // The two-pan washroom now sits behind the Great Buddha Hall, beside the forest tea house.
  const washroom=new THREE.Group();washroom.position.set(10.6,0,-66.5);s.add(washroom);this.washroom=washroom;
  const washStone=mat(0xb8ad98,.96),washWood=mat(0x493326,.9),washRoof=mat(0x35483d,.94),washTrim=mat(0x9b7a4d,.8);
  add(new THREE.BoxGeometry(6.1,.22,5.25),washStone,washroom,[0,.11,0]);
  add(new THREE.PlaneGeometry(5.6,4.8),m.stoneLight,washroom,[0,.235,0],[-Math.PI/2,0,0],false);
  add(new THREE.BoxGeometry(.24,2.65,5.0),washStone,washroom,[-2.8,1.56,0]);
  add(new THREE.BoxGeometry(.24,2.65,5.0),washStone,washroom,[2.8,1.56,0]);
  add(new THREE.BoxGeometry(5.6,2.65,.24),washStone,washroom,[0,1.56,-2.38]);
  add(new THREE.BoxGeometry(1.95,2.65,.24),washStone,washroom,[-1.83,1.56,2.38]);
  add(new THREE.BoxGeometry(1.95,2.65,.24),washStone,washroom,[1.83,1.56,2.38]);
  for(const x of [-.94,.94])add(new THREE.BoxGeometry(.16,2.75,.2),washWood,washroom,[x,1.6,2.38]);
  add(new THREE.BoxGeometry(.18,2.0,1.8),washStone,washroom,[.55,1.18,1.0]);
  add(new THREE.BoxGeometry(6.5,.2,5.7),washWood,washroom,[0,2.9,0]);
  const washRoofGroup=new THREE.Group();washroom.add(washRoofGroup);
  planeRoof(washRoofGroup,6.2,5.4,3.95,3.45,1,washRoof);planeRoof(washRoofGroup,6.2,5.4,3.95,3.45,-1,washRoof);
  add(new THREE.CylinderGeometry(.08,.08,6.5,8),washTrim,washroom,[0,3.9,0],[0,0,Math.PI/2]);
  for(const side of [-1,1]){add(new THREE.BoxGeometry(.13,.13,5.0),washTrim,washroom,[side*2.84,2.83,0]);add(new THREE.BoxGeometry(5.7,.13,.13),washTrim,washroom,[0,2.83,side*2.42]);}
  add(new THREE.PlaneGeometry(2.0,3.0),m.stone,washroom,[0,-.02,3.75],[-Math.PI/2,0,0],false);
  const porcelain=mat(0xe4dfd0,.42,{metalness:.04}),porcelainEdge=mat(0xb8b5a9,.62),toiletHole=mat(0x252925,.98);
  this.squatToilets=[];
  for(const x of [-1.48,1.48]){
   const pan=new THREE.Group();pan.position.set(x,.235,-.58);washroom.add(pan);this.squatToilets.push(pan);
   add(new THREE.BoxGeometry(.96,.13,1.34),porcelain,pan,[0,.07,0]);
   add(new THREE.BoxGeometry(.82,.055,1.18),porcelainEdge,pan,[0,.15,0]);
   for(const side of [-1,1]){
    add(new THREE.BoxGeometry(.19,.09,.82),porcelain,pan,[side*.31,.205,-.02]);
    add(new THREE.BoxGeometry(.15,.035,.68),mat(0xf1ebdc,.52),pan,[side*.31,.263,-.02]);
   }
   const opening=add(new THREE.SphereGeometry(1,18,12),toiletHole,pan,[0,.225,-.08]);opening.scale.set(.155,.025,.35);
   const rim=add(new THREE.TorusGeometry(.205,.04,8,32),porcelain,pan,[0,.235,-.08],[Math.PI/2,0,0]);rim.scale.set(1,1.65,1);
   add(new THREE.BoxGeometry(.42,.07,.18),porcelain,pan,[0,.22,-.55]);
   add(new THREE.CylinderGeometry(.055,.065,.48,10),porcelainEdge,pan,[0,.28,-.69]);
  }
  const washGlow=new THREE.PointLight(0xffd39a,.28,8);washGlow.position.set(0,2.1,-.3);washroom.add(washGlow);this.nightLights.push({light:washGlow,base:.28});
  // Roadside lanterns now run continuously from the mountain approach to the Great Hall and market.
  const lampPositions=[
   [-6,24],[6,24],[-12,-1],[12,-1],[-20,-39],[20,-39],[0,41],
   [-5.5,35],[5.5,35],[-5.5,8],[5.5,8],[-5.5,-7],[5.5,-7],[-5.5,-22],[5.5,-22],
   [35.4,-1],[35.4,15],[35.4,31]
  ];
  this.streetLanterns=[];
  for(const [x,z] of lampPositions){
   const fixture=lantern(s,x,z,m);this.streetLanterns.push(fixture);
   this.nightLights.push({light:fixture.light,base:.52});
  }
  // Keep the large bronze censer beside the approach, not in the central stair path.
  this.incensePosition=new THREE.Vector3(3.3,0,-22.4);
  this.courtyardIncensePosition=this.incensePosition;
  this.courtyardCenser=new THREE.Group();this.courtyardCenser.position.copy(this.courtyardIncensePosition);s.add(this.courtyardCenser);
  const courtyardBronze=mat(0x665b48,.42,{metalness:.62}),courtyardPatina=mat(0x344b3e,.58,{metalness:.42}),courtyardGold=mat(0xb68b4d,.4,{metalness:.58}),censerDark=mat(0x292c25,.96);
  const censerBase=this.courtyardCenser;
  add(new THREE.CylinderGeometry(1.05,1.18,.18,32),m.stoneLight,censerBase,[0,.12,0]);
  add(new THREE.CylinderGeometry(.78,.92,.2,28),courtyardGold,censerBase,[0,.31,0]);
  add(new THREE.TorusGeometry(.83,.075,10,32),courtyardBronze,censerBase,[0,.43,0],[Math.PI/2,0,0]);
  const bowlProfile=[[0,.56],[.54,.56],[.82,.7],[1.08,1.02],[1.28,1.42],[1.24,1.82],[1.13,1.96],[1.02,1.82],[1.08,1.48],[.9,1.02],[.64,.78],[0,.76]].map(([r,y])=>new THREE.Vector2(r,y));
  add(new THREE.LatheGeometry(bowlProfile,40),courtyardBronze,censerBase,[0,0,0]);
  add(new THREE.TorusGeometry(1.2,.105,12,40),courtyardGold,censerBase,[0,1.91,0],[Math.PI/2,0,0]);
  add(new THREE.CircleGeometry(.98,40),censerDark,censerBase,[0,1.78,0],[-Math.PI/2,0,0],false);
  add(new THREE.TorusGeometry(.72,.025,7,28),courtyardPatina,censerBase,[0,1.8,0],[Math.PI/2,0,0]);
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3+Math.PI/6,x=Math.cos(a),z=Math.sin(a),leg=new THREE.Group();
   leg.position.set(x*.82,.53,z*.82);leg.rotation.z=-x*.16;leg.rotation.x=z*.16;censerBase.add(leg);
   add(new THREE.CylinderGeometry(.14,.2,.72,12),courtyardBronze,leg,[0,-.03,0]);
   add(new THREE.SphereGeometry(.2,12,9),courtyardGold,leg,[0,.27,0]).scale.set(.82,1.15,.82);
   add(new THREE.CylinderGeometry(.23,.28,.13,12),courtyardBronze,leg,[0,-.39,0]);
  }
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3;
   add(new THREE.CylinderGeometry(.018,.024,.62,7),mat(0x9a6840,.8),censerBase,[Math.cos(a)*(.16+i*.06),2.05,Math.sin(a)*(.16+i*.06)]);
   add(new THREE.SphereGeometry(.035,8,6),new THREE.MeshBasicMaterial({color:0xff9b52}),censerBase,[Math.cos(a)*(.16+i*.06),2.37,Math.sin(a)*(.16+i*.06)]);
  }
  const courtyardIncenseGlow=new THREE.PointLight(0xffc17a,.28,8);courtyardIncenseGlow.position.set(0,2.55,0);censerBase.add(courtyardIncenseGlow);this.nightLights.push({light:courtyardIncenseGlow,base:.28});
  // Lotus pond
  this.pondPosition=new THREE.Vector3(19,0,-32.5);const pond=new THREE.Group();pond.position.copy(this.pondPosition);s.add(pond);
  add(new THREE.CylinderGeometry(4.05,4.25,.48,64),m.stone,pond,[0,-.03,0]);
  add(new THREE.CircleGeometry(3.88,64),m.water,pond,[0,.27,0],[-Math.PI/2,0,0],false);
  add(new THREE.TorusGeometry(4.02,.18,10,64),m.stoneLight,pond,[0,.3,0],[Math.PI/2,0,0]);
  for(let i=0;i<27;i++){const a=Math.random()*Math.PI*2,r=.45+Math.random()*2.95,x=Math.cos(a)*r,z=Math.sin(a)*r;const pad=add(new THREE.CircleGeometry(.48+Math.random()*.25,9),mat(0x557d5a,.58),pond,[x,.31,z],[-Math.PI/2,0,0],false);this.lotusPads.push({pad,phase:Math.random()*6.28});if(i%3===0){const flower=new THREE.Group();flower.position.set(x,.34,z);pond.add(flower);for(let j=0;j<7;j++){const a=j*Math.PI*2/7,p=add(new THREE.SphereGeometry(.15,8,8),mat(j%2?0xe7d6be:0xc68b92,.62),flower,[Math.cos(a)*.2,.05,Math.sin(a)*.2]);p.scale.set(.7,1.5,.6);}add(new THREE.SphereGeometry(.11,8,8),m.gold,flower,[0,.1,0]);}}
  // Spacious Zen rest hall on the open lawn east of the lotus pond.
  this.zenRoom=new THREE.Group();this.zenRoom.position.set(28,0,-45);s.add(this.zenRoom);
  this.zenRestSpots=[];this.benchRestSpots=[];
  const zen=this.zenRoom,zenStone=mat(0xb9ae98,.94),zenWood=mat(0x4a3426,.9),zenTrim=mat(0xb18b55,.78,{metalness:.1}),zenRoof=mat(0x35483d,.94),bedWood=mat(0x5b4030,.86),bedMat=mat(0xc9b995,.96),bedCover=mat(0x9a8060,.94);
  add(new THREE.BoxGeometry(17.1,.24,14.5),zenStone,zen,[0,.12,0]);
  add(new THREE.PlaneGeometry(16.6,14.0),m.stoneLight,zen,[0,.245,0],[-Math.PI/2,0,0],false);
  add(new THREE.BoxGeometry(.24,3.7,14.2),zenStone,zen,[-8.5,1.95,0]);
  add(new THREE.BoxGeometry(.24,3.7,14.2),zenStone,zen,[8.5,1.95,0]);
  add(new THREE.BoxGeometry(17.0,3.7,.24),zenStone,zen,[0,1.95,-7.15]);
  add(new THREE.BoxGeometry(4.8,3.7,.24),zenStone,zen,[-6.1,1.95,7.15]);
  add(new THREE.BoxGeometry(4.8,3.7,.24),zenStone,zen,[6.1,1.95,7.15]);
  for(const x of [-8.35,8.35])for(const z of [-7,7])add(new THREE.BoxGeometry(.42,4.05,.42),zenWood,zen,[x,2.0,z]);
  add(new THREE.BoxGeometry(17.3,.2,.24),zenWood,zen,[0,3.9,-7.15]);
  add(new THREE.BoxGeometry(17.3,.2,.24),zenWood,zen,[0,3.9,7.15]);
  const zenRoofGroup=new THREE.Group();zen.add(zenRoofGroup);
  planeRoof(zenRoofGroup,17.2,14.2,5.25,4.05,1,zenRoof);planeRoof(zenRoofGroup,17.2,14.2,5.25,4.05,-1,zenRoof);
  add(new THREE.BoxGeometry(17.0,.16,14.0),zenTrim,zen,[0,4.02,0]);
  for(const bx of [-6,-3,0,3,6])for(const bz of [-3.4,2.4]){
   const bed=new THREE.Group();bed.position.set(bx,.26,bz);zen.add(bed);
   add(new THREE.BoxGeometry(2.28,.34,1.62),bedWood,bed,[0,.16,0]);
   add(new THREE.BoxGeometry(2.12,.18,1.48),bedMat,bed,[0,.42,0]);
   add(new THREE.BoxGeometry(1.95,.08,1.02),bedCover,bed,[0,.54,.18]);
   add(new THREE.BoxGeometry(2.28,1.0,.16),bedWood,bed,[0,.74,-.78]);
   add(new THREE.BoxGeometry(.58,.16,.38),bedMat,bed,[0,.64,-.48]);
   this.zenRestSpots.push({x:28+bx,z:-45+bz+(bz<0?1.65:-1.65),type:"bed",rotation:bz<0?Math.PI:0});
  }
  const zenCanvas=document.createElement("canvas");zenCanvas.width=512;zenCanvas.height=128;const zctx=zenCanvas.getContext("2d");
  zctx.fillStyle="#493526";zctx.fillRect(0,0,512,128);zctx.strokeStyle="#d8bd82";zctx.lineWidth=7;zctx.strokeRect(8,8,496,112);
  zctx.textAlign="center";zctx.textBaseline="middle";zctx.font='bold 66px "Songti SC","Noto Serif CJK SC",serif';zctx.fillStyle="#fff0cc";zctx.fillText("禅房",256,64);
  const zenTexture=new THREE.CanvasTexture(zenCanvas);zenTexture.colorSpace=THREE.SRGBColorSpace;
  add(new THREE.BoxGeometry(4.2,.86,.18),zenWood,zen,[0,3.25,7.24]);
  add(new THREE.PlaneGeometry(3.9,.66),new THREE.MeshBasicMaterial({map:zenTexture,toneMapped:false}),zen,[0,3.25,7.34],[0,0,0],false);
  const benchPositions=[[-24,-15],[-24,8],[25,10],[25,-14],[0,47],[-15,35],[14,35],[-15,-48]];
  for(const [bx,bz] of benchPositions){
   const bench=new THREE.Group();bench.position.set(bx,0,bz);s.add(bench);
   add(new THREE.BoxGeometry(2.5,.18,.68),bedWood,bench,[0,.82,0]);
   add(new THREE.BoxGeometry(2.5,.78,.16),bedWood,bench,[0,1.25,-.28]);
   for(const lx of [-.92,.92])add(new THREE.BoxGeometry(.16,.78,.18),zenWood,bench,[lx,.42,0]);
   this.benchRestSpots.push({x:bx,z:bz+1.25,type:"bench",rotation:Math.PI});
  }
  // Bodhi tree
  const bodhi=new THREE.Group();bodhi.position.set(-29,0,29);s.add(bodhi);bodhi.visible=false;add(new THREE.CylinderGeometry(.7,1,7,12),m.bark,bodhi,[0,3.5,0]);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;add(new THREE.CylinderGeometry(.18,.34,4,8),m.bark,bodhi,[Math.cos(a)*1.4,5,Math.sin(a)*1.4],[0,0,-Math.cos(a)*.45]);}
  for(let i=0;i<24;i++){const a=i*2.399,r=.65+Math.random()*3.15,leaf=add(new THREE.IcosahedronGeometry(1.55+Math.random()*.55,1),i%3===0?m.pine2:m.pine,bodhi,[Math.cos(a)*r,6.8+Math.random()*3.0,Math.sin(a)*r],[Math.random()*.45,Math.random()*6.28,Math.random()*.45]);leaf.scale.set(1.15+Math.random()*.45,.72+Math.random()*.48,.9+Math.random()*.45);}
  // The west boundary is now the full-height Lotus Wish Wall; retain the low east boundary.
  for(const side of [1]){add(new THREE.BoxGeometry(.5,.7,45),m.stone,s,[side*31,.18,-11]);for(let z=-30;z<10;z+=5)add(new THREE.BoxGeometry(.9,.9,.9),m.stoneLight,s,[side*31,.55,z]);}
  // Floating warm dust
  this.ambient=new THREE.Group();s.add(this.ambient);
  for(let i=0;i<(this.mobile?14:62);i++){const d=add(new THREE.SphereGeometry(.035+Math.random()*.025,6,6),new THREE.MeshBasicMaterial({color:i%4?0xe9d9ad:0xffd78a,transparent:true,opacity:.25+Math.random()*.35}),this.ambient,[(Math.random()-.5)*72,1+Math.random()*11,(Math.random()-.5)*72],[0,0,0],false);d.userData.phase=Math.random()*8;d.userData.y=d.position.y;}
 }
 setWishWallPrayers(prayers=[]){
  this.wishWallPrayers=(Array.isArray(prayers)?prayers:[]).filter(p=>!/(?:你的|your)?(?:test|测试)(?:文字|祈愿|wish|prayer)?/i.test(String(p?.message||"").normalize("NFKC").replace(/\s+/g,""))).slice(0,16).map(p=>({message:Array.from(String(p?.message||"")).slice(0,20).join("")}));
  if(!this.wishWallCanvas||!this.wishWallTexture)return;
  const ctx=this.wishWallCanvas.getContext("2d");
  ctx.clearRect(0,0,this.wishWallCanvas.width,this.wishWallCanvas.height);
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font='42px "Noto Serif SC","Songti SC",serif';
  ctx.fillStyle="rgba(91,62,32,.94)";
  // Leave a clear central space for the permanent gold 福; wishes are written
  // in two quiet columns on either side, without headings, names or timestamps.
  const left=this.wishWallPrayers.slice(0,8),right=this.wishWallPrayers.slice(8,16);
  left.forEach((p,i)=>ctx.fillText(p.message,930,56+i*56,1500));
  right.forEach((p,i)=>ctx.fillText(p.message,3166,56+i*56,1500));
  this.wishWallTexture.needsUpdate=true;
 }
 buildNpcs(){
  // Keep the courtyard free of autonomous walkers; online visitors are unaffected.
  this.npcs=[];

  const allVendors=[...(this.vendorSpecs||[]),...(this.roadsideVendorSpecs||[])];
  for(const spec of allVendors){
   const sellerX=spec.area==="road"?spec.x+(spec.side===-1?1.72:-1.72):spec.x+1.72;
   const seller=marketVendor(this.scene,sellerX,spec.z,spec.facing,this.m);seller.name="vendor-"+spec.kind;
   this.npcs.push({avatar:{root:seller,update(dt,time){seller.rotation.y=spec.facing+Math.sin(time*.0007+spec.z)*.04;seller.userData.animateInteraction?.(time,spec.z);},dispose(){seller.parent?.remove(seller);}},stationary:true,vendor:true,phase:spec.z,kind:spec.kind});

  }

  const teaHost=marketVendor(this.scene,0,-56.5,Math.PI,this.m);teaHost.name="tea-house-host";
  this.npcs.push({avatar:{root:teaHost,update(){},dispose(){teaHost.parent?.remove(teaHost);}},stationary:true});
  const restaurantHost=marketVendor(this.scene,23.2,25,-Math.PI/2,this.m);restaurantHost.name="vegetarian-kitchen-host";
  this.npcs.push({avatar:{root:restaurantHost,update(dt,time){restaurantHost.userData.animateInteraction?.(time,25);},dispose(){restaurantHost.parent?.remove(restaurantHost);}},stationary:true});
 }
 updateNpcs(dt,time){
  for(const npc of this.npcs||[]){
   const a=npc.avatar,p=a.root.position;
   if(npc.stationary){
    if(npc.shopper){
     const cycle=(time*.00022+(npc.phase||0))%6.28;
     a.root.rotation.y=Math.PI/2+Math.sin(cycle)*.12;
     if(time>=(npc.nextGestureAt||0)){
      a.setPose(Math.sin(cycle*1.7)>.0?"greet":"bow",1100);
      npc.nextGestureAt=time+2200+Math.abs(Math.sin(cycle))*1600;
     }
    }
    a.update(dt,time,false);continue;
   }
   if(npc.moving){
    const dx=npc.target.x-p.x,dz=npc.target.z-p.z,dist=Math.hypot(dx,dz);
    if(dist<.48){
     npc.moving=false;
     const action=npc.routine[npc.routineStep++%npc.routine.length];
     const duration=npc.shopper||npc.roadWalker?1150:action==="meditate"?6200:action==="sweep"?4800:3400;
     a.setPose(action,duration);
     npc.nextAt=time+duration+(npc.shopper||npc.roadWalker?900:1800)+Math.random()*1200;
     npc.stuckAt=0;
    }
    else{
     const step=Math.min(dist,1.25*dt),r=moveWithCollision(p,dx/dist*step,dz/dist*step,this.npcCollisionWorld(a));
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
 npcCollisionWorld(exclude){
  // Visitors must not pin the abbot in place; static walls and props still block his route.
  return {...this.collision,actors:[]};
 }
 actorCollisionWorld(exclude){
  const actors=[];
  const addActor=a=>{if(!a||a===exclude)return;const p=a.root.position;actors.push({x:p.x,z:p.z,radius:.5});};
  if(this.local)addActor(this.local);
  for(const a of this.remotes.values())addActor(a);
  for(const npc of this.npcs||[])addActor(npc.avatar);
  return {...this.collision,actors};
 }
 isInsideHall(position){
  return this.halls.some(h=>Math.abs(position.x-h.x)<h.w/2-.8&&position.z>h.z-h.d/2+.8&&position.z<h.z+h.d/2-.55);
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
  this.stopWander();
  this.moveTarget=new THREE.Vector3(hit.x,0,hit.z);this.moveWaypoints=[];this.pendingAction=null;
  return true;
 }
 applyRenderResolution(){
  const base=Math.min(Math.max(devicePixelRatio||1,1),this.mobile?1.4:1.8);
  // Low-load mode halves the linear render resolution on mobile. This shades
  // about one quarter as many pixels while preserving full scene geometry.
  const reduced=this.mobile?Math.max(.62,Math.min(.70,base*.5)):Math.max(.78,Math.min(1.02,base*.56));
  const ratio=this.smoothMode?reduced:base;
  const viewport=window.visualViewport,width=Math.max(1,viewport?.width||innerWidth),height=Math.max(1,viewport?.height||innerHeight);
  this.renderPixelRatio=ratio;this.renderFrameInterval=this.smoothMode?(this.mobile?1000/24:1000/30):(this.mobile?25:0);
  this.renderer.setPixelRatio(ratio);this.renderer.setSize(width,height,false);
  return ratio;
 }
 refreshLowDetailLights(force=false,time=performance.now()){
  const lights=[...(this.nightLights||[]).map(entry=>entry.light),...(this.templeLanterns||[]).map(item=>item.glow)];
  if(!this.smoothMode){for(const light of lights)light.visible=true;return;}
  if(!force&&time-this.lastLowDetailLights<1600)return;
  this.lastLowDetailLights=time;
  const origin=this.local?.root.position||{x:0,z:25};
  const ranked=lights.map(light=>{const pos=light.getWorldPosition(new THREE.Vector3());return {light,d:(pos.x-origin.x)**2+(pos.z-origin.z)**2};}).sort((a,b)=>a.d-b.d);
  const active=new Set(ranked.slice(0,7).map(item=>item.light));
  for(const light of lights)light.visible=active.has(light);
 }
 setSmoothMode(enabled){
  this.smoothMode=!!enabled;
  this.renderer.shadowMap.enabled=!this.mobile&&!this.smoothMode;
  this.sunLight.castShadow=!this.mobile&&!this.smoothMode;
  if(this.ambient)this.ambient.visible=!this.smoothMode;
  for(const puff of this.incenseSmoke||[])puff.visible=!this.smoothMode;
  this.refreshLowDetailLights(true);
  this.applyRenderResolution();
  return this.smoothMode;
 }
 getRenderState(){
  const lights=[...(this.nightLights||[]).map(entry=>entry.light),...(this.templeLanterns||[]).map(item=>item.glow)];
  return {pixelRatio:this.renderer.getPixelRatio(),frameInterval:this.renderFrameInterval,ambientVisible:this.ambient?.visible!==false,smokeVisible:(this.incenseSmoke||[]).some(p=>p.visible),shadows:this.renderer.shadowMap.enabled,remoteLimit:this.smoothMode?(this.mobile?5:10):(this.mobile?12:28),visiblePointLights:lights.filter(light=>light.visible).length};
 }
 resize(){const viewport=window.visualViewport,width=Math.max(1,viewport?.width||innerWidth),height=Math.max(1,viewport?.height||innerHeight);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.mobile=matchMedia("(max-width: 660px)").matches;this.renderer.shadowMap.enabled=!this.mobile&&!this.smoothMode;this.sunLight.castShadow=!this.mobile&&!this.smoothMode;this.refreshLowDetailLights(true);this.applyRenderResolution();}
 setLocalProfile(p,id){
  if(this.local){const oldStyle=this.local.profile?.style,pos=this.getPosition();this.local.setProfile(p);if(oldStyle!==p.style){this.local.dispose();this.local=avatar(this.scene,p,id,true);this.local.setPosition(pos.x,pos.z,pos.rotation,groundHeightAt(pos.x,pos.z,this.halls));}return;}
  this.local=avatar(this.scene,p,id,true);
  let hash=0;for(const ch of String(id||""))hash=(hash*31+ch.charCodeAt(0))>>>0;
  const total=180,start=hash%total;let spawn=null;
  for(let step=0;step<total;step++){
   const slot=(start+step)%total,x=-11.4+(slot%20)*1.2,z=-22+Math.floor(slot/20)*1.2;
   const occupied=[...this.remotes.values(),...(this.npcs||[]).map(n=>n.avatar)].some(a=>Math.hypot(a.root.position.x-x,a.root.position.z-z)<1.0);
   if(!collidesAt(x,z,this.collision)&&!occupied){spawn={x,z};break;}
  }
  const pos=spawn||{x:0,z:25};
  this.local.setPosition(pos.x,pos.z,0,groundHeightAt(pos.x,pos.z,this.halls));
 }
 addRemote(p){if(!p?.id||p.id===this.local?.id)return;if(this.remotes.has(p.id)){this.updateRemote(p);return;}const a=avatar(this.scene,p,p.id);a.setPosition(p.x,p.z,p.rotation||0);a.setTarget(p);this.remotes.set(p.id,a);}
 updateRemote(p){if(!p?.id||p.id===this.local?.id)return;let a=this.remotes.get(p.id);if(!a){this.addRemote(p);return;}if(a.profile.style!==p.style){const pos=a.root.position.clone(),rotation=a.root.rotation.y;a.dispose();a=avatar(this.scene,p,p.id);a.setPosition(pos.x,pos.z,rotation);this.remotes.set(p.id,a);}else if(a.profile.name!==p.name||a.profile.robe!==p.robe||a.profile.skin!==p.skin)a.setProfile(p);a.setTarget(p);}
 removeRemote(id){const a=this.remotes.get(id);if(a){a.dispose();this.remotes.delete(id);}}
 requestJump(){if(!this.local)return false;if(this.jumpOffset<=.001&&this.jumpVelocity<=.01){this.jumpOffset=.14;this.jumpVelocity=4.35;this.jumpHeld=true;const p=this.local.root.position;this.local.root.position.y=groundHeightAt(p.x,p.z,this.halls)+this.jumpOffset;return true;}return false;}
 setDebugPosition(x,z){if(!this.local)return;this.stopWander();this.local.setPosition(x,z,this.local.root.rotation.y,groundHeightAt(x,z,this.halls));this.moveTarget=null;this.moveWaypoints=[];this.pendingAction=null;this.moveVelocity.set(0,0);}
 setDebugYaw(yaw){this.yaw=Number(yaw)||0;}
 setLocalPose(action){
  if(!this.local)return;this.stopWander();
  if(action==="rest"){
   const p=this.local.root.position;
   const spot=this.pendingRestSpot||[...(this.zenRestSpots||[]),...(this.benchRestSpots||[])].sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0];
   if(spot){this.local.setPosition(spot.x,spot.z,spot.rotation||0,groundHeightAt(spot.x,spot.z,this.halls));this.pendingRestSpot=null;}
  }
  if(action==="meditate"){
   const cushions=MEDITATION_CUSHIONS;
   const p=this.local.root.position;
   const nearest=cushions.map(([x,z])=>({x,z,d:Math.hypot(p.x-x,p.z-z)})).sort((a,b)=>a.d-b.d)[0];
   if(nearest&&nearest.d<2.35)this.local.setPosition(nearest.x,nearest.z,Math.PI,.54);
  }
  this.local.setPose(action,(action==="tea"||action==="toilet"||action==="eat")?6500:2600);
 }
 getPosition(){const p=this.local?.root.position;return p?{x:p.x,z:p.z,rotation:this.local.root.rotation.y}:{x:0,z:25,rotation:0};}
 currentLocation(){
  const p=this.local?.root.position||{x:0,z:25};
  const pts=[{x:0,z:-10.5,index:0,key:"gate"},{x:0,z:-37,index:2,key:"main"},{x:19,z:-32.5,index:8,key:"pond"}];
  return pts.reduce((b,a)=>Math.hypot(p.x-a.x,p.z-a.z)<Math.hypot(p.x-b.x,p.z-b.z)?a:b,pts[0]);
 }
 canAct(a){
  const p=this.local?.root.position;if(!p)return false;
  if(a==="incense")return Math.hypot(p.x-this.incensePosition.x,p.z-this.incensePosition.z)<4.4||Math.hypot(p.x+22.5,p.z+32)<4.6||this.isInsideHall(p);
  if(a==="bell")return Math.hypot(p.x-8,p.z+41)<5.5;
  if(a==="chant")return Math.hypot(p.x,p.z+38.5)<12;
  if(a==="lotus")return Math.hypot(p.x-this.pondPosition.x,p.z-this.pondPosition.z)<=6.2;
  if(a==="tea")return Math.hypot(p.x-this.teaHouse.position.x,p.z-this.teaHouse.position.z)<7;
  if(a==="toilet")return Math.hypot(p.x-10.6,p.z+64.5)<2.8;
   if(a==="eat")return p.x>=17.6&&p.x<=24.2&&p.z>=20.7&&p.z<=29.3;
  if(a==="sweep")return Math.hypot(p.x,p.z)<38;
  if(a==="rest")return [...(this.zenRestSpots||[]),...(this.benchRestSpots||[])].some(s=>Math.hypot(p.x-s.x,p.z-s.z)<2.15);
  if(a==="meditate"){
   const cushions=MEDITATION_CUSHIONS;
   return cushions.some(([x,z])=>Math.hypot(p.x-x,p.z-z)<2.35);
  }
  return true;
 }
 stopWander(){
  if(!this.wanderActive)return false;
  this.wanderActive=false;this.wanderNextAt=0;this.wanderBlockedAt=0;this.wanderLastGoal=null;
  this.moveTarget=null;this.moveWaypoints=[];this.pendingAction=null;this.moveVelocity?.set(0,0);
  if(this.local){this.local.pose="walk";this.local.until=0;}
  return true;
 }
 toggleWander(){
  if(this.wanderActive){this.stopWander();return false;}
  if(!this.local)return false;
  this.wanderActive=true;this.local.pose="walk";this.local.until=0;
  this.moveTarget=null;this.moveWaypoints=[];this.pendingAction=null;this.moveVelocity.set(0,0);
  this.wanderNextAt=performance.now()+180;
  this.planWander(this.wanderNextAt);
  return true;
 }
 planWander(time=performance.now()){
  if(!this.wanderActive||!this.local)return false;
  const start=this.local.root.position,collision=this.actorCollisionWorld(this.local);
  const candidates=this.wanderStops.slice().sort(()=>Math.random()-.5);
  let best=null,bestScore=Infinity,checked=0;
  for(const [x,z] of candidates){
   if(Math.hypot(x-start.x,z-start.z)<7)continue;
   if(this.wanderLastGoal&&Math.hypot(x-this.wanderLastGoal.x,z-this.wanderLastGoal.z)<5)continue;
   const crowd=[...this.remotes.values(),...(this.npcs||[]).map(n=>n.avatar)].filter(a=>Math.hypot(a.root.position.x-x,a.root.position.z-z)<3.2).length;
   if(crowd>1)continue;
   const route=findWalkPath(start,{x,z},collision);
   checked++;
   if(!route?.length)continue;
   let distance=0,px=start.x,pz=start.z;
   for(const point of route){distance+=Math.hypot(point.x-px,point.z-pz);px=point.x;pz=point.z;}
   const score=distance+crowd*8+Math.random()*.8;
   if(score<bestScore){best={x,z,route};bestScore=score;}
   if(checked>=7)break;
  }
  if(!best){this.moveTarget=null;this.moveWaypoints=[];this.wanderNextAt=time+1800;return false;}
  const targets=best.route.map(p=>new THREE.Vector3(p.x,0,p.z));
  this.moveTarget=targets.shift()||new THREE.Vector3(best.x,0,best.z);
  this.moveWaypoints=targets;this.pendingAction=null;this.wanderLastGoal={x:best.x,z:best.z};
  this.wanderBlockedAt=0;this.wanderNextAt=0;this.moveVelocity.multiplyScalar(.2);
  return true;
 }
 navigateToAction(action){
  if(!this.local)return false;
  const destinations={incense:[.8,-22.4],bell:[8,-38],lotus:[19,-26.7],tea:[2,-55.8],toilet:[10.6,-64.0],meditate:[0,-32.05],chant:[0,-32.05],kneel:[0,-26]};
  if(action==="rest"){
   const p=this.local.root.position,actors=[...this.remotes.values(),...(this.npcs||[]).map(n=>n.avatar)].map(a=>a.root.position);
   const nearbyBenches=this.benchRestSpots.filter(s=>Math.hypot(p.x-s.x,p.z-s.z)<5.5);
   const pool=nearbyBenches.length?nearbyBenches:[...this.zenRestSpots,...this.benchRestSpots];
   const collision=this.actorCollisionWorld(this.local);let best=null,bestCost=Infinity;
   for(const spot of pool){
    if(actors.some(a=>Math.hypot(a.x-spot.x,a.z-spot.z)<1.35))continue;
    const route=findWalkPath(p,{x:spot.x,z:spot.z},collision);if(!route?.length)continue;
    let cost=0,px=p.x,pz=p.z;for(const point of route){cost+=Math.hypot(point.x-px,point.z-pz);px=point.x;pz=point.z;}
    if(spot.type==="bench"&&!nearbyBenches.length)cost+=18;
    if(cost<bestCost){best=spot;bestCost=cost;}
   }
   if(!best)return false;
   this.pendingRestSpot=best;this.pendingAction=action;
   const targets=findWalkPath(p,{x:best.x,z:best.z},collision).map(q=>new THREE.Vector3(q.x,0,q.z));
   this.moveTarget=targets.shift();this.moveWaypoints=targets;this.moveVelocity.set(0,0);return true;
  }
  if(action==="eat"){
   // The front doorway can be crowded. Try several reachable dining spots,
   // including positions served by either side entrance, while respecting
   // live visitor and NPC collision.
   const diningSpots=[[18.4,25],[19.1,22.1],[19.1,27.9],[21.2,22.1],[21.2,27.9],[22.5,25],[22.2,23.2],[22.2,26.8]];
   const collision=this.actorCollisionWorld(this.local);
   let best=null,bestCost=Infinity;
   for(const [x,z] of diningSpots){
    const route=findWalkPath(this.local.root.position,{x,z},collision);
    if(!route?.length)continue;
    let cost=0,px=this.local.root.position.x,pz=this.local.root.position.z;
    for(const point of route){cost+=Math.hypot(point.x-px,point.z-pz);px=point.x;pz=point.z;}
    if(cost<bestCost){best=route;bestCost=cost;}
   }
   if(!best)return false;
   this.pendingAction=action;
   const targets=best.map(p=>new THREE.Vector3(p.x,0,p.z));
   this.moveTarget=targets.shift();this.moveWaypoints=targets;this.moveVelocity.set(0,0);
   return true;
  }
  const destination=destinations[action];if(!destination)return false;
  const path=findWalkPath(this.local.root.position,{x:destination[0],z:destination[1]},this.actorCollisionWorld(this.local));
  if(!path?.length)return false;
  const targets=path.map(p=>new THREE.Vector3(p.x,0,p.z));
  this.pendingAction=action;
  this.moveTarget=targets.shift();
  this.moveWaypoints=targets;
  this.moveVelocity.set(0,0);
  return true;
 }
 setLanguage(lang){
  const abbotNames={zh:"住持",en:"Abbot",ja:"住職",ko:"주지 스님",th:"เจ้าอาวาส"};
  if(this.abbotAvatar){const name=abbotNames[lang]||abbotNames.zh;this.abbotAvatar.profile.name=name;this.abbotAvatar.setLabel(name);}
  if(this.shrineSign){const labels={zh:"神龛",en:"SHRINE",ja:"祠堂",ko:"신단",th:"ศาลบูชา"};const sign=this.shrineSign;sign.ctx.clearRect(0,0,sign.canvas.width,sign.canvas.height);sign.ctx.fillStyle="#3b2b20";sign.ctx.fillRect(0,0,sign.canvas.width,sign.canvas.height);sign.ctx.strokeStyle="#d8bd82";sign.ctx.lineWidth=8;sign.ctx.strokeRect(10,10,492,124);sign.ctx.textAlign="center";sign.ctx.textBaseline="middle";sign.ctx.font="bold "+(lang==="zh"||lang==="ja"||lang==="ko"?72:54)+"px serif";sign.ctx.fillStyle="#fff0cc";sign.ctx.fillText(labels[lang]||labels.zh,256,72,460);sign.map.needsUpdate=true;}
  for(const stall of this.marketStalls||[]){const sign=stall.userData.marketSign;if(!sign)continue;const label=marketLabel(sign.kind,lang);sign.ctx.clearRect(0,0,sign.canvas.width,sign.canvas.height);sign.ctx.fillStyle=sign.kind==="mcdonalds"?"#a82524":"#3b2b20";sign.ctx.fillRect(0,0,sign.canvas.width,sign.canvas.height);sign.ctx.strokeStyle="#d8bd82";sign.ctx.lineWidth=9;sign.ctx.strokeRect(12,12,744,152);sign.ctx.textAlign="center";sign.ctx.textBaseline="middle";sign.ctx.font=lang==="zh"||lang==="ja"||lang==="ko"?"bold 66px serif":"bold 52px sans-serif";sign.ctx.fillStyle=sign.kind==="mcdonalds"?"#ffdf75":"#fff0cc";sign.ctx.fillText(label,384,88,700);sign.map.needsUpdate=true;stall.userData.marketItemLabel=label;}
  if(this.teaSign){const labels={zh:"林间茶庄",en:"FOREST TEA HOUSE",ja:"林間茶屋",ko:"숲속 찻집",th:"โรงน้ำชากลางป่า"};const ctx=this.teaSign.ctx;ctx.clearRect(0,0,768,192);ctx.fillStyle="#3b2b20";ctx.fillRect(0,0,768,192);ctx.strokeStyle="#d8bd82";ctx.lineWidth=10;ctx.strokeRect(12,12,744,168);ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 72px serif";ctx.fillStyle="#fff0cc";ctx.fillText(labels[lang]||labels.zh,384,96,700);this.teaSign.map.needsUpdate=true;}
  if(this.parkingSign){
   const labels={zh:"森林停车场",en:"FOREST PARKING",ja:"森林駐車場",ko:"숲속 주차장",th:"ลานจอดรถในป่า"};
   const ctx=this.parkingSign.ctx;ctx.clearRect(0,0,768,192);ctx.fillStyle="#35453d";ctx.fillRect(0,0,768,192);ctx.strokeStyle="#d8bd82";ctx.lineWidth=10;ctx.strokeRect(12,12,744,168);ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=lang==="zh"||lang==="ja"||lang==="ko"?"bold 78px serif":"bold 64px sans-serif";ctx.fillStyle="#fff0cc";ctx.fillText(labels[lang]||labels.zh,384,96,700);this.parkingSign.map.needsUpdate=true;
  }
 }
 update(dt,input={},time=performance.now(),render=true){
  if(!this.local)return;
  this.updateDayNight(time);
  const f=(input.forward||0)-(input.backward||0)+(input.joyY||0);
  const side=(input.right||0)-(input.left||0)+(input.joyX||0);
  const hasInput=Math.hypot(f,side)>.05;
  if(hasInput){this.stopWander();this.moveTarget=null;this.moveWaypoints=[];this.pendingAction=null;}
  if(this.wanderActive&&!hasInput&&!this.moveTarget&&time>=this.wanderNextAt)this.planWander(time);
  if(this.local.until&&time>this.local.until){this.local.pose="walk";this.local.until=0;}
  const canMove=["walk","greet","bow","chant"].includes(this.local.pose);
  let direction=null;
  if(hasInput&&canMove){
   const fw=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
   const rt=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
   direction=fw.multiplyScalar(f).add(rt.multiplyScalar(side)).normalize();
  }else if(this.moveTarget&&canMove){
   const dx=this.moveTarget.x-this.local.root.position.x,dz=this.moveTarget.z-this.local.root.position.z;
   if(Math.hypot(dx,dz)<.08){
    const next=this.moveWaypoints?.shift();
    if(next){this.moveTarget.copy(next);this.moveVelocity.multiplyScalar(.12);}
    else{
     this.moveTarget=null;
     if(this.pendingAction){const action=this.pendingAction;this.pendingAction=null;window.dispatchEvent(new CustomEvent("temple:arrived-action",{detail:{action}}));}
     else if(this.wanderActive)this.wanderNextAt=time+1900+Math.random()*2600;
    }
   }else direction=new THREE.Vector3(dx,0,dz).normalize();
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
   result=moveWithCollision(localPosition,this.moveVelocity.x*dt,this.moveVelocity.y*dt,this.actorCollisionWorld(this.local));
   if(result.blocked){
    this.moveVelocity.multiplyScalar(.28);
    if(this.wanderActive&&this.moveTarget&&!result.moved){
     this.wanderBlockedAt=this.wanderBlockedAt||time;
     if(time-this.wanderBlockedAt>850){this.moveTarget=null;this.moveWaypoints=[];this.wanderNextAt=time+120;this.wanderBlockedAt=0;}
    }else if(!this.wanderActive&&this.moveTarget){this.moveTarget=null;this.moveWaypoints=[];this.pendingAction=null;}
   }else if(this.wanderActive)this.wanderBlockedAt=0;
   if(direction)this.local.root.rotation.y=Math.atan2(direction.x,direction.z);
  }
  const localPosition=this.local.root.position;
  const groundY=groundHeightAt(result.x,result.z,this.halls);
  const wantsJump=!!input.jump;
  if(wantsJump&&!this.jumpHeld&&this.jumpOffset<=.001)this.jumpVelocity=4.35;
  this.jumpHeld=wantsJump;
  if(this.jumpOffset>0||this.jumpVelocity>0){
   this.jumpVelocity-=12.8*dt;this.jumpOffset+=this.jumpVelocity*dt;
   if(this.jumpOffset<=0){this.jumpOffset=0;this.jumpVelocity=0;}
  }
  localPosition.set(result.x,groundY+this.jumpOffset,result.z);
  this.lastMovement={forward:f,side,dt,moving,pose:this.local.pose,blocked:result.blocked,jumping:this.jumpOffset>0,position:{x:localPosition.x,y:localPosition.y,z:localPosition.z}};
  this.local.update(dt,time,moving&&this.local.pose==="walk");
  // Keep the closest visitors fully rendered; everyone remains online and collidable.
  const localPos=this.local.root.position;
  const visibleVisitors=new Set([...this.remotes.values()]
   .map(a=>({a,d:(a.root.position.x-localPos.x)**2+(a.root.position.z-localPos.z)**2}))
   .sort((a,b)=>a.d-b.d).slice(0,this.smoothMode?(this.mobile?5:10):(this.mobile?12:28)).map(item=>item.a.id));
  // Remote players are also resolved against the same masonry and stair geometry.
  for(const a of this.remotes.values()){
   a.root.visible=visibleVisitors.has(a.id);
   const p=a.root.position,dx=a.target.x-p.x,dz=a.target.z-p.z,len=Math.hypot(dx,dz);
   let remoteMoving=false;
   if(len>.025){
    const step=Math.min(len,5.2*dt),r=moveWithCollision(p,dx/len*step,dz/len*step,this.actorCollisionWorld(a));
    p.set(r.x,r.y,r.z);remoteMoving=r.moved;
   }else p.y=groundHeightAt(p.x,p.z,this.halls);
   const currentYaw=a.root.rotation.y;
   let turn=((a.targetRotation-currentYaw+Math.PI*3)%(Math.PI*2))-Math.PI;
   a.root.rotation.y=currentYaw+turn*(1-Math.exp(-dt*10));
   if(a.root.visible)a.update(dt,time,remoteMoving&&a.pose==="walk");
  }
  if(!this.smoothMode){this.lowNpcElapsed=0;this.updateNpcs(dt,time);}else{this.lowNpcElapsed+=dt;if(this.lowNpcElapsed>=.1){this.updateNpcs(this.lowNpcElapsed,time);this.lowNpcElapsed=0;}}
  const cameraTargetPosition=this.local.root.position,inside=this.isInsideHall(cameraTargetPosition);
  this.indoor=inside;
  const cameraDistance=inside?clamp(this.distance*.36,2.6,3.8):this.distance;
  const cameraHeight=inside?1.72+Math.sin(this.pitch)*cameraDistance*.42:3.15+Math.sin(this.pitch)*this.distance*.75;
  const target=new THREE.Vector3(cameraTargetPosition.x+Math.sin(this.yaw)*cameraDistance,cameraTargetPosition.y+cameraHeight,cameraTargetPosition.z+Math.cos(this.yaw)*cameraDistance);
  this.camera.position.lerp(target,1-Math.pow(inside?.00025:.0007,dt));this.camera.lookAt(cameraTargetPosition.x,cameraTargetPosition.y+(inside?1.42:1.2),cameraTargetPosition.z);
  if(!this.smoothMode||time-this.lastLowDetailAnimation>=100){
   this.lastLowDetailAnimation=time;
   for(const item of this.lotusPads)item.pad.position.y=.31+Math.sin(time*.001+item.phase)*.025;
  if(!this.smoothMode)for(const puff of this.incenseSmoke){
   const data=puff.userData.smoke,cycle=(time*.000085+data.phase)%1;
   puff.position.set(data.origin[0]+Math.sin(cycle*6.28+data.seed)*(.08+cycle*.34),data.origin[1]+cycle*2.25,data.origin[2]+Math.cos(cycle*5.2+data.seed)*(.07+cycle*.25));
   const scale=.72+cycle*1.85;puff.scale.set(scale,scale*1.12,scale);
   puff.material.opacity=.19*(1-cycle)*(.82+.18*Math.sin(time*.002+data.seed));
  }
  for(const item of this.templeLanterns){
   const flicker=.88+Math.sin(time*.017+item.phase)*.07+Math.sin(time*.031+item.phase*1.7)*.035;
   item.flame.scale.y=1.45*flicker;item.flame.scale.x=item.flame.scale.z=.72*(1+(1-flicker)*.6);
   item.glow.intensity=(.34+.12*flicker)*(1+(this.dayNightState?.night||0)*1.45);
  }
  if(!this.smoothMode)for(const d of this.ambient.children){d.position.y=d.userData.y+Math.sin(time*.0006+d.userData.phase)*.35;d.position.x+=Math.sin(time*.00017+d.userData.phase)*.0007;}
  }
  this.refreshLowDetailLights(false,time);
  this.updateEffects(dt);if(render)this.renderer.render(this.scene,this.camera);
 }
 updateDayNight(time){
  if(time-this.lastDayNightUpdate<(this.smoothMode?5000:1000))return;
  this.lastDayNightUpdate=time;
  // One shared epoch clock keeps all visitors in the same gradual day/dusk/night cycle.
  const phase=(Date.now()/1000%600)/600;
  const solar=Math.sin((phase-.25)*Math.PI*2);
  const daylight=clamp((solar+.14)/.62,0,1),twilight=clamp(1-Math.abs(solar)/.48,0,1),night=1-daylight;
  this.isNight=night>.55;
  const color=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),t);
  const top=color("#101a2d","#628b9e",daylight).lerp(new THREE.Color("#596577"),twilight);
  const middle=color("#26384d","#a9c9c8",daylight).lerp(new THREE.Color("#bd897d"),twilight);
  const horizon=color("#35445a","#e5dbc0",daylight).lerp(new THREE.Color("#e5a078"),twilight);
  const gradient=this.skyCtx.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,top.getStyle());gradient.addColorStop(.48,middle.getStyle());
  gradient.addColorStop(.82,horizon.getStyle());gradient.addColorStop(1,middle.clone().lerp(horizon,.55).getStyle());
  this.skyCtx.clearRect(0,0,8,512);this.skyCtx.fillStyle=gradient;this.skyCtx.fillRect(0,0,8,512);this.skyMap.needsUpdate=true;
  this.scene.background.copy(top);this.scene.fog.color.copy(middle);this.scene.fog.density=.0062+night*.0022;
  this.hemiLight.intensity=.48+daylight*1.5+twilight*.22;
  this.sunLight.intensity=.08+daylight*2.62+twilight*.38;
  this.sunLight.color.copy(new THREE.Color("#ff996e").lerp(new THREE.Color("#ffe4bd"),daylight));
  const angle=phase*Math.PI*2;
  this.sunLight.position.set(Math.cos(angle)*72,16+Math.max(0,solar)*52,Math.sin(angle)*72);
  this.moonLight.intensity=.04+night*.52;this.moonLight.position.copy(this.sunLight.position).multiplyScalar(-1);
  this.fillLight.intensity=.12+daylight*.55+night*.08;
  this.moonMesh.material.opacity=night*.92;this.starMaterial.opacity=night*.86;
  this.moonMesh.position.set(Math.cos(angle+Math.PI)*110,Math.max(12,Math.sin(angle+Math.PI)*75),Math.sin(angle+Math.PI)*110);
  this.renderer.toneMappingExposure=.82+daylight*.39+twilight*.1;
  for(const entry of this.nightLights)entry.light.intensity=entry.base*(.14+night*3.6);
  this.dayNightState={phase,daylight,twilight,night,periodSeconds:600};
 }
 addEffect(type,position=null){
  // Lotus offerings intentionally create no 3D object or network effect.
  if(type==="lotus")return;
  const p=position?new THREE.Vector3(position.x,0,position.z):(this.local?.root.position?.clone()||new THREE.Vector3()),g=new THREE.Group();g.position.copy(p);
  if(type==="bell")g.position.set(8,0,-41);
  if(type==="incense"){
   // Show the incense smoke at the offering point actually used, not always at the courtyard censer.
   if(Math.hypot(p.x-this.incensePosition.x,p.z-this.incensePosition.z)<4.4)g.position.copy(this.incensePosition);
   else if(Math.hypot(p.x+22.5,p.z+32)<4.6)g.position.set(-22.5,0,-32);
   else if(this.isInsideHall(p))g.position.set(0,0,-38.5);
  }
  this.scene.add(g);
  if(type==="incense"){for(let i=0;i<12;i++){const puff=add(new THREE.SphereGeometry(.11+Math.random()*.1,7,6),new THREE.MeshBasicMaterial({color:0xe7e1d1,transparent:true,opacity:.32}),g,[Math.random()*.4-.2,1.5+Math.random()*.2,Math.random()*.4-.2],[0,0,0],false);puff.userData.life=3;puff.userData.vy=.6;}}
  else {for(let i=0;i<12;i++){const d=add(new THREE.SphereGeometry(.045,6,6),new THREE.MeshBasicMaterial({color:0xf2d59a,transparent:true,opacity:.7}),g,[(Math.random()-.5)*1.5,1.7+Math.random()*1.4,(Math.random()-.5)*.7],[0,0,0],false);d.userData.life=1.5;d.userData.vy=.35;}}
  this.effects.push({group:g,life:type==="sweep"?1.3:3});
 }
 updateEffects(dt){for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;for(const c of e.group.children)if(c.userData.life){c.userData.life-=dt;c.position.y+=dt*(c.userData.vy||.1);if(c.material?.opacity!==undefined)c.material.opacity=Math.max(0,c.userData.life/3)*.35;}if(e.life<=0){this.scene.remove(e.group);e.group.traverse(o=>{o.geometry?.dispose();if(o.material&&!Array.isArray(o.material))o.material.dispose();});this.effects.splice(i,1);}}}
 dispose(){removeEventListener("resize",this.resizeFn);this.local?.dispose();for(const a of this.remotes.values())a.dispose();this.renderer.dispose();if(this.renderer.domElement.parentElement===this.container)this.container.removeChild(this.renderer.domElement);}
}