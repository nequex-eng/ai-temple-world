import { TempleWorld } from "./world.js?v=20261116-r17";
import { TempleNetwork } from "./network.js?v=20261116-r3";
import { getText } from "./i18n.js?v=20261116-r8";

const $=id=>document.getElementById(id);
const LOCAL_PROFILE="temple-world-profile-v2";
let language=localStorage.getItem("temple-language")||"zh";
if(!["zh","en","ja","ko","th"].includes(language))language="zh";
let profile=null,abbotHistory=[],fortuneHistory=[],onlinePlayers=new Map(),sharedPrayers=[],actionUntil=0,lastPositionSend=0,lastSentNetworkPosition=null,lastMobileRender=0,lastActivity=0,joy={x:0,y:0},keys={},audio=null,audioMaster=null,ambienceGain=null,effectsGain=null,stickPointer=null,soundEnabled=false,ambientNodes=null,templeBirds=null,templeChant=null,templeBell=null,lastFootstep=0,audioFailureShown=false,birdRetryAt=0,audioFailureReason="",bellHits=0,audioStarting=null;
let soundPreference=true;try{localStorage.setItem("temple-sound-enabled","true");}catch{}
const touchAudioGate=matchMedia("(pointer: coarse)").matches||matchMedia("(max-width: 700px)").matches;
let prayerWallPromptOpen=false;
let audioVolumes={ambience:.8,chant:.65,effects:.8};
try{const saved=JSON.parse(localStorage.getItem("temple-audio-volumes")||"null");if(saved)for(const key of Object.keys(audioVolumes))audioVolumes[key]=Math.max(0,Math.min(1,Number(saved[key]??audioVolumes[key])));}catch{}
const world=new TempleWorld($("world"));
let savedSmoothMode=false;try{savedSmoothMode=localStorage.getItem("temple-render-mode")==="smooth";}catch{}
Object.defineProperty(window,"__templeDebug",{value:Object.freeze({position:()=>({...world.getPosition(),y:world.local?.root.position.y??0}),setPosition:(x,z)=>world.setDebugPosition(x,z),setYaw:yaw=>world.setDebugYaw(yaw),smoothMode:()=>world.smoothMode,pixelRatio:()=>world.renderer.getPixelRatio(),renderMode:()=>world.smoothMode,step:(input,dt=.05)=>world.update(dt,input,performance.now(),false),remotePlayers:()=>[...world.remotes.values()].map(a=>({id:a.id,visible:a.root.visible,x:a.root.position.x,z:a.root.position.z})),jumpState:()=>({offset:world.jumpOffset,velocity:world.jumpVelocity,held:world.jumpHeld,pose:world.local?.pose,movement:world.lastMovement}),inside:()=>world.indoor,canAct:action=>world.canAct(action),meditationCushions:()=>world.meditationCushions.map(([x,z])=>({x,z})),broadcastPosition:()=>network.move(world.getPosition(),true),npcs:()=>world.npcs.filter(n=>!n.stationary).map(n=>({name:n.avatar.profile?.name||n.avatar.id,x:n.avatar.root.position.x,z:n.avatar.root.position.z,moving:!!n.moving})),vendors:()=>world.npcs.filter(n=>n.stationary).length,market:()=>world.vendorSpecs.map(v=>({...v})),marketLabels:()=>world.marketStalls.map(s=>s.userData.marketItemLabel),nightLights:()=>world.nightLights.length,squatToilets:()=>world.squatToilets.length,releaseLotus:()=>world.addEffect("lotus"),lotusBoats:()=>[],censer:()=>({x:world.courtyardIncensePosition.x,z:world.courtyardIncensePosition.z}),cushions:()=>world.meditationCushions.length,dayNight:()=>({...world.dayNightState}),renderState:()=>world.getRenderState(),navigateToAction:action=>world.navigateToAction(action),wishes:()=>[...sharedPrayers],input:()=>({keys:{...keys},joy:{...joy},run:false,pose:world.local?.pose,position:world.getPosition(),movement:world.lastMovement})}),configurable:false});
Object.defineProperty(window,"__templeAudioDebug",{value:Object.freeze({state:()=>audio?.state||"uninitialized",enabled:()=>soundEnabled,media:()=>({birds:{paused:templeBirds?.paused??true,time:templeBirds?.currentTime??0,ready:templeBirds?.readyState??0,error:templeBirds?.error?.code||0},chant:{paused:templeChant?.paused??true,time:templeChant?.currentTime??0,ready:templeChant?.readyState??0,error:templeChant?.error?.code||0},bell:{paused:templeBell?.paused??true,time:templeBell?.currentTime??0,ready:templeBell?.readyState??0,error:templeBell?.error?.code||0}}),bellHits:()=>bellHits}),configurable:false});
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
function toast(message,duration=2600){
 const el=$("toast");el.textContent=message;el.classList.add("show");
 clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),duration);
}
function applyLanguage(){
 const d=t();
 const fortuneCopy={zh:{title:"命理问卦 · 抽签解签",description:"依据易经卦象、阴阳五行、干支八字等传统术数进行文化解读。出生资料仅用于本次推演，不保存。",birth:"出生资料（选填）",birthHint:"出生年月日、出生时辰、性别、出生地；注明公历或农历，不详可留空",question:"想问的事情",questionHint:"例如：近期事业发展如何？",ask:"问命理",draw:"摇签起卦",foot:"易经 · 八卦 · 生辰八字 · 铁板神数 · 六爻",welcome:"请写下所问之事，也可摇签起卦。传统术数仅供文化体验与参考。"},en:{title:"Fortune Reading · Draw a Lot",description:"A cultural reading based on the I Ching, yin-yang and five elements, and Four Pillars. Birth details are used for this reading only and are not stored.",birth:"Birth details (optional)",birthHint:"Date, time, gender, birthplace; specify Gregorian or lunar calendar. Leave unknown details blank.",question:"Your question",questionHint:"For example: How might my career develop?",ask:"Read my fortune",draw:"Draw a lot",foot:"I Ching · Bagua · Four Pillars · Tie Ban Shen Shu · Six Lines",welcome:"Write your question or draw a lot. Traditional divination is offered for cultural experience and reflection."},ja:{title:"運勢占い・易占",description:"易経、陰陽五行、四柱推命など伝統的な術数文化に基づく解釈です。出生情報は今回のみ使用し、保存しません。",birth:"出生情報（任意）",birthHint:"生年月日・出生時刻・性別・出生地。新暦か旧暦かを明記。不明な項目は空欄で構いません。",question:"相談したいこと",questionHint:"例：最近の仕事運について",ask:"占う",draw:"おみくじ・卦を立てる",foot:"易経・八卦・四柱推命・鉄板神数・六爻",welcome:"質問を書くか、卦を立ててください。伝統文化としての参考体験です。"},ko:{title:"운세 풀이 · 주역 점괘",description:"주역, 음양오행, 사주명리 등 전통 술수 문화에 따른 해석입니다. 출생 정보는 이번 풀이에만 사용하며 저장하지 않습니다.",birth:"출생 정보(선택)",birthHint:"생년월일, 출생 시각, 성별, 출생지와 양력/음력을 적어 주세요. 모르면 비워 두세요.",question:"궁금한 점",questionHint:"예: 앞으로의 직업운은 어떨까요?",ask:"운세 보기",draw:"제비 뽑아 괘 세우기",foot:"주역 · 팔괘 · 사주 · 철판신수 · 육효",welcome:"질문을 적거나 괘를 뽑아 보세요. 전통문화 체험 및 참고용입니다."},th:{title:"ทำนายดวง · เสี่ยงเซียมซี",description:"การตีความตามวัฒนธรรมศาสตร์ดั้งเดิม เช่น อี้จิง หยินหยาง ธาตุทั้งห้า และดวงจีน ข้อมูลวันเกิดใช้เฉพาะครั้งนี้และไม่บันทึก",birth:"ข้อมูลวันเกิด (ไม่บังคับ)",birthHint:"วันเดือนปี เวลาเกิด เพศ และสถานที่เกิด ระบุปฏิทินสากลหรือจันทรคติ หากไม่ทราบเว้นว่างได้",question:"คำถามของคุณ",questionHint:"เช่น แนวโน้มการงานในช่วงนี้เป็นอย่างไร",ask:"ทำนาย",draw:"เสี่ยงเซียมซีตั้ง卦",foot:"อี้จิง · ปากว้า · ดวงจีน · เถี่ยป่านเสินซู่ · ลิ่วเหยา",welcome:"เขียนคำถามหรือเสี่ยงเซียมซีได้ เป็นประสบการณ์วัฒนธรรมเพื่อประกอบการพิจารณาเท่านั้น。"}}[language];
 for(const [id,value] of Object.entries({"fortune-title":fortuneCopy.title,"fortune-description":fortuneCopy.description,"fortune-birth-label":fortuneCopy.birth,"fortune-question-label":fortuneCopy.question,"fortune-ask":fortuneCopy.ask,"fortune-draw":fortuneCopy.draw,"fortune-foot":fortuneCopy.foot}))text(id,value);
 $("fortune-birth").placeholder=fortuneCopy.birthHint;$("fortune-question").placeholder=fortuneCopy.questionHint;
 if(!$("fortune-messages").dataset.started)$("fortune-messages").firstElementChild.textContent=fortuneCopy.welcome;
 document.documentElement.lang=({zh:"zh-CN",en:"en",ja:"ja",ko:"ko",th:"th"})[language];
 world.setLanguage(language);
 const labels={
  "connection-label":d.statusConnecting,"brand-name":d.brandName||"云上禅境","loading-title":d.brandName||"云上禅境","profile-button-label":d.profile,"sound-toggle":"♫ "+(soundEnabled?d.soundOn:d.soundOff),"profile-sound-toggle":"♫ "+(soundEnabled?d.soundOn:d.soundOff),"location-eyebrow":d.locationEyebrow,
  "location-hint":d.locationHint,"presence-title":d.presence,"presence-sub":d.presenceSub,
  "today-visitors":$("today-visitors").textContent,"today-activities":$("today-activities").textContent,
  "wish-total":$("wish-total").textContent,"visitors-label":d.todayVisitors,"activities-label":d.todayActivities,
  "wishes-label":d.wishes,"character-state":d.walk,"chat-title":d.chatTitle,"chat-caption":d.chatCaption,
  "chat-welcome":d.chatWelcome,"chat-foot":d.chatFoot,"mobile-caption":d.mobile,"desktop-hint":d.desktop,
  "profile-title":d.profileTitle,"profile-description":d.profileDesc,"abbot-button-label":d.abbotButton,"abbot-title":d.abbotTitle,"abbot-description":d.abbotDescription,"abbot-greeting":d.abbotGreeting,"abbot-send":d.abbotSend,"abbot-status":d.abbotFoot,"label-name":d.name,"label-style":d.style,"delete-data":d.deleteData,
  "label-robe":d.robe,"label-skin":d.skin,"save-profile":d.save,"profile-foot":d.profileFoot,
  "prayer-title":d.prayerTitle,"prayer-description":d.prayerDesc,"prayer-submit":d.prayerSubmit,
  "prayer-list-label":d.prayerList,"prayer-empty":d.prayerEmpty,"prayer-foot":d.prayerFoot,"beads-title":d.beadsTitle,"beads-description":d.beadsDesc,"beads-reset":d.beadsReset,"beads-foot":d.beadsFoot
 };
 for(const [id,value] of Object.entries(labels))text(id,value);
 document.title=(d.brandName||"云上禅境")+" · AI Temple World";
 $("chat-input").placeholder=d.chatPlaceholder;$("prayer-input").placeholder=d.prayerPlaceholder;$("abbot-input").placeholder=d.abbotPlaceholder;$("open-abbot").title=d.abbotButton;$("open-abbot").setAttribute("aria-label",d.abbotButton);$("open-profile").title=d.profile;$("open-profile").setAttribute("aria-label",d.profile);
 $("open-prayers").title=d.prayers;$("open-prayers").setAttribute("aria-label",d.prayers);
 $("monk-style").options[0].text=d.monk;$("monk-style").options[1].text=d.pilgrim;
 for(const [key,value] of Object.entries(d.actions))text("action-"+key,value);
 text("action-tea",d.actions.tea||({zh:"喝茶",ja:"お茶を飲む",ko:"차 마시기",th:"ดื่มชา",en:"Drink tea"})[language]||"喝茶");
 updateLocation(true);renderPresence();if(profile)text("character-state",d.walk);syncSmoothToggle();
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
  const lang=document.createElement("small");lang.textContent=({zh:"中文",en:"English",ja:"日本語",ko:"한국어",th:"ไทย"})[player.language]||"";
  row.append(seal,name,lang);list.append(row);
 }
}
function appendChat(player,message,languageCode,messageId=null){
 const box=$("chat-messages"),welcome=$("chat-welcome");if(welcome)welcome.remove();
 if(messageId&&box.querySelector('[data-chat-id="'+CSS.escape(messageId)+'"]'))return;
 const displayName=(player?.name||t().unknown)+(player?.id===network.playerId?" · "+t().you:"");
 const messageText=String(message||"").slice(0,220);
 const line=document.createElement("div");line.className="chat-line";if(messageId)line.dataset.chatId=messageId;
 const name=document.createElement("strong");name.textContent=displayName;
 const content=document.createElement("span");content.textContent=messageText;
 const lang=document.createElement("small");lang.textContent=t().chatOriginal;
 line.append(name,content,lang);box.append(line);
 while(box.children.length>45)box.firstElementChild.remove();
 box.scrollTop=box.scrollHeight;
 const floatLayer=$("chat-floaters");
 if(floatLayer){
  const floater=document.createElement("div");floater.className="chat-floater";
  const floaterName=document.createElement("strong");floaterName.textContent=displayName;
  const floaterText=document.createElement("span");floaterText.textContent=messageText;
  floater.append(floaterName,floaterText);
  floater.style.top=(22+(floatLayer.childElementCount%4)*14)+"%";
  const duration=Math.min(18,Math.max(10,8+Math.ceil(messageText.length/16)));
  floater.style.animationDuration=duration+"s";floatLayer.append(floater);
  while(floatLayer.children.length>4)floatLayer.firstElementChild.remove();
  setTimeout(()=>floater.remove(),duration*1000+350);
 }
}
function syncPresence(players=[]){
 const peers=new Map((players||[]).filter(p=>p?.id&&p.id!==network.playerId).map(p=>[p.id,p]));
 for(const id of [...world.remotes.keys()])if(!peers.has(id))world.removeRemote(id);
 onlinePlayers.clear();for(const p of peers.values()){world.updateRemote(p);onlinePlayers.set(p.id,p);}renderPresence();
}
function isTestPrayer(prayer){const message=String(prayer?.message||"").normalize("NFKC").replace(/\s+/g,"").toLowerCase();return /(?:你的|your)?(?:test|测试)(?:文字|祈愿|wish|prayer)?/.test(message);}
function syncPrayerBoard(prayers=[]){
 sharedPrayers=(Array.isArray(prayers)?prayers:[]).filter(p=>!isTestPrayer(p)).slice(0,30);world.setWishWallPrayers(sharedPrayers);
 renderPrayers(sharedPrayers);
}
function handleMessage(message){
 if(!message||!message.type)return;
 if(message.type==="welcome"){
  if(message.self)world.setDebugPosition(message.self.x,message.self.z);
  syncPresence(message.players||[]);syncPrayerBoard(message.prayers||[]);return;
 }
 if(message.type==="presence"){syncPresence(message.players||[]);return;}
 if(message.type==="player:join"){
  if(message.player?.id!==network.playerId){world.updateRemote(message.player);onlinePlayers.set(message.player.id,message.player);renderPresence();}
  if(message.player?.id!==network.playerId)toast(message.player.name+" · "+t().connected);return;
 }
 if(message.type==="player:move"||message.type==="player:action"){
  if(message.player?.id!==network.playerId){
   world.updateRemote(message.player);
   if(message.type==="player:action"&&message.player.action!=="lotus"){world.addEffect(message.player.action,{x:message.player.x,z:message.player.z});playRitualSound(message.player.action,.42);}
   onlinePlayers.set(message.player.id,message.player);
   if(message.type==="player:action")renderPresence();
  }return;
 }
 if(message.type==="player:leave"){world.removeRemote(message.id);onlinePlayers.delete(message.id);renderPresence();return;}
 if(message.type==="chat"){appendChat(message.player,message.message,message.player?.language,message.id);return;}
 if(message.type==="prayer:new"&&message.prayer?.id&&!isTestPrayer(message.prayer)&&!sharedPrayers.some(p=>p.id===message.prayer.id)){
  syncPrayerBoard([message.prayer,...sharedPrayers].slice(0,30));renderPrayerAppend(message.prayer);void updateStats();return;
 }
 if(message.type==="prayer:delete"&&message.id){syncPrayerBoard(sharedPrayers.filter(p=>p.id!==message.id));void updateStats();return;}
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
  network.connect({...profile,language},world.getPosition());
 }
}
function setProfileUI(){
 text("character-name",profile.name);text("monk-name",profile.name);text("preview-name",profile.name);
 $("preview-body").style.background=profile.robe;
 $("character-name").style.color=profile.robe;
}
function openProfileEditor(){
 if(!profile)return;
 $("monk-name").value=profile.name||"行者";$("monk-robe").value=profile.robe||"#b49a72";
 $("monk-skin").value=profile.skin||"#d7ad87";$("monk-style").value=profile.style||"monk";
 $("profile-modal").classList.remove("hidden");updatePreview();
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
function updateAudioStatus(){
 const state=audio?.state||"未初始化";
 const describe=media=>!media?"未创建":media.error?"错误码"+media.error.code:media.paused?"已暂停":media.currentTime>0?"播放中":"已启动";
 text("sound-status","音频引擎："+state+" · 庭院鸟鸣："+describe(templeBirds)+" · 殿内诵经："+describe(templeChant)+" · 钟声："+describe(templeBell)+(audioFailureReason?" · 最近错误："+audioFailureReason:""));
}
function mediaPlay(media,label){
 if(!media)return Promise.resolve(false);
 // Night is a hard mute for birds and chanting, including asynchronous fallback/retry paths.
 if(world.isNight&&(media===templeBirds||media===templeChant||/鸟鸣|诵经|birdsong|chant/i.test(String(label||"")))){
  media.pause();media.volume=0;return Promise.resolve(false);
 }
 if(media.__templePrimePending){
  media.__templePrimePending=false;
  const state=media.__templePrimeState;
  media.__templePrimeState=null;
  if(state){media.muted=state.muted;media.volume=state.volume;}
 }
 if(media.__templePlayPending)return media.__templePlayPending;
 let attempt;
 try{
  attempt=Promise.resolve(media.play()).then(()=>{updateAudioStatus();return true;})
   .catch(error=>{audioFailureReason=label+"播放失败："+(error?.message||error?.name||"unknown");updateAudioStatus();return false;})
   .finally(()=>{if(media.__templePlayPending===attempt)media.__templePlayPending=null;});
 }catch(error){audioFailureReason=label+"播放失败："+(error?.message||error?.name||"unknown");updateAudioStatus();return Promise.resolve(false);}
 media.__templePlayPending=attempt;return attempt;
}
function createTempleMedia(mp3Url,oggUrl,{loop=false,volume=.2,label="环境音"}={}) {
 const media=new Audio();
 let fallbackUsed=false;
 media.preload="auto";media.loop=loop;media.volume=volume;media.playsInline=true;
 media.addEventListener("error",()=>{
  if(!fallbackUsed&&oggUrl){
   fallbackUsed=true;media.src=oggUrl;media.load();
   if(soundEnabled)void mediaPlay(media,label);
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
 if(audio?.state==="running"&&soundEnabled)return true;if(audioStarting)return audioStarting;
 audioStarting=(async()=>{
  let timeoutId=null;
  try{
   const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)throw new Error("AudioContext unavailable");
   if(!audio){audio=new AudioContextClass({latencyHint:"interactive"});audioMaster=audio.createGain();audioMaster.gain.value=.88;audioMaster.connect(audio.destination);ambienceGain=audio.createGain();ambienceGain.gain.value=audioVolumes.ambience;ambienceGain.connect(audioMaster);effectsGain=audio.createGain();effectsGain.gain.value=audioVolumes.effects;effectsGain.connect(audioMaster);}
   if(!ambientNodes){
    const buffer=audio.createBuffer(1,audio.sampleRate*4,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.16;
    const noise=audio.createBufferSource();noise.buffer=buffer;noise.loop=true;const low=audio.createBiquadFilter();low.type="lowpass";low.frequency.value=520;low.Q.value=.35;
    const wind=audio.createGain();wind.gain.value=.075;noise.connect(low);low.connect(wind);wind.connect(ambienceGain||audioMaster);noise.start();
    const lfo=audio.createOscillator(),lfoGain=audio.createGain();lfo.frequency.value=.065;lfoGain.gain.value=.018;lfo.connect(lfoGain);lfoGain.connect(wind.gain);lfo.start();ambientNodes={noise,low,wind,lfo,lfoGain};
   }
   if(!templeBirds)templeBirds=createTempleMedia("https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2f/Birds_chirping_in_a_garden.ogg/Birds_chirping_in_a_garden.ogg.mp3","https://upload.wikimedia.org/wikipedia/commons/2/2f/Birds_chirping_in_a_garden.ogg",{loop:true,volume:.27*audioVolumes.ambience,label:"庭院鸟鸣"});
   if(!templeChant)templeChant=createTempleMedia("https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e8/20260602_145912_Dingjue_Om_mani_padme_hum.ogg/20260602_145912_Dingjue_Om_mani_padme_hum.ogg.mp3","https://upload.wikimedia.org/wikipedia/commons/e/e8/20260602_145912_Dingjue_Om_mani_padme_hum.ogg",{loop:true,volume:0,label:"殿内诵经"});
   if(!templeBell)templeBell=createTempleMedia("https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2c/Gong55.ogg/Gong55.ogg.mp3","https://upload.wikimedia.org/wikipedia/commons/2/2c/Gong55.ogg",{loop:false,volume:.38*audioVolumes.effects,label:"寺院钟声"});
   const resumePromise=audio.state==="running"?Promise.resolve():audio.resume();
   await Promise.race([resumePromise,new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error("音频启动超时，请再点一次声音按钮")),2800);})]);
   if(audio.state!=="running")throw new Error("AudioContext did not enter running state");
   soundEnabled=true;audioMaster.gain.setTargetAtTime(.88,audio.currentTime,.08);
   for(const id of ["sound-toggle","profile-sound-toggle"]){const b=$(id);if(b){b.classList.add("active");b.textContent="♫ "+t().soundOn;b.setAttribute("aria-pressed","true");}}
   if(!world.isNight)void mediaPlay(templeBirds,"庭院鸟鸣");updateSoundscape();return true;
  }catch(error){
   soundEnabled=false;audioFailureReason="音频引擎启动失败："+(error?.message||error?.name||"unknown");
   for(const id of ["sound-toggle","profile-sound-toggle"]){const b=$(id);if(b){b.classList.remove("active");b.textContent="♫ "+t().soundOff;b.setAttribute("aria-pressed","false");}}
   updateAudioStatus();console.warn("Temple audio could not be started:",error);return false;
  }finally{if(timeoutId)clearTimeout(timeoutId);}
 })();
 try{return await audioStarting;}finally{audioStarting=null;}
}
function updateSoundscape(){
 if(!soundEnabled)return;
 const night=!!world.isNight;
 if(night){
  if(templeBirds){templeBirds.volume=0;templeBirds.pause();try{templeBirds.currentTime=0;}catch{}}
  if(templeChant){templeChant.volume=0;templeChant.pause();try{templeChant.currentTime=0;}catch{}}
  return;
 }
 if(templeBirds){templeBirds.volume=.27*audioVolumes.ambience;if(templeBirds.paused&&performance.now()>birdRetryAt){birdRetryAt=performance.now()+5000;void mediaPlay(templeBirds,"庭院鸟鸣");}}
 if(!templeChant||!world.local)return;
 const p=world.getPosition(),hallDistance=Math.hypot(p.x,p.z+37),bellDistance=Math.hypot(p.x-8,p.z+41);
 const chantVolume=Math.max(0,1-hallDistance/42)*.50*audioVolumes.chant;
 templeChant.volume=chantVolume;
 if(chantVolume>.006){if(templeChant.paused||templeChant.muted)void mediaPlay(templeChant,"殿内诵经");}
 else if(!templeChant.paused)templeChant.pause();
 if(bellDistance<34&&performance.now()>(updateSoundscape.nextBell||0)){
  playBell(false,Math.max(.3,Math.min(.65,(1-bellDistance/38)*.65)));
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
 const now=audio.currentTime,output=effectsGain||audioMaster||audio.destination;
 // A dry wooden-fish attack: a brief mallet click followed by several
 // inharmonic wooden resonances, rather than a plain electronic beep.
 const length=Math.max(1,Math.floor(audio.sampleRate*.028)),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,5);
 const hit=audio.createBufferSource(),filter=audio.createBiquadFilter(),hitGain=audio.createGain();
 hit.buffer=buffer;filter.type="bandpass";filter.frequency.value=1050;filter.Q.value=.72;
 hitGain.gain.setValueAtTime(.055,now);hitGain.gain.exponentialRampToValueAtTime(.0001,now+.035);
 hit.connect(filter);filter.connect(hitGain);hitGain.connect(output);hit.start(now);
 for(const [hz,vol,decay] of [[184,.085,.14],[276,.042,.19],[397,.021,.12],[612,.008,.075]]){
  const osc=audio.createOscillator(),gain=audio.createGain();osc.type="sine";osc.frequency.setValueAtTime(hz,now);
  gain.gain.setValueAtTime(vol,now);gain.gain.exponentialRampToValueAtTime(.0001,now+decay);
  osc.connect(gain);gain.connect(output);osc.start(now);osc.stop(now+decay+.01);
 }
}
async function setSound(on,{quiet=false,save=true}={}){
 if(save){soundPreference=!!on;try{localStorage.setItem("temple-sound-enabled",String(soundPreference));}catch{}}
 const button=$("sound-toggle");
 if(on){
  if(button){button.disabled=true;button.textContent="♫ 正在开启…";}
  let ok=false;
  try{ok=await Promise.race([ensureAudio(),new Promise(resolve=>setTimeout(()=>resolve(false),5000))]);}
  catch(error){audioFailureReason=error?.message||"audio startup failed";}
  if(button)button.disabled=false;
  if(!ok){
   soundEnabled=false;
   for(const id of ["sound-toggle","profile-sound-toggle"]){const target=$(id);if(target){target.classList.remove("active");target.textContent="♫ "+t().soundOff;target.setAttribute("aria-pressed","false");}}
   if(!quiet)toast("声音启动失败："+(audioFailureReason||"请检查设备音量与浏览器权限"));
   return;
  }
  updateSoundscape();
  if(button)button.setAttribute("aria-pressed","true");
  if(!quiet)toast("寺院环境声已开启");
  return;
 }
 soundEnabled=false;
 if(audio?.state==="running"&&audioMaster)audioMaster.gain.setTargetAtTime(.0001,audio.currentTime,.12);
 for(const media of [templeBirds,templeChant,templeBell]){
  if(media){media.pause();try{media.currentTime=0;}catch{}}
 }
 for(const id of ["sound-toggle","profile-sound-toggle"]){const target=$(id);if(target){target.classList.remove("active");target.textContent="♫ "+t().soundOff;target.setAttribute("aria-pressed","false");}}
}
function playBellSynthesis(volume=.62){
 if(!audio||audio.state!=="running")return;
 bellHits++;
 const now=audio.currentTime,output=effectsGain||audioMaster||audio.destination;
 // A short bronze strike followed by inharmonic resonances, tuned to remain
 // audible on small phone speakers instead of relying on sub-bass alone.
 const length=Math.max(1,Math.floor(audio.sampleRate*.055)),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3);
 const strike=audio.createBufferSource(),high=audio.createBiquadFilter(),body=audio.createGain();
 strike.buffer=buffer;high.type="bandpass";high.frequency.value=1850;high.Q.value=.55;
 body.gain.setValueAtTime(.0001,now);body.gain.exponentialRampToValueAtTime(.19*volume,now+.004);body.gain.exponentialRampToValueAtTime(.0001,now+.075);
 strike.connect(high);high.connect(body);body.connect(output);strike.start(now);strike.stop(now+.06);
 for(const [hz,level,decay,detune] of [[174,.12,4.4,-3],[230,.105,3.9,2],[287,.082,3.35,-1],[352,.066,2.9,2],[440,.05,2.5,-2],[574,.038,2.15,3],[720,.028,1.8,-1],[880,.021,1.5,1],[1100,.015,1.2,0],[1320,.011,.95,-1],[1580,.007,.72,2]]){
  const osc=audio.createOscillator(),gain=audio.createGain(),filter=audio.createBiquadFilter();
  osc.type="sine";osc.frequency.setValueAtTime(hz,now);osc.detune.value=detune;
  filter.type="lowpass";filter.frequency.value=2400;
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(level*volume,now+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,now+decay);
  osc.connect(filter);filter.connect(gain);gain.connect(output);osc.start(now);osc.stop(now+decay+.04);
 }
}
function playBell(force=false,volume=.62){
 if(!soundEnabled&&!force)return;
 playBellSynthesis(volume);
}
function playBeadTick(){
 if(!soundEnabled||!audio||audio.state!=="running")return;
 const now=audio.currentTime,out=effectsGain||audio.destination;
 for(const [hz,delay,level] of [[1180,0,.045],[1760,.018,.022]]){
  const osc=audio.createOscillator(),gain=audio.createGain();osc.type="sine";osc.frequency.value=hz;
  gain.gain.setValueAtTime(.0001,now+delay);gain.gain.exponentialRampToValueAtTime(level,now+delay+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.075);
  osc.connect(gain);gain.connect(out);osc.start(now+delay);osc.stop(now+delay+.085);
 }
}
function playLotusWater(){
 if(!soundEnabled||!audio||audio.state!=="running")return;
 const now=audio.currentTime,length=Math.floor(audio.sampleRate*.72),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++){const t=i/length;data[i]=(Math.random()*2-1)*Math.pow(1-t,2.2);}
 const source=audio.createBufferSource(),low=audio.createBiquadFilter(),high=audio.createBiquadFilter(),gain=audio.createGain();
 source.buffer=buffer;low.type="lowpass";low.frequency.setValueAtTime(1050,now);low.frequency.exponentialRampToValueAtTime(420,now+.55);
 high.type="highpass";high.frequency.value=130;
 gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(.075*audioVolumes.effects,now+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+.7);
 source.connect(high);high.connect(low);low.connect(gain);gain.connect(effectsGain||audioMaster||audio.destination);
 source.start(now);source.stop(now+.73);
}
function playRitualSound(action,volume=1){
 if(!soundEnabled||!audio||audio.state!=="running")return;
 if(action==="chant"&&world.isNight)return;
 if(action==="bell"){playBell(false,.9*volume);return;}
 if(action==="chant"){playMuyu();return;}
 if(action==="beads"){playBeadTick();return;}
 const now=audio.currentTime,out=effectsGain||audio.destination;
 if(action==="bow"){
  for(const [hz,delay,level] of [[587,0,.026],[784,.09,.018]]){
   const osc=audio.createOscillator(),gain=audio.createGain();osc.type="sine";osc.frequency.value=hz;
   gain.gain.setValueAtTime(.0001,now+delay);gain.gain.exponentialRampToValueAtTime(level*volume,now+delay+.035);gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.48);
   osc.connect(gain);gain.connect(out);osc.start(now+delay);osc.stop(now+delay+.5);
  }
 }else if(action==="kneel"){
  const osc=audio.createOscillator(),gain=audio.createGain();osc.type="triangle";osc.frequency.setValueAtTime(145,now);osc.frequency.exponentialRampToValueAtTime(82,now+.12);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.11*volume,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.2);
  osc.connect(gain);gain.connect(out);osc.start(now);osc.stop(now+.21);
 }else if(action==="incense"){
  const notes=[659,988];
  notes.forEach((hz,i)=>{const osc=audio.createOscillator(),gain=audio.createGain();osc.type="sine";osc.frequency.value=hz;
   gain.gain.setValueAtTime(.0001,now+i*.12);gain.gain.exponentialRampToValueAtTime(.035*volume,now+i*.12+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.12+.8);
   osc.connect(gain);gain.connect(out);osc.start(now+i*.12);osc.stop(now+i*.12+.82);});
 }else if(action==="sweep"){
  const length=Math.floor(audio.sampleRate*.24),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
  const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();src.buffer=buffer;filter.type="lowpass";filter.frequency.value=950;
  gain.gain.value=.07*volume;src.connect(filter);filter.connect(gain);gain.connect(out);src.start(now);
 }
}
let beadTotal=0;
try{beadTotal=Math.max(0,Math.floor(Number(localStorage.getItem("temple-beads-total")||0)));}catch{}
function renderBeads(){
 const count=beadTotal%108|| (beadTotal>0?108:0);
 text("beads-count",String(count));
 text("beads-round","/ 108 · "+Math.floor(beadTotal/108)+" 周");
 const ring=$("beads-ring");if(!ring)return;ring.replaceChildren();
 const size=ring.clientWidth||280,radius=size*.5-13;
 for(let i=0;i<108;i++){
  const angle=(i/108)*Math.PI*2-Math.PI/2,bead=document.createElement("span");
  bead.className="prayer-bead"+(i<count?" passed":"");
  bead.setAttribute("aria-hidden","true");
  bead.style.left=(size/2+Math.cos(angle)*radius)+"px";
  bead.style.top=(size/2+Math.sin(angle)*radius)+"px";
  ring.append(bead);
 }
 ring.setAttribute("aria-valuenow",String(count));
}
function openBeads(){$("beads-modal").classList.remove("hidden");renderBeads();}
function advanceBead(){
 playBeadTick();beadTotal++;try{localStorage.setItem("temple-beads-total",String(beadTotal));}catch{}
 renderBeads();if(navigator.vibrate)navigator.vibrate(12);
 if(beadTotal%108===0)toast(language==="zh"?"已完成一周108颗，愿心安住。":language==="ja"?"108粒を一周しました。心静かに。":language==="ko"?"108알 한 바퀴를 마쳤습니다.":"ครบ 108 เม็ดแล้ว ขอให้ใจสงบ");
}
function resetBeads(){beadTotal-=beadTotal%108;try{localStorage.setItem("temple-beads-total",String(beadTotal));}catch{}renderBeads();}
let beadPointer=null,lastBeadIndex=null;
function beadIndexAt(event){
 const rect=beadRing.getBoundingClientRect();
 const angle=Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2))+Math.PI/2;
 return Math.round(((angle+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*108)%108;
}
const beadRing=$("beads-ring");
beadRing.addEventListener("pointerdown",event=>{
 if(event.pointerType==="mouse"&&event.button!==0)return;
 beadPointer=event.pointerId;lastBeadIndex=beadIndexAt(event);
 beadRing.setPointerCapture(event.pointerId);event.preventDefault();
});
beadRing.addEventListener("pointermove",event=>{
 if(beadPointer!==event.pointerId||lastBeadIndex===null)return;
 const next=beadIndexAt(event),steps=(next-lastBeadIndex+108)%108;
 if(steps>0&&steps<=54){for(let i=0;i<steps;i++)advanceBead();lastBeadIndex=next;}
 event.preventDefault();
});
const finishBeadDrag=event=>{if(beadPointer===event.pointerId){beadPointer=null;lastBeadIndex=null;}};
beadRing.addEventListener("pointerup",finishBeadDrag);
beadRing.addEventListener("pointercancel",finishBeadDrag);
beadRing.addEventListener("lostpointercapture",finishBeadDrag);
beadRing.addEventListener("keydown",event=>{if(event.key==="ArrowRight"||event.key==="ArrowDown"){event.preventDefault();advanceBead();}});
$("beads-reset").addEventListener("click",resetBeads);
function syncWanderButton(){
 const button=document.querySelector('[data-action="wander"]');if(!button)return;
 button.classList.toggle("active",world.wanderActive);button.setAttribute("aria-pressed",String(world.wanderActive));
}
function doAction(action){
 if(action==="wander"){
  if(!profile)return;
  world.stopGarden();
  const active=world.toggleWander();syncWanderButton();
  toast(active?(t().wanderStarted||"开始闲逛"):(t().wanderStopped||"已停止闲逛"));return;
 }
 if(action==="beads"){world.stopWander();world.stopGarden();syncWanderButton();openBeads();return;}
 if(action==="garden"){
  if(!profile)return;
  if(world.gardenActive){world.stopGarden();text("character-state",t().walk);network.move(world.getPosition(),true);toast(t().gardenStopped||"已停止照料菜田");}
  else if(world.startGarden())toast(t().walkingToGarden||"正在前往菜田");
  else toast(t().gardenUnavailable||"菜田暂时无法到达");
  return;
 }
 if(!profile)return;
 world.stopWander();world.stopGarden();syncWanderButton();
 if(action==="rest"&&!world.canAct(action)){if(world.navigateToAction("rest"))toast(t().walkingToRest||"正在前往禅房歇脚");else toast(t().restUnavailable||"暂时没有空闲的休息位置");return;}
 if(action==="toilet"&&!world.canAct(action)){if(world.navigateToAction("toilet"))toast(t().walkingToAction||"正在前往厕所");else toast(t().toiletNear||"请前往洗手间入口");return;}
 if(action==="eat"&&!world.canAct(action)){if(world.navigateToAction("eat"))toast(t().walkingToAction||"正在前往斋馆");else toast(t().restaurantNear||"斋馆入口暂时无法到达");return;}
 if(["incense","bell","lotus","tea","chant","eat"].includes(action)&&!world.canAct(action)&&world.navigateToAction(action)){toast(t().walkingToAction||"正在前往目的地");return;}
 if(!world.canAct(action)){
  const key=action==="toilet"?"toiletNear":action==="incense"?"incenseNear":action==="bell"?"bellNear":action==="meditate"?"meditateNear":"lotusNear";
  toast(t()[key]);return;
 }
 if(action==="rest"){
  world.setLocalPose("rest");actionUntil=performance.now()+12000;
  text("character-state",t().actionText.rest||"歇脚");
  const restPosition=world.getPosition();network.move(restPosition,true);lastSentNetworkPosition={x:restPosition.x,z:restPosition.z,rotation:restPosition.rotation};lastPositionSend=performance.now();
  network.action("rest");network.logActivity("rest",world.currentLocation().key);toast(t().resting||"在这里安心歇一会儿");return;
 }
 if(action==="tea"){
  world.setLocalPose("tea");world.addEffect("tea");playRitualSound("tea");text("character-state",t().actionText.tea||"品茶");toast(t().teaEnjoy||"静坐品茶，稍歇片刻");network.logActivity(action,"tea-house");return;
 } if(action==="eat"){
  world.setLocalPose("eat");actionUntil=performance.now()+6500;
  text("character-state",t().actions.eat||"吃斋");
  const diningPosition=world.getPosition();
  network.move(diningPosition,true);
  lastSentNetworkPosition={x:diningPosition.x,z:diningPosition.z,rotation:diningPosition.rotation};
  lastPositionSend=performance.now();
  network.action("eat");
  network.logActivity("eat","vegetarian-kitchen");
  toast(t().restaurantArrived||"已到斋馆，请静心用斋。");return;
 }

 if(action==="lotus"){
  playLotusWater();
  text("character-state",t().actionText.lotus||"放莲灯");
  toast("一盏莲灯随愿入水，愿你心安自在。");
  network.logActivity(action,world.currentLocation().key);
  return;
 }
 if(action==="toilet"){
  world.setLocalPose("toilet");actionUntil=performance.now()+6500;
  text("character-state",t().actionText?.toilet||t().walk);
  const restroomPosition=world.getPosition();network.move(restroomPosition,true);lastSentNetworkPosition={x:restroomPosition.x,z:restroomPosition.z,rotation:restroomPosition.rotation};lastPositionSend=performance.now();
  network.action(action);network.logActivity(action,"washroom");return;
 }
 world.setLocalPose(action);world.addEffect(action);playRitualSound(action);actionUntil=performance.now()+((action==="meditate"||action==="kneel"||action==="chant")?6500:2600);
 const poseText=t().actionText[action]||t().walk;text("character-state",poseText);
 network.action(action);network.logActivity(action,world.currentLocation().key);
 toast(poseText);
}
document.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>doAction(button.dataset.action)));
window.addEventListener("temple:arrived-action",event=>{if(event.detail?.action)doAction(event.detail.action);});
window.addEventListener("temple:garden-started",()=>{actionUntil=0;world.setLocalPose("water");text("character-state",t().gardenWorking||"正在浇水施肥");network.action("water");network.logActivity("water","forest-garden");});
window.addEventListener("temple:garden-watering",()=>{actionUntil=0;world.setLocalPose("water");text("character-state",t().gardenWorking||"正在浇水施肥");network.action("water");});
window.addEventListener("temple:garden-walking",()=>{actionUntil=0;world.setLocalPose("walk");text("character-state",t().walkingToGarden||t().walk);network.action("walk");});
window.addEventListener("temple:garden-stopped",()=>{text("character-state",t().walk);network.action("walk");});
$("open-profile").addEventListener("click",openProfileEditor);
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
 const messageId=network.chat(message);
 if(messageId){appendChat({id:network.playerId,name:profile?.name||"行者"},message,language,messageId);input.value="";}else toast(t().chatError);
});
function setChatPanelOpen(open){
 $("chat-panel").classList.toggle("collapsed",!open);
 $("chat-heading").setAttribute("aria-expanded",String(!!open));
 $("chat-collapse").textContent=open?"×":"＋";
 $("chat-collapse").setAttribute("aria-label",open?"关闭聊天":"打开聊天");
 if(open){const box=$("chat-messages");box.scrollTop=box.scrollHeight;}
}
$("chat-heading").addEventListener("click",e=>{
 if(e.target.closest("#chat-collapse"))return;
 setChatPanelOpen($("chat-panel").classList.contains("collapsed"));
});
$("chat-heading").addEventListener("keydown",e=>{
 if(e.target!==$("chat-heading"))return;
 if(e.key==="Enter"||e.key===" "){e.preventDefault();setChatPanelOpen($("chat-panel").classList.contains("collapsed"));}
});
$("chat-collapse").addEventListener("click",e=>{
 e.stopPropagation();setChatPanelOpen($("chat-panel").classList.contains("collapsed"));
});
$("open-prayers").addEventListener("click",async()=>{ $("prayer-modal").classList.remove("hidden");await loadPrayers();});
async function loadPrayers(){
 try{const prayers=await network.getPrayers();syncPrayerBoard(prayers);renderPrayers(prayers);}catch{renderPrayers(sharedPrayers);}
}
function makePrayerCard(p){
 const card=document.createElement("article");card.className="prayer-item";if(p.id)card.dataset.prayerId=p.id;
 const body=document.createElement("p");body.textContent=p.message;
 const foot=document.createElement("small");foot.textContent=(p.display_name||t().unknown)+" · "+new Date(p.created_at||Date.now()).toLocaleDateString();
 card.append(body,foot);
 if(p.player_id===network.playerId){
  const remove=document.createElement("button");remove.type="button";remove.className="prayer-delete";remove.textContent="撤回心愿";remove.setAttribute("aria-label","撤回自己发布的心愿");
  remove.addEventListener("click",async()=>{
   if(remove.disabled||!window.confirm("确定撤回自己发布的这条心愿吗？"))return;
   remove.disabled=true;
   try{await network.deletePrayer(p.id);syncPrayerBoard(sharedPrayers.filter(item=>item.id!==p.id));toast("心愿已撤回");await updateStats();}
   catch(error){remove.disabled=false;toast(error?.message||"删除失败，请稍后重试");}
  });
  card.append(remove);
 }
 return card;
}
function renderPrayerAppend(p){
 if(!p?.message)return;
 const list=$("prayer-list");if(list.querySelector(".prayer-empty"))list.replaceChildren();
 if(list.querySelector('[data-prayer-id="'+CSS.escape(p.id||"")+'"]'))return;
 list.prepend(makePrayerCard(p));while(list.children.length>30)list.lastElementChild.remove();text("prayer-count",String(list.children.length));
}
function renderPrayers(prayers){
 prayers=(Array.isArray(prayers)?prayers:[]).filter(p=>!isTestPrayer(p));
 const list=$("prayer-list");list.replaceChildren();text("prayer-count",String(prayers.length));
 if(!prayers.length){const empty=document.createElement("div");empty.className="prayer-empty";empty.textContent=t().prayerEmpty;list.append(empty);return;}
 for(const p of prayers)list.append(makePrayerCard(p));
}
world.onFortuneStall=()=>{$("fortune-modal").classList.remove("hidden");if(!touchAudioGate)$("fortune-question").focus();};
function appendFortuneMessage(role,content){const box=$("fortune-messages");if(!box.dataset.started){box.replaceChildren();box.dataset.started="1";}const line=document.createElement("div");line.className="fortune-message "+(role==="user"?"user":"assistant");line.textContent=String(content||"").slice(0,2400);box.append(line);box.scrollTop=box.scrollHeight;while(box.children.length>12)box.firstElementChild?.remove();}
function drawHexagram(){const lines=[];for(let i=0;i<6;i++){const toss=[0,0,0].map(()=>Math.random()<.5?2:3);const sum=toss.reduce((a,b)=>a+b,0);lines.push({position:["初爻","二爻","三爻","四爻","五爻","上爻"][i],value:sum,kind:sum===6?"老阴（动爻）":sum===7?"少阳":sum===8?"少阴":"老阳（动爻）",symbol:sum===6?"⚋→⚊":sum===7?"⚊":sum===8?"⚋":"⚊→⚋"});}return "三枚铜钱法，六次投掷，自下而上：\n"+lines.map(line=>line.position+"："+line.kind+" "+line.symbol).join("\n")+"\n请据此核定本卦、动爻与变卦。";}
let fortuneSending=false;
async function sendFortune(drawLot=false){if(fortuneSending)return;const question=$("fortune-question").value.trim(),birthInfo=$("fortune-birth").value.trim(),hexagram=drawLot?drawHexagram():"";if(!question&&!hexagram){toast(language==="zh"?"请先写下想问的事情":"Please enter a question");$("fortune-question").focus();return;}fortuneSending=true;const ask=$("fortune-ask"),draw=$("fortune-draw");ask.disabled=draw.disabled=true;const prompt=(question||"请解读本次卦象")+(hexagram?"\n[本次起卦]\n"+hexagram:"")+(birthInfo?"\n[出生资料]\n"+birthInfo:"");appendFortuneMessage("user",prompt);try{const result=await network.askFortune(question,birthInfo,hexagram,fortuneHistory.slice(-6),language);if(!result?.answer)throw new Error(result?.error||"命理模型暂时无法回应");fortuneHistory.push({role:"user",content:prompt},{role:"assistant",content:result.answer});while(fortuneHistory.length>12)fortuneHistory.splice(0,2);appendFortuneMessage("assistant",result.answer);}catch(error){appendFortuneMessage("assistant",String(error?.message||"暂时无法连接命理模型，请稍后再试。"));}finally{fortuneSending=false;ask.disabled=draw.disabled=false;}}
$("fortune-ask").addEventListener("click",()=>void sendFortune(false));$("fortune-draw").addEventListener("click",()=>void sendFortune(true));
$("fortune-question").addEventListener("keydown",e=>{if((e.key==="Enter"||e.keyCode===13)&&!e.shiftKey&&!e.isComposing){e.preventDefault();void sendFortune(false);}});
$("open-abbot").addEventListener("click",async()=>{
  $("abbot-modal").classList.remove("hidden");
  if(!touchAudioGate)$("abbot-input").focus();
  const status=$("abbot-status");status.textContent=t().abbotChecking;
  try{
   const health=await network.health();
   status.textContent=health.aiEnabled?t().abbotFoot:t().abbotNotConfigured;
  }catch{status.textContent=t().abbotHealthUnavailable;}
 });
