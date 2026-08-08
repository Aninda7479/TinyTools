pub const CHAT_HTML: &str = r####"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TinyTools — E2EE Local Chat</title>
<style>
:root{--bg:#0f0f0f;--surface:rgba(255,255,255,.05);--border:rgba(255,255,255,.1);--accent:#60a5fa;--text:#fff;--muted:rgba(255,255,255,.4);--green:#4ade80;--red:#f87171}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text)}
button{font-family:inherit}
input,textarea{font-family:inherit}
svg{display:block}
#gate{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:1.5rem;overflow-y:auto}
.gate-card{width:100%;max-width:380px;background:var(--surface);border:1px solid var(--border);border-radius:1.5rem;padding:2rem}
.gate-logo{width:56px;height:56px;border-radius:1rem;background:rgba(96,165,250,.12);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem}
.gate-logo svg{width:28px;height:28px;color:var(--accent)}
h1{font-size:1.25rem;text-align:center;font-weight:600}
.subtitle{color:var(--muted);font-size:.8rem;text-align:center;margin:.4rem 0 1.2rem}
.lock-badge{display:flex;align-items:center;justify-content:center;gap:.4rem;color:var(--green);font-size:.72rem;margin-bottom:1.2rem}
.field{margin-bottom:.9rem}
.field label{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.4rem}
.field input{width:100%;padding:.7rem .9rem;border-radius:.8rem;border:1px solid var(--border);background:rgba(255,255,255,.05);color:#fff;font-size:.875rem;outline:none;transition:border-color .2s}
.field input:focus{border-color:rgba(96,165,250,.5)}
.btn{width:100%;padding:.75rem;border-radius:.8rem;border:1px solid var(--border);font-size:.875rem;font-weight:500;cursor:pointer;transition:opacity .2s,background .2s}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-primary{background:rgba(96,165,250,.2);color:var(--accent);border-color:rgba(96,165,250,.3)}
.btn-primary:hover:not(:disabled){background:rgba(96,165,250,.3)}
.error{color:var(--red);font-size:.78rem;margin-top:.75rem;display:none;text-align:center}
.hint{color:rgba(255,255,255,.3);font-size:.72rem;text-align:center;margin-top:1.1rem;line-height:1.5}
#chat{display:none;position:fixed;inset:0;flex-direction:column}
.chat-header{display:flex;align-items:center;gap:.8rem;padding:.8rem 1.1rem;border-bottom:1px solid var(--border);background:rgba(20,20,20,.7);backdrop-filter:blur(10px)}
.chat-header .title{font-size:.95rem;font-weight:600;white-space:nowrap}
.chat-header .meta{font-size:.7rem;color:var(--muted);white-space:nowrap}
.chat-header .spacer{flex:1}
.pill{display:inline-flex;align-items:center;gap:.35rem;font-size:.7rem;padding:.28rem .7rem;border-radius:999px;border:1px solid rgba(74,222,128,.3);background:rgba(74,222,128,.08);color:var(--green);white-space:nowrap}
.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--muted);font-size:.75rem;padding:.4rem .8rem;border-radius:.7rem;cursor:pointer;white-space:nowrap}
.btn-ghost:hover{color:#fff;border-color:rgba(255,255,255,.25)}
.ephemeral{text-align:center;font-size:.68rem;color:rgba(250,204,21,.75);background:rgba(250,204,21,.06);border-bottom:1px solid rgba(250,204,21,.15);padding:.35rem .8rem}
.chat-body{flex:1;display:flex;min-height:0}
.chat-main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.roster{width:210px;border-right:1px solid var(--border);padding:1rem .9rem;overflow-y:auto}
.roster h3{font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:.8rem}
.roster .member{display:flex;align-items:center;gap:.5rem;padding:.4rem .5rem;border-radius:.6rem;font-size:.8rem}
.roster .member .dot{width:7px;height:7px;border-radius:50%;background:var(--green);flex-shrink:0}
.roster .member .name{color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.messages{flex:1;overflow-y:auto;padding:1.2rem 1.4rem;display:flex;flex-direction:column;gap:.6rem}
.sys-notice{align-self:center;font-size:.68rem;color:var(--muted);background:var(--surface);border:1px solid var(--border);padding:.25rem .9rem;border-radius:999px;margin:.2rem 0}
.msg{display:flex;flex-direction:column;max-width:72%}
.msg.own{align-self:flex-end;align-items:flex-end}
.msg.other{align-self:flex-start;align-items:flex-start}
.msg .row{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.15rem}
.msg .sender{font-size:.7rem;font-weight:600;color:var(--accent)}
.msg.own .sender{color:rgba(255,255,255,.5)}
.msg .time{font-size:.62rem;color:rgba(255,255,255,.3)}
.bubble{padding:.6rem .9rem;border-radius:1rem;font-size:.875rem;line-height:1.45;word-break:break-word;white-space:pre-wrap}
.msg.other .bubble{background:rgba(255,255,255,.07);border:1px solid var(--border);border-top-left-radius:.25rem}
.msg.own .bubble{background:rgba(96,165,250,.16);border:1px solid rgba(96,165,250,.25);border-top-right-radius:.25rem}
.msg .img-wrap{border-radius:.9rem;overflow:hidden;border:1px solid var(--border);max-width:320px;background:rgba(255,255,255,.03);cursor:zoom-in}
.msg img{display:block;max-width:100%;max-height:280px;object-fit:contain}
.file-card{display:flex;align-items:center;gap:.7rem;padding:.7rem .9rem;border-radius:.9rem;background:rgba(255,255,255,.06);border:1px solid var(--border);min-width:230px;max-width:340px}
.file-card .fic{width:38px;height:38px;border-radius:.6rem;background:rgba(96,165,250,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.file-card .fic svg{width:18px;height:18px;color:var(--accent)}
.file-card .meta{flex:1;min-width:0}
.file-card .fname{font-size:.78rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.file-card .fsize{font-size:.66rem;color:var(--muted)}
.file-card .dbtn{background:rgba(74,222,128,.15);color:var(--green);border:1px solid rgba(74,222,128,.3);font-size:.7rem;padding:.38rem .75rem;border-radius:.6rem;cursor:pointer;flex-shrink:0}
.file-card .dbtn.loading{opacity:.55;cursor:wait}
.composer{border-top:1px solid var(--border);padding:.8rem 1.1rem;background:rgba(20,20,20,.7);backdrop-filter:blur(10px)}
.pending{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.6rem}
.pending .pchip{display:flex;align-items:center;gap:.45rem;font-size:.72rem;background:var(--surface);border:1px solid var(--border);padding:.3rem .7rem;border-radius:.7rem;color:rgba(255,255,255,.8)}
.pending .pchip .x{color:var(--muted);cursor:pointer;font-size:.8rem}
.composer-row{display:flex;align-items:flex-end;gap:.6rem}
.composer textarea{flex:1;resize:none;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:.9rem;color:#fff;font-size:.875rem;padding:.65rem .9rem;outline:none;max-height:120px;line-height:1.4;transition:border-color .2s}
.composer textarea:focus{border-color:rgba(96,165,250,.5)}
.btn-attach{background:transparent;border:1px solid var(--border);color:var(--muted);width:42px;height:42px;border-radius:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:color .2s,border-color .2s}
.btn-attach:hover{color:#fff;border-color:rgba(255,255,255,.25)}
.btn-send{background:rgba(96,165,250,.2);color:var(--accent);border:1px solid rgba(96,165,250,.3);width:42px;height:42px;border-radius:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s}
.btn-send:hover{background:rgba(96,165,250,.3)}
.composer-hint{font-size:.62rem;color:rgba(255,255,255,.25);margin-top:.5rem;text-align:center}
.roster .member .name{flex:1;min-width:0}
#callPanel{display:none;width:420px;max-width:46%;flex-direction:column;min-height:0;position:relative;border-left:1px solid var(--border);background:rgba(12,12,12,.8)}
#callPanel.active{display:flex}
.call-panel-head{display:flex;align-items:center;gap:.5rem;padding:.7rem .9rem;border-bottom:1px solid var(--border)}
.call-panel-head .t{font-size:.78rem;font-weight:600;color:rgba(255,255,255,.9)}
.call-panel-head .p{font-size:.72rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.call-panel-body{flex:1;position:relative;min-height:0}
#remoteVideos{position:absolute;inset:0;display:flex;flex-direction:column;gap:.6rem;padding:.7rem;overflow-y:auto;box-sizing:border-box}
.remote-cell{position:relative;border-radius:.9rem;overflow:hidden;border:1px solid var(--border);background:#000;flex-shrink:0;aspect-ratio:16/9}
.remote-cell video{width:100%;height:100%;object-fit:cover}
.remote-name{position:absolute;bottom:6px;left:8px;font-size:.62rem;color:#fff;background:rgba(0,0,0,.55);padding:.12rem .5rem;border-radius:.4rem;z-index:2}
#callLocalWrap{position:absolute;top:10px;right:10px;width:150px;height:112px;border-radius:.8rem;overflow:hidden;border:1px solid rgba(255,255,255,.2);z-index:2;background:#111;box-shadow:0 6px 18px rgba(0,0,0,.5)}
#localVideo{width:100%;height:100%;object-fit:cover}
#callStatus{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,.75);font-size:.85rem;text-align:center;z-index:3;pointer-events:none;max-width:90%}
.call-controls{display:flex;gap:.8rem;justify-content:center;align-items:center;padding:.8rem;border-top:1px solid var(--border)}
.call-controls button{width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
.call-controls button:hover{background:rgba(255,255,255,.18)}
.call-controls button.danger{background:rgba(248,113,113,.85);border-color:transparent}
.call-controls button.danger:hover{background:rgba(248,113,113,1)}
.call-controls button.off{background:rgba(248,113,113,.7);border-color:transparent}
#joinBar{display:none;position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:80;align-items:center;gap:.8rem;background:rgba(96,165,250,.16);border:1px solid rgba(96,165,250,.45);color:#fff;font-size:.82rem;padding:.5rem .6rem .5rem .95rem;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
#joinBar button{background:rgba(96,165,250,.35);color:#fff;border:1px solid rgba(96,165,250,.55);padding:.35rem .95rem;border-radius:999px;font-size:.75rem;font-weight:500;cursor:pointer}
#joinBar button:hover{background:rgba(96,165,250,.5)}
@media(max-width:719px){.roster{display:none}.msg{max-width:88%}}
</style>
</head>
<body>

<div id="gate">
  <div class="gate-card">
    <div class="gate-logo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
    <h1>E2EE Local Chat</h1>
    <p class="subtitle">Encrypted room on your local network</p>
    <div class="lock-badge"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> End-to-end encrypted · nothing is stored</div>
    <div class="field">
      <label>Room password</label>
      <input type="password" id="password" placeholder="Enter the room password" autocomplete="off">
    </div>
    <div class="field">
      <label>Your name</label>
      <input type="text" id="name" placeholder="Display name" maxlength="24" autocomplete="off">
    </div>
    <button class="btn btn-primary" id="joinBtn" onclick="join()">Join room</button>
    <div class="error" id="gateError"></div>
    <p class="hint">Messages are encrypted in your browser before leaving your device. The host relays ciphertext only — nothing is saved anywhere.</p>
  </div>
</div>

<div id="chat">
  <div class="chat-header">
    <div class="title">E2EE Local Chat</div>
    <div class="meta" id="memberCount"></div>
    <div class="spacer"></div>
    <span class="pill"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> E2EE</span>
    <button class="btn-ghost" id="videoCallBtn" onclick="onVideoCallBtn()" title="Video call with the whole room">
      <svg id="videoCallIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px;margin-right:5px"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg><span id="videoCallLabel">Start Video Call</span>
    </button>
    <button class="btn-ghost" onclick="leave()">Leave</button>
  </div>
  <div class="ephemeral">Ephemeral chat — messages and files are never stored. Closing the room erases everything.</div>
  <div id="joinBar">
    <span id="joinBarText"></span>
    <button id="joinBarBtn" onclick="joinCall()">Join</button>
  </div>
  <div class="chat-body">
    <div class="roster">
      <h3 id="rosterTitle">Members</h3>
      <div id="rosterList"></div>
    </div>
    <div class="chat-main">
      <div class="messages" id="messages"></div>
      <div class="composer">
        <div class="pending" id="pending"></div>
        <div class="composer-row">
          <button class="btn-attach" onclick="document.getElementById('fileInput').click()" title="Attach file">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <textarea id="input" placeholder="Type a message... (Enter to send)" rows="1"></textarea>
          <button class="btn-send" onclick="send()" title="Send">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
        <div class="composer-hint">Drag &amp; drop or paste images / files to share · files relayed in memory and auto-expire</div>
      </div>
    </div>
    <div id="callPanel">
      <div class="call-panel-head">
        <span class="t">Video Call</span>
        <span class="p" id="callParticipantCount"></span>
      </div>
      <div class="call-panel-body">
        <div id="remoteVideos"></div>
        <div id="callLocalWrap"><video id="localVideo" autoplay muted playsinline></video></div>
        <div id="callStatus"></div>
      </div>
      <div class="call-controls">
        <button id="btnMute" onclick="toggleMute()" title="Mute microphone">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
        </button>
        <button id="btnCam" onclick="toggleCam()" title="Turn camera off">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
        </button>
        <button class="danger" onclick="leaveCall()" title="Leave the video call">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>

<input type="file" id="fileInput" multiple style="display:none" onchange="onFilesSelected()">

<script>
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var key=null, salt=null, clientId=null, token=null, myName=null, ws=null;
var heartbeatTimer=null, reconnectTimer=null, joining=false;
var members=new Map();
var filesCache=new Map();
var pendingFiles=[];
var pcList={}, localStream=null, callMembers={}, inCall=false, callActive=false, micMuted=false, camOff=false;

function b64(u8){var c=new Uint8Array(u8),s='';for(var i=0;i<c.length;i+=0x8000){s+=String.fromCharCode.apply(null,c.subarray(i,i+0x8000));}return btoa(s);}
function fromB64(s){var bin=atob(s),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++){u[i]=bin.charCodeAt(i);}return u;}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtSize(b){if(b<1024){return b+' B';}if(b<1048576){return (b/1024).toFixed(1)+' KB';}if(b<1073741824){return (b/1048576).toFixed(1)+' MB';}return (b/1073741824).toFixed(2)+' GB';}
function fmtTime(t){var d=new Date(t*1000);return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function scrollBottom(){var el=$('messages');if(el){el.scrollTop=el.scrollHeight;}}

function deriveKey(password){
  return crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']).then(function(km){
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:fromB64(salt),iterations:310000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  });
}
function encText(t){var n=crypto.getRandomValues(new Uint8Array(12));return crypto.subtle.encrypt({name:'AES-GCM',iv:n},key,new TextEncoder().encode(t)).then(function(ct){return{n:b64(n),c:b64(ct)};});}
function decText(n,c){return crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(n)},key,fromB64(c)).then(function(pt){return new TextDecoder().decode(pt);});}
function encBytes(data){var n=crypto.getRandomValues(new Uint8Array(12));return crypto.subtle.encrypt({name:'AES-GCM',iv:n},key,data).then(function(ct){return{n:b64(n),c:new Uint8Array(ct)};});}
function decBytes(n,c){return crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(n)},key,c);}

function showError(t){var e=$('gateError');e.textContent=t;e.style.display='block';}
function hideError(){$('gateError').style.display='none';}

function join(){
  if(joining){return;}
  var password=$('password').value;
  var name=$('name').value.trim();
  if(!password){showError('Enter the room password');return;}
  if(!name){showError('Enter your display name');return;}
  joining=true;$('joinBtn').disabled=true;hideError();
  fetch('/api/chat/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password,name:name})})
    .then(function(r){return r.json().catch(function(){return{};}).then(function(data){return{ok:r.ok,data:data};});})
    .then(function(res){
      if(!res.ok){throw new Error(res.data.error||'Failed to join room');}
      salt=res.data.salt;token=res.data.send_token;clientId=res.data.client_id;myName=name;
      return deriveKey(password).then(function(k){key=k;return res.data.members||[];});
    })
    .then(function(list){
      members=new Map(list.map(function(m){return[m.id,m.name];}));
      renderRoster();
      $('gate').style.display='none';
      $('chat').style.display='flex';
      connectWS();
    })
    .catch(function(e){
      showError(e.message||'Failed to join');
      joining=false;$('joinBtn').disabled=false;
    });
}

function connectWS(){
  var proto=location.protocol==='https:'?'wss://':'ws://';
  var socket=new WebSocket(proto+location.host+'/api/chat/ws?token='+encodeURIComponent(token));
  ws=socket;
  socket.onopen=function(){
    heartbeatTimer=setInterval(function(){if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'pong'}));}},25000);
  };
  socket.onmessage=function(ev){
    var m;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(m.type==='welcome'){
      if(m.client_id){clientId=m.client_id;}
      if(Array.isArray(m.members)){members=new Map(m.members.map(function(x){return[x.id,x.name];}));renderRoster();}
      if(Array.isArray(m.call_members)){handleCallState(m.call_members);}
      systemNotice('You joined as '+esc(myName));
      updateCallButton();
    }else if(m.type==='member'&&m.member){
      if(m.action==='join'){members.set(m.member.id,m.member.name);systemNotice(esc(m.member.name)+' joined');}
      else if(m.action==='leave'){members.delete(m.member.id);systemNotice(esc(m.member.name)+' left');}
      renderRoster();
    }else if(m.type==='msg'&&m.message){
      handleMessage(m.message);
    }else if(m.type==='signal'&&m.signal){
      handleSignal(m.client_id,m.name,m.signal);
    }else if(m.type==='call-state'&&Array.isArray(m.call_members)){
      handleCallState(m.call_members);
    }else if(m.type==='ping'){
      if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'pong'}));}
    }else if(m.type==='error'){
      systemNotice('Error: '+esc(m.text||''));
    }
  };
  socket.onclose=function(){
    clearInterval(heartbeatTimer);
    if(inCall){teardownCall();}
    if(!socket.manualClose){
      systemNotice('Connection lost — reconnecting...');
      scheduleReconnect();
    }
  };
  socket.onerror=function(){try{socket.close();}catch(e){} };
}

