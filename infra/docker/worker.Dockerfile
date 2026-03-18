FROM node:22-trixie

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
  && /root/.local/bin/uv tool install -U openshell