function trimAbbotHistory(){while(abbotHistory.length>24)abbotHistory.splice(0,2);}
function appendAbbotMessage(role,content){
 const box=$("abbot-messages"),line=document.createElement("div");
 line.className="abbot-message "+(role==="user"?"user":"assistant");
 line.textContent=String(content||"").slice(0,1600);box.append(line);
 while(box.children.length>24)box.children[1]?.remove();
 box.scrollTop=box.scrollHeight;
}
// Enter sends the abbot message; Shift+Enter inserts a line break. Ignore IME confirmation.
 let abbotSending=false,lastAbbotSubmitAt=0;
async function sendAbbotMessage(){
 if(abbotSending||Date.now()-lastAbbotSubmitAt<450)return;
 lastAbbotSubmitAt=Date.now();
 const input=$("abbot-input"),message=input.value.trim();if(!message)return;
 const submit=$("abbot-send"),status=$("abbot-status");abbotSending=true;submit.disabled=true;status.textContent=t().abbotThinking;
 input.value="";
 appendAbbotMessage("user",message);
 try{
  const result=await network.askAbbot(message,abbotHistory.slice(-8),language,$("location-title").textContent);
  if(!result?.answer)throw new Error(result?.error||t().abbotUnavailable);
  abbotHistory.push({role:"user",content:message},{role:"assistant",content:result.answer});trimAbbotHistory();
  appendAbbotMessage("assistant",result.answer);status.textContent=t().abbotFoot;
 }catch(error){
  input.value=message;
  const detail=String(error?.message||t().abbotUnavailable);
  status.textContent=detail;appendAbbotMessage("assistant",detail);
 }
 finally{abbotSending=false;submit.disabled=false;if(!touchAudioGate)input.focus();}
}
$("abbot-input").addEventListener("keydown",e=>{
 if((e.key!=="Enter"&&e.keyCode!==13)||e.shiftKey||e.isComposing||e.keyCode===229)return;
 e.preventDefault();e.stopPropagation();if(!$("abbot-send").disabled)$("abbot-send").click();
},true);
$("abbot-send").addEventListener("click",e=>{e.preventDefault();void sendAbbotMessage();});
$("abbot-send").addEventListener("pointerup",e=>{if(e.pointerType==="touch"&&e.cancelable){e.preventDefault();void sendAbbotMessage();}});
$("abbot-form").addEventListener("submit",e=>{e.preventDefault();void sendAbbotMessage();});
$("prayer-input").addEventListener("input",()=>{const chars=[...$("prayer-input").value];if(chars.length>20)$("prayer-input").value=chars.slice(0,20).join("");});
let prayerSending=false;
async function submitPrayer(e){
 e?.preventDefault();
 if(prayerSending)return;
 const input=$("prayer-input"),message=Array.from(input.value.trim()).slice(0,20).join("");
 if(!message){toast("请先写下一句心愿");input.focus({preventScroll:true});return;}
 prayerSending=true;
 const submit=$("prayer-submit"),form=$("prayer-form");
 submit.disabled=true;form.setAttribute("aria-busy","true");
 try{
  const saved=await network.postPrayer(message,language,profile?.name||"行者");
  if(!saved?.ok||!saved?.prayer)throw new Error(saved?.error||"心愿没有成功保存，请稍后重试");
  input.value="";
  toast(t().prayerSuccess);
  syncPrayerBoard([saved.prayer,...sharedPrayers.filter(p=>p.id!==saved.prayer.id)].slice(0,30));
  renderPrayerAppend(saved.prayer);
  await updateStats();
 }catch(error){
  const detail=String(error?.message||"心愿没有成功保存，请检查网络后重试");
  toast(detail.includes("pause")?t().prayerRate:detail);
 }finally{
  prayerSending=false;submit.disabled=false;form.removeAttribute("aria-busy");
 }
}
$("prayer-form").addEventListener("submit",submitPrayer);
$("prayer-submit").type="submit";

