import { Injectable, OnModuleInit, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  defineChain,
  decodeFunctionData,
  decodeEventLog,
  keccak256,
  encodePacked,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import fpmmAbi from "./abi/VerityFPMM.json"
import factoryAbi from "./abi/VerityMarketFactory.json"

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
})

const entryPointAbi = [
  {
    name: "handleOps",
    type: "function",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
  },
] as const

const entryPointV7Abi = [
  {
    name: "handleOps",
    type: "function",
    inputs: [
      {
        name: "ops",
        type: "tuple[]",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "uint256" },
          { name: "paymasterAndData", type: "uint256" },
          { name: "signature", type: "uint256" },
          { name: "paymasterAndDataBytes", type: "bytes" },
          { name: "signatureBytes", type: "bytes" },
        ],
      },
      { name: "beneficiary", type: "address" },
    ],
  },
] as const

const smartAccountExecuteAbi = [
  {
    name: "execute",
    type: "function",
    inputs: [
      { name: "dest", type: "address" },
      { name: "value", type: "uint256" },
      { name: "func", type: "bytes" },
    ],
  },
  {
    name: "executeBatch",
    type: "function",
    inputs: [
      { name: "dest", type: "address[]" },
      { name: "func", type: "bytes[]" },
    ],
  },
  {
    name: "executeBatch",
    type: "function",
    inputs: [
      { name: "dest", type: "address[]" },
      { name: "value", type: "uint256[]" },
      { name: "func", type: "bytes[]" },
    ],
  },
  {
    name: "executeBatch",
    type: "function",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
] as const

const safeExecTransactionAbi = [
  {
    name: "execTransaction",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "signatures", type: "bytes" },
    ],
  },
] as const

