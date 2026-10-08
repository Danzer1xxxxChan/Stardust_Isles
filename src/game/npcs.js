// Island residents: models, idle behaviour and dialogue scripts.
import { createCharacter, createAnimal } from '../player/character.js';
import { groundHeight } from '../world/terrain.js';
import { resolveAnchor } from '../world/world.js';
import { angleLerp } from '../core/math.js';
import { SHOP, HATS, ABILITY_NAMES, CODEX, LIGHTHOUSE_COST, FISH } from './content.js';

const DEFS = {
  aila: { name: '艾拉奶奶', voice: 380, look: { body: 0x8a6bb5, hair: 0xdedede, scarf: 0xf2c94c, skirt: true, legs: 0x5a4a7a, pack: false, glasses: true } },
  pip: { name: '皮普博士', voice: 620, look: { body: 0x4a7fc1, hair: 0x6b3f1d, scarf: 0xffffff, glasses: true, pack: 0x7a5536 }, hat: 'helmet' },
  abe: { name: '货郎阿贝', voice: 470, look: { body: 0xd9a03a, hair: 0x2b2b2b, scarf: 0x4aa3df, beard: 0x2b2b2b }, hat: 'cap' },
  mia: { name: '牧羊人米娅', voice: 700, look: { body: 0x6aa84f, hair: 0xc97a3a, scarf: 0xf17aa6, skirt: true }, hat: 'straw' },
  hai: { name: '渔夫老海', voice: 330, look: { body: 0x2f5f8a, hair: 0x9a9a9a, scarf: 0xffd84a, beard: 0xdedede, legs: 0x3b3b3b }, anim: 'fish', hat: 'beanie' },
  kuku: { name: '采菇人菇菇', voice: 760, look: { body: 0xd8433b, hair: 0x4a3020, scarf: 0xffffff, skirt: true, scale: 0.85 }, anim: 'sit' },
  tiao: { name: '跳跳', voice: 820, look: { body: 0xf2a93b, hair: 0x2b2b2b, scarf: 0x4fb08a, scale: 0.75 } },
  hoshino: { name: '天文学家星野', voice: 540, look: { body: 0x2f3b63, hair: 0x1b1b2b, scarf: 0xb48cff, glasses: true }, hat: 'wizard' },
  feng: { name: '登山者阿峰', voice: 420, look: { body: 0xd0453a, hair: 0x4a3020, scarf: 0x3f78c9, beard: 0x4a3020, pack: 0x3f78c9 }, anim: 'sit', hat: 'beanie' },
};

