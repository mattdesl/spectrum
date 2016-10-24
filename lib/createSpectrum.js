const indexToFrequency = require('audio-index-to-frequency');
const unlerp = require('unlerp');
const lerp = require('lerp');
const clamp = require('clamp');
const defined = require('defined');

module.exports = function (opt = {}) {
  const logBase = defined(opt.logBase, 2);
  const minFrequency = defined(opt.minFrequency, 20);
  const maxFrequency = defined(opt.maxFrequency, 44100 / 2);
  const minFrequencyLog = log(minFrequency);
  const maxFrequencyLog = log(maxFrequency);
  const minDecibels = defined(opt.minDecibels, -100);
  const maxDecibels = defined(opt.maxDecibels, -30);
  const linear = opt.linear;
  const sampleRate = defined(opt.sampleRate, 44100);

  return {
    unproject,
    draw
  };

  function unproject (mousePosition, canvasDimensions) {
    const [ width, height ] = canvasDimensions;
    const x = mousePosition[0] / (width - 1);
    const y = mousePosition[1] / (height - 1);

    let db = lerp(maxDecibels, minDecibels, y);
    let hz = linear
      ? lerp(minFrequency, maxFrequency, x)
      : Math.pow(logBase, lerp(minFrequencyLog, maxFrequencyLog, x));

    return [ hz, db ];
  }

  function log (n) {
    return Math.log(n) / Math.log(logBase);
  }

  function draw (ctx, bins, graphWidth, graphHeight) {
    const binCount = bins.length;
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

  function lookup (hz) {
    const x = linear
      ? unlerp(minFrequency, maxFrequency, hz)
      : unlerp(minFrequencyLog, maxFrequencyLog, log(Math.max(1, hz)));
    return clamp(x, 0, 1);
  }
};
