import { linearForecast } from "./forecast";

describe("linearForecast", () => {
  it("returns an empty array when no periods are requested", () => {
    expect(linearForecast([1, 2, 3], 0)).toEqual([]);
  });

  it("fills with 0 when there is no data", () => {
    expect(linearForecast([], 3)).toEqual([0, 0, 0]);
  });

  it("repeats the single data point when there are fewer than 2 samples", () => {
    expect(linearForecast([5], 3)).toEqual([5, 5, 5]);
  });

  it("extrapolates an upward linear trend", () => {
    // y = x + 1 -> next two values are 5 and 6
    const result = linearForecast([1, 2, 3, 4], 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(5, 10);
    expect(result[1]).toBeCloseTo(6, 10);
  });

  it("extrapolates a downward linear trend", () => {
    // y = -2x + 12 -> next two values are 2 and 0
    const result = linearForecast([10, 8, 6, 4], 2);
    expect(result[0]).toBeCloseTo(2, 10);
    expect(result[1]).toBeCloseTo(0, 10);
  });

  it("returns the constant value for flat data", () => {
    expect(linearForecast([3, 3, 3], 3)).toEqual([3, 3, 3]);
  });

  it("produces a forecast for every requested period", () => {
    const result = linearForecast([2, 4, 6, 8, 10], 7);
    expect(result).toHaveLength(7);
    // Perfect line y = 2x: continues at 12, 14, ...
    result.forEach((value, i) => expect(value).toBeCloseTo(12 + 2 * i, 10));
  });

  it("handles non-contiguous historical values by fitting a least-squares line", () => {
    const result = linearForecast([0, 100], 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(200, 10);
  });
});