function scheduleReconnect(){
  clearTimeout(reconnectTimer);
  reconnectTimer=setTimeout(function(){connectWS();},1500);
}

function leave(){
  if(ws){ws.manualClose=true;try{ws.close();}catch(e){}}
  clearInterval(heartbeatTimer);clearTimeout(reconnectTimer);
  location.reload();
}

function handleMessage(m){
  var own=m.from&&m.from.id===clientId;
  if(m.kind==='text'){
    decText(m.nonce,m.ciphertext)
      .then(function(text){renderText(own,m.from.name,text,m.ts);})
      .catch(function(){renderText(own,m.from.name,'[unable to decrypt]',m.ts);});
  }else if(m.kind==='image'){
    var wrap=renderFileCard(own,m.from.name,m,'Downloading image...');
    downloadFile(m,wrap,true);
  }else if(m.kind==='file'){
    var wrap=renderFileCard(own,m.from.name,m,'Download');
    downloadFile(m,wrap,false);
  }
}

function renderText(own,sender,text,ts){
  var el=document.createElement('div');
  el.className='msg '+(own?'own':'other');
  el.innerHTML='<div class="row"><span class="sender">'+esc(sender)+'</span><span class="time">'+fmtTime(ts)+'</span></div><div class="bubble">'+esc(text)+'</div>';
  $('messages').appendChild(el);scrollBottom();
}

