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
    // Until the OAuth Worker is deployed the admin falls back to GitHub
    // token login; the deploy workflow surfaces a matching warning.
    console.warn(
      "CMS_AUTH_URL is not set; building the admin with token login only.",
    );
  }

  const siteUrl = new URL(joinBase(import.meta.env.BASE_URL, ""), site).toString();
  const config = createCmsConfig({ siteUrl, authUrl });

  return new Response(stringify(config), {
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
  });
};
