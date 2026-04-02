/**
 * Vitest global setup — runs before every test file.
 *
 * 1. Loads @testing-library/jest-dom custom matchers
 *    (toBeInTheDocument, toHaveTextContent, etc.)
 *
 * 2. Shims globalThis.jest = vi so that existing test files using
 *    jest.fn() / jest.spyOn() / jest.mock() continue to work without
 *    any source changes.  The vitest vi object is API-compatible with
 *    the jest object for all mocking operations used in this codebase.
 */
import "@testing-library/jest-dom";
import { vi } from "vitest";

Object.assign(globalThis, { jest: vi });
