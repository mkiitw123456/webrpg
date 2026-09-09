import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import './style.css';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#a4dfea',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 1100 }, debug: false } },
  scene: [GameScene]
});

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
