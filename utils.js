const fs = require('fs');

exports.mkdir = function mkdir(dir) {
  try {
    fs.mkdirSync(dir);
  } catch (e) {
    // ignored
  }
};

exports.bitblt = function bitblt(dest, dx, dy, src, sx, sy, sw, sh) {
  sx = sx || 0;
  sy = sy || 0;
  sw = sw || src.width;
  sh = sh || src.height;
  for (let yy = 0; yy < sh; ++yy) {
    for (let xx = 0; xx < sw; ++xx) {
      for (let ii = 0; ii < 4; ++ii) {
        dest.data[(dx + xx + (dy + yy) * dest.width) * 4 + ii] = src.data[(sx + xx + (sy + yy) * src.width) * 4 + ii];
      }
    }
  }
};
