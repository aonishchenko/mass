# Published to ghcr.io so Railway can pull it as a public image.
#
# Railway's GitHub-source path needs its GitHub App linked to the Railway
# account; the image path needs nothing but a public registry, which is one
# less moving part during a hackathon.

FROM node:20-slim

WORKDIR /app

COPY package.json ./
# The SDK peer-depends on ethers 6.13.1 exactly — package.json pins it.
RUN npm install --omit=dev

COPY index.mjs ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.mjs"]
