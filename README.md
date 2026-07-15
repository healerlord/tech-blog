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

在 `src/data/blog` 新建 Markdown 文件：

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
