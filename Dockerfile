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
# Vendor + manifests first so `npm install` can resolve the local
# `file:./vendor/htmlstudio` dep without invalidating cache on every source change.
COPY frontend/package.json frontend/
COPY frontend/vendor/ frontend/vendor/
# Skip the host's package-lock.json — npm has a known optional-deps bug
# (https://github.com/npm/cli/issues/4828) where a Windows-generated lockfile
# omits Linux rollup binaries. Regenerating inside the container avoids it.
RUN cd frontend && npm install
COPY frontend/ frontend/
RUN cd frontend && npm run build

EXPOSE 6391

# Default port 6391 for local/docker-compose; Railway overrides via PORT env var
CMD ["sh", "-c", "exec agentsite serve --host 0.0.0.0 --port ${PORT:-6391}"]
