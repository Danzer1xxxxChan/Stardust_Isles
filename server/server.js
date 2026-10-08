// Production server: serves the built game (dist/) and the optional NPC chat API.
// AI chat is enabled when Anthropic credentials are available (ANTHROPIC_API_KEY, or an `ant auth login` profile).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '../dist');
const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const AI_ON = process.env.AI_DISABLED !== '1' && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.AI_FORCE === '1');
const client = AI_ON ? new Anthropic() : null;

const WORLD = `你在一款叫《星屑群岛》的温馨探索游戏里扮演一位岛上居民。背景：昨晚的流星雨打碎了雪山顶灯塔里的星核，碎片「星屑」散落在群岛各处，旅人（玩家）正在收集星屑，凑够 20 颗就能重新点亮灯塔。
群岛地区：晨风草原与村庄（中南部）、迷雾森林（西边，深处漆黑需要提灯）、红岩峡谷（东边，隔着一条河，台地上有滑翔光环）、珊瑚海岸（东南，有沉船和小岛）、水晶湖（西北，湖上有光束镜子谜题）、霜顶雪山（北边，四层悬崖，山顶是灯塔）。
居民：艾拉奶奶（前守塔人）、皮普博士（图鉴）、货郎阿贝（商店）、牧羊人米娅、渔夫老海、采菇人菇菇、小孩跳跳、天文学家星野、登山者阿峰。`;

const RULES = `规则：
- 始终以角色身份用简体中文回答，语气符合人设，一般 1~3 句话，最多 80 个字。
- 只根据「玩家当前状态」里列出的未完成目标给提示，不要编造游戏里不存在的物品、地点或奖励，也不要承诺给玩家任何东西。
- 玩家问到你不知道的事情，就像角色一样说不清楚，建议去问别的居民。
- 不讨论游戏以外的现实话题，礼貌地把话题拉回岛上的生活。
- 不要输出动作描写的括号以外的格式，不用 Markdown。`;

const PERSONAS = {
  aila: '你是艾拉奶奶，七十多岁，守了四十年灯塔的前守塔人，慈祥、爱讲往事，称玩家为"孩子"。',
  pip: '你是皮普博士，戴眼镜的年轻生物学家，说话很快、容易兴奋，满脑子都是动植物和图鉴。',
  abe: '你是货郎阿贝，精明但热情的商人，喜欢讨价还价和讲冷笑话，三句不离生意。',
  mia: '你是牧羊人米娅，害羞温柔的少女，非常爱她的羊，说话轻声细语。',
  hai: '你是渔夫老海，沉默寡言的老渔夫，说话简短有海的味道，偶尔讲一句人生道理。',
  kuku: '你是采菇人菇菇，古灵精怪的小个子，痴迷蘑菇，说话带点神秘兮兮的语气。',
  tiao: '你是跳跳，峡谷里精力旺盛的小男孩，自认为跑得最快，爱挑战别人，说话很冲。',
  hoshino: '你是天文学家星野，沉稳博学，说话像诗，总把话题联系到星空。',
  feng: '你是登山者阿峰，冻得哆哆嗦嗦但很乐观的登山爱好者，熟悉雪山的攀登技巧。',
};

function systemPrompt(npc) {
  return `${WORLD}\n\n${PERSONAS[npc]}\n\n${RULES}`;
}

function contextText(c = {}) {
  const s = (v, n = 600) => String(v ?? '').slice(0, n);
  return `【玩家当前状态（游戏自动生成）】
星屑 ${Number(c.shards) || 0} 颗，金羽毛 ${Number(c.feathers) || 0} 根，贝壳币 ${Number(c.coins) || 0}。
现在：${s(c.time, 20)}${c.night ? '（夜晚）' : ''}，所在地区：${s(c.region, 20)}。
已有道具：${Array.isArray(c.abilities) ? c.abilities.slice(0, 10).map((a) => s(a, 10)).join('、') : '无'}。
${c.ending ? '灯塔已经被点亮了。' : ''}
未完成目标：
${s(c.objectives, 1500) || '（无）'}`;
}

async function npcChat(body) {
  const npc = String(body.npc || '');
  if (!PERSONAS[npc]) return { status: 400, json: { error: 'unknown npc' } };
  const message = String(body.message || '').slice(0, 200);
  if (!message) return { status: 400, json: { error: 'empty' } };
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 400) }));
  const messages = [
    ...history,
    { role: 'user', content: `${contextText(body.context)}\n\n玩家对你说：${message}` },
  ];
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: systemPrompt(npc), cache_control: { type: 'ephemeral' } }],
      messages,
    });
    if (response.stop_reason === 'refusal') return { status: 200, json: { reply: '嗯……这个我可不太想聊。说点岛上的事吧？' } };
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return { status: 200, json: { reply: text.slice(0, 300) || '……' } };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { status: 200, json: { reply: '（对方好像有点累了，等一会儿再聊吧。）' } };
    if (error instanceof Anthropic.AuthenticationError) console.error('AI auth failed: check ANTHROPIC_API_KEY');
    else if (error instanceof Anthropic.APIError) console.error(`AI API error ${error.status}:`, error.message);
    else console.error('AI error:', error);
    return { status: 200, json: { reply: '（对方好像没听清你在说什么。）' } };
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 64 * 1024) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
  if (url.pathname === '/api/status') return send(200, { ai: AI_ON, model: AI_ON ? MODEL : null });
  if (url.pathname === '/api/npc-chat' && req.method === 'POST') {
    if (!AI_ON) return send(503, { error: 'ai disabled' });
    try { const r = await npcChat(await readBody(req)); return send(r.status, r.json); } catch { return send(400, { error: 'bad request' }); }
  }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Run `npm run build` first.'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => console.log(`星屑群岛 running on http://localhost:${PORT}  (AI chat: ${AI_ON ? MODEL : 'off'})`));
