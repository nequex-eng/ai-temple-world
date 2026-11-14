import { TempleWorld } from "./world.js";
import { TempleNetwork } from "./network.js";
import { getText } from "./i18n.js";

const $=id=>document.getElementById(id);
const LOCAL_PROFILE="temple-world-profile-v2";
let language=localStorage.getItem("temple-language")||"zh";
if(!["zh","ja","ko","th"].includes(language))language="zh";
let profile=null,onlinePlayers=new Map(),actionUntil=0,lastPositionSend=0,lastActivity=0,joy={x:0,y:0},keys={},audio=null,audioMaster=null,ambienceGain=null,effectsGain=null,mobileRunning=false,stickPointer=null,soundEnabled=false,ambientNodes=null,templeBirds=null,templeChant=null,templeBell=null,lastFootstep=0,audioFailureShown=false,birdRetryAt=0,audioFailureReason="";
let audioVolumes={ambience:.8,chant:.65,effects:.8};
try{const saved=JSON.parse(localStorage.getItem("temple-audio-volumes")||"null");if(saved)for(const key of Object.keys(audioVolumes))audioVolumes[key]=Math.max(0,Math.min(1,Number(saved[key]??audioVolumes[key])));}catch{}
const world=new TempleWorld($("world"));
Object.defineProperty(window,"__templeDebug",{value:Object.freeze({position:()=>({...world.getPosition(),y:world.local?.root.position.y??0}),setPosition:(x,z)=>world.setDebugPosition(x,z),setYaw:yaw=>world.setDebugYaw(yaw),step:(input,dt=.05)=>world.update(dt,input,performance.now()),input:()=>({keys:{...keys},joy:{...joy},run:mobileRunning,pose:world.local?.pose,position:world.getPosition(),movement:world.lastMovement})}),configurable:false});
Object.defineProperty(window,"__templeAudioDebug",{value:Object.freeze({state:()=>audio?.state||"uninitialized",enabled:()=>soundEnabled,media:()=>({birds:{paused:templeBirds?.paused??true,time:templeBirds?.currentTime??0,ready:templeBirds?.readyState??0,error:templeBirds?.error?.code||0},chant:{paused:templeChant?.paused??true,time:templeChant?.currentTime??0,ready:templeChant?.readyState??0,error:templeChant?.error?.code||0},bell:{paused:templeBell?.paused??true,time:templeBell?.currentTime??0,ready:templeBell?.readyState??0,error:templeBell?.error?.code||0}})}),configurable:false});
const network=new TempleNetwork({
 onStatus:status=>setConnection(status),
 onMessage:message=>handleMessage(message),
 onError:error=>console.warn("Temple API:",error)
});

