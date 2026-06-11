import { defineConfig } from "@wagmi/cli"
import { foundry } from "@wagmi/cli/plugins"

export default defineConfig({
  out: "src/lib/contracts-generated.ts",
  plugins: [
    foundry({
      project: "../contracts",
      artifacts: "out",
      include: [
        "VerityFPMM.json",
        "VerityMarketFactory.json",
        "VerityOptimisticResolver.json",
        "ConditionalTokenVault.json",
      ],
    }),
  ],
})
