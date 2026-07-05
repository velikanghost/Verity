import { Test, TestingModule } from "@nestjs/testing"
import { getModelToken } from "@nestjs/mongoose"
import { RoyaltyService } from "../src/modules/markets/royalty.service"
import { MarketTrade } from "../src/modules/markets/markets.model"
import { BlockchainService } from "../src/modules/blockchain/blockchain.service"
import { Types } from "mongoose"

describe("RoyaltyService", () => {
  let service: RoyaltyService
  let blockchainService: jest.Mocked<BlockchainService>
  let marketTradeModel: any

  const mockTrade = (overrides = {}) => {
    const save = jest.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this)
    })
    return {
      _id: new Types.ObjectId(),
      marketId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      side: "YES",
      action: "BUY" as const,
      shares: 10,
      price: 0.5,
      amountUsdc: 5.0,
      feeUsdc: 0.10,
      grossUsdc: 5.10,
      txHash: "0xOriginalTx",
      royaltyPaid: false,
      royaltyPaidTxHash: null,
      royaltyAmountUsdc: 0,
      createdAt: new Date(),
      save,
      ...overrides,
    } as any
  }

  beforeEach(async () => {
    const mockBlockchainService = {
      getPoolState: jest.fn(),
      getAdminAddress: jest.fn().mockReturnValue("0xAdminAddress"),
      transferUsdcFromTreasury: jest.fn(),
    }

    const mockMarketTradeModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoyaltyService,
        {
          provide: getModelToken(MarketTrade.name),
          useValue: mockMarketTradeModel,
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
      ],
    }).compile()

    service = module.get<RoyaltyService>(RoyaltyService)
    blockchainService = module.get(BlockchainService)
    marketTradeModel = module.get(getModelToken(MarketTrade.name))
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })



  describe("processPendingRoyaltiesQueue", () => {
    it("should process pending trades in batch, group by creator, and execute sequential transfers", async () => {
      const trade1 = mockTrade({ feeUsdc: 2.0, royaltyPaid: false })
      const trade2 = mockTrade({ feeUsdc: 3.0, royaltyPaid: false })

      // Mock database find query return value
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([trade1, trade2]),
      }
      marketTradeModel.find.mockReturnValue(mockQuery)

      blockchainService.getPoolState.mockResolvedValue({
        creatorAddress: "0xCreatorAddress",
        creatorShares: 100n,
        totalLpShares: 1000n,
        active: true,
        resolved: false,
        adminLpShares: 0n,
      })

      blockchainService.transferUsdcFromTreasury.mockResolvedValue("0xBatchTxHash")

      await service.processPendingRoyaltiesQueue()

      expect(marketTradeModel.find).toHaveBeenCalledWith({
        feeUsdc: { $gt: 0 },
        royaltyPaid: { $ne: true },
      })
      expect(blockchainService.transferUsdcFromTreasury).toHaveBeenCalledWith(
        "0xcreatoraddress",
        1.0, // (2.0 + 3.0) * 0.40 * 0.50 = 1.0 USDC
      )
      expect(trade1.royaltyPaid).toBe(true)
      expect(trade1.royaltyPaidTxHash).toBe("0xBatchTxHash")
      expect(trade1.royaltyAmountUsdc).toBe(0.4) // 2.0 * 0.20
      expect(trade2.royaltyPaid).toBe(true)
      expect(trade2.royaltyPaidTxHash).toBe("0xBatchTxHash")
      expect(trade2.royaltyAmountUsdc).toBe(0.6) // 3.0 * 0.20
      expect(trade1.save).toHaveBeenCalled()
      expect(trade2.save).toHaveBeenCalled()
    })
  })
})