export class Npcs {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.history = {};
    for (const [id, def] of Object.entries(DEFS)) {
      const spot = resolveAnchor(game.content.npcs[id], game.world.anchors);
      const ch = createCharacter(def.look);
      if (def.hat) ch.setHat(def.hat);
      const y = spot.y ?? groundHeight(spot.x, spot.z);
      ch.root.position.set(spot.x, y, spot.z);
      ch.root.rotation.y = spot.yaw || 0;
      game.scene.add(ch.root);
      const npc = { id, ...def, ch, pos: ch.root.position, baseYaw: spot.yaw || 0, talking: false, t: Math.random() * 10 };
      if (id === 'hai') ch.rod.visible = true;
      this.list.push(npc);
      game.world.colliders.addCylinder(spot.x, spot.z, 0.45, y, y + 1.8);
      game.interact.add({
        pos: npc.pos, radius: 2.8, priority: 0.5,
        label: () => `和${npc.name}说话`,
        action: () => this.talk(npc),
      });
    }
    // Village cat
    this.cat = createAnimal('cat');
    const cx = -14, cz = 136;
    this.cat.position.set(cx, groundHeight(cx, cz), cz);
    game.scene.add(this.cat);
    game.codexLive.push({ id: 'cat', obj: this.cat });
    game.interact.add({
      pos: this.cat.position, radius: 2, label: () => '摸摸团子',
      action: async () => {
        game.audio.play('meow');
        const p = this.cat.position;
        for (let i = 0; i < 5; i++) setTimeout(() => game.fx.emit(p.x, p.y + 0.9, p.z, 2, { color: 0xff7aa8, speed: 1, gravity: -1.5, size: 0.4 }), i * 120);
        game.hud.toast('团子舒服地眯起了眼睛 😺');
        await game.wait(0.6);
      },
    });
  }

  get(id) { return this.list.find((n) => n.id === id); }

  update(dt, t) {
    const p = this.g.player.pos;
    for (const n of this.list) {
      n.t += dt;
      const d = Math.hypot(p.x - n.pos.x, p.z - n.pos.z);
      const face = n.talking || (d < 6 && !n.anim);
      if (n.override !== 'walk') {
        const target = face ? Math.atan2(p.x - n.pos.x, p.z - n.pos.z) : n.baseYaw;
        n.ch.root.rotation.y = angleLerp(n.ch.root.rotation.y, target, Math.min(1, dt * 5));
      }
      const mode = n.override || (n.talking ? (n.anim === 'sit' ? 'sit' : 'idle') : (n.anim || 'idle'));
      n.ch.animate({ mode, speed: n.animSpeed || 0, dt, t: n.t });
    }
    // Cat idles and occasionally turns.
    this.cat.rotation.y += Math.sin(t * 0.3) * dt * 0.3;
  }

  async talk(npc) {
    const g = this.g;
    npc.talking = true;
    g.beginDialog(npc);
    const T = {
      say: (text) => g.dialog.say(npc.name, text),
      choose: (text, opts) => g.dialog.choose(npc.name, text, opts),
      menu: async (text, entries) => {
        const list = [...entries];
        if (g.ai.enabled()) list.push({ label: '（随便聊聊）', fn: () => this.chat(npc) });
        list.push({ label: '再见', fn: null });
        const i = await g.dialog.choose(npc.name, text, list.map((e) => e.label));
        if (list[i].fn) { await list[i].fn(); return true; }
        return false;
      },
    };
    const first = !g.state.data.met.includes(npc.id);
    if (first) g.state.add('met', npc.id);
    try { await SCRIPTS[npc.id](g, npc, T, first); } catch (e) { console.error(e); }
    npc.talking = false;
    npc.override = null;
    g.endDialog();
    g.state.save();
  }

  async chat(npc) {
    const g = this.g;
    const hist = (this.history[npc.id] ||= []);
    for (;;) {
      const msg = await g.dialog.chat(npc.name, '（想跟对方说点什么？回车发送，Esc 结束聊天）');
      if (!msg) return;
      g.dialog.thinking(npc.name);
      const reply = await g.ai.chat(npc, hist, msg);
      hist.push({ role: 'user', content: msg }, { role: 'assistant', content: reply });
      if (hist.length > 12) hist.splice(0, hist.length - 12);
      await g.dialog.say(npc.name, reply);
    }
  }
}

