import json
import re
import sqlite3
from datetime import datetime
from io import BytesIO

import httpx
from pypdf import PdfReader


# import matplotlib.pyplot as plt
# import pandas as pd
# import seaborn as sns
# from reportlab.lib import colors
# from reportlab.lib.pagesizes import letter
# from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
# from reportlab.platypus import (
#     Image,
#     Paragraph,
#     SimpleDocTemplate,
#     Spacer,
#     Table,
#     TableStyle,
# )

with open('./category.json') as f:
    category = json.load(f)
    # usually people put same reason on transaction like 'mine' or something like that and want to manually categorize it
    # put the value like 'your-common-transaction-reason' : 'category' in the json file and it will automatically categorize it
    # if the reason is not in the json file it will just put the reason as the category
    # category => {'transaction reason' : 'category', ...} lower case it will be better

# Database setup
def setup_database():
    conn = sqlite3.connect('transactions.db')
    c = conn.cursor()
    
    # Create transactions table
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            transaction_amount REAL,
            current_balance REAL,
            total_amount REAL,
            reason TEXT,
            receiver TEXT,
            payer TEXT,
            direction TEXT,
            category TEXT
        )
    ''')
    conn.commit()
    return conn

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
            if key == 'reason':
                results[key] = results[key].split('done')[0].strip()
    return results

def extract_from_pdf(text):
    patterns = {
        'reason': r'Reason / T ype of service\s+(.*?)(?=\n)',
        'receiver': r'Receiver\s+(.*?)(?=\n)',
        'payer': r'Payer\s+(.*?)(?=\n)',
        'payment_datetime': r'Payment Date & Time\s+(.*?)(?=\n)'
    }
    return extract_info(text, patterns)

def extract_from_sms(text):
    # Pattern for outgoing transactions
    outgoing_patterns = {
        'transaction_amount': r'ETB([\d,]+\.\d{2})\s+\.Service',
        'current_balance': r'Current Balance is ETB\s*([\d,]+\.\d{2})',
        'transaction_link': r'(https://[^\s]+)',
        'total_amount': r'total of ETB([\d,]+)'
    }
    
    # Pattern for incoming transactions
    incoming_patterns = {
        'transaction_amount': r'Credited with ETB\s*([\d,]+\.\d{2})',
        'current_balance': r'Current Balance is ETB\s*([\d,]+\.\d{2})',
        'transaction_link': r'(https://[^\s]+)'
    }
    
    # Determine if this is an incoming or outgoing transaction
    is_incoming = 'Credited' in text
    
    # Use appropriate patterns based on transaction type
    patterns = incoming_patterns if is_incoming else outgoing_patterns
    results = extract_info(text, patterns)
    
    if not results.get('transaction_amount'):
        return None
        
    # For incoming transactions, set total_amount same as transaction_amount
    if is_incoming and 'transaction_amount' in results:
        results['total_amount'] = results['transaction_amount']
        
    transaction_link = results.get('transaction_link')
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

def process_messages(json_data):
    conn = setup_database()
    c = conn.cursor()
    
    for message in json_data:
        # Convert timestamp to datetime
        try:
            timestamp = int(message['date']) / 1000  # Convert milliseconds to seconds
            date = datetime.fromtimestamp(timestamp)
            
            # Skip messages before October 2024
            if date < datetime(2024, 10, 1):
                continue
                
            text = message['text']
            results = extract_from_sms(text)
            
            if results and results.get('transaction_amount'):
                # Clean and convert amount strings to floats
                transaction_amount = float(results['transaction_amount'].replace(',', ''))
                current_balance = float(results['current_balance'].replace(',', ''))
                total_amount = float(results['total_amount'].replace(',', ''))
                
                # Determine transaction direction
                direction = 'incoming' if 'Credited' in text else 'outgoing'
                
                # Get the reason category
                reason = results.get('reason', '')
                reason_category = category.get(reason.lower(), reason.lower())
                
                c.execute('''
                    INSERT INTO transactions 
                    (date, transaction_amount, current_balance, total_amount, reason, 
                    receiver, payer, direction, category)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    date.strftime('%Y-%m-%d %H:%M:%S'),
                    transaction_amount,
                    current_balance,
                    total_amount,
                    reason,
                    results.get('receiver', ''),
                    results.get('payer', ''),
                    direction,
                    reason_category
                ))
                
                if direction == 'incoming':
                    print(f"Incoming transaction of {transaction_amount} ETB received from {results.get('payer', 'Unknown')}")
                else:
                    print(f"Outgoing transaction of {transaction_amount} ETB to {results.get('receiver', 'Unknown')}")
        except Exception as e:
            print(f"Error processing message: {e}")

    
    conn.commit()
    conn.close()

# def generate_analysis():
#     conn = sqlite3.connect('transactions.db')
    
