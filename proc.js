const fs = require('fs');
const { PNG } = require('pngjs');
const { mkdir } = require('./utils.js');

const colorType = 6;

function readPalette(palettefile) {
  if (!palettefile) {
    let pal = new Array(256);
    for (let ii = 0; ii < 256; ++ii) {
      pal[ii] = [ii,ii,ii,255];
    }
    pal[255][3] = 0;
    return pal;
  }
  if (palettefile.split(';').length === 3) {
    let s = palettefile.split(';');
    return readPalettePair(s[0], s[1], Number(s[2]));
  }
  let buf = fs.readFileSync(`palettes/${palettefile}.out`);
  let num_colors = buf.readUInt16LE(0);
  let pal = new Array(num_colors);
  let idx = 0x1A;
  for (let ii = 0; ii < num_colors; ++ii) {
    let r = buf[idx++] * 4;
    let g = buf[idx++] * 4;
    let b = buf[idx++] * 4;
    pal[ii] = [r,g,b,255];
  }
  if (pal.length === 256) {
    pal[255][0] = 0;
    pal[255][1] = 0;
    pal[255][2] = 0;
    pal[255][3] = 0;
  }
  return pal;
}

function readPalettePair(base, overlay, offset) {
  let pal1 = readPalette(base);
  let pal2 = readPalette(overlay);
  for (let ii = 0; ii < pal2.length; ++ii) {
    pal1[offset + ii] = pal2[ii];
  }
  pal1[255][0] = 0;
  pal1[255][1] = 0;
  pal1[255][2] = 0;
  pal1[255][3] = 0;
  return pal1;
}

function loadRawImage(imgfile) {
  let buf = fs.readFileSync(`images/${imgfile}.raw`);
  let idx = 0;
  let width = buf.readUInt16LE(idx); idx+=2;
  let height = buf.readUInt16LE(idx); idx+=2;
  return { buf: buf.slice(idx), width, height };
}

function loadPackedImage(imgfile) {
  let [filename, sub_idx] = imgfile.split('.');
  sub_idx = Number(sub_idx);
  let buf = fs.readFileSync(`../out/${filename}.out`);

  let idx = 0;
  let size = buf.readUInt32LE(idx); idx += 4;
  if (size!==buf.length)
  {
    throw new Error('Size in header mismatched actual filesize.');
  }

  let nrSubPictures = buf.readUInt16LE(idx); idx += 2;
  // console.log(`${nrSubPictures} sub picture(s) found`);
  if (sub_idx >= nrSubPictures) {
    return false;
  }

  for (let i=0; i<nrSubPictures; i++) {
    let start_offset = buf.readUInt32LE(6+i*4);
    // console.log(`Sub picture ${i} starts at offset 0x${start_offset.toString(16)}`);

    let pos = start_offset;

    let width = buf.readUInt16LE(pos);
    let height = buf.readUInt16LE(pos+2);
    pos+=4;

    // console.log(`   Size is ${width}x${height}`);

    let indexedBitmap = Buffer.alloc(width*height);
    indexedBitmap.fill(255); // Default bgcolor??? Probably defined in the header...

    while (true) {
      let y=buf[pos++];
      if (y===0xff) {
        break;
      }

      if (y>=height) {
        throw new Error(`Probably out of sync. Reported y-coord: ${y}`);
      }

      while (true) {
        let x=buf[pos++];
        let islast=buf[pos++];
        let rle_width=buf[pos++];
        // eslint-disable-next-line no-unused-vars
        let rle_bytes=buf[pos++];

        while (rle_width>0) {
          let mode=buf[pos]&1;
          let amount=(buf[pos++]>>1)+1;

          if (mode===0)  // Copy
          {
            buf.copy(indexedBitmap, x+y*width, pos, pos + amount);
            pos+=amount;
          }
          else if (mode===1) // Fill
          {
            let value=buf[pos++];
            indexedBitmap.fill(value, x+y*width, x+y*width + amount);
          }
          x+=amount;
          rle_width-=amount;
        }

        if (rle_width!==0) {
          throw new Error(`Out of sync while depacking RLE (rle_width=${rle_width})`);
        }

        if (islast===0x80) {
          break;
        }
      }
    }

    if (sub_idx === i) {
      return {
        buf: indexedBitmap,
        width,
        height,
      };
    }
  }
  throw new Error('Unexpected end');
}

