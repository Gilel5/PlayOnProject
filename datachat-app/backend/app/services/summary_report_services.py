from openai import OpenAI
from sqlalchemy import text

from app.db.finance_session import finance_engine

# Summary report generation -> Excel workbook with three sheets
def generate_summary_reports() -> bytes:
    """
    Run three analytical queries and build an Excel workbook with three sheets:
      Sheet 1 — Revenue Breakdown
      Sheet 2 — Processor Transaction Pivot
      Sheet 3 — New Purchase by Day
    Returns the workbook as raw bytes (xlsx).
    """
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, numbers, PatternFill, Border, Side

    with finance_engine.connect() as conn:

        # ---- Queries (same SQL as before) ----

        revenue_by_type = conn.execute(text(f"""
            SELECT
                processor_transaction_type,
                SUM(base_amount) AS revenue,
                COUNT(*) AS count
            FROM {TABLE}
            WHERE processor_transaction_type IN ('Charge','Dispute','Fee','Refund')
            GROUP BY processor_transaction_type
            ORDER BY
                CASE processor_transaction_type
                    WHEN 'Charge' THEN 1
                    WHEN 'Dispute' THEN 2
                    WHEN 'Fee' THEN 3
                    WHEN 'Refund' THEN 4
                END
        """)).fetchall()

        refund_stats = conn.execute(text(f"""
            SELECT
                SUM(CASE WHEN processor_transaction_type = 'Refund' THEN base_amount ELSE 0 END),
                SUM(base_amount),
                COUNT(CASE WHEN processor_transaction_type = 'Refund' THEN 1 END),
                COUNT(*)
            FROM {TABLE}
            WHERE processor_transaction_type IN ('Charge','Dispute','Fee','Refund')
        """)).fetchone()

        new_purchase = conn.execute(text(f"""
            SELECT COALESCE(pass_name, 'Null'), SUM(base_amount), COUNT(*)
            FROM {TABLE} WHERE transaction_type = 'New Purchase'
            GROUP BY pass_name
            ORDER BY CASE COALESCE(pass_name,'Null')
                WHEN 'Annual' THEN 1 WHEN 'Media' THEN 2
                WHEN 'Month' THEN 3 WHEN 'Null' THEN 4
                WHEN 'Season' THEN 5 ELSE 6 END
        """)).fetchall()

        rebill = conn.execute(text(f"""
            SELECT COALESCE(pass_name, 'Null'), SUM(base_amount), COUNT(*)
            FROM {TABLE} WHERE transaction_type = 'Rebill'
            GROUP BY pass_name
            ORDER BY CASE COALESCE(pass_name,'Null')
                WHEN 'Annual' THEN 1 WHEN 'Media' THEN 2
                WHEN 'Month' THEN 3 WHEN 'Null' THEN 4
                WHEN 'Season' THEN 5 ELSE 6 END
        """)).fetchall()

        monthly_rebill = conn.execute(text(f"""
            SELECT billing_number, SUM(base_amount), COUNT(*)
            FROM {TABLE}
            WHERE transaction_type = 'Rebill' AND billing_number IS NOT NULL
            GROUP BY billing_number ORDER BY billing_number
        """)).fetchall()

        revenue_share = conn.execute(text(f"""
            SELECT COALESCE(attribution_method, 'Null'), SUM(base_amount), SUM(revenue_share_usd)
            FROM {TABLE} WHERE processor_transaction_type = 'Charge'
            GROUP BY attribution_method ORDER BY attribution_method
        """)).fetchall()

        processor_pivot = conn.execute(text(f"""
            SELECT
                processor_transaction_type,
                SUM(base_amount),
                SUM(CASE WHEN processor_fee ~ '^[0-9.\\-]+$'
                         THEN CAST(processor_fee AS NUMERIC) ELSE 0 END),
                COUNT(pass_name)
            FROM {TABLE}
            WHERE processor_transaction_type IN ('Charge','Dispute','Fee','Refund')
            GROUP BY processor_transaction_type
            ORDER BY CASE processor_transaction_type
                WHEN 'Charge' THEN 1 WHEN 'Dispute' THEN 2
                WHEN 'Fee' THEN 3 WHEN 'Refund' THEN 4 END
        """)).fetchall()

        purchase_by_day = conn.execute(text(f"""
            SELECT
                TO_CHAR(transaction_date, 'Mon DD'),
                COUNT(*),
                SUM(base_amount)
            FROM {TABLE}
            WHERE transaction_type = 'New Purchase' AND transaction_date IS NOT NULL
            GROUP BY DATE_TRUNC('day', transaction_date), TO_CHAR(transaction_date, 'Mon DD')
            ORDER BY DATE_TRUNC('day', transaction_date)
        """)).fetchall()

    # ---- Styles ----
    header_font = Font(bold=True, size=11)
    header_fill = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
    total_fill = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
    total_font = Font(bold=True, size=11)
    section_font = Font(bold=True, size=12)
    currency_fmt = '#,##0.00'
    integer_fmt = '#,##0'
    pct_fmt = '0.0%'
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )

    def style_header(ws, row, cols):
        for c in range(1, cols + 1):
            cell = ws.cell(row=row, column=c)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="center")

    def style_row(ws, row, cols, is_total=False):
        for c in range(1, cols + 1):
            cell = ws.cell(row=row, column=c)
            cell.border = thin_border
            if is_total:
                cell.font = total_font
                cell.fill = total_fill

    wb = Workbook()

    # ======================================================================
    # Sheet 1: Revenue Breakdown
    # ======================================================================
    ws1 = wb.active
    ws1.title = "Revenue Breakdown"
    ws1.column_dimensions["A"].width = 28
    ws1.column_dimensions["B"].width = 20
    ws1.column_dimensions["C"].width = 18

    r = 1
    ws1.cell(r, 1, "Revenue Breakdown").font = Font(bold=True, size=14)
    r += 2

    # Revenue by type
    ws1.cell(r, 1, "Type"); ws1.cell(r, 2, "Revenue"); ws1.cell(r, 3, "Count")
    style_header(ws1, r, 3); r += 1
    for row in revenue_by_type:
        ws1.cell(r, 1, row[0])
        ws1.cell(r, 2, float(row[1] or 0)).number_format = currency_fmt
        ws1.cell(r, 3, int(row[2] or 0)).number_format = integer_fmt
        style_row(ws1, r, 3); r += 1

    # Refund rate
    if refund_stats[1] and refund_stats[1] != 0:
        ws1.cell(r, 1, "Refund Rate")
        ws1.cell(r, 2, float(refund_stats[0] or 0) / float(refund_stats[1])).number_format = pct_fmt
        style_row(ws1, r, 3); r += 1

    # Total refunds & disputes
    dispute_rev = sum(row[1] or 0 for row in revenue_by_type if row[0] == "Dispute")
    refund_rev = sum(row[1] or 0 for row in revenue_by_type if row[0] == "Refund")
    dispute_cnt = sum(row[2] or 0 for row in revenue_by_type if row[0] == "Dispute")
    refund_cnt = sum(row[2] or 0 for row in revenue_by_type if row[0] == "Refund")
    ws1.cell(r, 1, "Total Refunds & Disputes")
    ws1.cell(r, 2, float(dispute_rev + refund_rev)).number_format = currency_fmt
    ws1.cell(r, 3, int(dispute_cnt + refund_cnt)).number_format = integer_fmt
    style_row(ws1, r, 3); r += 1

    # Gross base revenue
    gross = sum(row[1] or 0 for row in revenue_by_type)
    ws1.cell(r, 1, "Gross Base Revenue")
    ws1.cell(r, 2, float(gross)).number_format = currency_fmt
    style_row(ws1, r, 3, is_total=True); r += 2

    # New Purchase section
    ws1.cell(r, 1, "New Purchase").font = section_font; r += 1
    ws1.cell(r, 1, "Pass Name"); ws1.cell(r, 2, "Revenue"); ws1.cell(r, 3, "New Subscribers")
    style_header(ws1, r, 3); r += 1
    np_total_rev, np_total_sub = 0, 0
    for row in new_purchase:
        ws1.cell(r, 1, row[0])
        ws1.cell(r, 2, float(row[1] or 0)).number_format = currency_fmt
        ws1.cell(r, 3, int(row[2] or 0)).number_format = integer_fmt
        np_total_rev += float(row[1] or 0)
        np_total_sub += int(row[2] or 0)
        style_row(ws1, r, 3); r += 1
    ws1.cell(r, 1, "Gross New Purchases")
    ws1.cell(r, 2, np_total_rev).number_format = currency_fmt
    ws1.cell(r, 3, np_total_sub).number_format = integer_fmt
    style_row(ws1, r, 3, is_total=True); r += 2

    # Rebill section
    ws1.cell(r, 1, "Rebill").font = section_font; r += 1
    ws1.cell(r, 1, "Pass Name"); ws1.cell(r, 2, "Revenue"); ws1.cell(r, 3, "Subscribers")
    style_header(ws1, r, 3); r += 1
    rb_total_rev, rb_total_sub = 0, 0
    for row in rebill:
        ws1.cell(r, 1, row[0])
        ws1.cell(r, 2, float(row[1] or 0)).number_format = currency_fmt
        ws1.cell(r, 3, int(row[2] or 0)).number_format = integer_fmt
        rb_total_rev += float(row[1] or 0)
        rb_total_sub += int(row[2] or 0)
        style_row(ws1, r, 3); r += 1
    ws1.cell(r, 1, "Gross Rebills")
    ws1.cell(r, 2, rb_total_rev).number_format = currency_fmt
    ws1.cell(r, 3, rb_total_sub).number_format = integer_fmt
    style_row(ws1, r, 3, is_total=True); r += 2

    # Monthly rebill
    ws1.cell(r, 1, "Monthly Rebill Revenue").font = section_font; r += 1
    ws1.cell(r, 1, "Billing #"); ws1.cell(r, 2, "Revenue"); ws1.cell(r, 3, "Subscribers")
    style_header(ws1, r, 3); r += 1
    for row in monthly_rebill:
        ws1.cell(r, 1, float(row[0]) if row[0] is not None else "")
        ws1.cell(r, 2, float(row[1] or 0)).number_format = currency_fmt
        ws1.cell(r, 3, int(row[2] or 0)).number_format = integer_fmt
        style_row(ws1, r, 3); r += 1
    r += 1

    # Revenue share
    if revenue_share:
        ws1.cell(r, 1, "Revenue Share").font = section_font; r += 1
        ws1.cell(r, 1, "Attribution"); ws1.cell(r, 2, "Revenue"); ws1.cell(r, 3, "Rev Share")
        style_header(ws1, r, 3); r += 1
        for row in revenue_share:
            ws1.cell(r, 1, row[0])
            ws1.cell(r, 2, float(row[1] or 0)).number_format = currency_fmt
            ws1.cell(r, 3, float(row[2] or 0)).number_format = currency_fmt
            style_row(ws1, r, 3); r += 1

    # ======================================================================
    # Sheet 2: Processor Transaction Pivot
    # ======================================================================
    ws2 = wb.create_sheet("Processor Transaction Pivot")
    ws2.column_dimensions["A"].width = 30
    ws2.column_dimensions["B"].width = 22
    ws2.column_dimensions["C"].width = 22
    ws2.column_dimensions["D"].width = 20

    ws2.cell(1, 1, "Processor Transaction Pivot").font = Font(bold=True, size=14)
    r = 3
    ws2.cell(r, 1, "Processor Transaction Type")
    ws2.cell(r, 2, "Sum of Base Amount")
    ws2.cell(r, 3, "Sum of Processor Fee")
    ws2.cell(r, 4, "Count of Pass Name")
    style_header(ws2, r, 4); r += 1

    gt_base, gt_fee, gt_count = 0, 0, 0
    for row in processor_pivot:
        ws2.cell(r, 1, row[0])
        ws2.cell(r, 2, float(row[1] or 0)).number_format = currency_fmt
        ws2.cell(r, 3, float(row[2] or 0)).number_format = currency_fmt
        ws2.cell(r, 4, int(row[3] or 0)).number_format = integer_fmt
        gt_base += float(row[1] or 0)
        gt_fee += float(row[2] or 0)
        gt_count += int(row[3] or 0)
        style_row(ws2, r, 4); r += 1

    ws2.cell(r, 1, "Grand Total")
    ws2.cell(r, 2, gt_base).number_format = currency_fmt
    ws2.cell(r, 3, gt_fee).number_format = currency_fmt
    ws2.cell(r, 4, gt_count).number_format = integer_fmt
    style_row(ws2, r, 4, is_total=True)

    # ======================================================================
    # Sheet 3: New Purchase by Day
    # ======================================================================
    ws3 = wb.create_sheet("New Purchase by Day")
    ws3.column_dimensions["A"].width = 16
    ws3.column_dimensions["B"].width = 24
    ws3.column_dimensions["C"].width = 22

    ws3.cell(1, 1, "New Purchase by Day").font = Font(bold=True, size=14)
    r = 3
    ws3.cell(r, 1, "Day")
    ws3.cell(r, 2, "Count of Transaction Type")
    ws3.cell(r, 3, "Sum of Base Amount")
    style_header(ws3, r, 3); r += 1

    gt_cnt, gt_amt = 0, 0
    for row in purchase_by_day:
        ws3.cell(r, 1, row[0])
        ws3.cell(r, 2, int(row[1] or 0)).number_format = integer_fmt
        ws3.cell(r, 3, float(row[2] or 0)).number_format = currency_fmt
        gt_cnt += int(row[1] or 0)
        gt_amt += float(row[2] or 0)
        style_row(ws3, r, 3); r += 1

    ws3.cell(r, 1, "Grand Total")
    ws3.cell(r, 2, gt_cnt).number_format = integer_fmt
    ws3.cell(r, 3, gt_amt).number_format = currency_fmt
    style_row(ws3, r, 3, is_total=True)

    # ---- Save to bytes ----
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()