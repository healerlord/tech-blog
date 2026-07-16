import { topicNames } from "../data/topics";

interface CmsConfigOptions {
  siteUrl: string;
  authUrl?: string;
}

export interface CmsField {
  label: string;
  name: string;
  widget: string;
  options?: string[];
  [key: string]: unknown;
}

interface CmsBackend {
  name: string;
  repo: string;
  branch: string;
  auth_methods: string[];
  base_url?: string;
}

interface CmsCollection {
  name: string;
  label: string;
  label_singular: string;
  folder: string;
  create: boolean;
  delete: boolean;
  extension: string;
  format: string;
  slug: string;
  identifier_field: string;
  summary: string;
  fields: CmsField[];
}

interface CmsConfig {
  app_title: string;
  site_url: string;
  display_url: string;
  backend: CmsBackend;
  collections: CmsCollection[];
}

export function createCmsConfig({
  siteUrl,
  authUrl,
}: CmsConfigOptions): CmsConfig {
  const backend: CmsBackend = {
    name: "github",
    repo: "healerlord/tech-blog",
    branch: "main",
    auth_methods: authUrl ? ["oauth"] : ["token"],
    ...(authUrl ? { base_url: authUrl } : {}),
  };

  return {
    app_title: "KYRIE.DEV 写作后台",
    site_url: siteUrl,
    display_url: siteUrl,
    backend,
    collections: [
      {
        name: "blog",
        label: "文章",
        label_singular: "文章",
        folder: "src/data/blog",
        create: true,
        delete: false,
        extension: "md",
        format: "frontmatter",
        slug: "{{fields.slug}}",
        identifier_field: "slug",
        summary: "{{title}} · {{publishedAt}}",
        fields: [
          { label: "标题", name: "title", widget: "string" },
          {
            label: "URL Slug",
            name: "slug",
            widget: "string",
            pattern: [
              "^[a-z0-9]+(?:-[a-z0-9]+)*$",
              "只能使用小写英文、数字和单个连字符",
            ],
            hint: "发布后不要修改，例如 agent-runtime-boundaries",
          },
          { label: "摘要", name: "description", widget: "text" },
          {
            label: "发布日期",
            name: "publishedAt",
            widget: "datetime",
            type: "date",
            default: "{{now}}",
            format: "YYYY-MM-DD",
          },
          {
            label: "专题",
            name: "tags",
            widget: "select",
            multiple: true,
            min: 1,
            options: [...topicNames],
          },
          {
            label: "首页推荐",
            name: "featured",
            widget: "boolean",
            default: false,
          },
          {
            label: "保存为草稿",
            name: "draft",
            widget: "boolean",
            default: true,
          },
          {
            label: "技术视觉说明",
            name: "visualAlt",
            widget: "text",
            required: false,
            default: "",
            hint: "仅首页推荐文章必填",
          },
          {
            label: "正文",
            name: "body",
            widget: "markdown",
            modes: ["raw", "rich_text"],
            sanitize_preview: true,
          },
        ],
      },
    ],
  };
}
