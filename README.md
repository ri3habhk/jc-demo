# JC demo

A local dummy website matching the supplied 2m20s video’s clean layout, with the signed-in app.taan.ai wordmark, floral background, Switzer typography, dark surfaces, cream controls, and subtle orange accents.

## Open

Open `index.html` directly, or serve this directory:

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Visit http://127.0.0.1:5173. No build or package installation is needed.

## Interaction

- A fresh composition starts with zero inputs, no example messages, no media preview, and an empty player. The right chat opens when you select or add an input, or click the small composer button beside “Your composition.”
- The left side has six input types: audio, text, image, MIDI, video, and script. Click a file type to open the native file chooser. Click Text to write directly in the empty composer.
- Drop files onto the left panel, center, or composer. Uploading fills the matching empty slot. Files remain local to this browser.
- Media previews appear only while preparing or generating from the relevant input, then return to the central Taan animation. Inputs become applied only when generation finishes.
- The composer’s plus menu supports individual file types and a combined-input flow. A cancelled combined-input flow changes nothing.

## Timing and audio

The first prompt has a 4-second simulated generation. After that, each composition passes through three 8-second loops:

1. **Play — 8 seconds.** Listen or prepare another idea.
2. **Prompt — 8 seconds.** Enter the next direction. A nonempty draft sends at the end of this window.
3. **Generate — 8 seconds.** The current loop keeps playing while the next input is prepared.

The player shows `1 / 3`, `2 / 3`, and `3 / 3`. The next input is applied at the following loop boundary. If no idea is ready, the loop continues while waiting for one.

Playback is silent until you upload music. Uploaded audio repeats from its beginning every 8 seconds; shorter files loop within that window. Audio continues during prompting and generation, like the reference video. A new audio reference takes over when its generation finishes. Pause freezes the phase timer, waveform, and audio together.

This is a UI prototype: it does not generate or modify music, synthesize MIDI, or interpret media content. MIDI is accepted as a reference. The most recently applied audio file is the audible source.

## Other controls

- Rename the composition in the header. The sun/moon button switches between the live app’s dark styling and the original image’s light palette.
- Export downloads session metadata and prompt history as JSON; original media is not embedded.
- The three-dot menu starts a fresh composition or explains the timing.
- Files and session data persist locally using IndexedDB when supported. The clean version uses its own storage, so previous prototype sessions are not loaded into the opening screen.
- Optional microphone dictation uses the browser’s speech-recognition service after you activate it. Support depends on the browser and microphone permission.

Files can be up to 250 MB each. Audio/video support depends on browser codecs; MP3 and WAV work well for audio.
