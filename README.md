# JC demo — Quiet Current

A local Taan composition UI prototype with a clean opening, an empty chat, native file picking and drag-and-drop. The supplied Quiet Current MIDI is split into eight two-bar sections at 60 BPM.

## Run

Open `index.html` directly, or serve this folder:

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Visit http://127.0.0.1:5173. No build, package installation, API key or backend is required.

## Timing

Send the first idea to start. The initial prompt has no typing deadline.

| Round | Prompt | Generate | Play |
| --- | --- | --- | --- |
| 1 | Submit when ready | 4 seconds | Section 1 for 8 seconds |
| 2 | 8 seconds | 8 seconds | Section 2 for 8 seconds |
| 3 | 8 seconds | 8 seconds | Section 3 for 8 seconds |
| Following rounds | 8 seconds | 8 seconds | Next section for 8 seconds |

The previous section keeps looping throughout Prompt and Generate. A new section starts only when its Play phase begins. Each round from Prompt 2 takes 24 seconds. Send early to queue an idea; an unsent nonempty draft submits automatically at the end of Prompt. The timed sequence continues if the prompt is blank, without inventing chat messages.

Pause freezes the phase clock, waveform and audio together. Resume continues from that point. The first eight rounds take 180 seconds, excluding initial typing and pauses. After section 8, the complete arrangement keeps looping in the same 8 / 8 / 8 cycle.

## MIDI and audio

`assets/quiet-current/` contains the original 64-second MIDI, eight standalone 8-second MIDI files, eight matching WAV previews, and a manifest. MIDI files retain instrument tracks, tempo, key, meter, program changes and controller settings. Import at 60 BPM in 4/4; each loop is two bars.

| Section | Source time | Arrangement |
| --- | --- | --- |
| 1 | 00–08s | Cello melody |
| 2 | 08–16s | Cello + double bass |
| 3 | 16–24s | Add viola |
| 4 | 24–32s | Add French horns |
| 5 | 32–40s | Add violins |
| 6 | 40–48s | Add flute; full arrangement |
| 7 | 48–56s | Full arrangement |
| 8 | 56–64s | Full arrangement |

The browser plays prepared WAV previews from the original MIDI render. Every WAV is exactly eight seconds with a short edge fade to avoid clicks. The prototype does not synthesize arbitrary MIDI or alter notes in response to prompts.

Upload reference audio to replace the prepared soundtrack when that idea finishes generation. Uploaded audio repeats from the beginning every eight seconds; shorter audio loops within the window. Other uploaded files serve as visual or textual references.

## Inputs and controls

- Click Audio, Image, MIDI, Video or Script to open the native file picker; click Text to write a direction.
- Drop files onto the left panel, center or composer. The plus menu also supports combined inputs.
- Rename the composition in the header; switch between the dark live-app styling and light reference palette.
- Export downloads session metadata and prompt history as JSON; original media is not embedded.
- The three-dot menu starts a fresh composition or explains the timing.
- User files and drafts stay in this browser's IndexedDB. Version 4 starts fresh without importing earlier prototype sessions.
- Optional microphone dictation uses the browser's speech-recognition service after activation.

Files can be up to 250 MB each. Supported media formats depend on the browser. MP3 and WAV work well for audio.
