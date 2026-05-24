import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  defineChain,
  decodeFunctionData,
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

@Injectable()
export class BlockchainService implements OnModuleInit {
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
      '0x2880aB155794e7179c9eE2e38200202908C17B43') as `0x${string}`;
    this.resolverAddress = (this.configService.get<string>(
      'RESOLVER_ADDRESS',
    ) || '0x0000000000000000000000000000000000000000') as `0x${string}`;
    this.routerAddress = (this.configService.get<string>(
      'ROUTER_ADDRESS',
    ) || '0x0000000000000000000000000000000000000000') as `0x${string}`;


    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl),
    }) as PublicClient;

    const rawPrivateKey =
      this.configService.get<string>('TEST_PRIVATE_KEY') ||
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
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: 'lpShares',
        args: [formattedMarketId, userAddress as `0x${string}`],
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

      const toAddress = receipt.to?.toLowerCase();
      const isRouter = toAddress === this.routerAddress.toLowerCase();
      const isFactory = toAddress === this.factoryAddress.toLowerCase();

      if (!isRouter && !isFactory) {
        return null;
      }

      const tx = await this.publicClient.getTransaction({
        hash: hash as `0x${string}`,
      });

      let txMarketId: string;
      let txAmount: bigint;

      if (isRouter) {
        const { functionName, args } = decodeFunctionData({
          abi: this.routerAbi,
          data: tx.input,
        });

        if (functionName !== 'createMarketPreDeposit') return null;
        const [txFactory, marketIdArg, txAmountArg] = args as [string, string, bigint];

        if (txFactory.toLowerCase() !== this.factoryAddress.toLowerCase()) {
          return null;
        }
        txMarketId = marketIdArg;
        txAmount = txAmountArg;
      } else {
        const { functionName, args } = decodeFunctionData({
          abi: this.factoryAbi,
          data: tx.input,
        });

        if (functionName !== 'createMarketPreDeposit') return null;
        const [marketIdArg, txAmountArg] = args as [string, bigint];
        txMarketId = marketIdArg;
        txAmount = txAmountArg;
      }

      const formattedInputMarketId = this.formatMarketId(marketId);
      if (txMarketId.toLowerCase() !== formattedInputMarketId.toLowerCase()) {
        return null;
      }

      return txAmount;
    } catch (error) {
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

      const toAddress = receipt.to?.toLowerCase();
      const isRouter = toAddress === this.routerAddress.toLowerCase();
      const isFactory = toAddress === this.factoryAddress.toLowerCase();

      if (!isRouter && !isFactory) {
        return null;
      }

      const tx = await this.publicClient.getTransaction({
        hash: hash as `0x${string}`,
      });

      let txMarketId: string;
      let txAmount: bigint;

      if (isRouter) {
        const { functionName, args } = decodeFunctionData({
          abi: this.routerAbi,
          data: tx.input,
        });

        if (functionName !== 'depositPreMarketLiquidity') return null;
        const [txFactory, marketIdArg, txAmountArg] = args as [string, string, bigint];

        if (txFactory.toLowerCase() !== this.factoryAddress.toLowerCase()) {
          return null;
        }
        txMarketId = marketIdArg;
        txAmount = txAmountArg;
      } else {
        const { functionName, args } = decodeFunctionData({
          abi: this.factoryAbi,
          data: tx.input,
        });

        if (functionName !== 'depositPreMarketLiquidity') return null;
        const [marketIdArg, txAmountArg] = args as [string, bigint];
        txMarketId = marketIdArg;
        txAmount = txAmountArg;
      }

      const formattedInputMarketId = this.formatMarketId(marketId);
      if (txMarketId.toLowerCase() !== formattedInputMarketId.toLowerCase()) {
        return null;
      }

      return txAmount;
    } catch (error) {
      return null;
    }
  }


  async getTransactionReceipt(txHash: `0x${string}`) {
    try {
      return await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
    } catch (error) {
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
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: 'canRemoveLiquidity',
        args: [formattedMarketId, walletAddress as `0x${string}`],
      });
      return result as boolean;
    } catch (error) {
      return false;
    }
  }

  async resolveMarketWithPyth(
    marketId: string,
    priceUpdate: string[],
  ): Promise<string> {
    if (!this.walletClient) {
      throw new Error(
        'Wallet client not initialized (missing TEST_PRIVATE_KEY or KEEPER_PRIVATE_KEY)',
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
        'Wallet client not initialized (missing TEST_PRIVATE_KEY or KEEPER_PRIVATE_KEY)',
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
      throw new Error(`Failed to get current block timestamp: ${error.message}`);
    }
  }
}
