const createPlayer = require('web-audio-player');
const dragDrop = require('drag-drop');
const createApp = require('canvas-loop');
const indexToFrequency = require('audio-index-to-frequency');
const frequencyToIndex = require('audio-frequency-to-index');
const unlerp = require('unlerp');
const lerp = require('lerp');
const xhr = require('xhr');
const clamp = require('clamp');
const createTouch = require('touches');

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const noop = () => {};

const padding = 20;
const logBase = 2;
const isLinear = false;
const infoDiv = document.querySelector('#info');
const hzDiv = document.querySelector('.hz');
const dbDiv = document.querySelector('.db');

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioContext.createGain();
const analyserNode = audioContext.createAnalyser();
gainNode.connect(analyserNode);
analyserNode.connect(audioContext.destination);

const binCount = analyserNode.frequencyBinCount;
const frequencies = new Uint8Array(binCount);
const frequencyMax = new Uint8Array(binCount);
const maxFrequency = 44100 / 2;
const minFrequency = 20;
const minFrequencyLog = log(minFrequency);
const maxFrequencyLog = log(maxFrequency);

const { minDecibels, maxDecibels } = analyserNode;
const sampleRate = audioContext.sampleRate;

let lastNode;

const app = createApp(canvas, {
  scale: window.devicePixelRatio,
  parent: () => {
    return [
      window.innerWidth - padding * 2,
      window.innerHeight - padding * 2
    ];
  }
}).on('tick', render).start();

function render (dt) {
  const [ width, height ] = app.shape;
  const scale = app.scale;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < binCount; i++) {
    frequencyMax[i] = Math.max(frequencyMax[i], frequencies[i]);
  }

  analyserNode.getByteFrequencyData(frequencies);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  draw(frequencyMax, width, height, isLinear);
  ctx.strokeStyle = '#004a78';
  ctx.globalAlpha = 0.5;
  ctx.stroke();

  ctx.beginPath();
  draw(frequencies, width, height, isLinear);
  ctx.strokeStyle = '#0094f2';
  ctx.globalAlpha = 1.0;
  ctx.stroke();
  ctx.restore();
}

function updateMouse (ev, pos) {
  const [ width, height ] = app.shape;
  const x = pos[0] / (width - 1);
  const y = pos[1] / (height - 1);

  let db = lerp(maxDecibels, minDecibels, y);
  if (Math.abs(db) < 100) db = db.toFixed(1);
  else db = Math.round(db);

  let k = '';
  let hz = isLinear
    ? lerp(minFrequency, maxFrequency, x)
    : Math.pow(logBase, lerp(minFrequencyLog, maxFrequencyLog, x));

  if (hz < 100) hz = hz.toFixed(1);
  else if (hz < 1000) hz = Math.round(hz);
  else {
    const decimals = hz < 10000 ? 2 : 1;
    hz = (hz / 1000).toFixed(decimals);
    k = 'k';
  }
  hzDiv.textContent = `${hz} ${k}Hz`;
  dbDiv.textContent = `${db} dB`;
}

function log (n) {
  return Math.log(n) / Math.log(logBase);
}

function draw (bins, graphWidth, graphHeight, linear) {
  for (let i = 0; i < binCount; i++) {
    const signal = (bins[i] / 255);

    const hz = indexToFrequency(i, sampleRate, binCount);
    const a = lookup(hz, linear);
    const x = graphWidth * a;
    const y = (graphHeight - signal * (graphHeight - 1));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

function lookup (hz, linear) {
  const x = linear
    ? unlerp(minFrequency, maxFrequency, hz)
    : unlerp(minFrequencyLog, maxFrequencyLog, log(Math.max(1, hz)));
  return clamp(x, 0, 1);
}

function fromFile (file, cb = noop) {
  const reader = new window.FileReader();
  reader.onload = ev => decode(ev.target.result, cb);
  reader.onerror = () => cb(new Error(`Could not parse file ${file.fullPath}`));
  reader.readAsArrayBuffer(file);
}

function decode (arrayBuffer, cb = noop) {
  audioContext.decodeAudioData(arrayBuffer, buffer => {
    dispose();
    const bufferNode = audioContext.createBufferSource();
    bufferNode.connect(gainNode);
    bufferNode.buffer = buffer;
    bufferNode.loop = true;
    bufferNode.start(0);
    lastNode = bufferNode;
    cb(null, bufferNode);
  }, err => cb(err));
}

function dispose () {
  if (!lastNode) return;
  lastNode.stop(0);
  lastNode.disconnect();
  lastNode = null;
}

// xhr({
//   uri: 'bluejean_short.mp3',
//   responseType: 'arraybuffer'
// }, (err, resp, body) => {
//   if (err) throw err;
//   decode(body);
//   infoDiv.style.display = 'block';
// });

dragDrop(canvas, function (files, pos) {
  fromFile(files[0], (err, buffer) => {
    if (err) throw err;
    infoDiv.style.display = 'block';
  });
});

createTouch(canvas, {
  filtered: true
}).on('move', updateMouse);

infoDiv.style.display = 'none';