function detPalette(filename, paletteoverride) {
  if (paletteoverride) {
    return paletteoverride;
  }
  if (filename.startsWith('Diff')) {
    return 'Diff_Base_Palette';
  }
  return 'Main_Base_Palette;wall_floor_palette_00;240';
  //return 'Fixed_Palette'; // Not 256
  //return 'Main_Base_Palette';
}

let contained_240plus;
function procImage(mode, imgfile, outfile, paletteoverride) {
  contained_240plus = false;
  let img;
  if (mode === 0) {
    img = loadRawImage(imgfile);
  } else {
    img = loadPackedImage(imgfile);
    if (!img) {
      return false;
    }
  }
  let { width, height, buf } = img;
  let out = new PNG({ width, height, colorType });
  let data = out.data;
  let pal = readPalette(detPalette(imgfile, paletteoverride));
  let out_idx = 0;
  let any_opaque;
  for (let idx=0, yy = 0; yy < height; ++yy) {
    for (let xx = 0; xx < width; ++xx) {
      let pal_idx = buf[idx++];
      if (pal_idx >= 240 && pal_idx < 255 && pal_idx !== 253) { // 253 is a very dark shadow, who cares.
        contained_240plus = true;
      }
      for (let ii = 0; ii < 4; ++ii) {
        data[out_idx++] = pal[pal_idx][ii];
      }
      if (data[out_idx-1]) {
        any_opaque = true;
      }
    }
  }
  if (!any_opaque) {
    // console.log(`${imgfile}: No visible pixels detected, skipping`);
  } else {
    let buffer = PNG.sync.write(out);
    //fs.writeFileSync(`out/${imgfile}.png`, buffer);
    fs.writeFileSync(outfile || 'out/out.png', buffer);
  }
  return true;
}

let cats = [
  [/^Main|Camp|Banner|Char|Customize|Compass|Diff_|display|Overlay|Parchment|textbar|generating|license|stone_frame|wood_frame/i, 'ui'],
  [/bubbles|spell_shape/i, 'items'],
  [/item|floor_shape/i, 'items_inworld'],
  [/icon/i, 'icons'],
  [/portrait/i, 'portraits'],
  [/door|floor|wall|stairs|gem_hole|ground|keyhole|lever|shooter|deco|spec_hole|teleporter/i, 'walls'],
  [/./, 'enemies'],
];
function categorize(filename) {
  for (let ii = 0; ii < cats.length; ++ii) {
    if (filename.match(cats[ii][0])) {
      return cats[ii][1];
    }
  }
  throw new Error('no');
}

function pad2(v) {
  v = String(v);
  if (v.length < 2) {
    v = `0${v}`;
  }
  return v;
}

function scanAll() {
  // let files = fs.readdirSync('images');
  // files = files.map((a) => a.replace(/\.\d+\.raw$/, ''));
  // let keys = {};
  // files.forEach((a) => (keys[a] = 1));
  // files = Object.keys(keys);

  let files = fs.readFileSync('tools/imagelist.txt', 'utf8').trim().split('\n');
  for (let ii = 0; ii < cats.length; ++ii) {
    mkdir(`out2/${cats[ii][1]}`);
  }
  files.forEach(function (filename) {
    let cat = categorize(filename);
    // if (cat !== 'walls') {
    //   return;
    // }
    let paletteoverride = null;
    let twoforty=false;
    let total = 0;
    for (let ii = 0; ; ++ii) {
      if (!procImage(1, `${filename}.${ii}`, `out2/${cat}/${filename}.${pad2(ii)}.png`, paletteoverride)) {
        break;
      }
      ++total;
      twoforty = twoforty || contained_240plus;
    }
    if (twoforty) {
      // output with each of the palettes
      for (let pal = 1; pal < 21; ++pal) {
        paletteoverride = `Main_Base_Palette;wall_floor_palette_${pad2(pal)};240`;
        for (let ii = 0; ; ++ii) {
          if (!procImage(1, `${filename}.${ii}`,
            `out2/${cat}/${filename}_pal${pad2(pal)}.${pad2(ii)}.png`, paletteoverride)
          ) {
            break;
          }
          ++total;
        }
      }
    }
    console.log(`${filename}: processed ${total} image(s)${twoforty ? ' (all palettes)' : ''}`);
    if (global.gc) {
      global.gc();
    }
  });
  console.log('Done.');
}

function test() {
  procImage(1, 'Main_screen.0');
}

mkdir('out2');
if (0) {
  test();
} else {
  scanAll();
}
