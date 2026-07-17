import { Crepe } from "@milkdown/crepe";

import { topicNames } from "../data/topics";
import type { PostFrontmatter, PostSummary } from "./write-store";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

const API = "/__write/api";
const AUTOSAVE_DELAY = 1600;

// Saving an article rewrites a watched content file; the dev server answers
// with a full-reload broadcast that would wipe the editor state mid-typing.
// The writing surface opts out — refresh manually to pick up code changes.
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeFullReload", () => {
    throw "(write page) skipping dev full reload to keep editor state";
  });
}

const savedTheme = localStorage.getItem("kyrie-theme");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.dataset.theme =
  savedTheme || (systemDark ? "dark" : "light");

interface PostDocumentPayload {
  frontmatter: PostFrontmatter;
  body: string;
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing element #${id}`);
  }
  return node as T;
}

const app = el<HTMLDivElement>("write-app");
const libraryList = el<HTMLUListElement>("library-list");
const libraryFilter = el<HTMLInputElement>("library-filter");
const docCrumb = el<HTMLElement>("doc-crumb");
const saveStatus = el<HTMLElement>("save-status");
const docState = el<HTMLElement>("doc-state");
const docTitle = el<HTMLInputElement>("doc-title");
const metaDate = el<HTMLElement>("meta-date");
const metaTags = el<HTMLElement>("meta-tags");
const editorHost = el<HTMLDivElement>("editor-host");
const sheet = el<HTMLElement>("sheet");
const workspaceEmpty = el<HTMLElement>("workspace-empty");
const settings = el<HTMLElement>("settings");
const settingsErrors = el<HTMLElement>("settings-errors");
const fieldSlug = el<HTMLInputElement>("f-slug");
const fieldDescription = el<HTMLTextAreaElement>("f-description");
const fieldPublished = el<HTMLInputElement>("f-published");
const fieldTags = el<HTMLDivElement>("f-tags");
const fieldFeatured = el<HTMLInputElement>("f-featured");
const fieldDraft = el<HTMLInputElement>("f-draft");
const fieldVisualAlt = el<HTMLTextAreaElement>("f-visual-alt");
const dialog = el<HTMLDialogElement>("new-post-dialog");
const npForm = el<HTMLFormElement>("np-form");
const npTitle = el<HTMLInputElement>("np-title");
const npSlug = el<HTMLInputElement>("np-slug");
const npTags = el<HTMLDivElement>("np-tags");
const npError = el<HTMLElement>("np-error");
const localOnly = el<HTMLElement>("local-only");

let posts: PostSummary[] = [];
let current: { slug: string; frontmatter: PostFrontmatter } | null = null;
let crepe: Crepe | null = null;
let mounting = false;
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let npSlugTouched = false;

function suggestSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setStatus(state: "idle" | "dirty" | "saving" | "saved" | "error") {
  saveStatus.dataset.state = state;
  const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  saveStatus.textContent = {
    idle: "已就绪",
    dirty: "未保存",
    saving: "保存中…",
    saved: `已保存 ${now}`,
    error: "保存失败 · 打开设置查看",
  }[state];
}

function renderState(frontmatter: PostFrontmatter) {
  if (frontmatter.draft) {
    docState.removeAttribute("data-live");
    docState.textContent = "草稿";
  } else {
    docState.setAttribute("data-live", "");
    docState.textContent = "已发布";
  }
}

function renderMetaLine(frontmatter: PostFrontmatter) {
  metaDate.textContent = frontmatter.publishedAt;
  metaTags.innerHTML = "";
  for (const tag of frontmatter.tags) {
    const span = document.createElement("span");
    span.className = "meta-tag";
    span.textContent = tag;
    metaTags.append(span);
  }
}

function renderTagChoices(
  container: HTMLElement,
  selected: string[],
  onToggle: () => void,
) {
  container.innerHTML = "";
  for (const name of topicNames) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-choice";
    button.textContent = name;
    button.setAttribute(
      "aria-pressed",
      selected.includes(name) ? "true" : "false",
    );
    button.addEventListener("click", () => {
      const pressed = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", pressed ? "false" : "true");
      onToggle();
    });
    container.append(button);
  }
}

function selectedTags(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[aria-pressed="true"]'),
  ).map((button) => button.textContent ?? "");
}

