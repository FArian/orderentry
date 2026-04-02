[← API](../README.md) | [↑ Infrastructure](../../README.md)

---

# 📊 DTOs

Typed request/response contracts for all API endpoints.

## 📄 Files

- 📄 [ResultDto.ts](./ResultDto.ts) — `ListResultsQueryDto`, `ResultResponseDto`, `PagedResultsResponseDto`
- 📄 [OrderDto.ts](./OrderDto.ts) — `OrderResponseDto`, `ListOrdersResponseDto`, `DeleteOrderResponseDto`
- 📄 [PatientDto.ts](./PatientDto.ts) — `ListPatientsQueryDto`, `PatientResponseDto`, `PagedPatientsResponseDto`
- 📄 [EnvDto.ts](./EnvDto.ts) — `GetEnvResponseDto`, `UpdateEnvRequestDto`, `UpdateEnvResponseDto`
- 📄 [ConfigDto.ts](./ConfigDto.ts) — `GetConfigResponseDto`, `UpdateConfigRequestDto`, `ConfigEntryDto`, `ConfigSource`

## ⚙️ Rules

- Plain TypeScript interfaces — no classes, no decorators
- Request DTOs have all fields optional with documented defaults
- `httpStatus?: number` is internal — never exposed in OpenAPI response schemas

---

[⬆ Back to top](#)
