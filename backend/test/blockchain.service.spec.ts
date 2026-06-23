import { Test, TestingModule } from "@nestjs/testing"
import { ConfigService } from "@nestjs/config"
import { BlockchainService } from "../src/modules/blockchain/blockchain.service"
import { decodeFunctionData } from "viem"

const mockPublicClient = {
  getTransactionCount: jest.fn(),
  getGasPrice: jest.fn(),
  waitForTransactionReceipt: jest.fn(),
  readContract: jest.fn(),
  getTransactionReceipt: jest.fn(),
  getTransaction: jest.fn(),
}

const mockWalletClient = {
  writeContract: jest.fn(),
}

jest.mock("viem", () => {
  const actual = jest.requireActual("viem")
  return {
    ...actual,
    decodeFunctionData: jest.fn(),
    createPublicClient: jest.fn().mockImplementation(() => mockPublicClient),
    createWalletClient: jest.fn().mockImplementation(() => mockWalletClient),
  }
})

describe("BlockchainService", () => {
  let service: BlockchainService
  let configService: jest.Mocked<ConfigService>

  beforeEach(async () => {
    jest.clearAllMocks()

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "ARC_RPC_URL") return "https://mock.rpc"
        if (key === "FPMM_ADDRESS") return "0xFPMM"
        if (key === "FACTORY_ADDRESS") return "0xFactory"
        if (key === "USDC_ADDRESS") return "0xUSDC"
        if (key === "CONDITIONAL_TOKEN_VAULT_ADDRESS") return "0xVault"
        if (key === "ADMIN_PRIVATE_KEY" || key === "KEEPER_PRIVATE_KEY") {
          return "0x9c1a9662dcbaea6235d9d7078af6799a9974d64a62fa307c6c70015a27a74611"
        }
        return null
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()

    service = module.get<BlockchainService>(BlockchainService)
    configService = module.get(ConfigService)
    service.onModuleInit()

    // Override publicClient and walletClient with mocks to be 100% sure
    ;(service as any).publicClient = mockPublicClient
    ;(service as any).walletClient = mockWalletClient
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("formatMarketId", () => {
    it("should format Mongo ID string into bytes32 padded hex string", () => {
      const id = "60d0fe4f5311236168a109ca"
      const formatted = (service as any).formatMarketId(id)
      expect(formatted).toBe(
        "0x60d0fe4f5311236168a109ca0000000000000000000000000000000000000000",
      )
    })
  })

  describe("getTransactionReceipt", () => {
    it("should return the transaction receipt", async () => {
      const mockReceipt = { blockNumber: 123, status: "success" }
      mockPublicClient.getTransactionReceipt.mockResolvedValue(mockReceipt)

      const result = await service.getTransactionReceipt("0xTxHash")
      expect(result).toEqual(mockReceipt)
      expect(mockPublicClient.getTransactionReceipt).toHaveBeenCalledWith({
        hash: "0xTxHash",
      })
    })
  })

  describe("readOnChainMarketState", () => {
    it("should query publicClient readContract and return results", async () => {
      const mockResult = [true, BigInt(1), BigInt(100), BigInt(2)]
      mockPublicClient.readContract.mockResolvedValue(mockResult)

      const result = await service.readOnChainMarketState(
        "60d0fe4f5311236168a109ca",
      )
      expect(result.resolved).toBe(true)
      expect(result.winningOutcomeIndex).toBe(1)
      expect(result.totalCollateral).toBe(BigInt(100))
      expect(result.outcomeCount).toBe(2)
    })
  })

  describe("safeWriteContract", () => {
    it("should write contract with pending nonce successfully on first attempt", async () => {
      mockPublicClient.getTransactionCount.mockResolvedValue(10)
      mockWalletClient.writeContract.mockResolvedValue("0xTxHash")
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: "success",
      })

      const params = { address: "0xContract", functionName: "test" }
      const txHash = await (service as any).safeWriteContract(params)

      expect(txHash).toBe("0xTxHash")
      expect(mockPublicClient.getTransactionCount).toHaveBeenCalledWith({
        address: service.getAdminAddress(),
        blockTag: "pending",
      })
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        ...params,
        nonce: 10,
      })
    })

    it("should bump gas and retry on 'replacement transaction underpriced'", async () => {
      mockPublicClient.getTransactionCount.mockResolvedValue(10)
      mockWalletClient.writeContract
        .mockRejectedValueOnce(new Error("replacement transaction underpriced"))
        .mockResolvedValueOnce("0xTxHashRetry")
      mockPublicClient.getGasPrice.mockResolvedValue(BigInt(1000000))
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: "success",
      })

      const params = { address: "0xContract", functionName: "test" }
      const txHash = await (service as any).safeWriteContract(params)

      expect(txHash).toBe("0xTxHashRetry")
      expect(mockPublicClient.getGasPrice).toHaveBeenCalled()
      expect(mockWalletClient.writeContract).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          nonce: 10,
          gasPrice: BigInt(1200000), // 20% bump
        }),
      )
    })

    it("should throw error if transaction reverts on-chain", async () => {
      mockPublicClient.getTransactionCount.mockResolvedValue(10)
      mockWalletClient.writeContract.mockResolvedValue("0xTxHash")
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: "reverted",
      })

      const params = { address: "0xContract", functionName: "test" }
      await expect((service as any).safeWriteContract(params)).rejects.toThrow(
        "Transaction reverted on-chain",
      )
    })
  })

  describe("verifyCreateMarketPreDeposit", () => {
    it("should verify successfully if sent directly to Factory", async () => {
      const mockReceipt = { status: "success", to: "0xfactory" }
      const mockTx = { input: "0xDirectInput" }
      mockPublicClient.getTransactionReceipt.mockResolvedValue(mockReceipt)
      mockPublicClient.getTransaction.mockResolvedValue(mockTx)
      ;(decodeFunctionData as jest.Mock).mockReturnValue({
        functionName: "createMarketPreDeposit",
        args: [
          "0x60d0fe4f5311236168a109ca0000000000000000000000000000000000000000",
          BigInt(5000000),
        ],
      })

      const result = await service.verifyCreateMarketPreDeposit(
        "0xTxHash",
        "60d0fe4f5311236168a109ca",
      )
      expect(result).toEqual(BigInt(5000000))
    })

    it("should return null if transaction target is unknown", async () => {
      const mockReceipt = { status: "success", to: "0xUnknown" }
      const mockTx = { input: "0xDirectInput" }
      mockPublicClient.getTransactionReceipt.mockResolvedValue(mockReceipt)
      mockPublicClient.getTransaction.mockResolvedValue(mockTx)

      const result = await service.verifyCreateMarketPreDeposit(
        "0xTxHash",
        "60d0fe4f5311236168a109ca",
      )
      expect(result).toBeNull()
    })
  })

  describe("verifyDepositPreMarketLiquidity", () => {
    it("should verify successfully if sent directly to Factory", async () => {
      const mockReceipt = { status: "success", to: "0xfactory" }
      const mockTx = { input: "0xDirectInput" }
      mockPublicClient.getTransactionReceipt.mockResolvedValue(mockReceipt)
      mockPublicClient.getTransaction.mockResolvedValue(mockTx)
      ;(decodeFunctionData as jest.Mock).mockReturnValue({
        functionName: "depositPreMarketLiquidity",
        args: [
          "0x60d0fe4f5311236168a109ca0000000000000000000000000000000000000000",
          BigInt(10000000),
        ],
      })

      const result = await service.verifyDepositPreMarketLiquidity(
        "0xTxHash",
        "60d0fe4f5311236168a109ca",
      )
      expect(result).toEqual(BigInt(10000000))
    })
  })
})
