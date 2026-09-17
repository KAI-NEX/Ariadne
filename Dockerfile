FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 ARIADNE_CODEX_ENABLED=0 PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/ariadne
COPY deploy/requirements.txt deploy/requirements.txt
RUN pip install --no-cache-dir -r deploy/requirements.txt \
    && useradd --uid 10001 --create-home ariadne
COPY app.py web_app.py ./
COPY src/ src/
COPY data/ data/
COPY public/ public/
COPY deploy/downloads/ public/downloads/
COPY deploy/gunicorn.conf.py deploy/gunicorn.conf.py
USER ariadne
EXPOSE 8080
CMD ["gunicorn", "--config", "deploy/gunicorn.conf.py", "web_app:create_app()"]