// Keyboard and mobile thumbstick controls
const movementCodes={KeyW:"w",KeyA:"a",KeyS:"s",KeyD:"d",ArrowUp:"arrowup",ArrowDown:"arrowdown",ArrowLeft:"arrowleft",ArrowRight:"arrowright",Space:"jump"};
document.addEventListener("keydown",e=>{
 if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
 if(e.code==="Digit2"){e.preventDefault();openBeads();return;}
 const key=movementCodes[e.code]||e.key.toLowerCase();
 if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","jump"," "].includes(key)){e.preventDefault();if(key==="jump"||key===" ")world.requestJump();keys[key]=true;}
},true);
document.addEventListener("keyup",e=>{const key=movementCodes[e.code]||e.key.toLowerCase();keys[key]=false;},true);
document.addEventListener("visibilitychange",()=>{
 if(document.hidden){keys={};resetStick();}
 else if(soundEnabled&&audio?.state==="suspended")audio.resume().then(()=>updateSoundscape()).catch(error=>{console.warn("Audio resume failed",error);});
});
const stick=$("joystick"),knob=$("joystick-knob");
let lastCenterTap=0;
function updateStick(e){
 const r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),radius=Math.min(r.width,r.height)/2,length=Math.hypot(dx,dy),factor=Math.min(1,Math.max(0,radius*.68)/(length||1));
 joy={x:dx*factor/(radius*.68),y:dy*factor/(radius*.68)};knob.style.transform="translate("+dx*factor+"px,"+dy*factor+"px)";
}
stick.addEventListener("pointerdown",e=>{
 e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);
 const r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),centerTap=Math.hypot(dx,dy)<=Math.min(r.width,r.height)*.14,now=performance.now();
 if(centerTap){if(now-lastCenterTap>0&&now-lastCenterTap<=360){world.requestJump();lastCenterTap=0;}else lastCenterTap=now;}else lastCenterTap=0;
 updateStick(e);
});
stick.addEventListener("pointermove",e=>{if(stickPointer===e.pointerId)updateStick(e);});
function resetStick(){stickPointer=null;joy={x:0,y:0};knob.style.transform="translate(0,0)";}
stick.addEventListener("pointerup",resetStick);stick.addEventListener("pointercancel",resetStick);stick.addEventListener("lostpointercapture",resetStick);
addEventListener("blur",()=>{keys={};resetStick();});
function initMobilePanels(){
 const mobile=window.matchMedia("(max-width: 660px)");
 const entries=[["location-card","location-panel-toggle"],["presence-card","presence-panel-toggle"]];
 const apply=()=>{
  for(const [cardId,buttonId] of entries){
   const card=$(cardId),button=$(buttonId);if(!card||!button)continue;
   card.classList.toggle("collapsed",mobile.matches);
   button.setAttribute("aria-expanded",String(!mobile.matches));
  }
 };
 for(const [cardId,buttonId] of entries){
  const card=$(cardId),button=$(buttonId);if(!card||!button)continue;
  button.addEventListener("click",()=>{
   const collapsed=card.classList.toggle("collapsed");
   button.setAttribute("aria-expanded",String(!collapsed));
  });
 }
 apply();mobile.addEventListener?.("change",apply);
}
initMobilePanels();
const renderModeLabels={
 zh:{normal:"流畅模式",restore:"恢复画质",normalTitle:"3D分辨率降低约一半，并精简光照、粒子和动画，约24FPS",restoreTitle:"恢复标准渲染分辨率和场景细节",enabled:"已开启低负载流畅模式",restored:"已恢复标准画质"},
 en:{normal:"Performance",restore:"Restore",normalTitle:"Lower render resolution and target 30 FPS on phones",restoreTitle:"Restore standard render resolution",enabled:"Performance mode enabled",restored:"Standard quality restored"},
 ja:{normal:"軽量モード",restore:"画質復元",normalTitle:"3D解像度を約半分にし、光源・粒子・アニメーションを削減して約24FPSに",restoreTitle:"標準の描画解像度とシーン表示に戻す",enabled:"低負荷モードを有効にしました",restored:"標準画質に戻しました"},
 ko:{normal:"저부하 모드",restore:"화질 복원",normalTitle:"3D 해상도를 절반으로 낮추고 조명·입자·애니메이션을 줄여 약 24FPS로",restoreTitle:"표준 렌더링 해상도와 장면 표시로 복원",enabled:"저부하 모드가 켜졌습니다",restored:"표준 화질로 복원했습니다"},
 th:{normal:"โหมดลื่นไหล",restore:"คืนคุณภาพ",normalTitle:"ลดความละเอียด 3D ลงครึ่งหนึ่ง พร้อมลดแสง อนุภาค และแอนิเมชันเหลือประมาณ 24 FPS",restoreTitle:"คืนความละเอียดและรายละเอียดฉากมาตรฐาน",enabled:"เปิดโหมดประสิทธิภาพแล้ว",restored:"คืนคุณภาพมาตรฐานแล้ว"}
};
function syncSmoothToggle(){
 const button=$("smooth-toggle");if(!button)return;
 const labels=renderModeLabels[language]||renderModeLabels.zh;
 button.classList.toggle("active",world.smoothMode);
 button.setAttribute("aria-pressed",String(world.smoothMode));
 button.setAttribute("aria-label",world.smoothMode?labels.restore:labels.normal);
 button.textContent=world.smoothMode?labels.restore:labels.normal;
 button.title=world.smoothMode?labels.restoreTitle:labels.normalTitle;
}
world.setSmoothMode(savedSmoothMode);
$("smooth-toggle").addEventListener("click",()=>{
 const enabled=!world.smoothMode;
 world.setSmoothMode(enabled);
 try{localStorage.setItem("temple-render-mode",enabled?"smooth":"standard");}catch{}
 syncSmoothToggle();
 const labels=renderModeLabels[language]||renderModeLabels.zh;
 toast(enabled?labels.enabled+" · "+world.renderer.getPixelRatio().toFixed(2)+"×":labels.restored);
});
syncSmoothToggle();
$("sound-toggle").addEventListener("click",()=>{void setSound(!soundEnabled);});
$("profile-sound-toggle").addEventListener("click",()=>{void setSound(!soundEnabled);});
function inputState(){
 return {
  forward:keys.w||keys.arrowup?1:0,backward:keys.s||keys.arrowdown?1:0,
  left:keys.a||keys.arrowleft?1:0,right:keys.d||keys.arrowright?1:0,
  run:!!keys.shift,joyX:joy.x,joyY:-joy.y,jump:!!keys.jump||!!keys[" "]
 };
}
function frame(){
 const dt=Math.min(world.clock.getDelta(),.18),now=performance.now();
 const renderFrame=!world.mobile||now-lastMobileRender>=(world.smoothMode?1000/30:25);
 if(renderFrame)lastMobileRender=now;
 world.update(dt,inputState(),now,renderFrame);updateLocation();updateSoundscape();if(soundEnabled&&world.lastMovement?.moving&&!world.lastMovement?.blocked&&now-lastFootstep>480){playFootstep();lastFootstep=now;}
 if(profile){
  const p=world.getPosition(),previous=lastSentNetworkPosition;
  const angleDelta=previous?Math.atan2(Math.sin(p.rotation-previous.rotation),Math.cos(p.rotation-previous.rotation)):Math.PI;
  const moved=!previous||Math.hypot(p.x-previous.x,p.z-previous.z)>.085||Math.abs(angleDelta)>.07;
  if((moved&&now-lastPositionSend>120)||now-lastPositionSend>1600){
   network.move(p);lastPositionSend=now;lastSentNetworkPosition={x:p.x,z:p.z,rotation:p.rotation};
  }
 }
 const p=world.getPosition(),nearPrayerWall=Math.abs(p.x+31)<3.7&&p.z>-46&&p.z<19;
 if(nearPrayerWall&&!prayerWallPromptOpen){prayerWallPromptOpen=true;$("prayer-modal").classList.remove("hidden");void loadPrayers();}
 else if(!nearPrayerWall)prayerWallPromptOpen=false;
 syncWanderButton();
 if(world.gardenActive){const gardenText=world.gardenPauseUntil>0?(t().gardenWorking||"正在浇水施肥"):(t().walkingToGarden||t().walk);if($("character-state").textContent!==gardenText)text("character-state",gardenText);}
 else if(world.wanderActive){if($("character-state").textContent!==t().wanderState)text("character-state",t().wanderState||"闲逛中");}
 else if(now>actionUntil){text("character-state",t().walk);}
 requestAnimationFrame(frame);
}
async function start(){
  // Render the already-built local world immediately. Network services must never
  // hold the full-screen loading gate on a cold mobile connection.
  applyLanguage();
  $("loading").classList.add("hidden");
  requestAnimationFrame(frame);
  if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js?v=20261116-r17",{updateViaCache:"none"}).catch(()=>{});}
  armDefaultSoundGesture();
  // Attempt sound immediately on every device. Browsers that block autoplay (notably iOS)
  // are retried on the first genuine touch, click, or key gesture by armDefaultSoundGesture.
  void setSound(true,{quiet:true,save:true});

  // These requests are independent and deliberately non-blocking.
  void network.health().catch(()=>{});
  void network.visit().catch(()=>{});
  void updateStats();
  setInterval(updateStats,30000);
  // Keep the physical wall synchronized for every visitor, even while its dialog is closed.
  void loadPrayers();setInterval(()=>{void loadPrayers();},12000);

  // Profile lookup can take a while on mobile; keep the 3D world interactive.
  await loadProfile();
  if(profile){void network.saveProfile(profile,language).catch(()=>{});}
  toast(t().entered);
}
addEventListener("beforeunload",()=>network.close());
function updateTempleVisualViewport(){
 const viewport=window.visualViewport,root=document.documentElement;
 let queued=false;
 const apply=()=>{
  queued=false;
  const height=Math.max(1,Math.round(viewport?.height||root.clientHeight||window.innerHeight));
  const width=Math.max(1,Math.round(viewport?.width||root.clientWidth||window.innerWidth));
  const top=Math.max(0,Math.round(viewport?.offsetTop||0));
  root.style.setProperty("--temple-visual-height",height+"px");
  root.style.setProperty("--temple-visual-width",width+"px");
  root.style.setProperty("--temple-visual-top",top+"px");
  root.style.setProperty("--temple-visual-bottom",Math.max(0,Math.round(window.innerHeight-height-top))+"px");
  world.resize();
  if(!$("beads-modal").classList.contains("hidden"))renderBeads();
 };
 const schedule=()=>{
  if(queued)return;
  queued=true;requestAnimationFrame(apply);
 };
 apply();
 viewport?.addEventListener("resize",schedule,{passive:true});
 viewport?.addEventListener("scroll",schedule,{passive:true});
 addEventListener("resize",schedule,{passive:true});
 addEventListener("orientationchange",schedule,{passive:true});
 addEventListener("pageshow",schedule,{passive:true});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)schedule();});
 // Safari changes the visual viewport independently when its address bar expands,
 // collapses, or the device rotates. Re-measure after those browser UI transitions.
}
updateTempleVisualViewport();

