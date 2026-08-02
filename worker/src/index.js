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

function normalizeIdea(idea) {
  const shots = Array.isArray(idea?.shots) ? idea.shots.map((shot) => {
    if (typeof shot === "string") return clean(shot, 140);
    return clean(shot?.shot || shot?.content || shot?.description || shot?.text, 140);
  }).filter(Boolean).slice(0, 3) : [];
  return {
    title: clean(idea?.title, 100),
    hook: clean(idea?.hook, 120),
    script: clean(idea?.script, 500),
    shots,
    cta: clean(idea?.cta, 120),
  };
}

const CLAIM_TERMS = [
  "不是冷冻", "绝不", "保证", "最好", "第一", "性价比之王", "不烫手", "不闷", "不软",
  "热气腾腾", "拿到手还是烫", "酥脆", "多汁", "顺滑", "不腻", "显白", "耐用", "省空间",
  "新鲜", "刚出锅", "每天现做", "限量", "售罄", "排队", "火爆", "回头客", "最爱", "招牌",
  "秘制", "零添加", "0添加", "无添加", "健康", "正宗", "地道", "裹粉", "油花", "油温", "热油",
  "几分钟", "分钟出锅", "趁热", "冷藏柜", "冷藏", "冰柜", "肉质", "金黄", "冒热气", "递给顾客",
  "顾客接过", "顾客反应", "刚做", "现做", "当天", "现烤", "现煮", "现磨", "手工", "手作", "纯天然",
  "无糖", "低脂", "减肥", "修复", "改善", "提亮", "显瘦", "防水", "防晒", "耐磨", "防滑", "环保",
  "进口", "原装", "专业", "免费", "赠送", "优惠", "半价", "特价",
];

function unsupportedClaims(text, factBoundary) {
  const content = clean(text, 1200).replace(/\s+/g, "");
  const allowed = clean(factBoundary, 1200).replace(/\s+/g, "");
  return CLAIM_TERMS.filter((term) => content.includes(term) && !allowed.includes(term));
}

function groundedNarration(product, facts, city = "", category = "") {
  const safeProduct = clean(product, 22) || "这款商品";
  const factList = clean(facts, 700)
    .split(/[；;\n]/)
    .map((item) => clean(item, 54))
    .filter(Boolean)
    .slice(0, 3);
  const budget = Math.max(10, 44 - safeProduct.length - 13);
  const selectedFacts = [];
  for (const fact of factList) {
    const candidate = [...selectedFacts, fact].join("；");
    if (candidate.length > budget) break;
    selectedFacts.push(fact);
  }
  const summary = (selectedFacts.join("；") || factList[0] || "实物细节").slice(0, budget);
  return clean(`${safeProduct}：${summary}。想看细节，评论告诉我。`, 46);
}

function enforceNarrationGrounding(narration, product, facts, category = "", city = "", strict = false) {
  const boundary = `${product}；${facts}；${category}；${city}`;
  const script = clean(narration?.script, 500);
  const violations = unsupportedClaims(script, boundary);
  if (strict || script.length < 30 || violations.length) {
    const safeScript = groundedNarration(product, facts, city, category);
    return {
      hook: clean(safeScript.split(/[。！？]/)[0], 80),
      angle: "商品真实细节",
      script: safeScript,
      fact_guard: violations.length ? `已移除未经确认的表述：${violations.join("、")}` : "严格真实信息模式",
    };
  }
  return {
    hook: clean(narration?.hook, 80),
    angle: clean(narration?.angle, 80),
    script,
    fact_guard: "事实审校通过",
  };
}

function groundedShots(product, facts, city = "") {
  const safeProduct = clean(product, 48) || "商品";
  const keyFacts = clean(facts, 300).split(/[；;\n]/).map((item) => clean(item, 48)).filter(Boolean).slice(0, 2);
  return [
    `镜头1：${safeProduct}整体近景，第一秒直接露出主体`,
    `镜头2：依次拍清真实细节：${keyFacts.join("；") || "商品外观与使用细节"}`,
    `镜头3：${clean(city, 20) ? `${clean(city, 20)}门店或` : ""}商品收尾，字幕引导观众评论想了解的细节`,
  ];
}

