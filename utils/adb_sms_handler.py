import subprocess
import re
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))
# from main import extract_from_sms
from helper_functions import extract_from_sms


def convert_to_json(row):
    try:
        # Define the pattern to match key-value pairs
        pattern = r"(\w+)=([^,]+)"
        matches = re.findall(pattern, row)

        if not matches:
            raise ValueError("No valid key-value pairs found in the input string.")

        # Convert matches into a dictionary
        data = {key: value.strip() for key, value in matches}
        return data

    except Exception as e:
        # Handle and log any errors
        return {}


# Function to run ADB command and get output
def run_adb_command(command):
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    # print(result)
    return result.stdout


def get_last_n_sms(address: str = "CBE", limit: int = 1000):
    # ADB command to get SMS messages from a specific phone number, sorted by date in ascending order

    command = f'adb shell content query --uri content://sms/inbox --projection "body" --where "address=\\\'{address}\\\'" --sort "-date\\ LIMIT\\ {limit}"'

    output = run_adb_command(command)

    parsed = map(convert_to_json, output.split("\n"))

    for s in parsed:
        r = extract_from_sms(s.get("body", ""))
        print(r)


if __name__ == "__main__":
    get_last_n_sms()
