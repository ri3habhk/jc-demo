/* Taan composition prototype. Files stay in this browser; no generation API. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kinds = ['audio','midi','video','image','text','script'];
  const labels = {audio:'Reference audio',midi:'MIDI',video:'Video',image:'Image',text:'Text',script:'Script',file:'File'};
  // Authored launch-demo copy, not analysis of the uploaded files.
  const launchReasoning = {
    audio:'I’ll preserve your melody’s shape and rhythm, giving it a warm, expressive cello voice.',
    text:'B1 → F♯2 → G1 → D2. Four slow double-bass notes will support the cello while keeping its melody unchanged.',
    image:'The quiet, misty landscape suggests a soft, restrained viola layer. I’ll add sustained strings while keeping the existing melody at the centre.',
    midi:'I’ll follow the MIDI progression with soft, sustained French horns, adding harmonic warmth around the existing melody.',
    video:'The flowing movement suggests a gentle upper violin line. Smooth, connected notes will carry that motion above the existing layers.',
    script:'An airy melody suggests flute; footsteps suggest light percussion. I’ll open the ending into a spacious, hopeful texture.'
  };
  const emptyInputs = () => ['audio','text','image','midi','video','script'].map(kind=>({id:'slot-'+kind,kind,placeholder:true,name:{audio:'Click to begin',text:'Write a direction',image:'Add an image',midi:'Add a MIDI file',video:'Add a video',script:'Add a script'}[kind]}));
  let inputs = emptyInputs(), selectedId = null, pending = [], messages = [], queued = null;
  let chatOpen=true, textEntry=false;
  function openChat(focus=false){chatOpen=true;document.body.classList.add('chat-open');if(focus)$('#prompt-input').focus();}
  function addInputRecord(input){const slot=inputs.findIndex(item=>item.placeholder&&item.kind===input.kind);if(slot>=0)inputs.splice(slot,1,input);else inputs.push(input);}
  let phase = 'idle', paused = false, phaseStart = 0, phaseDuration = 0, pauseStarted = 0, iteration = 0, style = 'Orchestral';
  let activeAudioId = null, muted = false, waiting = false, toastTimer, saveTimer, currentMessage = null;
  const durations = {starting:3000,listening:8000,first:8000,prompting:8000,generating:8000,playing:8000};
  const soundtrack = window.QUIET_CURRENT;
  const engine = new TaanAudio(soundtrack);
  let activeUpload = null;
  let referenceIntro = false;
  let pendingPlayback = null, phaseAudioStart = null;
  let activeLoop = -1, audioSource = 'score', completedRounds = 0;
  let firstRound = true, loopStart=0, lastAudioLoop=-1;
  const urlCache = new Map();
  function objectUrl(input) { if (!input.file) return input.thumb || ''; if (!urlCache.has(input.id)) urlCache.set(input.id, URL.createObjectURL(input.file)); return urlCache.get(input.id); }
  const mediaKind = input => input.mediaKind || input.kind;
  function previewUrl(input) { return mediaKind(input) === 'image' ? objectUrl(input) : input.thumb || ''; }
  function attachmentThumbnail(input) {
    const kind=mediaKind(input), url=previewUrl(input), ext=(input.name.split('.').pop()||kind).slice(0,5).toUpperCase();
    let content=icon(kind==='file'?'script':kind);
    if(url)content=`<img src="${escape(url)}" alt="" draggable="false">`;
    else if(kind==='midi'&&input.midiPreview)content=TaanPreviews.pianoRoll(input.midiPreview);
    else if(input.text)content=`<span class="attachment-page"><span>${escape(input.text.slice(0,180))}</span></span>`;
    else if(['text','script','file'].includes(kind))content=`<span class="attachment-page attachment-page-fallback">${icon('script')}<b>${escape(ext)}</b></span>`;
    return `<span class="attachment-thumb" data-media="${kind}">${content}${kind==='video'?`<span class="attachment-video-play">${icon('play')}</span>`:''}</span>`;
  }
  async function prepareInputPreview(input) {
    if(!input.file)return;
    if(mediaKind(input)==='midi'&&input.file.size<=8*1024*1024){
      try{input.midiPreview=TaanPreviews.midiPreview(await input.file.arrayBuffer());}catch{}
    }else if(mediaKind(input)==='video'){
      input.thumb=await new Promise(resolve=>{
        const video=document.createElement('video');let done=false;
        const finish=value=>{if(done)return;done=true;clearTimeout(timer);video.removeAttribute('src');video.load();resolve(value);};
        const timer=setTimeout(()=>finish(''),8000);
        video.muted=true;video.playsInline=true;video.preload='auto';
        const capture=()=>{if(!video.videoWidth)return;try{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=Math.max(1,Math.min(100,Math.round(160*video.videoHeight/video.videoWidth)));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);finish(canvas.toDataURL('image/jpeg',.78));}catch{finish('');}};
        video.onloadeddata=()=>{if(video.duration>.15)video.currentTime=Math.min(.25,video.duration/2);else capture();};
        video.onseeked=capture;video.onerror=()=>finish('');video.src=objectUrl(input);
      });
    }
    if(inputs.includes(input)){renderInputs();renderPending();saveSoon();}
  }
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
      return `<div class="input-card ${input.placeholder?'empty-input':'filled-input'} ${input.id===selectedId?'selected':''} ${thumb?'has-thumb':''}" draggable="${!input.placeholder}" tabindex="0" role="button" aria-label="${input.kind==='audio'?'Start reference audio':input.kind==='text'?'Write a text prompt':input.placeholder?'Add '+labels[input.kind]:'Use '+escape(input.name)}" data-id="${input.id}" data-kind="${input.kind}"><div class="input-card-header">${icon(input.kind==='file'?'script':input.kind)}<span class="input-card-title">${labels[input.kind]}</span><span class="input-check-empty" aria-hidden="true"></span></div><div class="input-filename">${escape(input.name)}</div>${miniVisual(input)}${thumb?`<img class="input-thumb" src="${escape(thumb)}" alt="" draggable="false">`:''}${icon('grip','grip')}</div>`;
    }).join('');
    $$('.input-card').forEach(card => {
      card.addEventListener('click', () => attachInput(card.dataset.id));
      card.addEventListener('keydown', e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();attachInput(card.dataset.id);}});
      card.addEventListener('dragstart', e => {e.dataTransfer.setData('application/x-taan-input',card.dataset.id);e.dataTransfer.effectAllowed='copy';card.classList.add('dragging');});
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      installDropzone(card, card.dataset.kind);
    });
    renderTypes(); renderPreview();
  }
  function renderTypes() {
    $('#input-types').innerHTML = kinds.map(kind=>`<button class="type-chip ${inputs.some(i=>i.kind===kind&&!i.placeholder)?'used':''} ${inputs.find(i=>i.id===selectedId)?.kind===kind?'active':''}" data-kind="${kind}" title="Add ${labels[kind].toLowerCase()}">${icon(kind)}${kind==='midi'?'MIDI':kind[0].toUpperCase()+kind.slice(1)}</button>`).join('');
    $$('.type-chip').forEach(button => button.addEventListener('click',()=>browse(button.dataset.kind)));
  }
  function renderPreview() {
    const input = inputs.find(i=>i.id===selectedId);
    const card = $('#preview-card');
    const show=!referenceIntro&&input&&!input.placeholder&&['image','video','midi','script'].includes(mediaKind(input))&&(pending.includes(input.id)||(phase==='generating'&&currentMessage?.attachments.includes(input.id)));
    card.hidden=!show;document.body.classList.toggle('has-preview',!!show);if(!show)return;
    let media;
    if(mediaKind(input)==='image'||input.thumb) media=`<img class="preview-image" src="${escape(previewUrl(input))}" alt="${escape(input.name)}" draggable="false">`;
    else if(mediaKind(input)==='video'&&input.file) media=`<video class="preview-image" src="${escape(objectUrl(input))}" muted playsinline preload="metadata"></video>`;
    else if(mediaKind(input)==='midi') media=`<div class="preview-content">${input.midiPreview?TaanPreviews.pianoRoll(input.midiPreview):icon('midi')}</div>`;
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
    if(input.kind==='text'){selectTextInput(input);return;}
    textEntry=false;
    if(input.kind==='audio'){selectedId=id;startReferenceDemo();renderInputs();return;}
    if(input.placeholder){browse(input.kind);return;}
    selectedId=id;if(!pending.includes(id))pending.push(id);
    if(mediaKind(input)==='audio'&&input.file&&phase==='idle')setAudio(input);
    renderInputs();renderPending();if(focus)$('#prompt-input').focus();saveSoon();
  }
  function renderPending() {
    $('#prompt-form').style.setProperty('--attachment-rail-width',`${Math.min(pending.length,4)*64}px`);
    $('#pending-attachments').innerHTML=pending.map(id=>inputs.find(i=>i.id===id)).filter(Boolean).map(input=>`<span class="pending-chip" role="group" aria-label="${escape(input.name)} attachment" title="${escape(input.name)}">${attachmentThumbnail(input)}<span class="attachment-name">${escape(input.name)}</span><button type="button" aria-label="Remove ${escape(input.name)} attachment" data-remove="${input.id}">${icon('close')}</button></span>`).join('');
    $$('#pending-attachments img').forEach(img=>img.onerror=()=>{const thumb=img.closest('.attachment-thumb');thumb.innerHTML=icon(thumb.dataset.media==='video'?'video':'image');});
    $$('[data-remove]').forEach(button=>button.onclick=()=>{pending=pending.filter(id=>id!==button.dataset.remove);renderPending();saveSoon();});
    updateComposerLabel();renderPreview();
  }
  function browse(kind) {
    if(kind==='text'){closeInputMenu();selectTextInput();return;}
    textEntry=false;
    if(kind==='audio'){closeInputMenu();startReferenceDemo();return;}
    closeInputMenu();const input=$('#file-input');input.accept='';input.dataset.kind=kind||'';input.value='';input.click();
  }
  function selectTextInput(input=inputs.find(item=>item.kind==='text')) {
    textEntry=true;selectedId=input?.id||null;
    openChat(true);renderInputs();updateUI();saveSoon();
  }
  function startReferenceDemo() {
    if(phase!=='idle')return;
    engine.reset();
    referenceIntro=true;iteration=0;completedRounds=0;firstRound=true;
    // Clicking Reference audio explicitly supplies the first input. Do not
    // fabricate a typed command or submit any draft already in the editor.
    currentMessage={id:crypto.randomUUID(),text:'',attachments:[],referenceStart:true,status:'listening',reply:launchReasoning.audio};
    messages.push(currentMessage);openChat();renderMessages();
    selectScoreLoop(0);
    // Unlock the audio context in the gesture, but create no audio sources
    // during the 3s wait, 8s listening pass, or 8s generation pass.
    engine.setMuted(true);
    primeAudio();
    setPhase('starting',durations.starting);
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
    midi:['I have a MIDI file','Build around a melody.','Upload your MIDI file','MID or MIDI · Quiet Current is the demo soundtrack','MIDI file'],
    text:['I have an idea','Put the feeling into words.','Tell us what you imagine','Upload text, or write your musical direction below.','text file']
  };
  Object.values(uploadCopy).forEach(copy=>{copy[3]='Any file type · up to 250 MB. You can also use the chat to write your direction.';});
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
    $('#upload-content').innerHTML=`<div class="upload-topline"><span class="upload-step">STEP ${step+1} / ${total}</span><span class="upload-progress"><span style="width:${(step+1)/total*100}%"></span></span><button class="upload-cancel" id="wizard-cancel">Cancel</button></div>${content}<div class="upload-nav">${step?`<button class="upload-back" id="wizard-back">${icon('next')}Back</button>`:''}<button class="upload-next" id="wizard-next" ${(step===0&&!wizard.chosen.length)||(step>0&&!review&&!wizardReady(kind))?'disabled':''}>${review?'Add to composition':'Continue'}${icon('next')}</button></div><p class="upload-privacy">Files stay in this tab. Refresh starts a fresh composition.</p>`;
    $('#wizard-cancel').onclick=()=>$('#upload-dialog').close();
    $$('[data-choice]').forEach(button=>button.onclick=()=>{
      const key=button.dataset.choice;
      if(wizard.chosen.includes(key))wizard.chosen=wizard.chosen.filter(k=>k!==key);
      else{wizard.chosen.push(key);wizard.entries[key]||={files:[],text:''};}
      renderWizard();$(`[data-choice="${key}"]`).focus();
    });
    if($('#wizard-back'))$('#wizard-back').onclick=()=>{wizard.step--;renderWizard();};
    if($('#wizard-browse')){
      $('#wizard-browse').onclick=()=>{const picker=$('#wizard-file-input');picker.accept='';picker.value='';picker.click();};
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
    if(['fountain','fdx','js','py','json'].includes(ext))return 'script';
    if(file.type.startsWith('text/')||['txt','md','docx','pdf','rtf','csv'].includes(ext))return 'text';
    return 'file';
  }
  async function addFiles(files,hint) {
    let added=[];
    for(const file of files) {
      if(file.size>250*1024*1024){toast(`${file.name} is too large. Use a file under 250 MB.`);continue;}
      const detected=classify(file), kind=hint||detected, input={id:crypto.randomUUID(),name:file.name,kind,mediaKind:detected,file,used:false};
      if(['text','script'].includes(detected)&&(file.type.startsWith('text/')||/\.(txt|md|fountain|json|js|py)$/i.test(file.name))) input.text=(await file.slice(0,16000).text());
      addInputRecord(input);added.push(input);pending.push(input.id);selectedId=input.id;openChat();
      void prepareInputPreview(input);
      if(detected==='audio'&&phase==='idle')setAudio(input);
    }
    if(added.length){textEntry=false;renderInputs();renderPending();saveSoon();toast(added.length===1?`${added[0].name} added to your next idea.`:`${added.length} files added to your next idea.`);}
  }
  function installDropzone(element,kind) {
    let depth=0;
    element.addEventListener('dragenter',e=>{e.preventDefault();if(kind)e.stopPropagation();depth++;element.classList.add('drop-active');});
    element.addEventListener('dragover',e=>{e.preventDefault();if(kind)e.stopPropagation();e.dataTransfer.dropEffect='copy';});
    element.addEventListener('dragleave',e=>{if(kind)e.stopPropagation();depth--;if(depth<=0){depth=0;element.classList.remove('drop-active');}});
    element.addEventListener('drop',async e=>{
      e.preventDefault();e.stopPropagation();depth=0;element.classList.remove('drop-active');
      const id=e.dataTransfer.getData('application/x-taan-input');
      if(id){attachInput(id);return;}
      if(e.dataTransfer.files.length){await addFiles([...e.dataTransfer.files],kind);return;}
      const text=e.dataTransfer.getData('text/plain');if(text){openChat();$('#prompt-input').value=text;$('#prompt-input').focus();updateComposerLabel();saveSoon();}
    });
  }
  function renderMessages(scroll = true) {
    $('#chat-messages').innerHTML=messages.map((m,index)=>`${index?'<div class="then-divider">THEN</div>':''}<div class="message-group" data-message="${m.id}"><div class="message-meta">YOU</div><div class="user-message">${m.referenceStart?`<span class="message-attachment">${icon('audio')}<span>Reference audio</span></span>`:escape(m.text)}${m.attachments.map(id=>inputs.find(i=>i.id===id)).filter(Boolean).map(i=>`<div><span class="message-attachment">${icon(i.kind==='file'?'script':i.kind)}<span>${escape(i.name)}</span></span></div>`).join('')}</div>${m.reply?`<div class="assistant-message"><img class="message-brand-mark" src="assets/taan-mark.svg" alt=""><div>${escape(m.reply)}</div></div>`:''}</div>`).join('');
    if(scroll)$('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;
  }
  function reasoningForIdea(message) {
    const attachedKinds=message.attachments.map(id=>inputs.find(input=>input.id===id)?.kind).filter(kind=>launchReasoning[kind]);
    const mediaKinds=[...new Set(attachedKinds.filter(kind=>kind!=='text'))];
    if(mediaKinds.length)return mediaKinds.map(kind=>launchReasoning[kind]).join('\n\n');
    const text=message.text.toLowerCase();
    const cues=[
      ['script',/\b(script|ending|flute|footsteps)\b/],
      ['video',/\b(video|clip|violin|violins)\b/],
      ['midi',/\b(midi|progression|horn|horns)\b/],
      ['image',/\b(image|picture|landscape|misty|viola)\b/],
      ['text',/\b(bass|b1|g1|d2)\b|\b(four|4)\s+(slow\s+)?notes\b/],
      ['audio',/\b(hum|humming|hummed|cello)\b|make this a melody/]
    ];
    const kind=cues.find(([,pattern])=>pattern.test(text))?.[0];
    return launchReasoning[kind]||((message.textInputId||attachedKinds.includes('text'))?launchReasoning.text:'');
  }
  function captureDraft() {
    const text=$('#prompt-input').value.trim();if(!text&&!pending.length)return null;
    openChat();
    const m={id:crypto.randomUUID(),text:text||'',attachments:[...pending],status:'queued'};
    if(textEntry&&text){
      let input=inputs.find(item=>item.typedPrompt);
      if(!input){input={id:crypto.randomUUID(),kind:'text',typedPrompt:true};addInputRecord(input);}
      Object.assign(input,{text,name:text.length>52?text.slice(0,51)+'…':text});
      selectedId=input.id;m.textInputId=input.id;
    }
    m.reply=reasoningForIdea(m);
    messages.push(m);pending=[];$('#prompt-input').value='';renderPending();renderInputs();renderMessages();saveSoon();return m;
  }
  function submitIdea(e) {
    if(e)e.preventDefault();
    if(queued){toast('Your next idea is queued. You can keep a draft for the following cycle.');return;}
    const message=captureDraft();if(!message){$('#prompt-input').focus();toast('Write an idea or attach a file to begin.');return;}
    if(!activeAudioId)selectScoreLoop(0);
    primeAudio();
    if(message.textInputId&&!referenceIntro&&!['generating','ready'].includes(phase)){beginGeneration(message,false);return;}
    if(phase==='idle'){beginGeneration(message,true);return;}
    queued=message;updateUI();
    if(phase==='prompting'&&waiting){const next=queued;queued=null;beginGeneration(next,false);}
    else toast('Idea queued for the next generation.');
  }
  function beginGeneration(message,isFirst=false,audioAt) {
    currentMessage=message;if(message)message.status='generating';iteration++;
    firstRound=isFirst;renderInputs();renderMessages();setPhase('generating',isFirst?durations.first:durations.generating,audioAt);
    // Schedule ahead on the audio clock, so a frame delay cannot miss a bar.
    if(engine.epoch!==null&&!referenceIntro)queuePlayback(phaseAudioStart+phaseDuration/1000);
    saveSoon();
  }
  function setPhase(next,duration,audioAt) {
    phase=next;phaseDuration=duration;phaseStart=performance.now();paused=false;waiting=false;document.body.classList.remove('paused');
    phaseAudioStart=engine.epoch!==null&&!referenceIntro?(audioAt??engine.time):null;
    if(next==='listening')loopStart=phaseStart;
    if(engine.epoch!==null){if(!engine.playing)engine.resume();}
    else if(next!=='ready')engine.pause();
    updateUI();
  }
  function queuePlayback(notBefore) {
    if(pendingPlayback)return;
    const music=currentMessage?.attachments.map(id=>inputs.find(input=>input.id===id)).reverse().find(input=>input&&mediaKind(input)==='audio'&&input.file);
    const plan={round:iteration,message:currentMessage,music,source:music?'upload':audioSource,file:music?.file||activeUpload,index:Math.min(Math.max(0,iteration-1),soundtrack.loops.length-1),at:null};
    pendingPlayback=plan;
    if(referenceIntro)engine.reset();
    engine.setMuted(muted);
    const schedule=()=>plan.source==='upload'&&plan.file?engine.playUpload(plan.file,notBefore):engine.playScore(Math.min(plan.index+1,soundtrack.stems.length),notBefore);
    schedule().catch(error=>{
      if(pendingPlayback!==plan)return;
      if(plan.source!=='upload')throw error;
      toast('This file is saved as a reference. The Quiet Current soundtrack will keep playing.');
      plan.source='score';plan.music=null;
      return engine.playScore(Math.min(plan.index+1,soundtrack.stems.length),notBefore);
    }).then(at=>{
      if(pendingPlayback!==plan||at===undefined)return;
      plan.at=at;
      if(paused)engine.pause();
    }).catch(error=>{if(pendingPlayback===plan){pendingPlayback=null;toast(error.message||'The soundtrack could not load. Please refresh.');}});
  }
  function applyPlayback(plan) {
    pendingPlayback=null;
    if(referenceIntro){
      referenceIntro=false;
      const reference=inputs.find(input=>input.kind==='audio');if(reference)reference.used=true;
    }
    completedRounds=plan.round;
    if(plan.source==='score')selectScoreLoop(plan.index);
    else if(plan.music)setAudio(plan.music);
    if(plan.message){
      plan.message.status='done';
      const textInput=inputs.find(input=>input.id===plan.message.textInputId);if(textInput)textInput.used=true;
      plan.message.attachments.forEach(id=>{const input=inputs.find(input=>input.id===id);if(input)input.used=true;});
    }
    renderInputs();renderMessages();
    setPhase('playing',durations.playing,plan.at);saveSoon();
  }
  function nextPhase() {
    if(phase==='starting'){setPhase('listening',durations.listening);return;}
    if(phase==='listening'){
      const reference=inputs.find(input=>input.kind==='audio');
      if(reference?.placeholder)Object.assign(reference,{placeholder:false,demoReference:true,name:'Quiet Current reference'});
      beginGeneration(currentMessage,true);return;
    }
    if(phase==='generating'){queuePlayback();setPhase('ready',0);return;}
    if(phase==='playing'){firstRound=false;setPhase('prompting',durations.prompting,phaseAudioStart+phaseDuration/1000);return;}
    if(phase==='prompting'){
      // Only an explicit send creates a chat message; drafts stay in the editor.
      const message=queued;queued=null;beginGeneration(message,false,phaseAudioStart===null?undefined:phaseAudioStart+phaseDuration/1000);
    }
  }
  function updateComposerLabel() {
    const kind=textEntry?'text':pending.length?inputs.find(i=>i.id===pending[pending.length-1])?.kind:null;
    const promptNumber=phase==='prompting'||phase==='playing'?iteration+1:Math.max(1,iteration);
    $('#composer-label').textContent=`PROMPT ${promptNumber} · `+(queued?'IDEA QUEUED':phase==='generating'?'GENERATING':'YOUR IDEA')+(kind?' · '+kind.toUpperCase():'');
    $('#send-button').disabled=!!queued||(!$('#prompt-input').value.trim()&&!pending.length);
    $('#send-button').setAttribute('aria-label',textEntry&&!referenceIntro&&!['generating','ready'].includes(phase)?'Generate from text':phase==='idle'?'Send first idea':'Queue next idea');
    $('#play-button').disabled=phase==='idle'&&!completedRounds&&!pending.length&&!$('#prompt-input').value.trim();
  }
  function updateUI() {
    document.body.dataset.phase=phase;
    document.body.dataset.firstRound=String(firstRound);
    const silentMotion=referenceIntro&&phase!=='starting';
    $$('.cycle-step').forEach(step=>step.classList.toggle('active',step.dataset.phase===phase));
    $('#generation-duration').textContent='8s';
    const playing=phase==='playing';
    $('#prompt-input').placeholder=phase==='generating'&&inputs.some(i=>i.used)?'The current loop keeps playing.':'Type your next musical direction…';
    $('#loop-count').textContent=phase==='idle'?'':({starting:'Starting',listening:'Listen',playing:'Play',prompting:'Prompt',generating:'Generate',ready:'Next bar'}[phase]||'');
    document.body.classList.toggle('audio-running',(completedRounds>0||silentMotion)&&phase!=='idle'&&!paused);
    $('#stage-label').textContent=phase==='idle'?'LISTENING TO YOUR IDEAS':phase==='generating'?'SHAPING YOUR SOUND':playing?'YOUR IDEAS, IN MOTION':'WHAT SHOULD WE FEEL NEXT?';
    $('#drop-label').textContent=phase==='generating'?'A new idea is taking shape':playing?'Keep the inspiration flowing':'Drop to shape the music';
    const applied=inputs.filter(i=>i.used).length;$('#composition-meta').textContent=`${applied} ${applied===1?'input':'inputs'} applied`;
    $('#version').textContent='v'+String(Math.max(1,iteration)).padStart(2,'0');
    $('#track-title').textContent=audioSource==='score'?(activeLoop<0||completedRounds===0?'Quiet Current':`Quiet Current · ${Math.min(activeLoop+1,soundtrack.stems.length)} / ${soundtrack.stems.length} layers`):'Your music · continuous';
    $('#player-state').textContent=paused?'Paused':referenceIntro?(phase==='starting'?'Starting…':phase==='listening'?'Listening · muted':'Generating · muted'):phase==='idle'?'Ready when you are':phase==='ready'?'Ready for the next bar':`Prompt ${phase==='prompting'?iteration+1:iteration}`;
    $('#play-button').innerHTML=icon(phase!=='idle'&&!paused?'pause':'play');
    $('#play-button').setAttribute('aria-label',phase==='idle'?'Start demo playback':paused?'Resume cycle':'Pause cycle');
    $('#phase-notice-text').textContent=paused?'Take your time. The cycle is paused.':phase==='idle'?'A little direction goes a long way.':phase==='generating'?'Generating your next eight seconds.':playing?(audioSource==='score'?soundtrack.loops[activeLoop]?.title:'Your uploaded music is playing.'):queued?'Your idea is ready for the next cycle.':'Your turn. Add a direction for the next take.';
    $('#stage-caption').textContent=phase==='idle'?'An image. A melody. A feeling. Start anywhere.':phase==='generating'?'The previous loop keeps playing.':playing?'Your music, on repeat.':queued?'Your next idea is in good hands.':'Keep building. One idea at a time.';
    $('#composer-hint').textContent=queued?'Keep a draft for later':textEntry?'Enter to generate':phase==='prompting'?'Enter to send':'Type or drop an idea';
    document.body.classList.toggle('has-composition',completedRounds>0||silentMotion);renderPreview();updateComposerLabel();updateAudioIcon();
  }
  function togglePlayback() {
    if(phase==='idle'){
      if($('#prompt-input').value.trim()||pending.length){submitIdea();return;}
      primeAudio();queuePlayback();setPhase('ready',0);return;
    }
    paused=!paused;
    if(paused){pauseStarted=performance.now();engine.pause();}
    else{const pauseDuration=performance.now()-pauseStarted;phaseStart+=pauseDuration;loopStart+=pauseDuration;if(engine.epoch!==null)engine.resume();}
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
      if(pendingPlayback&&pendingPlayback.at!==null&&!paused&&engine.time>=pendingPlayback.at)applyPlayback(pendingPlayback);
      const elapsedTime=()=>Math.max(0,phaseAudioStart===null?(paused?pauseStarted:now)-phaseStart:(engine.time-phaseAudioStart)*1000);
      let elapsed=elapsedTime();
      if(phase!=='ready'&&elapsed>=phaseDuration&&!paused&&!waiting){nextPhase();elapsed=elapsedTime();}
      const remain=phase==='ready'?Math.max(0,Math.ceil((pendingPlayback?.at??engine.time)-engine.time)):waiting?0:Math.max(0,Math.ceil((phaseDuration-elapsed)/1000));
      $('#phase-countdown').textContent=waiting?'':`${String(remain).padStart(2,'0')}s`;
      $('#loop-count').textContent=paused?'Paused':waiting?'Prompt · ready when you are':`${{starting:'Starting',listening:'Listen',playing:'Play',prompting:'Prompt',generating:'Generate',ready:'Next bar'}[phase]} · ${String(remain).padStart(2,'0')}s`;
      if(completedRounds>0||(referenceIntro&&phase!=='starting')){
        const position=referenceIntro?Math.max(0,(paused?pauseStarted:now)-loopStart)%8000:engine.position*1000,progress=position/8000;
        $('#playhead').style.left=`${progress*100}%`;
        waveBars.forEach((bar,i)=>bar.classList.toggle('passed',i/waveBars.length<=progress));
        const sec=Math.floor(position/1000);if(sec!==lastSecond){$('#play-time').innerHTML=`00:${String(sec).padStart(2,'0')} <span>/ 00:08</span>`;lastSecond=sec;}
      }else{waveBars.forEach(bar=>bar.classList.remove('passed'));$('#play-time').innerHTML='00:00 <span>/ 00:08</span>';lastSecond=-1;}
    }else{$('#phase-countdown').textContent='';}
    requestAnimationFrame(tick);
  }
  function setAudio(input) {
    if(activeAudioId===input.id)return;
    audioSource='upload';activeLoop=-1;activeAudioId=input.id;activeUpload=input.file;
    updateAudioIcon();
  }
  function primeAudio() {
    engine.prepare().catch(error=>toast(error.message||'The soundtrack could not load. Please try again.'));
    if(activeUpload)engine.prepareUpload(activeUpload).catch(()=>{});
  }
  function selectScoreLoop(index) {
    const section=soundtrack.loops[index];if(!section)return;
    activeLoop=index;audioSource='score';activeAudioId='quiet-current-'+section.number;activeUpload=null;
  }
  function startAudio() {
    if(!activeAudioId||referenceIntro)return;
    engine.setMuted(muted);
    if(engine.epoch!==null){engine.resume();return;}
    const playback=audioSource==='upload'&&activeUpload?engine.playUpload(activeUpload):engine.playScore(Math.min(activeLoop+1,soundtrack.stems.length));
    playback.catch(error=>{
      if(audioSource==='upload'){
        toast('This file is saved as a reference. The Quiet Current soundtrack will keep playing.');
        selectScoreLoop(Math.min(Math.max(0,iteration-1),soundtrack.loops.length-1));
        engine.playScore(Math.min(activeLoop+1,soundtrack.stems.length)).catch(()=>toast('The soundtrack could not load. Please refresh.'));
        updateUI();
      }else toast(error.message||'The soundtrack could not load. Please refresh.');
    });
  }
  function updateAudioIcon(){const button=$('#mute-button');button.disabled=referenceIntro;button.innerHTML=icon(referenceIntro||!activeAudioId||muted?'muted':'volume');button.title=referenceIntro?'Muted during the reference intro':activeAudioId?(muted?'Unmute music':'Mute music'):'Upload your own music';button.setAttribute('aria-label',button.title);}
  function showDialog(content) {$('#dialog-content').innerHTML=content;$('#info-dialog').showModal();}
  function timingDialog() {showDialog(`<span class="dialog-eyebrow">QUIET CURRENT</span><h2>One idea. Eight seconds.</h2><p>Click Reference audio to begin, with no import window. Wait 3 seconds, then watch an 8-second muted listening pass and an 8-second muted generation pass. The music then starts from the beginning for 8 seconds.</p><div class="timing-row"><span>01</span>Prompt the next idea<b>8 seconds</b></div><div class="timing-row"><span>02</span>Generate<b>8 seconds</b></div><div class="timing-row"><span>03</span>Play the next section<b>8 seconds</b></div><p>The music continues through Prompt and Generate. The next instrument stays silent until a new 8-second musical bar begins. Its sound and the visible layer count change together at that boundary. If generation finishes mid-bar, the player shows Next bar while the current music continues. Choose Text to type in the prompt bar. Enter starts 8 seconds of generation immediately, then a complete 8-second playback on the next musical bar; Shift+Enter adds a new line. Drafts stay in the prompt bar until you press Enter or Send. Sending during generation queues your idea for the next round. The timed sequence continues even if you leave the prompt blank.</p><p>Quiet Current contains eight sections: cello, then bass, viola, horns, violins, and flute. Sections 6–8 contain the full arrangement. After section 8, the full arrangement continues looping. Upload audio to use your own music instead. References play through without jumping back every eight seconds.</p><p>Six synchronized instrument tracks keep running continuously. New instruments fade in without restarting existing notes. Prompts do not change the prepared notes. The approved launch-script reasoning appears when you submit an idea or click Reference audio. Unsent drafts and automatic cycles add no chat replies.</p><button class="dialog-primary" id="dialog-done">Continue</button>`);$('#dialog-done').onclick=()=>$('#info-dialog').close();}
  function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3800);}
  function setTheme(theme){document.documentElement.dataset.theme=theme;try{localStorage.setItem('taan-demo-theme',theme);}catch{}$('#theme-toggle').innerHTML=icon(theme==='dark'?'sun':'moon');$('#theme-toggle').title=theme==='dark'?'Switch to reference light palette':'Switch to Taan dark palette';$('#theme-toggle').setAttribute('aria-label',$('#theme-toggle').title);$('meta[name="theme-color"]').content=theme==='dark'?'#0e0b0a':'#faf8ef';}
  function resetDemo(){pendingPlayback=null;phaseAudioStart=null;textEntry=false;referenceIntro=false;activeLoop=-1;audioSource='score';completedRounds=0;loopStart=0;lastAudioLoop=-1;lastSecond=-1;engine.reset();activeUpload=null;activeAudioId=null;urlCache.forEach(url=>URL.revokeObjectURL(url));urlCache.clear();inputs=emptyInputs();selectedId=null;openChat();pending=[];messages=[];queued=null;phase='idle';paused=false;iteration=0;firstRound=true;waiting=false;currentMessage=null;$('#prompt-input').value='';$('#play-time').innerHTML='00:00 <span>/ 00:08</span>';document.body.classList.remove('paused');waveBars.forEach(b=>b.classList.remove('passed'));renderInputs();renderPending();renderMessages(false);updateUI();clearTimeout(saveTimer);saveSession();toast('A fresh composition. Start with anything.');}
  function exportSession(){const data={format:'taan-composition-demo',version:2,title:$('#project-title').value,style,exportedAt:new Date().toISOString(),timing:{referenceWaitSeconds:3,referenceMutedListeningSeconds:8,referenceMutedGenerationSeconds:8,initialGenerationSeconds:8,textGenerationSeconds:8,promptSeconds:8,generationSeconds:8,playbackSeconds:8,continuousAudio:true,layerChangesOnBarBoundary:true,phaseOrder:['prompt','generate','play'],scoreLoopSeconds:8,scoreLoopCount:8},soundtrack:{title:soundtrack.title,source:soundtrack.source,activeLoop:activeLoop+1,audioSource},inputs:inputs.filter(i=>!i.placeholder).map(({file,...input})=>({...input,size:file?.size,mimeType:file?.type})),ideas:messages,draft:$('#prompt-input').value,note:'Interface prototype. Uploaded files are kept only for this page session and are not embedded in this JSON export.'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=($('#project-title').value||'taan-composition').replace(/[^a-z0-9_-]/gi,'-').toLowerCase()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Session exported. Files stay in this tab until refresh.');}
  function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveSession,350);}
  function saveSession(){$('#save-status').textContent='Session only';}
  function clearLegacySession(){
    // Composition data is intentionally memory-only: every refresh starts fresh.
    try{indexedDB.deleteDatabase('taan-composition-smooth-v5');}catch{}
    saveSession();
  }
  // Decorative geometry is deterministic, so the layout has no loading dependency.
  $('#orb').innerHTML=Array.from({length:12},(_,i)=>`<ellipse cx="250" cy="250" rx="${165+i%3*4}" ry="${139+i%4*4}" transform="rotate(${i*15} 250 250)"/>`).join('')+Array.from({length:46},(_,i)=>{const angle=i*2.39996,r=187+(i%7)*7;return `<circle cx="${250+Math.cos(angle)*r}" cy="${250+Math.sin(angle)*r}" r="${i%3===0?1.1:.6}" fill="currentColor" stroke="none" opacity=".55"/>`;}).join('');
  $('#file-input').addEventListener('change',e=>addFiles([...e.target.files],e.target.dataset.kind));
  $('#open-chat').onclick=()=>openChat(true);
  $('#add-input').onclick=()=>browse();$('#attach-input').onclick=toggleInputMenu;$('#composition-drop').onclick=()=>browse();$('#write-input').onclick=()=>selectTextInput();
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
  $('#mute-button').onclick=()=>{if(referenceIntro)return;if(!activeAudioId){browse();return;}if(!engine.playing&&completedRounds>0&&!paused){muted=false;startAudio();}else{muted=!muted;engine.setMuted(muted);}updateAudioIcon();};
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
  window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);saveSession();engine.pause();});
  let initialTheme='dark';try{initialTheme=localStorage.getItem('taan-demo-theme')||'dark';}catch{}setTheme(initialTheme);
  openChat();renderInputs();renderPending();renderMessages(false);updateUI();clearLegacySession();requestAnimationFrame(tick);
})();
