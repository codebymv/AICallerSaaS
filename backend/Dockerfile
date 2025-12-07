FROM node:20-alpine

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy workspace packages
COPY shared ./shared
COPY backend ./backend

# Install dependencies
RUN npm install

# Generate Prisma client
WORKDIR /app/backend
RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "dev"]
