// PONG. two ways to type this file, and it is arranged for both.
//
//   bottom-up -- parts 1, 2, 3, 4, 5, 6 in order. every part stands on its own
//                and the game runs the moment part 6 lands. the safe order.
//   top-down  -- part 1, then part 5 with everything it calls stubbed to an
//                empty body, then fill in part 4, then 3, then 2. the shape of
//                the game is on the screen first, and it runs at every step,
//                doing less and less nothing as you go down.
//
// what makes both work: parts 2 to 5 are nothing but function declarations,
// and those hoist, so they may be written in ANY order. only two things are
// pinned. part 1 is data, and data runs top to bottom the moment the file
// loads. part 6 is the four statements that start everything.
//
// the names follow two articles: sunshine2k's "vector reflection at a surface"
// for the bounce, and learnopengl's breakout "collision detection" for the box.
//
// if the clock runs out, these are the things worth showing, in order:
//   1 a canvas        part 1 handles, and a black fillAABB(COURT)
//   2 paddle and ball part 1 sizes and state, aabb, fillAABB, draw
//   3 it moves        vector, scale, translate, movedAABBBy, update, loop
//   4 it bounces      unit vectors, reflect, pastWall, bounceOffWall
//   5 you control it  clampToHalfExtent, closestPointOnAABB, onMouseMove
//   6 it rallies      bounceOffPaddle
//   7 it scores       resetBall, BALL_EXIT_LIMIT, score
//   8 polish          onClick and running, beep, the hint text

// ===========================================================================
// PART 1. THE WORLD -- data, so this part alone has to be in this order.
// ===========================================================================

// -- handles ----------------------------------------------------------------
// the one <canvas> on the page
const canvas = document.querySelector("canvas") as HTMLCanvasElement;
// every mark this game makes goes through ctx
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

// -- types ------------------------------------------------------------------
// one shape, five jobs. the alias never changes the math -- it says what a
// given pair of numbers is FOR, so the rules below can be read out loud.
type Vector = { x: number; y: number }; // the one shape: two named numbers
type Point = Vector; // a position on the court
type HalfExtents = Vector; // how far an AABB reaches from its center, per axis
type Velocity = Vector; // pixels per SECOND, never per frame
type Direction = Vector; // which way; length 1. a surface normal is one of these

// AABB is learnopengl's word: an axis-aligned bounding box, a rectangle that
// never rotates. a position plus a reach, never corner + size -- that is what
// keeps every rule below symmetric.
type AABB = { center: Point; halfExtents: HalfExtents };

// -- unit vectors -----------------------------------------------------------
// canvas y goes DOWN, so DOWN is the positive one.
// these four double as the outward-facing surface normals of the four walls.
const RIGHT: Direction = vector(1, 0); // +x, away from the player
const DOWN: Direction = vector(0, 1); // +y, toward the bottom of the canvas
const LEFT: Direction = opposite(RIGHT); // -x, toward the player's paddle
const UP: Direction = opposite(DOWN); // -y, toward the top of the canvas

// -- sizes ------------------------------------------------------------------
const PADDLE_CENTER_X = 36; // the paddle only moves up and down
const PADDLE_HALF_EXTENTS: HalfExtents = vector(6, 45); // so 12 wide, 90 tall
const BALL_HALF_EXTENTS: HalfExtents = vector(6, 6); // a 12 x 12 square

// pixels per SECOND, not per frame -- same game on a 60 Hz and a 120 Hz screen
const BALL_SPEED: Velocity = vector(270, 180);

// a backgrounded tab hands back one huge gap. cap it, or the ball teleports.
const MAX_FRAME_SECONDS = 0.05; // 50 ms; slow motion beats a tunnelled ball

// -- the court and its limits -----------------------------------------------
// the court fills the canvas, so its center and its half-extents come out as
// the same two numbers. that is a coincidence of starting at (0, 0), not a rule.
const COURT = aabb(
  point(canvas.width / 2, canvas.height / 2), // the middle of the canvas
  vector(canvas.width / 2, canvas.height / 2), // half its width and height
);