function renderFileCard(own,sender,m,btnLabel){
  var el=document.createElement('div');
  el.className='msg '+(own?'own':'other');
  var icon=m.kind==='image'||(m.mime||'').indexOf('image/')===0
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  el.innerHTML='<div class="row"><span class="sender">'+esc(sender)+'</span><span class="time">'+fmtTime(m.ts)+'</span></div><div class="file-card"><div class="fic">'+icon+'</div><div class="meta"><div class="fname">'+esc(m.file_name||'file')+'</div><div class="fsize">'+fmtSize(m.file_size||0)+'</div></div><button class="dbtn" id="btn-'+m.id+'">'+esc(btnLabel)+'</button></div>';
  $('messages').appendChild(el);scrollBottom();
  return el;
}

function downloadFile(m,wrap,isImage){
  var cached=filesCache.get(m.file_id);
  if(cached&&cached.data){
    showDownloaded(m,wrap,isImage,cached.data);
    return;
  }
  var btn=wrap.querySelector('.dbtn');
  if(btn){btn.textContent='Downloading...';btn.classList.add('loading');}
  fetch('/api/chat/files/'+encodeURIComponent(m.file_id),{headers:{'X-Chat-Token':token}})
    .then(function(resp){
      if(!resp.ok){throw new Error('Download failed');}
      return resp.arrayBuffer();
    })
    .then(function(buf){
      return decBytes(m.nonce,new Uint8Array(buf));
    })
    .then(function(data){
      filesCache.set(m.file_id,{data:data});
      showDownloaded(m,wrap,isImage,data);
    })
    .catch(function(e){
      var btn2=wrap.querySelector('.dbtn');
      if(btn2){btn2.textContent='Failed — tap to retry';btn2.classList.remove('loading');btn2.onclick=function(){downloadFile(m,wrap,isImage);};}
    });
}