function renderSettings(frontmatter: PostFrontmatter) {
  fieldSlug.value = `${frontmatter.slug}.md`;
  fieldDescription.value = frontmatter.description;
  fieldPublished.value = frontmatter.publishedAt;
  fieldFeatured.checked = frontmatter.featured;
  fieldDraft.checked = frontmatter.draft;
  fieldVisualAlt.value = frontmatter.visualAlt;
  settingsErrors.textContent = "";
  renderTagChoices(fieldTags, frontmatter.tags, markDirty);
}

function renderLibrary() {
  const keyword = libraryFilter.value.trim().toLowerCase();
  libraryList.innerHTML = "";
  for (const post of posts) {
    if (
      keyword &&
      !post.title.toLowerCase().includes(keyword) &&
      !post.slug.includes(keyword)
    ) {
      continue;
    }
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "post-entry";
    button.setAttribute(
      "aria-current",
      current?.slug === post.slug ? "true" : "false",
    );

    const title = document.createElement("span");
    title.className = "post-entry-title";
    title.textContent = post.title || post.slug;

    const meta = document.createElement("span");
    meta.className = "post-entry-meta";
    const date = document.createElement("span");
    date.textContent = post.publishedAt;
    const badge = document.createElement("span");
    badge.className = post.draft ? "badge-draft" : "badge-live";
    badge.textContent = post.draft ? "草稿" : "已发布";
    meta.append(date, badge);

    button.append(title, meta);
    button.addEventListener("click", () => {
      void openPost(post.slug);
    });
    item.append(button);
    libraryList.append(item);
  }
}

function collectDocument(): PostDocumentPayload | null {
  if (!current || !crepe) {
    return null;
  }
  return {
    frontmatter: {
      title: docTitle.value.trim(),
      slug: current.slug,
      description: fieldDescription.value.trim(),
      publishedAt: fieldPublished.value,
      tags: selectedTags(fieldTags),
      featured: fieldFeatured.checked,
      draft: fieldDraft.checked,
      visualAlt: fieldVisualAlt.value.trim(),
    },
    body: crepe.getMarkdown(),
  };
}