function t(){return getText(language);}
function text(id,value){const el=$(id);if(el)el.textContent=value;}
function setConnection(status){
 const d=t();
 text("connection-label",status==="online"?d.statusOnline:status==="offline"?d.statusOffline:d.statusConnecting);
 $("connection-label").style.opacity=status==="online"?"1":".7";
 $("online-count").style.opacity=status==="online"?"1":".6";
}
function toast(message){
 const el=$("toast");el.textContent=message;el.classList.add("show");
 clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2600);
}
function applyLanguage(){
 const d=t();
 document.documentElement.lang=({zh:"zh-CN",ja:"ja",ko:"ko",th:"th"})[language];
 const labels={
  "connection-label":d.statusConnecting,"profile-button-label":d.profile,"sound-toggle":"♫ "+(soundEnabled?d.soundOn:d.soundOff),"profile-sound-toggle":"♫ "+(soundEnabled?d.soundOn:d.soundOff),"location-eyebrow":d.locationEyebrow,
  "location-hint":d.locationHint,"presence-title":d.presence,"presence-sub":d.presenceSub,
  "today-visitors":$("today-visitors").textContent,"today-activities":$("today-activities").textContent,
  "wish-total":$("wish-total").textContent,"visitors-label":d.todayVisitors,"activities-label":d.todayActivities,
  "wishes-label":d.wishes,"character-state":d.walk,"chat-title":d.chatTitle,"chat-caption":d.chatCaption,
  "chat-welcome":d.chatWelcome,"chat-foot":d.chatFoot,"mobile-caption":d.mobile,"run-toggle":d.run,"desktop-hint":d.desktop,
  "profile-title":d.profileTitle,"profile-description":d.profileDesc,"label-name":d.name,"label-style":d.style,"delete-data":d.deleteData,
  "label-robe":d.robe,"label-skin":d.skin,"save-profile":d.save,"profile-foot":d.profileFoot,
  "prayer-title":d.prayerTitle,"prayer-description":d.prayerDesc,"prayer-submit":d.prayerSubmit,
  "prayer-list-label":d.prayerList,"prayer-empty":d.prayerEmpty,"prayer-foot":d.prayerFoot,"beads-title":d.beadsTitle,"beads-description":d.beadsDesc,"beads-advance":d.beadsPush,"beads-reset":d.beadsReset,"beads-foot":d.beadsFoot,"sound-title":d.soundTitle,"sound-description":d.soundDescription,"sound-ambience-label":d.soundAmbience,"sound-chant-label":d.soundChant,"sound-effects-label":d.soundEffects,"sound-test":d.soundTest,"sound-foot":d.soundFoot
 };
 for(const [id,value] of Object.entries(labels))text(id,value);
 $("chat-input").placeholder=d.chatPlaceholder;$("prayer-input").placeholder=d.prayerPlaceholder;
 $("open-prayers").title=d.prayers;$("open-prayers").setAttribute("aria-label",d.prayers);
 $("monk-style").options[0].text=d.monk;$("monk-style").options[1].text=d.pilgrim;
 for(const [key,value] of Object.entries(d.actions))text("action-"+key,value);
 updateLocation(true);renderPresence();if(profile)text("character-state",d.walk);
}
function updateLocation(force=false){
 const zone=world.currentLocation(),d=t();
 if(force||zone.index!==world.lastZone){
  world.lastZone=zone.index;text("location-title",d.zones[zone.index][0]);
  text("location-description",d.zones[zone.index][1]);
 }
}
function renderPresence(){
 const d=t(),list=$("presence-list"),count=onlinePlayers.size+1;
 text("online-count",count+" "+d.visitors);text("presence-count",String(count).padStart(2,"0"));
 list.replaceChildren();
 const all=[{id:network.playerId,name:profile?.name||d.unknown,language,local:true},...Array.from(onlinePlayers.values()).map(p=>({id:p.id,name:p.name||d.unknown,language:p.language||"zh"}))];
 if(!onlinePlayers.size){const empty=document.createElement("div");empty.className="presence-placeholder";empty.textContent=d.waiting;list.append(empty);}
 for(const player of all.slice(0,10)){
  const row=document.createElement("div");row.className="presence-person";
  const seal=document.createElement("span");seal.className="presence-avatar";seal.textContent=(player.name||d.unknown).slice(0,1);
  const name=document.createElement("span");name.textContent=player.name+(player.local?" · "+d.you:"");
  const lang=document.createElement("small");lang.textContent=({zh:"中文",ja:"日本語",ko:"한국어",th:"ไทย"})[player.language]||"";
  row.append(seal,name,lang);list.append(row);
 }
}
function appendChat(player,message,languageCode){
 const box=$("chat-messages"),welcome=$("chat-welcome");if(welcome)welcome.remove();
 const line=document.createElement("div");line.className="chat-line";
 const name=document.createElement("strong");name.textContent=(player?.name||t().unknown)+(player?.id===network.playerId?" · "+t().you:"");
 const content=document.createElement("span");content.textContent=String(message||"").slice(0,220);
 const lang=document.createElement("small");lang.textContent=t().chatOriginal;
 line.append(name,content,lang);box.append(line);
 while(box.children.length>45)box.firstElementChild.remove();
 box.scrollTop=box.scrollHeight;
}
function handleMessage(message){
 if(!message||!message.type)return;
 if(message.type==="welcome"){
  onlinePlayers.clear();
  for(const id of [...world.remotes.keys()])world.removeRemote(id);
  for(const p of message.players||[]){world.addRemote(p);onlinePlayers.set(p.id,p);}
  for(const offering of message.offerings||[])world.addEffect("lotus");
  renderPresence();return;
 }
 if(message.type==="player:join"){
  if(message.player?.id!==network.playerId){world.addRemote(message.player);onlinePlayers.set(message.player.id,message.player);renderPresence();}
  if(message.player?.id!==network.playerId)toast(message.player.name+" · "+t().connected);
  return;
 }
 if(message.type==="player:move"||message.type==="player:action"){
  if(message.player?.id!==network.playerId){
   world.updateRemote(message.player);
   if(message.type==="player:action"){
    world.addEffect(message.player.action,{x:message.player.x,z:message.player.z});
    if(message.player.action==="bell")playBell();if(message.player.action==="chant")playMuyu();
   }
   onlinePlayers.set(message.player.id,message.player);renderPresence();
  }
  return;
 }
 if(message.type==="player:leave"){
  world.removeRemote(message.id);onlinePlayers.delete(message.id);renderPresence();return;
 }
 if(message.type==="chat"){
  appendChat(message.player,message.message,message.player?.language);return;
 }
}
async function updateStats(){
 try{
  const stats=await network.getStats();
  text("today-visitors",String(stats.todayVisitors??"—"));
  text("today-activities",String(stats.todayActivities??"—"));
  text("wish-total",String(stats.wishes??"—"));
 }catch{}
}
async function loadProfile(){
 let local=null;try{local=JSON.parse(localStorage.getItem(LOCAL_PROFILE)||"null");}catch{localStorage.removeItem(LOCAL_PROFILE);}
 const remote=await network.loadProfile();
 profile=remote?{name:remote.name,robe:remote.robe,skin:remote.skin,style:remote.style}:local;
 if(profile){
  $("monk-name").value=profile.name||"行者";$("monk-robe").value=profile.robe||"#b49a72";
  $("monk-skin").value=profile.skin||"#d7ad87";$("monk-style").value=profile.style||"monk";
  setProfileUI();world.setLocalProfile(profile,network.playerId);network.connect({...profile,language},world.getPosition());
 }else{
  profile={name:"行者",robe:"#b49a72",skin:"#d7ad87",style:"monk"};
  $("monk-name").value="行者";$("monk-robe").value=profile.robe;$("monk-skin").value=profile.skin;
  $("profile-modal").classList.remove("hidden");
  updatePreview();
  world.setLocalProfile(profile,network.playerId);
 }
}
function setProfileUI(){
 text("character-name",profile.name);text("monk-name",profile.name);text("preview-name",profile.name);
 $("preview-body").style.background=profile.robe;
 $("character-name").style.color=profile.robe;
}
async function saveProfile(){
 profile={
  name:$("monk-name").value.trim().slice(0,18)||"行者",
  robe:$("monk-robe").value,skin:$("monk-skin").value,style:$("monk-style").value
 };
 localStorage.setItem(LOCAL_PROFILE,JSON.stringify(profile));
 localStorage.setItem("temple-language",language);
 world.setLocalProfile(profile,network.playerId);setProfileUI();
 let saved=false;
 try{await network.saveProfile(profile,language);saved=true;toast(t().saved);}
 catch{toast(t().saveFailed);}
 network.close();network.connect({...profile,language},world.getPosition());
 $("profile-modal").classList.add("hidden");renderPresence();
}
function updatePreview(){
 const name=$("monk-name").value.trim()||"行者";text("preview-name",name);
 $("preview-body").style.background=$("monk-robe").value;
 $("preview-head").style.background=$("monk-skin").value;
}
function createTempleMedia(mp3Url,oggUrl,{loop=false,volume=.2,label="环境音"}={}) {
 const media=new Audio();
 let fallbackUsed=false;
 media.preload="auto";media.loop=loop;media.volume=volume;
 media.addEventListener("error",()=>{
  if(!fallbackUsed&&oggUrl){
   fallbackUsed=true;media.src=oggUrl;media.load();
   if(soundEnabled)media.play().catch(()=>{});
   return;
  }
  if(soundEnabled&&!audioFailureShown){
   audioFailureShown=true;
   toast(label+"加载失败，已保留浏览器备用环境声。");
  }
 });
 media.src=mp3Url;media.load();
 return media;
}
async function ensureAudio(){
 try{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)throw new Error("AudioContext unavailable");
  if(!audio){
   audio=new AudioContextClass({latencyHint:"playback"});
   audioMaster=audio.createGain();audioMaster.gain.value=.88;audioMaster.connect(audio.destination);ambienceGain=audio.createGain();ambienceGain.gain.value=audioVolumes.ambience;ambienceGain.connect(audioMaster);effectsGain=audio.createGain();effectsGain.gain.value=audioVolumes.effects;effectsGain.connect(audioMaster);
  }
  if(!ambientNodes){
   const buffer=audio.createBuffer(1,audio.sampleRate*4,audio.sampleRate),data=buffer.getChannelData(0);
   for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.16;
   const noise=audio.createBufferSource();noise.buffer=buffer;noise.loop=true;
   const low=audio.createBiquadFilter();low.type="lowpass";low.frequency.value=520;low.Q.value=.35;
   const wind=audio.createGain();wind.gain.value=.075;noise.connect(low);low.connect(wind);wind.connect(ambienceGain||audioMaster);noise.start();
   const lfo=audio.createOscillator(),lfoGain=audio.createGain();lfo.frequency.value=.065;lfoGain.gain.value=.018;lfo.connect(lfoGain);lfoGain.connect(wind.gain);lfo.start();
   ambientNodes={noise,low,wind,lfo,lfoGain};
  }
  if(!templeBirds)templeBirds=createTempleMedia(
   "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2f/Birds_chirping_in_a_garden.ogg/Birds_chirping_in_a_garden.ogg.mp3",
   "https://upload.wikimedia.org/wikipedia/commons/2/2f/Birds_chirping_in_a_garden.ogg",
   {loop:true,volume:.27*audioVolumes.ambience,label:"庭院鸟鸣"}
  );
  if(!templeChant)templeChant=createTempleMedia(
   "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e8/20260602_145912_Dingjue_Om_mani_padme_hum.ogg/20260602_145912_Dingjue_Om_mani_padme_hum.ogg.mp3",
   "https://upload.wikimedia.org/wikipedia/commons/e/e8/20260602_145912_Dingjue_Om_mani_padme_hum.ogg",
   {loop:true,volume:0,label:"殿内诵经"}
  );
  if(!templeBell)templeBell=createTempleMedia(
   "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2c/Gong55.ogg/Gong55.ogg.mp3",
   "https://upload.wikimedia.org/wikipedia/commons/2/2c/Gong55.ogg",
   {loop:false,volume:.38*audioVolumes.effects,label:"寺院钟声"}
  );
  // Start media playback and resume Web Audio synchronously from the visitor's
  // click gesture; this is essential on iOS Safari and autoplay-restricted browsers.
  templeBirds.play().catch(()=>false);
  templeBell.currentTime=0;templeBell.volume=.35;templeBell.play().catch(()=>false);
  const resumePromise=audio.state==="running"?Promise.resolve():audio.resume();
  await resumePromise;
  if(audio.state!=="running")throw new Error("AudioContext did not enter running state");
  soundEnabled=true;
  audioMaster.gain.setTargetAtTime(.88,audio.currentTime,.08);
  for(const id of ["sound-toggle","profile-sound-toggle"]){const button=$(id);if(button){button.classList.add("active");button.textContent="♫ "+t().soundOn;button.setAttribute("aria-pressed","true");}}
  // Retry once if an MP3 transcode failed and the original Ogg fallback has loaded.
  if(templeBirds.paused)templeBirds.play().catch(()=>{});
  if(templeBell.paused)templeBell.play().catch(()=>{});
  updateSoundscape();
  return true;
 }catch(error){
  console.warn("Temple audio could not be started:",error);
  return false;
 }
}
function updateSoundscape(){
 if(!soundEnabled)return;
 if(templeBirds){
  templeBirds.volume=.27*audioVolumes.ambience;
  if(templeBirds.paused&&performance.now()>birdRetryAt){
   birdRetryAt=performance.now()+5000;
   templeBirds.play().catch(()=>{});
  }
 }
 if(!templeChant||!world.local)return;
 const p=world.getPosition(),hallDistance=Math.hypot(p.x,p.z+37),bellDistance=Math.hypot(p.x+28,p.z-2);
 const chantVolume=Math.max(0,1-hallDistance/24)*.23*audioVolumes.chant;
 templeChant.volume=chantVolume;
 if(chantVolume>.006){if(templeChant.paused)templeChant.play().catch(()=>{});}
 else if(!templeChant.paused)templeChant.pause();
 if(bellDistance<34&&performance.now()>(updateSoundscape.nextBell||0)){
  const distantBell=templeBell?.cloneNode(true);
  if(distantBell){distantBell.volume=Math.max(.025,Math.min(.13,(1-bellDistance/38)*.13*audioVolumes.effects));distantBell.play().catch(()=>{});}
  updateSoundscape.nextBell=performance.now()+42000+Math.random()*28000;
 }
}
function playFootstep(){
 if(!soundEnabled||!audio||audio.state!=="running")return;
 const now=audio.currentTime,noise=audio.createBufferSource(),length=Math.floor(audio.sampleRate*.12),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,2);
 noise.buffer=buffer;const filter=audio.createBiquadFilter();filter.type="lowpass";filter.frequency.value=520;
 const gain=audio.createGain();gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.12);
 noise.connect(filter);filter.connect(gain);gain.connect(effectsGain||audioMaster||audio.destination);noise.start(now);noise.stop(now+.13);
}
function playMuyu(){
 if(!soundEnabled||!audio||audio.state!=="running")return;
 const now=audio.currentTime;
 for(const [hz,vol,decay] of [[205,.11,.085],[318,.035,.055],[92,.045,.11]]){
  const osc=audio.createOscillator(),gain=audio.createGain();osc.type="triangle";osc.frequency.setValueAtTime(hz,now);
  gain.gain.setValueAtTime(vol,now);gain.gain.exponentialRampToValueAtTime(.0001,now+decay);
  osc.connect(gain);gain.connect(effectsGain||audioMaster||audio.destination);osc.start(now);osc.stop(now+decay+.01);
 }
}
async function setSound(on){
 const button=$("sound-toggle");
 if(on){
  if(button){button.disabled=true;button.textContent="♫ 正在开启…";}
  const ok=await ensureAudio();
  if(button)button.disabled=false;
  if(!ok){
   soundEnabled=false;
   for(const id of ["sound-toggle","profile-sound-toggle"]){const target=$(id);if(target){target.classList.remove("active");target.textContent="♫ "+t().soundOff;target.setAttribute("aria-pressed","false");}}
   toast("声音启动失败："+(audioFailureReason||"请检查设备音量与浏览器权限"));
   return;
  }
  if(templeBirds?.paused)templeBirds.play().catch(()=>{});
  if(button)button.setAttribute("aria-pressed","true");
  toast("寺院环境声已开启");
  return;
 }
 soundEnabled=false;
 if(audio?.state==="running"&&audioMaster)audioMaster.gain.setTargetAtTime(.0001,audio.currentTime,.12);
 for(const media of [templeBirds,templeChant,templeBell]){
  if(media){media.pause();try{media.currentTime=0;}catch{}}
 }
 for(const id of ["sound-toggle","profile-sound-toggle"]){const target=$(id);if(target){target.classList.remove("active");target.textContent="♫ "+t().soundOff;target.setAttribute("aria-pressed","false");}}
}
function playBell(force=false,volume=.62){
 if(!soundEnabled&&!force)return;
 try{
  if(templeBell){templeBell.pause();templeBell.currentTime=0;templeBell.volume=volume*audioVolumes.effects;templeBell.play().catch(error=>{audioFailureReason=error?.message||"钟声播放被浏览器阻止";toast("钟声播放失败："+audioFailureReason);});}
 }catch{}
}
let beadTotal=0;
try{beadTotal=Math.max(0,Math.floor(Number(localStorage.getItem("temple-beads-total")||0)));}catch{}
function renderBeads(){
 const count=beadTotal%108|| (beadTotal>0?108:0);
 text("beads-count",String(count));
 text("beads-round","/ 108 · "+Math.floor(beadTotal/108)+" 周");
 const ring=$("beads-ring");if(!ring)return;ring.replaceChildren();
 for(let i=0;i<108;i++){const bead=document.createElement("span");bead.className="prayer-bead"+(i<count?" passed":"");bead.setAttribute("aria-hidden","true");ring.append(bead);}
}
function openBeads(){$("beads-modal").classList.remove("hidden");renderBeads();}
function advanceBead(){
 beadTotal++;try{localStorage.setItem("temple-beads-total",String(beadTotal));}catch{}
 renderBeads();if(navigator.vibrate)navigator.vibrate(12);
 if(beadTotal%108===0)toast(language==="zh"?"已完成一周108颗，愿心安住。":language==="ja"?"108粒を一周しました。心静かに。":language==="ko"?"108알 한 바퀴를 마쳤습니다.":"ครบ 108 เม็ดแล้ว ขอให้ใจสงบ");
}
function resetBeads(){beadTotal-=beadTotal%108;try{localStorage.setItem("temple-beads-total",String(beadTotal));}catch{}renderBeads();}
$("beads-advance").addEventListener("click",advanceBead);
$("beads-reset").addEventListener("click",resetBeads);
function syncAudioControls(){
 for(const [key,id] of [["ambience","sound-ambience"],["chant","sound-chant"],["effects","sound-effects"]]){
  const input=$(id),output=$(id+"-value");if(input)input.value=String(Math.round(audioVolumes[key]*100));if(output)output.textContent=Math.round(audioVolumes[key]*100)+"%";
 }
}
function changeAudioVolume(key,value){
 audioVolumes[key]=Math.max(0,Math.min(1,Number(value)/100));
 try{localStorage.setItem("temple-audio-volumes",JSON.stringify(audioVolumes));}catch{}
 syncAudioControls();
 if(key==="ambience"){if(ambienceGain&&audio)ambienceGain.gain.setTargetAtTime(audioVolumes.ambience,audio.currentTime,.08);if(templeBirds)templeBirds.volume=.27*audioVolumes.ambience;}
 if(key==="chant"&&templeChant&&!templeChant.paused)updateSoundscape();
 if(key==="effects"&&effectsGain&&audio)effectsGain.gain.setTargetAtTime(audioVolumes.effects,audio.currentTime,.08);
}
$("sound-settings").addEventListener("click",()=>{$("sound-modal").classList.remove("hidden");syncAudioControls();});
$("sound-ambience").addEventListener("input",e=>changeAudioVolume("ambience",e.target.value));
$("sound-chant").addEventListener("input",e=>changeAudioVolume("chant",e.target.value));
$("sound-effects").addEventListener("input",e=>changeAudioVolume("effects",e.target.value));
$("sound-test").addEventListener("click",()=>{if(!soundEnabled){toast("请先点击“开启声音”，再试听钟声。");return;}playBell(true,.85);});

