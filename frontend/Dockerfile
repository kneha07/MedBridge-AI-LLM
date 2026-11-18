FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
# The browser calls the backend on the host's published port 8000 (see src/api.js).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
