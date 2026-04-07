import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { StorageManager } from './storage';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0a1a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MenuScene, GameScene, GameOverScene],
});

// Username modal logic
const modal = document.getElementById('username-modal')!;
const input = document.getElementById('username-input') as HTMLInputElement;
const submit = document.getElementById('username-submit')!;
const notice = document.getElementById('storage-notice')!;

let nameModalCallback: ((name: string) => void) | null = null;

function openNameModal(currentName: string, onDone: (name: string) => void) {
  input.value = currentName;
  nameModalCallback = onDone;
  modal.classList.remove('hidden');
  input.focus();
  input.select();
}

function confirmName() {
  const name = input.value.trim().slice(0, 12) || 'StarWard';
  StorageManager.setGuardianName(name);
  StorageManager.setSeenIntro();
  modal.classList.add('hidden');
  if (nameModalCallback) {
    nameModalCallback(name);
    nameModalCallback = null;
  }
}

submit.addEventListener('click', confirmName);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmName();
});

if (!StorageManager.available) {
  modal.classList.add('hidden');
  notice.style.display = 'block';
} else if (StorageManager.hasSeenIntro()) {
  modal.classList.add('hidden');
}

(window as any).shieldrOpenNameModal = openNameModal;

export { game };
