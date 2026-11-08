A Rayfin Application Demo

Install node 26.13.0 or later and ensure npm is updated to version 12.2.1 or later

```bash

node --version

npm --version


npm install -g npm@12.2.1

```


Create a new Project for the Rayfin App


# Create a new Rayfin application
npm create @microsoft/rayfin@latest customer-order-demo -- --template todoapp

# Navigate to the project
cd customer-order-demo

# Install dependencies
npm install

# Verify the local Rayfin CLI (needs to be 1.36.2)
npx rayfin --version

# Authenticate with Microsoft Fabric
npx rayfin login

# This is where we can use Copilot to build the app
# Use the instructions in RAYFIN-BUILDER-PROMPT.md to build the Customer & Order Management CRUD application using Microsoft Rayfin.

# Start development
npm run dev

```