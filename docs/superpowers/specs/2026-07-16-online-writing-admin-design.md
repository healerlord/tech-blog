# KYRIE.DEV Online Writing Admin Design

Date: 2026-07-16
Status: Approved

## Purpose

Add a private, browser-based writing workflow to the existing Astro blog. The
owner can sign in with GitHub from a desktop or phone, create and edit Markdown
articles, save drafts, and publish without using a terminal. The public blog
remains a static GitHub Pages site and GitHub remains the only content store.

The first version is intentionally a single-author tool for the GitHub account
`healerlord`. It prioritizes low ongoing cost, mobile usability, recoverability,
and predictable maintenance over custom CMS visuals or team workflows.

## Goals

- Provide a writing interface at the logical `/admin/` route.
- Support GitHub sign-in on desktop and mobile without manually copying a token.
- Support creating articles, editing existing articles, saving drafts, and publishing.
- Keep every article as a versioned Markdown file in `src/data/blog`.
- Trigger the existing GitHub Actions deployment when published content changes.
- Keep the expected monthly infrastructure cost at zero under current free tiers.
- Preserve a GitHub web-editor fallback if the CMS or authentication service is unavailable.

## Non-Goals

- Multiple authors, roles, invitations, or review workflows.
- Deleting articles from the CMS.
- A media library, image hosting service, or bulk asset management.
- Comments, analytics, newsletter management, or other site administration.
- A custom CMS implementation or a CMS UI that exactly matches the public blog.
- Offline publishing. Browser draft recovery is supported, but publishing requires network access.

## Architecture

### Static Admin Application

The blog exposes a Sveltia CMS application at `/admin/` under the configured
Astro base path. On GitHub Pages the concrete URL is
`/tech-blog/admin/`. The admin page is excluded from public navigation and
declares `noindex`, but its URL is not treated as a security boundary.

Sveltia CMS is installed as an exact package version and bundled into the site.
The production admin does not load a moving `latest` script from a CDN. Version
updates are explicit code changes that must pass the same checks as the blog.

`admin/config.yml` maps the CMS article collection to `src/data/blog` and points
at `healerlord/tech-blog` on the `main` branch. Token login is disabled in the
production configuration; the visible authentication action uses GitHub OAuth.

### OAuth Service

GitHub's authorization-code flow requires a confidential client, so a small
Cloudflare Worker performs the OAuth code exchange. The Worker is based on the
official Sveltia CMS Authenticator and is deployed under the Cloudflare Workers
free plan.

The Worker owns only authentication concerns:

- hold `GITHUB_CLIENT_ID` and encrypted `GITHUB_CLIENT_SECRET` values;
- accept requests only from `healerlord.github.io` in production;
- preserve the authenticator's origin and OAuth state validation;
- reject authenticated GitHub users other than `healerlord`;
- return only the OAuth token response expected by Sveltia CMS.

The Worker does not store articles, drafts, sessions, or user profiles. Its
source is pinned to a reviewed upstream revision or vendored with attribution so
a future upstream change cannot alter the deployed authentication behavior
without review.

### GitHub Content Store

After authentication, Sveltia CMS reads and writes the configured repository
through GitHub's APIs. A save creates a normal Git commit. Git history is the
audit log and recovery mechanism; no database is introduced.

The current `getPublishedPosts` query already excludes entries where
`draft: true`. Therefore a draft may be safely committed to `main`: it remains
available to the CMS and Git history but is omitted from public article,
homepage, topic, search, RSS, and sitemap output.

Publishing changes `draft` to `false` and saves the file. That commit triggers
the existing GitHub Actions workflow, which rebuilds and deploys the public site.

## Content Model

The CMS article form and Astro content schema share these fields:

| Field | Behavior |
| --- | --- |
| `title` | Required article title. |
| `slug` | Required stable file identifier using lowercase ASCII letters, digits, and hyphens. |
| `description` | Required list, search, and SEO summary. |
| `publishedAt` | Required publication date, defaulting to the current date for a new entry. |
| `tags` | One or more values selected from the central topic catalog. |
| `featured` | Optional homepage feature toggle, default `false`. |
| `draft` | Publication gate, default `true` for new entries. |
| `visualAlt` | Required only when `featured` is true. |
| Body | Required Markdown article body with code-block support. |

The `slug` becomes the Markdown filename and must remain stable after
publication. Existing entries receive slugs matching their current filenames so
all current article URLs remain unchanged. Build-time checks reject a missing or
invalid slug, an unknown topic, a filename/slug mismatch, and a featured article
without `visualAlt`.

The CMS topic choices mirror `src/data/topics.ts`. An automated test guards
against catalog and CMS configuration drift.

## Author Workflow

### Sign In

1. The owner opens `/tech-blog/admin/` on a desktop or phone.
2. The admin opens GitHub OAuth through the Cloudflare Worker.
3. GitHub authenticates the owner and returns to the Worker callback.
4. The Worker accepts only `healerlord` and returns control to the CMS.
5. The CMS loads articles from `healerlord/tech-blog`.

The owner can install the responsive admin as a PWA. Sveltia's mobile sign-in
and QR handoff may be used as a convenience, but direct GitHub OAuth remains the
primary supported login path on every device.

