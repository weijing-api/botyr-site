# 第一阶段数据结构

## 案例库

当前案例存放在 `data/cases.json`，由 `case-library.js` 动态加载，页面组件不写死案例内容。

后续数据库建议：

```sql
CREATE TABLE cases (
  id UUID PRIMARY KEY,
  industry VARCHAR(50) NOT NULL,
  icon VARCHAR(20),
  title VARCHAR(200) NOT NULL,
  summary TEXT NOT NULL,
  status VARCHAR(30) NOT NULL,
  status_label VARCHAR(30),
  plays INTEGER,
  leads INTEGER,
  plans_generated INTEGER,
  merchant_authorized BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP NULL,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

只有 `merchant_authorized = true` 且数据完成核验的案例才应公开真实播放量和咨询人数。

## 行为事件

```sql
CREATE TABLE analytics_events (
  event_id UUID PRIMARY KEY,
  event_name VARCHAR(80) NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  visitor_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  page VARCHAR(300),
  referrer TEXT,
  properties JSON,
  schema_version INTEGER NOT NULL DEFAULT 1
);
```

建议索引：

```sql
CREATE INDEX idx_events_name_time ON analytics_events(event_name, occurred_at);
CREATE INDEX idx_events_session ON analytics_events(session_id);
CREATE INDEX idx_cases_status ON cases(status, published_at);
```

## 后续历史记录预留

第二阶段可增加：

```sql
CREATE TABLE generation_history (
  id UUID PRIMARY KEY,
  visitor_id VARCHAR(100),
  user_id UUID NULL,
  industry VARCHAR(50),
  product_name VARCHAR(200),
  generated_content JSON NOT NULL,
  operation_log JSON,
  created_at TIMESTAMP NOT NULL
);
```

游客按 `visitor_id` 保留最近 3 条；登录用户按 `user_id` 永久保存。