async function saveNow(): Promise<boolean> {
  const documentPayload = collectDocument();
  if (!documentPayload || !current) {
    return true;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  setStatus("saving");
  try {
    const response = await fetch(`${API}/posts/${current.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(documentPayload),
    });
    if (!response.ok) {
      const data = (await response.json()) as {
        errors?: { field: string; message: string }[];
        error?: string;
      };
      const issues = data.errors ?? [
        { field: "save", message: data.error ?? "未知错误" },
      ];
      settingsErrors.textContent = issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join("；");
      setStatus("error");
      return false;
    }
    dirty = false;
    settingsErrors.textContent = "";
    current.frontmatter = documentPayload.frontmatter;
    renderState(documentPayload.frontmatter);
    renderMetaLine(documentPayload.frontmatter);
    setStatus("saved");
    await refreshList();
    return true;
  } catch {
    setStatus("error");
    settingsErrors.textContent = "save: 无法连接本地写作服务";
    return false;
  }
}

function markDirty() {
  if (mounting) {
    return;
  }
  dirty = true;
  setStatus("dirty");
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void saveNow();
  }, AUTOSAVE_DELAY);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function uploadImage(file: File): Promise<string> {
  const safeName = (file.name || "image.png")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const name = `${Date.now()}-${safeName || "image.png"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const response = await fetch(`${API}/assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, dataBase64: toBase64(bytes) }),
  });
  if (!response.ok) {
    throw new Error("上传失败");
  }
  const data = (await response.json()) as { url: string };
  return data.url;
}

async function mountEditor(markdown: string) {
  mounting = true;
  if (crepe) {
    await crepe.destroy();
    crepe = null;
  }
  editorHost.innerHTML = "";
  const instance = new Crepe({
    root: editorHost,
    defaultValue: markdown,
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: "开始写作，输入 / 唤起插入菜单",
        mode: "block",
      },
      [Crepe.Feature.ImageBlock]: {
        onUpload: uploadImage,
      },
    },
  });
  instance.on((listener) => {
    listener.markdownUpdated(() => {
      markDirty();
    });
  });
  await instance.create();
  crepe = instance;
  mounting = false;
}

async function openPost(slug: string) {
  if (dirty) {
    const saved = await saveNow();
    if (!saved) {
      return;
    }
  }
  const response = await fetch(`${API}/posts/${slug}`);
  if (!response.ok) {
    return;
  }
  const data = (await response.json()) as { post: PostDocumentPayload };
  current = { slug, frontmatter: data.post.frontmatter };
  dirty = false;

  workspaceEmpty.hidden = true;
  sheet.hidden = false;
  docCrumb.textContent = `写作台 / ${slug}.md`;
  docTitle.value = data.post.frontmatter.title;
  renderState(data.post.frontmatter);
  renderMetaLine(data.post.frontmatter);
  renderSettings(data.post.frontmatter);
  renderLibrary();
  setStatus("idle");
  await mountEditor(data.post.body);
}

async function refreshList() {
  const response = await fetch(`${API}/posts`);
  if (!response.ok) {
    throw new Error(`list failed: ${response.status}`);
  }
  const data = (await response.json()) as { posts: PostSummary[] };
  posts = data.posts;
  renderLibrary();
}

function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function createPost(event: SubmitEvent) {
  event.preventDefault();
  const title = npTitle.value.trim();
  const slug = npSlug.value.trim();
  const tags = selectedTags(npTags);
  if (!title) {
    npError.textContent = "请填写标题";
    return;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    npError.textContent = "Slug 只能使用小写英文、数字和单个连字符";
    return;
  }
  if (tags.length === 0) {
    npError.textContent = "请至少选择一个专题";
    return;
  }

  const payload: PostDocumentPayload = {
    frontmatter: {
      title,
      slug,
      description: title,
      publishedAt: todayISO(),
      tags,
      featured: false,
      draft: true,
      visualAlt: "",
    },
    body: "",
  };
  const response = await fetch(`${API}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = (await response.json()) as {
      errors?: { field: string; message: string }[];
      error?: string;
    };
    npError.textContent =
      data.errors?.map((issue) => issue.message).join("；") ??
      data.error ??
      "创建失败";
    return;
  }
  dialog.close();
  await refreshList();
  await openPost(slug);
}

function bindEvents() {
  docTitle.addEventListener("input", markDirty);
  for (const input of [
    fieldDescription,
    fieldPublished,
    fieldFeatured,
    fieldDraft,
    fieldVisualAlt,
  ]) {
    input.addEventListener("input", markDirty);
    input.addEventListener("change", markDirty);
  }
  libraryFilter.addEventListener("input", renderLibrary);

  el<HTMLButtonElement>("toggle-library").addEventListener("click", () => {
    app.classList.toggle("library-hidden");
    app.classList.toggle("library-open-mobile");
  });
  el<HTMLButtonElement>("open-settings").addEventListener("click", () => {
    settings.classList.toggle("open");
  });
  el<HTMLButtonElement>("close-settings").addEventListener("click", () => {
    settings.classList.remove("open");
  });
  el<HTMLButtonElement>("meta-line").addEventListener("click", () => {
    settings.classList.add("open");
  });

  el<HTMLButtonElement>("new-post-button").addEventListener("click", () => {
    npForm.reset();
    npError.textContent = "";
    npSlugTouched = false;
    renderTagChoices(npTags, [], () => {});
    dialog.showModal();
  });
  el<HTMLButtonElement>("np-cancel").addEventListener("click", () => {
    dialog.close();
  });
  npTitle.addEventListener("input", () => {
    if (!npSlugTouched) {
      npSlug.value = suggestSlug(npTitle.value);
    }
  });
  npSlug.addEventListener("input", () => {
    npSlugTouched = true;
  });
  npForm.addEventListener("submit", (event) => {
    void createPost(event);
  });

  window.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveNow();
    }
    if (event.key === "Escape" && settings.classList.contains("open")) {
      settings.classList.remove("open");
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      event.preventDefault();
    }
  });
}

async function start() {
  bindEvents();
  try {
    await refreshList();
  } catch {
    localOnly.classList.add("visible");
    return;
  }
  if (posts.length > 0 && posts[0]) {
    await openPost(posts[0].slug);
  } else {
    workspaceEmpty.hidden = false;
    sheet.hidden = true;
  }
}

void start();
