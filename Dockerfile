FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY agentsite/ agentsite/
COPY frontend/ frontend/

RUN pip install --no-cache-dir .

EXPOSE 6391

CMD ["agentsite", "serve", "--host", "0.0.0.0", "--port", "6391"]