function showDownloaded(m,wrap,isImage,data){
  var btn=wrap.querySelector('.dbtn');if(btn){btn.remove();}
  if(isImage){
    var blob=new Blob([data],{type:m.mime||'image/png'});
    var url=URL.createObjectURL(blob);
    var w=document.createElement('div');w.className='img-wrap';
    var img=document.createElement('img');
    img.src=url;img.alt=m.file_name||'image';
    img.onclick=function(){window.open(url,'_blank');};
    w.appendChild(img);wrap.appendChild(w);
  }else{
    var url=URL.createObjectURL(new Blob([data],{type:m.mime||'application/octet-stream'}));
    var d=document.createElement('button');
    d.className='dbtn';d.textContent='Save ('+fmtSize(data.length)+')';
    d.onclick=function(){var a=document.createElement('a');a.href=url;a.download=m.file_name||'file';document.body.appendChild(a);a.click();a.remove();};
    wrap.querySelector('.file-card').appendChild(d);
  }
  scrollBottom();
}

function systemNotice(text){
  var el=document.createElement('div');
  el.className='sys-notice';el.textContent=text;
  $('messages').appendChild(el);scrollBottom();
}

function renderRoster(){
  var list=$('rosterList');list.innerHTML='';
  members.forEach(function(name,id){
    var d=document.createElement('div');d.className='member';
    var dot=document.createElement('span');dot.className='dot';
    var n=document.createElement('span');n.className='name';n.textContent=name;
    d.appendChild(dot);d.appendChild(n);list.appendChild(d);
  });
  var c=members.size;
  $('memberCount').textContent=c+' member'+(c===1?'':'s')+' online';
  $('rosterTitle').textContent='Members ('+c+')';
}

