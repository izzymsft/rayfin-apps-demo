A Rayfin Application Demo

Install node version 22 or 24 Do not install the latest version (26) because it is not supported by the latest version of Rayfin

Use the [Node Version Manager](https://github.com/nvm-sh/nvm#intro) to install the specific Node.js version

```bash

$ nvm install 24
Now using node v24.14.0 (npm v11.9.0)
$ node -v
v24.14.0
$ nvm use 22
Now using node v22.22.1 (npm v10.9.4)
$ node -v
v22.22.1
$ nvm use 20
Now using node v20.20.1 (npm v10.8.2)

```

Check your current Node and Node Package Manager version

```bash

node --version

npm --version

```

Create a new Project for the Rayfin App


# Create a new Rayfin application

This is how to create the application from scratch using the TodoApp template

```bash

npm create @microsoft/rayfin@latest customer-order-demo -- --template todoapp

```

# Navigate to the project

```bash

cd customer-order-demo

```

# Install dependencies

```bash

npm install

```

# Verify the local Rayfin CLI (needs to be 1.36.2)

```bash

# Check the Rayfin version
npx rayfin --version

# Authenticate with Microsoft Fabric
# This is where we pick the workspace that is already linked to a Fabric capacity
npx rayfin login

# This is where we can use Copilot to build the app
# Use the instructions in RAYFIN-BUILDER-PROMPT.md to build the Customer & Order Management CRUD application using Microsoft Rayfin.

# Start development
npm run dev

```