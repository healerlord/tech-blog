# KYRIE.DEV Technical Blog Homepage Design

Date: 2026-07-15
Status: Approved visual direction

## Purpose

Create a personal technical blog that feels minimal, confident, and current while keeping technical writing as the primary experience. The homepage introduces the author briefly, then moves immediately into featured and recent engineering content.

The visual direction is **Editorial Signal**: an editorial grid, strong black typography, restrained off-white surfaces, and acid green used only for high-value emphasis.

## Audience And Content

- Primary audience: Chinese-speaking software engineers.
- Primary topics: Java, AI engineering, backend systems, architecture, and production practice.
- Brand: `KYRIE.DEV`.
- Primary language: Chinese.
- Voice: direct, technically rigorous, and based on real engineering decisions.

Version one does not include comments, accounts, a newsletter, or a language switch. The language switch shown in the exploratory mockup is intentionally omitted until English content exists, so every visible control remains functional.

## Information Architecture

The global navigation contains:

- Articles: chronological archive with tags and reading time.
- Topics: grouped collections such as Java, AI engineering, architecture, and production.
- Projects: selected open-source and engineering projects.
- About: short biography, current focus, and contact links.
- Search: local full-text search over published content.
- Theme: system-aware light and dark appearance toggle.

The homepage uses this order:

1. Header and global navigation.
2. Brand introduction and one-paragraph author profile.
3. Current-writing status strip.
4. One featured article with a technical visual.
5. Four recent articles in a compact editorial list.
6. Three selected projects in a dark full-width band.
7. Copyright, RSS, and build information.

## Homepage Sections

### Header

The header uses three zones on desktop: `KYRIE / DEV`, centered navigation, and search/theme controls. It becomes a two-zone layout on smaller screens, with navigation moved into a menu opened by a familiar menu icon. The header is separated from the page by a one-pixel ink rule and does not float inside a card.

### Introduction

The first viewport establishes the brand with `KYRIE.DEV`, followed by the statement:

> 记录 Java、AI 工程与系统设计，把复杂系统讲清楚。

The final phrase receives a solid acid-green highlight. A short profile sits beside it on desktop and below it on mobile. The section remains compact enough to reveal the current-writing strip and the start of the featured article.

### Current-Writing Strip

A narrow rule-bounded strip shows the current topic and issue number. The acid-green block labels the state; the rest remains neutral. Long topic text truncates safely on narrow screens.

### Featured Article

The featured article combines editorial copy with a fixed-aspect technical visual. Visuals must communicate actual content, such as an architecture trace, code state, benchmark, or system diagram. Generic stock photography and decorative abstract artwork are not used.

The initial example shows an agent request moving through routing, tool execution, and memory, with latency data. The visual is a meaningful preview of the article rather than a decorative cover.

### Recent Articles

Recent articles appear as horizontal rows with sequence number, title, topic, date, and reading time. Rows use rules rather than cards. On mobile, topic and secondary metadata collapse before the article title loses readable space.

### Projects

Projects appear in a full-width ink band. Each row contains project name, technology summary, and an external-link icon. The section is visually distinct but maintains the same grid and rule system.

### Footer

The footer contains copyright, RSS availability, and a short build note. It remains one line on desktop and stacks on small screens.

## Visual System

### Light Theme

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#F3F3EE` | Primary background |
| Ink | `#12130F` | Primary text and structural rules |
| Muted ink | `#5C5F56` | Supporting copy and metadata |
| Line | `#C7C9C0` | Secondary separators |
| Signal | `#DFFF00` | Current state and key emphasis |
| Blue | `#2848D8` | Technical categories and diagram state |
| Coral | `#FF5B42` | Exceptional diagram state only |

Acid green stays below roughly ten percent of the visible page area. Blue and coral are functional diagram colors, not general decoration.

### Dark Theme

| Token | Value |
| --- | --- |
| Paper | `#10130F` |
| Ink | `#F3F3EE` |
| Muted ink | `#B6BAB0` |
| Line | `#3A3E36` |
| Signal | `#DFFF00` |
| Blue | `#7891FF` |
| Coral | `#FF806B` |

The system preference is the default until the reader explicitly chooses a theme. The explicit choice is persisted locally.

### Typography