### Create And Edit

The article library supports search, new article creation, and opening existing
entries. The editor uses a single-column layout on narrow screens. Field labels
and help text are Chinese; Sveltia system controls may remain English until the
project ships Chinese UI localization.

The body editor is the primary surface. Metadata remains available without
forcing a desktop-width split layout. Browser-side draft backups protect
unsaved typing from accidental navigation or a browser crash.

### Save Draft

New articles start with `draft: true`. Saving commits the Markdown file to
`main`, which makes it available from other devices while keeping it out of the
public build. A CI run may still occur after the commit; this is acceptable for
the expected personal-blog volume and avoids maintaining a separate draft branch.

### Publish

The owner reviews all required fields, changes `draft` to `false`, and saves.
Schema validation must pass before the commit. GitHub Actions then builds and
deploys the article. The admin links back to the live site, but deployment is
asynchronous and may take a short time to appear.

## Error Handling And Recovery

- Authentication failures keep the user on the login screen without exposing the client secret.
- A GitHub user other than `healerlord` receives an authorization failure.
- Invalid frontmatter or missing required fields block saving or fail CI with a specific validation message.
- A conflicting repository revision must surface as a save error; the CMS must not silently claim success.
- Unsaved editor content is recoverable from Sveltia's browser draft backup where supported.
- A failed GitHub Actions build leaves the previously deployed site intact and exposes the failure in Actions.
- Existing Markdown can always be edited through GitHub's web editor if `/admin/` or the Worker is unavailable.
- OAuth credentials can be rotated independently without touching article content.

The design assumes one active editor. Simultaneously editing the same article on
phone and desktop is unsupported and can cause a save conflict.

## Security And Privacy

- The GitHub client secret exists only as an encrypted Cloudflare Worker secret.
- No secret, PAT, or OAuth client secret is committed into the blog repository or public build.
- Production CMS configuration allows OAuth only.
- The Worker restricts browser origins and the authenticated GitHub username.
- The admin bundle is self-hosted at an exact reviewed version.
- The admin page uses HTTPS in production, `noindex`, and a restrictive Content Security Policy compatible with GitHub and the Worker.
- Public knowledge of the `/admin/` URL grants no repository access.
- Removing the OAuth App authorization or Worker secret immediately disables CMS publishing without affecting the public site.

## Cost And Stability

The intended steady-state services are GitHub Pages, GitHub Actions, Sveltia CMS,
and one Cloudflare Worker. Under their current public/free offerings and the
traffic expected from one author, the intended monthly cost is zero, excluding
an optional custom domain. Free-tier terms may change and are not guaranteed by
the application.

Stability comes from reducing irreplaceable state:

- articles live in Git, not in the CMS or Worker;
- the public site is a complete static artifact;
- CMS and Worker versions are pinned;
- OAuth setup is documented and reproducible;
- GitHub's editor remains a fallback;
- dependency updates are deliberate rather than automatic at runtime.

## Testing And Verification

Automated coverage includes:

- the admin route and CMS configuration are present in local and GitHub Pages builds;
- all admin asset and configuration URLs include the configured base path;
- CMS fields match the Astro schema and topic catalog;
- new entries default to draft and drafts are absent from every public output;
- slug format and filename/slug consistency are validated;
- featured entries require `visualAlt`;
- the pinned CMS version is used rather than a floating CDN version;
- no credential values appear in generated files.

Manual verification includes:

- desktop and mobile GitHub OAuth login as `healerlord`;
- rejection of a different GitHub account;
- create draft, reopen on another device, edit, and publish;
- published article appearance in article, topic, search, RSS, and sitemap output;
- mobile layout at 320-430 px without clipped controls or horizontal scrolling;
- recovery from a deliberately invalid article and a simulated save conflict;
- Cloudflare Worker redeployment from documented source and secret names.

## Deployment And Operations

Implementation can prepare all repository files and Worker source, but final
activation requires owner actions in external dashboards:

1. Create or sign in to a free Cloudflare account and deploy the pinned Worker.
2. Register a GitHub OAuth App whose callback is the deployed Worker URL followed by `/callback`.
3. Store the client ID, encrypted client secret, allowed domain, and allowed user in Worker configuration.
4. Put the Worker URL into the CMS production configuration.
5. Push the blog to `healerlord/tech-blog`, enable GitHub Pages Actions, and test `/tech-blog/admin/`.

These dashboard steps are documented with exact values but credentials are
never requested in chat or stored in repository files.

## Acceptance Criteria

- `healerlord` can sign in to the deployed admin from a supported mobile or desktop browser.
- Another GitHub account cannot obtain a usable CMS session.
- The owner can create an article, save it as a draft, reopen it, edit it, and publish it.
- Draft content never appears in public pages, search, RSS, or sitemap output.
- Publishing creates a Git commit and triggers the existing Pages deployment.
- Existing article URLs remain unchanged after the slug migration.
- The public blog stays available when the CMS or Worker is down.
- Local and GitHub Pages production builds pass all schema, route, asset, and credential-leak checks.
- No database or paid service is required for the first version.