// fold a moving box's own size into the court and only a POSITION is left to
// chase -- every test below is then point-vs-AABB, never AABB-vs-AABB.
const BALL_CENTER_LIMIT = courtShrunkBy(BALL_HALF_EXTENTS); // walls bounce here
const BALL_EXIT_LIMIT = courtGrownBy(BALL_HALF_EXTENTS); // fully gone past here
const PADDLE_CENTER_LIMIT = courtShrunkBy(PADDLE_HALF_EXTENTS); // mouse capped here

// -- state ------------------------------------------------------------------
// everything that changes from frame to frame lives here, and nowhere else.
let paddle = aabb(point(PADDLE_CENTER_X, COURT.center.y), PADDLE_HALF_EXTENTS);
let ball = aabb(point(0, 0), BALL_HALF_EXTENTS); // resetBall() fills this in
let ballVelocity: Velocity = vector(0, 0); // resetBall() fills this in too
let score = 0; // returns in a row; one miss puts it back to zero
let lastTime = 0; // previous frame's timestamp; 0 means there wasn't one
let running = false; // the ball waits until the player clicks
let audio: AudioContext | null = null; // null right up until that first click

// ===========================================================================
// PART 2. PRIMITIVES -- vectors, positions and boxes. no game in here at all.
// ===========================================================================

// the only place a Vector is ever built, so there is one shape to trust
function vector(x: number, y: number): Vector {
  return { x, y };
}

// every one of these hands back a NEW vector, built by the maker above.
// nothing in this file ever writes to an .x or a .y after the fact.

// a + b: take a's step, then take b's as well
function addVectors(a: Vector, b: Vector): Vector {
  return vector(a.x + b.x, a.y + b.y);
}

// a - b: take a's step, then undo b's
function subtractVectors(a: Vector, b: Vector): Vector {
  return vector(a.x - b.x, a.y - b.y);
}

// one number, both axes -- longer or shorter, never turned.
// a negative factor is the one exception: it flips the vector end for end.
function scale(v: Vector, factor: number): Vector {
  return vector(v.x * factor, v.y * factor);
}

// same length, other way. scale(v, -1) said in one word.
function opposite(v: Vector): Vector {
  return vector(-v.x, -v.y);
}

// drop the signs, one axis at a time. this is NOT the length of the vector.
// it folds all four quadrants onto one, so a rule written for a single corner
// covers the other three for free -- pastWall and bounceOffPaddle both use it.
function absPerAxis(v: Vector): Vector {
  return vector(Math.abs(v.x), Math.abs(v.y));
}

