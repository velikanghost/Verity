import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { LiquidityPool, LiquidityPoolDocument, LPPosition, LPPositionDocument, LiquidityEvent, LiquidityEventDocument } from "./liquidity.model";
import { BlockchainService } from "../blockchain/blockchain.service";
import { Market, MarketDocument } from "../markets/markets.model";
import { User, UserDocument } from "../users/users.model";
import { SocketGateway } from "../socket/socket.gateway";

@Injectable()
export class LiquidityService {
  constructor(
    @InjectModel(LiquidityPool.name) private liquidityPoolModel: Model<LiquidityPoolDocument>,
    @InjectModel(LPPosition.name) private lpPositionModel: Model<LPPositionDocument>,
    @InjectModel(LiquidityEvent.name) private liquidityEventModel: Model<LiquidityEventDocument>,
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private blockchainService: BlockchainService,
    private readonly socketGateway: SocketGateway,
  ) {}

  async initializePool(marketId: string, creatorId: string, creatorWallet: string, txHash: string): Promise<LiquidityPoolDocument> {
    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException("Market not found.");
    }
    if (market.status !== "qualified" && market.status !== "funding_pool") {
      throw new ConflictException("Market is not in qualified or funding_pool status.");
    }

    const existingPool = await this.liquidityPoolModel.findOne({ marketId: new Types.ObjectId(marketId) });
    if (existingPool) {
      throw new ConflictException("Liquidity pool already initialized.");
    }

    // Verify transaction on-chain
    await this.blockchainService.getTransactionReceipt(txHash as `0x${string}`);

    // Set funding deadline to 7 days from now (or market deadline, whichever is earlier)
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fundingDeadline = market.deadline < sevenDaysFromNow ? market.deadline : sevenDaysFromNow;

    const pool = await this.liquidityPoolModel.create({
      marketId: new Types.ObjectId(marketId),
      creatorAddress: creatorWallet,
      creatorLiquidity: 10, // 10 USDC minimum
      minimumPoolBalance: 40, // 40 USDC threshold
      fundingDeadline,
      status: "funding",
    });

    // Update market status
    market.status = "funding_pool";
    market.fundingDeadline = fundingDeadline;
    await market.save();

    // Create LP Position for creator
    const lpShares = await this.blockchainService.readLPShares(
      marketId as `0x${string}`,
      creatorWallet as `0x${string}`
    );

    await this.lpPositionModel.create({
      poolId: pool._id,
      userId: new Types.ObjectId(creatorId),
      walletAddress: creatorWallet,
      lpShares: Number(lpShares) / 1e6,
      depositedUsdc: 10,
      isCreator: true,
      depositTxHash: txHash,
    });

    // Create event
    await this.liquidityEventModel.create({
      poolId: pool._id,
      userId: new Types.ObjectId(creatorId),
      type: "creator_deposit",
      amount: 10,
      txHash,
      lpSharesDelta: Number(lpShares) / 1e6,
    });

    await this.syncPoolFromChain(marketId);

