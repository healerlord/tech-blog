# KYRIE.DEV

个人技术博客，使用 Astro 静态生成，内容以 Markdown 保存。视觉方向为 Editorial Signal：编辑式网格、黑白主调和少量酸性绿强调。

## 本地运行

环境要求：Node.js 22.12 或更高版本、pnpm 11。

```bash
pnpm install
pnpm dev
```

默认预览地址为 `http://localhost:4321`。

## 常用命令

```bash
pnpm test          # 单元、本地构建和 GitHub Pages 路径测试
pnpm test:site     # 本地生产构建与页面产物测试
pnpm test:github   # 模拟 healerlord/tech-blog 的 Pages 路径
pnpm test:unit     # 纯函数单元测试
pnpm check         # Astro、TypeScript 和内容 schema 检查
pnpm build         # 生成 dist 静态站点
```

## 写文章

推荐方式：`/write` 写作台，本地和线上共用同一套 Typora 式界面。

- **本地**：`pnpm dev` 后访问 `http://localhost:4321/write/`，自动进入文件模式，停笔自动保存到 `src/data/blog`。
- **线上**：访问 `https://healerlord.github.io/tech-blog/write/`，粘贴一个
  Fine-grained Token（仅需本仓库 Contents 读写权限）登录 GitHub 模式。
  线上没有自动保存——`⌘S` 或「保存」按钮把当前文章作为一个 commit
  提交到 `main`（带 sha 冲突检测，远端有新提交时会报错而不是覆盖），
  每次提交会触发 Pages 重新部署；`draft: true` 的草稿不会出现在公开页面。
  Token 只存在浏览器 localStorage，右上角可退出登录。
  线上上传的图片在下一次部署完成后才可访问。

写作台核心能力：

- 左侧文章库支持筛选、新建草稿，正文区输入 Markdown 语法实时渲染，`/` 唤起插入菜单；
- 元信息（摘要、发布日期、专题、草稿/发布、首页推荐）在右侧「文章设置」抽屉中编辑；
- 停止输入约 1.6 秒自动保存，`⌘S` 立即保存，保存即写入 `src/data/blog/<slug>.md`，格式与手写文件完全一致；
- 保存前经过与构建相同的 schema 校验（slug 规则、专题目录、featured 必填 visualAlt），坏数据无法落盘；
- 粘贴或上传图片会保存到 `public/uploads/`。

写作台由 `src/integrations/write-dev-api.ts` 提供本地文件 API，仅在
`pnpm dev` 下可用；线上发布链路仍使用 `/admin/`（见「在线写作」）。

也可以直接在 `src/data/blog` 新建 Markdown 文件：

```yaml
---
title: "文章标题"
description: "用于列表、搜索和 SEO 的摘要"
publishedAt: 2026-07-15
tags: ["Java", "Architecture"]
featured: false
draft: false
visualAlt: "文章技术视觉的文字说明"
---
```

阅读时长在构建时根据正文自动计算。首页必须至少存在一篇 `featured: true` 的已发布文章。

## 管理专题

文章的 `tags` 会映射到 `src/data/topics.ts` 中的专题目录。新增一种标签时，同时在该文件中配置展示名、固定 `slug` 和说明，专题索引才会展示它。

- `/topics/` 中每个专题只展示最新 4 篇文章和文章总数。
- `/topics/<slug>/` 展示完整专题，默认每页 20 篇。
- 第 2 页起使用 `/topics/<slug>/2/`、`/topics/<slug>/3/` 等静态路径。

专题路径由 `slug` 决定。发布后可以修改专题名称和说明，但不应随意修改 `slug`，否则旧链接会失效。

## 在线写作

部署完成后，从 `/tech-blog/admin/` 登录写作后台。文章仍以 Markdown
保存在 GitHub；草稿使用 `draft: true`，发布会触发现有 Pages 工作流。

首次启用需要配置免费的 Cloudflare OAuth Worker，参见
[`docs/online-writing-setup.md`](docs/online-writing-setup.md)。

## GitHub Pages

当前默认目标为：

```text
https://healerlord.github.io/tech-blog/
```

发布步骤：

1. 在 GitHub 创建名为 `tech-blog` 的仓库并推送 `main` 分支。
2. 打开仓库 `Settings → Pages`。
3. 将发布来源选择为 `GitHub Actions`。
4. 推送到 `main`，`.github/workflows/deploy.yml` 会自动构建和发布。

如果仓库名或域名变化，可以在构建环境设置：

- `SITE_URL`：站点域名，例如 `https://healerlord.github.io`。
- `BASE_PATH`：项目路径，例如 `/tech-blog`；自定义域名部署在根目录时设为 `/`。

## 项目结构

```text
src/data/blog/      Markdown 文章
src/components/     首页和全局组件
src/layouts/        页面与文章布局
src/pages/          Astro 路由
src/lib/            内容查询和纯辅助函数
tests/              单元与构建产物测试
```
