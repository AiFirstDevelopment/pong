// PONG, in the order you type it. ten steps, and after every one there is
// something NEW on the screen -- so whenever the clock stops, you have a demo.
//
// two rules and that is the whole layout:
//   1. the last line of the file is the call that starts things. you always add
//      new code ABOVE it. it changes exactly once: draw() at step 1 becomes
//      requestAnimationFrame(loop) at step 4.
//   2. draw(), update() and bounceOffPaddle() are the three functions that GROW
//      rather than being written once. their lines are grouped and labelled with
//      the step they arrive in. type only the groups you have reached.
//
// everything else is written once, in the step that first needs it, and never
// touched again. nothing is here before the step that uses it -- step 1 needs
// no types at all.
//
// the names follow two articles: sunshine2k's "vector reflection at a surface"
// for the bounce, and learnopengl's breakout "collision detection" for the box.

// ===========================================================================
// STEP 1. A BLACK CANVAS. seven lines, and there is something to point at.
// ===========================================================================

// the one <canvas> on the page
const canvas = document.querySelector("canvas") as HTMLCanvasElement;
// every mark this game makes goes through ctx
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

// GROWS. one group per step; type only as far as you have got.
function draw() {
  // step 1 -- the wipe. everything below is drawn onto a fresh black court.
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // steps 2 and 3 -- the two boxes
  ctx.fillStyle = "white";
  fillAABB(ball);
  fillAABB(paddle);

  // step 9 -- the score. fillText reuses the fillStyle set just above.
  ctx.font = "20px monospace";
  ctx.fillText("Score: " + score, 20, 30); // 20 across, 30 down from the top

  // step 10 -- the hint, until the first click
  if (!running) {
    ctx.fillStyle = "gray"; // dimmer than the play field, so it reads as a hint
    ctx.fillText("Click in the window to start", 20, canvas.height - 20);
  }
}

// ===========================================================================
// STEP 2. THE BALL. the first box, so this is where boxes get a type.
// ===========================================================================

// one shape, five jobs. the alias never changes the math -- it says what a
// given pair of numbers is FOR. the last two arrive at steps 4 and 5.
type Vector = { x: number; y: number }; // the one shape: two named numbers
type Point = Vector; // a position on the court
type HalfExtents = Vector; // how far an AABB reaches from its center, per axis

// AABB is learnopengl's word: an axis-aligned bounding box, a rectangle that
// never rotates. a position plus a reach, never corner + size -- that is what
// keeps every collision rule below symmetric.
type AABB = { center: Point; halfExtents: HalfExtents };

// the only place a Vector is ever built, so there is one shape to trust
function vector(x: number, y: number): Vector {
  return { x, y };
}

// the same maker again, said in position words
function point(x: number, y: number): Point {
  return vector(x, y);
}

// a + b: take a's step, then take b's as well. hands back a NEW vector --
// nothing in this file ever writes to an .x or a .y after the fact.
function addVectors(a: Vector, b: Vector): Vector {
  return vector(a.x + b.x, a.y + b.y);
}

// a position plus a step is a new position. the only way anything moves here.
function translate(position: Point, step: Vector): Point {
  return addVectors(position, step);
}

// same length, other way
function opposite(v: Vector): Vector {
  return vector(-v.x, -v.y);
}

// the only place an AABB is built
function aabb(center: Point, halfExtents: HalfExtents): AABB {
  return { center, halfExtents };
}

// the one place that converts back to corner + full size, for the canvas
function fillAABB(target: AABB) {
  // fillRect wants the top-left corner: step back from the center by the reach
  const corner = translate(target.center, opposite(target.halfExtents));
  const width = 2 * target.halfExtents.x; // it reaches both ways, so double it
  const height = 2 * target.halfExtents.y;

  ctx.fillRect(corner.x, corner.y, width, height);
}

// the court fills the canvas, so its center and its half-extents come out as
// the same two numbers. that is a coincidence of starting at (0, 0), not a rule.
const COURT = aabb(
  point(canvas.width / 2, canvas.height / 2), // the middle of the canvas
  vector(canvas.width / 2, canvas.height / 2), // half its width and height
);

