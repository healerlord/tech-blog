import { z } from "astro/zod";

import { topicNames } from "../data/topics";

export const POST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogSchema = z
  .object({
    title: z.string().min(1),
    slug: z.string().regex(POST_SLUG_PATTERN),
    description: z.string().min(1),
    publishedAt: z.coerce.date(),
    tags: z.array(z.enum(topicNames)).min(1),
    featured: z.boolean().default(false),
    draft: z.boolean().default(true),
    visualAlt: z.string().default(""),
  })
  .superRefine((data, context) => {
    if (data.featured && !data.visualAlt.trim()) {
      context.addIssue({
        code: "custom",
        path: ["visualAlt"],
        message: "Featured posts require visualAlt",
      });
    }
  });
