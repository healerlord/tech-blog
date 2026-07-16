# KYRIE.DEV CMS Auth

GitHub OAuth Worker for the private writing admin. The flow is derived from
Sveltia CMS Authenticator revision
`5de9b9785fd4fb1a58776dc4912aaf252ddc5f3d` (MIT), with GitHub-only routing,
least-privilege public-repository scopes, and a `healerlord` allowlist.

Required Worker secrets:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Set them with:

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID --config workers/cms-auth/wrangler.jsonc
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config workers/cms-auth/wrangler.jsonc
```

The GitHub OAuth App callback is the deployed Worker URL followed by `/callback`.
No OAuth value belongs in the repository or generated site.