function send(){
  if(!ws||ws.readyState!==1){systemNotice('Not connected');return;}
  var input=$('input');
  var text=input.value.trim();
  var hasText=text.length>0;
  if(!hasText&&pendingFiles.length===0){return;}
  if(hasText){
    encText(text).then(function(enc){
      ws.send(JSON.stringify({type:'msg',kind:'text',nonce:enc.n,ciphertext:enc.c}));
    });
    input.value='';input.style.height='auto';
  }
  var sending=[].concat(pendingFiles);
  pendingFiles=[];
  renderPending();
  sending.forEach(function(f){sendFile(f);});
  input.focus();
}

function sendFile(f){
  if(!ws||ws.readyState!==1){systemNotice('Not connected');return;}
  var nonce=null;
  f.file.arrayBuffer()
    .then(function(buf){return encBytes(new Uint8Array(buf));})
    .then(function(enc){
      nonce=enc.n;
      return fetch('/api/chat/files',{
        method:'POST',
        headers:{
          'X-Chat-Token':token,
          'X-Chat-Filename':encodeURIComponent(f.file.name),
          'X-Chat-FileSize':String(f.file.size),
          'X-Chat-Mime':f.file.type||'application/octet-stream'
        },
        body:enc.c
      });
    })
    .then(function(resp){
      if(!resp.ok){throw new Error('Upload failed');}
      return resp.json();
    })
    .then(function(data){
      var isImage=(f.file.type||'').indexOf('image/')===0;
      ws.send(JSON.stringify({
        type:'msg',
        kind:isImage?'image':'file',
        nonce:nonce,
        file_id:data.file_id,
        file_name:f.file.name,
        file_size:f.file.size,
        mime:f.file.type||'application/octet-stream'
      }));
    })
    .catch(function(e){systemNotice('Failed to send '+esc(f.file.name)+': '+esc(e.message||'error'));});
}

