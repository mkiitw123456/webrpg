export function generateTextures(scene) {
  function texture(key, width, height, draw) {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, width, height);
    const c = t.context;
    c.imageSmoothingEnabled = false;
    const rect = (x, y, w, h, color) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    draw(rect, c);
    t.refresh();
  }

  texture('sky', 480, 270, (r) => {
    r(0, 0, 480, 270, '#a4dfea');
    r(0, 95, 480, 90, '#b9e9ed');
    r(0, 185, 480, 85, '#d3f0df');
    r(365, 28, 26, 26, '#f9f3c4');
    r(361, 33, 34, 16, '#f9f3c4');
  });
  texture('cloud', 80, 28, (r) => {
    r(8, 12, 64, 12, '#dcf3ef');
    r(0, 12, 76, 8, '#fffbed');
    r(12, 5, 24, 15, '#fffbed');
    r(22, 0, 20, 20, '#fffbed');
    r(43, 7, 20, 13, '#fffbed');
  });
  texture('hills', 480, 180, (r) => {
    for (let x = 0; x < 480; x += 4) {
      const far = Math.round(55 + Math.sin(x / 66) * 24 + Math.cos(x / 31) * 10);
      const near = Math.round(103 + Math.sin(x / 48 + 2) * 20);
      r(x, far, 4, 180 - far, '#89cbb4');
      r(x, near, 4, 180 - near, '#65b69a');
    }
  });
  texture('tile', 32, 32, (r) => {
    r(0, 0, 32, 32, '#805238');
    r(0, 9, 32, 20, '#a97046');
    r(0, 0, 32, 4, '#d6e891');
    r(0, 4, 32, 5, '#78b854');
    for (let x = 0; x < 32; x += 8) {
      r(x, 7, 4, 5, '#4f8e46');
      r(x + 2, 16 + (x % 3), 4, 3, '#cb9560');
      r(x + 4, 25 - (x % 5), 3, 3, '#815137');
    }
  });

  texture('cave-tile', 32, 32, r => {
    r(0, 0, 32, 32, '#414c65'); r(0, 0, 32, 4, '#a4b2c8'); r(0, 4, 32, 4, '#6a7f98');
    r(2, 12, 13, 8, '#53617c'); r(18, 18, 11, 10, '#303b54'); r(9, 24, 5, 3, '#8b98a9');
  });
  texture('mushroom-tile', 32, 32, r => {
    r(0, 0, 32, 32, '#936b83'); r(0, 0, 32, 8, '#c97d91'); r(0, 8, 32, 3, '#f3d4b3');
    r(4, 2, 6, 3, '#ffebcf'); r(23, 4, 5, 3, '#ffebcf'); r(6, 16, 4, 16, '#b48d97'); r(20, 13, 3, 19, '#72576e');
  });
  const palette = {
    H: '#534135', G: '#538d56', L: '#a9cc6b',
    S: '#ffd3a0', E: '#273e42', C: '#e9d9a6',
    T: '#cf7549', B: '#486778', D: '#344653'
  };
  const head = [
    '................', '.....HHHHHH.....', '....HGGGGGGH....',
    '...HGLLLLGGGH...', '..HHGGGGGGGGHH..', '..HHHHHHHHHHHH..',
    '....HSSSSSSH....', '....HSSESSSH....', '....HSSSSSSH....',
    '.....SSSSSS.....', '....TTCCCCTT....', '...STTCCCCTTS...',
    '...SSTTTTTTSS...', '.....TTTTTT.....'
  ];
  const legs = [
    ['.....BB.BB......', '.....BB.BB......', '.....DD.DD......', '....DDD.DDD.....'],
    ['....BB...BB.....', '...BB.....BB....', '...DD.....DD....', '..DDD.....DDD...'],
    ['......BBBB......', '......BBBB......', '......DDDD......', '.....DDDDD......']
  ];
  function matrix(r, rows, yOffset = 0) {
    rows.forEach((row, y) => [...row].forEach((p, x) => {
      if (palette[p]) r(x, y + yOffset, 1, 1, palette[p]);
    }));
  }
  for (let i = 0; i < 4; i++) {
    texture(`player-${i}`, 16, 20, (r) => {
      matrix(r, head, i === 1 ? 1 : 0);
      matrix(r, legs[i < 2 ? 0 : i - 1], 14);
    });
  }
  for (let i = 0; i < 2; i++) {
    texture(`slime-${i}`, 24, 18, (r) => {
      const y = i * 2;
      r(5, 2 + y, 14, 14 - y, '#387e69');
      r(2, 6 + y, 20, 10 - y, '#387e69');
      r(4, 5 + y, 16, 9 - y, '#84c979');
      r(7, 3 + y, 10, 4, '#b8e994');
      r(7, 8 + y, 2, 3, '#25434b');
      r(15, 8 + y, 2, 3, '#25434b');
      r(10, 12 + y, 4, 1, '#3e8167');
      r(3, 15, 18, 2, '#387e69');
    });
  }
  for (const kind of ['mushroom', 'bat', 'boar', 'golem']) for (let frame = 0; frame < 2; frame++) {
    texture(`${kind}-${frame}`, 32, 28, r => {
      const y = frame;
      if (kind === 'mushroom') {
        r(10, 13 + y, 13, 12 - y, '#8d6046'); r(12, 13 + y, 9, 10 - y, '#ffe1a0');
        r(3, 8 + y, 26, 7, '#823e40'); r(7, 3 + y, 18, 10, '#dc6e5f'); r(11, y, 10, 8, '#ef9780');
        r(8, 7 + y, 5, 3, '#fff0ca'); r(21, 9 + y, 4, 3, '#fff0ca');
      } else if (kind === 'bat') {
        r(11, 9, 11, 15, '#725487'); r(11, 5, 3, 8, '#543d70'); r(19, 5, 3, 8, '#543d70');
        r(1, 5 + frame * 7, 10, 9, '#594774'); r(22, 5 + frame * 7, 9, 9, '#594774');
        r(4, 9 + frame * 5, 8, 8, '#a58bc4'); r(21, 9 + frame * 5, 7, 8, '#a58bc4');
      } else if (kind === 'boar') {
        r(3, 8 + y, 25, 15, '#704d3d'); r(5, 7 + y, 20, 12, '#ad7952');
        r(5, 3, 5, 7, '#704d3d'); r(21, 3, 5, 7, '#704d3d'); r(6, 22, 5, 4, '#4f4339'); r(22, 22 - y, 5, 4, '#4f4339');
        r(10, 17, 15, 6, '#dcac7b'); r(9, 16, 3, 7, '#fff4d4'); r(24, 16, 3, 7, '#fff4d4');
      } else {
        r(7, 3 + y, 19, 20, '#56675f'); r(9, 4 + y, 15, 15, '#96a393');
        r(1, 12, 7, 11, '#70877b'); r(25, 12, 6, 11, '#70877b'); r(8, 22, 6, 5, '#56675f'); r(20, 22 - y, 6, 5, '#56675f');
        r(7, 2 + y, 12, 4, '#76a559'); r(18, 17, 6, 4, '#76a559'); r(16, 5, 2, 7, '#56675f');
      }
      r(13, 16 + y, 2, 3, '#243e3f'); r(20, 16 + y, 2, 3, '#243e3f');
      if (kind === 'golem') { r(12, 14 + y, 3, 2, '#bef8d6'); r(19, 14 + y, 3, 2, '#bef8d6'); }
    });
  }
  texture('tree', 64, 100, (r) => {
    r(28, 45, 10, 55, '#805b43');
    r(30, 47, 3, 53, '#b28355');
    r(19, 58, 13, 5, '#805b43');
    r(8, 28, 48, 29, '#448b68');
    r(2, 20, 60, 24, '#5ba577');
    r(12, 8, 44, 28, '#5ba577');
    r(22, 0, 24, 20, '#88bd78');
    r(12, 14, 30, 8, '#88bd78');
    r(6, 27, 16, 6, '#88bd78');
  });
  texture('flowers', 24, 12, (r) => {
    for (const x of [4, 17]) {
      r(x, 5, 2, 7, '#4f8e46');
      r(x - 2, 3, 6, 2, '#fff0b3');
      r(x, 1, 2, 6, '#fff0b3');
      r(x, 3, 2, 2, '#e3a750');
    }
  });
}
