FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir paho-mqtt requests

COPY species.py .

CMD ["python", "-u", "species.py"]
