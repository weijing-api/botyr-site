# 数据埋点说明

第一阶段埋点由 `analytics.js` 提供，不依赖第三方统计服务，也不会阻塞页面交互。

## 事件列表

| 事件名 | 触发位置 | 含义 |
| --- | --- | --- |
| `page_view` | 页面加载 | 首页访问 |
| `generate_cta_click` | 导航、首屏及页面生成入口 | 点击免费生成方案 |
| `form_start` | `#idea-form` 第一次输入 | 用户开始填写 |
| `form_submit` | `#idea-form` 提交 | 完成表单提交 |
| `generation_success` | DeepSeek 成功返回并渲染结果 | AI 生成成功 |
| `solution_copy` | 完整方案或单条口播复制按钮 | 用户复制内容 |
| `wechat_click` | 微信悬浮按钮、结果页、升级和案例入口 | 点击微信咨询 |
| `regenerate_click` | `#regenerate` | 点击换一个爆款方向 |

行业模板另记录 `industry_template_selected`，案例征集另记录 `case_submission_click`。

## 数据结构

每条事件格式：

```json
{
  "event_id": "event_xxx",
  "name": "form_submit",
  "occurred_at": "2026-07-29T12:00:00.000Z",
  "visitor_id": "visitor_xxx",
  "session_id": "session_xxx",
  "page": "/",
  "page_url": "https://botyr.com/",
  "referrer": null,
  "properties": {
    "industry": "餐饮 / 咖啡 / 烘焙",
    "has_product": true,
    "has_facts": true,
    "has_city": true
  },
  "schema_version": 1
}
```

不会记录产品名、真实卖点、价格、城市输入内容等经营信息。

## 本地测试

打开浏览器开发者工具 Console：

```js
BotyrAnalytics.getEvents()
BotyrAnalytics.exportJSON()
```

清空测试数据：

```js
BotyrAnalytics.clearLocalEvents()
```

也可以监听实时事件：

```js
document.addEventListener('botyr:analytics', event => console.log(event.detail))
```

## 接入第三方或自建后台

Google Analytics 的 `gtag` 或百度统计 `_hmt` 存在时会自动转发。

接入自建接口：

```js
BotyrAnalytics.registerAdapter(event => {
  navigator.sendBeacon('/analytics/events', JSON.stringify(event))
})
```

正式运营时建议将事件写入服务端数据库；浏览器 `localStorage` 仅用于第一阶段验证和调试。
