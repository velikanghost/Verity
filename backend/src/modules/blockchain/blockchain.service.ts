import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  defineChain,
  decodeFunctionData,
  decodeEventLog,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fpmmAbi from './abi/VerityFPMM.json';
import factoryAbi from './abi/VerityMarketFactory.json';
import routerAbi from './abi/VerityRouter.json';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc', symbol: 'ARC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
});

const entryPointAbi = [
  {
    name: 'handleOps',
    type: 'function',
    inputs: [
      {
        name: 'ops',
        type: 'tuple[]',
        components: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'callGasLimit', type: 'uint256' },
          { name: 'verificationGasLimit', type: 'uint256' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'maxPriorityFeePerGas', type: 'uint256' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
      { name: 'beneficiary', type: 'address' },
    ],
  },
] as const;

const smartAccountExecuteAbi = [
  {
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'dest', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'func', type: 'bytes' },
    ],
  },
  {
    name: 'executeBatch',
    type: 'function',
    inputs: [
      { name: 'dest', type: 'address[]' },
      { name: 'func', type: 'bytes[]' },
    ],
  },
  {
    name: 'executeBatch',
    type: 'function',
    inputs: [
      { name: 'dest', type: 'address[]' },
      { name: 'value', type: 'uint256[]' },
      { name: 'func', type: 'bytes[]' },
    ],
  },
] as const;

const safeExecTransactionAbi = [
  {
    name: 'execTransaction',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
  },
] as const;