const BALL_HALF_EXTENTS: HalfExtents = vector(6, 6); // a 12 x 12 square

// mid-court, so it is visible now. resetBall() takes over at step 8.
let ball = aabb(COURT.center, BALL_HALF_EXTENTS);

// ===========================================================================
// STEP 3. THE PADDLE. three lines -- fillAABB already does the work.
// ===========================================================================

const PADDLE_CENTER_X = 36; // the paddle only ever moves up and down
const PADDLE_HALF_EXTENTS: HalfExtents = vector(6, 45); // so 12 wide, 90 tall

let paddle = aabb(point(PADDLE_CENTER_X, COURT.center.y), PADDLE_HALF_EXTENTS);

// ===========================================================================
// STEP 4. IT MOVES, AND LEAVES OFF THE FIRST WALL. swap the last line of the
// file from draw() to requestAnimationFrame(loop) and the ball sails away.
// ===========================================================================

type Velocity = Vector; // pixels per SECOND, never per frame

// one number, both axes -- longer or shorter, never turned.
// a negative factor is the one exception: it flips the vector end for end.
function scale(v: Vector, factor: number): Vector {
  return vector(v.x * factor, v.y * factor);
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

// pixels per SECOND, not per frame -- same game on a 60 Hz and a 120 Hz screen
const BALL_SPEED: Velocity = vector(270, 180);
let ballVelocity: Velocity = vector(-BALL_SPEED.x, BALL_SPEED.y); // at the player

let lastTime = 0; // previous frame's timestamp; 0 means there wasn't one

// a backgrounded tab hands back one huge gap. cap it, or the ball teleports.
const MAX_FRAME_SECONDS = 0.05; // 50 ms; slow motion beats a tunnelled ball

// GROWS. one group per step, and the groups run in this order every frame.
function update(elapsed: number) {
  // step 7 -- the mouse asks for a center; this hands back the nearest allowed
  const allowedCenter = closestPointOnAABB(paddle.center, PADDLE_CENTER_LIMIT);
  paddle = movedAABBTo(paddle, allowedCenter); // no part of it leaves the court

  // step 10 -- the ball waits for the first click. the paddle does not.
  if (!running) return;

  // step 4 -- Velocity -> Vector: px/s * s = px. the only use of elapsed.
  const step = scale(ballVelocity, elapsed);
  ball = movedAABBBy(ball, step); // move first, then undo any overlap below

  // step 5 -- three walls. the player's end has a paddle instead.
  bounceOffWall(DOWN);
  bounceOffWall(UP);
  bounceOffWall(RIGHT);

  // step 6
  bounceOffPaddle();

  // step 8 -- the GROWN court, so the ball is gone rather than just going
  const ballWentOut = pastWall(ball.center, BALL_EXIT_LIMIT, LEFT) > 0;
  if (ballWentOut) {
    score = 0; // step 9 -- a miss costs the whole streak
    resetBall(); // and serves again from the right
  }
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
// STEP 5. IT BOUNCES OFF THE WALLS. the reflection formula lands here.
// ===========================================================================

type Direction = Vector; // which way; length 1. a surface normal is one of these

// a - b: take a's step, then undo b's
function subtractVectors(a: Vector, b: Vector): Vector {
  return vector(a.x - b.x, a.y - b.y);
}

// a position minus a position is the step between them. mind the flip: the
// answer points FROM the first argument TO the second, so the words match.
function vectorFrom(from: Point, to: Point): Vector {
  return subtractVectors(to, from);
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

// canvas y goes DOWN, so DOWN is the positive one.
// these four double as the outward-facing surface normals of the four walls.
const RIGHT: Direction = vector(1, 0); // +x, away from the player
const DOWN: Direction = vector(0, 1); // +y, toward the bottom of the canvas
const LEFT: Direction = opposite(RIGHT); // -x, toward the player's paddle
const UP: Direction = opposite(DOWN); // -y, toward the top of the canvas

// fold a moving box's own size into the court and only a POSITION is left to
// chase -- every test below is then point-vs-AABB, never AABB-vs-AABB.
// shrink -> where a box's center may sit with the whole box still on court
function courtShrunkBy(halfExtents: HalfExtents): AABB {
  return aabb(COURT.center, subtractVectors(COURT.halfExtents, halfExtents));
}

const BALL_CENTER_LIMIT = courtShrunkBy(BALL_HALF_EXTENTS); // walls bounce here

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

// ===========================================================================
// STEP 6. IT BOUNCES OFF THE PADDLE. the paddle cannot move yet, so a served
// ball meets it only by luck -- serve flat for this one:
//   let ballVelocity = vector(-BALL_SPEED.x, 0)
// and put the y back at step 7, once you can steer.
// ===========================================================================

// GROWS. the last group arrives at step 9.
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

  // step 9 -- only a RETURN scores. clipping the top edge leaves it going left.
  const headedBackUpCourt = dotProduct(ballVelocity, RIGHT) > 0;
  if (headedBackUpCourt) score++;
}

// ===========================================================================
// STEP 7. THE PADDLE FOLLOWS THE MOUSE. add the listener to the bottom of the
// file, and the two clamp lines to the top of update().
// ===========================================================================

const PADDLE_CENTER_LIMIT = courtShrunkBy(PADDLE_HALF_EXTENTS); // mouse capped here

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

function onMouseMove(event: MouseEvent) {
  // clientY is from the top of the WINDOW, so subtract where the canvas starts
  const canvasTop = canvas.getBoundingClientRect().top;
  // mouseY is now in canvas coordinates, the same ones every AABB here uses
  const mouseY = event.clientY - canvasTop;

  // x is fixed; the mouse only ever picks the height. update() clamps this to
  // PADDLE_CENTER_LIMIT, so an off-court mouse is harmless right here.
  paddle = movedAABBTo(paddle, point(PADDLE_CENTER_X, mouseY));
}

// ===========================================================================
// STEP 8. A MISS SERVES AGAIN. the ball stops vanishing for good.
// ===========================================================================

// grow -> past there, not one pixel of that box is still showing
function courtGrownBy(halfExtents: HalfExtents): AABB {
  return aabb(COURT.center, addVectors(COURT.halfExtents, halfExtents));
}

const BALL_EXIT_LIMIT = courtGrownBy(BALL_HALF_EXTENTS); // fully gone past here

function resetBall() {
  // the far right edge: the last position where all of the ball is on court
  const serveDistance = BALL_CENTER_LIMIT.halfExtents.x;
  // step that far in the RIGHT direction, starting from the middle of the court
  const servePosition = translate(COURT.center, scale(RIGHT, serveDistance));

  ball = movedAABBTo(ball, servePosition); // park it there, same size as before
  ballVelocity = vector(-BALL_SPEED.x, BALL_SPEED.y); // leftward, at the player
}

// ===========================================================================
// STEP 9. THE SCORE. one variable, one line in draw(), one line in
// bounceOffPaddle(), one line in update() -- all four already marked above.
// ===========================================================================

let score = 0; // returns in a row; one miss puts it back to zero

// ===========================================================================
// STEP 10. CLICK TO START, AND THE HINT.
// ===========================================================================

let running = false; // the ball waits until the player clicks

function onClick() {
  running = true; // from here on, update() moves the ball
}

// ===========================================================================
// GO. always the last thing in the file -- you add new code ABOVE it.
// at step 1 this is the single line draw(). at step 4 that one line becomes
// requestAnimationFrame(loop). the other three join at the steps marked.
// ===========================================================================

// listen on WINDOW, not the canvas -- on the canvas the paddle freezes the
// moment the pointer leaves it.
window.addEventListener("mousemove", onMouseMove); // step 7
window.addEventListener("click", onClick); // step 10 -- starts the ball

resetBall(); // step 8 -- serve before the very first draw
requestAnimationFrame(loop); // step 4 -- was draw() at step 1
