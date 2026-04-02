# 🐳 OrderEntry Docker Setup

This directory contains all Docker-related configuration for the OrderEntry application.

---

## 🚀 Build Multi-Architecture Image

Build and push Docker image for both `amd64` and `arm64`:

```bash
./build.sh
```

Or manually:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t dein-username/orderentry:latest \
  -t dein-username/orderentry:1.0.0 \
  --push .
```

---

## ▶️ Run Container Locally

```bash
./run.sh
```

Application will be available at:

👉 http://localhost:3000

---

## ⚙️ Environment Variables

| Variable                  | Description               |
| ------------------------- | ------------------------- |
| FHIR_BASE_URL             | URL of FHIR server        |
| AUTH_SECRET               | Secret for authentication |
| SASIS_API_BASE            | Orchestra API endpoint    |
| NEXT_PUBLIC_SASIS_ENABLED | Enable SASIS integration  |
| GLN_API_BASE              | GLN API endpoint          |
| NEXT_PUBLIC_GLN_ENABLED   | Enable GLN lookup         |

---

## 📦 Volumes

| Path      | Description               |
| --------- | ------------------------- |
| /app/data | Persistent user/auth data |
| /app/logs | Application logs          |

---

## 🔐 Security Notes

* Do NOT include `.env` files in the image
* Use environment variables instead
* Ensure no HL7 or patient data is committed

---

## 🧠 Supported Architectures

* linux/amd64
* linux/arm64

---

## 🛠️ Requirements

* Docker
* Docker Buildx enabled

---

## 🚀 Production Recommendation

Use `docker-compose` for:

* FHIR server (HAPI)
* Orchestra integration
* Persistent volumes
* Network configuration

---
