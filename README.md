# dsh-plugin-recall

DeepSeek Harness 插件:给模型**跨会话记忆** —— 全文检索所有历史会话,把最强匹配片段带回当前上下文。

## 背景

DSH 已经把每个会话持久化,并用 SQLite FTS5 建了全文索引(`ctx.sessionQuery.searchSessions`),但**没有任何面向模型的工具去读它** —— 新会话对旧会话的决策、命令、踩过的坑一无所知。`recall` 把这个现成索引变成模型的能力:开新会话先 `recall` 一下,接着上次的进度继续。

## 使用

**模型工具 `recall`:**

```text
recall query: "we decided to use sqlite"     # 默认返回最多 5 个会话
recall query: "publish script" limit: 3
recall query: "权限绕过" sessionIds: ["s_xxx"]   # 限定会话范围
```

返回每个命中会话:session id、时间、事件类型、live/persisted 标记、最强匹配片段。查询按**字面短语**处理(永不解释为 FTS 可执行语法)。

**人类命令 `/recall <查询>`:** 同样输出。

## 安装

```bash
dsh plugin --profile web add dsh-plugin-recall
```

挂载(标准 web profile 已含 `dsh-session-query-sqlite`,无需额外配置):

```yaml
- insert:
    - id: recall
      name: dsh-plugin-recall
```

## 设计说明

- **复用官方基建**:直接调用 `ctx.sessionQuery.searchSessions`(SQLite FTS5),不改任何官方包;`sessionQuery` 未挂载时工具给出明确提示,而不是让组合加载失败。
- **纯逻辑可单测**:参数校验 / 请求构建 / 命中映射 / 渲染在 `lib/recall.js`,`npm test` 零依赖。
- **只拷贝叶字段**:命中结果从 live 服务对象提取为纯 JSON(sessionId / time / type / snippet),绝不引用内部对象。

## 诚实边界

- 依赖 `ctx.sessionQuery` 存在;`openAt: never` 配置下全文检索被禁用时,`recall` 会报错提示。
- 命中片段是 FTS5 的高亮摘录(unicode61 分词器,`AI` 匹配不到 token `BRAID` 这类子串),不是精确回溯;需要精确读取请配合 session 工具。
- 检索范围为当前 DSH_HOME 的持久化会话语料,不含其他机器/部署的历史。

## 本地开发

```bash
cd plugins/dsh-plugin-recall
npm test          # node --test,零依赖
```

接线集成测试(真实 Cordis + mock sessionQuery):见仓库根 `test-wiring.mjs`。