function ideaReviewText(idea) {
  return [idea?.title, idea?.hook, idea?.script, ...(Array.isArray(idea?.shots) ? idea.shots : []), idea?.cta]
    .map((item) => typeof item === "string" ? item : JSON.stringify(item || ""))
    .join("；");
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function splitSpeechText(text, maxChars = 46) {
  const sentences = clean(text, 150).split(/(?<=[。！？；])/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      for (let offset = 0; offset < sentence.length; offset += maxChars) chunks.push(sentence.slice(offset, offset + maxChars));
      continue;
    }
    const previous = chunks[chunks.length - 1];
    if (previous && previous.length + sentence.length <= maxChars) chunks[chunks.length - 1] += sentence;
    else chunks.push(sentence);
  }
  return chunks.length ? chunks : [clean(text, maxChars)];
}

function wavDataOffset(bytes) {
  if (bytes.length < 44 || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF") throw new Error("语音格式异常");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === "data") return offset + 8;
    offset += 8 + size + (size % 2);
  }
  throw new Error("语音数据不完整");
}

function mergeWavAudio(parts) {
  if (parts.length === 1) return parts[0];
  const wavParts = parts.map((part) => fromBase64(part.audio));
  const offsets = wavParts.map(wavDataOffset);
  const headerLength = offsets[0];
  const payloadLength = wavParts.reduce((total, bytes, index) => total + bytes.length - offsets[index], 0);
  const merged = new Uint8Array(headerLength + payloadLength);
  merged.set(wavParts[0].slice(0, headerLength), 0);
  let cursor = headerLength;
  wavParts.forEach((bytes, index) => {
    const payload = bytes.slice(offsets[index]);
    merged.set(payload, cursor);
    cursor += payload.length;
  });
  const view = new DataView(merged.buffer);
  view.setUint32(4, merged.length - 8, true);
  view.setUint32(headerLength - 4, payloadLength, true);
  return { audio: toBase64(merged.buffer), requestId: null, provider: "cloudflare", codec: "wav" };
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
    codec: "mp3",
  };
}

