import Image from "next/image";
import { cn } from "@repo/ui/lib/utils";
import type { IntegratedCliAgent } from "@/lib/auth/integrated-cli-agents";

type CliAgentMarkProps = {
  agent: IntegratedCliAgent;
};

export function CliAgentMark({ agent }: CliAgentMarkProps) {
  return (
    <Image
      src={agent.logoSrc}
      alt=""
      aria-hidden="true"
      width={14}
      height={14}
      className={cn(
        "login-card-footer-cli-agent-logo shrink-0",
        agent.wideLogo && "login-card-footer-cli-agent-logo--wide",
      )}
      unoptimized
    />
  );
}
