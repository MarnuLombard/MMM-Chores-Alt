import { vi } from "vitest"

const NodeHelper = {
  create: vi.fn((spec: unknown) => spec),
}

export default NodeHelper
