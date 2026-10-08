import { Game } from './game.js';
import { GameState } from './game/state.js';

const $ = (s) => document.querySelector(s);
const game = new Game($('#game'));
window.__game = game;

game.load((p) => { $('#load-pct').textContent = p + '%'; }).then(() => {
  $('#loading').hidden = true;
  $('.buttons').hidden = false;
  $('#btn-continue').hidden = !GameState.hasSave();
}).catch((e) => {
  console.error(e);
  $('#loading').textContent = '加载失败：' + e.message;
});

function begin(isNew) {
  game.audio.init();
  $('#title').classList.add('hide');
  setTimeout(() => { $('#title').hidden = true; }, 1000);
  game.start(isNew);
}
$('#btn-new').onclick = () => {
  if (GameState.hasSave() && !$('#btn-new').dataset.confirm) {
    $('#btn-new').dataset.confirm = '1';
    $('#btn-new').textContent = '确定覆盖存档？再点一次';
    return;
  }
  begin(true);
};
$('#btn-continue').onclick = () => begin(false);