// ---------------- Dialogue scripts ----------------
const SCRIPTS = {
  async aila(g, n, T, first) {
    const d = g.state.data;
    if (first) {
      await T.say('哎呀，你醒啦！昨晚那场流星雨可真吓人，你就是在那时候被冲上岸的吧？');
      await T.say('我叫艾拉，以前是雪山顶上那座灯塔的守塔人。你看——北边最高的那座山，山顶上的灯塔已经熄灭了。');
      await T.say('流星雨把灯塔里的星星打碎了，碎片变成了「星屑」，散落在群岛的各个角落。');
      const c = await T.choose('只要收集到 20 颗星屑，就能重新点亮灯塔。我老了，爬不动雪山……你愿意帮帮我吗？', ['交给我吧！', '星屑长什么样？']);
      if (c === 1) await T.say('金灿灿的，像一颗小星星，会自己发光。靠近了就能捡起来。');
      await T.say('太好了！村子附近就有几颗：一颗在老风车的阳台上，踩着木箱就能跳上去；东边还有一排石柱，最高那根的顶上也有一颗。');
      await T.say('先找到 3 颗星屑再回来找我，我把年轻时用的滑翔翼送给你。有了它，你就能飞过河去更远的地方了。');
      await T.say('对了，旁边的皮普博士在研究岛上的动植物，去跟他打个招呼吧。');
      return;
    }
    if (!d.abilities.glider) {
      if (d.shards.length >= 3) {
        await T.say('哇，已经找到 3 颗星屑了！你真能干。');
        await T.say('来，这是我年轻时的滑翔翼。在空中再按一次空格就能展开，一直按住空格就会一直滑翔。');
        g.grantAbility('glider');
        await T.say('去村子东边的瞭望丘试试吧，从山顶起跳能一直滑过河，去对岸的红岩峡谷。');
        await T.say('哦，还有：看到营火的话记得点亮它。点亮的营火可以在地图上快速旅行，还能在旁边休息。');
        return;
      }
      await T.say(`现在有 ${d.shards.length} 颗星屑了，还差 ${3 - d.shards.length} 颗。风车阳台、东边的石柱顶，还有南边遗迹里好像也藏着一颗。`);
      return;
    }
    if (d.ending) {
      await T.say('灯塔又亮起来了……每天晚上看着那道光扫过海面，我就想起你。谢谢你。');
      await T.menu('还想到处逛逛吗？群岛上应该还有没找到的星屑呢。', [{ label: '讲讲灯塔的故事', fn: () => lore(T) }]);
      return;
    }
    const hint = ailaHint(g);
    await T.menu(`你已经找到 ${d.shards.length} 颗星屑了，还差 ${Math.max(0, LIGHTHOUSE_COST - d.shards.length)} 颗就能点亮灯塔。`, [
      { label: '有什么建议吗？', fn: () => T.say(hint) },
      { label: '讲讲灯塔的故事', fn: () => lore(T) },
    ]);
  },

  async pip(g, n, T, first) {
    const d = g.state.data;
    if (first) {
      await T.say('哦哦！新面孔！我是皮普，研究动植物的博士。我正在编写《星屑群岛图鉴》！');
      await T.say('可惜我腿脚慢，岛上好多地方都去不了。这台相机送给你，帮我拍下你见到的动物、植物和地标吧！');
      g.grantAbility('camera');
      await T.say('按 C 拿出相机，对准目标点一下左键就能拍照。拍到新东西就会自动登记进图鉴。鱼就得靠钓上来才算啦。');
      await T.say('图鉴每凑满 10 条就来找我，我有奖励给你——是星屑哦！');
      return;
    }
    const n2 = d.codex.length;
    const tiers = [[10, 'pip1'], [20, 'pip2'], [30, 'pip3']];
    for (const [need, id] of tiers) {
      if (n2 >= need && !d.shards.includes(id)) {
        await T.say(`图鉴已经有 ${n2} 条了？！太棒了！这是约定好的奖励！`);
        g.collect.awardShard(id, n.pos);
        return;
      }
    }
    const next = tiers.find(([need, id]) => !d.shards.includes(id));
    const missing = CODEX.filter((c) => !c.fish && !d.codex.includes(c.id));
    const pick = missing[Math.floor(Math.random() * missing.length)];
    await T.menu(next ? `图鉴现在有 ${n2} 条。凑到 ${next[0]} 条的时候再来找我吧！` : '图鉴研究已经很完整了，你真是个了不起的探险家！', [
      { label: '有什么没拍到的吗？', fn: () => T.say(pick ? `嗯……比如「${pick.name}」：${pick.desc}` : '全拍到了！你太厉害了！') },
    ]);
  },

  async abe(g, n, T, first) {
    const d = g.state.data;
    if (first) await T.say('欢迎光临！我是货郎阿贝，岛上的东西我这里都有卖。用贝壳币付款就行——路边那些粉色的贝壳就是。');
    for (;;) {
      const items = SHOP.filter((s) => !(s.ability && d.abilities[s.ability]) && !(s.hat && d.hats.includes(s.hat)));
      const fishCount = Object.values(d.items.fish).reduce((a, b) => a + b, 0);
      const opts = items.map((s) => `${s.name} — ${s.price} 贝壳币`);
      if (fishCount) opts.push(`把鱼都卖掉（${fishCount} 条）`);
      opts.push('不买了');
      const i = await T.choose(`想要点什么？（你有 ${d.coins} 枚贝壳币）`, opts);
      if (i === opts.length - 1) { await T.say('慢走！欢迎再来！'); return; }
      if (fishCount && i === opts.length - 2) {
        let total = 0;
        for (const [k, v] of Object.entries(d.items.fish)) {
          const def = Object.values(FISH).flat().find((f) => f.id === k);
          total += (def?.price || 8) * v;
        }
        d.items.fish = {};
        g.state.addCoins(total);
        g.audio.play('coin');
        await T.say(`一共 ${total} 枚贝壳币，拿好！`);
        continue;
      }
      const item = items[i];
      if (d.coins < item.price) { await T.say(`${item.name}要 ${item.price} 枚贝壳币，你的钱好像不够哦。`); continue; }
      const c = await T.choose(`${item.name}：${item.desc}\n要买吗？`, ['买！', '再想想']);
      if (c !== 0) continue;
      g.state.addCoins(-item.price);
      g.audio.play('chest');
      if (item.ability) g.grantAbility(item.ability);
      if (item.hat) { g.state.add('hats', item.hat); g.hud.toast(`获得帽子：${HATS[item.hat]}`); }
      if (item.item === 'cocoa') { d.items.cocoa++; g.hud.toast('获得 热可可 ×1'); }
      await T.say('谢谢惠顾！');
    }
  },

  async mia(g, n, T, first) {
    const q = g.state.quest('mia');
    if (q.stage === 0) {
      await T.say('呜呜……你好。我是米娅，这些羊都是我养的。');
      await T.say('昨晚的流星雨把它们吓坏了，有三只跑丢了，到现在还没回来……');
      const c = await T.choose('你能帮我把它们找回来吗？', ['好，我去找找看', '它们往哪边跑了？']);
      await T.say('我好像看到一只往东边的河边跑了，一只往南边的遗迹那边，还有一只钻进了西边森林的边上。');
      await T.say('走到它身边按 E，它就会乖乖跟着你。把它带回这个羊圈就好！');
      q.stage = 1; q.penned = q.penned || [];
      return;
    }
    if (q.stage === 1) {
      const k = q.penned.length;
      if (k >= 3) {
        await T.say('三只都回来了！谢谢你，谢谢你！');
        await T.say('这盏提灯送给你。西边的迷雾森林深处特别黑，没有灯是走不进去的。');
        g.grantAbility('lantern');
        await T.say('还有这个……是我在羊圈里捡到的，亮晶晶的，应该就是你在找的东西吧？');
        g.collect.awardShard('mia', n.pos);
        q.stage = 2;
        return;
      }
      await T.say(`已经回来 ${k} 只了，还差 ${3 - k} 只。东边河边、南边遗迹、西边森林边上，再找找看吧！`);
      return;
    }
    await T.menu('羊儿们今天都很乖。提灯好用吗？', [{ label: '森林里有什么？', fn: () => T.say('听说森林最深处的古树下住着发光的蘑菇，晚上还有萤火虫。菇菇常在森林营火那边采蘑菇。') }]);
  },

  async hai(g, n, T, first) {
    const d = g.state.data, q = g.state.quest('hai');
    const species = CODEX.filter((c) => c.fish && d.codex.includes(c.id)).length;
    if (q.stage === 0) {
      await T.say('嗯？年轻人，会钓鱼吗？不会也没关系，我老海教你。');
      await T.say('这根钓竿拿去。看到水面上有涟漪的地方，走过去按 E 甩竿。');
      g.grantAbility('rod');
      await T.say('等鱼咬钩了会有提示，按 E 提竿，然后在指针走到绿色区域时按 E 收线，三次成功就钓上来了。');
      await T.say('钓到 3 种不同的鱼再来找我。到时候我送你一样好东西——没有它，你可没法在这冰冷的海里游泳。');
      q.stage = 1;
      return;
    }
    if (q.stage === 1) {
      if (species >= 3) {
        await T.say('哈哈，3 种了！你是个好渔夫。');
        await T.say('这双脚蹼是我年轻时用的。穿上它就能在海里和湖里游泳了，按住 Shift 还能游得更快。');
        g.grantAbility('fins');
        await T.say('还有这个，是上周从一条鱼肚子里找到的。我留着也没用，给你吧。');
        g.collect.awardShard('hai_fish', n.pos);
        q.stage = 2;
        return;
      }
      await T.say(`你已经钓到 ${species} 种鱼了，还差 ${3 - species} 种。海边、水晶湖、河里的鱼都不一样哦。`);
      return;
    }
    await T.menu('今天的海风真舒服。', [
      { label: '钓鱼的诀窍', fn: async () => { await T.say('码头和海岸边能钓到海鱼，晚上还会有灯笼鱼浮上来。水晶湖有水晶鲤，河里有鲑鱼和鲶鱼。'); await T.say('传说海里还有一种金鳞鱼，鳞片像星屑一样亮……我钓了一辈子也只见过一次。'); } },
    ]);
  },

  async kuku(g, n, T, first) {
    const d = g.state.data, q = g.state.quest('kuku');
    if (q.stage === 0) {
      await T.say('嘘——小声点，你会吓跑蘑菇的。……开玩笑啦，我是菇菇。');
      await T.say('森林最深处长着一种会发蓝光的蘑菇，可好看了。可是里面太黑了，我一进去就迷路。');
      await T.say(d.abilities.lantern ? '咦，你有提灯！能帮我采 5 个发光蘑菇吗？走过去就能捡起来。' : '如果你有提灯的话，能帮我采 5 个回来吗？听说牧羊人米娅有一盏提灯。');
      q.stage = 1;
      return;
    }
    if (q.stage === 1) {
      if (d.items.mushrooms >= 5) {
        await T.say('哇——5 个发光蘑菇！它们在你手里一闪一闪的，真漂亮！');
        d.items.mushrooms -= 5;
        await T.say('作为谢礼，这个给你。我在蘑菇丛里找到的，它比蘑菇还亮呢。');
        g.collect.awardShard('kuku', n.pos);
        q.stage = 2;
        return;
      }
      await T.say(`现在有 ${d.items.mushrooms} 个，还差 ${5 - d.items.mushrooms} 个。都在森林最黑的那片地方。`);
      return;
    }
    await T.menu('森林今天也很安静呢。', [
      { label: '附近有什么好玩的？', fn: () => T.say('北边那棵千年古树的树干上长满了大蘑菇，像台阶一样能一直爬到树顶！还有一只狐狸总在附近跑来跑去，好像想带人去什么地方。') },
    ]);
  },

  async tiao(g, n, T, first) {
    const d = g.state.data;
    if (first) await T.say('嘿！你也是来探险的吗？我叫跳跳，是峡谷里跑得最快的人！');
    if (d.shards.includes('race')) {
      await T.menu('上次输给你了，我每天都在练习！', [
        { label: '峡谷里有什么？', fn: () => T.say('峡谷的台地上有风铃柱，按 E 敲一下会出现一串光环。用滑翔翼按顺序穿过光环就能得到奖励！还有，那些旋转的风会把你往上吹哦。') },
        { label: '再比一次！', fn: () => g.challenges.startRace(n) },
      ]);
      return;
    }
    const c = await T.choose('要不要比赛？从这里出发，谁先跑到红石拱门下面谁赢！', ['来比！', '下次吧']);
    if (c === 0) { await T.say('好！对话结束就开始倒数，准备好！'); g.challenges.startRace(n); }
    else await T.say('胆小鬼～我随时奉陪！');
  },

  async hoshino(g, n, T, first) {
    const d = g.state.data;
    if (first) {
      await T.say('你好啊，旅人。我是星野，在这里观测星空已经三十年了。');
      await T.say('那场流星雨……其实是灯塔里的「星核」碎掉了。它的碎片落到群岛各处，就是你在找的星屑。');
    }
    if (d.shards.includes('stars')) {
      await T.menu('今晚的星星格外亮。', [{ label: '聊聊星星', fn: () => T.say('天鹅座、猎户座、北斗七星……古人用石台记下了它们。灯塔重新亮起来的时候，星星也会更亮吧。') }]);
      return;
    }
    await T.say('天文台外面有三座古老的石台，分别刻着天鹅座、猎户座和北斗七星。');
    await T.say('夜晚按照「天鹅 → 猎户 → 北斗」的顺序点亮它们，星空就会回应你。顺序错了就要重来。');
    if (g.sky.night < 0.5) await T.say('不过现在是白天，石台不会有反应。你可以去营火旁边休息到晚上再来。');
  },

  async feng(g, n, T, first) {
    const d = g.state.data;
    if (first) {
      await T.say('哈——欠！你好……我叫阿峰，想登上霜顶雪山的山顶，结果爬到这里就冻得动不了了。');
      await T.say('这座山有四层悬崖，一层比一层高。攀爬会消耗体力，体力不够的话爬到一半就会滑下来。');
      await T.say('收集金羽毛可以提升体力上限。我估计至少要五六根才能爬到山顶。');
    }
    if (d.feathers.includes('f_feng')) {
      await T.menu('喝了热可可，浑身都暖和了！', [{ label: '有什么攀登技巧？', fn: () => T.say('爬到一半体力快没了的时候，可以按空格往上蹬一大步，不过会消耗很多体力。悬崖之间的平台上可以休息恢复体力。') }]);
      return;
    }
    if (d.items.cocoa > 0) {
      const c = await T.choose('那是……热可可的香味？！', ['把热可可送给阿峰', '不给']);
      if (c === 0) {
        d.items.cocoa--;
        n.override = 'cheer';
        await T.say('啊——活过来了！太谢谢你了！');
        await T.say('这根金羽毛是我在悬崖上捡的，送给你。有了它你能爬得更高！');
        n.override = null;
        g.collect.collectFeather('f_feng');
        await T.say('爬悬崖时体力快没了可以按空格往上蹬一步。祝你登顶顺利！');
        return;
      }
      await T.say('呜……好吧……');
      return;
    }
    await T.say('好冷啊……要是有一杯热可可就好了。村里的阿贝好像有卖……');
  },
};

