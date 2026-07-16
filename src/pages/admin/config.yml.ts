import type { APIRoute } from "astro";
import { stringify } from "yaml";

import { createCmsConfig } from "../../lib/cms-config";
import { joinBase } from "../../lib/urls";

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error("Astro site URL is required for the CMS configuration");
  }

  const authUrl = process.env.CMS_AUTH_URL?.trim();

  if (process.env.GITHUB_ACTIONS === "true" && !authUrl) {
    throw new Error("CMS_AUTH_URL is required for a GitHub Pages build");
  }

  const siteUrl = new URL(joinBase(import.meta.env.BASE_URL, ""), site).toString();
  const config = createCmsConfig({ siteUrl, authUrl });

  return new Response(stringify(config), {
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
  });
};
