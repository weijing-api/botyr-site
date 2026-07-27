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
    "Vary": "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors(origin),
    },
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
    const city = clean(body.city, 40);

    if (!industry || !offer || !city) {
      return json({ error: "请完整填写行业、产品和城市" }, 400, origin);
    }

    const systemPrompt = `你是中国本地商家的短视频内容策划师。请根据用户提供的行业、产品和城市，输出可直接拍摄的内容方案。
要求：
1. 生成 7 条不重复的同城短视频选题；
2. 每条包含 title、hook、script、shots、cta；
3. script 为 80-150 字自然口播，不夸大、不虚构数据、不承诺收益；
4. shots 为 3 个简短镜头建议组成的数组；
5. cta 引导收藏、评论或私信，但不得制造焦虑；
6. 只输出 JSON，格式为 {"ideas":[...]}，不要输出 Markdown。`;

    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({ industry, offer, city }),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 1800,
      }),
    });

    if (!upstream.ok) {
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
