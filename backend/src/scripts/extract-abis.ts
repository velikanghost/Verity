import * as fs from "fs";
import * as path from "path";

async function run() {
  console.log("=== Extracting Contract ABIs ===");

  const backendDir = path.resolve(__dirname, "../..");
  const contractsDir = path.resolve(backendDir, "../contracts");
  
  const fpmmPath = path.join(contractsDir, "out/VerityFPMM.sol/VerityFPMM.json");
  const factoryPath = path.join(contractsDir, "out/VerityMarketFactory.sol/VerityMarketFactory.json");
  const routerPath = path.join(contractsDir, "out/VerityRouter.sol/VerityRouter.json");
  const targetDir = path.join(backendDir, "src/modules/blockchain/abi");

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let extractedCount = 0;
  let totalToExtract = 3;

  if (fs.existsSync(fpmmPath)) {
    const data = JSON.parse(fs.readFileSync(fpmmPath, "utf8"));
    fs.writeFileSync(
      path.join(targetDir, "VerityFPMM.json"),
      JSON.stringify(data.abi, null, 2)
    );
    console.log("✓ Successfully extracted VerityFPMM ABI.");
    extractedCount++;
  } else {
    console.error(`✗ VerityFPMM.json not found at expected path: ${fpmmPath}`);
  }

  if (fs.existsSync(factoryPath)) {
    const data = JSON.parse(fs.readFileSync(factoryPath, "utf8"));
    fs.writeFileSync(
      path.join(targetDir, "VerityMarketFactory.json"),
      JSON.stringify(data.abi, null, 2)
    );
    console.log("✓ Successfully extracted VerityMarketFactory ABI.");
    extractedCount++;
  } else {
    console.error(`✗ VerityMarketFactory.json not found at expected path: ${factoryPath}`);
  }

  if (fs.existsSync(routerPath)) {
    const data = JSON.parse(fs.readFileSync(routerPath, "utf8"));
    fs.writeFileSync(
      path.join(targetDir, "VerityRouter.json"),
      JSON.stringify(data.abi, null, 2)
    );
    console.log("✓ Successfully extracted VerityRouter ABI.");
    extractedCount++;
  } else {
    console.error(`✗ VerityRouter.json not found at expected path: ${routerPath}`);
  }

  if (extractedCount === totalToExtract) {
    console.log("=== Extraction complete: All ABIs loaded ===");
  } else {
    console.warn(`=== Extraction finished with issues: only ${extractedCount}/${totalToExtract} ABIs found ===`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