    this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {});
    this.socketGateway.broadcastToRoom(`user:${creatorId}`, "user-updated", {});

    return pool;
  }

  async initializePoolFromPreDeposit(
    marketId: string,
    creatorId: string,
    creatorWallet: string,
    creatorDepositTxHash: string,
    creatorLpAmountUsdc: number,
  ): Promise<LiquidityPoolDocument> {
    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException("Market not found.");
    }

    const existingPool = await this.liquidityPoolModel.findOne({ marketId: new Types.ObjectId(marketId) });
    if (existingPool) {
      throw new ConflictException("Liquidity pool already initialized.");
    }

    // Set funding deadline to 7 days from now (or market deadline, whichever is earlier)
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fundingDeadline = market.deadline < sevenDaysFromNow ? market.deadline : sevenDaysFromNow;

    const pool = await this.liquidityPoolModel.create({
      marketId: new Types.ObjectId(marketId),
      creatorAddress: creatorWallet,
      creatorLiquidity: creatorLpAmountUsdc,
      minimumPoolBalance: 40,
      fundingDeadline,
      status: "funding",
    });

    // Create LP Position for creator
    await this.lpPositionModel.create({
      poolId: pool._id,
      userId: new Types.ObjectId(creatorId),
      walletAddress: creatorWallet,
      lpShares: creatorLpAmountUsdc, // Since it's pre-deposit, it's 1:1 on-chain when pool starts
      depositedUsdc: creatorLpAmountUsdc,
      isCreator: true,
      depositTxHash: creatorDepositTxHash,
    });

    // Create event
    await this.liquidityEventModel.create({
      poolId: pool._id,
      userId: new Types.ObjectId(creatorId),
      type: "creator_deposit",
      amount: creatorLpAmountUsdc,
      txHash: creatorDepositTxHash,
      lpSharesDelta: creatorLpAmountUsdc,
    });

    await this.syncPoolFromChain(marketId);

    this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {});
    this.socketGateway.broadcastToRoom(`user:${creatorId}`, "user-updated", {});

    return pool;
  }

  async addLiquidity(marketId: string, userId: string, amount: number, txHash: string): Promise<LPPositionDocument> {
    const pool = await this.liquidityPoolModel.findOne({ marketId: new Types.ObjectId(marketId) });
    if (!pool) {
      throw new NotFoundException("Liquidity pool not found.");
    }
    if (pool.status !== "funding" && pool.status !== "active") {
      throw new ConflictException("Pool is not accepting liquidity.");
    }

    const user = await this.userModel.findById(userId);
    if (!user || !user.walletAddress) {
      throw new BadRequestException("User does not have a linked wallet address.");
    }

    // Verify transaction on-chain
    await this.blockchainService.getTransactionReceipt(txHash as `0x${string}`);

    // Read new LP share balance from chain
    const onChainShares = await this.blockchainService.readLPShares(
      marketId as `0x${string}`,
      user.walletAddress as `0x${string}`
    );
    const newShares = Number(onChainShares) / 1e6;

    let position = await this.lpPositionModel.findOne({
      poolId: pool._id,
      userId: new Types.ObjectId(userId),
    });

    const oldShares = position ? position.lpShares : 0;
    const sharesDelta = newShares - oldShares;

    if (position) {
      position.lpShares = newShares;
      position.depositedUsdc += amount;
      position.depositedAt = new Date();
      position.depositTxHash = txHash;
      await position.save();
    } else {
      position = await this.lpPositionModel.create({
        poolId: pool._id,
        userId: new Types.ObjectId(userId),
        walletAddress: user.walletAddress,
        lpShares: newShares,
        depositedUsdc: amount,
        isCreator: false,
        depositTxHash: txHash,
      });
    }

    // Create event
    await this.liquidityEventModel.create({
      poolId: pool._id,
      userId: new Types.ObjectId(userId),
      type: "lp_deposit",
      amount,
      txHash,
      lpSharesDelta: sharesDelta,
    });

    await this.syncPoolFromChain(marketId);

    this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {});
    this.socketGateway.broadcastToRoom(`user:${userId}`, "user-updated", {});

    return position;
  }

  async removeLiquidity(marketId: string, userId: string, lpShares: number, txHash: string): Promise<LPPositionDocument | null> {
    const pool = await this.liquidityPoolModel.findOne({ marketId: new Types.ObjectId(marketId) });
    if (!pool) {
      throw new NotFoundException("Liquidity pool not found.");
    }

    const user = await this.userModel.findById(userId);
    if (!user || !user.walletAddress) {
      throw new BadRequestException("User does not have a linked wallet address.");
    }

    // Enforce 24h lock check
    const canRemove = await this.canRemoveLiquidity(marketId, user.walletAddress);
    if (!canRemove) {
      throw new ConflictException("LP lock is active. You must wait 24 hours from your last deposit.");
    }

    // Verify transaction on-chain
    await this.blockchainService.getTransactionReceipt(txHash as `0x${string}`);

    // Read remaining LP shares from chain
    const onChainShares = await this.blockchainService.readLPShares(
      marketId as `0x${string}`,
      user.walletAddress as `0x${string}`
    );
    const remainingShares = Number(onChainShares) / 1e6;

    const position = await this.lpPositionModel.findOne({
      poolId: pool._id,
      userId: new Types.ObjectId(userId),
    });

    if (!position) {
      throw new NotFoundException("LP position not found.");
    }

    const sharesDelta = position.lpShares - remainingShares;

    // Create event
    await this.liquidityEventModel.create({
      poolId: pool._id,
      userId: new Types.ObjectId(userId),
      type: "lp_withdraw",
      amount: position.depositedUsdc * (sharesDelta / (position.lpShares || 1)),
      txHash,
      lpSharesDelta: -sharesDelta,
    });

    if (remainingShares === 0) {
      await this.lpPositionModel.deleteOne({ _id: position._id });
      await this.syncPoolFromChain(marketId);

      this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
      this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {});
      this.socketGateway.broadcastToRoom(`user:${userId}`, "user-updated", {});

      return null;
    } else {
      position.lpShares = remainingShares;
      // Proportionally reduce deposited USDC tracking
      position.depositedUsdc = Math.max(0, position.depositedUsdc - (position.depositedUsdc * (sharesDelta / (position.lpShares || 1))));
      await position.save();
      await this.syncPoolFromChain(marketId);

      this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
      this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {});
      this.socketGateway.broadcastToRoom(`user:${userId}`, "user-updated", {});

      return position;
    }
  }

  async canRemoveLiquidity(marketId: string, walletAddress: string): Promise<boolean> {
    return this.blockchainService.canRemoveLiquidity(marketId, walletAddress);
  }

  async syncPoolFromChain(marketId: string): Promise<void> {
    const pool = await this.liquidityPoolModel.findOne({ marketId: new Types.ObjectId(marketId) });
    if (!pool) return;

    try {
      const onChainState = await this.blockchainService.readPoolBalances(marketId as `0x${string}`);

      if (onChainState.active) {
        pool.yesBalance = Number(onChainState.yesBalance) / 1e6;
        pool.noBalance = Number(onChainState.noBalance) / 1e6;
        pool.totalLPShares = Number(onChainState.totalLPShares) / 1e6;
        pool.currentPoolBalance = Number(onChainState.totalDeposited) / 1e6;
        pool.status = onChainState.resolved ? "resolved" : "active";

        // Sync LP positions from chain for all depositors
        const positions = await this.lpPositionModel.find({ poolId: pool._id });
        for (const pos of positions) {
          try {
            const shares = await this.blockchainService.readLPShares(marketId, pos.walletAddress);
            const sharesNum = Number(shares) / 1e6;
            if (sharesNum === 0) {
              await this.lpPositionModel.deleteOne({ _id: pos._id });
            } else {
              pos.lpShares = sharesNum;
              await pos.save();
            }
          } catch (err) {
            // Ignore individual sync failures
          }
        }
      } else {
        const escrowBalance = await this.blockchainService.readEscrowBalance(marketId as `0x${string}`);
        pool.yesBalance = 0;
        pool.noBalance = 0;
        pool.totalLPShares = 0;
        pool.currentPoolBalance = Number(escrowBalance) / 1e6;
        pool.status = "funding";
      }

      if (onChainState.resolved) {
        pool.status = "resolved";
      }

      await pool.save();

      // Sync Market Status & Liquidity
      const market = await this.marketModel.findById(marketId);
      if (market) {
        let changed = false;
        if (market.liquidity !== pool.currentPoolBalance) {
          market.liquidity = pool.currentPoolBalance;
          changed = true;
        }
        if (onChainState.resolved) {
          if (market.status !== "resolved") {
            const onChainMarket = await this.blockchainService.readOnChainMarketState(marketId);
            market.status = "resolved";
            market.resolvedOutcome = onChainMarket.winningIsYes ? "YES" : "NO";
            market.resolvedByAdmin = "0xKeeper";
            changed = true;
          }
        } else if (onChainState.active && market.status !== "tradable") {
          market.status = "tradable";
          changed = true;
        }
        if (changed) {
          await market.save();
        }
      }
    } catch (error) {
      // Contract call might revert if the pool is not created yet (i.e. still in escrow/funding stage)
      // Query factory for escrow balance instead
      try {
        const escrowBalance = await this.blockchainService.readEscrowBalance(marketId as `0x${string}`);
        pool.currentPoolBalance = Number(escrowBalance) / 1e6;
        await pool.save();

        const market = await this.marketModel.findById(marketId);
        if (market && market.liquidity !== pool.currentPoolBalance) {
          market.liquidity = pool.currentPoolBalance;
          await market.save();
        }
      } catch (err) {
        // Ignore if both fail
      }
    }
  }

  async getPoolState(marketId: string) {
    // Automatically self-heal and sync pool/market state from chain
    await this.syncPoolFromChain(marketId);

    const pool = await this.liquidityPoolModel.findOne({ marketId: new Types.ObjectId(marketId) });
    if (!pool) {
      throw new NotFoundException("Pool not found.");
    }
    const prices = await this.blockchainService.getMarketPrices(marketId as `0x${string}`);
    return {
      pool,
      prices,
    };
  }

  async getUserPositions(marketId: string, userId: string) {
    await this.syncPoolFromChain(marketId);
    const pool = await this.liquidityPoolModel.findOne({ marketId: new Types.ObjectId(marketId) });
    if (!pool) {
      throw new NotFoundException("Pool not found.");
    }
    return this.lpPositionModel.find({
      poolId: pool._id,
      userId: new Types.ObjectId(userId),
    });
  }

  // Cron Job / Periodic scan to void expired pools
  async voidExpiredPools(): Promise<void> {
    const now = new Date();
    const expiredPools = await this.liquidityPoolModel.find({
      status: "funding",
      fundingDeadline: { $lt: now },
    });

    for (const pool of expiredPools) {
      pool.status = "voided";
      await pool.save();

      const market = await this.marketModel.findById(pool.marketId);
      if (market) {
        market.status = "voided";
        await market.save();
      }
    }
  }
}