async function synthesizeWorkersSpeech(text, env) {
  if (!env.AI) throw new Error("语音服务暂不可用");
  let generated;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      generated = await env.AI.run("@cf/myshell-ai/melotts", {
        prompt: text,
        lang: "zh",
      });
      break;
    } catch (error) {
      lastError = error;
      console.warn(`Workers AI TTS attempt ${attempt + 1} failed`, error);
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  if (!generated) throw lastError || new Error("语音服务暂不可用");
  const audioPayload = generated?.audio;
  if (typeof audioPayload === "string") {
    return { audio: audioPayload, requestId: null, provider: "cloudflare", codec: "wav" };
  }
  let buffer;
  if (audioPayload instanceof ArrayBuffer) buffer = audioPayload;
  else if (ArrayBuffer.isView(audioPayload)) {
    buffer = audioPayload.buffer.slice(audioPayload.byteOffset, audioPayload.byteOffset + audioPayload.byteLength);
  } else if (audioPayload instanceof ReadableStream) buffer = await new Response(audioPayload).arrayBuffer();
  else if (audioPayload instanceof Response) buffer = await audioPayload.arrayBuffer();
  else if (generated instanceof ArrayBuffer) buffer = generated;
  else if (ArrayBuffer.isView(generated)) buffer = generated.buffer.slice(generated.byteOffset, generated.byteOffset + generated.byteLength);
  else if (generated instanceof ReadableStream) buffer = await new Response(generated).arrayBuffer();
  else if (generated instanceof Response) buffer = await generated.arrayBuffer();
  if (!buffer || !buffer.byteLength) throw new Error("语音服务返回了空音频");
  return { audio: toBase64(buffer), requestId: null, provider: "cloudflare", codec: "wav" };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);
    if (!["/generate", "/tts", "/analyze-image", "/generate-promo-image", "/generate-narration"].includes(url.pathname) || request.method !== "POST") {
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
                content: `你是谨慎的商品图片分析员，也是本地商家短视频编导。只能依据视觉描述提取图片中明确可见的信息，不能猜测价格、原料、功效、销量、口味、产地、优惠或顾客评价。
宣传口播必须像真实短视频，而不是客服介绍：
1. 90到140个中文字符，约18到28秒；
2. 前20个字内点出具体商品，并用一个与画面有关的疑问、细节或消费场景形成3秒钩子；
3. 中段按“画面证据→顾客能感知的价值”表达，只能使用图片中明确可见的事实；
4. 结尾只给一个自然行动指令，例如评论想看哪个细节、私信问具体信息或到店前咨询；
5. 禁止使用“大家好、欢迎光临、今天给大家看看、品质保证、性价比之王、闭眼入”等空泛套话；
6. 信息不足就省略，不要在口播中出现[请补充]等占位符；短句、口语化、有停顿，商品名称自然出现1到2次。
输出 JSON：{"product_name":"简短具体的商品名称","category":"行业类别","visible_facts":["明确可见事实"],"uncertain":["需要商家确认的信息"],"hook":"前3秒开场","angle":"本条视频的宣传角度","suggested_script":"完整自然宣传口播"}。只输出 JSON。`,
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
        const productName = clean(parsed.product_name, 80) || "待确认商品";
        const category = clean(parsed.category, 50) || "本地商业";
        const visibleFacts = Array.isArray(parsed.visible_facts) ? parsed.visible_facts.map((item) => clean(item, 100)).filter(Boolean).slice(0, 6) : [];
        const guarded = enforceNarrationGrounding({
          hook: parsed.hook,
          angle: parsed.angle,
          script: parsed.suggested_script,
        }, productName, visibleFacts.join("；"), category, "", true);
        return json({
          product_name: productName,
          category,
          visible_facts: visibleFacts,
          uncertain: Array.isArray(parsed.uncertain) ? parsed.uncertain.map((item) => clean(item, 100)).filter(Boolean).slice(0, 6) : [],
          hook: guarded.hook,
          angle: guarded.angle,
          suggested_script: guarded.script,
          fact_guard: guarded.fact_guard,
        }, 200, origin);
      } catch (error) {
        console.error("Image analysis failed", error);
        return json({ error: "暂时无法识别图片，请换一张清晰的商品图重试" }, 502, origin);
      }
    }

    if (url.pathname === "/generate-promo-image") {
      if (!env.AI) return json({ error: "宣传图生成服务尚未配置完成" }, 503, origin);
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
      if (image.size > 6 * 1024 * 1024) return json({ error: "图片不能超过 6MB" }, 413, origin);
      const product = clean(form.get("product"), 100) || "商品";
      const facts = clean(form.get("facts"), 400);
      const style = clean(form.get("style"), 30) || "refine";
      const ratio = clean(form.get("ratio"), 10) === "square" ? "square" : "portrait";
      const stylePrompts = {
        refine: "premium commercial product photography, clean studio lighting, realistic shadows, elegant minimal background, high-end advertising retouch",
        promo: "energetic Chinese local-business promotion poster, premium red and warm gold lighting, clear central product, spacious layout for offer text",
        douyin: "cinematic vertical short-video cover, dramatic light, bold visual focus, high contrast, modern social media advertising",
        xhs: "bright tasteful lifestyle editorial, soft natural light, clean composition, premium Xiaohongshu commercial cover aesthetic",
      };
      try {
        const generated = await env.AI.run("@cf/runwayml/stable-diffusion-v1-5-img2img", {
          prompt: `Create a professional advertising image for ${product}. ${facts ? `Confirmed visible facts: ${facts}.` : ""} ${stylePrompts[style] || stylePrompts.refine}. Preserve the original product shape, package colors and logo placement. No added claims. No text.`,
          negative_prompt: "distorted package, changed logo, misspelled text, extra products, duplicate objects, deformed object, watermark, low resolution, blurry, cartoon",
          image_b64: toBase64(await image.arrayBuffer()),
          width: ratio === "square" ? 768 : 768,
          height: ratio === "square" ? 768 : 1024,
          num_steps: 20,
          strength: 0.32,
          guidance: 7.5,
        });
        const headers = new Headers(cors(origin));
        headers.set("Content-Type", "image/png");
        headers.set("Cache-Control", "no-store");
        return new Response(generated, { status: 200, headers });
      } catch (error) {
        console.error("Promo image generation failed", error);
        return json({ error: "宣传图生成失败，请稍后重试或换一张商品图" }, 502, origin);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "请求格式错误" }, 400, origin);
    }

    if (url.pathname === "/tts") {
      const text = clean(body.text, 150);
      const allowedVoices = new Set([101001, 101004, 101030]);
      const voiceType = allowedVoices.has(Number(body.voiceType)) ? Number(body.voiceType) : 101001;
      if (text.length < 2) return json({ error: "口播内容太短" }, 400, origin);
      try {
        let speech;
        if (env.TENCENT_SECRET_ID && env.TENCENT_SECRET_KEY) {
          try {
            speech = { ...(await synthesizeSpeech(text, voiceType, env)), provider: "tencent" };
          } catch (error) {
            console.warn("Tencent TTS unavailable, falling back to Workers AI", error);
          }
        }
        if (!speech) {
          const segments = splitSpeechText(text);
          const parts = await Promise.all(segments.map((segment) => synthesizeWorkersSpeech(segment, env)));
          speech = mergeWavAudio(parts);
        }
        return json({ audio: speech.audio, codec: speech.codec, request_id: speech.requestId, provider: speech.provider }, 200, origin);
      } catch (error) {
        console.error("TTS request failed", error);
        return json({ error: "自动讲解暂时不可用，请稍后重试" }, 502, origin);
      }
    }

    if (!env.DEEPSEEK_API_KEY) {
      return json({ error: "服务尚未配置完成" }, 503, origin);
    }

    if (url.pathname === "/generate-narration") {
      const product = clean(body.product, 100);
      const category = clean(body.category, 60) || "本地商业";
      const facts = clean(body.facts, 700);
      if (!product || !facts) return json({ error: "请先确认商品名称和图片中的真实卖点" }, 400, origin);
      try {
        const narrationResponse = await fetch("https://api.deepseek.com/chat/completions", {
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
                content: `你是中国本地商家的短视频商品编导。请把商家确认的真实信息写成一段可直接配音的商品宣传口播。
结构固定为：前3秒钩子→商品画面证据→顾客能感知的价值或适用场景→一个行动引导。
要求：
- 90到140个中文字符，约18到28秒；前20字内必须自然点出商品；
- 像老板、店员或真实使用者在说话，短句、有停顿，不写成广告说明书；
- 禁止“大家好、欢迎光临、今天给大家看看、品质保证、性价比之王、闭眼入”等空话；
- 只能使用商家提供的真实事实，不得补写价格、优惠、原料、口味、功效、销量、稀缺、评价、店龄或体验；
- 没有提供的信息直接不说，不要出现占位符；
- 结尾只选一个动作：评论、私信咨询或到店前咨询，不得同时堆多个动作。
输出 JSON：{"hook":"前3秒开场","angle":"宣传角度","script":"完整口播"}。只输出 JSON。`,
              },
              { role: "user", content: `行业：${category}\n商品：${product}\n商家确认的真实事实：${facts}` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.55,
            max_tokens: 500,
          }),
        });
        if (!narrationResponse.ok) throw new Error("解说策划服务暂时不可用");
        const narrationPayload = await narrationResponse.json();
        const parsed = JSON.parse(narrationPayload?.choices?.[0]?.message?.content || "{}");
        const draftScript = clean(parsed.script, 500);
        if (draftScript.length < 30) throw new Error("解说内容过短");

        let reviewed = { script: draftScript, hook: clean(parsed.hook, 80), angle: clean(parsed.angle, 80) };
        try {
          const reviewResponse = await fetch("https://api.deepseek.com/chat/completions", {
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
                  content: `你是广告事实审校员。商品名与商家确认事实构成唯一事实边界。逐句审查口播并重写：
- 删除所有事实中没有明确出现的味道、口感、气味、材质、原料、功效、效果、使用结果、价格、优惠、销量、稀缺性、生产过程、顾客评价和体验；
- “酥脆、多汁、顺滑、不腻、显白、耐用、省空间、刚出锅、每天现做”等都属于需要证据的主张，事实中没有原词就不得保留；
- 可以描述镜头能看到的颜色、形状、包装、数量、标识和空间关系；可以提出问题、说明接下来拍什么、邀请观众咨询，但不能把未知信息写成肯定句；
- 保留短视频结构：3秒钩子→真实画面证据→观看价值→一个行动引导；
- 80到140个中文字符，短句、有停顿，不用“大家好、今天给大家看看”，不出现占位符。
输出 JSON：{"hook":"审校后的开场","angle":"安全且具体的宣传角度","script":"审校后的完整口播"}。只输出 JSON。`,
                },
                { role: "user", content: `商品：${product}\n允许使用的事实：${facts}\n待审校口播：${draftScript}` },
              ],
              response_format: { type: "json_object" },
              temperature: 0.1,
              max_tokens: 500,
            }),
          });
          if (reviewResponse.ok) {
            const reviewPayload = await reviewResponse.json();
            const checked = JSON.parse(reviewPayload?.choices?.[0]?.message?.content || "{}");
            const checkedScript = clean(checked.script, 500);
            if (checkedScript.length >= 30) {
              reviewed = {
                script: checkedScript,
                hook: clean(checked.hook, 80) || reviewed.hook,
                angle: clean(checked.angle, 80) || reviewed.angle,
              };
            }
          }
        } catch (error) {
          console.warn("Narration fact review failed, using constrained draft", error);
        }
        return json(enforceNarrationGrounding(reviewed, product, facts, category, "", true), 200, origin);
      } catch (error) {
        console.error("Narration generation failed", error);
        return json({ error: "商品解说暂时没有生成成功，请稍后重试" }, 502, origin);
      }
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
15. hook 必须承担前3秒留人作用，用具体商品、价格、细节、问题或消费场景开场；script 的第一句必须自然承接 hook，不能另起一个无关的“大家好”；
16. script 按“钩子→真实卖点证据→顾客能感知的价值→一个行动引导”组织，90到140个中文字符，短句、口语化，适合18到28秒配音；
17. 禁止“大家好、欢迎光临、今天给大家看看、品质保证、性价比之王、闭眼入”等客服式或空泛套话；结尾只引导收藏、评论、私信中的一个动作；
18. shots 要与口播逐段对应：第一个镜头拍最强视觉钩子，第二个镜头证明真实卖点，第三个镜头承接行动引导；
19. 只输出 JSON，格式为 {"ideas":[...]}，不要输出 Markdown。`;

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
      let reviewedIdeas = parsed.ideas.slice(0, 7);
      try {
        const reviewResponse = await fetch("https://api.deepseek.com/chat/completions", {
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
                content: `你是本地商家短视频方案的事实审校员。用户资料是唯一事实边界。审校输入中的全部方案并返回相同 JSON 结构：