function getCallSequence(
  to: string,
  data: string,
): { to: string; data: string }[] {
  const calls: { to: string; data: string }[] = [
    { to: to.toLowerCase(), data },
  ];

  if (!data || data === '0x') return calls;

  // 1. Try to decode as EntryPoint handleOps
  if (data.startsWith('0x1faf9611') || data.startsWith('0x43d7266e')) {
    try {
      const { args } = decodeFunctionData({
        abi: entryPointAbi,
        data: data as `0x${string}`,
      });
      if (args && args[0]) {
        const ops = args[0] as any[];
        for (const op of ops) {
          const nestedCalls = getCallSequence(op.sender, op.callData);
          calls.push(...nestedCalls);
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
    });
    if (
      decodedSmartAccount.functionName === 'execute' &&
      decodedSmartAccount.args
    ) {
      const [dest, , func] = decodedSmartAccount.args as [
        string,
        bigint,
        string,
      ];
      const nestedCalls = getCallSequence(dest, func);
      calls.push(...nestedCalls);
    } else if (
      decodedSmartAccount.functionName === 'executeBatch' &&
      decodedSmartAccount.args
    ) {
      const args = decodedSmartAccount.args as any[];
      const dests = args[0] as string[];
      const funcs = args.find(
        (arg) =>
          Array.isArray(arg) &&
          arg.length > 0 &&
          typeof arg[0] === 'string' &&
          arg[0].startsWith('0x'),
      ) as string[];
      if (funcs) {
        for (let i = 0; i < dests.length; i++) {
          const nestedCalls = getCallSequence(dests[i], funcs[i]);
          calls.push(...nestedCalls);
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // 3. Try to decode as Safe execTransaction
  if (data.startsWith('0x6a761202')) {
    try {
      const { args } = decodeFunctionData({
        abi: safeExecTransactionAbi,
        data: data as `0x${string}`,
      });
      if (args) {
        const [toArg, , dataArg] = args as [string, bigint, string];
        const nestedCalls = getCallSequence(toArg, dataArg);
        calls.push(...nestedCalls);
      }
    } catch (e) {
      // Ignore
    }
  }

  return calls;
}

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private publicClient: PublicClient;
  private walletClient: any;
  private account: any;
  private fpmmAbi = fpmmAbi;
  private factoryAbi = factoryAbi;
  private routerAbi = routerAbi;
  private usdcAbi: any;

  private fpmmAddress: `0x${string}`;
  private factoryAddress: `0x${string}`;
  private usdcAddress: `0x${string}`;
  private pythAddress: `0x${string}`;
  private resolverAddress: `0x${string}`;
  private routerAddress: `0x${string}`;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const rpcUrl =
      this.configService.get<string>('ARC_RPC_URL') ||
      'https://rpc.testnet.arc.network';
    this.fpmmAddress = this.configService.get<string>(
      'FPMM_ADDRESS',
    ) as `0x${string}`;
    this.factoryAddress = this.configService.get<string>(
      'FACTORY_ADDRESS',
    ) as `0x${string}`;
    this.usdcAddress = this.configService.get<string>(
      'USDC_ADDRESS',
    ) as `0x${string}`;
    this.pythAddress = (this.configService.get<string>('PYTH_ADDRESS') ||
      '') as `0x${string}`;
    this.resolverAddress = (this.configService.get<string>(
      'RESOLVER_ADDRESS',
    ) || '') as `0x${string}`;
    this.routerAddress = (this.configService.get<string>('ROUTER_ADDRESS') ||
      '') as `0x${string}`;

    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl),
    }) as PublicClient;

    const rawPrivateKey =
      this.configService.get<string>('ADMIN_PRIVATE_KEY') ||
      this.configService.get<string>('KEEPER_PRIVATE_KEY');
    if (rawPrivateKey) {
      const privateKey = (
        rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`
      ) as `0x${string}`;
      this.account = privateKeyToAccount(privateKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain: arcTestnet,
        transport: http(rpcUrl),
      });
    }

    this.loadAbis();
  }

  private loadAbis() {
    // Standard ERC20 minimal ABI for USDC
    this.usdcAbi = [
      {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
      },
      {
        type: 'function',
        name: 'allowance',
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
      },
    ];
  }

  private formatMarketId(marketId: string): `0x${string}` {
    const clean = marketId.replace(/^0x/, '');
    return `0x${clean.padEnd(64, '0')}` as `0x${string}`;
  }

  private formatAddress(address: string): `0x${string}` {
    const clean = address.trim().toLowerCase();
    return (clean.startsWith('0x') ? clean : `0x${clean}`) as `0x${string}`;
  }

  async readPoolBalances(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: 'getPoolBalances',
        args: [formattedMarketId],
      });
      const [
        yesBalance,
        noBalance,
        totalLPShares,
        totalDeposited,
        active,
        resolved,
      ] = result as [bigint, bigint, bigint, bigint, boolean, boolean];
      return {
        yesBalance,
        noBalance,
        totalLPShares,
        totalDeposited,
        active,
        resolved,
      };
    } catch (error) {
      throw new Error(
        `Failed to read pool balances for market ${marketId}: ${error.message}`,
      );
    }
  }

  async readLPShares(marketId: string, userAddress: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    const formattedUserAddress = this.formatAddress(userAddress);
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: 'lpShares',
        args: [formattedMarketId, formattedUserAddress],
      });
      return result as bigint;
    } catch (error) {
      throw new Error(
        `Failed to read LP shares for market ${marketId}, user ${userAddress}: ${error.message}`,
      );
    }
  }

  async getMarketPrices(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const yesPriceResult = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: 'getYesPrice',
        args: [formattedMarketId],
      });

      const noPriceResult = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: 'getNoPrice',
        args: [formattedMarketId],
      });

      // Price is returned scaled by 1e18 on-chain. Convert to standard decimal representation (0 to 1)
      const yesPrice = Number(yesPriceResult as bigint) / 1e18;
      const noPrice = Number(noPriceResult as bigint) / 1e18;

      return { yesPrice, noPrice };
    } catch (error) {
      // If pool is not active or getYesPrice reverts, return 0.5/0.5 default price
      return { yesPrice: 0.5, noPrice: 0.5 };
    }
  }

  async verifyCreateMarketPreDeposit(
    txHash: string,
    marketId: string,
  ): Promise<bigint | null> {
    try {
      const hash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      if (receipt.status !== 'success') return null;

      const tx = await this.publicClient.getTransaction({
        hash: hash as `0x${string}`,
      });

      const calls = getCallSequence(receipt.to || tx.to || '', tx.input);
      for (const call of calls) {
        const callTo = call.to.toLowerCase();
        const isRouter = callTo === this.routerAddress.toLowerCase();
        const isFactory = callTo === this.factoryAddress.toLowerCase();
        if (!isRouter && !isFactory) continue;

        let txMarketId: string;
        let txAmount: bigint;

        if (isRouter) {
          try {
            const { functionName, args } = decodeFunctionData({
              abi: this.routerAbi,
              data: call.data as `0x${string}`,
            });

            if (functionName !== 'createMarketPreDeposit') continue;
            const [txFactory, marketIdArg, txAmountArg] = args as [
              string,
              string,
              bigint,
            ];

            if (txFactory.toLowerCase() !== this.factoryAddress.toLowerCase()) {
              continue;
            }
            txMarketId = marketIdArg;
            txAmount = txAmountArg;
          } catch (e) {
            continue;
          }
        } else {
          try {
            const { functionName, args } = decodeFunctionData({
              abi: this.factoryAbi,
              data: call.data as `0x${string}`,
            });

            if (functionName !== 'createMarketPreDeposit') continue;
            const [marketIdArg, txAmountArg] = args as [string, bigint];
            txMarketId = marketIdArg;
            txAmount = txAmountArg;
          } catch (e) {
            continue;
          }
        }

        const formattedInputMarketId = this.formatMarketId(marketId);
        if (txMarketId.toLowerCase() === formattedInputMarketId.toLowerCase()) {
          return txAmount;
        }
      }

      // Fallback: search for event logs from the factory contract
      const formattedInputMarketId = this.formatMarketId(marketId);
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === this.factoryAddress.toLowerCase()) {
          try {
            const decodedLog = decodeEventLog({
              abi: this.factoryAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decodedLog.eventName === 'MarketPreDepositCreated') {
              const { marketId: logMarketId, amount } = decodedLog.args as any;
              if (
                logMarketId.toLowerCase() ===
                formattedInputMarketId.toLowerCase()
              ) {
                return amount;
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `verifyCreateMarketPreDeposit failed for tx ${txHash}, market ${marketId}: ${error.message}`,
      );
      return null;
    }
  }

  async verifyDepositPreMarketLiquidity(
    txHash: string,
    marketId: string,
  ): Promise<bigint | null> {
    try {
      const hash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      if (receipt.status !== 'success') return null;

      const tx = await this.publicClient.getTransaction({
        hash: hash as `0x${string}`,
      });

      const calls = getCallSequence(receipt.to || tx.to || '', tx.input);
      for (const call of calls) {
        const callTo = call.to.toLowerCase();
        const isRouter = callTo === this.routerAddress.toLowerCase();
        const isFactory = callTo === this.factoryAddress.toLowerCase();
        if (!isRouter && !isFactory) continue;

        let txMarketId: string;
        let txAmount: bigint;

        if (isRouter) {
          try {
            const { functionName, args } = decodeFunctionData({
              abi: this.routerAbi,
              data: call.data as `0x${string}`,
            });

            if (functionName !== 'depositPreMarketLiquidity') continue;
            const [txFactory, marketIdArg, txAmountArg] = args as [
              string,
              string,
              bigint,
            ];

            if (txFactory.toLowerCase() !== this.factoryAddress.toLowerCase()) {
              continue;
            }
            txMarketId = marketIdArg;
            txAmount = txAmountArg;
          } catch (e) {
            continue;
          }
        } else {
          try {
            const { functionName, args } = decodeFunctionData({
              abi: this.factoryAbi,
              data: call.data as `0x${string}`,
            });

            if (functionName !== 'depositPreMarketLiquidity') continue;
            const [marketIdArg, txAmountArg] = args as [string, bigint];
            txMarketId = marketIdArg;
            txAmount = txAmountArg;
          } catch (e) {
            continue;
          }
        }

        const formattedInputMarketId = this.formatMarketId(marketId);
        if (txMarketId.toLowerCase() === formattedInputMarketId.toLowerCase()) {
          return txAmount;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `verifyDepositPreMarketLiquidity failed for tx ${txHash}, market ${marketId}: ${error.message}`,
      );
      return null;
    }
  }

  async getTransactionReceipt(txHash: `0x${string}`) {
    try {
      return await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
    } catch (error) {
      this.logger.error(
        `Transaction verification failed for hash ${txHash}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Transaction verification failed for hash ${txHash}: ${error.message}`,
      );
    }
  }

  async readEscrowBalance(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const result = await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: 'escrowBalances',
        args: [formattedMarketId],
      });
      return result as bigint;
    } catch (error) {
      throw new Error(
        `Failed to read escrow balance for market ${marketId}: ${error.message}`,
      );
    }
  }

  async canRemoveLiquidity(
    marketId: string,
    walletAddress: string,
  ): Promise<boolean> {
    const formattedMarketId = this.formatMarketId(marketId);
    const formattedWalletAddress = this.formatAddress(walletAddress);
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: 'canRemoveLiquidity',
        args: [formattedMarketId, formattedWalletAddress],
      });
      return result as boolean;
    } catch (error) {
      this.logger.warn(`canRemoveLiquidity check failed for market ${marketId}, wallet ${walletAddress}: ${error.message}`);
      return false;
    }
  }

  async resolveMarketWithPyth(
    marketId: string,
    priceUpdate: string[],
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error(
        'Wallet client not initialized (missing ADMIN_PRIVATE_KEY or KEEPER_PRIVATE_KEY)',
      );
    }

    const formattedMarketId = this.formatMarketId(marketId);
    const formattedPriceUpdate = priceUpdate.map(
      (x) => (x.startsWith('0x') ? x : `0x${x}`) as `0x${string}`,
    );

    // Get the required update fee from Pyth contract if we have pythAddress
    let fee = BigInt(0);
    try {
      if (this.pythAddress) {
        fee = (await this.publicClient.readContract({
          address: this.pythAddress,
          abi: [
            {
              type: 'function',
              name: 'getUpdateFee',
              inputs: [{ name: 'updateData', type: 'bytes[]' }],
              outputs: [{ name: 'fee', type: 'uint256' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'getUpdateFee',
          args: [formattedPriceUpdate],
        })) as bigint;
      }
    } catch (error) {
      // Fallback: send 1 wei or 0.01 ether
      fee = BigInt(10000000000000000n); // 0.01 ARC
    }

    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: 'resolveMarketWithPyth',
        args: [formattedMarketId, formattedPriceUpdate],
        value: fee,
        chain: arcTestnet,
      });

      return txHash;
    } catch (error) {
      throw new Error(
        `Failed to resolve market ${marketId} with Pyth: ${error.message}`,
      );
    }
  }

  async registerMarket(
    marketId: string,
    creator: string,
    deadline: number,
    fundingDeadline: number,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error(
        'Wallet client not initialized (missing ADMIN_PRIVATE_KEY or KEEPER_PRIVATE_KEY)',
      );
    }

    const formattedMarketId = this.formatMarketId(marketId);

    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: 'registerMarket',
        args: [
          formattedMarketId,
          creator as `0x${string}`,
          BigInt(deadline),
          BigInt(fundingDeadline),
        ],
        chain: arcTestnet,
      });
      return txHash;
    } catch (error) {
      throw new Error(
        `Failed to register market ${marketId}: ${error.message}`,
      );
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
      throw new Error('Wallet client not initialized');
    }

    const formattedMarketId = this.formatMarketId(marketId);
    const formattedPriceFeedId = (
      priceFeedId.startsWith('0x') ? priceFeedId : `0x${priceFeedId}`
    ) as `0x${string}`;

    try {
      const txHash = await this.walletClient.writeContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: 'registerPythMarket',
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
      });
      return txHash;
    } catch (error) {
      throw new Error(
        `Failed to register Pyth market ${marketId}: ${error.message}`,
      );
    }
  }

  async readOnChainMarketState(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const result = await this.publicClient.readContract({
        address: this.configService.get<string>(
          'CONDITIONAL_TOKEN_VAULT_ADDRESS',
        ) as `0x${string}`,
        abi: [
          {
            type: 'function',
            name: 'markets',
            inputs: [{ name: '', type: 'bytes32' }],
            outputs: [
              { name: 'resolved', type: 'bool' },
              { name: 'winningIsYes', type: 'bool' },
              { name: 'totalCollateral', type: 'uint256' },
            ],
            stateMutability: 'view',
          },
        ],
        functionName: 'markets',
        args: [formattedMarketId],
      });
      const [resolved, winningIsYes, totalCollateral] = result as [
        boolean,
        boolean,
        bigint,
      ];
      return { resolved, winningIsYes, totalCollateral };
    } catch (error) {
      throw new Error(
        `Failed to read on-chain market state for ${marketId}: ${error.message}`,
      );
    }
  }

  async getUserOnChainBalances(marketId: string, userAddress: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    const vaultAddress = this.configService.get<string>(
      'CONDITIONAL_TOKEN_VAULT_ADDRESS',
    ) as `0x${string}`;
    try {
      // 1. Get YES/NO token IDs
      const yesId = await this.publicClient.readContract({
        address: vaultAddress,
        abi: [
          {
            type: 'function',
            name: 'yesTokenId',
            inputs: [{ name: 'marketId', type: 'bytes32' }],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'pure',
          },
        ],
        functionName: 'yesTokenId',
        args: [formattedMarketId],
      });

      const noId = await this.publicClient.readContract({
        address: vaultAddress,
        abi: [
          {
            type: 'function',
            name: 'noTokenId',
            inputs: [{ name: 'marketId', type: 'bytes32' }],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'pure',
          },
        ],
        functionName: 'noTokenId',
        args: [formattedMarketId],
      });

      // 2. Query balanceOf for both YES and NO token IDs
      const yesBalance = await this.publicClient.readContract({
        address: vaultAddress,
        abi: [
          {
            type: 'function',
            name: 'balanceOf',
            inputs: [
              { name: 'account', type: 'address' },
              { name: 'id', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`, yesId],
      });

      const noBalance = await this.publicClient.readContract({
        address: vaultAddress,
        abi: [
          {
            type: 'function',
            name: 'balanceOf',
            inputs: [
              { name: 'account', type: 'address' },
              { name: 'id', type: 'uint256' },
            ],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`, noId],
      });

      return {
        yesBalance: Number(yesBalance) / 1e6,
        noBalance: Number(noBalance) / 1e6,
      };
    } catch (error) {
      return { yesBalance: 0, noBalance: 0 };
    }
  }

  async approveUsdcIfNecessary(
    spender: string,
    amount: bigint,
  ): Promise<string | null> {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }
    const allowance = (await this.publicClient.readContract({
      address: this.usdcAddress,
      abi: this.usdcAbi,
      functionName: 'allowance',
      args: [this.account.address, spender as `0x${string}`],
    })) as bigint;

    if (allowance >= amount) {
      return null;
    }

    // Approve
    const txHash = await this.walletClient.writeContract({
      address: this.usdcAddress,
      abi: [
        {
          type: 'function',
          name: 'approve',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
        },
      ],
      functionName: 'approve',
      args: [spender as `0x${string}`, amount],
      chain: arcTestnet,
    });

    // Wait for approval transaction receipt
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async getResolutionBond(): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.resolverAddress,
        abi: [
          {
            type: 'function',
            name: 'resolutionBond',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'resolutionBond',
        args: [],
      });
      return result as bigint;
    } catch (error) {
      // Fallback: 10 USDC (assuming 6 decimals)
      return 10_000_000n;
    }
  }

  async getDisputeWindow(): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.resolverAddress,
        abi: [
          {
            type: 'function',
            name: 'disputeWindow',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
          },
        ],
        functionName: 'disputeWindow',
        args: [],
      });
      return result as bigint;
    } catch (error) {
      // Fallback: 120 seconds
      return 120n;
    }
  }

  async readProposal(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const result = await this.publicClient.readContract({
        address: this.resolverAddress,
        abi: [
          {
            type: 'function',
            name: 'proposals',
            inputs: [{ name: '', type: 'bytes32' }],
            outputs: [
              { name: 'proposer', type: 'address' },
              { name: 'proposedWinningOutcome', type: 'bool' },
              { name: 'proposalTime', type: 'uint256' },
              { name: 'disputed', type: 'bool' },
              { name: 'disputer', type: 'address' },
              { name: 'finalized', type: 'bool' },
            ],
            stateMutability: 'view',
          },
        ],
        functionName: 'proposals',
        args: [formattedMarketId],
      });
      const [
        proposer,
        proposedWinningOutcome,
        proposalTime,
        disputed,
        disputer,
        finalized,
      ] = result as [string, boolean, bigint, boolean, string, boolean];
      return {
        proposer,
        proposedWinningOutcome,
        proposalTime,
        disputed,
        disputer,
        finalized,
      };
    } catch (error) {
      throw new Error(
        `Failed to read proposal for market ${marketId}: ${error.message}`,
      );
    }
  }

  async proposeResolution(
    marketId: string,
    proposedOutcome: boolean,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }
    const bondAmount = await this.getResolutionBond();
    await this.approveUsdcIfNecessary(this.resolverAddress, bondAmount);

    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.resolverAddress,
        abi: [
          {
            type: 'function',
            name: 'proposeResolution',
            inputs: [
              { name: 'marketId', type: 'bytes32' },
              { name: 'proposedOutcome', type: 'bool' },
            ],
            outputs: [],
            stateMutability: 'nonpayable',
          },
        ],
        functionName: 'proposeResolution',
        args: [formattedMarketId, proposedOutcome],
        chain: arcTestnet,
      });
      return txHash;
    } catch (error) {
      throw new Error(
        `Failed to propose resolution for market ${marketId}: ${error.message}`,
      );
    }
  }

  async disputeResolution(marketId: string): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }
    const bondAmount = await this.getResolutionBond();
    await this.approveUsdcIfNecessary(this.resolverAddress, bondAmount);

    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.resolverAddress,
        abi: [
          {
            type: 'function',
            name: 'disputeResolution',
            inputs: [{ name: 'marketId', type: 'bytes32' }],
            outputs: [],
            stateMutability: 'nonpayable',
          },
        ],
        functionName: 'disputeResolution',
        args: [formattedMarketId],
        chain: arcTestnet,
      });
      return txHash;
    } catch (error) {
      throw new Error(
        `Failed to dispute resolution for market ${marketId}: ${error.message}`,
      );
    }
  }

  async finalizeResolution(marketId: string): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.resolverAddress,
        abi: [
          {
            type: 'function',
            name: 'finalizeResolution',
            inputs: [{ name: 'marketId', type: 'bytes32' }],
            outputs: [],
            stateMutability: 'nonpayable',
          },
        ],
        functionName: 'finalizeResolution',
        args: [formattedMarketId],
        chain: arcTestnet,
      });
      return txHash;
    } catch (error) {
      throw new Error(
        `Failed to finalize resolution for market ${marketId}: ${error.message}`,
      );
    }
  }

  async resolveDisputedMarket(
    marketId: string,
    winningIsYes: boolean,
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const txHash = await this.walletClient.writeContract({
        address: this.resolverAddress,
        abi: [
          {
            type: 'function',
            name: 'resolveDisputedMarket',
            inputs: [
              { name: 'marketId', type: 'bytes32' },
              { name: 'winningIsYes', type: 'bool' },
            ],
            outputs: [],
            stateMutability: 'nonpayable',
          },
        ],
        functionName: 'resolveDisputedMarket',
        args: [formattedMarketId, winningIsYes],
        chain: arcTestnet,
      });
      return txHash;
    } catch (error) {
      throw new Error(
        `Failed to resolve disputed market ${marketId}: ${error.message}`,
      );
    }
  }

  async getCurrentBlockTimestamp(): Promise<number> {
    try {
      const block = await this.publicClient.getBlock({ blockTag: 'latest' });
      return Number(block.timestamp);
    } catch (error) {
      throw new Error(
        `Failed to get current block timestamp: ${error.message}`,
      );
    }
  }
}