function onFilesSelected(){
  var input=$('fileInput');
  if(input.files.length){
    for(var i=0;i<input.files.length;i++){addPendingFile(input.files[i]);}
    renderPending();
  }
  input.value='';
}

function addPendingFile(file){
  if(file.size>52428800){systemNotice('Skipped '+esc(file.name)+' — max size is 50 MB');return;}
  pendingFiles.push({file:file});
}

function renderPending(){
  var box=$('pending');box.innerHTML='';
  pendingFiles.forEach(function(p,i){
    var chip=document.createElement('span');chip.className='pchip';
    chip.appendChild(document.createTextNode(p.file.name));
    var x=document.createElement('span');x.className='x';x.textContent='✕';
    x.onclick=function(){pendingFiles.splice(i,1);renderPending();};
    chip.appendChild(x);box.appendChild(chip);
  });
}

function attachFiles(fileList){
  for(var i=0;i<fileList.length;i++){addPendingFile(fileList[i]);}
  if(pendingFiles.length){renderPending();}
}

// ── Room-wide video call (WebRTC mesh, P2P media over the local network) ──
function wsSendSignal(to,signal){
  if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'signal',to:to,signal:signal}));}
}

function callMsg(action){
  if(ws&&ws.readyState===1){ws.send(JSON.stringify({type:'call',action:action}));}
}

