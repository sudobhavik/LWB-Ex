# GUPTCHARA: Azure for Students Cloud Deployment Guide

A step-by-step walkthrough to deploy an **interactive, web-streamed Chromium browser** on Microsoft Azure using the **Azure for Students** plan ($100 free credits).

When someone opens the URL in any web browser, an interactive browser screen appears with:
* The **GUPTCHARA e-commerce privacy testbed** preloaded.
* The **GUPTCHARA extension** installed and active.
* **GPT-4o** pre-selected as the default reasoning LLM.
* Your **OpenAI API Key** pre-configured in instance storage.

---

## 1. Prerequisites & Azure Student Plan Entitlements

* **Active Azure for Students Account**:
  * Gives you **$100 in free credits** (valid for 12 months, no credit card required).
  * Gives you **750 hours/month free** of B-series Linux virtual machines.
* **OpenAI API Key**:
  * An OpenAI API key with access to `gpt-4o` (recommend setting a $5 usage limit for safety).

### Recommended Virtual Machine Size

| VM Size | vCPUs | RAM | Monthly Cost | Cost Impact on Student Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Standard_B2s** *(Recommended)* | 2 | 4 GiB | ~$30.37 / mo | Covered by $100 credit (~3+ months continuous, or pennies when deallocated) |
| **Standard_B2ats_v2** | 2 | 1 GiB | ~$0.00 / mo | Eligible for 750 free hours in select regions |
| **Standard_B4ms** *(Demo Day)* | 4 | 16 GiB | ~$120 / mo | Runs for ~600 hours on $100 credit; buttery 60 FPS performance |

---

## 2. Phase 1: Create the Azure Virtual Machine (Azure Portal)

1. Log into the [Azure Portal](https://portal.azure.com).
2. Search for **Virtual machines** in the top search bar and click **Create** > **Azure virtual machine**.
3. Under the **Basics** tab, fill in the following:
   * **Subscription**: `Azure for Students`
   * **Resource group**: Click *Create new* and enter `rg-guptchara`
   * **Virtual machine name**: `guptchara-demo-vm`
   * **Region**: Select a region close to you (e.g., `Central India`, `East US`, or `West Europe`)
   * **Image**: `Ubuntu Server 22.04 LTS - x64 Gen2`
   * **Size**: Click *See all sizes* and select **`Standard_B2s`** (2 vCPUs, 4 GiB memory).
   * **Authentication type**: Choose **Password** (or SSH public key if you prefer).
     * Set a Username (e.g., `azureuser`) and a secure password.
   * **Inbound port rules**: Allow `SSH (22)` and `HTTP (80)`.
4. Under the **Networking** tab:
   * Ensure **NIC network security group** is set to **Advanced** or **Basic**.
   * Under **Inbound ports**, we need to allow port `3000` (for the browser web desktop).
5. Click **Review + create**, verify details, and click **Create**.
6. Wait 1–2 minutes for the deployment to complete. Click **Go to resource** and copy your **Public IP address** (e.g., `20.198.xxx.xxx`).

### Add Inbound Port 3000 in Network Security Group (NSG)
If you did not add port 3000 during creation:
1. In your VM page, click **Networking** (or **Network settings**) in the left sidebar.
2. Click **Add inbound port rule**.
3. Set **Destination port ranges**: `3000`.
4. Set **Protocol**: `TCP`.
5. Set **Action**: `Allow`.
6. Set **Priority**: `1010`.
7. Set **Name**: `Allow_Chromium_Desktop_3000`.
8. Click **Add**.

---

## 3. Phase 2: Deploy GUPTCHARA on the VM (One Command)

Connect to your VM via SSH from your local terminal or Windows PowerShell:

```bash
ssh azureuser@<YOUR_VM_PUBLIC_IP>
```

Once logged in, run the following commands:

```bash
# 1. Update package list and clone repository
git clone https://github.com/sudobhavik/LWB-Ex.git
cd LWB-Ex

# 2. Run the automated deployment script
./scripts/prepare_azure_instance.sh
```

### What the Script Does Automatically:
1. Prompts you to enter your **OpenAI API Key** (hidden for privacy).
2. Generates `extension/config.json` with:
   ```json
   {
     "openaiKey": "sk-proj-...",
     "preferredProvider": "openai-gpt4o",
     "acceleration": "wasm"
   }
   ```
3. Checks for Docker and automatically installs Docker and Docker Compose if missing.
4. Starts the multi-container stack via `docker-compose.azure.yml`:
   * **`guptchara-demo-site`**: Internal Node.js server running the privacy demo testbed on port 8080.
   * **`guptchara-streamed-browser`**: LinuxServer Chromium container with KasmVNC web desktop on port 3000.
5. Launches Chromium maximized with the GUPTCHARA extension preloaded and the demo site opened.

---

## 4. Phase 3: Accessing and Interacting with the Demo

Open your web browser on any device (laptop, tablet, phone) and visit:

```text
http://<YOUR_VM_PUBLIC_IP>:3000
```

### Evaluator Experience:
1. The **Chromium web desktop** renders smoothly right inside the browser tab.
2. The browser is already open to the **GUPTCHARA e-commerce demo site**.
3. On the browser toolbar, the **GUPTCHARA extension** is loaded.
4. Click the GUPTCHARA extension icon or open the side panel:
   * **Reasoning Model**: Automatically set to **`GPT-4o`**.
   * **OpenAI API Key**: Pre-populated in storage and ready.
5. In the chat box, type an instruction (e.g., *"Find running shoes under ₹3000 and proceed to checkout"*), or click **Run All**.
6. Watch GUPTCHARA autonomously detect faces, redact sensitive text/PII on-device, and interact with the site live!

---

## 5. Phase 4: Free Public HTTPS Access via Cloudflare Tunnel

If you want to share the link with judges over **secure HTTPS** (without "Not Secure" HTTP warnings or opening port 3000 in the Azure firewall):

On the VM, simply run:

```bash
./scripts/start_tunnel.sh
```

This downloads Cloudflare Tunnel (`cloudflared`) and outputs a temporary secure HTTPS URL:

```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://guptchara-privacy-agent.trycloudflare.com                                         |
+--------------------------------------------------------------------------------------------+
```

You can share this HTTPS link with evaluators anywhere in the world.

---

## 6. Phase 5: Cost Management & Best Practices

To ensure your $100 student credit lasts throughout your entire semester:

1. **Stop the VM When Not in Use**:
   * When you are done demonstrating, go to the Azure Portal and click **Stop** (Deallocate).
   * While deallocated, compute charges are **$0.00/hour**. Only the 64 GB SSD disk storage is maintained (which is within Azure's free monthly allowance).
2. **Restart in 60 Seconds Before Presentation**:
   * Click **Start** in the Azure Portal.
   * The Docker containers will automatically start up with your pre-configured key!
3. **Monitor Balance in Education Hub**:
   * Search for **Education** in the Azure Portal to view your exact remaining credit balance and usage graphs.
