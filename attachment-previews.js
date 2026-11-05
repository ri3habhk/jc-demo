/* Lightweight local previews. No file contents leave the browser. */
(() => {
  'use strict';
  function midiPreview(buffer) {
    const bytes=new Uint8Array(buffer), view=new DataView(buffer);
    if(bytes.length<14||String.fromCharCode(...bytes.slice(0,4))!=='MThd')return null;
    const header=view.getUint32(4), tracks=view.getUint16(10);
    if(header<6||header+8>bytes.length||tracks>256)return null;
    let offset=8+header, budget=100000;
    const notes=[];
    for(let track=0;track<tracks&&offset+8<=bytes.length&&budget>0;track++){
      const tag=String.fromCharCode(...bytes.slice(offset,offset+4));
      const end=offset+8+view.getUint32(offset+4);
      if(end>bytes.length)return null;
      offset+=8;if(tag!=='MTrk'){offset=end;continue;}
      let tick=0,running=0;
      const active=new Map();
      const variable=()=>{let value=0;for(let count=0;count<4;count++){if(offset>=end)throw Error('Truncated MIDI');const byte=bytes[offset++];value=(value<<7)|(byte&127);if(!(byte&128))return value;}throw Error('Invalid MIDI length');};
      try{
        while(offset<end&&budget-->0){
          tick+=variable();let status=bytes[offset];
          if(status&128){offset++;if(status<240)running=status;}else status=running;
          if(!status)break;
          if(status===255){offset++;const length=variable();offset+=length;running=0;continue;}
          if(status===240||status===247){const length=variable();offset+=length;running=0;continue;}
          if(status>=240)break;
          const kind=status>>4, channel=status&15, length=kind===12||kind===13?1:2;
          if(offset+length>end)break;
          const pitch=bytes[offset++],velocity=length===2?bytes[offset++]:0,key=channel+':'+pitch;
          if(kind===9&&velocity){if(!active.has(key))active.set(key,[]);active.get(key).push(tick);}
          else if(kind===8||(kind===9&&!velocity)){
            const starts=active.get(key);if(starts?.length){const start=starts.shift();if(tick>start&&notes.length<192)notes.push({start,end:tick,pitch});}
          }
        }
      }catch{return null;}
      offset=end;
    }
    if(!notes.length)return null;
    notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
    return {notes:notes.slice(0,96)};
  }
  function pianoRoll(preview) {
    if(!preview?.notes?.length)return '';
    const notes=preview.notes, start=Math.min(...notes.map(n=>n.start)), end=Math.max(...notes.map(n=>n.end));
    const low=Math.min(...notes.map(n=>n.pitch))-1, high=Math.max(...notes.map(n=>n.pitch))+1;
    const bars=notes.map(n=>`<rect x="${(4+(n.start-start)/(end-start)*92).toFixed(2)}" y="${(4+(high-n.pitch)/(high-low)*36).toFixed(2)}" width="${Math.max(2,(n.end-n.start)/(end-start)*92).toFixed(2)}" height="3" rx=".7"/>`).join('');
    return `<svg class="attachment-piano-roll" viewBox="0 0 100 48" aria-hidden="true"><path d="M0 12H100M0 24H100M0 36H100M25 0V48M50 0V48M75 0V48"/>${bars}</svg>`;
  }
  globalThis.TaanPreviews={midiPreview,pianoRoll};
})();
