import { Game } from './game.js';
import { GameState } from './game/state.js';
import { t, LANG, setLang, translateDom } from './i18n.js';

const $ = (s) => document.querySelector(s);
translateDom();
document.title = LANG === 'en' ? 'Stardust Isles' : '星屑群岛 Stardust Isles';
for (const b of document.querySelectorAll('.lang-switch button')) {
  b.classList.toggle('on', b.dataset.lang === LANG);
  b.onclick = () => { if (b.dataset.lang !== LANG) { setLang(b.dataset.lang); location.reload(); } };
}
const game = new Game($('#game'));
window.__game = game;

game.load((p) => { $('#load-pct').textContent = p + '%'; }).then(() => {
  $('#loading').hidden = true;
  $('.buttons').hidden = false;
  $('#btn-continue').hidden = !GameState.hasSave();
}).catch((e) => {
  console.error(e);
  $('#loading').textContent = t('加载失败：') + e.message;
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
    $('#btn-new').textContent = t('确定覆盖存档？再点一次');
    return;
  }
  begin(true);
};
$('#btn-continue').onclick = () => begin(false);
