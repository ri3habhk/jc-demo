# JC demo — Quiet Current

A local Taan composition UI prototype with a clean opening, an empty chat, native file picking and drag-and-drop. The supplied Quiet Current MIDI is split into eight two-bar sections at 60 BPM.

## Run

Serve this folder locally (the audio engine loads the instrument files over HTTP):

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Visit http://127.0.0.1:5173. No build, package installation, API key or backend is required.

## Timing

Send the first idea to start. The initial prompt has no typing deadline.

Alternatively, click the Reference audio card: exactly two seconds after the click, the music starts and the central Taan mark begins its generation rotation. The file picker still opens normally. The shortcut works without selecting a file or entering a prompt, and leaves the chat empty. Its four-second generation animation runs over the music, then the usual eight-second phases continue. Repeated clicks do not queue multiple starts; resetting the composition or submitting a prompt cancels the pending shortcut.

| Round | Prompt | Generate | Play |
| --- | --- | --- | --- |
| 1 | Submit when ready | 4 seconds | Section 1 for 8 seconds |
| 2 | 8 seconds | 8 seconds | Section 2 for 8 seconds |
| 3 | 8 seconds | 8 seconds | Section 3 for 8 seconds |
| Following rounds | 8 seconds | 8 seconds | Next section for 8 seconds |

All six instrument tracks start on the same audio clock and run continuously. Muted layers fade in over 850 milliseconds as their Play phase begins. Existing instruments are never stopped, reloaded, or rewound at a phase boundary. Music continues throughout Prompt and Generate. Each round from Prompt 2 takes 24 seconds. Send early to queue an idea; an unsent nonempty draft submits automatically at the end of Prompt. The timed sequence continues if the prompt is blank, without inventing chat messages.

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

The browser plays six synchronized instrument stems prepared from the original MIDI parts. Release and reverb tails wrap into the next musical bar; matching cello notes are tied over the phrase boundary. The loop boundary has no whole-mix fade or gap. The eight cumulative WAV previews are also rebuilt from these stems. The prototype does not synthesize arbitrary MIDI or alter notes in response to prompts.

Upload reference audio to replace the prepared soundtrack when that idea finishes generation. Uploaded audio plays through its full length, with a short overlapping blend at its own loop seam. It is never rewound at an eight-second UI boundary. Other uploaded files serve as visual or textual references.

## Inputs and controls

The energy player and prompt box share the same width and 108-pixel height. Their top and bottom edges align on desktop; on smaller screens they stack with matching dimensions.

- All six input cards, including Text, open an unrestricted native file picker. Any file can be placed in any category. The selected category stays on the left; actual file type controls preview and audio decoding.
- Drop a file directly onto a card to use that category, or onto the panel, center or composer for automatic classification. The plus menu also supports combined inputs.
- Each card fills with colour as soon as it receives a file. Its visual check box remains empty, including after generation.
- The chat is visible and empty on a fresh session. It accepts typed prompts and attachments. There are no seeded prompts or canned assistant replies; authored replies can be added later through the message reply field. Plain chat prompts do not fill an input card.
- Rename the composition in the header; switch between the dark live-app styling and light reference palette.
- Export downloads session metadata and prompt history as JSON; original media is not embedded.
- The three-dot menu starts a fresh composition or explains the timing.
- User files and drafts stay in this browser's IndexedDB. Version 5 starts fresh without importing earlier prototype sessions.
- Optional microphone dictation uses the browser's speech-recognition service after activation.

Files can be up to 250 MB each. Supported media formats depend on the browser. MP3 and WAV work well for audio.
