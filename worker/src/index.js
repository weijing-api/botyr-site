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

const encoder = new TextEncoder();

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  return crypto.subtle.digest("SHA-256", typeof value === "string" ? encoder.encode(value) : value);
}

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? encoder.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

async function synthesizeSpeech(text, voiceType, env) {
  const host = "tts.tencentcloudapi.com";
  const service = "tts";
  const action = "TextToVoice";
  const version = "2019-08-23";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify({
    Text: text,
    SessionId: crypto.randomUUID(),
    ModelType: 1,
    VoiceType: voiceType,
    Codec: "mp3",
    SampleRate: 16000,
    Speed: 0.5,
    Volume: 1,
    PrimaryLanguage: 1,
  });
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    toHex(await sha256(payload)),
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    timestamp,
    credentialScope,
    toHex(await sha256(canonicalRequest)),
  ].join("\n");
  const secretDate = await hmac(`TC3${env.TENCENT_SECRET_KEY}`, date);
  const secretService = await hmac(secretDate, service);
  const secretSigning = await hmac(secretService, "tc3_request");
  const signature = toHex(await hmac(secretSigning, stringToSign));
  const authorization = `TC3-HMAC-SHA256 Credential=${env.TENCENT_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      Host: host,
      "X-TC-Action": action,
      "X-TC-Version": version,
      "X-TC-Timestamp": String(timestamp),
    },
    body: payload,
  });
  const data = await response.json();
  if (!response.ok || data?.Response?.Error || !data?.Response?.Audio) {
    console.error("Tencent TTS error", data?.Response?.Error || response.status);
    throw new Error(data?.Response?.Error?.Message || "语音合成失败");
  }
  return {
    audio: data.Response.Audio,
    requestId: data.Response.RequestId || null,
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);
    if (!["/generate", "/tts", "/analyze-image"].includes(url.pathname) || request.method !== "POST") {
      return json({ error: "Not found" }, 404, origin);
    }
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "Origin not allowed" }, 403, origin);
    }

    if (url.pathname === "/analyze-image") {
      if (!env.AI || !env.DEEPSEEK_API_KEY) {
        return json({ error: "图片识别服务尚未配置完成" }, 503, origin);
      }
      let form;
      try {
        form = await request.formData();
      } catch {
        return json({ error: "图片上传格式错误" }, 400, origin);
      }
      const image = form.get("image");
      if (!(image instanceof File) || !image.type.startsWith("image/")) {
        return json({ error: "请选择 JPG、PNG 或 WebP 商品图片" }, 400, origin);
      }
      if (image.size > 6 * 1024 * 1024) {
        return json({ error: "图片不能超过 6MB" }, 413, origin);
      }
      try {
        const converted = await env.AI.toMarkdown(
          { name: image.name || "product.jpg", blob: image },
          { conversionOptions: { output: { format: "text" } } },
        );
        const conversion = Array.isArray(converted) ? converted[0] : converted;
        const description = clean(conversion?.data, 4000);
        if (!description) throw new Error("没有识别到图片内容");
        const analysisResponse = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "deepseek-v4-flash",
            thinking: { type: "disabled" },
            messages: [
              {
                role: "system",
                content: `你是谨慎的商品图片分析员。只能依据视觉描述提取图片中明确可见的信息，不能猜测价格、原料、功效、销量、口味、产地或优惠。输出 JSON：{"product_name":"简短商品名称","category":"行业类别","visible_facts":["明确可见事实"],"uncertain":["需要商家确认的信息"],"suggested_script":"60到100字的自然宣传口播，无法确认的信息使用[请补充]占位符"}。只输出 JSON。`,
              },
              { role: "user", content: `视觉模型对商品图片的描述如下：\n${description}` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: 700,
          }),
        });
        if (!analysisResponse.ok) throw new Error("商品信息整理失败");
        const analysisPayload = await analysisResponse.json();
        const parsed = JSON.parse(analysisPayload?.choices?.[0]?.message?.content || "{}");
        return json({
          product_name: clean(parsed.product_name, 80) || "待确认商品",
          category: clean(parsed.category, 50) || "本地商业",
          visible_facts: Array.isArray(parsed.visible_facts) ? parsed.visible_facts.map((item) => clean(item, 100)).filter(Boolean).slice(0, 6) : [],
          uncertain: Array.isArray(parsed.uncertain) ? parsed.uncertain.map((item) => clean(item, 100)).filter(Boolean).slice(0, 6) : [],
          suggested_script: clean(parsed.suggested_script, 500),
        }, 200, origin);
      } catch (error) {
        console.error("Image analysis failed", error);
        return json({ error: "暂时无法识别图片，请换一张清晰的商品图重试" }, 502, origin);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "请求格式错误" }, 400, origin);
    }

    if (url.pathname === "/tts") {
      if (!env.TENCENT_SECRET_ID || !env.TENCENT_SECRET_KEY) {
        return json({ error: "自动讲解服务尚未配置，请先添加腾讯云密钥" }, 503, origin);
      }
      const text = clean(body.text, 150);
      const allowedVoices = new Set([101001, 101004, 101030]);
      const voiceType = allowedVoices.has(Number(body.voiceType)) ? Number(body.voiceType) : 101001;
      if (text.length < 2) return json({ error: "口播内容太短" }, 400, origin);
      try {
        const speech = await synthesizeSpeech(text, voiceType, env);
        return json({ audio: speech.audio, codec: "mp3", request_id: speech.requestId }, 200, origin);
      } catch (error) {
        console.error("TTS request failed", error);
        return json({ error: "自动讲解暂时不可用，请稍后重试" }, 502, origin);
      }
    }

    if (!env.DEEPSEEK_API_KEY) {
      return json({ error: "服务尚未配置完成" }, 503, origin);
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
