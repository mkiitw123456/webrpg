import Phaser from 'phaser';
import { MONSTERS } from '../shared/progression.js';

// 怪物位置、血量與重生由伺服器決定；此類別只負責畫面。
export default class Enemy extends Phaser.GameObjects.Sprite {
  constructor(scene, data) {
    super(scene, data.x, data.y, `${data.kind || 'slime'}-0`);
    scene.add.existing(this);
    this.setScale(2).setDepth(4).play(data.kind || 'slime');
    this.bar = scene.add.graphics().setDepth(7);
    this.label = scene.add.text(data.x, data.y - 37, `Lv.${data.level || 1} ${MONSTERS[data.kind || 'slime'].name}`, {
      fontSize: '11px', color: '#25483e', backgroundColor: '#e9f5da'
    }).setOrigin(0.5).setDepth(7);
    this.once('destroy', () => { this.bar.destroy(); this.label.destroy(); });
    this.sync(data);
  }
  sync(data) {
    this.setPosition(data.x, data.y).setFlipX(data.direction < 0);
    this.label.setPosition(data.x, data.y - 37);
    this.bar.clear().fillStyle(0x254b42).fillRect(data.x - 24, data.y - 25, 48, 5)
      .fillStyle(0x91cf64).fillRect(data.x - 23, data.y - 24, 46 * data.hp / data.maxHp, 3);
  }
}