function getCallSequence(
  to: string,
  data: string,
): { to: string; data: string }[] {
  const calls: { to: string; data: string }[] = [{ to: to.toLowerCase(), data }]

  if (!data || data === "0x") return calls

  // 1. Try to decode as EntryPoint handleOps
  if (data.startsWith("0x1faf9611") || data.startsWith("0x43d7266e")) {
    try {
      const { args } = decodeFunctionData({
        abi: entryPointAbi,
        data: data as `0x${string}`,
      })
      if (args && args[0]) {
        const ops = args[0] as any[]
        for (const op of ops) {
          const nestedCalls = getCallSequence(op.sender, op.callData)
          calls.push(...nestedCalls)
        }
      }
    } catch (e) {
      // Ignore decode failure
    }
  } else if (data.startsWith("0x1fad948c")) {
    try {
      const { args } = decodeFunctionData({
        abi: entryPointV7Abi,
        data: data as `0x${string}`,
      })
      if (args && args[0]) {
        const ops = args[0] as any[]
        for (const op of ops) {
          const nestedCalls = getCallSequence(op.sender, op.callData)
          calls.push(...nestedCalls)
        }
      }
    } catch (e) {
      // Ignore decode failure
    }
  }

  // 2. Try to decode as smart account execute/executeBatch
  try {
    const decodedSmartAccount = decodeFunctionData({
      abi: smartAccountExecuteAbi,
      data: data as `0x${string}`,
    })
    if (
      decodedSmartAccount.functionName === "execute" &&
      decodedSmartAccount.args
    ) {
      const [dest, , func] = decodedSmartAccount.args as [
        string,
        bigint,
        string,
      ]
      const nestedCalls = getCallSequence(dest, func)
      calls.push(...nestedCalls)
    } else if (
      decodedSmartAccount.functionName === "executeBatch" &&
      decodedSmartAccount.args
    ) {
      const firstArg = decodedSmartAccount.args[0] as any
      if (
        Array.isArray(firstArg) &&
        firstArg.length > 0 &&
        typeof firstArg[0] === "object"
      ) {
        // Handle ERC-4337 tuple[] format: executeBatch((address,uint256,bytes)[])
        for (const callObj of firstArg) {
          let dest: string | undefined
          let func: string | undefined

          if (Array.isArray(callObj)) {
            dest = callObj[0]
            func = callObj[2]
          } else if (callObj) {
            dest = callObj.target || callObj.dest || callObj.to
            func = callObj.data || callObj.func || callObj.callData
          }

          if (dest && func) {
            const nestedCalls = getCallSequence(dest, func)
            calls.push(...nestedCalls)
          }
        }
      } else {
        // Fallback to legacy address[] + bytes[] executeBatch formats
        const args = decodedSmartAccount.args as any[]
        const dests = args[0] as string[]
        const funcs = args.find(
          (arg) =>
            Array.isArray(arg) &&
            arg.length > 0 &&
            typeof arg[0] === "string" &&
            arg[0].startsWith("0x"),
        ) as string[]
        if (funcs && dests) {
          for (let i = 0; i < dests.length; i++) {
            const nestedCalls = getCallSequence(dests[i], funcs[i])
            calls.push(...nestedCalls)
          }
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // 3. Try to decode as Safe execTransaction
  if (data.startsWith("0x6a761202")) {
    try {
      const { args } = decodeFunctionData({
        abi: safeExecTransactionAbi,
        data: data as `0x${string}`,
      })
      if (args) {
        const [toArg, , dataArg] = args as [string, bigint, string]
        const nestedCalls = getCallSequence(toArg, dataArg)
        calls.push(...nestedCalls)
      }
    } catch (e) {
      // Ignore
    }
  }

  return calls
}

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name)
  private publicClient: PublicClient
  private walletClient: any
  private account: any
  private fpmmAbi = fpmmAbi
  private factoryAbi = factoryAbi
  private usdcAbi: any

  private fpmmAddress: `0x${string}`
  private factoryAddress: `0x${string}`
  private usdcAddress: `0x${string}`
  private pythAddress: `0x${string}`
  private resolverAddress: `0x${string}`

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const rpcUrl =
      this.configService.get<string>("ARC_RPC_URL") ||
      "https://rpc.testnet.arc.network"
    this.fpmmAddress = this.configService.get<string>(
      "FPMM_ADDRESS",
    ) as `0x${string}`
    this.factoryAddress = this.configService.get<string>(
      "FACTORY_ADDRESS",
    ) as `0x${string}`
    this.usdcAddress = this.configService.get<string>(
      "USDC_ADDRESS",
    ) as `0x${string}`
    this.pythAddress = (this.configService.get<string>("PYTH_ADDRESS") ||
      "") as `0x${string}`
    this.resolverAddress = (this.configService.get<string>(
      "RESOLVER_ADDRESS",
    ) || "") as `0x${string}`

    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl, { batch: true }),
    }) as PublicClient

    const rawPrivateKey =
      this.configService.get<string>("ADMIN_PRIVATE_KEY") ||
      this.configService.get<string>("KEEPER_PRIVATE_KEY")
    if (rawPrivateKey) {
      const privateKey = (
        rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`
      ) as `0x${string}`
      this.account = privateKeyToAccount(privateKey)
      this.walletClient = createWalletClient({
        account: this.account,
        chain: arcTestnet,
        transport: http(rpcUrl),
      })
    }

    this.loadAbis()
  }

  private loadAbis() {
    // Standard ERC20 minimal ABI for USDC
    this.usdcAbi = [
      {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
      {
        type: "function",
        name: "allowance",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
    ]
  }

  private formatMarketId(marketId: string): `0x${string}` {
    const clean = marketId.replace(/^0x/, "")
    return `0x${clean.padEnd(64, "0")}` as `0x${string}`
  }

  private formatAddress(address: string): `0x${string}` {
    const clean = address.trim().toLowerCase()
    return (clean.startsWith("0x") ? clean : `0x${clean}`) as `0x${string}`
  }

  private async safeWriteContract(params: any, retries = 2): Promise<string> {
    let lastError: any
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const nonce = await this.publicClient.getTransactionCount({
          address: this.account.address,
          blockTag: "pending",
        })

        const txParams: any = {
          ...params,
          nonce,
        }

        // On retry attempts, fetch current gas price and bump it by 20%
        if (attempt > 0) {
          const gasPrice = await this.publicClient.getGasPrice()
          txParams.gasPrice = (gasPrice * BigInt(120)) / BigInt(100)
          this.logger.log(
            `Retrying transaction with bumped gas price: ${txParams.gasPrice.toString()}`,
          )
        }

        const txHash = await this.walletClient.writeContract(txParams)
        const receipt = await this.publicClient.waitForTransactionReceipt({
          hash: txHash,
        })
        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted on-chain")
        }
        return txHash
      } catch (error: any) {
        lastError = error
        const msg = error?.message || ""
        this.logger.warn(`Transaction attempt ${attempt} failed: ${msg}`)

        if (
          msg.includes("replacement transaction underpriced") ||
          msg.includes("nonce too low") ||
          msg.includes("underpriced")
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }

        throw error
      }
    }
    throw lastError
  }

  async readPoolBalances(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "getPoolBalances",
        args: [formattedMarketId],
      })
      const [
        yesBalance,
        noBalance,
        totalLPShares,
        totalDeposited,
        active,
        resolved,
      ] = result as [bigint, bigint, bigint, bigint, boolean, boolean]
      return {
        yesBalance,
        noBalance,
        totalLPShares,
        totalDeposited,
        active,
        resolved,
      }
    } catch (error) {
      throw new Error(
        `Failed to read pool balances for market ${marketId}: ${error.message}`,
      )
    }
  }

  async readOutcomeBalances(marketId: string): Promise<bigint[]> {
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "getOutcomeBalances",
        args: [formattedMarketId],
      })
      return result as bigint[]
    } catch (error) {
      throw new Error(
        `Failed to read outcome balances for market ${marketId}: ${error.message}`,
      )
    }
  }

  async readLPShares(marketId: string, userAddress: string) {
    const formattedMarketId = this.formatMarketId(marketId)
    const formattedUserAddress = this.formatAddress(userAddress)
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "lpShares",
        args: [formattedMarketId, formattedUserAddress],
      })
      return result as bigint
    } catch (error) {
      throw new Error(
        `Failed to read LP shares for market ${marketId}, user ${userAddress}: ${error.message}`,
      )
    }
  }

  async readLPSharesBatch(
    marketId: string,
    userAddresses: string[],
  ): Promise<bigint[]> {
    if (userAddresses.length === 0) return []
    const formattedMarketId = this.formatMarketId(marketId)

    try {
      const promises = userAddresses.map(async (addr) => {
        try {
          const res = await this.publicClient.readContract({
            address: this.fpmmAddress as `0x${string}`,
            abi: this.fpmmAbi as any,
            functionName: "lpShares",
            args: [formattedMarketId, this.formatAddress(addr)],
          })
          return res as bigint
        } catch (err) {
          return 0n
        }
      })
      return await Promise.all(promises)
    } catch (error) {
      this.logger.error(
        `Failed to batch read LP shares for market ${marketId}: ${error.message}`,
      )
      throw error
    }
  }

  async getMarketPrices(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const yesPriceResult = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "getYesPrice",
        args: [formattedMarketId],
      })

      const noPriceResult = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "getNoPrice",
        args: [formattedMarketId],
      })

      // Price is returned scaled by 1e18 on-chain. Convert to standard decimal representation (0 to 1)
      const yesPrice = Number(yesPriceResult as bigint) / 1e18
      const noPrice = Number(noPriceResult as bigint) / 1e18

      return { yesPrice, noPrice }
    } catch (error) {
      // If pool is not active or getYesPrice reverts, return 0.5/0.5 default price
      return { yesPrice: 0.5, noPrice: 0.5 }
    }
  }

  async verifyCreateMarketPreDeposit(
    txHash: string,
    marketId: string,
  ): Promise<bigint | null> {
    try {
      const hash = (
        txHash.startsWith("0x") ? txHash : `0x${txHash}`
      ) as `0x${string}`
      let receipt: any = null
      let tx: any = null

      for (let attempt = 1; attempt <= 25; attempt++) {
        try {
          receipt = await this.publicClient.getTransactionReceipt({ hash })
          tx = await this.publicClient.getTransaction({ hash })
          break
        } catch (e) {
          if (attempt === 25) {
            throw e
          }
          this.logger.warn(
            `RPC node replication lag for verifyCreateMarketPreDeposit tx ${txHash}. Retrying in 1s... (Attempt ${attempt}/25)`,
          )
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      if (receipt.status !== "success") return null

      const calls = getCallSequence(receipt.to || tx.to || "", tx.input)
      for (const call of calls) {
        const callTo = call.to.toLowerCase()
        const isFactory = callTo === this.factoryAddress.toLowerCase()
        if (!isFactory) continue

        let txMarketId: string
        let txAmount: bigint

        try {
          const { functionName, args } = decodeFunctionData({
            abi: this.factoryAbi,
            data: call.data as `0x${string}`,
          })

          if (functionName !== "createMarketPreDeposit") continue
          const [marketIdArg, txAmountArg] = args as [string, bigint]
          txMarketId = marketIdArg
          txAmount = txAmountArg
        } catch (e) {
          continue
        }

        const formattedInputMarketId = this.formatMarketId(marketId)
        if (txMarketId.toLowerCase() === formattedInputMarketId.toLowerCase()) {
          return txAmount
        }
      }

      // Fallback: search for event logs from the factory contract
      const formattedInputMarketId = this.formatMarketId(marketId)
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === this.factoryAddress.toLowerCase()) {
          try {
            const decodedLog = decodeEventLog({
              abi: this.factoryAbi,
              data: log.data,
              topics: log.topics,
            })
            if (decodedLog.eventName === "MarketPreDepositCreated") {
              const { marketId: logMarketId, amount } = decodedLog.args as any
              if (
                logMarketId.toLowerCase() ===
                formattedInputMarketId.toLowerCase()
              ) {
                return amount
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      return null
    } catch (error) {
      this.logger.warn(
        `verifyCreateMarketPreDeposit failed for tx ${txHash}, market ${marketId}: ${error.message}`,
      )
      return null
    }
  }

  async verifyDepositPreMarketLiquidity(
    txHash: string,
    marketId: string,
  ): Promise<bigint | null> {
    try {
      const hash = (
        txHash.startsWith("0x") ? txHash : `0x${txHash}`
      ) as `0x${string}`
      let receipt: any = null
      let tx: any = null

      for (let attempt = 1; attempt <= 25; attempt++) {
        try {
          receipt = await this.publicClient.getTransactionReceipt({ hash })
          tx = await this.publicClient.getTransaction({ hash })
          break
        } catch (e) {
          if (attempt === 25) {
            throw e
          }
          this.logger.warn(
            `RPC node replication lag for verifyDepositPreMarketLiquidity tx ${txHash}. Retrying in 1s... (Attempt ${attempt}/25)`,
          )
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      if (receipt.status !== "success") return null

      const calls = getCallSequence(receipt.to || tx.to || "", tx.input)
      for (const call of calls) {
        const callTo = call.to.toLowerCase()
        const isFactory = callTo === this.factoryAddress.toLowerCase()
        if (!isFactory) continue

        let txMarketId: string
        let txAmount: bigint

        try {
          const { functionName, args } = decodeFunctionData({
            abi: this.factoryAbi,
            data: call.data as `0x${string}`,
          })

          if (functionName !== "depositPreMarketLiquidity") continue
          const [marketIdArg, txAmountArg] = args as [string, bigint]
          txMarketId = marketIdArg
          txAmount = txAmountArg
        } catch (e) {
          continue
        }

        const formattedInputMarketId = this.formatMarketId(marketId)
        if (txMarketId.toLowerCase() === formattedInputMarketId.toLowerCase()) {
          return txAmount
        }
      }

      return null
    } catch (error) {
      this.logger.warn(
        `verifyDepositPreMarketLiquidity failed for tx ${txHash}, market ${marketId}: ${error.message}`,
      )
      return null
    }
  }

  async getTransactionReceipt(txHash: `0x${string}`) {
    let receipt: any = null
    for (let attempt = 1; attempt <= 25; attempt++) {
      try {
        receipt = await this.publicClient.getTransactionReceipt({
          hash: txHash,
        })
        break
      } catch (error) {
        if (attempt === 25) {
          this.logger.error(
            `Transaction verification failed for hash ${txHash}: ${error.message}`,
            error.stack,
          )
          throw new Error(
            `Transaction verification failed for hash ${txHash}: ${error.message}`,
          )
        }
        this.logger.warn(
          `RPC node replication lag for getTransactionReceipt tx ${txHash}. Retrying in 1s... (Attempt ${attempt}/25)`,
        )
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
    if (receipt && receipt.status === "reverted") {
      throw new Error(`Transaction reverted on-chain: ${txHash}`)
    }
    return receipt
  }

  async readEscrowBalance(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const result = await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "escrowBalances",
        args: [formattedMarketId],
      })
      return result as bigint
    } catch (error) {
      throw new Error(
        `Failed to read escrow balance for market ${marketId}: ${error.message}`,
      )
    }
  }

  async canRemoveLiquidity(
    marketId: string,
    walletAddress: string,
  ): Promise<boolean> {
    const formattedMarketId = this.formatMarketId(marketId)
    const formattedWalletAddress = this.formatAddress(walletAddress)
    try {
      // 1. Fetch pool details from contract to verify if it is active / creator is set
      const poolResult = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "pools",
        args: [formattedMarketId],
      })
      const pool = poolResult as any[]
      const creatorAddress = pool[4] as string
      const active = pool[8] as boolean

      if (
        !active ||
        creatorAddress === "0x0000000000000000000000000000000000000000"
      ) {
        return false
      }

      // 2. Fetch deposit time to verify if user has actually deposited/claimed
      const depositTime = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "lpDepositTime",
        args: [formattedMarketId, formattedWalletAddress],
      })

      // If user has not deposited on-chain, they cannot remove liquidity
      if (depositTime === 0n) {
        return false
      }

      // 3. Call canRemoveLiquidity as final check
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "canRemoveLiquidity",
        args: [formattedMarketId, formattedWalletAddress],
      })
      return result as boolean
    } catch (error) {
      this.logger.warn(
        `canRemoveLiquidity check failed for market ${marketId}, wallet ${walletAddress}: ${error.message}`,
      )
      return false
    }
  }

  async resolveMarketWithPyth(
    marketId: string,
    priceUpdate: string[],
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error(
        "Wallet client not initialized (missing ADMIN_PRIVATE_KEY or KEEPER_PRIVATE_KEY)",
      )
    }

    const formattedMarketId = this.formatMarketId(marketId)
    const formattedPriceUpdate = priceUpdate.map(
      (x) => (x.startsWith("0x") ? x : `0x${x}`) as `0x${string}`,
    )

    // Get the required update fee from Pyth contract if we have pythAddress
    let fee = BigInt(0)
    try {
      if (this.pythAddress) {
        fee = (await this.publicClient.readContract({
          address: this.pythAddress,
          abi: [
            {
              type: "function",
              name: "getUpdateFee",
              inputs: [{ name: "updateData", type: "bytes[]" }],
              outputs: [{ name: "fee", type: "uint256" }],
              stateMutability: "view",
            },
          ],
          functionName: "getUpdateFee",
          args: [formattedPriceUpdate],
        })) as bigint
      }
    } catch (error) {
      // Fallback: send 1 wei or 0.01 ether
      fee = BigInt(10000000000000000n) // 0.01 ARC
    }

    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "resolveMarketWithPyth",
        args: [formattedMarketId, formattedPriceUpdate],
        value: fee,
        chain: arcTestnet,
      })

      return txHash
    } catch (error) {
      throw new Error(
        `Failed to resolve market ${marketId} with Pyth: ${error.message}`,
      )
    }
  }

  async registerMarket(
    marketId: string,
    creator: string,
    deadline: number,
    fundingDeadline: number,
    outcomeCount: number = 2,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error(
        "Wallet client not initialized (missing ADMIN_PRIVATE_KEY or KEEPER_PRIVATE_KEY)",
      )
    }

    const formattedMarketId = this.formatMarketId(marketId)

    try {
      return await this.safeWriteContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "registerMarket",
        args: [
          formattedMarketId,
          creator as `0x${string}`,
          BigInt(deadline),
          BigInt(fundingDeadline),
          BigInt(outcomeCount),
        ],
        chain: arcTestnet,
      })
    } catch (error) {
      throw new Error(`Failed to register market ${marketId}: ${error.message}`)
    }
  }

  async adminCreateMarketPreDeposit(
    marketId: string,
    amountUsdc: number,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const rawAmount = BigInt(Math.round(amountUsdc * 1e6))
    const totalRequired = rawAmount + BigInt(1e6)
    await this.approveUsdcIfNecessary(this.factoryAddress, totalRequired)

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      return await this.safeWriteContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "createMarketPreDeposit",
        args: [formattedMarketId, rawAmount],
        chain: arcTestnet,
      })
    } catch (error) {
      throw new Error(
        `Failed to create market pre-deposit for ${marketId}: ${error.message}`,
      )
    }
  }

  async adminDepositPreMarketLiquidity(
    marketId: string,
    amountUsdc: number,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const rawAmount = BigInt(Math.round(amountUsdc * 1e6))
    await this.approveUsdcIfNecessary(this.factoryAddress, rawAmount)

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "depositPreMarketLiquidity",
        args: [formattedMarketId, rawAmount],
        chain: arcTestnet,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      if (receipt.status === "reverted") {
        throw new Error(
          "Transaction reverted on-chain: depositPreMarketLiquidity",
        )
      }
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to deposit pre-market liquidity for ${marketId}: ${error.message}`,
      )
    }
  }

  async adminAddActiveLiquidity(
    marketId: string,
    amountUsdc: number,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const rawAmount = BigInt(Math.round(amountUsdc * 1e6))
    await this.approveUsdcIfNecessary(this.fpmmAddress, rawAmount)

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "addLiquidity",
        args: [formattedMarketId, rawAmount],
        chain: arcTestnet,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain: addLiquidity")
      }
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to add active pool liquidity for ${marketId}: ${error.message}`,
      )
    }
  }

  async resolveMarket(
    marketId: string,
    winningIsYes: boolean,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "resolveMarket",
        args: [formattedMarketId, winningIsYes],
        chain: arcTestnet,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain: resolveMarket")
      }
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to resolve market ${marketId} on-chain: ${error.message}`,
      )
    }
  }

  async resolveMarketOutcome(
    marketId: string,
    winningOutcomeIndex: number,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "resolveMarketOutcome",
        args: [formattedMarketId, BigInt(winningOutcomeIndex)],
        chain: arcTestnet,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain: resolveMarketOutcome")
      }
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to resolve market outcome ${marketId} on-chain: ${error.message}`,
      )
    }
  }

  async voidMarket(marketId: string): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "voidMarket",
        args: [formattedMarketId],
        chain: arcTestnet,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain: voidMarket")
      }
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to void market ${marketId} on-chain: ${error.message}`,
      )
    }
  }

  getAdminAddress(): string {
    return this.account?.address || ""
  }

  async adminClaimCreatorLiquidity(marketId: string): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "claimCreatorLiquidity",
        args: [formattedMarketId],
        chain: arcTestnet,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain: claimCreatorLiquidity")
      }
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to claim creator liquidity for market ${marketId}: ${error.message}`,
      )
    }
  }

  async getPreMarketDeposit(
    marketId: string,
    accountAddress: string,
  ): Promise<bigint> {
    const formattedMarketId = this.formatMarketId(marketId)
    const formattedAddress = this.formatAddress(accountAddress)
    try {
      const result = await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "preMarketDeposits",
        args: [formattedMarketId, formattedAddress],
      })
      return result as bigint
    } catch (error) {
      this.logger.error(
        `Failed to read preMarketDeposits for market ${marketId}: ${error.message}`,
      )
      return 0n
    }
  }

  async claimPreMarketLpShares(marketId: string): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "claimPreMarketLpShares",
        args: [formattedMarketId],
        chain: arcTestnet,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain: claimPreMarketLpShares")
      }
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to claim pre-market LP shares for market ${marketId}: ${error.message}`,
      )
    }
  }

  async getFpmmUsdcBalance(): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: this.usdcAddress,
        abi: this.usdcAbi,
        functionName: "balanceOf",
        args: [this.fpmmAddress],
      })
      return Number(result as bigint) / 1e6
    } catch (error) {
      this.logger.error(`Failed to read FPMM USDC balance: ${error.message}`)
      return 0
    }
  }

  async getFactoryUsdcBalance(): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: this.usdcAddress,
        abi: this.usdcAbi,
        functionName: "balanceOf",
        args: [this.factoryAddress],
      })
      return Number(result as bigint) / 1e6
    } catch (error) {
      this.logger.error(`Failed to read Factory USDC balance: ${error.message}`)
      return 0
    }
  }

  async getMinPoolBalance(): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "minPoolBalance",
      })
      return Number(result as bigint) / 1e6
    } catch (error) {
      this.logger.error(
        `Failed to read minPoolBalance from contract: ${error.message}`,
      )
      return 20 // Default fallback matching deployment limit
    }
  }

  async getCreatorMinLock(): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "creatorMinLock",
      })
      return Number(result as bigint) / 1e6
    } catch (error) {
      this.logger.error(
        `Failed to read creatorMinLock from contract: ${error.message}`,
      )
      return 5 // Default fallback matching deployment limit
    }
  }

  async getMarketCreationFee(): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "marketCreationFee",
      })
      return Number(result as bigint) / 1e6
    } catch (error) {
      this.logger.error(
        `Failed to read marketCreationFee from contract: ${error.message}`,
      )
      return 1 // Default fallback matching deployment limit
    }
  }

  async getPoolState(marketId: string): Promise<{
    creatorShares: bigint
    totalLpShares: bigint
    creatorAddress: string
    active: boolean
    resolved: boolean
    adminLpShares: bigint
  }> {
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const poolResult = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "pools",
        args: [formattedMarketId],
      })

      // pools returns: (yesBalance, noBalance, totalLpShares, creatorShares, creator, collectedFeesLp, collectedFeesTreasury, totalDeposited, active, resolved)
      const pool = poolResult as any[]
      const creatorAddress = pool[4] as string
      const creatorShares = pool[3] as bigint
      const totalLpShares = pool[2] as bigint
      const active = pool[8] as boolean
      const resolved = pool[9] as boolean

      // Also read admin's lpShares for this market
      let adminLpShares = 0n
      if (this.account?.address) {
        const lpResult = await this.publicClient.readContract({
          address: this.fpmmAddress,
          abi: this.fpmmAbi,
          functionName: "lpShares",
          args: [formattedMarketId, this.account.address],
        })
        adminLpShares = lpResult as bigint
      }

      return {
        creatorShares,
        totalLpShares,
        creatorAddress,
        active,
        resolved,
        adminLpShares,
      }
    } catch (error) {
      throw new Error(
        `Failed to read pool state for market ${marketId}: ${error.message}`,
      )
    }
  }

  async getAdminBalances() {
    if (!this.account) {
      return {
        address: "",
        arcBalance: 0,
        usdcBalance: 0,
      }
    }
    const address = this.account.address
    try {
      const arcBalBig = await this.publicClient.getBalance({ address })
      const usdcBalBig = (await this.publicClient.readContract({
        address: this.usdcAddress,
        abi: this.usdcAbi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint

      return {
        address,
        arcBalance: Number(arcBalBig) / 1e18,
        usdcBalance: Number(usdcBalBig) / 1e6,
      }
    } catch (error) {
      this.logger.error(`Failed to fetch admin balances: ${error.message}`)
      return {
        address,
        arcBalance: 0,
        usdcBalance: 0,
      }
    }
  }

  async registerPythMarket(
    marketId: string,
    creator: string,
    deadline: number,
    fundingDeadline: number,
    priceFeedId: string,
    targetPrice: number,
    resolveAbove: boolean,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }

    const formattedMarketId = this.formatMarketId(marketId)
    const formattedPriceFeedId = (
      priceFeedId.startsWith("0x") ? priceFeedId : `0x${priceFeedId}`
    ) as `0x${string}`

    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "registerPythMarket",
        args: [
          formattedMarketId,
          creator as `0x${string}`,
          BigInt(deadline),
          BigInt(fundingDeadline),
          formattedPriceFeedId,
          BigInt(targetPrice),
          resolveAbove,
        ],
        chain: arcTestnet,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      })
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain: registerPythMarket")
      }
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to register Pyth market ${marketId}: ${error.message}`,
      )
    }
  }

  async readOnChainMarketState(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const result = await this.publicClient.readContract({
        address: this.configService.get<string>(
          "CONDITIONAL_TOKEN_VAULT_ADDRESS",
        ) as `0x${string}`,
        abi: [
          {
            type: "function",
            name: "markets",
            inputs: [{ name: "", type: "bytes32" }],
            outputs: [
              { name: "resolved", type: "bool" },
              { name: "winningOutcomeIndex", type: "uint256" },
              { name: "totalCollateral", type: "uint256" },
              { name: "outcomeCount", type: "uint256" },
            ],
            stateMutability: "view",
          },
        ],
        functionName: "markets",
        args: [formattedMarketId],
      })
      const [resolved, winningOutcomeIndex, totalCollateral, outcomeCount] =
        result as [boolean, bigint, bigint, bigint]
      return {
        resolved,
        winningOutcomeIndex: Number(winningOutcomeIndex),
        totalCollateral,
        outcomeCount: Number(outcomeCount),
      }
    } catch (error) {
      throw new Error(
        `Failed to read on-chain market state for ${marketId}: ${error.message}`,
      )
    }
  }

  async readOnChainMarketVoided(marketId: string): Promise<boolean> {
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const result = await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "marketRegistry",
        args: [formattedMarketId],
      })
      // Result returns [creator, deadline, fundingDeadline, registered, funded, resolved, voided, outcomeCount]
      return Boolean(result && result[6])
    } catch (error) {
      throw new Error(
        `Failed to read on-chain market registry for ${marketId}: ${error.message}`,
      )
    }
  }

  async getUserOnChainBalances(
    marketId: string,
    userAddress: string,
    outcomes: string[] = ["YES", "NO"],
  ): Promise<Record<string, number>> {
    const formattedMarketId = this.formatMarketId(marketId)
    const vaultAddress = this.configService.get<string>(
      "CONDITIONAL_TOKEN_VAULT_ADDRESS",
    ) as `0x${string}`
    try {
      const balances: Record<string, number> = {}

      const balancePromises = outcomes.map(async (outcome, idx) => {
        const tokenId = BigInt(
          keccak256(
            encodePacked(
              ["bytes32", "uint256"],
              [formattedMarketId, BigInt(idx)],
            ),
          ),
        )

        const balance = await this.publicClient.readContract({
          address: vaultAddress,
          abi: [
            {
              type: "function",
              name: "balanceOf",
              inputs: [
                { name: "account", type: "address" },
                { name: "id", type: "uint256" },
              ],
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
            },
          ],
          functionName: "balanceOf",
          args: [this.formatAddress(userAddress), tokenId],
        })

        balances[outcome] = Number(balance) / 1e6
      })

      await Promise.all(balancePromises)
      return balances
    } catch (error) {
      const fallback: Record<string, number> = {}
      for (const outcome of outcomes) {
        fallback[outcome] = 0
      }
      return fallback
    }
  }

  async getUserOnChainBalancesBatch(
    queries: { marketId: string; outcomes: string[] }[],
    userAddress: string,
  ): Promise<Record<string, Record<string, number>>> {
    if (queries.length === 0) return {}

    const vaultAddress = this.configService.get<string>(
      "CONDITIONAL_TOKEN_VAULT_ADDRESS",
    ) as `0x${string}`

    const calls: any[] = []
    const mapping: { marketId: string; outcome: string; callIndex: number }[] =
      []

    let callIndex = 0
    for (const query of queries) {
      const formattedMarketId = this.formatMarketId(query.marketId)
      query.outcomes.forEach((outcome, idx) => {
        const tokenId = BigInt(
          keccak256(
            encodePacked(
              ["bytes32", "uint256"],
              [formattedMarketId, BigInt(idx)],
            ),
          ),
        )

        calls.push({
          address: vaultAddress,
          abi: [
            {
              type: "function",
              name: "balanceOf",
              inputs: [
                { name: "account", type: "address" },
                { name: "id", type: "uint256" },
              ],
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
            },
          ],
          functionName: "balanceOf",
          args: [this.formatAddress(userAddress), tokenId],
        })

        mapping.push({
          marketId: query.marketId,
          outcome,
          callIndex,
        })
        callIndex++
      })
    }

    const resultsMap: Record<string, Record<string, number>> = {}
    for (const query of queries) {
      resultsMap[query.marketId] = {}
      for (const outcome of query.outcomes) {
        resultsMap[query.marketId][outcome] = 0
      }
    }

    try {
      const response = await this.publicClient.multicall({
        contracts: calls,
      })

      mapping.forEach((map) => {
        const resp = response[map.callIndex]
        if (resp && resp.status === "success") {
          resultsMap[map.marketId][map.outcome] =
            Number(resp.result as bigint) / 1e6
        }
      })
    } catch (error) {
      this.logger.error(
        `Failed to batch read user balances via multicall: ${error.message}`,
      )
    }

    return resultsMap
  }

  async approveUsdcIfNecessary(
    spender: string,
    amount: bigint,
  ): Promise<string | null> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }
    const allowance = (await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: this.usdcAbi,
      functionName: "allowance",
      args: [this.account.address, spender as `0x${string}`],
    })) as bigint

    if (allowance >= amount) {
      return null
    }

    // Approve max uint256 to avoid future race conditions/approvals
    const maxUint256 = BigInt(
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
    )
    return this.safeWriteContract({
      address: this.usdcAddress,
      abi: [
        {
          type: "function",
          name: "approve",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "approve",
      args: [spender as `0x${string}`, maxUint256],
      chain: arcTestnet,
    })
  }

  async getResolutionBond(): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.resolverAddress,
        abi: [
          {
            type: "function",
            name: "resolutionBond",
            inputs: [],
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
          },
        ],
        functionName: "resolutionBond",
        args: [],
      })
      return result as bigint
    } catch (error) {
      // Fallback: 10 USDC (assuming 6 decimals)
      return 10_000_000n
    }
  }

  async readProposal(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const result = await this.publicClient.readContract({
        address: this.resolverAddress,
        abi: [
          {
            type: "function",
            name: "proposals",
            inputs: [{ name: "", type: "bytes32" }],
            outputs: [
              { name: "proposer", type: "address" },
              { name: "proposedOutcomeIndex", type: "uint256" },
              { name: "proposalTime", type: "uint256" },
              { name: "disputed", type: "bool" },
              { name: "disputer", type: "address" },
              { name: "finalized", type: "bool" },
            ],
            stateMutability: "view",
          },
        ],
        functionName: "proposals",
        args: [formattedMarketId],
      })
      const [
        proposer,
        proposedOutcomeIndex,
        proposalTime,
        disputed,
        disputer,
        finalized,
      ] = result as [string, bigint, bigint, boolean, string, boolean]
      return {
        proposer,
        proposedOutcomeIndex: Number(proposedOutcomeIndex),
        proposalTime,
        disputed,
        disputer,
        finalized,
      }
    } catch (error) {
      throw new Error(
        `Failed to read proposal for market ${marketId}: ${error.message}`,
      )
    }
  }

  async proposeResolution(
    marketId: string,
    proposedOutcomeIndex: number,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }
    const bondAmount = await this.getResolutionBond()
    await this.approveUsdcIfNecessary(this.resolverAddress, bondAmount)

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.resolverAddress,
        abi: [
          {
            type: "function",
            name: "proposeResolution",
            inputs: [
              { name: "marketId", type: "bytes32" },
              { name: "proposedOutcomeIndex", type: "uint256" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "proposeResolution",
        args: [formattedMarketId, BigInt(proposedOutcomeIndex)],
        chain: arcTestnet,
      })
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to propose resolution for market ${marketId}: ${error.message}`,
      )
    }
  }

  async disputeResolution(marketId: string): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }
    const bondAmount = await this.getResolutionBond()
    await this.approveUsdcIfNecessary(this.resolverAddress, bondAmount)

    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.resolverAddress,
        abi: [
          {
            type: "function",
            name: "disputeResolution",
            inputs: [{ name: "marketId", type: "bytes32" }],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "disputeResolution",
        args: [formattedMarketId],
        chain: arcTestnet,
      })
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to dispute resolution for market ${marketId}: ${error.message}`,
      )
    }
  }

  async finalizeResolution(marketId: string): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.resolverAddress,
        abi: [
          {
            type: "function",
            name: "finalizeResolution",
            inputs: [{ name: "marketId", type: "bytes32" }],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "finalizeResolution",
        args: [formattedMarketId],
        chain: arcTestnet,
      })
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to finalize resolution for market ${marketId}: ${error.message}`,
      )
    }
  }

  async resolveDisputedMarket(
    marketId: string,
    winningOutcomeIndex: number,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error("Wallet client not initialized")
    }
    const formattedMarketId = this.formatMarketId(marketId)
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.resolverAddress,
        abi: [
          {
            type: "function",
            name: "resolveDisputedMarket",
            inputs: [
              { name: "marketId", type: "bytes32" },
              { name: "winningOutcomeIndex", type: "uint256" },
            ],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "resolveDisputedMarket",
        args: [formattedMarketId, BigInt(winningOutcomeIndex)],
        chain: arcTestnet,
      })
      return txHash
    } catch (error) {
      throw new Error(
        `Failed to resolve disputed market ${marketId}: ${error.message}`,
      )
    }
  }

  async getCurrentBlockTimestamp(): Promise<number> {
    try {
      const block = await this.publicClient.getBlock({ blockTag: "latest" })
      return Number(block.timestamp)
    } catch (error) {
      throw new Error(`Failed to get current block timestamp: ${error.message}`)
    }
  }
}
