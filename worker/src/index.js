const ALLOWED_ORIGINS = new Set([
  "https://botyr.com",
  "https://www.botyr.com",
  "http://botyr.com",
  "http://www.botyr.com",
  "https://weijing-api.github.io",
]);

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://botyr.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/generate" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, origin);
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403, origin);
    }
    if (!env.DEEPSEEK_API_KEY) {
      return json({ error: "服务尚未配置完成" }, 503, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "请求格式错误" }, 400, origin);
    }

    const industry = clean(body.industry, 50);
    const offer = clean(body.offer, 120);
    const facts = clean(body.facts, 600);
    const city = clean(body.city, 40);
    if (!industry || !offer || !facts || !city) {
      return json({ error: "请完整填写行业、产品、真实卖点和地区" }, 400, origin);
    }

    const systemPrompt = `你是中国本地商家的短视频内容策划师。根据用户提供的行业、产品和城市，输出可直接拍摄的内容方案。
要求：
1. 生成 7 条不重复的同城短视频选题；
2. 每条包含 title、hook、script、shots、cta；
3. script 是 80-150 字的自然口播，不夸大、不虚构数据、不承诺收益；
4. shots 是由 3 个简短镜头建议组成的数组；
5. cta 引导收藏、评论或私信，但不得制造焦虑；
6. 城市字段也可能是省份或地区，按用户原文自然表达，不要擅自改成城市；
7. 只能使用用户明确提供的事实。严禁编造店龄、价格、优惠、销量、顾客评价、亲身体验、配方、原料、温度、时间、工艺和功效；
8. 需要具体事实但用户没有提供时，必须使用 [店名]、[产品名]、[实际步骤]、[真实数据] 等醒目的可替换占位符，绝不能自行补全；
9. 不得声称排队、限量、热销、顾客专程前来、每天现做或当天采购，除非这些内容明确出现在“真实卖点”中；
10. 拍摄建议默认只拍产品、制作过程、环境和已授权员工；不得建议拍摄未明确同意的顾客正脸或反应；
11. 餐饮内容要把细节落在用户提供的真实食材、口味、工艺、分量、价格和消费场景上，同时避免无法核实的“正宗、最好、第一”等绝对化宣传；
12. 标题要适用于用户自己的商家账号，不要写成探店测评或比较竞争对手；
13. 每一条 title、hook、script 和 shots 都必须紧扣用户填写的产品，不得改变行业或产品；每条 script 至少原样使用一项“真实卖点”；
14. 地区直接使用用户填写的值，不得输出 [城市]；只有店名、详细地址等用户未提供的信息可以使用占位符；
15. 只输出 JSON，格式为 {"ideas":[...]}，不要输出 Markdown。`;

    let upstream;
    try {
      upstream = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          thinking: { type: "disabled" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `请严格依据以下资料策划，不得改变行业或产品：
行业：${industry}
产品或服务：${offer}
真实卖点（唯一事实来源）：${facts}
地区：${city}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.45,
          max_tokens: 1800,
        }),
      });
    } catch {
      return json({ error: "暂时无法连接 AI 服务，请稍后重试" }, 502, origin);
    }

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("DeepSeek error", upstream.status, detail.slice(0, 500));
      return json({ error: "AI 服务暂时不可用，请稍后重试" }, 502, origin);
    }

    const result = await upstream.json();
    const content = result?.choices?.[0]?.message?.content;
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.ideas) || parsed.ideas.length === 0) throw new Error();
      return json({ ideas: parsed.ideas.slice(0, 7) }, 200, origin);
    } catch {
      return json({ error: "AI 返回格式异常，请重新生成" }, 502, origin);
    }
  },
};
