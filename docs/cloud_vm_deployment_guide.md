# GUPTCHARA: Universal Cloud VM Deployment Guide

Deploy an interactive, web-streamed Chromium browser on **any Cloud Virtual Machine** (Azure, AWS EC2, Google Cloud Platform, DigitalOcean, Hetzner, or generic Ubuntu VPS).

Evaluators, hackathon judges, and remote users can interact with GUPTCHARA live inside their browser with **zero local installation**.

---

## 1. Cloud Provider VM Sizing & Recommended Specs

- **OS**: Ubuntu Server 22.04 LTS (x64) or 24.04 LTS
- **CPU**: 2 vCPUs minimum (4 vCPUs recommended for buttery 60 FPS)
- **RAM**: 4 GiB minimum (8 GiB recommended for 2 simultaneous evaluator slots)
- **Disk**: 30 GiB+ SSD

| Provider | Recommended Instance | Cost / Hour | Free Tier / Credits |
| :--- | :--- | :--- | :--- |
| **Microsoft Azure** *(Top Pick)* | `Standard_B2s` (2 vCPU, 4 GiB) | ~$0.0416/hr | **100% Free** with $100 Student Credits |
| **Microsoft Azure (Demo Day)**| `Standard_B4ms` (4 vCPU, 16 GiB) | ~$0.166/hr | Ultra-smooth 60 FPS for presentations |
| **AWS EC2** | `t3.medium` (2 vCPU, 4 GiB) | ~$0.0416/hr | AWS Free Tier eligible |
| **Google Cloud (GCP)** | `e2-medium` (2 vCPU, 4 GiB) | ~$0.0335/hr | Covered by $300 Free Trial |
| **DigitalOcean / Hetzner** | Basic Droplet / CX22 (2 vCPU, 4 GiB)| ~$12–24/mo flat | Low predictable pricing |

> [!TIP]
> **Cost Management**: Always **Stop / Deallocate** the VM in your cloud console when not presenting or testing. Deallocated VMs charge **$0.00/hour** for compute!

---

## 2. Inbound Firewall / Security Group Ports

Before or after creating your VM, ensure the following inbound TCP ports are allowed:

| Port | Protocol | Purpose |
| :--- | :--- | :--- |
| **22** | TCP | SSH Server Administration |
| **80** | TCP | HTTP / Let's Encrypt SSL Validation |
| **443** | TCP | Slot 1 HTTPS Streamed Web Desktop |
| **8443** | TCP | Slot 2 HTTPS Streamed Web Desktop |
| **3000** | TCP | Slot 1 Direct Web Desktop (HTTP) |
| **3002** | TCP | Slot 2 Direct Web Desktop (HTTP) |

---

## 3. One-Command Deployment

### Step 1: SSH into Your Cloud VM
From your local terminal, Windows PowerShell, or Mac Terminal:

```bash
ssh <USERNAME>@<YOUR_VM_PUBLIC_IP>
```
*(Example: `ssh azureuser@20.198.54.120` or `ssh ubuntu@54.210.12.34`)*

### Step 2: Clone & Deploy
Run these commands on the VM:

```bash
git clone https://github.com/sudobhavik/LWB-Ex.git
cd LWB-Ex
./scripts/prepare_cloud_vm.sh
```

**What the script does automatically:**
1. Prompts for your **OpenAI API Key** (sanitizes bracketed paste codes and stores securely in `extension/config.json`).
2. Checks for **Docker & Docker Compose**; installs them automatically if missing.
3. Automatically detects your cloud public IP or Azure FQDN domain.
4. Clears stale Chromium locks and previous test caches.
5. Launches the multi-container Docker stack:
   - **`guptchara-demo-site`**: Internal privacy testbed server (:8080).
   - **`guptchara-streamed-browser`**: Primary evaluator slot (:3000).
   - **`guptchara-streamed-browser-2`**: Secondary evaluator slot (:3002).
   - **`caddy`**: Reverse proxy handling automatic SSL on ports 443 & 8443.
6. Runs health checks and prints active access links.

---

## 4. Evaluator Access Modes

### Method 1: Instant Free HTTPS via Cloudflare Tunnel (Best for Presentations)
If you want a trusted SSL link without configuring domain names or firewall rules:

```bash
./scripts/start_tunnel.sh
```

- Downloads `cloudflared` automatically.
- Generates a public HTTPS link: `https://<random-subdomain>.trycloudflare.com`.
- Give this link to judges or evaluators. Anyone can open it on their phone, laptop, or tablet.

### Method 2: Direct Public IP Streaming
Open directly in any web browser:
- **Slot 1 (Evaluator 1)**: `http://<YOUR_VM_PUBLIC_IP>:3000`
- **Slot 2 (Evaluator 2)**: `http://<YOUR_VM_PUBLIC_IP>:3002`

### Method 3: Domain / Azure DNS with SSL Padlock
If you assigned a DNS name (e.g. `guptchara-demo.centralindia.cloudapp.azure.com`):
- **Slot 1 (Evaluator 1)**: `https://<YOUR_DOMAIN>`
- **Slot 2 (Evaluator 2)**: `https://<YOUR_DOMAIN>:8443`

---

## 5. Maintenance & Management Commands

| Task | Command |
| :--- | :--- |
| **Check System Status & Ports** | `./scripts/check_status.sh` |
| **Reset Evaluator Carts & Sessions** | `./scripts/reset_demo_session.sh` |
| **Update OpenAI API Key** | `./scripts/set_openai_key.sh` |
| **View Live Container Logs** | `sudo docker compose -f docker-compose.azure.yml logs -f` |
| **Restart Stack** | `sudo docker compose -f docker-compose.azure.yml restart` |
| **Stop Stack** | `sudo docker compose -f docker-compose.azure.yml stop` |
