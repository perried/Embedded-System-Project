import requests
import logging
import config

# Set up logging for the transmitter
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataTransmitter:
    def __init__(self):
        self.url = config.INGEST_URL
        self.api_key = config.API_KEY
        self.site_id = config.SITE_ID
        self.headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }

    def send_data(self, temperature, humidity, gas_detected):
        """
        Sends sensor data to the backend API.
        Mapping gas_detected (boolean) to smoke (int/binary) for the API.
        """
        try:
            # Prepare payload according to backend documentation
            payload = {
                "siteId": self.site_id,
                "sensors": {
                    "temperature": temperature if temperature is not None else 0,
                    "humidity": humidity if humidity is not None else 0,
                    "smoke": 1 if gas_detected else 0
                }
            }

            logger.info(f"Sending data to backend: {payload}")
            response = requests.post(
                self.url,
                json=payload,
                headers=self.headers,
                timeout=10
            )

            if response.status_code == 200 or response.status_code == 201:
                logger.info("Data successfully sent to backend.")
                return True
            else:
                logger.error(f"Failed to send data. Status code: {response.status_code}, Response: {response.text}")
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"Error connecting to backend: {e}")
            return False