function doAction(action){
 if(action==="beads"){openBeads();return;}
 if(!profile)return;
 if(!world.canAct(action)){
  const key=action==="incense"?"incenseNear":action==="bell"?"bellNear":"lotusNear";
  toast(t()[key]);return;
 }
 world.setLocalPose(action);world.addEffect(action);if(action==="chant")playMuyu();actionUntil=performance.now()+((action==="meditate"||action==="kneel"||action==="chant")?6500:2600);
 const poseText=t().actionText[action]||t().walk;text("character-state",poseText);
 network.action(action);network.logActivity(action,world.currentLocation().key);
 if(action==="bell")playBell();
 toast(poseText);
}
document.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>doAction(button.dataset.action)));
$("open-profile").addEventListener("click",()=>{$("profile-modal").classList.remove("hidden");updatePreview();});
$("quick-profile").addEventListener("click",()=>$("open-profile").click());
$("save-profile").addEventListener("click",saveProfile);
$("delete-data").addEventListener("click",async()=>{if(!window.confirm(t().deleteConfirm))return;try{network.close();await network.deleteMyData();localStorage.removeItem(LOCAL_PROFILE);localStorage.removeItem("temple-world-player-id");toast(t().dataDeleted);setTimeout(()=>location.reload(),700);}catch{toast(t().deleteFailed);}});
["monk-name","monk-robe","monk-skin"].forEach(id=>$(id).addEventListener("input",updatePreview));
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>$(button.dataset.close).classList.add("hidden")));
$("language").value=language;$("language").addEventListener("change",async e=>{
 language=e.target.value;localStorage.setItem("temple-language",language);applyLanguage();
 if(profile){try{await network.saveProfile(profile,language);}catch{}network.close();network.connect({...profile,language},world.getPosition());}
});
$("chat-form").addEventListener("submit",e=>{
 e.preventDefault();const input=$("chat-input"),message=input.value.trim();if(!message)return;
 if(network.chat(message)){input.value="";}else toast(t().chatError);
});
$("chat-collapse").addEventListener("click",()=>$("chat-panel").classList.toggle("collapsed"));
$("open-prayers").addEventListener("click",async()=>{ $("prayer-modal").classList.remove("hidden");await loadPrayers();});
async function loadPrayers(){
 try{const prayers=await network.getPrayers();renderPrayers(prayers);}catch{renderPrayers([]);}
}
function renderPrayers(prayers){
 const list=$("prayer-list");list.replaceChildren();text("prayer-count",String(prayers.length));
 if(!prayers.length){const empty=document.createElement("div");empty.className="prayer-empty";empty.textContent=t().prayerEmpty;list.append(empty);return;}
 for(const p of prayers){
  const card=document.createElement("article");card.className="prayer-item";
  const body=document.createElement("p");body.textContent=p.message;
  const foot=document.createElement("small");foot.textContent=(p.display_name||t().unknown)+" · "+new Date(p.created_at).toLocaleDateString();
  card.append(body,foot);list.append(card);
 }
}
$("prayer-form").addEventListener("submit",async e=>{
 e.preventDefault();const input=$("prayer-input"),message=input.value.trim();if(message.length<2)return;
 const submit=$("prayer-submit");submit.disabled=true;
 try{
  await network.postPrayer(message,language,profile?.name||"行者");input.value="";toast(t().prayerSuccess);await loadPrayers();await updateStats();
 }catch(error){toast(error.message?.includes("pause")?t().prayerRate:t().prayerFailed);}
 finally{submit.disabled=false;}
});

