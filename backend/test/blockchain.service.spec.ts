import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../src/modules/blockchain/blockchain.service';
import { decodeFunctionData } from 'viem';

jest.mock('viem', () => {
  const actual = jest.requireActual('viem');
  return {
    ...actual,
    decodeFunctionData: jest.fn(),
  };
});

describe('BlockchainService', () => {
  let service: BlockchainService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'ARC_RPC_URL') return 'https://mock.rpc';
        if (key === 'FPMM_ADDRESS') return '0xFPMM';
        if (key === 'FACTORY_ADDRESS') return '0xFactory';
        if (key === 'USDC_ADDRESS') return '0xUSDC';
        if (key === 'CONDITIONAL_TOKEN_VAULT_ADDRESS') return '0xVault';
        if (key === 'ROUTER_ADDRESS') return '0xRouter';
        if (key === 'ADMIN_PRIVATE_KEY' || key === 'KEEPER_PRIVATE_KEY') {
          return '0x9c1a9662dcbaea6235d9d7078af6799a9974d64a62fa307c6c70015a27a74611';
        }
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BlockchainService>(BlockchainService);
    configService = module.get(ConfigService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('formatMarketId', () => {
    it('should format Mongo ID string into bytes32 padded hex string', () => {
      const id = '60d0fe4f5311236168a109ca';
      const formatted = (service as any).formatMarketId(id);
      expect(formatted).toBe(
        '0x60d0fe4f5311236168a109ca0000000000000000000000000000000000000000',
      );
    });
  });

  describe('getTransactionReceipt', () => {
    it('should return the transaction receipt', async () => {
      const mockReceipt = { blockNumber: 123, status: 'success' };
      (service as any).publicClient = {
        waitForTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
      };

      const result = await service.getTransactionReceipt('0xTxHash');
      expect(result).toEqual(mockReceipt);
      expect(
        (service as any).publicClient.waitForTransactionReceipt,
      ).toHaveBeenCalledWith({
        hash: '0xTxHash',
      });
    });
  });

  describe('readOnChainMarketState', () => {
    it('should query publicClient readContract and return results', async () => {
      const mockResult = [true, false, BigInt(100)];
      (service as any).publicClient = {
        readContract: jest.fn().mockResolvedValue(mockResult),
      };

      const result = await service.readOnChainMarketState(
        '60d0fe4f5311236168a109ca',
      );
      expect(result.resolved).toBe(true);
      expect(result.winningIsYes).toBe(false);
      expect(result.totalCollateral).toBe(BigInt(100));
    });
  });

  describe('verifyCreateMarketPreDeposit', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should verify successfully if sent directly to Factory', async () => {
      const mockReceipt = { status: 'success', to: '0xfactory' };
      const mockTx = { input: '0xDirectInput' };
      (service as any).publicClient = {
        getTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
        getTransaction: jest.fn().mockResolvedValue(mockTx),
      };

      (decodeFunctionData as jest.Mock).mockReturnValue({
        functionName: 'createMarketPreDeposit',
        args: [
          '0x60d0fe4f5311236168a109ca0000000000000000000000000000000000000000',
          BigInt(5000000),
        ],
      });

      const result = await service.verifyCreateMarketPreDeposit(
        '0xTxHash',
        '60d0fe4f5311236168a109ca',
      );
      expect(result).toEqual(BigInt(5000000));
    });

    it('should verify successfully if sent through Router', async () => {
      const mockReceipt = { status: 'success', to: '0xrouter' };
      const mockTx = { input: '0xRouterInput' };
      (service as any).publicClient = {
        getTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
        getTransaction: jest.fn().mockResolvedValue(mockTx),
      };

      (decodeFunctionData as jest.Mock).mockReturnValue({
        functionName: 'createMarketPreDeposit',
        args: [
          '0xfactory',
          '0x60d0fe4f5311236168a109ca0000000000000000000000000000000000000000',
          BigInt(5000000),
        ],
      });

      const result = await service.verifyCreateMarketPreDeposit(
        '0xTxHash',
        '60d0fe4f5311236168a109ca',
      );
      expect(result).toEqual(BigInt(5000000));
    });

    it('should return null if transaction target is unknown', async () => {
      const mockReceipt = { status: 'success', to: '0xUnknown' };
      (service as any).publicClient = {
        getTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
      };

      const result = await service.verifyCreateMarketPreDeposit(
        '0xTxHash',
        '60d0fe4f5311236168a109ca',
      );
      expect(result).toBeNull();
    });
  });

  describe('verifyDepositPreMarketLiquidity', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should verify successfully if sent directly to Factory', async () => {
      const mockReceipt = { status: 'success', to: '0xfactory' };
      const mockTx = { input: '0xDirectInput' };
      (service as any).publicClient = {
        getTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
        getTransaction: jest.fn().mockResolvedValue(mockTx),
      };

      (decodeFunctionData as jest.Mock).mockReturnValue({
        functionName: 'depositPreMarketLiquidity',
        args: [
          '0x60d0fe4f5311236168a109ca0000000000000000000000000000000000000000',
          BigInt(10000000),
        ],
      });

      const result = await service.verifyDepositPreMarketLiquidity(
        '0xTxHash',
        '60d0fe4f5311236168a109ca',
      );
      expect(result).toEqual(BigInt(10000000));
    });

    it('should verify successfully if sent through Router', async () => {
      const mockReceipt = { status: 'success', to: '0xrouter' };
      const mockTx = { input: '0xRouterInput' };
      (service as any).publicClient = {
        getTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
        getTransaction: jest.fn().mockResolvedValue(mockTx),
      };

      (decodeFunctionData as jest.Mock).mockReturnValue({
        functionName: 'depositPreMarketLiquidity',
        args: [
          '0xfactory',
          '0x60d0fe4f5311236168a109ca0000000000000000000000000000000000000000',
          BigInt(10000000),
        ],
      });

      const result = await service.verifyDepositPreMarketLiquidity(
        '0xTxHash',
        '60d0fe4f5311236168a109ca',
      );
      expect(result).toEqual(BigInt(10000000));
    });
  });
});
