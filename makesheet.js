const { max } = Math;
const fs = require('fs');
const { PNG } = require('pngjs');
const font = require('./font.js').createFont('ornate_font');
const { mkdir, bitblt } = require('./utils.js');
const colorType = 6;

function procdir(dir) {
  let files = fs.readdirSync(dir);
  const PAD = 4;
  let total_h = PAD + 10;
  let max_w = 0;
  let pngs = files.map((filename) => {
    let buf = fs.readFileSync(`${dir}/${filename}`);
    let png = PNG.sync.read(buf);
    total_h += png.height + PAD;
    max_w = max(max_w, png.width);
    return png;
  });
  let out = new PNG({ width: max_w, height: total_h, colorType });
  let y = PAD;
  font(out, 0, y, `Dungeon Hack Images: ${dir.split('/')[1]}`);
  y += 10;
  pngs.forEach((png, idx) => {
    bitblt(out, 0, y, png);
    y += png.height + PAD;
  });
  let buffer = PNG.sync.write(out);
  let out_file = `${dir.replace('out3', 'sheets')}.png`;
  fs.writeFileSync(out_file, buffer);
}

mkdir('sheets');
procdir('out3/walls_base');
