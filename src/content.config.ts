import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/blog" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    publishedAt: z.coerce.date(),
    tags: z.array(z.string().min(1)).min(1),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    visualAlt: z.string().min(1),
  }),
});

export const collections = { blog };