async function lore(T) {
  await T.say('很久以前，群岛的夜晚总有迷路的船。第一代守塔人从天上请下了一颗星星，放进了雪山顶的灯塔里。');
  await T.say('从那以后，灯塔的光每晚都会扫过海面，指引出海的人回家。我守了那座灯塔四十年。');
  await T.say('直到那天晚上的流星雨……星核碎了，灯也熄了。不过只要星屑还在，光就一定能回来。');
}

function ailaHint(g) {
  const d = g.state.data;
  const q = (id) => d.quests[id]?.stage || 0;
  if (!d.abilities.lantern) return q('mia') === 0 ? '西北边羊圈的米娅好像遇到麻烦了，去看看她吧。' : '米娅的羊找齐了吗？她说找到就送你提灯。';
  if (!d.abilities.fins) return q('hai') === 0 ? '南边码头的老海整天在钓鱼，他年轻时可是游泳好手。' : '老海让你钓 3 种不同的鱼？海边、湖里、河里的鱼都不一样哦。';
  if (!d.abilities.shovel && d.maps.length) return '你有藏宝图了？那得先去阿贝那里买把铲子。';
  if (d.feathers.length < 5) return '雪山的悬崖很高，多收集一些金羽毛吧。高处、小岛上、森林深处都藏着羽毛。';
  if (!d.abilities.compass) return '找不到星屑的话，阿贝那里有一个星屑罗盘，会指向最近的星屑。';
  return '去雪山看看吧！营火边可以休息，晚上天文台的星野可能也有事找你。';
}
