/**
 * Jest global setup — runs once before every test file.
 *
 * Adds custom matchers from @testing-library/jest-dom so you can write:
 *   expect(element).toBeInTheDocument()
 *   expect(element).toHaveTextContent("Befunde")
 */
import "@testing-library/jest-dom";
