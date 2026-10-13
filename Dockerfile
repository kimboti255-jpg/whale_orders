FROM node:18-slim

# 1. Weka saraka ya kazi
WORKDIR /app

# 2. Nakili mafaili ya utegemezi na usakinishe
COPY package*.json ./
RUN npm install

# 3. Nakili msimbo wote uliobaki
COPY . .

# 4. Weka bandari inayohitajika na wingu
EXPOSE 7860

# 5. Anzisha Node.js moja kwa moja bila Apache kusimama katikati
CMD ["node", "index.js"]