1. 删除或改写资料中没有明确出现的价格、优惠、味道、口感、功效、原料、材质、温度、库存、生产步骤、销量、顾客反应、比较和绝对化结论；合理但未提供的推断也不能写成事实；
2. 不得把“下单后现做”扩大成“绝不提前准备”，不得把“纸袋包装”扩大成“不闷不软”，不得凭空增加冰柜、裹粉、油温、顾客接过商品等镜头；
3. 每条 script 保持“具体钩子→至少一项原样真实卖点→顾客观看价值→单一行动引导”，70到140个中文字符，不用客服式开场；
4. shots 必须是三个字符串，只拍商品、资料中已提供的制作细节、门店环境或已授权员工；餐饮不得出现血腥宰杀画面，未说明有顾客授权时不得拍顾客；
5. title、hook、script、shots、cta 全部紧扣原商品和地区，保留7个不同方向。
只输出 {"ideas":[...]} JSON。`,
              },
              {
                role: "user",
                content: `行业：${industry}\n产品或服务：${offer}\n允许使用的真实卖点：${facts}\n地区：${city}\n待审校方案：${JSON.stringify({ ideas: reviewedIdeas })}`,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 2200,
          }),
        });
        if (reviewResponse.ok) {
          const reviewPayload = await reviewResponse.json();
          const checked = JSON.parse(reviewPayload?.choices?.[0]?.message?.content || "{}");
          if (Array.isArray(checked.ideas) && checked.ideas.length) reviewedIdeas = checked.ideas.slice(0, 7);
        }
      } catch (error) {
        console.warn("Idea fact review failed, using constrained draft", error);
      }
      const ideas = reviewedIdeas.map(normalizeIdea).filter((idea) => idea.title && idea.script).map((idea) => {
        const boundary = `${offer}；${facts}；${industry}；${city}`;
        const ideaViolations = unsupportedClaims(ideaReviewText(idea), boundary);
        const guarded = enforceNarrationGrounding(idea, offer, facts, industry, city, ideaViolations.length > 0);
        if (guarded.fact_guard !== "事实审校通过") {
          return {
            ...idea,
            hook: guarded.hook,
            script: guarded.script,
            shots: groundedShots(offer, facts, city),
            cta: "还想确认哪个细节，评论告诉我。",
            fact_guard: ideaViolations.length ? `已移除未经确认的表述：${ideaViolations.join("、")}` : guarded.fact_guard,
          };
        }
        return { ...idea, fact_guard: guarded.fact_guard };
      });
      if (!ideas.length) throw new Error();
      return json({ ideas }, 200, origin);
    } catch {
      return json({ error: "AI 返回格式异常，请重新生成" }, 502, origin);
    }
  },
};
