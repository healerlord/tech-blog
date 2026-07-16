# 在线写作后台配置

## 1. 部署认证 Worker

1. 登录 Cloudflare，创建免费 Workers 账户。
2. 在本仓库执行 `pnpm exec wrangler login --use-keyring`。
3. 执行 `pnpm cms:auth:deploy`，记录输出的 `workers.dev` HTTPS 地址。

## 2. 创建 GitHub OAuth App

打开 `https://github.com/settings/applications/new`：

- Application name: `KYRIE.DEV Writing Admin`
- Homepage URL: `https://healerlord.github.io/tech-blog/admin/`
- Authorization callback URL: Worker HTTPS 地址后加 `/callback`

生成 Client Secret 后，不要把它写进本仓库。

## 3. 配置 Worker Secrets

执行：

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID --config workers/cms-auth/wrangler.jsonc
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config workers/cms-auth/wrangler.jsonc
pnpm cms:auth:deploy
```

## 4. 配置 GitHub Actions

在 `healerlord/tech-blog` 的 `Settings -> Secrets and variables -> Actions -> Variables`
中新建 `CMS_AUTH_URL`，值为 Worker HTTPS 地址，不带末尾 `/`。

## 5. 验证闭环

访问 `https://healerlord.github.io/tech-blog/admin/`，使用 `healerlord`
登录。新建文章时保持“保存为草稿”为开启状态；确认公开站点看不到草稿后，
关闭该开关并保存，等待 Pages 工作流完成。

## 故障恢复

- Worker 故障：使用 GitHub 网页编辑器修改 `src/data/blog`。
- OAuth 泄露：在 GitHub 删除 OAuth App Secret，并在 Cloudflare 删除对应 Secret。
- 发布失败：查看 Actions 日志，修复 Markdown frontmatter 后重新提交。
- 误发布：把对应文章的 `draft` 改回 `true` 并提交。
