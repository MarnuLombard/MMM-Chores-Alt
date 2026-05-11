import { describe, it, expect } from "vitest"
import { ChoresRepository } from "../../../src/backend/repository"

describe("ChoresRepository", () => {
  it("isOpen() is true after construction (R8)", () => {
    const repo = new ChoresRepository(":memory:")
    expect(repo.isOpen()).toBe(true)
    repo.close()
  })

  it("insertCompletion returns true on insert, false on duplicate", () => {
    const repo = new ChoresRepository(":memory:")
    expect(repo.insertCompletion("2026-05-09", "alice", "bed")).toBe(true)
    expect(repo.insertCompletion("2026-05-09", "alice", "bed")).toBe(false)
    repo.close()
  })

  it("deleteCompletion removes a row", () => {
    const repo = new ChoresRepository(":memory:")
    repo.insertCompletion("2026-05-09", "alice", "bed")
    repo.deleteCompletion("2026-05-09", "alice", "bed")
    expect(repo.getCompletionsForDay("2026-05-09", "alice")).toEqual([])
    repo.close()
  })

  it("getCompletionsForDay returns list of chore ids", () => {
    const repo = new ChoresRepository(":memory:")
    repo.insertCompletion("2026-05-09", "alice", "bed")
    repo.insertCompletion("2026-05-09", "alice", "teeth")
    expect(repo.getCompletionsForDay("2026-05-09", "alice").sort()).toEqual(["bed", "teeth"])
    repo.close()
  })

  it("getAllCompletions aggregates counts by child+chore", () => {
    const repo = new ChoresRepository(":memory:")
    repo.insertCompletion("2026-05-09", "alice", "bed")
    repo.insertCompletion("2026-05-10", "alice", "bed")
    repo.insertCompletion("2026-05-09", "alice", "teeth")
    const all = repo.getAllCompletions()
    expect(all).toContainEqual({ childId: "alice", choreId: "bed", count: 2 })
    expect(all).toContainEqual({ childId: "alice", choreId: "teeth", count: 1 })
    repo.close()
  })

  it("redemption round-trip", () => {
    const repo = new ChoresRepository(":memory:")
    repo.insertRedemption("alice", 5, "2026-05-09T12:00:00.000Z")
    repo.insertRedemption("alice", 3, "2026-05-10T12:00:00.000Z")
    expect(repo.getRedeemedTotal("alice")).toBe(8)
    expect(repo.getRedeemedTotal("bob")).toBe(0)
    repo.close()
  })

  it("isOpen() returns false after close()", () => {
    const repo = new ChoresRepository(":memory:")
    repo.close()
    expect(repo.isOpen()).toBe(false)
  })
})
