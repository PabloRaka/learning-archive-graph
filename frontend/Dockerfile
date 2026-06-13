FROM node:20-slim

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy frontend source code
COPY . .

# Expose Vite development port
EXPOSE 5173

# Start Vite with --host flag to expose the port outside of the container
CMD ["npm", "run", "dev", "--", "--host"]