function startMedia(){
  if(localStream){return Promise.resolve(localStream);}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){return Promise.reject(new Error('Camera/microphone are not available in this browser'));}
  return navigator.mediaDevices.getUserMedia({video:true,audio:true});
}

function onVideoCallBtn(){
  if(inCall){leaveCall();}
  else if(callActive){joinCall();}
  else{startCall();}
}

function updateCallButton(){
  var btn=$('videoCallBtn'), lbl=$('videoCallLabel');
  if(!btn){return;}
  if(inCall){lbl.textContent='Leave Call';btn.title='Leave the video call';}
  else if(callActive){lbl.textContent='Join Video Call';btn.title='Join the room video call';}
  else{lbl.textContent='Start Video Call';btn.title='Start a video call the whole room can join';}
}

function startCall(){
  if(inCall){return;}
  hideJoinBar();
  startMedia().then(function(stream){
    localStream=stream;
    inCall=true;callActive=true;
    $('localVideo').srcObject=stream;
    $('callPanel').classList.add('active');
    $('callStatus').textContent='Waiting for others to join...';
    $('callStatus').style.display='block';
    updateParticipantCount();
    updateCallButton();
    callMsg('join');
    systemNotice('Video call started — anyone in the room can join');
  }).catch(function(e){
    systemNotice('Could not start video call: '+esc(e.message||'error'));
  });
}

function joinCall(){
  if(inCall){return;}
  hideJoinBar();
  startMedia().then(function(stream){
    localStream=stream;
    inCall=true;callActive=true;
    $('localVideo').srcObject=stream;
    $('callPanel').classList.add('active');
    $('callStatus').textContent='Connecting...';
    $('callStatus').style.display='block';
    updateParticipantCount();
    updateCallButton();
    callMsg('join');
    systemNotice('You joined the video call');
  }).catch(function(e){
    systemNotice('Could not join video call: '+esc(e.message||'error'));
  });
}

function leaveCall(){
  if(!inCall){return;}
  callMsg('leave');
  teardownCall();
  updateCallButton();
}

function teardownCall(){
  inCall=false;
  Object.keys(pcList).forEach(function(id){closePeer(id);});
  if(localStream){localStream.getTracks().forEach(function(t){try{t.stop();}catch(e){}});}
  localStream=null;
  $('callPanel').classList.remove('active');
  $('localVideo').srcObject=null;
  $('callStatus').style.display='none';
  micMuted=false;camOff=false;
}

function handleCallState(memberList){
  var next={};
  memberList.forEach(function(x){next[x.id]=x.name;});
  callMembers=next;
  callActive=Object.keys(callMembers).length>0;
  if(!callActive){
    hideJoinBar();
    if(inCall){teardownCall();}
  }else if(inCall){
    hideJoinBar();
    Object.keys(callMembers).forEach(function(id){
      if(id===clientId)return;
      if(!pcList[id]){syncPeer(id,callMembers[id]);}
    });
    Object.keys(pcList).forEach(function(id){
      if(!callMembers[id]){closePeer(id);}
    });
  }else{
    showJoinBar();
  }
  updateCallButton();
  updateParticipantCount();
}

function showJoinBar(){
  var names=Object.keys(callMembers).map(function(id){return callMembers[id];});
  var text=names.length===1?(names[0]+' started a video call'):('A video call is in progress — '+names.length+' participant'+(names.length===1?'':'s'));
  $('joinBarText').textContent=text;
  $('joinBar').style.display='flex';
}

function hideJoinBar(){$('joinBar').style.display='none';}

function syncPeer(id,name){
  if(id===clientId||pcList[id])return;
  // Smaller client_id offers; the larger side waits for the offer.
  if(clientId<id){createOfferTo(id,name);}
}

function createPeer(id,name){
  var p=new RTCPeerConnection();
  localStream.getTracks().forEach(function(t){p.addTrack(t,localStream);});
  var cell=document.createElement('div');cell.className='remote-cell';cell.id='rcell-'+id;
  cell.innerHTML='<div class="remote-name">'+esc(name)+'</div><video id="rvideo-'+id+'" autoplay playsinline></video>';
  $('remoteVideos').appendChild(cell);
  p.onicecandidate=function(ev){
    if(ev.candidate){wsSendSignal(id,{kind:'ice',candidate:ev.candidate});}
  };
  p.ontrack=function(ev){
    var v=$('rvideo-'+id);
    if(v&&ev.streams&&ev.streams[0]){v.srcObject=ev.streams[0];}
    $('callStatus').style.display='none';
  };
  p.onconnectionstatechange=function(){
    if(p.connectionState==='disconnected'||p.connectionState==='failed'||p.connectionState==='closed'){
      closePeer(id);
    }
  };
  pcList[id]={pc:p,name:name};
  updateParticipantCount();
  return pcList[id];
}

