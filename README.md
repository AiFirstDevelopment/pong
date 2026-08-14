# Pong you can type from memory

Single-player Pong on an HTML 2D canvas: about 85 lines of TypeScript, no
framework and no bundler. `tsc` emits one plain script that [index.html](index.html)
loads directly, so it runs from `file://` with no server at all.

## Run it

```bash
npm install
npm run build     # makes game.js
open index.html
```

Re-run `npm run build` after every edit, or leave `npm run watch` going in a
second terminal. `npm start` builds and serves it on http://localhost:8080
instead, if you would rather use a real URL.

## Type it in this order

Each block is numbered in [game.ts](game.ts). Build and refresh after each one —
seeing something change every 5 minutes is the whole point.

| # | Block | What you should see |
| --- | --- | --- |
| 1 | Get the canvas and context | Nothing yet — but no errors in the console |
| 2–3 | Constants, then the `let` variables | Still nothing |
| 8 + 9 | Skip ahead: `draw()` and `loop()` | The court, the paddle, the start prompt |
| 4 | `resetBall()`, called at the bottom | The ball appears at the right edge |
| 5 | The `mousemove` listener | The paddle follows the mouse |
| 6 | The click handler and `beep()` | Clicking clears the prompt — nothing moves yet |
| 7 | `update()`, called from `loop()` | Click, and it is a game: bounces, score, beeps |

Writing `draw()` before `update()` is the trick worth keeping: get something on
screen first, then make it move. It is much easier to debug a game you can see.

## The four ideas

Everything else is detail.

1. **A frame is: erase, move, redraw.** `draw()` repaints the entire canvas each
   time. Nothing on a canvas remembers itself.
2. **Movement is addition.** `ballX += ballSpeedX * dt`, once per frame, where
   `dt` is how many seconds that frame took. Speed times time is distance.
3. **A bounce is a flipped sign.** `ballSpeedY = -ballSpeedY`.
4. **A collision is a rectangle overlap.** Two boxes overlap when each one
   starts before the other one ends, on both axes.

## What is deliberately missing

So you know these are choices, not omissions:

- **Lives, pause, game over.** A miss just resets the score to 0.
- **Angle control.** Here the ball bounces off the paddle at a mirrored angle,
  so a rally can get repetitive. Real Pong varies the angle by where you hit.
- **Particles, glow, crisp text on retina screens.** Garnish.

Sound is block 6, and it comes with a rule worth knowing: browsers refuse to
play audio until the player has interacted with the page, and moving the mouse
does not count. That is why one click does double duty — it starts play *and*
builds the `AudioContext`. The `running` flag is the whole of it: `update()`
returns early while it is false, and `draw()` shows the prompt.

The paddle deliberately tracks the mouse before the click, so you can line
yourself up before the ball moves. That is why the clamp sits above the
`if (!running) return;` and not below it.

What is *not* missing is delta time: `loop()` measures the gap between frames so
speeds are pixels per second. Without it, a 120 Hz screen plays the whole game
at double speed. It costs three lines and it is worth them.

That is the whole game.
