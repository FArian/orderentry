// Value object — immutable, equality by value, self-validating.

export class OrderNumber {
  private readonly _value: string;

  constructor(value: string) {
    const trimmed = (value ?? "").trim();
    if (!trimmed) throw new Error("OrderNumber cannot be empty");
    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: OrderNumber): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
