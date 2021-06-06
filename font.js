const assert = require('assert');
const fs = require('fs');

exports.createFont = function (fn) {
  let buf = fs.readFileSync(`fonts/${fn}`);
  let char_offsets = [];
  {
    let idx = 0;
    let num_chars = buf.readUInt16LE(idx); idx += 2;
    // let width = buf.readUInt16LE(idx); idx += 2;
    idx += 2;
    idx += 4;
    for (let ii = 0; ii < 256; ++ii) {
      let id = buf[idx++];
      assert.equal(id, ii);
    }
    for (let ii = 0; ii < num_chars; ++ii) {
      char_offsets.push(buf.readUInt16LE(idx)); idx += 2;
    }
  }

  return function (png, x, y, text) {
    function putpx(xx, yy, v) {
      let idx = (xx + yy * png.width) * 4;
      png.data[idx++] = v;
      png.data[idx++] = v;
      png.data[idx++] = v;
      png.data[idx++] = 255;
    }
    let x0 = x;
    for (let ii = 0; ii < text.length; ++ii) {
      let c = text.charCodeAt(ii);
      let start = char_offsets[c];
      let end = char_offsets[c+1];
      let idx = start;
      let w = buf[idx++];
      if (!w) {
        continue;
      }
      idx++;
      let row = 0;
      while (idx + w <= end) {
        for (let jj = 0; jj < w; ++jj) {
          if (buf[idx++]) {
            putpx(x + jj, y + row, 255);
          }
        }
        row++;
      }
      x += w + 1;
    }
    return x - x0;
  };
};