#     # Monthly expenses analysis
#     monthly_df = pd.read_sql_query('''
#         SELECT 
#             strftime('%Y-%m', date) as month,
#             SUM(CASE WHEN direction = 'outgoing' THEN transaction_amount ELSE 0 END) as expenses,
#             SUM(CASE WHEN direction = 'incoming' THEN transaction_amount ELSE 0 END) as income
#         FROM transactions 
#         GROUP BY strftime('%Y-%m', date)
#         ORDER BY month
#     ''', conn)
    
#     # Top 5 receivers
#     top_receivers_df = pd.read_sql_query('''
#         SELECT receiver, SUM(transaction_amount) as total_amount, COUNT(*) as transaction_count
#         FROM transactions
#         WHERE direction = 'outgoing' AND receiver IS NOT NULL
#         GROUP BY receiver
#         ORDER BY total_amount DESC
#         LIMIT 5
#     ''', conn)
    
#     # Common reasons
#     common_reasons_df = pd.read_sql_query('''
#         SELECT reason, COUNT(*) as count
#         FROM transactions
#         WHERE reason IS NOT NULL
#         GROUP BY reason
#         ORDER BY count DESC
#         LIMIT 5
#     ''', conn)
    
#     conn.close()
    
#     # Set the visual style
#     sns.set_theme(style="whitegrid")
    
#     # Monthly expenses/income plot - with smaller figure size
#     plt.figure(figsize=(8, 4))  # Reduced from (12, 6)
#     ax = plt.gca()
    
#     x = range(len(monthly_df))
#     width = 0.35
    
#     plt.bar([i - width/2 for i in x], monthly_df['expenses'], width, label='Expenses', color='#ff9999')
#     plt.bar([i + width/2 for i in x], monthly_df['income'], width, label='Income', color='#66b3ff')
    
#     plt.title('Monthly Expenses and Income', fontsize=12, pad=15)
#     plt.xlabel('Month', fontsize=10)
#     plt.ylabel('Amount (ETB)', fontsize=10)
#     plt.xticks(x, monthly_df['month'], rotation=45, fontsize=8)
#     plt.legend(fontsize=8)
    
#     plt.tight_layout()
#     monthly_plot_path = 'monthly_analysis.png'
#     plt.savefig(monthly_plot_path, dpi=200, bbox_inches='tight')
#     plt.close()
    
#     # Top receivers pie chart - with smaller figure size
#     plt.figure(figsize=(6, 6))  # Reduced from (10, 8)
#     colors = ['#ff9999', '#66b3ff', '#99ff99', '#ffcc99', '#ff99cc']
    
#     plt.pie(top_receivers_df['total_amount'], 
#             labels=top_receivers_df['receiver'], 
#             colors=colors,
#             autopct='%1.1f%%',
#             pctdistance=0.85,
#             startangle=90)
    
#     plt.title('Top 5 Recipients by Amount', fontsize=12, pad=15)
#     centre_circle = plt.Circle((0,0), 0.70, fc='white')
#     fig = plt.gcf()
#     fig.gca().add_artist(centre_circle)
#     plt.axis('equal')
    
#     receivers_plot_path = 'top_receivers.png'
#     plt.savefig(receivers_plot_path, dpi=200, bbox_inches='tight')
#     plt.close()
    
#     return monthly_df, top_receivers_df, common_reasons_df, monthly_plot_path, receivers_plot_path


# def generate_pdf_report(monthly_df, top_receivers_df, common_reasons_df, monthly_plot_path, receivers_plot_path):
#     doc = SimpleDocTemplate(
#         "transaction_analysis_report.pdf",
#         pagesize=letter,
#         rightMargin=72,
#         leftMargin=72,
#         topMargin=72,
#         bottomMargin=72
#     )
    
#     # Calculate usable width
#     page_width = letter[0] - doc.rightMargin - doc.leftMargin
#     max_width = page_width * 0.8  # Use 80% of page width for safety
    
#     styles = getSampleStyleSheet()
#     story = []
    
#     def add_image_safely(image_path, max_width, max_height=None):
#         """Helper function to add images with size constraints"""
#         img = Image(image_path)
#         aspect = img.imageHeight / float(img.imageWidth)
        
#         if max_height is None:
#             max_height = max_width * aspect
        
#         # Scale down if necessary while maintaining aspect ratio
#         if img.imageWidth > max_width or img.imageHeight > max_height:
#             if max_width/img.imageWidth < max_height/img.imageHeight:
#                 img.drawWidth = max_width
#                 img.drawHeight = max_width * aspect
#             else:
#                 img.drawHeight = max_height
#                 img.drawWidth = max_height / aspect
        
#         return img
    
#     # Title
#     title_style = ParagraphStyle(
#         'CustomTitle',
#         parent=styles['Heading1'],
#         fontSize=20,  # Reduced from 24
#         spaceAfter=20,
#         alignment=1
#     )
#     story.append(Paragraph("Transaction Analysis Report", title_style))
#     story.append(Spacer(1, 15))
    
