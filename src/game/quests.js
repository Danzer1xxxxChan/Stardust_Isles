// Quest log derived from state (no separate bookkeeping needed).
import { LIGHTHOUSE_COST, CODEX } from './content.js';
import { t } from '../i18n.js';

export function questList(state, content) {
  const d = state.data;
  const st = (id) => d.quests[id]?.stage || 0;
  const L = [];
  L.push({ title: t('点亮星屑灯塔'), desc: d.ending ? t('你点亮了灯塔，群岛重新有了光。') : t('收集星屑（{0}/{1}），登上霜顶雪山顶，打开灯塔的门。', [d.shards.length, LIGHTHOUSE_COST]), done: d.ending, main: true });
  if (d.met.includes('aila')) L.push({ title: t('艾拉的礼物'), desc: d.abilities.glider ? t('你得到了滑翔翼：在空中再按一次空格展开。') : t('先在村子附近找到 3 颗星屑，再回去找艾拉奶奶（{0}/3）。', [Math.min(3, d.shards.length)]), done: d.abilities.glider });
  if (d.met.includes('pip')) {
    const n = d.codex.length;
    const done = d.shards.includes('pip3');
    L.push({ title: t('皮普的图鉴'), desc: done ? t('图鉴研究完成！') : t('按 C 打开相机拍摄动植物和地标。图鉴 {0}/{1}，凑满 10 / 20 / 30 条去找皮普博士领奖励。', [n, CODEX.length]), done });
  }
  if (st('mia') >= 1) {
    const n = d.quests.mia?.penned?.length || 0;
    L.push({ title: t('走失的羊'), desc: st('mia') >= 2 ? t('米娅送了你一盏提灯。') : t('把走失的 3 只羊带回羊圈（{0}/3）。走到羊身边按 E，它就会跟着你。', [n]), done: st('mia') >= 2 });
  }
  if (st('hai') >= 1) {
    const kinds = CODEX.filter((c) => c.fish && d.codex.includes(c.id)).length;
    L.push({ title: t('老海的钓鱼课'), desc: st('hai') >= 2 ? t('老海送了你一双脚蹼，现在可以下海游泳了。') : t('钓到 3 种不同的鱼，然后回码头找老海（{0}/3）。', [Math.min(3, kinds)]), done: st('hai') >= 2 });
    L.push({ title: t('传说中的金鳞鱼'), desc: d.shards.includes('golden_fish') ? t('你钓到了金鳞鱼！') : t('老海说海里有一种会发光的金鳞鱼，非常难钓。'), done: d.shards.includes('golden_fish') });
  }
  if (st('kuku') >= 1) L.push({ title: t('发光蘑菇'), desc: st('kuku') >= 2 ? t('菇菇很开心。') : t('在迷雾森林深处找到 5 个发光蘑菇（{0}/5），需要提灯才能进去。', [d.items.mushrooms]), done: st('kuku') >= 2 });
  if (d.met.includes('tiao')) L.push({ title: t('峡谷赛跑'), desc: d.shards.includes('race') ? t('你赢了跳跳！') : t('和跳跳比赛，看谁先跑到红石拱门下面。'), done: d.shards.includes('race') });
  if (d.met.includes('hoshino')) L.push({ title: t('星空的秘密'), desc: d.shards.includes('stars') ? t('三座石台都点亮了。') : t('夜晚按照星野说的顺序点亮天文台外的三座石台：天鹅、猎户、北斗。'), done: d.shards.includes('stars') });
  if (d.met.includes('feng')) L.push({ title: t('怕冷的登山者'), desc: d.feathers.includes('f_feng') ? t('阿峰把他的金羽毛送给了你。') : t('阿峰想要一杯热可可。村里的阿贝那里有卖。'), done: d.feathers.includes('f_feng') });
  for (const dg of content.digs) {
    if (!d.maps.includes(dg.map)) continue;
    const done = d.dug.includes(dg.id);
    L.push({ title: t('藏宝图'), desc: done ? t('宝藏已经挖出来了。') : dg.clue + (d.abilities.shovel ? t('（拿着铲子在那里按 E 挖掘）') : t('（需要先买一把铲子）')), done });
  }
  return L;
}

// Compact summary for the optional AI hint chat.
export function objectiveSummary(state, content) {
  return questList(state, content).filter((q) => !q.done).map((q) => t('{0}：{1}', [q.title, q.desc])).join('\n');
}