- Primary UI and Chinese text: system sans-serif stack with `PingFang SC` and `Microsoft YaHei` fallbacks.
- Metadata, issue numbers, dates, and code labels: system monospace stack.
- Display type uses fixed sizes at responsive breakpoints, not viewport-width scaling.
- Letter spacing remains zero.
- Article reading width is separate from the homepage grid and targets 65-72 Chinese characters per line where practical.

### Geometry

- Maximum homepage content width: 1120 px.
- Desktop horizontal gutter: 32 px minimum.
- Mobile horizontal gutter: 17 px minimum.
- Surface radius: 0-6 px; content sections do not use floating cards.
- Structural rules: 1 px, with rare 2 px emphasis on active text links.
- Fixed-format visuals use explicit aspect ratios to prevent layout shift.

## Responsive Behavior

### Desktop: 821 px And Wider

- Three-zone navigation.
- Introduction uses a wide brand column and a narrow profile column.
- Featured article uses copy and visual columns.
- Article rows expose all metadata.
- Projects use an introduction column and project-list column.

### Tablet: 481-820 px

- Navigation links move into a menu.
- Introduction and featured content stack.
- Architecture flow changes from four columns to two.
- Article topic labels collapse while dates remain.
- Projects stack into one column.

### Mobile: 320-480 px

- Brand plus menu, search, and theme icon controls remain in the header.
- Display heading drops to a fixed mobile size.
- Article rows retain sequence number and title; secondary metadata is hidden.
- Project technology summaries collapse before project names.
- Footer stacks vertically.
- No section introduces horizontal scrolling or overlapping text.

## Components And Responsibilities

- `SiteHeader`: navigation, mobile menu trigger, search trigger, and theme trigger.
- `HeroIntro`: brand statement and author summary.
- `WritingStatus`: current topic and issue number.
- `FeaturedPost`: featured post metadata, excerpt, link, and required technical visual.
- `TechnicalVisual`: bounded architecture, code, trace, or benchmark preview with accessible text.
- `PostList`: deterministic recent-post ordering and compact responsive rows.
- `ProjectList`: selected project data and external links.
- `SiteFooter`: copyright, RSS, and build note.
- `SearchDialog`: keyboard-accessible local search with empty and no-result states.

Each component receives structured content and does not read files directly. Content loading and ordering stay in page-level queries so presentation components remain independently understandable and testable.

## Content And Data Flow

The recommended implementation is a statically generated Astro site:

1. Posts and pages are authored in Markdown or MDX.
2. A content schema validates title, description, publication date, tags, featured state, and required featured visual metadata. Reading time is calculated from the article body during the build.
3. The homepage query selects one featured post, four recent posts, and three selected projects.
4. Build output is entirely static.
5. GitHub Actions builds the site and publishes it to GitHub Pages initially.

Local search is generated from the final static output. RSS, sitemap, canonical URLs, Open Graph metadata, and syntax highlighting are produced during the build. No runtime database or application server is required.

## Interaction States

- Navigation links use underline and color changes without shifting layout.
- Search opens as a keyboard-accessible dialog, supports `Escape`, and reports no-result state clearly.
- Theme control uses a familiar icon and an accessible name.
- External project links identify that they leave the site.
- Technical visuals include a concise accessible description.
- Reduced-motion preferences disable nonessential transitions.
- Empty recent-post or project collections show a simple text state rather than blank space.
- Invalid featured-post data fails the build instead of publishing a broken homepage.

## Accessibility And Quality

- Text and controls meet WCAG AA contrast in both themes.
- All interactive controls are reachable and usable by keyboard.
- Focus styles remain visible.
- Headings follow a logical hierarchy with one homepage `h1`.
- Icons have accessible names and do not replace essential text without tooltips or labels.
- Images and technical visuals have meaningful alternative text.
- Layout is verified at 320, 768, and 1440 px widths.

## Acceptance Criteria

- The first viewport clearly identifies `KYRIE.DEV` and reveals the beginning of technical content.
- The homepage contains no decorative cards, generic hero imagery, or nonfunctional controls.
- Featured content has a meaningful technical visual with stable dimensions.
- All sections reflow without overlap, clipping, or horizontal overflow from 320 px upward.
- Search, theme selection, RSS, canonical metadata, sitemap, and article links work in the static build.
- Missing or invalid required content produces a clear build error.
- The static production build can be deployed by GitHub Actions to GitHub Pages without a server runtime.

## Out Of Scope For Version One

- Comments and user accounts.
- Newsletter subscription backend.
- Content management system.
- Server-side APIs.
- English localization.
- Domestic hosting and ICP setup.
