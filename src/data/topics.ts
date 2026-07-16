export interface TopicDefinition {
  name: string;
  slug: string;
  description: string;
}

export const topicDefinitions: TopicDefinition[] = [
  {
    name: "Java",
    slug: "java",
    description: "JVM、Spring 与服务端工程边界。",
  },
  {
    name: "AI",
    slug: "ai",
    description: "从模型能力走向可交付的 AI 工程。",
  },
  {
    name: "Agent",
    slug: "agent",
    description: "智能体运行时、工具调用与状态管理。",
  },
  {
    name: "Architecture",
    slug: "architecture",
    description: "复杂系统里的职责、约束与演进路径。",
  },
  {
    name: "RAG",
    slug: "rag",
    description: "检索、评估与证据驱动的生成系统。",
  },
  {
    name: "Production",
    slug: "production",
    description: "线上可靠性、故障路径与工程反馈。",
  },
  {
    name: "Observability",
    slug: "observability",
    description: "用日志、指标和追踪解释系统行为。",
  },
  {
    name: "Spring",
    slug: "spring",
    description: "从调用链理解 Spring 的运行机制。",
  },
];

export const topicNames = topicDefinitions.map(({ name }) => name) as [
  string,
  ...string[],
];
