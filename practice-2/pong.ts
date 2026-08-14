// create drawing context
const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

// types
type Vector = {x: number, y: number} ;
type Point = Vector;
type Extent = Vector;
type Velocity = Vector;

const vector = 
// draw
function draw() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 100, 100);
}

function loop() {
  draw();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