function closePeer(id){
  var p=pcList[id];
  if(p){try{p.pc.close();}catch(e){}}
  delete pcList[id];
  var c=$('rcell-'+id);if(c){c.remove();}
  updateParticipantCount();
}

function createOfferTo(id,name){
  if(pcList[id])return;
  var p=createPeer(id,name);
  p.pc.createOffer().then(function(o){
    return p.pc.setLocalDescription(o);
  }).then(function(){
    wsSendSignal(id,{kind:'offer',offer:p.pc.localDescription});
  }).catch(function(){closePeer(id);});
}

function handleSignal(fromId,fromName,s){
  if(!s||!s.kind)return;
  var kind=s.kind;
  if(kind==='offer'){
    if(!inCall||pcList[fromId])return;
    var p=createPeer(fromId,fromName);
    p.pc.setRemoteDescription(s.offer).then(function(){
      return p.pc.createAnswer();
    }).then(function(ans){
      return p.pc.setLocalDescription(ans);
    }).then(function(){
      wsSendSignal(fromId,{kind:'answer',answer:p.pc.localDescription});
    }).catch(function(){closePeer(fromId);});
  }else if(kind==='answer'){
    if(pcList[fromId]&&pcList[fromId].pc){
      pcList[fromId].pc.setRemoteDescription(s.answer).catch(function(){closePeer(fromId);});
    }
  }else if(kind==='ice'){
    if(pcList[fromId]&&pcList[fromId].pc){
      pcList[fromId].pc.addIceCandidate(s.candidate).catch(function(){});
    }
  }
}

function updateParticipantCount(){
  var el=$('callParticipantCount');
  if(!el){return;}
  var n=Object.keys(pcList).length+(inCall?1:0);
  el.textContent=n>0?(n+' participant'+(n===1?'':'s')):'';
  if(inCall){
    if(Object.keys(pcList).length===0){
      $('callStatus').textContent='Waiting for others to join...';
      $('callStatus').style.display='block';
    }else{
      $('callStatus').style.display='none';
    }
  }
}

function toggleMute(){
  if(!localStream){return;}
  micMuted=!micMuted;
  localStream.getAudioTracks().forEach(function(t){t.enabled=!micMuted;});
  $('btnMute').classList.toggle('off',micMuted);
  $('btnMute').title=micMuted?'Unmute microphone':'Mute microphone';
}

function toggleCam(){
  if(!localStream){return;}
  camOff=!camOff;
  localStream.getVideoTracks().forEach(function(t){t.enabled=!camOff;});
  $('btnCam').classList.toggle('off',camOff);
  $('btnCam').title=camOff?'Turn camera on':'Turn camera off';
}

document.addEventListener('dragover',function(e){e.preventDefault();});
document.addEventListener('drop',function(e){
  e.preventDefault();
  if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){attachFiles(e.dataTransfer.files);}
});
document.addEventListener('paste',function(e){
  var items=(e.clipboardData&&e.clipboardData.items)||[];
  var found=false;
  for(var i=0;i<items.length;i++){
    if(items[i].kind==='file'){
      var f=items[i].getAsFile();
      if(f){addPendingFile(f);found=true;}
    }
  }
  if(found){renderPending();}
});

$('input').addEventListener('keydown',function(e){
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}
});
$('input').addEventListener('input',function(e){
  e.target.style.height='auto';
  e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';
});
$('password').addEventListener('keydown',function(e){if(e.key==='Enter'){join();}});
$('name').addEventListener('keydown',function(e){if(e.key==='Enter'){join();}});

window.join=join;
window.send=send;
window.leave=leave;
window.onFilesSelected=onFilesSelected;
window.onVideoCallBtn=onVideoCallBtn;
window.startCall=startCall;
window.joinCall=joinCall;
window.leaveCall=leaveCall;
window.toggleMute=toggleMute;
window.toggleCam=toggleCam;
$('password').focus();
})();
</script>
</body>
</html>"####;