// Keyboard and mobile thumbstick controls
const movementCodes={KeyW:"w",KeyA:"a",KeyS:"s",KeyD:"d",ArrowUp:"arrowup",ArrowDown:"arrowdown",ArrowLeft:"arrowleft",ArrowRight:"arrowright",Space:"jump"};
document.addEventListener("keydown",e=>{
 if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
 const key=movementCodes[e.code]||e.key.toLowerCase();
 if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","jump"," "].includes(key)){e.preventDefault();keys[key]=true;}
},true);
document.addEventListener("keyup",e=>{const key=movementCodes[e.code]||e.key.toLowerCase();keys[key]=false;},true);
document.addEventListener("visibilitychange",()=>{if(document.hidden){keys={};resetStick();}});
const stick=$("joystick"),knob=$("joystick-knob");
function updateStick(e){
 const r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),length=Math.hypot(dx,dy),factor=Math.min(1,Math.max(0,r.width*.34)/(length||1));
 joy={x:dx*factor/(r.width*.34),y:dy*factor/(r.width*.34)};knob.style.transform="translate("+dx*factor+"px,"+dy*factor+"px)";
}
stick.addEventListener("pointerdown",e=>{e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);});
stick.addEventListener("pointermove",e=>{if(stickPointer===e.pointerId)updateStick(e);});
function resetStick(){stickPointer=null;joy={x:0,y:0};knob.style.transform="translate(0,0)";}
stick.addEventListener("pointerup",resetStick);stick.addEventListener("pointercancel",resetStick);stick.addEventListener("lostpointercapture",resetStick);
addEventListener("blur",()=>{keys={};resetStick();});
$("run-toggle").addEventListener("click",()=>{mobileRunning=!mobileRunning;$("run-toggle").classList.toggle("active",mobileRunning);});
$("sound-toggle").addEventListener("click",()=>{void setSound(!soundEnabled);});
$("profile-sound-toggle").addEventListener("click",()=>{void setSound(!soundEnabled);});
function inputState(){
 return {
  forward:keys.w||keys.arrowup?1:0,backward:keys.s||keys.arrowdown?1:0,
  left:keys.a||keys.arrowleft?1:0,right:keys.d||keys.arrowright?1:0,
  run:!!keys.shift||mobileRunning,joyX:joy.x,joyY:-joy.y,jump:!!keys.jump||!!keys[" "]
 };
}
function frame(){
 const dt=Math.min(world.clock.getDelta(),.18),now=performance.now();
 world.update(dt,inputState(),now);updateLocation();updateSoundscape();if(soundEnabled&&world.lastMovement?.moving&&!world.lastMovement?.blocked&&now-lastFootstep>480){playFootstep();lastFootstep=now;}
 if(profile&&now-lastPositionSend>110){
  const p=world.getPosition();network.move(p);
  lastPositionSend=now;
 }
 if(now>actionUntil){text("character-state",t().walk);}
 requestAnimationFrame(frame);
}
async function start(){
 applyLanguage();
 try{await network.health();}catch{}
 await loadProfile();
 if(profile){try{await network.saveProfile(profile,language);}catch{}}
 try{await network.visit();}catch{}
 await updateStats();setInterval(updateStats,30000);
 setInterval(()=>{if(!$("prayer-modal").classList.contains("hidden"))loadPrayers();},45000);
 $("loading").classList.add("hidden");toast(t().entered);
 if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(()=>{});}
 requestAnimationFrame(frame);
}
addEventListener("beforeunload",()=>network.close());
start();
