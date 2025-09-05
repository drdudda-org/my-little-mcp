# Use Node.js 20 LTS as base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Expose port for HTTP transport (Smithery uses PORT=8081)
EXPOSE 8081

# Set default command to run with HTTP transport
CMD ["npm", "run", "start:http"]

