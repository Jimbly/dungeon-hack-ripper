const { max } = Math;
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const font = require('./font.js').createFont('8x8_font');
const { mkdir, bitblt } = require('./utils.js');
const colorType = 6;

function border(png, x, y, w, h) {
  function putpx(xx, yy) {
    let idx = (xx + yy * png.width) * 4;
    png.data[idx++] = 255;
    png.data[idx++] = 0;
    png.data[idx++] = 255;
    png.data[idx++] = 255;
  }
  let len = 3;
  putpx(x - 1, y - 1);
  putpx(x + w, y - 1);
  putpx(x - 1, y + h);
  putpx(x + w, y + h);
  for (let ii = 1; ii < len; ++ii) {
    putpx(x - 1 + ii, y - 1);
    putpx(x - 1, y - 1 + ii);
    putpx(x + w - ii, y - 1);
    putpx(x + w, y - 1 + ii);
    putpx(x - 1 + ii, y + h);
    putpx(x - 1, y + h - ii);
    putpx(x + w - ii, y + h);
    putpx(x + w, y + h - ii);
  }
}

function procdir(dir, combine_all) {
  let files = fs.readdirSync(dir);
  let by_start = {};
  let needs_pal0 = {};
  if (combine_all) {
    by_start[combine_all] = files;
  } else {
    for (let ii = 0; ii < files.length; ++ii) {
      let filename = files[ii];
      let start = filename.match(/(.*)\.[0-9a-f]+(?:_\d+)?\.png/)[1];
      by_start[start] = by_start[start] || [];
      by_start[start].push(filename);
      if (start.endsWith('_pal01')) {
        needs_pal0[start.slice(0, -'_pal01'.length)] = true;
      }
    }
  }
  const max_width = 1280;
  for (let start in by_start) {
    files = by_start[start];
    const PAD = 1;
    let subheader_h = 9;
    let header_h = 10;
    let total_h = PAD + header_h + subheader_h;
    let pngs = files.map((filename) => {
      let buf = fs.readFileSync(`${dir}/${filename}`);
      let png = PNG.sync.read(buf);
      total_h += png.height + subheader_h + PAD;
      return png;
    });
    let out = new PNG({ width: max_width + 320, height: total_h + 1, colorType });
    let x = PAD;
    let y = 0;
    font(out, x, y + 1, start);
    y += header_h;
    let max_h = 0;
    // eslint-disable-next-line no-loop-func
    pngs.forEach((png, idx) => {
      if (x !== PAD && x + png.width > max_width) {
        x = PAD;
        y += max_h + 1;
        max_h = 0;
      }
      let print_idx;
      if (combine_all) {
        print_idx = files[idx].match(new RegExp(`.*${combine_all}_([0-9a-f]+)\\.0\\.png`))[1];
      } else {
        print_idx = files[idx].match(/.*\.([0-9a-f]+(?:_\d+)?)\.png/)[1];
      }
      let textw = font(out, x, y, print_idx);
      border(out, x, y + subheader_h, png.width, png.height);
      bitblt(out, x, y + subheader_h, png);
      x += max(png.width, textw) + PAD;
      max_h = max(max_h, subheader_h + png.height);
    });
    let maxx = 0;
    let maxy = 0;
    for (let yy = 0; yy < out.height; ++yy) {
      for (let xx = 0; xx < out.width; ++xx) {
        if (out.data[(xx + yy * out.width)*4 + 3]) {
          maxx = max(maxx, xx);
          maxy = max(maxy, yy);
        }
      }
    }
    let out2 = new PNG({ width: maxx+1, height: maxy+1, colorType });
    bitblt(out2, 0, 0, out, 0, 0, maxx+1, maxy+1);
    let buffer = PNG.sync.write(out2);
    //fs.writeFileSync(`out/${imgfile}.png`, buffer);

    if (needs_pal0[start]) {
      start += '_pal00';
    }
    let out_file = `${dir.replace('out2', 'out3')}/${start}.png`;
    mkdir(path.dirname(out_file));
    fs.writeFileSync(out_file, buffer);
    if (global.gc) {
      global.gc();
    }
  }
}

mkdir('out3');
procdir('out2/walls');