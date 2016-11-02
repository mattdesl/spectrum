const dragDrop = require('drag-drop');
const createApp = require('canvas-loop');
const createSpectrum = require('./lib/createSpectrum');
const createTouch = require('touches');

const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
const noop = () => {};

const padding = 20;
const introDiv = document.querySelector('#intro-container');
const infoDiv = document.querySelector('#info');
const hzDiv = document.querySelector('.hz');
const dbDiv = document.querySelector('.db');
const anchors = Array.prototype.slice.call(document.querySelectorAll('.author > a'));

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioContext.createGain();
const analyserNode = audioContext.createAnalyser();
gainNode.connect(analyserNode);
analyserNode.connect(audioContext.destination);

const binCount = analyserNode.frequencyBinCount;
const frequencies = new Uint8Array(binCount);
const frequencyMax = new Uint8Array(binCount);
const { minDecibels, maxDecibels } = analyserNode;

const graph = createSpectrum({
  logBase: 10,
  linear: false,
  minDecibels,
  maxDecibels,
  sampleRate: audioContext.sampleRate
});

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

  if (lastNode) {
    for (let i = 0; i < binCount; i++) {
      frequencyMax[i] = Math.max(frequencyMax[i], frequencies[i]);
    }

    analyserNode.getByteFrequencyData(frequencies);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    graph.draw(ctx, frequencyMax, width, height);
    ctx.strokeStyle = '#004a78';
    ctx.globalAlpha = 0.5;
    ctx.stroke();

    ctx.beginPath();
    graph.draw(ctx, frequencies, width, height);
    ctx.strokeStyle = '#0094f2';
    ctx.globalAlpha = 1.0;
    ctx.stroke();
  }

  ctx.restore();
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
  for (let i = 0; i < binCount; i++) {
    frequencyMax[i] = 0;
  }

  if (!lastNode) return;
  lastNode.stop(0);
  lastNode.disconnect();
  lastNode = null;
}

function updateMouse (ev, pos) {
  let [ hz, db ] = graph.unproject(pos, app.shape);
  if (Math.abs(db) < 100) db = db.toFixed(1);
  else db = Math.round(db);

  let k = '';
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

function resume () {
  if (audioContext.state === 'suspended' &&
      typeof audioContext.resume === 'function') {
    audioContext.resume();
  }
}

// const xhr = require('xhr');
// xhr({
//   uri: 'bluejean_short.mp3',
//   responseType: 'arraybuffer'
// }, (err, resp, body) => {
//   if (err) throw err;
//   decode(body);
//   infoDiv.style.display = 'block';
// });

dragDrop(canvas, {
  onDrop (files, pos) {
    resume();
    fromFile(files[0], (err, buffer) => {
      if (err) {
        onError(err);
      } else {
        resume();
        infoDiv.style.display = '';
        introDiv.style.display = 'none';
      }
    });
  },
  onDragOver () {
    canvas.className = 'drag-drop';
    anchors.forEach(a => {
      // avoid anchors stealing drag & drop
      a.style['pointer-events'] = 'none';
    });
  },
  onDragLeave () {
    canvas.className = '';
    anchors.forEach(a => {
      a.style['pointer-events'] = '';
    });
  }
});

createTouch(canvas, {
  filtered: true
}).on('move', updateMouse);

infoDiv.style.display = 'none';

canvas.addEventListener('mouseenter', () => {
  if (lastNode) infoDiv.style.display = '';
});
canvas.addEventListener('mouseleave', () => {
  if (lastNode) infoDiv.style.display = 'none';
});

function onError (err) {
  if (err) console.log(err.message);
  dispose();
  infoDiv.style.display = 'none';
  introDiv.style.display = '';
  document.querySelector('#intro > header').textContent = 'oops!';
  document.querySelector('.instructions').textContent = `
    It looks like there was a problem decoding the audio.
    Try dropping another MP3, WAV or OGG file.
  `.trim();
  document.querySelector('#intro').className += ' error';
}
