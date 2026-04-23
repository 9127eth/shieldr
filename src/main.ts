import Phaser from 'phaser';
import { inject } from '@vercel/analytics';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { StorageManager } from './storage';

inject();

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
const MAX_NAME_LENGTH = 20;
const modal = document.getElementById('username-modal')!;
const modalBox = modal.querySelector('.modal-box') as HTMLElement;
const title = document.getElementById('username-title')!;
const input = document.getElementById('username-input') as HTMLInputElement;
const submit = document.getElementById('username-submit') as HTMLButtonElement;
const cancel = document.getElementById('username-cancel') as HTMLButtonElement;
const notice = document.getElementById('storage-notice')!;
const hint = document.getElementById('username-hint')!;

let nameModalCallback: ((name: string) => void) | null = null;
let isRename = false;

function clearNameError() {
  hint.textContent = '\u00A0';
  hint.classList.remove('error');
  input.classList.remove('error');
}

function closeNameModal() {
  modal.classList.add('hidden');
  nameModalCallback = null;
}

function openNameModal(currentName: string, onDone: (name: string) => void) {
  input.value = currentName;
  nameModalCallback = onDone;
  isRename = StorageManager.hasSeenIntro();
  title.textContent = isRename ? 'Change Your Name' : 'Enter Your Name';
  submit.textContent = isRename ? 'Save' : 'Begin';
  cancel.classList.toggle('hidden', !isRename);
  clearNameError();
  modal.classList.remove('hidden');
  input.focus();
  input.select();
}

function confirmName() {
  const raw = input.value.trim();
  if (raw.length > MAX_NAME_LENGTH) {
    hint.textContent = `Name must be ${MAX_NAME_LENGTH} characters or less`;
    hint.classList.add('error');
    input.classList.add('error');
    return;
  }
  const name = raw || 'StarWard';
  StorageManager.setGuardianName(name);
  StorageManager.setSeenIntro();
  modal.classList.add('hidden');
  if (nameModalCallback) {
    nameModalCallback(name);
    nameModalCallback = null;
  }
}

input.addEventListener('input', clearNameError);

submit.addEventListener('click', confirmName);
cancel.addEventListener('click', closeNameModal);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmName();
  else if (e.key === 'Escape' && isRename) closeNameModal();
});

// Stop clicks/right-clicks inside the modal from reaching the Phaser canvas.
const swallow = (e: Event) => e.stopPropagation();
modal.addEventListener('pointerdown', swallow);
modal.addEventListener('mousedown', swallow);
modal.addEventListener('contextmenu', swallow);

// Click outside the panel dismisses (only when renaming, not during first-time intro).
modal.addEventListener('click', (e) => {
  if (e.target === modal && isRename) closeNameModal();
});
modalBox.addEventListener('click', (e) => e.stopPropagation());

if (!StorageManager.available) {
  modal.classList.add('hidden');
  notice.style.display = 'block';
} else if (StorageManager.hasSeenIntro()) {
  modal.classList.add('hidden');
}

(window as any).shieldrOpenNameModal = openNameModal;

export { game };
