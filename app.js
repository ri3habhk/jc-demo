/* Taan composition prototype. Files stay in this browser; no generation API. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kinds = ['audio','midi','video','image','text','script'];
  const labels = {audio:'Reference audio',midi:'MIDI',video:'Video',image:'Image',text:'Text',script:'Script',file:'File'};
  const emptyInputs = () => ['audio','text','image','midi','video','script'].map(kind=>({id:'slot-'+kind,kind,placeholder:true,name:{audio:'Add reference audio',text:'Write a direction',image:'Add an image',midi:'Add a MIDI file',video:'Add a video',script:'Add a script'}[kind]}));
  let inputs = emptyInputs(), selectedId = null, pending = [], messages = [], queued = null;
  let chatOpen=false;
  function openChat(focus=false){chatOpen=true;document.body.classList.add('chat-open');if(focus)$('#prompt-input').focus();}
  function addInputRecord(input){const slot=inputs.findIndex(item=>item.placeholder&&item.kind===input.kind);if(slot>=0)inputs.splice(slot,1,input);else inputs.push(input);}
  let phase = 'idle', paused = false, phaseStart = 0, phaseDuration = 0, pauseStarted = 0, iteration = 0, style = 'Orchestral';
  let activeAudioId = null, audioUrl = null, muted = false, waiting = false, toastTimer, saveTimer, db = null, restoring = false, currentMessage = null;
  const audio = new Audio(); audio.loop = true; audio.preload = 'auto';
  const durations = {first:4000,prompting:8000,generating:8000,playing:8000};
  let firstRound = true, loopStart=0, lastAudioLoop=-1;
  const urlCache = new Map();
  function objectUrl(input) { if (!input.file) return input.thumb || ''; if (!urlCache.has(input.id)) urlCache.set(input.id, URL.createObjectURL(input.file)); return urlCache.get(input.id); }
  function previewUrl(input) { return input.kind === 'image' ? objectUrl(input) : input.thumb || ''; }
  function waveformMarkup(count = 37) { return `<div class="mini-wave input-visual">${Array.from({length:count},(_,i)=>`<i style="height:${4+Math.abs(Math.sin(i*1.7)*Math.cos(i*.46))*14}px"></i>`).join('')}</div>`; }
  function miniVisual(input) {
    if (input.kind === 'audio') return waveformMarkup();
    if (input.kind === 'midi') return '<div class="input-visual midi-notes"><i></i><i></i><i></i><i></i></div>';
    return '<div class="input-visual text-lines"><i></i><i></i><i></i></div>';
  }
  function renderInputs() {
    $('#input-count').textContent = inputs.filter(i=>!i.placeholder).length;
    $('#input-list').innerHTML = inputs.map(input => {
      const thumb = previewUrl(input);
      return `<div class="input-card ${input.placeholder?'empty-input':''} ${input.used?'applied-input':''} ${input.id===selectedId?'selected':''} ${thumb?'has-thumb':''}" draggable="${!input.placeholder}" tabindex="0" role="button" aria-label="${input.placeholder?'Add '+labels[input.kind]:'Use '+escape(input.name)}" data-id="${input.id}"><div class="input-card-header">${icon(input.kind==='file'?'script':input.kind)}<span class="input-card-title">${labels[input.kind]}</span>${input.used?icon('check','input-card-check'):''}</div><div class="input-filename">${escape(input.name)}</div>${miniVisual(input)}${thumb?`<img class="input-thumb" src="${escape(thumb)}" alt="" draggable="false">`:''}${icon('grip','grip')}</div>`;
    }).join('');
    $$('.input-card').forEach(card => {
      card.addEventListener('click', () => attachInput(card.dataset.id));
      card.addEventListener('keydown', e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();attachInput(card.dataset.id);}});
      card.addEventListener('dragstart', e => {e.dataTransfer.setData('application/x-taan-input',card.dataset.id);e.dataTransfer.effectAllowed='copy';card.classList.add('dragging');});
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    renderTypes(); renderPreview();
  }
  function renderTypes() {
    $('#input-types').innerHTML = kinds.map(kind=>`<button class="type-chip ${inputs.some(i=>i.kind===kind&&i.used)?'used':''} ${inputs.find(i=>i.id===selectedId)?.kind===kind?'active':''}" data-kind="${kind}" title="Add ${labels[kind].toLowerCase()}">${icon(inputs.some(i=>i.kind===kind&&i.used)?'check':kind)}${kind==='midi'?'MIDI':kind[0].toUpperCase()+kind.slice(1)}</button>`).join('');
    $$('.type-chip').forEach(button => button.addEventListener('click',()=>browse(button.dataset.kind)));
  }
  function renderPreview() {
    const input = inputs.find(i=>i.id===selectedId);
    const card = $('#preview-card');
    const show=input&&!input.placeholder&&['image','video','midi','script'].includes(input.kind)&&(pending.includes(input.id)||(phase==='generating'&&currentMessage?.attachments.includes(input.id)));
    card.hidden=!show;document.body.classList.toggle('has-preview',!!show);if(!show)return;
    let media;
    if(input.kind==='image'||input.thumb) media=`<img class="preview-image" src="${escape(previewUrl(input))}" alt="${escape(input.name)}" draggable="false">`;
    else if(input.kind==='video'&&input.file) media=`<video class="preview-image" src="${escape(objectUrl(input))}" muted playsinline preload="metadata"></video>`;
    else if(input.kind==='midi') media=`<div class="preview-content"><div class="midi-preview">${Array.from({length:12},(_,i)=>`<i style="left:${(i%4)*24}%;top:${(i%3)*28+7}px;width:${16+(i%3)*3}%"></i>`).join('')}</div></div>`;
    else if(input.text) media=`<div class="preview-content"><div class="preview-text">${escape(input.text.slice(0,240))}</div></div>`;
    else if(input.kind==='audio') media=`<div class="preview-content">${waveformMarkup(31)}</div>`;
    else media=`<div class="preview-content">${icon(input.kind==='file'?'script':input.kind)}</div>`;
    card.innerHTML = `${media}<div class="preview-footer">${icon(input.kind==='file'?'script':input.kind)}<span class="preview-name">${escape(input.name)}</span><span class="preview-type">${input.kind.toUpperCase()}</span></div><span class="preview-badge">${icon('plus')}</span>`;
    card.draggable = true; card.tabIndex=0; card.setAttribute('role','button');card.setAttribute('aria-label',`Attach ${input.name} to your idea`);
    card.onclick = ()=>attachInput(input.id);
    card.onkeydown = e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();attachInput(input.id);}};
    card.ondragstart = e=>e.dataTransfer.setData('application/x-taan-input',input.id);
  }
  function attachInput(id, focus = true) {
    const input=inputs.find(i=>i.id===id);if(!input)return;
    openChat();
    if(input.placeholder){if(input.kind==='text'){$('#prompt-input').focus();}else browse(input.kind);return;}
    selectedId=id;if(!pending.includes(id))pending.push(id);
    if(input.kind==='audio'&&input.file&&!inputs.some(item=>item.used))setAudio(input);
    renderInputs();renderPending();if(focus)$('#prompt-input').focus();saveSoon();
  }
  function renderPending() {
    $('#pending-attachments').innerHTML=pending.map(id=>inputs.find(i=>i.id===id)).filter(Boolean).map(input=>`<span class="pending-chip">${icon(input.kind==='file'?'script':input.kind)}<span>${escape(input.name)}</span><button type="button" aria-label="Remove ${escape(input.name)} attachment" data-remove="${input.id}">${icon('close')}</button></span>`).join('');
    $$('[data-remove]').forEach(button=>button.onclick=()=>{pending=pending.filter(id=>id!==button.dataset.remove);renderPending();saveSoon();});
    updateComposerLabel();renderPreview();
  }
  const accepts={audio:'audio/*,.wav,.mp3,.m4a,.aiff,.aif,.flac,.ogg',midi:'.mid,.midi',video:'video/*',image:'image/*',text:'text/*,.md,.txt,.pdf,.docx',script:'.txt,.md,.fountain,.json,.pdf,.docx'};
  function browse(kind) {
    closeInputMenu();const input=$('#file-input');input.accept=accepts[kind]||'';input.dataset.kind=kind||'';input.value='';input.click();
  }
  function closeInputMenu(focus=false){$('#input-menu').hidden=true;$('#attach-input').setAttribute('aria-expanded','false');if(focus)$('#attach-input').focus();}
  function toggleInputMenu(){
    const menu=$('#input-menu');if(!menu.hidden){closeInputMenu(true);return;}
    menu.hidden=false;$('#attach-input').setAttribute('aria-expanded','true');
    const rect=$('#attach-input').getBoundingClientRect();
    menu.style.left=Math.max(12,Math.min(rect.left,innerWidth-menu.offsetWidth-12))+'px';
    menu.style.top=Math.max(12,rect.top-menu.offsetHeight-10)+'px';
    menu.querySelector('button').focus();
  }
  const uploadCopy={
    video:['I have a video','Score to picture.','Upload your video','MP4, MOV or WebM · up to 250 MB','video'],
    script:['I have a script','Compose to the words.','Bring in your script','Upload a document, or paste your scene below.','script'],
    audio:['I have a reference','Capture a sound or feeling.','Upload your reference audio','MP3, WAV, M4A or FLAC · up to 250 MB','audio'],
    image:['I have an image','Start with a mood or a place.','Upload your image','JPG, PNG, WebP or GIF · up to 250 MB','image'],
    midi:['I have a MIDI file','Build around a melody.','Upload your MIDI file','MID or MIDI · kept as a musical reference','MIDI file'],
    text:['I have an idea','Put the feeling into words.','Tell us what you imagine','Upload text, or write your musical direction below.','text file']
  };
  let wizard=null;
  function openCombinedInputs(){closeInputMenu();wizard={chosen:[],step:0,entries:{}};renderWizard();$('#upload-dialog').showModal();}
  function wizardReady(kind){const entry=wizard.entries[kind];return !!(entry?.files.length||entry?.text.trim());}
  function fileSize(file){return file.size>=1048576?(file.size/1048576).toFixed(1)+' MB':Math.max(1,Math.round(file.size/1024))+' KB';}
  function renderWizard(){
    const step=wizard.step,total=wizard.chosen.length+2,review=step>0&&step===total-1;
    let content='',kind=wizard.chosen[step-1];
    if(step===0){content=`<h2 id="upload-title">Bring your inputs together.</h2><p class="upload-subtitle">Choose what you have. We’ll take it one input at a time.</p><div class="upload-choices">${Object.entries(uploadCopy).map(([key,copy],i)=>`<button class="upload-choice" data-choice="${key}" aria-pressed="${wizard.chosen.includes(key)}"><span class="choice-number">0${i+1}</span>${icon(key)}<span class="choice-description"><strong>${copy[0]}</strong><small>${copy[1]}</small></span><span class="choice-check">${icon('check')}</span></button>`).join('')}</div>`;}
    else if(review){content=`<h2 id="upload-title">Your ideas, together.</h2><p class="upload-subtitle">Ready to bring these into your composition.</p>${wizard.chosen.map(key=>{const entry=wizard.entries[key];return `<div class="upload-review-row">${icon(key)}<div><strong>${labels[key]}</strong><small>${escape([...entry.files.map(f=>f.name),entry.text.trim()?'Written '+key:''].filter(Boolean).join(' · '))}</small></div></div>`;}).join('')}`;}
    else{
      const entry=wizard.entries[kind],copy=uploadCopy[kind];
      content=`<h2 id="upload-title">${copy[2]}</h2><p class="upload-subtitle">${copy[3]}</p>${entry.files.length?`<div class="upload-file-list">${entry.files.map((file,i)=>`<div class="upload-file-row">${icon(kind)}<div class="upload-file-meta"><strong>${escape(file.name)}</strong><small>${fileSize(file)}</small></div><button class="upload-remove" data-remove-file="${i}" aria-label="Remove ${escape(file.name)}">${icon('close')}</button></div>`).join('')}</div><button class="upload-replace" id="wizard-browse">Replace files</button>`:`<button class="upload-drop" id="wizard-browse"><span class="upload-drop-icon">${icon(kind)}</span><strong>Drop your ${copy[4]} here</strong><small>or click to browse</small></button>`}${['text','script'].includes(kind)?`<label class="upload-text-label" for="wizard-text">Or ${kind==='script'?'paste your script':'write your idea'}</label><textarea class="upload-text" id="wizard-text" placeholder="${kind==='script'?'The scene opens on…':'Describe the sound, mood, or direction…'}">${escape(entry.text)}</textarea>`:''}`;
    }
    $('#upload-content').innerHTML=`<div class="upload-topline"><span class="upload-step">STEP ${step+1} / ${total}</span><span class="upload-progress"><span style="width:${(step+1)/total*100}%"></span></span><button class="upload-cancel" id="wizard-cancel">Cancel</button></div>${content}<div class="upload-nav">${step?`<button class="upload-back" id="wizard-back">${icon('next')}Back</button>`:''}<button class="upload-next" id="wizard-next" ${(step===0&&!wizard.chosen.length)||(step>0&&!review&&!wizardReady(kind))?'disabled':''}>${review?'Add to composition':'Continue'}${icon('next')}</button></div><p class="upload-privacy">Files stay on your device. Nothing is uploaded to a server.</p>`;
    $('#wizard-cancel').onclick=()=>$('#upload-dialog').close();
    $$('[data-choice]').forEach(button=>button.onclick=()=>{
      const key=button.dataset.choice;
      if(wizard.chosen.includes(key))wizard.chosen=wizard.chosen.filter(k=>k!==key);
      else{wizard.chosen.push(key);wizard.entries[key]||={files:[],text:''};}
      renderWizard();$(`[data-choice="${key}"]`).focus();
    });
    if($('#wizard-back'))$('#wizard-back').onclick=()=>{wizard.step--;renderWizard();};
    if($('#wizard-browse')){
      $('#wizard-browse').onclick=()=>{const picker=$('#wizard-file-input');picker.accept=accepts[kind];picker.value='';picker.click();};
      const zone=$('#wizard-browse');
      zone.ondragover=e=>{e.preventDefault();zone.classList.add('drop-active');};
      zone.ondragleave=()=>zone.classList.remove('drop-active');
      zone.ondrop=e=>{e.preventDefault();e.stopPropagation();setWizardFiles([...e.dataTransfer.files]);};
      $$('[data-remove-file]').forEach(button=>button.onclick=()=>{wizard.entries[kind].files.splice(Number(button.dataset.removeFile),1);renderWizard();});
    }
    if($('#wizard-text'))$('#wizard-text').oninput=e=>{wizard.entries[kind].text=e.target.value;$('#wizard-next').disabled=!wizardReady(kind);};
    $('#wizard-next').onclick=async()=>{
      if(!review){wizard.step++;renderWizard();$('#upload-title').tabIndex=-1;$('#upload-title').focus();return;}
      $('#wizard-next').disabled=true;
      for(const key of wizard.chosen){const entry=wizard.entries[key];if(entry.files.length)await addFiles(entry.files,key);if(entry.text.trim()){const item={id:crypto.randomUUID(),kind:key,name:key==='script'?'My script.txt':'My direction.txt',text:entry.text.trim()};addInputRecord(item);selectedId=item.id;pending.push(item.id);openChat();}}
      renderInputs();renderPending();saveSoon();$('#upload-dialog').close();$('#prompt-input').focus();toast('Your inputs are ready. Add a direction, then send your idea.');
    };
  }
  function setWizardFiles(files){
    if(!wizard)return;
    const kind=wizard.chosen[wizard.step-1];if(!kind)return;
    const valid=files.filter(file=>file.size<=250*1024*1024);
    if(valid.length!==files.length)toast('Each file must be under 250 MB.');
    wizard.entries[kind].files=valid;renderWizard();
  }
  function classify(file,hint) {
    const ext=file.name.split('.').pop().toLowerCase();
    if(['mid','midi'].includes(ext))return 'midi';
    if(file.type.startsWith('audio/')||['mp3','wav','m4a','aac','aif','aiff','flac','ogg','opus'].includes(ext))return 'audio';
    if(file.type.startsWith('image/')||['png','jpg','jpeg','webp','gif','svg','avif','heic'].includes(ext))return 'image';
    if(file.type.startsWith('video/')||['mp4','webm','mov','m4v'].includes(ext))return 'video';
    if(hint==='script'||['fountain','fdx','js','py','json'].includes(ext))return 'script';
    if(file.type.startsWith('text/')||['txt','md','docx','pdf','rtf','csv'].includes(ext))return 'text';
    return 'file';
  }
  async function addFiles(files,hint) {
    let added=[];
    for(const file of files) {
      if(file.size>250*1024*1024){toast(`${file.name} is too large. Use a file under 250 MB.`);continue;}
      const kind=classify(file,hint), input={id:crypto.randomUUID(),name:file.name,kind,file,used:false};
      if(['text','script'].includes(kind)&&(file.type.startsWith('text/')||/\.(txt|md|fountain|json|js|py)$/i.test(file.name))) input.text=(await file.slice(0,16000).text());
      addInputRecord(input);added.push(input);pending.push(input.id);selectedId=input.id;openChat();
      if(kind==='audio'&&!inputs.some(item=>item.used))setAudio(input);
    }
    if(added.length){renderInputs();renderPending();saveSoon();toast(added.length===1?`${added[0].name} added to your next idea.`:`${added.length} files added to your next idea.`);}
  }
  function installDropzone(element) {
    let depth=0;
    element.addEventListener('dragenter',e=>{e.preventDefault();depth++;element.classList.add('drop-active');});
    element.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});
    element.addEventListener('dragleave',()=>{depth--;if(depth<=0){depth=0;element.classList.remove('drop-active');}});
    element.addEventListener('drop',async e=>{
      e.preventDefault();e.stopPropagation();depth=0;element.classList.remove('drop-active');
      const id=e.dataTransfer.getData('application/x-taan-input');
      if(id){attachInput(id);return;}
      if(e.dataTransfer.files.length){await addFiles([...e.dataTransfer.files]);return;}
      const text=e.dataTransfer.getData('text/plain');if(text){openChat();$('#prompt-input').value=text;$('#prompt-input').focus();updateComposerLabel();saveSoon();}
    });
  }
  function renderMessages(scroll = true) {
    $('#chat-messages').innerHTML=messages.map((m,index)=>`${index?'<div class="then-divider">THEN</div>':''}<div class="message-group" data-message="${m.id}"><div class="message-meta">YOU</div><div class="user-message">${escape(m.text)}${m.attachments.map(id=>inputs.find(i=>i.id===id)).filter(Boolean).map(i=>`<div><span class="message-attachment">${icon(i.kind==='file'?'script':i.kind)}<span>${escape(i.name)}</span></span></div>`).join('')}</div><div class="assistant-message ${m.status==='generating'?'generating-message':''}"><img class="message-brand-mark" src="assets/taan-mark.svg" alt=""><div>${escape(m.status==='done'?'Added to your loop.':m.status==='saved'?'Your idea is saved.':m.status==='generating'?'Generating…':'Ready for the next loop.')}</div></div></div>`).join('');
    if(scroll)$('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;
  }
  function captureDraft() {
    const text=$('#prompt-input').value.trim();if(!text&&!pending.length)return null;
    openChat();
    if(text&&!pending.length){const input={id:crypto.randomUUID(),kind:'text',name:text.length>34?text.slice(0,34)+'…':text,text};addInputRecord(input);pending.push(input.id);selectedId=input.id;}
    const m={id:crypto.randomUUID(),text:text||'',attachments:[...pending],status:'queued'};
    messages.push(m);pending=[];$('#prompt-input').value='';renderPending();renderInputs();renderMessages();saveSoon();return m;
  }
  function submitIdea(e) {
    if(e)e.preventDefault();
    if(queued){toast('Your next idea is queued. You can keep a draft for the following cycle.');return;}
    const message=captureDraft();if(!message){$('#prompt-input').focus();toast('Write an idea or attach a file to begin.');return;}
    primeAudio();
    if(phase==='idle'){beginGeneration(message,true);return;}
    queued=message;updateUI();
    if(phase==='prompting'&&waiting){const next=queued;queued=null;beginGeneration(next,false);}
    else toast('Idea queued for the next generation.');
  }
  function beginGeneration(message,isFirst=false) {
    if(!message)return;
    currentMessage=message;message.status='generating';iteration++;
    
    firstRound=isFirst;renderInputs();renderMessages();setPhase('generating',isFirst?durations.first:durations.generating);saveSoon();
  }
  function setPhase(next,duration) {
    phase=next;phaseDuration=duration;phaseStart=performance.now();paused=false;waiting=false;document.body.classList.remove('paused');
    if(next==='playing'){
      loopStart=phaseStart;lastAudioLoop=0;
      if(currentMessage){
        currentMessage.status='done';
        currentMessage.attachments.forEach(id=>{const item=inputs.find(i=>i.id===id);if(item)item.used=true;});
        const music=[...currentMessage.attachments].reverse().map(id=>inputs.find(i=>i.id===id)).find(item=>item?.kind==='audio'&&item.file);
        if(music)setAudio(music);
        renderInputs();renderMessages();saveSoon();
      }
      startAudio(true);
    }else if(inputs.some(item=>item.used)){
      if(audio.paused)startAudio(false);
    }else audio.pause();
    updateUI();
  }
  function nextPhase() {
    if(phase==='generating'){setPhase('playing',durations.playing);return;}
    if(phase==='playing'){firstRound=false;setPhase('prompting',durations.prompting);return;}
    if(phase==='prompting'){
      if(!queued)queued=captureDraft();
      if(queued){const m=queued;queued=null;beginGeneration(m,false);}
      else{waiting=true;updateUI();}
    }
  }
  function updateComposerLabel() {
    const kind=pending.length?inputs.find(i=>i.id===pending[pending.length-1])?.kind:null;
    $('#composer-label').textContent=(queued?'NEXT IDEA QUEUED':phase==='generating'?'GENERATING':phase==='idle'?'YOUR IDEA':'ADD YOUR NEXT IDEA')+(kind?' · '+kind.toUpperCase():'');
    $('#send-button').disabled=!!queued||(!$('#prompt-input').value.trim()&&!pending.length);
    $('#send-button').setAttribute('aria-label',phase==='idle'?'Send first idea':'Queue next idea');
    $('#play-button').disabled=phase==='idle'&&!inputs.some(i=>i.used)&&!pending.length&&!$('#prompt-input').value.trim();
  }
  function updateUI() {
    document.body.dataset.phase=phase;
    $$('.cycle-step').forEach(step=>step.classList.toggle('active',step.dataset.phase===phase));
    $('#generation-duration').textContent=phase==='generating'&&firstRound?'4s':'8s';
    const playing=phase==='playing';
    $('#prompt-input').placeholder=phase==='generating'&&inputs.some(i=>i.used)?'The current loop keeps playing.':'Type your next musical direction…';
    $('#loop-count').textContent=inputs.some(i=>i.used)&&phase!=='idle'?({playing:'1 / 3',prompting:'2 / 3',generating:'3 / 3'}[phase]||''):'';
    document.body.classList.toggle('audio-running',inputs.some(i=>i.used)&&phase!=='idle'&&!paused);
    $('#stage-label').textContent=phase==='idle'?'LISTENING TO YOUR IDEAS':phase==='generating'?'SHAPING YOUR SOUND':playing?'YOUR IDEAS, IN MOTION':'WHAT SHOULD WE FEEL NEXT?';
    $('#drop-label').textContent=phase==='generating'?'A new idea is taking shape':playing?'Keep the inspiration flowing':'Drop to shape the music';
    const applied=inputs.filter(i=>i.used).length;$('#composition-meta').textContent=`${applied} ${applied===1?'input':'inputs'} applied`;
    $('#version').textContent='v'+String(Math.max(1,iteration)).padStart(2,'0');
    $('#track-title').textContent='8-second loop';
    $('#player-state').textContent=paused?'Paused':playing?(activeAudioId?'Your music · looping':'Silent playback'):phase==='generating'?'Generating…':phase==='prompting'?'Your turn':'Ready when you are';
    $('#play-button').innerHTML=icon(phase!=='idle'&&!paused&&!waiting?'pause':'play');
    $('#play-button').setAttribute('aria-label',phase==='idle'?'Start demo playback':paused?'Resume cycle':waiting?'Replay composition':'Pause cycle');
    $('#phase-notice-text').textContent=paused?'Take your time. The cycle is paused.':phase==='idle'?'A little direction goes a long way.':phase==='generating'?'Generating your next eight seconds.':playing?(activeAudioId?'Your uploaded music is playing.':'Your composition is playing silently.'):queued?'Your idea is ready for the next cycle.':waiting?'Ready when you are. Add your next idea.':'Your turn. Add a direction for the next take.';
    $('#stage-caption').textContent=phase==='idle'?'An image. A melody. A feeling. Start anywhere.':phase==='generating'?'A little patience. A little possibility.':playing?(activeAudioId?'Your music, on repeat.':'Upload music to hear it here.'):queued?'Your next idea is in good hands.':'Keep building. One idea at a time.';
    $('#composer-hint').textContent=queued?'Keep a draft for later':phase==='prompting'&&!waiting?'Auto-sends when time is up':'Type or drop an idea';
    document.body.classList.toggle('has-composition',inputs.some(i=>i.used));renderPreview();updateComposerLabel();updateAudioIcon();
  }
  function togglePlayback() {
    if(phase==='idle'){
      if($('#prompt-input').value.trim()||pending.length){submitIdea();return;}
      primeAudio();setPhase('playing',durations.playing);return;
    }
    if(waiting){setPhase('playing',durations.playing);return;}
    paused=!paused;
    if(paused){pauseStarted=performance.now();audio.pause();}
    else{const pauseDuration=performance.now()-pauseStarted;phaseStart+=pauseDuration;loopStart+=pauseDuration;if(inputs.some(i=>i.used))startAudio(false);}
    document.body.classList.toggle('paused',paused);updateUI();
  }
  const waveBars=Array.from({length:150},(_,i)=>{
    const bar=document.createElement('span');bar.className='wave-bar';
    const envelope=Math.sin((i/150)*Math.PI)*.64+.2;
    bar.style.setProperty('--h',`${(14+Math.abs(Math.sin(i*.73)*Math.cos(i*1.91))*24)*envelope}px`);
    bar.style.setProperty('--speed',`${.3+(i%9)*.07}s`);bar.style.setProperty('--delay',`${-(i%13)*.11}s`);
    $('#waveform').appendChild(bar);return bar;
  });
  let lastSecond=-1;
  function tick(now) {
    if(phase!=='idle'){
      let elapsed=(paused?pauseStarted:now)-phaseStart;
      if(elapsed>=phaseDuration&&!paused&&!waiting){nextPhase();elapsed=now-phaseStart;}
      const remain=waiting?0:Math.max(0,Math.ceil((phaseDuration-elapsed)/1000));
      $('#phase-countdown').textContent=waiting?'':`${String(remain).padStart(2,'0')}s`;
      if(inputs.some(item=>item.used)){
        const transportElapsed=Math.max(0,(paused?pauseStarted:now)-loopStart);
        const loopNumber=Math.floor(transportElapsed/8000),position=transportElapsed%8000,progress=position/8000;
        if(loopNumber!==lastAudioLoop&&!paused){lastAudioLoop=loopNumber;if(activeAudioId){audio.currentTime=0;if(audio.paused)startAudio(false);}}
        $('#playhead').style.left=`${progress*100}%`;
        waveBars.forEach((bar,i)=>bar.classList.toggle('passed',i/waveBars.length<=progress));
        const sec=Math.floor(position/1000);if(sec!==lastSecond){$('#play-time').innerHTML=`00:${String(sec).padStart(2,'0')} <span>/ 00:08</span>`;lastSecond=sec;}
      }else{waveBars.forEach(bar=>bar.classList.remove('passed'));$('#play-time').innerHTML='00:00 <span>/ 00:08</span>';lastSecond=-1;}
    }else{$('#phase-countdown').textContent='';}
    requestAnimationFrame(tick);
  }
  function setAudio(input) {
    if(activeAudioId===input.id&&audio.src)return;
    audio.pause();activeAudioId=input.id;audioUrl=objectUrl(input);audio.src=audioUrl;audio.loop=true;audio.muted=muted;audio.load();
    if(inputs.some(i=>i.used)&&phase!=='idle'&&!paused)startAudio(true);
    else primeAudio();
    updateAudioIcon();
  }
  function primeAudio() {
    if(!activeAudioId||inputs.some(i=>i.used))return;
    audio.muted=true;
    const attempt=audio.play();
    audio.pause();audio.currentTime=0;audio.muted=muted;
    if(attempt)attempt.catch(()=>{});
  }
  function startAudio(reset) {
    if(!activeAudioId)return;
    if(reset)audio.currentTime=0;
    audio.muted=muted;
    audio.play().catch(error=>{if(error.name==='NotAllowedError')toast('Click the sound button to enable your uploaded music.');else if(error.name!=='AbortError')toast('This browser cannot play that audio format. Try MP3 or WAV.');});
  }
  audio.addEventListener('error',()=>{if(activeAudioId)toast('This audio format could not be played. Try an MP3 or WAV file.');});
  function updateAudioIcon(){const button=$('#mute-button');button.innerHTML=icon(!activeAudioId||muted?'muted':'volume');button.title=activeAudioId?(muted?'Unmute uploaded music':'Mute uploaded music'):'Upload music to add sound';button.setAttribute('aria-label',button.title);}
  function showDialog(content) {$('#dialog-content').innerHTML=content;$('#info-dialog').showModal();}
  function timingDialog() {showDialog(`<span class="dialog-eyebrow">THREE PASSES. ONE LOOP.</span><h2>Keep the music moving.</h2><p>Your first idea takes 4 seconds to generate. Then the same 8-second loop plays through three passes.</p><div class="timing-row"><span>01</span>Play your composition<b>8 seconds</b></div><div class="timing-row"><span>02</span>Add your next idea<b>8 seconds</b></div><div class="timing-row"><span>03</span>Generate the next input<b>8 seconds</b></div><p>The current loop keeps playing while you prompt and generate. Each new input is applied at the next loop boundary. If no idea is ready, the music keeps looping until you send one.</p><p>Playback is silent until you upload music. This is an interface demo; it does not generate music.</p><button class="dialog-primary" id="dialog-done">Continue</button>`);$('#dialog-done').onclick=()=>$('#info-dialog').close();}
  function textDialog() {showDialog(`<span class="dialog-eyebrow">EVERY IDEA BELONGS HERE</span><h2>Put a feeling into words.</h2><label class="sr-only" for="idea-name">Idea name</label><input id="idea-name" class="dialog-input" placeholder="Name your idea" maxlength="100"><label class="sr-only" for="idea-body">Your idea</label><textarea id="idea-body" class="dialog-textarea" placeholder="A scene, a script, a feeling, a musical direction…"></textarea><button class="dialog-primary" id="save-idea">Add to my inputs</button>`);$('#save-idea').onclick=()=>{const text=$('#idea-body').value.trim();if(!text){$('#idea-body').focus();return;}const name=$('#idea-name').value.trim()||'A new direction';const input={id:crypto.randomUUID(),kind:'text',name:name.replace(/\.txt$/i,'')+'.txt',text};addInputRecord(input);attachInput(input.id,false);$('#info-dialog').close();$('#prompt-input').focus();};}
  function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3800);}
  function setTheme(theme){document.documentElement.dataset.theme=theme;try{localStorage.setItem('taan-demo-theme',theme);}catch{}$('#theme-toggle').innerHTML=icon(theme==='dark'?'sun':'moon');$('#theme-toggle').title=theme==='dark'?'Switch to reference light palette':'Switch to Taan dark palette';$('#theme-toggle').setAttribute('aria-label',$('#theme-toggle').title);$('meta[name="theme-color"]').content=theme==='dark'?'#0e0b0a':'#faf8ef';}
  function resetDemo(){loopStart=0;lastAudioLoop=-1;lastSecond=-1;audio.pause();audio.removeAttribute('src');audio.load();activeAudioId=null;audioUrl=null;urlCache.forEach(url=>URL.revokeObjectURL(url));urlCache.clear();inputs=emptyInputs();selectedId=null;chatOpen=false;document.body.classList.remove('chat-open');pending=[];messages=[];queued=null;phase='idle';paused=false;iteration=0;firstRound=true;waiting=false;currentMessage=null;$('#prompt-input').value='';$('#play-time').innerHTML='00:00 <span>/ 00:08</span>';document.body.classList.remove('paused');waveBars.forEach(b=>b.classList.remove('passed'));renderInputs();renderPending();renderMessages(false);updateUI();saveSoon();toast('A fresh composition. Start with anything.');}
  function exportSession(){const data={format:'taan-composition-demo',version:1,title:$('#project-title').value,style,exportedAt:new Date().toISOString(),timing:{initialGenerationSeconds:4,promptSeconds:8,generationSeconds:8,playbackSeconds:8,continuousAudio:true,loopsPerInput:3},inputs:inputs.filter(i=>!i.placeholder).map(({file,...input})=>({...input,size:file?.size,mimeType:file?.type})),ideas:messages,draft:$('#prompt-input').value,note:'Interface prototype. Uploaded files are stored in the browser and are not embedded in this JSON export.'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=($('#project-title').value||'taan-composition').replace(/[^a-z0-9_-]/gi,'-').toLowerCase()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Session exported. Your original media stays in this browser.');}
  function saveSoon(){if(restoring)return;$('#save-status').textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(saveSession,350);}
  function saveSession(){if(!db){$('#save-status').textContent='Saved for this session';return;}try{const tx=db.transaction('session','readwrite');tx.objectStore('session').put({inputs,selectedId,pending,messages,iteration,style,title:$('#project-title').value,draft:$('#prompt-input').value,activeAudioId,chatOpen},'current');tx.oncomplete=()=>$('#save-status').textContent='All changes saved';tx.onerror=()=>$('#save-status').textContent='Saved for this session';}catch{$('#save-status').textContent='Saved for this session';}}
  async function restoreSession(){try{db=await new Promise((resolve,reject)=>{const req=indexedDB.open('taan-composition-clean-v3',1);req.onupgradeneeded=()=>req.result.createObjectStore('session');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});const saved=await new Promise((resolve,reject)=>{const req=db.transaction('session','readonly').objectStore('session').get('current');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});if(!saved)return;restoring=true;inputs=saved.inputs||inputs;selectedId=saved.selectedId||selectedId;pending=saved.pending||[];messages=(saved.messages||[]).map(m=>({...m,status:m.status==='done'?'done':'saved'}));iteration=saved.iteration||0;style=saved.style||style;$('#project-title').value=saved.title||'JC composition';$('#prompt-input').value=saved.draft||'';if(saved.chatOpen||messages.length||pending.length)openChat();$('#style-button').textContent=style.toUpperCase();document.title=$('#project-title').value+' — taan';const savedAudio=inputs.find(i=>i.id===saved.activeAudioId&&i.file);if(savedAudio){activeAudioId=savedAudio.id;audio.src=objectUrl(savedAudio);audio.loop=true;}renderInputs();renderPending();renderMessages(false);updateUI();restoring=false;}catch{$('#save-status').textContent='Saved for this session';}}
  // Decorative geometry is deterministic, so the layout has no loading dependency.
  $('#orb').innerHTML=Array.from({length:12},(_,i)=>`<ellipse cx="250" cy="250" rx="${165+i%3*4}" ry="${139+i%4*4}" transform="rotate(${i*15} 250 250)"/>`).join('')+Array.from({length:46},(_,i)=>{const angle=i*2.39996,r=187+(i%7)*7;return `<circle cx="${250+Math.cos(angle)*r}" cy="${250+Math.sin(angle)*r}" r="${i%3===0?1.1:.6}" fill="currentColor" stroke="none" opacity=".55"/>`;}).join('');
  $('#file-input').addEventListener('change',e=>addFiles([...e.target.files],e.target.dataset.kind));
  $('#open-chat').onclick=()=>openChat(true);
  $('#add-input').onclick=()=>browse();$('#attach-input').onclick=toggleInputMenu;$('#composition-drop').onclick=()=>browse();$('#write-input').onclick=textDialog;
  $('#attach-input').setAttribute('aria-label','Add inputs');$('#attach-input').setAttribute('aria-controls','input-menu');$('#attach-input').setAttribute('aria-expanded','false');
  $$('[data-upload-kind]').forEach(button=>button.onclick=()=>browse(button.dataset.uploadKind));
  $('#combined-inputs').onclick=openCombinedInputs;
  $('#wizard-file-input').onchange=e=>setWizardFiles([...e.target.files]);
  document.addEventListener('click',e=>{if(!e.target.closest('#input-menu')&&!e.target.closest('#attach-input'))closeInputMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#input-menu').hidden){e.preventDefault();closeInputMenu(true);}});
  $('#input-menu').addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();const buttons=[...$('#input-menu').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();});
  window.addEventListener('resize',()=>closeInputMenu());
  $('#upload-dialog').addEventListener('close',()=>{wizard=null;});
  ['#inputs-panel','#composition-stage','#prompt-form'].forEach(selector=>installDropzone($(selector)));
  window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
  $('#prompt-form').addEventListener('submit',submitIdea);
  $('#prompt-input').addEventListener('input',()=>{updateComposerLabel();saveSoon();});
  $('#prompt-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submitIdea();}});
  $('#play-button').onclick=togglePlayback;
  $('#mute-button').onclick=()=>{if(!activeAudioId){browse('audio');return;}if(audio.paused&&phase!=='idle'&&!paused){muted=false;startAudio(false);}else{muted=!muted;audio.muted=muted;}updateAudioIcon();};
  $('#theme-toggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
  $('#project-title').addEventListener('input',()=>{document.title=($('#project-title').value||'Untitled composition')+' — taan';saveSoon();});
  $('#project-title').addEventListener('blur',()=>{if(!$('#project-title').value.trim()){$('#project-title').value='Untitled composition';saveSoon();}});
  $('#export').onclick=exportSession;$('#profile-button').onclick=timingDialog;
  $('#more-button').onclick=()=>{const menu=$('#options-menu');menu.hidden=!menu.hidden;$('#more-button').setAttribute('aria-expanded',String(!menu.hidden));};
  document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrap')){$('#options-menu').hidden=true;$('#more-button').setAttribute('aria-expanded','false');}});
  $('#reset-demo').onclick=()=>{$('#options-menu').hidden=true;resetDemo();};$('#show-timing').onclick=()=>{$('#options-menu').hidden=true;timingDialog();};
  $('.dialog-close').onclick=()=>$('#info-dialog').close();
  $('#info-dialog').addEventListener('click',e=>{if(e.target===$('#info-dialog')){const box=e.target.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)e.target.close();}});
  $('#style-button').onclick=()=>{const styles=['Orchestral','Ambient','Cinematic','Electronic','Acoustic','Jazz'];showDialog(`<span class="dialog-eyebrow">SET THE FEELING</span><h2>A direction to start with.</h2><p>A label for your composition. Your ideas do the rest.</p><div class="style-options">${styles.map(s=>`<button class="${s===style?'active':''}" data-style="${s}">${s}</button>`).join('')}</div>`);$$('[data-style]').forEach(button=>button.onclick=()=>{style=button.dataset.style;$('#style-button').textContent=style.toUpperCase();updateUI();saveSoon();$('#info-dialog').close();});};
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null;
  $('#voice-input').onclick=()=>{
    if(!SpeechRecognition){toast('Voice input is available in Chrome. You can type or upload a text file here.');return;}
    if(recognition){recognition.stop();return;}
    recognition=new SpeechRecognition();recognition.lang='en-US';recognition.interimResults=false;
    recognition.onresult=e=>{$('#prompt-input').value+=($('#prompt-input').value?' ':'')+e.results[0][0].transcript;updateComposerLabel();saveSoon();};
    recognition.onstart=()=>{$('#voice-input').style.color='var(--accent)';$('#composer-hint').textContent='Listening…';};
    recognition.onend=()=>{recognition=null;$('#voice-input').style.color='';updateUI();};
    recognition.onerror=e=>toast(e.error==='not-allowed'?'Microphone access was not enabled. You can still type your idea.':'Voice input could not connect. Try typing your idea.');
    recognition.start();
  };
  window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);saveSession();audio.pause();});
  let initialTheme='dark';try{initialTheme=localStorage.getItem('taan-demo-theme')||'dark';}catch{}setTheme(initialTheme);
  renderInputs();renderPending();renderMessages(false);updateUI();restoreSession();requestAnimationFrame(tick);
})();
