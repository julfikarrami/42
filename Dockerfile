FROM node:18
RUN apt-get update && apt-get install -y chromium
WORKDIR /app
COPY . .
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN npm install
CMD ["node","index.js"]
