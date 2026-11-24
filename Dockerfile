# PropScout on one server: the built site and every /api/* route, served by
# dev_server.py, with vercel.json's daily jobs on the server's own clock.
# Render's free web service builds this (render.yaml); any host that runs a
# container can too. Settings (keys) come from the host's environment, never
# from this image (.dockerignore leaves every .env out).

# The site: Vite's production build.
FROM node:22-slim AS site
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# The server: Python and the back end.
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PROPSCOUT_CRONS=1
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY . .
COPY --from=site /app/dist ./dist
EXPOSE 10000
CMD ["sh", "-c", "exec python dev_server.py ${PORT:-10000}"]
