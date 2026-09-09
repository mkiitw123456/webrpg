// 背景裝飾全部用像素矩形生成；明確放在平台與角色後方。
export function mapScenery(scene, map, width) {
  const g = scene.add.graphics().setDepth(-10);
  scene.mapViews.push(g);
  if (map === 'cave') {
    g.fillStyle(0x202a43).fillRect(0, 0, width, 540);
    for (let x = 0; x < width; x += 64) {
      g.fillStyle(x % 128 ? 0x303b56 : 0x29344c).fillRect(x, 40 + x % 160, 60, 400);
      g.fillStyle(0x53627a).fillRect(x, 0, 30, 45 + x % 70).fillRect(x + 8, 40, 14, 40 + x % 50);
    }
    for (let x = 100; x < width; x += 240) {
      g.fillStyle(0x455d88).fillRect(x - 16, 410, 44, 66);
      g.fillStyle(0x77bdd8).fillRect(x - 8, 415, 14, 61).fillRect(x + 12, 438, 10, 38);
      g.fillStyle(0xc4edeb).fillRect(x - 5, 418, 4, 42);
    }
  } else if (map === 'mushroom') {
    g.fillStyle(0xc7bad7).fillRect(0, 0, width, 540);
    for (let x = 100; x < width; x += 210) {
      const y = 220 + x % 90;
      g.fillStyle(0x9c859e).fillRect(x - 16, y, 32, 476 - y);
      g.fillStyle(0xe6c9b7).fillRect(x - 10, y, 15, 476 - y);
      g.fillStyle(0x9f617c).fillRect(x - 80, y - 26, 160, 28).fillRect(x - 60, y - 60, 120, 35);
      g.fillStyle(0xca8599).fillRect(x - 42, y - 80, 84, 38);
      g.fillStyle(0xf6dfbf).fillRect(x - 45, y - 39, 18, 13).fillRect(x + 25, y - 25, 22, 10).fillRect(x - 5, y - 67, 17, 12);
    }
  }
}
