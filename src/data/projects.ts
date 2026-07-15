export interface Project {
  id: string;
  name: string;
  description: string;
  stack: string;
  href: string;
}

export const projects: Project[] = [
  {
    id: "agent-observability-kit",
    name: "Agent Observability Kit",
    description: "把模型、工具和状态变更串成一条可定位问题的运行轨迹。",
    stack: "Java · OpenTelemetry",
    href: "/projects/#agent-observability-kit",
  },
  {
    id: "rag-evaluation-playground",
    name: "RAG Evaluation Playground",
    description: "用可复现实验比较召回策略，而不是凭单次回答判断效果。",
    stack: "Python · Vector DB",
    href: "/projects/#rag-evaluation-playground",
  },
  {
    id: "engineering-notes",
    name: "Engineering Notes",
    description: "记录架构决策、失败假设和能够迁移到下一次项目的经验。",
    stack: "Patterns · Decisions",
    href: "/projects/#engineering-notes",
  },
];
