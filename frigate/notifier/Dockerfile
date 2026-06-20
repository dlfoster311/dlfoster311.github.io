FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir paho-mqtt==1.6.1 requests==2.31.0
COPY notifier.py .
CMD ["python", "-u", "notifier.py"]