// signed: how far a goes in b's direction. negative = the other way.
// both articles write this a ∙ b and call it the dot product.
function dotProduct(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

// the same math again, said in position words
function point(x: number, y: number): Point {
  return vector(x, y);
}

// a position plus a step is a new position. the only way anything moves here.
function translate(position: Point, step: Vector): Point {
  return addVectors(position, step);
}

// a position minus a position is the step between them. mind the flip: the
// answer points FROM the first argument TO the second, so the words match.
function vectorFrom(from: Point, to: Point): Vector {
  return subtractVectors(to, from);
}

// the only place an AABB is built
function aabb(center: Point, halfExtents: HalfExtents): AABB {
  return { center, halfExtents };
}

// AABBs only move, never resize. past tense: they hand back a moved AABB and
// leave the one they were given alone, which is what the argument is named for.

// drop it at a new center, keeping the reach it already had
function movedAABBTo(original: AABB, center: Point): AABB {
  return aabb(center, original.halfExtents);
}

// nudge it by a step: work out where that lands, then use the mover above
function movedAABBBy(original: AABB, step: Vector): AABB {
  return movedAABBTo(original, translate(original.center, step));
}

// shrink -> where a box's center may sit with the whole box still on court
function courtShrunkBy(halfExtents: HalfExtents): AABB {
  return aabb(COURT.center, subtractVectors(COURT.halfExtents, halfExtents));
}

// grow -> past there, not one pixel of that box is still showing
function courtGrownBy(halfExtents: HalfExtents): AABB {
  return aabb(COURT.center, addVectors(COURT.halfExtents, halfExtents));
}

// ===========================================================================
// PART 3. THE FORMULAS -- pure maths. nothing in here reads or writes state.
// ===========================================================================

// BOUNCE. sunshine2k's reflection formula, letter for letter:
//   w = v - 2 * (v ∙ n) * n,  where |n| = 1
// n MUST have length 1, or the doubled term comes out the wrong size and the
// ball gains -- or loses -- speed on every single hit.
function reflect(v: Velocity, n: Direction): Velocity {
  // v ∙ n: how much of v heads straight into the surface. on a real hit this
  // is negative, because an incoming v runs against the outward-facing normal.
  const vDotN = dotProduct(v, n);

  // (v ∙ n) * n is v's PERPENDICULAR component -- the part lying along the
  // normal. doubling it is the whole trick: subtract it once and that part is
  // merely cancelled; subtract it twice and it comes back out the other way.
  const twicePerpendicular = scale(n, 2 * vDotN);

  // the PARALLEL component, the part sliding along the surface, is never
  // touched -- which is what makes a bounce look like a bounce and not a stop.
  return subtractVectors(v, twicePerpendicular);
}

// keep a number within ±halfExtent of zero. this is glm::clamp(x, -half, +half)
// with the symmetric range implied instead of spelled out twice.
function clampToHalfExtent(value: number, halfExtent: number): number {
  // how far from zero it may be: its own size, or the cap, whichever is
  // smaller. taking Math.abs first means one comparison covers both sides.
  const size = Math.min(Math.abs(value), halfExtent);

  // which side of zero it started on
  const whichWay = Math.sign(value);

  // put the side back onto the size. a value of exactly 0 stays 0.
  return whichWay * size;
}

// the closest point on the AABB, or the position itself if it was already
// inside. these are learnopengl's three steps: difference -> clamped -> closest.
// clamping per axis works because an AABB is one interval per axis. a circle
// is not, so the same shortcut does not carry over to one.
function closestPointOnAABB(position: Point, target: AABB): Point {
  // difference: the offset from the box's center out to the position
  const difference = vectorFrom(target.center, position);

  // clamped: that same offset, cut back to the box's reach on each axis. an
  // axis already within reach passes through untouched, which is exactly why
  // a position that started inside comes back out unchanged.
  const clamped = vector(
    clampToHalfExtent(difference.x, target.halfExtents.x),
    clampToHalfExtent(difference.y, target.halfExtents.y),
  );

  // closest = aabb_center + clamped. walk the trimmed offset back out from the
  // center and you land on the box's edge, or stay put inside it.
  return translate(target.center, clamped);
}

// how far a position sits past one wall of an AABB. negative means still inside.
function pastWall(position: Point, limit: AABB, normal: Direction): number {
  // the offset from the box's center out to the position
  const fromCenter = vectorFrom(limit.center, position);
  // how far out THAT WAY the position is. the dot product picks out the one
  // axis the normal names and reports a signed distance along it.
  const positionIsOut = dotProduct(fromCenter, normal);

  // how far out that way the wall itself is. dropping the normal's sign keeps
  // this distance positive either way, so one function covers all four walls.
  const wallIsOut = dotProduct(limit.halfExtents, absPerAxis(normal));

  // positive: that far past the wall. negative: that much room still to spare.
  return positionIsOut - wallIsOut;
}

// ===========================================================================
// PART 4. THE RULES -- what a serve and a collision actually do to the state.
// ===========================================================================

function resetBall() {
  // the far right edge: the last position where all of the ball is on court
  const serveDistance = BALL_CENTER_LIMIT.halfExtents.x;
  // step that far in the RIGHT direction, starting from the middle of the court
  const servePosition = translate(COURT.center, scale(RIGHT, serveDistance));

  ball = movedAABBTo(ball, servePosition); // park it there, same size as before
  ballVelocity = vector(-BALL_SPEED.x, BALL_SPEED.y); // leftward, at the player
}

function bounceOffWall(normal: Direction) {
  // the ball's CENTER against the shrunken court -- one wall per call
  const overshoot = pastWall(ball.center, BALL_CENTER_LIMIT, normal);
  if (overshoot <= 0) return; // still inside, nothing to do

  // step back IN by exactly the overshoot. skip this and a ball that sank into
  // the wall re-triggers next frame, flipping its velocity over and over.
  const backOntoTheWall = scale(normal, -overshoot);

  ball = movedAABBBy(ball, backOntoTheWall); // sit it exactly on the wall...
  ballVelocity = reflect(ballVelocity, normal); // ...then send it back out
}

function bounceOffPaddle() {
  // two AABBs collide when the gap between their centers is shorter than their
  // combined reach, on BOTH axes. what is left over on each axis is how deep
  // one of them got into the other.
  const gap = vectorFrom(paddle.center, ball.center); // paddle -> ball
  const combinedReach = addVectors(ball.halfExtents, paddle.halfExtents);
  // absPerAxis, because a gap of -3 and a gap of +3 are equally close
  const depth = subtractVectors(combinedReach, absPerAxis(gap));

  const clearOnSomeAxis = depth.x <= 0 || depth.y <= 0;
  if (clearOnSomeAxis) return; // clear on one axis is enough to miss

  // the sign of the gap says which face it would be on each axis...
  const xFace: Direction = gap.x > 0 ? RIGHT : LEFT; // ball right of the paddle?
  const yFace: Direction = gap.y > 0 ? DOWN : UP; // ball below the paddle?

  // ...and the shallower axis says which of the two it actually crossed.
  // asked once, so the face and the overlap can never disagree about the axis.
  const crossedAnXFace = depth.x < depth.y;
  const normal: Direction = crossedAnXFace ? xFace : yFace; // the face it hit
  const overlap = crossedAnXFace ? depth.x : depth.y; // how far in, that way

  // a ball already on its way out is left alone. without this, one resting
  // against the paddle gets flipped back inward every single frame.
  const alreadyLeaving = dotProduct(ballVelocity, normal) >= 0;
  if (alreadyLeaving) return;

  // push OUT along the normal by the overlap -- the same fix as at a wall,
  // except here the ball is inside the box rather than past it.
  const backOutOfThePaddle = scale(normal, overlap);

  ball = movedAABBBy(ball, backOutOfThePaddle); // clear of the paddle first...
  ballVelocity = reflect(ballVelocity, normal); // ...then bounce
  beep(); // and say so out loud

  // only a RETURN scores -- clipping the top edge leaves it still going left
  const headedBackUpCourt = dotProduct(ballVelocity, RIGHT) > 0;
  if (headedBackUpCourt) score++;
}

// ===========================================================================
// PART 5. THE STORY -- input, one frame of the game, and the loop.
// ===========================================================================

function onMouseMove(event: MouseEvent) {
  // clientY is from the top of the WINDOW, so subtract where the canvas starts
  const canvasTop = canvas.getBoundingClientRect().top;
  // mouseY is now in canvas coordinates, the same ones every AABB here uses
  const mouseY = event.clientY - canvasTop;

  // x is fixed; the mouse only ever picks the height. update() clamps this to
  // PADDLE_CENTER_LIMIT, so an off-court mouse is harmless right here.
  paddle = movedAABBTo(paddle, point(PADDLE_CENTER_X, mouseY));
}

function onClick() {
  if (!audio) audio = new AudioContext(); // build it once, never again
  running = true; // from here on, update() moves the ball
}

function update(elapsed: number) {
  // the mouse asks for a center; this hands back the nearest one allowed
  const allowedCenter = closestPointOnAABB(paddle.center, PADDLE_CENTER_LIMIT);
  paddle = movedAABBTo(paddle, allowedCenter); // no part of it leaves the court

  if (!running) return; // the paddle tracks the mouse before the first click

  // Velocity -> Vector: px/s * s = px. the one place elapsed is ever used.
  const step = scale(ballVelocity, elapsed);
  ball = movedAABBBy(ball, step); // move first, then undo any overlap below

  bounceOffWall(DOWN); // the bottom wall
  bounceOffWall(UP); // the top wall
  bounceOffWall(RIGHT); // no second player over there

  bounceOffPaddle(); // the player's end has a paddle instead of a wall

  // measured against the GROWN court, so the ball is gone, not just going
  const ballWentOut = pastWall(ball.center, BALL_EXIT_LIMIT, LEFT) > 0;
  if (ballWentOut) {
    score = 0; // a miss costs the whole streak
    resetBall(); // and serves again from the right
  }
}

// the one place that converts back to corner + full size, for the canvas
function fillAABB(target: AABB) {
  // fillRect wants the top-left corner: step back from the center by the reach
  const corner = translate(target.center, opposite(target.halfExtents));
  const width = 2 * target.halfExtents.x; // it reaches both ways, so double it
  const height = 2 * target.halfExtents.y;

  ctx.fillRect(corner.x, corner.y, width, height); // paint in the current style
}

function draw() {
  ctx.fillStyle = "black"; // wipe, then redraw everything
  fillAABB(COURT); // one black rectangle over the whole canvas IS the wipe

  ctx.fillStyle = "white";
  fillAABB(paddle);
  fillAABB(ball);

  ctx.font = "20px monospace"; // fillText reuses the fillStyle set just above
  ctx.fillText("Score: " + score, 20, 30); // 20 across, 30 down from the top

  if (!running) {
    ctx.fillStyle = "gray"; // dimmer than the play field, so it reads as a hint
    ctx.fillText("Click in the window to start", 20, canvas.height - 20);
  }
}

function beep() {
  if (!audio) return; // no click yet

  const now = audio.currentTime; // the AUDIO clock, not the animation one
  const tone = audio.createOscillator(); // the sound itself; a sine by default
  const volume = audio.createGain(); // a knob in front of it, to fade it out

  tone.frequency.value = 440; // concert A

  // fade out, or you hear a click instead of a beep
  volume.gain.setValueAtTime(0.15, now); // start quiet-ish, not at full blast
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.08); // never toward 0

  tone.connect(volume); // tone -> volume -> speakers
  volume.connect(audio.destination);

  tone.start(now); // scheduled on the same clock, so the fade lines up exactly
  tone.stop(now + 0.08); // one-shot: a stopped oscillator can never restart
}

function loop(now: number) {
  if (lastTime === 0) lastTime = now; // start the clock on frame 1, not on load

  const sinceLastFrame = (now - lastTime) / 1000; // rAF hands over milliseconds
  const elapsed = Math.min(sinceLastFrame, MAX_FRAME_SECONDS); // apply the cap
  lastTime = now; // remember the real timestamp, not the capped gap

  update(elapsed); // move and collide...
  draw(); // ...then show the result
  requestAnimationFrame(loop); // and book the next frame
}

// ===========================================================================
// PART 6. GO -- the only statements outside a function. these have to be last.
// ===========================================================================

// listen on WINDOW, not the canvas -- on the canvas the paddle freezes the
// moment the pointer leaves it.
window.addEventListener("mousemove", onMouseMove);
// no audio before a real interaction, and mousemove does not count -- so the
// click that starts play is also the click that builds the AudioContext.
window.addEventListener("click", onClick);

resetBall(); // put the ball on its serve position before the very first draw
requestAnimationFrame(loop); // start the clock; the click starts the ball
