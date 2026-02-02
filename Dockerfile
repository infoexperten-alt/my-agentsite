FROM python:3.12-slim

# Install Node.js for frontend build
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY pyproject.toml .
COPY agentsite/ agentsite/
RUN pip install --no-cache-dir .

# Build frontend
COPY frontend/package.json frontend/package-lock.json* frontend/
RUN cd frontend && npm install
COPY frontend/ frontend/
RUN cd frontend && npm run build

EXPOSE 6391

CMD ["agentsite", "serve", "--host", "0.0.0.0", "--port", "6391"]
