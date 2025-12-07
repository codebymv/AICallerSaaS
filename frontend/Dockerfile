FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy workspace packages
COPY shared ./shared
COPY frontend ./frontend

# Install dependencies
RUN npm install

WORKDIR /app/frontend

EXPOSE 3000

CMD ["npm", "run", "dev"]
