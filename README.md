# JC demo — Quiet Current

A local Taan composition UI prototype with a clean opening, an empty chat, native file picking and drag-and-drop. Quiet Current uses eight two-bar sections at 60 BPM, with a revised four-note double bass phrase: B1 → F#2 → G1 → D2, one note every two seconds.

## Run

Serve this folder locally (the audio engine loads the instrument files over HTTP):

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Visit http://127.0.0.1:5173. No build, package installation, API key or backend is required.

## Timing

The initial prompt has no typing deadline. Choose Text to write directly in the prompt bar; no import dialog opens. Enter (or the send button) starts 8 seconds of generation. The next layer then begins on the next 8-second musical boundary and plays for a complete 8 seconds. If generation finishes mid-bar, the existing layers continue while the player shows “Next bar”. Shift+Enter adds a new line. Drafts wait for an explicit send. The timed music cycle continues without adding messages if the 8-second prompt window ends before you send. During an active generation or the reference intro, a new submission queues for the next round.

Click the Reference audio card to run the intro. It does not open a file picker. This explicit input adds a Reference audio chip and the approved cello reasoning to the chat without submitting a draft.

| Time after click | Behaviour |
| --- | --- |
| 0–3 seconds | Wait; orb and energy bar remain still and silent |
| 3–11 seconds | Orb spins; energy bar moves for 8 seconds, muted |
| 11–19 seconds | R/logo generation animation for 8 seconds, still muted |
| 19–27 seconds | Music starts at sample zero and plays audibly for 8 seconds |
| 27–35 seconds | Prompt the next idea for 8 seconds |
| 35–43 seconds | Generate for 8 seconds |
| 43–51 seconds | Play the next instrument layer for 8 seconds |

The intro creates no audio sources until the audible pass begins. Its mute control stays locked during the silent passes. The reference card colours after the listening pass; its check box stays empty. Pause freezes the intro clock, and reset cancels it. Repeated Reference audio clicks do not restart an active sequence.


| Round | Prompt | Generate | Play |
| --- | --- | --- | --- |
| 1 | Submit when ready | 8 seconds | Section 1 for 8 seconds |
| 2 | 8 seconds | 8 seconds | Section 2 for 8 seconds |
| 3 | 8 seconds | 8 seconds | Section 3 for 8 seconds |
| Following rounds | 8 seconds | 8 seconds | Next section for 8 seconds |

All six instrument tracks start on the same audio clock and run continuously. Layer changes are scheduled ahead on exact multiples of eight seconds from the audio start. A new layer stays fully muted until that boundary, then fades in over 850 milliseconds. The visible layer count, playhead and Play phase use that same clock; the count never advances while waiting for the boundary. Existing instruments are never stopped, reloaded, or rewound at a phase boundary. Music continues throughout Prompt and Generate. Automatic rounds from Prompt 2 take 24 seconds. Manually submitted prompts can add up to one bar of waiting after generation so a new instrument never enters partway through the music. Send early to queue an idea. Drafts and attachments never submit automatically when a timer ends. Text mode lets Enter finish the prompt window early and start generation immediately. The timed sequence continues without inventing chat messages, and any unsent draft stays in the prompt bar.

Pause freezes the phase clock, waveform, audio and scheduled layer changes together. Reset cancels scheduled changes. Resume continues from that point. The first eight rounds take 195 seconds from a Reference audio click, excluding pauses (or 184 seconds when started by a regular first idea). After section 8, the complete arrangement keeps looping in the same 8 / 8 / 8 cycle.

## MIDI and audio

`assets/quiet-current/` contains the preserved original 64-second MIDI, the revised `Taan_Quiet_Current_Build_64s_FourNoteBass.mid`, eight standalone 8-second MIDI files, eight matching WAV previews, and a manifest. MIDI files retain instrument tracks, tempo, key, meter, program changes and controller settings. Import at 60 BPM in 4/4; each loop is two bars.

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

The browser plays six synchronized instrument stems prepared from the MIDI parts with the four-note bass revision. Release and reverb tails wrap into the next musical bar; matching cello notes are tied over the phrase boundary. The loop boundary has no whole-mix fade or gap. The eight cumulative WAV previews are also rebuilt from these stems. The prototype does not synthesize arbitrary MIDI or alter notes in response to prompts.

Upload reference audio to replace the prepared soundtrack when that idea finishes generation. Uploaded audio plays through its full length, with a short overlapping blend at its own loop seam. It is never rewound at an eight-second UI boundary. Other uploaded files serve as visual or textual references.

## Inputs and controls

The energy player and prompt box share the same width and 108-pixel height. Their top and bottom edges align on desktop; on smaller screens they stack with matching dimensions.

- Reference audio is a start button and never opens an import dialog. Text selects direct typing in the prompt bar and never opens Finder. The other four cards open an unrestricted native file picker. Any file can still be dropped onto any category, including Reference audio; Add an input and Combined inputs also accept reference audio uploads. The selected category stays on the left; actual file type controls preview and audio decoding.
- Drop a file directly onto a card to use that category, or onto the panel, center or composer for automatic classification. The plus menu also supports combined inputs.
- MIDI, image, video and script uploads appear immediately as removable thumbnails inside the prompt box, before you type or send. Images show their actual image, videos show a frame, MIDI shows a note preview, and plain-text scripts show a miniature page. Unsupported previews retain a file-type tile. Multiple attachments scroll horizontally on small screens.
- Each card fills with colour as soon as it receives a file. Its visual check box remains empty, including after generation.
- Refresh starts a completely new composition: empty input cards, chat and prompt bar, no attachments, and no playback progress. Previous uploads, messages and drafts are not restored. Messages appear only after you press Enter or Send, or explicitly start Reference audio. It accepts typed prompts and attachments. The six approved launch-script replies appear immediately beneath submitted inputs, including attachment-only image submissions and queued ideas. Input categories select the reply; matching command words support typed or dictated launch prompts. Unmatched ordinary chat receives no invented reply. Uploading, typing, and automatic cycles alone add no messages. A submitted Text prompt colours the Text card, while leaving its check box empty. Ordinary chat prompts outside Text mode do not fill an input card.
- Rename the composition in the header; switch between the dark live-app styling and light reference palette.
- Export downloads session metadata and prompt history as JSON; original media is not embedded.
- The three-dot menu starts a fresh composition or explains the timing.
- Composition data and uploaded files stay only in memory for the current tab. Nothing is saved between reloads. The obsolete saved-session database is cleared when available; old sessions are never read. Only the light/dark theme preference is retained.
- Optional microphone dictation uses the browser's speech-recognition service after activation.

Files can be up to 250 MB each. Supported media formats depend on the browser. MP3 and WAV work well for audio.

## Launch-script reasoning

The replies are authored demo copy. They describe the approved cello, four-note bass, misty-landscape image with restrained viola, MIDI horns, video violins, and script-ending directions. The image reasoning follows the revised launch script and matches the prepared viola layer. The current prepared soundtrack still uses flute without percussion at the ending; adding the replies does not alter audio assets or timing.
