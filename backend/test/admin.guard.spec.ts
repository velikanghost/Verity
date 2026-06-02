import { Test, TestingModule } from "@nestjs/testing"
import { ExecutionContext, ForbiddenException } from "@nestjs/common"
import { getModelToken } from "@nestjs/mongoose"
import { AdminGuard } from "../src/common/guards/admin.guard"
import { User } from "../src/modules/users/users.model"

describe("AdminGuard", () => {
  let guard: AdminGuard
  let mockUserModel: any

  beforeEach(async () => {
    mockUserModel = {
      findById: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile()

    guard = module.get<AdminGuard>(AdminGuard)
  })

  const createMockExecutionContext = (userPayload: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userPayload,
        }),
      }),
    } as any
  }

  it("should return false if there is no user in the request", async () => {
    const context = createMockExecutionContext(null)
    const result = await guard.canActivate(context)
    expect(result).toBe(false)
  })

  it("should throw ForbiddenException if user role is not admin", async () => {
    mockUserModel.findById.mockResolvedValue({ role: "user" })
    const context = createMockExecutionContext({ id: "user-id" })

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
  })

  it("should return true if user role is admin", async () => {
    mockUserModel.findById.mockResolvedValue({ role: "admin" })
    const context = createMockExecutionContext({ id: "admin-id" })

    const result = await guard.canActivate(context)
    expect(result).toBe(true)
  })
})
