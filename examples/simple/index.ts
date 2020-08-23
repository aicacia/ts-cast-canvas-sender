import { events, sendMediaStream } from "../../src";

let video: HTMLVideoElement | undefined,
  // canvas: HTMLCanvasElement | undefined,
  // ctx: CanvasRenderingContext2D | undefined,
  mediaStream: MediaStream | undefined;

// function loop(ms: number) {
//   const s = ms * 0.001,
//     hw = canvas.width * 0.5,
//     hh = canvas.height * 0.5,
//     x = hw + hw * 0.5 * Math.cos(s),
//     y = hh + hh * 0.5 * Math.sin(s);

//   ctx.save();
//   ctx.fillStyle = "rgba(150, 150, 150, 0.1)";
//   ctx.fillRect(0, 0, canvas.width, canvas.height);
//   ctx.restore();

//   ctx.save();
//   ctx.beginPath();
//   ctx.fillStyle = "#333";
//   ctx.arc(x, y, 64, 0, 2 * Math.PI, false);
//   ctx.fill();
//   ctx.restore();

//   window.requestAnimationFrame(loop);
// }

function onStart() {
  if (mediaStream) {
    sendMediaStream(mediaStream);
  }
}

function onEnd() {
  return undefined;
}

function onLoad() {
  video = document.getElementById("video") as HTMLVideoElement;
  // canvas = document.getElementById("canvas") as HTMLCanvasElement;
  // ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  // mediaStream = (canvas as any).captureStream(60);
  // video.srcObject = mediaStream;

  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      mediaStream = stream;
      video.srcObject = mediaStream;
    });

  onResize(window.innerWidth, window.innerHeight);

  // window.requestAnimationFrame(loop);
}

function onResize(_width: number, _height: number) {
  // if (canvas) {
  //   canvas.width = width;
  //   canvas.height = height;
  // }
}

events.on("start", onStart);
events.on("end", onEnd);
events.on("resize", onResize);

window.addEventListener("load", onLoad);
