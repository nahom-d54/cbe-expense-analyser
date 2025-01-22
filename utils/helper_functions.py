import re
from pypdf import PdfReader
import httpx
from io import BytesIO


# Helper functions from your existing code
def get_file(transaction_link):
    try:
        r = httpx.get(transaction_link, verify=False)
        return BytesIO(r.content)
    except Exception as e:
        print(f"Error fetching PDF: {e}")
        return None


def extract_info(text, patterns):
    results = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text)
        if match:
            results[key] = match.group(1).strip()
            if key == "reason":
                results[key] = results[key].split("done")[0].strip()
    return results


def extract_from_pdf(text):
    patterns = {
        "reason": r"Reason / T ype of service\s+(.*?)(?=\n)",
        "receiver": r"Receiver\s+(.*?)(?=\n)",
        "payer": r"Payer\s+(.*?)(?=\n)",
        "payment_datetime": r"Payment Date & Time\s+(.*?)(?=\n)",
    }
    return extract_info(text, patterns)


def extract_from_sms(text):
    # Pattern for outgoing transactions
    outgoing_patterns = {
        "transaction_amount": r"ETB([\d,]+\.\d{2})\s+\.Service",
        "current_balance": r"Current Balance is ETB\s*([\d,]+\.\d{2})",
        "transaction_link": r"(https://[^\s]+)",
        "total_amount": r"total of ETB([\d,]+)",
    }

    # Pattern for incoming transactions
    incoming_patterns = {
        "transaction_amount": r"Credited with ETB\s*([\d,]+\.\d{2})",
        "current_balance": r"Current Balance is ETB\s*([\d,]+\.\d{2})",
        "transaction_link": r"(https://[^\s]+)",
    }

    # Determine if this is an incoming or outgoing transaction
    is_incoming = "Credited" in text

    # Use appropriate patterns based on transaction type
    patterns = incoming_patterns if is_incoming else outgoing_patterns
    results = extract_info(text, patterns)

    if not results.get("transaction_amount"):
        return None

    # For incoming transactions, set total_amount same as transaction_amount
    if is_incoming and "transaction_amount" in results:
        results["total_amount"] = results["transaction_amount"]

    transaction_link = results.get("transaction_link")
    if transaction_link:
        file = get_file(transaction_link)
        if file:
            try:
                reader = PdfReader(file)
                page = reader.pages[0]
                text = page.extract_text()
                pdf_results = extract_from_pdf(text)
                results.update(pdf_results)
            except Exception as e:
                print(f"Error reading PDF: {e}")

    return results
