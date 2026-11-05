# JC demo — Quiet Current

A local Taan composition UI prototype with a clean opening, an empty chat, native file picking and drag-and-drop. The supplied Quiet Current MIDI is split into eight two-bar sections at 60 BPM.

## Run

Serve this folder locally (the audio engine loads the instrument files over HTTP):

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Visit http://127.0.0.1:5173. No build, package installation, API key or backend is required.

## Timing

The initial prompt has no typing deadline. Choose Text to write directly in the prompt bar; no import dialog opens. Enter (or the send button) starts 8 seconds of generation, followed by 8 seconds of playback. Shift+Enter adds a new line. Text waits for an explicit send, even if the 8-second prompt window ends. During an active generation or the reference intro, a new submission queues for the next round.

Click the Reference audio card to run the intro. It does not open a file picker or add anything to the chat.

| Time after click | Behaviour |
| --- | --- |
| 0–3 seconds | Wait; orb and energy bar remain still and silent |
| 3–11 seconds | Orb spins; energy bar moves for 8 seconds, muted |
| 11–15 seconds | R/logo generation animation for 4 seconds, still muted |
| 15–23 seconds | Music starts at sample zero and plays audibly for 8 seconds |
| 23–31 seconds | Prompt the next idea for 8 seconds |
| 31–39 seconds | Generate for 8 seconds |
| 39–47 seconds | Play the next instrument layer for 8 seconds |

The intro creates no audio sources until the audible pass begins. Its mute control stays locked during the silent passes. The reference card colours after the listening pass; its check box stays empty. Pause freezes the intro clock, and reset cancels it. Repeated Reference audio clicks do not restart an active sequence.


| Round | Prompt | Generate | Play |
| --- | --- | --- | --- |
| 1 | Submit when ready | 4 seconds (8 seconds for Text) | Section 1 for 8 seconds |
| 2 | 8 seconds | 8 seconds | Section 2 for 8 seconds |
| 3 | 8 seconds | 8 seconds | Section 3 for 8 seconds |
| Following rounds | 8 seconds | 8 seconds | Next section for 8 seconds |

All six instrument tracks start on the same audio clock and run continuously. Muted layers fade in over 850 milliseconds as their Play phase begins. Existing instruments are never stopped, reloaded, or rewound at a phase boundary. Music continues throughout Prompt and Generate. Each round from Prompt 2 takes 24 seconds. For file inputs, send early to queue an idea; an unsent nonempty draft submits automatically at the end of Prompt. Text mode lets Enter finish the prompt window early and start generation immediately. In Text mode, the next prompt waits for a send. Otherwise the timed sequence continues if the prompt is blank, without inventing chat messages.

Pause freezes the phase clock, waveform and audio together. Resume continues from that point. The first eight rounds take 191 seconds from a Reference audio click, excluding pauses (or 180 seconds when started by a regular first idea; Text uses 8 seconds of generation and waits for subsequent sends). After section 8, the complete arrangement keeps looping in the same 8 / 8 / 8 cycle.

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

- Reference audio is a start button and never opens an import dialog. Text selects direct typing in the prompt bar and never opens Finder. The other four cards open an unrestricted native file picker. Any file can still be dropped onto any category, including Reference audio; Add an input and Combined inputs also accept reference audio uploads. The selected category stays on the left; actual file type controls preview and audio decoding.
- Drop a file directly onto a card to use that category, or onto the panel, center or composer for automatic classification. The plus menu also supports combined inputs.
- Each card fills with colour as soon as it receives a file. Its visual check box remains empty, including after generation.
- The chat is visible and empty on a fresh session. It accepts typed prompts and attachments. There are no seeded prompts or canned assistant replies; authored replies can be added later through the message reply field. A submitted Text prompt colours the Text card, while leaving its check box empty. Ordinary chat prompts outside Text mode do not fill an input card.
- Rename the composition in the header; switch between the dark live-app styling and light reference palette.
- Export downloads session metadata and prompt history as JSON; original media is not embedded.
- The three-dot menu starts a fresh composition or explains the timing.
- User files and drafts stay in this browser's IndexedDB. Version 5 starts fresh without importing earlier prototype sessions.
- Optional microphone dictation uses the browser's speech-recognition service after activation.

Files can be up to 250 MB each. Supported media formats depend on the browser. MP3 and WAV work well for audio.