// Mobile Safari/Chrome compact their address bar after a genuine document scroll.
let mobileSwipeStartY=null,mobileSwipeCollapseDone=false;
document.addEventListener("touchstart",event=>{
 if(!touchAudioGate||event.touches.length!==1){mobileSwipeStartY=null;return;}
 if(event.target.closest?.("button,input,textarea,select,.joystick,.action-dock,.modal-card,.chat-panel")){mobileSwipeStartY=null;return;}
 mobileSwipeStartY=event.touches[0].clientY;
},{passive:true,capture:true});
document.addEventListener("touchmove",event=>{
 if(!touchAudioGate||mobileSwipeCollapseDone||event.touches.length!==1||mobileSwipeStartY===null)return;
 if(mobileSwipeStartY-event.touches[0].clientY>18){
  const root=document.documentElement,maxScroll=Math.max(0,root.scrollHeight-root.clientHeight);
  if(maxScroll>0){const target=Math.min(maxScroll,100);root.scrollTop=Math.max(root.scrollTop,target);window.scrollTo(0,root.scrollTop);mobileSwipeCollapseDone=root.scrollTop>0;}
 }
},{passive:true,capture:true});
document.addEventListener("touchend",event=>{if(event.touches.length===0)mobileSwipeStartY=null;},{passive:true,capture:true});
function armDefaultSoundGesture(){
 if(!soundPreference||soundEnabled)return;
 const events=["pointerdown","touchstart","keydown"];
 const activate=event=>{
  for(const type of events)document.removeEventListener(type,activate,true);
  if(event?.target?.closest?.("#sound-toggle,#profile-sound-toggle"))return;
  if(soundPreference&&!soundEnabled)void setSound(true,{quiet:false,save:false});
 };
 for(const type of events)document.addEventListener(type,activate,{once:true,capture:true});
}
start();

