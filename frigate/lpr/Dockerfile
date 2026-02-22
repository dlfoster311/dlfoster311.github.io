FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir paho-mqtt requests

COPY lpr.py .

CMD ["python", "-u", "lpr.py"]
