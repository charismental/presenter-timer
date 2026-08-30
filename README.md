# Presenter Timer

A small Electron overlay in the spirit of [CueTimer's presenter window](https://cuetimer.com/presenter/): a resizable countdown, stopwatch, or clock you can park over slides. It is built to stay out of the way of a USB clicker.

## Why the clicker still works

The overlay window is **not focusable**. Page Down, arrows, and the usual presenter-remote keys keep going to PowerPoint, Keynote, Google Slides, or whatever already has focus.

**Click-through is on by default**, so mouse clicks also pass through to the deck. Turn it off from the control window (or the tray menu) when you want to drag or resize the overlay, then turn it back on before you present.

The overlay stays **always on top**, including over fullscreen slides.

## Features

- Countdown, stopwatch, and wall clock
- Drag to move, native resize from the window edges
- Duration presets (5 / 10 / 15 / 20 / 30 / 45 minutes) plus a custom H:M:S setter
- ±1 minute while a talk is running
- Gentle overtime flash (slow red pulse, not a strobe)
- Optional progress bar and secondary clock
- Stage, light, and high-contrast looks
- Hover chrome on the overlay when click-through is off

## Run it

```bash
npm install
npm start
```

That opens the floating overlay and a control window. Use the control window or the tray icon for start / pause / reset.

### Browser preview

The timer UI can also be tried in a browser (no always-on-top or click-through there):

```bash
npm run preview
```

Then open `http://127.0.0.1:45331`.

## Presenting

1. Set a duration and place the overlay on a corner of the slide display.
2. Leave **Click-through** enabled.
3. Start the countdown from the control window or tray.
4. Advance slides with the clicker as usual.
5. If you go long, the digits pulse warm red until you reset.

## Repo

https://github.com/charismental/presenter-timer