#     # Monthly Analysis
#     story.append(Paragraph("Monthly Expenses and Income", styles['Heading2']))
#     story.append(Spacer(1, 10))
    
#     # Add monthly analysis plot with size constraints
#     monthly_img = add_image_safely(monthly_plot_path, max_width, max_height=200)
#     story.append(monthly_img)
#     story.append(Spacer(1, 15))
    
#     # Monthly data table
#     monthly_data = [['Month', 'Expenses (ETB)', 'Income (ETB)']]
#     for _, row in monthly_df.iterrows():
#         monthly_data.append([
#             row['month'],
#             f"{row['expenses']:,.2f}",
#             f"{row['income']:,.2f}"
#         ])
    
#     col_widths = [max_width/3] * 3
#     t = Table(monthly_data, colWidths=col_widths)
#     t.setStyle(TableStyle([
#         ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
#         ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
#         ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
#         ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#         ('FONTSIZE', (0, 0), (-1, 0), 10),
#         ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
#         ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
#         ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
#         ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
#         ('FONTSIZE', (0, 1), (-1, -1), 8),
#         ('GRID', (0, 0), (-1, -1), 1, colors.black),
#         ('TOPPADDING', (0, 0), (-1, -1), 4),
#         ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
#     ]))
#     story.append(t)
#     story.append(Spacer(1, 20))
    
#     # Top Recipients
#     story.append(Paragraph("Top 5 Recipients", styles['Heading2']))
#     story.append(Spacer(1, 10))
    
#     # Add recipients plot with size constraints
#     recipients_img = add_image_safely(receivers_plot_path, max_width, max_height=200)
#     story.append(recipients_img)
#     story.append(Spacer(1, 15))
    
#     # Recipients table
#     recipients_data = [['Recipient', 'Total Amount (ETB)', 'Transaction Count']]
#     for _, row in top_receivers_df.iterrows():
#         recipients_data.append([
#             row['receiver'],
#             f"{row['total_amount']:,.2f}",
#             str(row['transaction_count'])
#         ])
    
#     t = Table(recipients_data, colWidths=col_widths)
#     t.setStyle(TableStyle([
#         ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
#         ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
#         ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
#         ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#         ('FONTSIZE', (0, 0), (-1, 0), 10),
#         ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
#         ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
#         ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
#         ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
#         ('FONTSIZE', (0, 1), (-1, -1), 8),
#         ('GRID', (0, 0), (-1, -1), 1, colors.black),
#         ('TOPPADDING', (0, 0), (-1, -1), 4),
#         ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
#     ]))
#     story.append(t)
    
#     # Common Reasons
#     story.append(Spacer(1, 20))
#     story.append(Paragraph("Most Common Transaction Reasons", styles['Heading2']))
#     story.append(Spacer(1, 10))
    
#     reasons_data = [['Reason', 'Count']]
#     for _, row in common_reasons_df.iterrows():
#         reasons_data.append([row['reason'], str(row['count'])])
    
#     t = Table(reasons_data, colWidths=[max_width*0.7, max_width*0.3])
#     t.setStyle(TableStyle([
#         ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
#         ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
#         ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
#         ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#         ('FONTSIZE', (0, 0), (-1, 0), 10),
#         ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
#         ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
#         ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
#         ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
#         ('FONTSIZE', (0, 1), (-1, -1), 8),
#         ('GRID', (0, 0), (-1, -1), 1, colors.black),
#         ('TOPPADDING', (0, 0), (-1, -1), 4),
#         ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
#     ]))
#     story.append(t)
    
#     try:
#         doc.build(story)
#         print("PDF report generated successfully!")
#     except Exception as e:
#         print(f"Error generating PDF: {e}")
#     finally:
#         # Clean up temporary image files
#         for file in [monthly_plot_path, receivers_plot_path]:
#             if os.path.exists(file):
#                 os.remove(file)

def main():
    # Read JSON data
    with open('./sms-file.json') as f:
        data = json.load(f)
    
    # Process messages and store in database
    process_messages(data)
    
    # Make sure to install below for the below code to work 
    # ```python
    # pip install pandas matplotlib seaborn reportlab
    # ```
    # Generate analysis and plots
    # monthly_df, top_receivers_df, common_reasons_df, monthly_plot_path, receivers_plot_path = generate_analysis()
    # print(f"Monthly expenses and income:\n{monthly_df}")
    # print(f"Top receivers:\n{top_receivers_df}")
    
    # # Generate PDF report
    # generate_pdf_report(monthly_df, top_receivers_df, common_reasons_df, monthly_plot_path, receivers_plot_path)
    
    print("Analysis complete! Check transaction_analysis_report.pdf for the detailed report.")

if __name__ == "__main__":
    main()