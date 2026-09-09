import Phaser from 'phaser';
import { horizontalVelocity, doubleJumpVelocity } from '../shared/movement.js';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(3).setDepth(5).setCollideWorldBounds(true);
    this.body.setSize(10, 17).setOffset(3, 1);
    this.setMaxVelocity(560, 700).setDragX(0);
    this.controls = scene.controls;
    this.lastGrounded = -Infinity;
    this.jumpQueued = -Infinity;
    this.hurtUntil = 0;
    this.attackUntil = 0;
    this.weapon = scene.add.graphics().setDepth(6);
  }

  update(time) {
    const grounded = this.body.blocked.down || this.body.touching.down;
    if (grounded) {this.lastGrounded = time;this.airJumpUsed=false;}
    if (this.controls.just('jump')) {
      if(!grounded && time-this.lastGrounded>=100 && !this.airJumpUsed && this.scene.rpg.classId==='rogue') {
        this.airJumpUsed=true;this.setVelocity(doubleJumpVelocity(this.body.velocity.x,this.flipX?-1:1),Math.min(this.body.velocity.y,-330));
        this.jumpQueued=-Infinity;
        this.scene.client.send('double-jump');this.scene.audio.hit('wave');
      } else this.jumpQueued=time;
    }
    const direction = Number(this.controls.down('right')) - Number(this.controls.down('left'));
    this.setAccelerationX(0);
    this.setVelocityX(horizontalVelocity(this.body.velocity.x,direction,grounded,Math.min(this.scene.game.loop.delta / 1000,0.05)));
    if (direction) this.setFlipX(direction < 0);

    if (time - this.jumpQueued < 120 && time - this.lastGrounded < 100) {
      this.setVelocityY(-510);
      this.jumpQueued = -Infinity;
      this.lastGrounded = -Infinity;
    }
    if (this.controls.up('jump') && this.body.velocity.y < -220) {
      this.setVelocityY(-220);
    }
    if (time < this.attackUntil) {
      this.anims.stop();
      this.setTexture('player-2');
    } else if (!grounded) {
      this.anims.stop();
      this.setTexture('player-2');
    } else {
      this.play(Math.abs(this.body.velocity.x) > 15 ? 'walk' : 'idle', true);
    }
    this.setAlpha(time < this.hurtUntil && Math.floor(time / 90) % 2 ? 0.4 : 1);
    this.drawWeapon(time);
  }

  drawWeapon(time) {
    const direction = this.flipX ? -1 : 1;
    const attacking = time < this.attackUntil;
    const g = this.weapon;
    g.clear().setPosition(Math.round(this.x + direction * 14), Math.round(this.y + 5));
    if (!this.scene.rpg.equipment.weapon) return;
    g.setScale(direction, 1).setAlpha(this.alpha);
    g.setRotation(attacking ? direction * 1.15 : direction * 0.2);
    if(this.scene.rpg.classId==='archer') {g.lineStyle(4,this.scene.weaponColor()).beginPath().arc(0,-10,17,-1.4,1.4).strokePath();g.lineStyle(1,0xffffff).lineBetween(3,-27,3,7);return;}
    if(this.scene.rpg.classId==='mage') {g.fillStyle(0x795c46).fillRect(-2,-24,4,36);g.fillStyle(this.scene.weaponColor()).fillCircle(0,-25,8);return;}
    if(this.scene.rpg.classId==='rogue') {g.fillStyle(this.scene.weaponColor()).fillRect(-4,-8,13,14);g.fillStyle(0xffffff).fillTriangle(8,-12,13,-2,8,8);return;}
    g.fillStyle(this.scene.weaponColor()).fillRect(-2, -29, 6, 29);
    g.fillStyle(0xffffff, 0.6).fillRect(-2, -29, 2, 24);
    g.fillStyle(0xf2c46f).fillRect(-8, 0, 18, 4);
    g.fillStyle(0x654838).fillRect(-1, 4, 5, 10);
  }

}
